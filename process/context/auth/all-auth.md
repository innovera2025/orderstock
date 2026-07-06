---
name: context:all-auth
description: Auth context entrypoint for orderstock — next-auth v5 split-config architecture, requireAuth server-side choke-point contract, session policy, lockout, admin user management, and E2E fixtures
keywords: auth, authentication, login, session, jwt, requireauth, role, admin, staff, proxy, middleware, credentials, bcrypt, lockout, playwright storage state
related: [context:all-tests, context:all-database]
metadata:
  read_when: implementing or reviewing any authenticated route, server action, session/role logic, or auth-related test
---

# orderstock - All Auth

Last updated: 2026-07-07 (Phase 06 / program closeout — `/settings` added to the ADMIN edge gate)

Attach this file first for any task touching login, sessions, roles, route protection, or the
admin user-management surface. Phases 04-06 built authenticated features on top of this contract
(phase1-order-system is now program-complete) — read the **requireAuth contract** section below
before writing any new server action.

---

## Architecture

**Split config (edge-safe vs Node):**

- `src/auth.config.ts` — **edge-safe**. Runs in the proxy/edge runtime. MUST NOT import Prisma,
  bcryptjs, or any secret-bearing/Node-only module. Holds `session: { strategy: "jwt", maxAge:
  12h }`, `pages.signIn`, the `authorized` route/role gate callback, and jwt/session callbacks
  that copy `role`/`id` onto the token/session. `providers: []` (populated in `auth.ts`).
- `src/auth.ts` — **Node-runtime**. Spreads `authConfig` and adds the Credentials provider:
  `authorize()` does the Prisma `User` lookup + bcryptjs verify + lockout check.
- `src/proxy.ts` — route protection. `export default NextAuth(authConfig).auth`, importing
  ONLY the edge-safe config.

**Why `src/proxy.ts`, not `middleware.ts`:** Next.js 16 renamed the route-protection file to
`proxy.ts`. A `middleware.ts` file is **silently ignored** — no build error, no warning, routes
simply stay unprotected. Because this project uses the `src/` layout, the file must sit at
`src/proxy.ts` (sibling of `src/app/`), not repo-root — a wrong location fails the same silent
way. **Verify by runtime redirect** (logged-out request to a protected route → 307 to `/login`),
never by build success — a mis-placed or mis-shaped `proxy.ts` still builds green.

**Matcher exclusions** (everything else is guarded):
```
/login, /api/auth/*, /api/health, _next/static, _next/image, fonts, favicon.ico,
*.{woff2,woff,ttf,otf,png,jpg,jpeg,svg,ico,css}
```

**ADMIN-only route additions (Phase 06):** the edge `authorized` callback in `src/auth.config.ts`
ADMIN-gates `/settings` in addition to the pre-existing `/admin` branch (defense-in-depth; the real
boundary is still server-side `requireAuth("ADMIN")` in every settings action). `src/app/nav.tsx`
renders the settings link only when `role === "ADMIN"` (same pattern as the admin-users nav link).
`e2e/settings.spec.ts` proves the runtime redirect for all three cases (unauth, STAFF, ADMIN)
against `/settings/db`.

---

## requireAuth(role?) — the real security boundary

`proxy.ts` is convenience only. **`src/lib/auth-guard.ts`'s `requireAuth(role?)` is the actual
boundary** — a raw POST to a server action bypasses page-level routing, so every mutating action
must call it directly.

**Contract every new server action (Phases 04-06) MUST follow:**

```ts
import { requireAuth, requireAuthState, AuthError } from "@/lib/auth-guard";

// void-returning action (no error channel) — let it bubble to the Next error boundary
export async function someAction(...) {
  await requireAuth(); // or requireAuth("ADMIN") for admin-only
  ...
}

// state-returning action ({ error?: string } shape) — catch and map into the state
export async function someStateAction(...): Promise<SomeActionState> {
  const authError = await requireAuthState(); // or requireAuthState("ADMIN")
  if (authError) return authError;
  ...
}
```

- `requireAuth` re-reads `active` + `role` from the DB on **every call** (never trusts the
  cached JWT alone) — this closes the deactivation/demotion window inside the 12h token
  lifetime. Marginal cost: one extra query on actions that already touch the DB.
- Throws `AuthError` (typed, Thai message) matching the existing `ActionState.error` convention
  — `err.message` is Thai text safe to surface directly in the UI.
- There is **no single `ActionState` type** — each domain has its own (`ShopActionState`,
  `ProductActionState`, etc.); `requireAuthState` returns a plain `{ error: string }` shape you
  merge into your own state type.
- A fully-automated grep gate (`auth-guard-coverage.test.ts`) asserts every exported action in
  a file calls `requireAuth`/`requireAuthState` — a missed action is the #1 elevation risk. Phase
  06 added a dedicated `ADMIN_MODULES` assertion so ADMIN-only action files (settings, admin/users)
  are checked for the `"ADMIN"` argument specifically, not just presence of `requireAuth` at all.
  Any new action file should extend this gate's `MODULES`/`ADMIN_MODULES` lists (and the page-grep
  list for new pages), following the settings `actions.ts` precedent.

---

## Session policy

- **Strategy:** JWT (mandatory for Credentials provider). **maxAge: 12h.**
- Role/active are sourced from the DB at `authorize()` time → carried on the JWT → copied to
  the session — **never** trust client input for role.
- `requireAuth` re-checks role/active from the DB on every call (see above) — this is the real
  revocation mechanism, not JWT expiry alone.
- Known accepted residual: a 12h window plus DB re-check on `requireAuth` calls is the current
  posture; a shorter maxAge or a server-side session denylist is the optional hardening upgrade
  if this combo proves insufficient (see backlog note below).

## Login lockout

- `src/lib/login-attempts.ts` — `LoginAttemptTracker`, **username-keyed**, in-memory, injectable
  clock. Default: 5 failed attempts → 15-minute lockout window; success resets the counter;
  window expires and clears the record automatically.
- **Accepted known-gap:** username-keyed lockout lets an attacker deliberately lock a victim's
  account. Acceptable for a LAN-internal app. IP+username or delay-based strategy is the
  hardening upgrade if needed.
- In-memory state resets on server restart (single-process app; no distributed store).

## Generic error rule (no enumeration)

- `authorize()` returns `null` for BOTH "no such user" and "wrong password" — never branch.
- The login UI shows exactly ONE generic Thai message for any failure:
  `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง`.
- Timing-based username enumeration is closed with a dummy bcryptjs compare against a constant
  hash when the username isn't found, so response timing doesn't leak user existence.

---

## User management (admin UI)

- Path: `src/app/admin/users/` — `page.tsx` (list, ADMIN-gated + re-checked server-side,
  `passwordHash` excluded from any query reaching the client), `actions.ts`
  (`createUser`/`editRole`/`resetPassword`/`deactivateUser`/`activateUser`, all
  `requireAuth("ADMIN")`), `create-user-form.tsx`, `user-row.tsx`.
- **Last-admin guard:** `editRole`/`deactivateUser` refuse to demote or deactivate the last
  active ADMIN (would lock everyone out of `/admin`).
- **Role source of truth:** `ROLES`/`ROLE_LABELS` live in `src/lib/product-order.ts` — reuse
  these constants; do not invent a parallel role enum or string set. `role` is a `String` column
  (SQL Server has no Prisma enums), not a Prisma `enum` — see `database/all-database.md`.
- Login page: `src/app/(auth)/login/` (`page.tsx`, `login-form.tsx`, `actions.ts`) — Thai form,
  server action + `useActionState`, matching the shops/products form convention.

---

## E2E fixtures (Playwright)

- `playwright.config.ts` (root) — `setup` project runs `e2e/auth.setup.ts` first; `chromium`
  project depends on it. `webServer: pnpm start` against `localhost:3000`.
- `e2e/auth.setup.ts` produces **reusable ADMIN + STAFF storage-state fixtures**
  (`e2e/.auth/admin.json`, `e2e/.auth/staff.json` — gitignored). It also idempotently creates the
  `staff_e2e` STAFF user (the seed only creates ADMIN).
- **Reusing fixtures in a new spec** (Phases 04-06):
  ```ts
  test.use({ storageState: "e2e/.auth/admin.json" }); // or staff.json
  ```
  or per-project `dependencies: ["setup"]` + a project-level `storageState` in
  `playwright.config.ts` if a whole new spec file needs one role throughout.
- Requires: sandbox SQL Server up, seeded ADMIN (`pnpm tsx prisma/seed.ts`), and
  `SEED_ADMIN_PASSWORD` set in `.env` (Playwright does not auto-load `.env`; `playwright.config.ts`
  calls `process.loadEnvFile()` — Node 22 feature).

---

## Known Gaps

- No audit log (Phase 1 scope) — partial trail via the login-attempts counter only.
- "Force password change on first login" NOT enforced — no schema migration this phase
  (SEED-2 operational known-gap). Admin delivers a temp password out-of-band; user changes it
  via the reset-password UI. Override = add a `mustChangePassword` column if enforcement is
  wanted later.
- Username-keyed lockout (see Login lockout above) — accepted for a LAN-internal app.
- `AUTH_SECRET` / `AUTH_TRUST_HOST` — v5 env var names (NOT `NEXTAUTH_SECRET`/`NEXTAUTH_URL`).
  Real values live only in `.env` (gitignored); `.env.example` has placeholders only.
- Backlog: `process/features/order-system/backlog/auth-session-revocation-hardening_NOTE_06-07-26.md`
  tracks the optional shorter-maxAge / server-side session-denylist hardening if the current
  12h+DB-recheck combo proves insufficient.

## Update Triggers

Update this file when: the session/role contract changes, `requireAuth`'s signature or
re-check behavior changes, new auth-gated route categories are added, the lockout policy
changes, or new E2E auth fixtures/roles are introduced.

<!-- GENERATED:routing -->
| Task type | Load first | Then load |
|---|---|---|
| new server action (any phase) | `all-context.md`, `auth/all-auth.md` | `src/lib/auth-guard.ts` |
| login/session/lockout work | `all-context.md`, `auth/all-auth.md` | `src/auth.ts`, `src/auth.config.ts`, `src/lib/login-attempts.ts` |
| E2E test needing an authenticated user | `all-context.md`, `auth/all-auth.md`, `tests/all-tests.md` | `e2e/auth.setup.ts`, `playwright.config.ts` |
| admin user-management UI/actions | `all-context.md`, `auth/all-auth.md` | `src/app/admin/users/**` |
<!-- /GENERATED:routing -->
