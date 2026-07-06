---
name: plan:phase1-order-system-phase-03-auth
description: "orderstock Phase 1 — Phase 03: next-auth v5 credentials, password hashing, ADMIN/STAFF roles, middleware route protection, admin user management"
date: 06-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: order-system
  phase: phase-03
---

# Phase 03 — Auth

**Program:** phase1-order-system
**Umbrella plan:** process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
**Phase status:** ✅ VERIFIED (EVL step 6 complete — all contract gates re-run independently green; adversarial auth probes + Phase 01/02 regression clean; only documented known-gaps remain; UPDATE PROCESS/commit next)
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-03-auth_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Add authentication and role-based access: next-auth v5 (Auth.js, pinned `5.0.0-beta.31`) credentials provider with JWT sessions (mandatory for credentials; maxAge 12h), password hashing via **bcryptjs** (pure-JS, no native build — customer platform unknown), ADMIN/STAFF roles carried on the JWT and re-checked server-side, route protection via **`proxy.ts`** (Next 16's replacement for the DEAD `middleware.ts`), an admin user-management page, a seeded admin user, and basic login rate-limiting/lockout. This is a HIGH-RISK auth surface — a STRIDE scan and server-side re-verification are required.

---

## Entry Gate

- Phase 02 exit gate passed (schema + `User` model exist and migrate to sandbox; CRUD proven).
- **User model is already auth-ready** (username/passwordHash/role/active from Phase 02) — NO schema migration this phase; seed extension only.
- `next-auth@5.0.0-beta.31` pinned; verify `@auth/core` peer at install. Next major is 16.2.x (Phase 01) → route protection lives in **`proxy.ts`**, not `middleware.ts`.
- Hashing = **bcryptjs** (decision locked; pure-JS, zero native build).

---

## Blast Radius

- `src/auth.config.ts` — edge-safe SPLIT config (NO Prisma, NO bcryptjs imports); `authorized` callback + matcher exclusions
- `src/auth.ts` — Node-runtime config: Credentials provider + Prisma lookup (via `src/lib/db.ts` singleton) + bcryptjs verify; jwt/session callbacks add `role`
- `src/app/api/auth/[...nextauth]/route.ts` — **Auth.js v5 route handler (REQUIRED — was omitted)**; `export { GET, POST } from '@/auth'`
- `proxy.ts` (root/src) — **Next 16 route protection (NOT `middleware.ts` — that file is silently ignored in Next 16, no build error)**; `export default NextAuth(authConfig).auth` importing the edge-safe `auth.config.ts`. The old `export { auth as middleware }` pattern FAILS under `proxy.ts` — do NOT copy pre-16 tutorials. Node runtime; matcher config syntax unchanged.
- `src/lib/password.ts` — bcryptjs hash + verify helpers (server-only; work factor ≥10)
- `src/next-auth.d.ts` — **module augmentation (PVL P1)** adding `role` to `Session['user']` and the JWT `token`; **REQUIRED** — without it `session.user.role`/`token.role` fail `pnpm build` typecheck
- `src/lib/auth-guard.ts` — shared `requireAuth(role?)` choke-point; wraps ALL 10 existing shop/product actions + new admin actions; throws typed Error w/ Thai message matching existing `ActionState.error` convention
- `src/lib/login-attempts.ts` — basic rate-limit/lockout (DB attempt counter or delay)
- `src/app/(auth)/login/**` — Thai login page + server action (useActionState, shops/products form convention)
- `src/app/admin/users/**` — list / create / edit-role / reset-password / **deactivate** users (ADMIN only; reuse User.active + soft-delete UI pattern)
- `prisma/seed.ts` — extend: idempotent admin upsert (keep `./load-env` side-effect import FIRST per F4)
- `src/app/layout.tsx` — add auth-aware nav (extend, not rewrite)
- `.env.example` — add `AUTH_SECRET` (v5 name, NOT NEXTAUTH_SECRET), `AUTH_TRUST_HOST=true` (placeholders only)
- Playwright: `playwright.config.ts` + e2e specs + reusable ADMIN/STAFF storage-state fixtures (installed THIS phase; reused by Phases 04–06)
- Reuse `ROLES`/`ROLE_LABELS` from `src/lib/product-order.ts` — do NOT invent enum types (SQL Server String + zod pattern per database/ context group)

Security: `authorize()`, jwt/session callbacks, and bcryptjs hashing run server-side only; NEVER import bcryptjs/secrets into `proxy.ts` / `auth.config.ts` edge config (db-auth REF §5 split-config pattern).

---

## Implementation Checklist

### Step A — Auth core

- [x] A1. `src/auth.config.ts`: edge-safe base config, `session: { strategy: "jwt" }`, `pages.signIn = /login`, `authorized` callback gating routes.
- [x] A2. `src/auth.ts`: Credentials provider `authorize()` → Prisma `User` lookup + `verify(passwordHash, input)`; return `{ id, username, role }`.
- [x] A3. jwt callback: `if (user) token.role = user.role`; session callback: `session.user.role = token.role` (+ id via token.sub).
- [x] A4. `src/lib/password.ts`: `hash()` + `verify()` via **bcryptjs** (work factor 12; server-only). TDD red→green.
- [x] A5. `src/app/api/auth/[...nextauth]/route.ts`: `export const { GET, POST } = handlers` from `@/auth` (Auth.js v5 route handler).
- [x] A6. Add `.env.example` placeholders: `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `SEED_ADMIN_PASSWORD`.

### Step B — Route protection

- [x] B1. `proxy.ts` (**PVL P2: place at `src/proxy.ts` — this project uses the `src/` dir, so proxy.ts is `src/proxy.ts` as a sibling of `src/app/`, NOT repo-root; a wrong location is silently ignored, same failure mode as `middleware.ts`**; Node runtime): `export default NextAuth(authConfig).auth`; protect all app routes; redirect unauthenticated → `/login`. Do NOT create `middleware.ts` (Next 16 ignores it silently) and do NOT use `export { auth as middleware }`. **Verify by runtime redirect (logged-out Playwright hits a protected route → `/login`), never by build success — a mis-placed/mis-shaped proxy.ts still builds green.**
- [x] B2. Gate `/admin/**` on `role === "ADMIN"` in `proxy.ts` AND re-check with `requireAuth("ADMIN")` in the admin page + all admin actions (proxy is convenience, not the security boundary).
- [x] B3. Matcher exclusions: `/login`, `/api/auth/*`, `/api/health`, `_next` static, fonts — everything else guarded.
- [x] B4. `src/lib/auth-guard.ts`: shared `requireAuth(role?)`; wrap **ALL 10** existing server actions + **every** new admin action. **PVL P3 — exact enumeration:** state-returning (throw → catch → map to that domain's error state): `createShop`, `updateShop` (`ShopActionState`), `createProduct`, `updateProduct`, `addVariant` (`ProductActionState`); void-returning (throw → Next error boundary, no error channel): `softDeleteShop`, `restoreShop`, `softDeleteProduct`, `restoreProduct`, `softDeleteVariant`. **There is NO single `ActionState` type — there are `ShopActionState` and `ProductActionState`; the guard throws a typed Error and each caller integrates per its own return shape.** Admin actions are `requireAuth("ADMIN")`. A fully-automated grep gate (see Test Plan) asserts every one of these 10 + admin actions calls `requireAuth` — a missed action is the top elevation risk.

### Step C — Login + admin UI

- [x] C1. `src/app/(auth)/login`: Thai login form (username/password), server action + useActionState calling `signIn` (shops/products form convention).
- [x] C2. `src/app/admin/users`: list / create (username+initial password+role) / edit-role / reset-password / **deactivate** (User.active soft-delete). ADMIN only.
- [x] C3. Add logout + current-user display to layout nav.
- [x] C4. `src/lib/login-attempts.ts`: basic rate-limit/lockout (DB attempt counter or delay) wired into `authorize()` — closes the STRIDE brute-force finding proactively.

### Step D — Seed admin

- [x] D1. Extend `prisma/seed.ts` (idempotent admin upsert; `./load-env` import FIRST) to create one ADMIN user with a bcryptjs-hashed password. Initial credential delivered out-of-band (chat-only); never committed. Force-change-on-first-login is an accepted operational known-gap (SEED-2).
- [x] A1-note. Lock JWT `session: { strategy: 'jwt', maxAge: 60*60*12 }` (12h) in `auth.config.ts`.

---

## Decisions (from INNOVATE — vc-predict verdict CAUTION; one required addition)

| # | Decision | Chosen |
|---|---|---|
| 1 | Hashing | **bcryptjs** (pure JS, zero native build — customer platform unknown; work factor ≥10; OWASP-acceptable). Rejected: @node-rs/argon2 (unverified prebuilts), argon2 (node-gyp). |
| 2 | Playwright | **Install THIS phase** — the Hybrid tier + no-Known-Gap rule for role-gating requires it. Create reusable ADMIN/STAFF storage-state fixtures for Phases 04–06. |
| 3 | Guard | Shared **`requireAuth(role?)`** in `src/lib/auth-guard.ts` — wraps ALL 10 existing shop/product actions + new admin actions; typed Thai Error matching `ActionState.error`; unit-tested (it's the choke point). |
| 4 | Admin UI scope | list / create (username+initial password+role) / edit-role / reset-password / **deactivate** (reuse User.active + existing soft-delete UI). |
| 5 | Session | JWT strategy (mandatory for credentials); **maxAge 12h** (locked); matcher exclusions: /login, /api/auth/*, /api/health, _next static, fonts — everything else guarded. |
| 6 | Login UX | Server action + useActionState (Thai), matching shops/products form convention. |
| 7 | **NEW (vc-predict security persona)** | **Basic login rate-limiting/lockout** — DB attempt counter or delay; added as checklist item C4 + exit gate. Prevents the PVL STRIDE scan finding brute-force reactively. |

---

## Inner Loop Refresh Note

- **Date:** 06-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after RESEARCH (LOAD-BEARING corrections) + INNOVATE (vc-predict CAUTION).
- **Sections changed:** Purpose (proxy.ts, bcryptjs, 12h JWT, rate-limit), Entry Gate (User model auth-ready -> no migration; next-auth pin; proxy.ts), Blast Radius (middleware.ts->proxy.ts everywhere; ADD api/auth/[...nextauth]/route.ts; auth-guard; login-attempts; Playwright fixtures; AUTH_SECRET/AUTH_TRUST_HOST; reuse ROLES from product-order.ts), Implementation Checklist (A4 bcryptjs, A5 route handler, A6 env, B1-B4 proxy.ts + matcher + requireAuth, C4 rate-limit, D1 idempotent admin + secure-credential delivery, JWT 12h), Test Plan (proxy edge-import agent-probe + lockout unit), Blockers (proxy.ts/Next-16 version), Public Contracts (proxy.ts + requireAuth), NEW Decisions section, Phase Loop Progress 1-3 ticked, status -> TESTING, Resume handoff (next = PVL).
- **Key findings folded in:** middleware.ts DEAD in Next 16 (silent) -> proxy.ts; Auth.js v5 route handler required; AUTH_SECRET+AUTH_TRUST_HOST; User model already auth-ready (seed only); reuse ROLES/ROLE_LABELS; bcryptjs; Playwright this phase; shared requireAuth guard; 12h JWT; rate-limiting (new security requirement).
- **Validate-contract left untouched** (placeholder) — PVL writes it next (STRIDE scan required).
- **Drift note:** seeded admin password must be delivered out-of-band to the user, never committed.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`. A STRIDE scan (vc-security) is required at PVL for this auth surface.

**Area: credentials auth + roles (high-risk: auth/identity)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Password hash+verify round-trips; wrong pw fails | Vitest on `src/lib/password.ts` | hashing correctness | session issuance |
| Hybrid | Login success issues JWT session | precondition: sandbox + seeded admin; Playwright login flow | credentials → session | role gating |
| Hybrid | STAFF blocked from `/admin/**`; ADMIN allowed | Playwright as each role | middleware + server re-check gating | all routes |
| Hybrid | Unauthenticated request → redirect `/login` | Playwright hitting a protected route logged out | route protection | — |
| Fully-automated | Login lockout after N failed attempts | Vitest on `src/lib/login-attempts.ts` | brute-force resistance | live session |
| Agent-probe | No bcryptjs/secret import leaks into edge `proxy.ts` / `auth.config.ts` | inspect `proxy.ts` + `auth.config.ts` imports | split-config safety | runtime |

High-risk (auth/identity): minimum Hybrid — satisfied by login/role/redirect gates. Known-Gap is NOT permitted for the role-gating behavior.

---

## Exit Gate

```bash
pnpm test                 # Expected: password unit tests green
# Playwright/manual: login as ADMIN and STAFF; confirm STAFF blocked from /admin,
# ADMIN allowed; logged-out user redirected to /login
```

- Login/logout works; ADMIN/STAFF role-gating enforced by `proxy.ts` AND re-checked server-side.
- Admin can create/edit/deactivate users and reset passwords.
- Login rate-limit/lockout active.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- `next-auth@5.0.0-beta.31` / `@auth/core` peer incompatible with Next 16.2.x at install → surface to user; consider v4 fallback (db-auth REF §5) — document before choosing.
- `proxy.ts` route protection not honored by the installed Next build → confirm Next 16.2.x is actually installed (Next 15 uses middleware.ts); BLOCKED with the exact version evidence.
- Phase 02 `User` model not present → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE_WITH_CONCERNS — middleware.ts DEAD in Next 16 (->proxy.ts), Auth.js v5 route handler required, AUTH_SECRET/AUTH_TRUST_HOST, User model auth-ready, reuse ROLES (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — vc-predict CAUTION; Decision Summary (bcryptjs, Playwright-now, requireAuth guard, 12h JWT, rate-limiting) written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: full V1-V7 + STRIDE scan DONE (net gate CONDITIONAL); validate-contract written per example-validate-output.md
- [x] 5. EXECUTE — all checklist items done; per-section test gates green (4 Fully-Automated + 5 Hybrid + AUTH-split probe); high-risk evidence pack written + validated; DRAFT report written. Awaiting orchestrator-owned EVL (step 6).
- [x] 6. EVL — all gates re-run independently (24/7 unit, lint, build w/ Proxy line, 7 Playwright) + adversarial auth probes + regression all green; no follow-up stubs needed; EVL HANDOFF SUMMARY written to report
- [x] 7. UPDATE PROCESS — phase report written, umbrella state updated, context updated (`all-auth.md` group created, `all-context.md`/`all-tests.md` updated); commit routed to orchestrator (not performed by this agent)

**Validate-contract required before execute.**

---

## Touchpoints

- `src/auth.config.ts`, `src/auth.ts`, `proxy.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/password.ts`, `src/lib/auth-guard.ts`, `src/lib/login-attempts.ts`
- `src/app/(auth)/login/**`, `src/app/admin/users/**`, `prisma/seed.ts`, `src/app/layout.tsx`, `playwright.config.ts` + e2e fixtures

---

## Public Contracts

- Establishes the session/role contract (`session.user.role`) consumed by all later authenticated routes (Phases 04, 05, 06).
- Establishes `proxy.ts` route-protection (Next 16) + shared `requireAuth(role?)` guard covering the whole app; later phases add pages/actions under this umbrella and reuse the Playwright ADMIN/STAFF fixtures.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Password hash/verify unit | Fully-Automated | DoD #3 (login) — proven by: password unit gate |
| Login issues session | Hybrid | DoD #3 (login as ADMIN/STAFF) — proven by: login hybrid gate |
| Role gating enforced (STAFF blocked from /admin) | Hybrid | DoD #3 (role-gated protection) — proven by: role hybrid gate |
| Edge config free of secret/hash imports | Agent-Probe | Auth safety (split-config) — proven by: import agent-probe |

---

## Test Infra Improvement Notes

- Add Playwright auth fixtures (pre-authenticated ADMIN and STAFF storage states) so role-gating specs in this and later phases reuse them. Record in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-03-auth_PLAN_06-07-26.md`
- Last completed step: 3. PLAN-SUPPLEMENT (RESEARCH + INNOVATE folded in)
- Validate-contract status: pending — NEXT STEP is PVL (spawn vc-validate-agent; vc-security STRIDE scan required). Do NOT execute yet.
- Next step: Spawn vc-validate-agent for PVL (Step 4). Sandbox DB only; deliver seeded admin credential out-of-band.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: ✅ VERIFIED (EVL step 6 confirmed 06-07-26)

## Overview

This is a phase plan within the phase1-order-system phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`phase1-order-system-umbrella_PLAN_06-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan enters the RIPER-5 VALIDATE (PVL) step before EXECUTE (ENTER EXECUTE MODE only after the contract is written).

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

Status: CONDITIONAL
Date: 06-07-26
date: 2026-07-06
generated-by: inner-pvl: phase-03
Net gate: CONDITIONAL — 0 FAILs, 11 CONCERNs (all resolvable as plan updates + execute-agent instructions; auth architecture is sound). No developed behavior rests on Known-Gap alone.

Parallel strategy: sequential
Rationale: 6/7 signals (S2 auth surface, S3 3+ directions, S4 phase program, S5 depth requested, S6 high-risk auth+secrets, S7 5+ files; S1 absent — single package). Dominant signal S6. High score reflects RISK/DEPTH (handled by this thorough contract + gates), not parallelism: EXECUTE is ONE phase with strictly-ordered TDD steps (password.ts → auth.ts → proxy.ts → guard → UI → seed) and no independent workstreams, so a single opus vc-execute-agent running the ordered gates is the fit.

### Auto-selected menu choices (user away — RECORD FOR OVERRIDE before EXECUTE)
- V5 menu: **A — Accept (conservative)**. Every CONCERN resolved the safe way: hardening folded in as execute-agent instructions/gates, not deferred to known-gap.
- SEC-2 (session revocation): auto-selected **re-check `User.active` (and role) from DB inside `requireAuth`** (closes the deactivation window) over the weaker "accept 12h JWT window" option.
- SEC-6 (username timing enumeration): auto-selected **dummy-hash compare** over "accept as known-gap".
- SEED-2 ("force change on first login"): auto-selected **operational known-gap** (temp password + admin resets via UI) — honours the "NO schema migration this phase" constraint; adding a `mustChangePassword` column is the override option if the user wants it enforced.
- Strategy: auto-selected **Sequential** (single opus execute-agent).
Override any of these before ENTER EXECUTE MODE.

### Test gates (C3 table — ADDITIVE; legacy line form retained below)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| DoD#3-hash | password hash+verify round-trips; wrong pw fails; 72-byte bcrypt limit respected | Fully-Automated | `pnpm test` — Vitest on `src/lib/password.ts` | A |
| DoD#3-lockout | after N failed attempts login is blocked/delayed; success resets counter; window expires | Fully-Automated | `pnpm test` — Vitest on `src/lib/login-attempts.ts` (assert the BLOCK, not just counter increment) | A |
| ELEV-guard | every 1 of 10 actions + all admin actions call `requireAuth`; admin actions call `requireAuth("ADMIN")` | Fully-Automated | grep gate: each exported action body in `shops/actions.ts`+`products/actions.ts`+`admin/users` calls `requireAuth`; 0 misses | B |
| DoD#3-login | credentials login issues a JWT session cookie | Hybrid | Playwright login flow — precondition: sandbox up + seeded admin + `pnpm dev` | B |
| DoD#3-rolegate | STAFF blocked from `/admin/**`; ADMIN allowed | Hybrid | Playwright as each role (storage-state fixtures) — precondition: sandbox + both seeded roles | B |
| DoD#3-redirect | unauthenticated request to a protected route → redirect `/login` | Hybrid | Playwright logged-out hitting a protected route | B |
| SEC-enum | login error is a single generic Thai message for both "no such user" and "wrong password" | Hybrid | Playwright: bad-username and bad-password both yield identical error text | B |
| AUTH-split | no bcryptjs/secret import leaks into edge `src/proxy.ts` / `src/auth.config.ts` | Agent-Probe | inspect import graph of `proxy.ts` + `auth.config.ts` | A |
| SEC-secret | no plaintext admin password / secret committed to any tracked file | Fully-Automated | `git grep -nE "SEED_ADMIN_PASSWORD *= *\"|passwordHash *= *\"[^\"]" -- 'src/**' 'prisma/**'` returns empty | B |

gap-resolution legend: A — proven now · B — gate added by this plan's checklist · C — deferred to named later phase · D — backlog stub.
C-4 reconciliation: strategy column carries ONLY Fully-Automated / Hybrid / Agent-Probe; Known-Gap is never a strategy (residuals listed under Known gaps).

Legacy line form (retained for existing consumers):
- password.ts: Fully-automated: `pnpm test` (hash/verify + wrong-pw)
- login-attempts.ts: Fully-automated: `pnpm test` (lockout BLOCK + reset + expiry)
- requireAuth coverage: Fully-automated: grep — 10 actions + admin all call requireAuth
- login/role/redirect/enum: hybrid: Playwright + precondition sandbox + seeded ADMIN & STAFF + running app
- edge split-config: agent-probe: import inspection of proxy.ts + auth.config.ts
- secret-leak: Fully-automated: `git grep` for committed password/secret returns empty

Failing stub (DoD#3-hash):
test("should hash a password and verify it round-trips, and reject a wrong password", () => { throw new Error("NOT IMPLEMENTED — TDD stub: password hash+verify round-trips; wrong pw fails") })

Failing stub (DoD#3-lockout):
test("should block further login attempts after N failures and reset the counter on success", () => { throw new Error("NOT IMPLEMENTED — TDD stub: login lockout after N failed attempts; success resets; window expires") })

Failing stub (ELEV-guard):
test("should assert every exported shop/product/admin action calls requireAuth", () => { throw new Error("NOT IMPLEMENTED — TDD stub: requireAuth coverage over all 10 actions + admin actions") })

Failing stub (SEC-secret):
test("should find no committed plaintext admin password or secret in tracked files", () => { throw new Error("NOT IMPLEMENTED — TDD stub: git grep for committed secret returns empty") })

### Plan updates applied (by this PVL, in the checklist above)
- [x] P1 — Added `src/next-auth.d.ts` module augmentation to Blast Radius (role on Session+JWT; else `pnpm build` typecheck fails).
- [x] P2 — Corrected proxy.ts placement to `src/proxy.ts` (src/ project) in B1 + "verify by runtime redirect, not build success".
- [x] P3 — Enumerated all 10 actions in B4 with the state-returning vs void-returning integration split; corrected "ActionState" → `ShopActionState`+`ProductActionState` (there is no single type).

### Execute-agent instructions
- E1 (Section A entry): TDD order is mandatory — implement + unit-green `src/lib/password.ts` and `src/lib/login-attempts.ts` BEFORE wiring `authorize()`. Turn the failing stubs above red-first.
- E2 (Section A, install): pin `next-auth@5.0.0-beta.31`; at install verify the `@auth/core` peer resolves against Next 16.2.10. If the peer/beta is incompatible → STOP and surface to user (v4 fallback per db-auth REF §5); document before choosing. bcryptjs is pure-JS (no allowBuilds needed); Playwright's browser download / postinstall may need pnpm `allowBuilds` — add it to `pnpm-workspace.yaml` if pnpm 11.5 blocks it (EXTEND, never rewrite the file).
- E3 (SEC-1 Spoofing/secret): generate `AUTH_SECRET` via `openssl rand -base64 32` (or `npx auth secret`); write it ONLY to `.env` (already `.env*`-gitignored), NEVER to `.env.example` or any tracked file. Set `AUTH_TRUST_HOST=true`. `.env.example` gets placeholders only.
- E4 (SEC-2 Tampering/revocation — auto-selected): `requireAuth` re-reads the current user's `active` (and `role`) from the DB and throws if `active === false` or the role no longer satisfies the requirement. This closes the JWT deactivation window (a demoted/deactivated user's existing 12h token would otherwise keep access). Marginal cost = one extra query on already-DB-touching actions. Also keep `maxAge = 12h` as the secondary bound.
- E5 (SEC-3 Info-disclosure/enumeration): `authorize()` returns `null` generically for BOTH "no such user" AND "wrong password"; the login UI shows ONE Thai message (e.g. "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"). Never branch the message on user-existence.
- E6 (SEC-3 Info-disclosure/hash): the Prisma User lookup and the admin user-list MUST NOT return `passwordHash` to the client — use an explicit `select` (or strip it). `authorize()` returns only `{ id, username, role }`.
- E7 (SEC-6 timing — auto-selected): when the username is not found, still perform a dummy bcryptjs compare against a constant hash so response timing does not leak user existence.
- E8 (ELEV): admin user-management server actions (`createUser`, `editRole`, `resetPassword`, `deactivateUser`) are each `requireAuth("ADMIN")` — a STAFF calling the raw server action is rejected even though proxy.ts already blocks the page. proxy.ts is convenience; requireAuth is the boundary.
- E9 (Admin safety — last-admin): `editRole`/`deactivateUser` MUST refuse to demote or deactivate the LAST active ADMIN (would lock everyone out of `/admin`). Count active ADMINs; block the operation with a Thai error if it would drop to zero.
- E10 (SEED — D1): the seed reads the initial admin password from an env var (e.g. `SEED_ADMIN_PASSWORD`); if unset, generate a random one and print it ONCE to stdout for out-of-band delivery. NEVER hardcode a plaintext password in `prisma/seed.ts` and never commit it. Hash with bcryptjs before persisting. Keep `./load-env` side-effect import FIRST (F4). Idempotent upsert (safe to re-run).
- E11 (DoS lockout depth): the login-attempts Vitest must assert the actual BLOCK/delay path fires after N attempts (not merely that a counter increments), that a successful login RESETS it, and that the window EXPIRES. Note (accepted): username-keyed lockout lets an attacker lock a victim — acceptable for a LAN internal app; a delay-based or IP+username strategy is the hardening upgrade if desired.
- E12 (Sandbox/safety): sandbox `orderstock-sql` Docker DB ONLY; never touch a customer/remote DB; do not stop/restart the 9 unrelated Docker containers; NO git commit/push without user instruction.
- E13 (regression): after all sections, re-run `pnpm build` + `pnpm lint` + `pnpm test` (Phase 01/02 Vitest suite must stay green — the 10 wrapped actions must still compile and their existing behavior unchanged when authed).

### Dimension findings
- Infra fit: CONCERN — Next 16.2.10 + proxy.ts pattern correct; concerns are proxy.ts placement (fixed P2), next-auth beta `@auth/core` peer + Playwright allowBuilds verified at install (E2).
- Test coverage: CONCERN — Vitest realistic; Playwright is first-time E2E setup (config + storage-state fixtures + webServer); added a fully-automated requireAuth-coverage grep gate (ELEV-guard) so elevation is proven mechanically, not just by Playwright.
- Breaking changes: CONCERN — no existing auth to break + User model unchanged (no migration); but 10 existing actions get wrapped — guard must integrate with `ShopActionState`/`ProductActionState` (state-returning) vs error-boundary (void-returning). Enumerated in P3/E-set.
- Security surface: CONCERN (STRIDE below) — architecture sound (split-config + JWT + server re-check); multiple hardening items folded into E3–E11. No FAIL.

### STRIDE scan (vc-security — high-risk auth surface)
- Spoofing: credential path via authorize()+bcryptjs verify = correct. AUTH_SECRET must be strong+uncommitted (E3). PASS-with-hardening.
- Tampering: role sourced from DB at authorize() → token → session, never from client input = correct pattern. Residual: JWT carries role/active for up to 12h; deactivation/demotion not revoked live → CLOSED by E4 (requireAuth re-checks DB active/role).
- Repudiation: no audit log required Phase 1 (plan) → accepted known-gap; login-attempts counter gives partial trail.
- Information disclosure: generic login error / no user enumeration (E5); passwordHash never to client (E6); timing enumeration closed by dummy compare (E7); .env gitignored + secret-grep gate.
- DoS: lockout (C4) present; test must prove the BLOCK, not the counter (E11); bcrypt work-factor flood mitigated by lockout.
- Elevation: two-layer (proxy.ts role gate + server requireAuth re-check); requireAuth wraps ALL 10 actions + admin actions is the top risk → ELEV-guard grep gate + E8; last-admin lockout guard (E9). no-Known-Gap for role-gating satisfied by the 3 Playwright hybrid gates.

### High-risk pack (auth/identity + secret/trust-boundary) — REQUIRED
Before phase closeout, execute-agent produces the evidence pack in the task folder `harness/` (colocated):
- `risk-gate.json` (riskClass "auth or identity", mustStopBeforeFinalize true)
- `context-snippets.json` (authorize(), jwt/session callbacks, requireAuth, proxy.ts)
- `verification.json` (each gate above: happy path + a rejection/boundary case)
- `review-decision.json` (explicit APPROVE/REJECT + rationale)
- `adversarial-validation.json` (STRIDE scenarios ruled out: STAFF→/admin bypass, role forgery via client input, deactivated-user live session, username enumeration, committed-secret)
Auto-stop: do not report DONE on this phase until the pack exists and review-decision is recorded.

### Known gaps on record (residuals — none is the sole proof of a developed behavior)
- No audit log (Phase 1 scope) — accepted; partial trail via login-attempts counter.
- "Force password change on first login" NOT enforced (no schema migration this phase) — operational: deliver temp password out-of-band, admin resets via the reset-password UI. Override = add `mustChangePassword` column (schema change) if user wants enforcement.
- Username-keyed lockout can be abused to lock a victim (E11) — accepted for LAN internal app.
- Customer SQL Server compat level unconfirmed (carried program-wide) — not auth-specific.

### Backlog artifacts to create during durable capture
- `auth-session-revocation-hardening_NOTE_06-07-26.md` (process/features/order-system/backlog/) — track optional shorter maxAge / server-session denylist if the 12h+DB-active-recheck combo proves insufficient.

What this coverage does NOT prove:
- `pnpm test` (password/lockout/grep): proves hashing correctness, lockout logic, and static guard coverage — does NOT prove live session issuance, cookie security flags, or runtime redirect behavior.
- Playwright login/role/redirect/enum (hybrid): proves end-to-end auth+gating against the sandbox with seeded roles — does NOT prove behavior on the customer's real SQL Server, nor concurrency/load, nor JWT-secret rotation.
- requireAuth grep gate: proves each action CALLS requireAuth — does NOT prove the guard's internal DB active/role re-check is correct (covered by E4 + adversarial pack), nor that error mapping to each ActionState is correct (agent-probe at EVL).
- Agent-probe (split-config): proves no secret/hash import in edge config by inspection — does NOT prove runtime edge behavior.
- git-grep secret gate: proves no secret in tracked files at gate time — does NOT prevent a secret being added and committed later (ongoing hygiene).

Gate: CONDITIONAL (0 FAILs; 11 concerns — 3 plan fixes applied by PVL, 13 execute-agent instructions on record, 4 known-gaps accepted). Proceed to EXECUTE on explicit user consent (charter HARD STOP: EXECUTE requires ENTER EXECUTE MODE).
Accepted by: session (autonomous PVL, user away — conservative auto-select, recorded for override before EXECUTE) — accepted concerns: INFRA (proxy placement, install-peer/allowBuilds), TESTCOV (Playwright first-setup, ELEV grep gate added), BREAKING (10-action guard integration), SEC-1 AUTH_SECRET strength, SEC-2 session revocation (re-check active), SEC-3 user enumeration + passwordHash exposure, SEC-6 timing, ELEV requireAuth coverage + last-admin, DoS lockout-test-depth, SEED password sourcing; known-gaps: no-audit-log, force-change-on-first-login, username-keyed-lockout, compat-level.

