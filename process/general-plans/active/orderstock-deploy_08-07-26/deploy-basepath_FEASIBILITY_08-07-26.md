---
slug: orderstock-deploy
date: 2026-07-08
verdict: VIABLE
originating-phase: spec
---

# Feasibility Verdict — NextAuth v5 + Next.js 16 under `basePath: '/orderstock'`

## Hypothesis

NextAuth v5 (`next-auth@5.0.0-beta.31`, Credentials + JWT) + Next.js 16.2.10 work correctly under
`basePath: '/orderstock'` — the full login/gate/logout flow functions when the app is served at
the subpath `/orderstock` (as it will be at `app.krs.co.th/orderstock`).

## Mechanism Under Test

Whether Next.js's global `basePath` config, combined with NextAuth v5's split edge/Node config
(`src/auth.config.ts` + `src/auth.ts` + `src/proxy.ts`), correctly: (a) namespaces the
`/api/auth/*` route handler, (b) gates every route including the bare root `/`, (c) constructs
redirect targets that include the basePath prefix, and (d) survives a production build.

## Probe Family

**1 — Local process / Node script** (Next.js dev + production build run locally against the
existing sandbox SQL Server) plus **2 — integration via HTTP** (curl-driven login/session/logout
flow against the running local server).

## Probe Cost Class

**cheap-local** — local Next.js dev/build only, against the already-running local sandbox SQL
Server container (`orderstock-sql`, already up). No external services, no billed providers. Gate
met; no opt-in required.

## Probe Method

1. Created a git **worktree** at a scratch path (NOT the live `:3000` dev server's directory —
   Next.js refuses a second `next dev` in the same project directory even on a different port,
   so a worktree was required to avoid touching the live server). Shared `node_modules` via
   symlink and copied `.env` (via an internal Node script — never read/echoed by the agent).
2. Created a **throwaway** `probe_admin_temp` ADMIN user directly in the sandbox DB via a
   temporary script (`bcryptjs` hash, `role: "ADMIN"`) — avoided ever needing to read the real
   seeded admin credentials from `.env`. Deleted after the probe.
3. Applied 3 temporary edits (later fully reverted): `next.config.ts` (`basePath: "/orderstock"`),
   `src/app/(main)/db-status.tsx` (prefix the raw client `fetch("/api/health")` with
   `process.env.NEXT_PUBLIC_BASE_PATH`), and (after failure — see below) two additional fixes to
   `src/auth.config.ts` and `src/proxy.ts`.
4. Ran `next dev --webpack` (Turbopack failed on the symlinked `node_modules` — a worktree/symlink
   artifact unrelated to basePath itself; irrelevant to production, which doesn't use dev-mode
   Turbopack) on port 3007, iterated empirically through several config combinations, and drove
   the full login/session/logout flow via `curl` (CSRF token → credentials POST → session cookie
   → authenticated requests → signout).
5. Ran `next build --webpack` with the final working config to confirm no basePath-related
   build-time errors.
6. Reverted all edits, deleted the worktree, deleted the temp DB user, confirmed `git status`
   clean.

## Evidence Captured

**Acceptance checks — final result (all 8 PASS) with the working config below:**

| # | Check | Result |
|---|---|---|
| 1 | `GET /orderstock/` logged out → redirects to `/orderstock/login` | PASS — `curl -L` final destination `http://localhost:3007/orderstock/login?callbackUrl=...`, HTML contains the Thai login-page marker `เข้าสู่ระบบ` |
| 2 | `GET /login` (no prefix) → 404 | PASS — confirmed `status=404` |
| 3 | POST login with valid creds → session + lands on `/orderstock/` | PASS — `302` to `http://localhost:3007/orderstock`, `authjs.session-token` cookie set |
| 4 | `/orderstock/api/auth/*` reachable | PASS — `csrf` and `session` both `200` with correct JSON once the `AUTH_URL` bug (below) was fixed |
| 5 | Authenticated `GET /orderstock/api/health` → 200 | PASS — `{"ok":true}` (proves the basePath-prefixed client fetch fix) |
| 6 | Logout → lands on `/orderstock/login` | PASS — signout `302`; subsequent authenticated-route request correctly re-gated (`307` to `/orderstock/login?...`) |
| 7 | ADMIN-gated route served for admin; unauth/blocked otherwise | PASS — `/orderstock/admin/users` → `200` authenticated (role=ADMIN in session), `307` to login unauthenticated |
| 8 | proxy.ts root-path matcher (Next bug #73786) | PASS after fix — see below; root path initially bypassed the auth gate entirely |

**Two real bugs found and fixed empirically (not from docs — from failing evidence):**

1. **`AUTH_URL` must NOT include the basePath suffix.** Setting
   `AUTH_URL=http://localhost:3007/orderstock/api/auth` (the naive first guess) broke
   `/api/auth/csrf` and `/api/auth/session` with `[auth][error] UnknownAction: Cannot parse
   action at /api/auth/session` (400) — Auth.js double-strips the basePath (Next.js already
   strips it before the route handler sees the path; telling Auth.js to strip it again via
   `AUTH_URL` or `authConfig.basePath` mismatches). Fix: **omit `AUTH_URL` entirely** (rely on
   `AUTH_TRUST_HOST=true` + request host) **or** set it to the **bare origin only**
   (`http://localhost:3007`, no `/orderstock` or `/api/auth` suffix). Also confirmed:
   **`authConfig.basePath` should NOT be set at all** — Next.js's own `basePath` config already
   namespaces the `api/auth/[...nextauth]/route.ts` handler; adding `authConfig.basePath` on top
   causes the same double-strip failure.
2. **Root path `/` bypassed the auth gate entirely under basePath** (matches Next.js issue
   #73786, confirmed empirically here). `GET /orderstock` (no trailing slash, logged out) returned
   `200` with real page content instead of a redirect. Cause: the existing matcher regex
   `"/((?!login|api/auth|...).*)"` fails to match the bare root once basePath-stripping is in
   effect. Fix: add an **explicit `"/"` entry** to the `proxy.ts` matcher array (alongside the
   existing negative-lookahead pattern).
3. **Redirect target lost the basePath prefix.** Before the fix, an unauthenticated deep-route hit
   (e.g. `/orderstock/admin/users`) redirected to `location: /login?callbackUrl=...` — a 404 in
   production since only `/orderstock/*` is served. Fix: `authConfig.pages.signIn` must be set to
   the **basePath-prefixed value** (`"/orderstock/login"`), not `"/login"`.

**Client-side raw fetch prefix confirmed necessary:** `db-status.tsx`'s `fetch("/api/health")` is
a plain relative-to-origin browser fetch — Next's automatic basePath prefixing applies only to
`<Link>`/`useRouter`/`redirect()`, not raw `fetch()` calls. Fixed via
`fetch(\`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/health\`)`. No `SessionProvider` or
client-side `next-auth/react` calls exist in this app (login/logout are server actions calling the
server-side `signIn`/`signOut` from `@/auth` directly), so this is the **only** client-fetch call
in the app needing this treatment — confirmed by inspection, not just assumption (checked
`grep -rn "signOut"` across `src/app`, only one server-action usage found).

**Production build:** `next build --webpack` with the final config (see below) completed with
exit code 0, `✓ Compiled successfully`, TypeScript passed, all 19 routes generated correctly under
the `Route (app)` table (no basePath-related build errors). `next start` full re-run was **not**
performed (time-boxed as a cheap-local probe) — see known-gap below.

## The Exact Working Config (diff, relative to current `main`)

```diff
--- a/next.config.ts
+++ b/next.config.ts
@@ -1,7 +1,8 @@
 import type { NextConfig } from "next";

 const nextConfig: NextConfig = {
+  basePath: "/orderstock",
   // Prisma 7 driver-adapter uses node-mssql (mssql/tedious) at runtime. These are
   // native Node packages that must not be bundled by Turbopack; keep them external.
   // Phase 05 may extend this list (e.g. Playwright) — EXTEND, never rewrite.
   serverExternalPackages: ["mssql", "tedious"],
 };

--- a/src/auth.config.ts
+++ b/src/auth.config.ts
@@ -7,7 +7,7 @@
 // `proxy.ts` (Next 16 route protection) imports THIS config to decode the JWT and run the
 // `authorized` callback at the edge. auth.ts spreads this config and appends the provider.
 export const authConfig = {
-  pages: { signIn: "/login" },
+  pages: { signIn: "/orderstock/login" },
   // Credentials provider REQUIRES the JWT session strategy. maxAge locked to 12h (decision 5);
   // requireAuth re-checks User.active/role from the DB so a demoted/deactivated user inside
   // the 12h window still loses access (E4).
@@ -22,7 +22,7 @@
     authorized({ auth, request }) {
       const isLoggedIn = !!auth?.user;
       const { pathname } = request.nextUrl;
-      // ...
+      // (unchanged — pathname is already basePath-stripped by Next.js, no basePath logic needed here)
       if (pathname.startsWith("/admin") || pathname.startsWith("/settings")) {
         return isLoggedIn && auth?.user?.role === "ADMIN";
       }
       return isLoggedIn;
     },
     // NOTE: do NOT add `basePath` to this config object — see verdict evidence above.

--- a/src/proxy.ts
+++ b/src/proxy.ts
@@ -16,6 +16,7 @@
   // Guard everything EXCEPT: the login page, Auth.js endpoints, the health check, Next static
   // assets/images, self-hosted fonts, and common static file extensions (B3 exclusions).
   matcher: [
+    "/",
     "/((?!login|api/auth|api/health|_next/static|_next/image|fonts|favicon.ico|.*\\.(?:woff2?|ttf|otf|png|jpe?g|svg|ico|css)).*)",
   ],
 };

--- a/src/app/(main)/db-status.tsx
+++ b/src/app/(main)/db-status.tsx
@@ -10,7 +10,7 @@
   useEffect(() => {
     let active = true;
-    fetch("/api/health")
+    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/health`)
       .then((res) => res.json())
```

**Required env vars at deploy (production host, `app.krs.co.th/orderstock`):**
```
NEXT_PUBLIC_BASE_PATH=/orderstock       # new — must match next.config.ts basePath, build-time baked (NEXT_PUBLIC_* vars are inlined at build)
AUTH_TRUST_HOST=true                    # already required today — unchanged
# AUTH_URL: leave UNSET if the reverse proxy forwards Host/X-Forwarded-* correctly (recommended),
#           OR set to the BARE origin only, e.g. AUTH_URL=https://app.krs.co.th  (NEVER include
#           /orderstock or /api/auth in this value — that reproduces the "Cannot parse action" bug).
```

**Reverse-proxy note (not tested — see known-gap):** this probe used Next.js's own dev/prod
server directly on a bare port; it did NOT probe an actual nginx/IIS reverse-proxy in front of it
forwarding `/orderstock/*` to the Next.js process. `AUTH_TRUST_HOST=true` plus correct
`X-Forwarded-Host`/`X-Forwarded-Proto` headers from the proxy should be sufficient (matches
existing `docs/deployment-guide.md` guidance for the non-basePath case), but this exact
reverse-proxy hop was not empirically probed here.

## Verdict

**VIABLE**

## Resulting Design Constraint

- **What this licenses:** The deploy plan may proceed on the assumption that NextAuth v5 +
  Next.js 16 basePath deployment at `/orderstock` works correctly, using the exact 4-file diff
  above (next.config.ts, auth.config.ts, proxy.ts, db-status.tsx) plus the 2 env vars listed. All
  8 acceptance checks (root-path gate, no-prefix 404, login, auth API reachability, authenticated
  health check, logout, ADMIN role gate, matcher fix) are empirically proven in dev mode, and the
  config passes a clean production `next build`.
- **What this forbids:** Do NOT set `authConfig.basePath` at all (causes the
  `UnknownAction: Cannot parse action` 400 on every `/api/auth/*` call). Do NOT set `AUTH_URL` to
  include the `/orderstock` prefix or the `/api/auth` suffix (same failure). Do NOT rely on the
  bare matcher regex alone for `proxy.ts` — the explicit `"/"` matcher entry is required or the
  root path silently bypasses auth entirely (a real security hole, not just a redirect nicety).
  Do NOT assume other raw client-side `fetch()` calls are automatically basePath-safe — audit any
  new one the same way `db-status.tsx` was fixed here (there is currently exactly one such call in
  the app).
- **What remains uncertain (known-gap):** (1) `next start` (full production server, not just
  `next build`) was not empirically re-run against all 8 checks — recommend a quick smoke re-test
  during the actual deploy plan's EXECUTE phase. (2) The real reverse-proxy hop (nginx/IIS in
  front of the Node process, forwarding `/orderstock/*`) was not probed — only the bare Next.js
  server on a local port. (3) Playwright E2E suite (`e2e/*.spec.ts`, `playwright.config.ts`) was
  not re-run under basePath — the existing specs hardcode root-relative paths (`/login`,
  `/admin/users`, etc.) and will need a `baseURL` update (e.g. `http://localhost:PORT/orderstock`)
  plus internal path adjustments before they pass against a basePath deployment; this is deploy-plan
  scope, not proven here. (4) `output: "standalone"` (mentioned in the original hypothesis as a
  candidate deploy setting) was not tested — orthogonal build-packaging concern, unrelated to the
  basePath mechanism itself.
