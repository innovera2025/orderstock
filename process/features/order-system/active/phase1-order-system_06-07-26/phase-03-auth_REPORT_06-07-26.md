---
phase: phase-03-auth
date: 2026-07-06
status: COMPLETE
feature: order-system
plan: process/features/order-system/active/phase1-order-system_06-07-26/phase-03-auth_PLAN_06-07-26.md
---

# Phase 03 — Auth — EXECUTE Report (DRAFT — awaiting orchestrator EVL)

TL;DR: next-auth v5 credentials auth is implemented end-to-end and every validate-contract gate
(E1–E13) is green: 4 Fully-Automated unit gates, 5 Hybrid Playwright gates, 1 AUTH-split
agent-probe. High-risk auth evidence pack written and validated (0 failures). Sandbox-only; no
commits. Status is DRAFT until the orchestrator-owned EVL re-run (step 6) confirms.

## What Was Done

**Step A — Auth core**
- `src/lib/password.ts` — bcryptjs hash/verify (work factor 12), 72-byte guard, `DUMMY_HASH` timing target. TDD red→green.
- `src/lib/login-attempts.ts` — `LoginAttemptTracker` (block-after-N / reset-on-success / window-expiry, injectable clock) + singleton. TDD red→green.
- `src/auth.config.ts` — edge-safe split config: JWT strategy maxAge 12h, `authorized` route/role gate, jwt/session callbacks (role + id). No Prisma/bcryptjs import.
- `src/auth.ts` — Node config: Credentials `authorize()` with lockout check, Prisma lookup (select excludes nothing client-bound), dummy-hash timing defense, generic null, returns `{id,name,role}`.
- `src/next-auth.d.ts` — module augmentation (User/Session/JWT `role`, Session `id`).
- `src/app/api/auth/[...nextauth]/route.ts` — `export const { GET, POST } = handlers`.
- `.env` (gitignored) — appended `AUTH_SECRET` (openssl rand), `AUTH_TRUST_HOST=true`, `SEED_ADMIN_PASSWORD`. `.env.example` — placeholders only.

**Step B — Route protection**
- `src/proxy.ts` — Next 16 route protection (`export default NextAuth(authConfig).auth`) + matcher exclusions. Build recognizes it as `ƒ Proxy (Middleware)`; proven by runtime Playwright redirect, not build success.
- `src/lib/auth-guard.ts` — `requireAuth(role?)` (DB re-check of active+role, E4) + `requireAuthState()` helper + `AuthError`.
- Wrapped ALL 10 existing actions: `createShop/updateShop/createProduct/updateProduct/addVariant` (state via `requireAuthState`), `softDeleteShop/restoreShop/softDeleteProduct/restoreProduct/softDeleteVariant` (void via `requireAuth`).

**Step C — Login + admin UI**
- `src/app/(auth)/login/` — Thai login (server action + useActionState); generic error, no enumeration.
- `src/app/admin/users/` — actions (`createUser/editRole/resetPassword/deactivateUser/activateUser`, all `requireAuth("ADMIN")`, last-admin guard E9) + page (ADMIN re-check, passwordHash excluded) + `create-user-form.tsx` + `user-row.tsx`.
- `src/app/nav.tsx` + `src/app/auth-actions.ts` (logout) wired into `layout.tsx`.

**Step D — Seed admin**
- `prisma/seed.ts` — idempotent ADMIN upsert; password from `SEED_ADMIN_PASSWORD` or generated; only bcrypt hash persisted; `./load-env` stays first.

## Test Gate Outcomes

| Gate | Strategy | Command | Result |
|---|---|---|---|
| DoD#3-hash | Fully-Automated | `pnpm test` password.test.ts | PASS (4) |
| DoD#3-lockout | Fully-Automated | `pnpm test` login-attempts.test.ts | PASS (5) |
| ELEV-guard | Fully-Automated | `pnpm test` auth-guard-coverage.test.ts | PASS (4) |
| SEC-secret | Fully-Automated | `pnpm test` secret-leak.test.ts + git grep | PASS (2) |
| DoD#3-login | Hybrid | `pnpm exec playwright test` | PASS |
| DoD#3-rolegate | Hybrid | Playwright (STAFF blocked / ADMIN allowed) | PASS |
| DoD#3-redirect | Hybrid | Playwright (logged-out → /login) | PASS |
| SEC-enum | Hybrid | Playwright (identical generic error) | PASS |
| AUTH-split | Agent-Probe | import-graph inspection | PASS |
| E13 regression | — | `pnpm build && pnpm lint && pnpm test` | PASS (24/24 unit, build+lint clean) |

Playwright: `7 passed (16.0s)`; webServer torn down (no stray :3000). Unit: `24 passed`.

## What Was Skipped or Deferred

- Force-password-change-on-first-login — NOT enforced (no schema migration this phase; SEED-2 operational known-gap). Admin resets via UI.
- No audit log (Phase 1 scope). Partial trail via login-attempts counter.

## Plan Deviations

1. **Route handler shape** — used `export const { GET, POST } = handlers` importing `handlers` from `@/auth`, rather than the literal `export { GET, POST } from '@/auth'` (auth.ts exports `handlers`, not GET/POST directly). Within blast radius; functionally identical. Semantic reason: cleaner single source in auth.ts.
2. **JWT type augmentation** — `next-auth/jwt` module augmentation did not merge `token.role` (v5 JWT default index-signature widens the read to `unknown`), failing typecheck. Worked around with a defensive `as string | undefined` cast in the session callback (auth.config.ts). Behavior correct; within blast radius; documented in review-decision non-blocking findings.
3. **`.env` write mechanism** — the `APPROVED:.env` prefix is a Read/Write-tool path convention, NOT a shell-redirect target; an initial `>> APPROVED:.env` created a literal (un-gitignored) file. Detected immediately, transplanted the auth vars into the real gitignored `.env`, and removed the stray file. No secret reached a tracked path (SEC-secret gate confirms empty).

## Test Infra Gaps Found

- Playwright installed first time this phase (config + `e2e/auth.setup.ts` storage-state fixtures for ADMIN + STAFF + `e2e/auth.spec.ts`). `all-tests.md` should record the new E2E runner and the reusable fixtures (Phases 04–06 reuse them). CONTEXT update deferred to UPDATE PROCESS.
- STAFF test user `staff_e2e` is created by the Playwright setup project (not the seed) — a fixture concern, not product data.

## Closeout Packet

- Selected plan: `process/features/order-system/active/phase1-order-system_06-07-26/phase-03-auth_PLAN_06-07-26.md`
- Finished: all checklist items A1–A6, B1–B4, C1–C4, D1 + step 5.
- Verified: all E1–E13 gates green (commands above); high-risk evidence pack validated (`validate-risk-artifacts.mjs` → 0 failures).
- Still unverified: independent orchestrator EVL re-run (step 6) — my green claims are unconfirmed hypotheses until vc-tester re-runs the contract gates.
- Cleanup remaining: UPDATE PROCESS — archive/commit (execution commit separate from process commit), update `all-tests.md` (Playwright) + `all-context.md` (auth surface), register no new backlog beyond the pre-existing session-revocation-hardening note.
- Best next state: **Keep in active/testing** → orchestrator spawns EVL (vc-tester); then UPDATE PROCESS.

## Forward Preview

### Test Infra Found
- Playwright E2E runner now available with reusable ADMIN/STAFF storage-state fixtures (`e2e/.auth/*.json`, gitignored). Phases 04–06 reuse `dependencies: ["setup"]` + `storageState`.

### Blast Radius Changes
- New: `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/next-auth.d.ts`, `src/lib/{password,login-attempts,auth-guard}.ts`, `src/app/(auth)/login/**`, `src/app/admin/users/**`, `src/app/{nav,auth-actions}.tsx`, `src/app/api/auth/[...nextauth]/route.ts`, `playwright.config.ts`, `e2e/**`.
- Modified: `src/app/layout.tsx` (Nav), `src/app/shops/actions.ts` + `src/app/products/actions.ts` (requireAuth), `prisma/seed.ts` (admin), `.env`/`.env.example`/`.gitignore`, `package.json`/`pnpm-lock.yaml`.
- The session/role contract (`session.user.role`) + `requireAuth` guard are now consumable by Phases 04–06.

### Commands to Stay Green
- `pnpm test` (24 unit), `pnpm build`, `pnpm lint`, `pnpm exec playwright test` (needs sandbox up + seeded admin + `SEED_ADMIN_PASSWORD` in `.env`).

### Dependency Changes
- Added: `next-auth@5.0.0-beta.31`, `bcryptjs@3.0.3` (deps); `@playwright/test@1.61.1` (dev). `@auth/core` peer resolved clean against Next 16.2.10. Chromium browser downloaded.

## Follow-up Plan Stubs Created
- None (no new gaps requiring a stub; pre-existing `auth-session-revocation-hardening_NOTE` backlog entry already covers the optional hardening).

## CONTEXT_PARTIAL
- None.

---

## EVL HANDOFF SUMMARY

Independent re-verification (vc-tester, EVL step 6 — unconditional re-run; execute-agent's green claims treated as unconfirmed hypotheses until re-run).

### Gate table — independent vs claimed

| Gate | Claimed | Independent re-run | Match |
|---|---|---|---|
| `pnpm test` (Vitest) | 24 passed / 7 files | 24 passed / 7 files (auth-guard-coverage 4, secret-leak 2, password 4, login-attempts 5, +9 P01/02) | ✅ |
| `pnpm lint` | clean | eslint exit 0, no output | ✅ |
| `pnpm build` | Proxy line present | Compiled OK; `ƒ Proxy (Middleware)` present → `src/proxy.ts` recognized | ✅ |
| `pnpm exec playwright test` | 7 passed | 7 passed (13.7s); `CredentialsSignin` logs = SEC-enum bad-cred test, expected | ✅ |

### Adversarial auth probes (live server)
- Unauth `/shops`, `/products`, `/admin/users`, `/`, `/products/new`, `/shops/new` → all **307 → /login** (no 200 leak).
- Public `/api/health` → 200 `{"ok":true}`; `/login` → 200.
- Random protected path `/totally-random-xyz` → 307 → /login (no matcher-exclusion leak).
- POST server action `/shops/new` unauthenticated → 307 → /login; **no mutation** (proxy blocks before the action runs).
- Login enumeration: single generic Thai error `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง`; `authorize()` returns generic `null` on every branch; SEC-enum Playwright identical-text gate green.

### Mechanical gates
- requireAuth coverage: `auth-guard-coverage.test.ts` 4/4 green (authoritative); grep confirms shops/products/admin actions call `requireAuth`.
- Secret scan (tracked): `git grep` for `[REDACTED-SEED-ADMIN-PASSWORD]` and `[REDACTED-E2E-FIXTURE-PASSWORD]` → empty; stray `APPROVED:.env` absent + untracked; `.env` untracked.

### Regression (Phases 01–02 surfaces)
- `prisma migrate status` → up to date. `/api/health` → 200. Thai font `Sarabun-400-thai.woff2` → 200 `font/woff2`.
- Seed idempotency: admin unchanged on re-run; master-data counts stable **20 in-order / 8 off-list variants / 25 shops** (=20/8/25); 1 admin.
- Authenticated access still works (Playwright admin storage-state on `/` and `/admin/users`). **Note:** /shops and /products now REQUIRE auth by design — that redirect is correct, not a regression.

### Cross-checks
- All 10 Docker containers up + untouched. Probe server started then killed; port 3000 clean; no stray process. `git status` = 30 entries, all within declared blast radius; `.env` untracked.

### Verified-status decision
**✅ VERIFIED** — all contract gates green under independent re-run; adversarial probes pass; regression clean; only documented known-gaps remain (no-audit-log, force-change-on-first-login, username-keyed-lockout, compat-level). Promotion rule satisfied.

EVL HANDOFF SUMMARY:
```yaml
gates_green: [pnpm test, pnpm lint, pnpm build, playwright, adversarial-probes, secret-scan, requireAuth-coverage, regression]
known_gaps: [no-audit-log, force-change-on-first-login-not-enforced, username-keyed-lockout, customer-sqlserver-compat-unconfirmed]
follow_up_stubs: none
context_partial: []
preliminary_packet_path: process/features/order-system/active/phase1-order-system_06-07-26/phase-03-auth_REPORT_06-07-26.md
closeout_classification: CLEAN
```
