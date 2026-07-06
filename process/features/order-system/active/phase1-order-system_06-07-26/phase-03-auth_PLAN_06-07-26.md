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
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-03-auth_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Add authentication and role-based access: next-auth v5 (Auth.js) credentials provider with JWT sessions (mandatory for credentials), password hashing (argon2id preferred, bcrypt acceptable), ADMIN/STAFF roles carried on the JWT and re-checked server-side, middleware protecting all app routes, an admin user-management page, and a seeded admin user. This is a HIGH-RISK auth surface — a STRIDE scan and server-side re-verification are required.

---

## Entry Gate

- Phase 02 exit gate passed (schema + `User` model exist and migrate to sandbox; CRUD proven).
- Exact `next-auth@5.0.0-beta.x` version confirmed compatible with the pinned Next major (via vc-docs-seeker).
- Password hashing library chosen and confirmed (`@node-rs/argon2` default, or bcrypt).

---

## Blast Radius

- `src/auth.config.ts` — edge-safe config (no Prisma, no hashing imports); `authorized` callback for middleware
- `src/auth.ts` — Node-runtime config: Credentials provider + Prisma lookup + hash verify; jwt/session callbacks add `role`
- `middleware.ts` — gate all app routes; role gate for `/admin/**`
- `src/lib/password.ts` — hash + verify helpers (server-only)
- `src/app/(auth)/login/**` — Thai login page + form action
- `src/app/admin/users/**` — list/create/edit/reset-password/role users (ADMIN only)
- `prisma/seed.ts` — extend to seed an initial admin user
- `src/app/layout.tsx` — add auth-aware nav (extend, not rewrite)

Security: `authorize()`, jwt/session callbacks, and hashing run server-side only; never import hashing libs into `middleware.ts` / edge config (db-auth REF §5 split-config pattern).

---

## Implementation Checklist

### Step A — Auth core

- [ ] A1. `src/auth.config.ts`: edge-safe base config, `session: { strategy: "jwt" }`, `pages.signIn = /login`, `authorized` callback gating routes.
- [ ] A2. `src/auth.ts`: Credentials provider `authorize()` → Prisma `User` lookup + `verify(passwordHash, input)`; return `{ id, username, role }`.
- [ ] A3. jwt callback: `if (user) token.role = user.role`; session callback: `session.user.role = token.role`.
- [ ] A4. `src/lib/password.ts`: `hash()` + `verify()` (argon2id via @node-rs/argon2, or bcrypt work-factor ≥10).

### Step B — Route protection

- [ ] B1. `middleware.ts`: export `auth` as middleware; protect all app routes; redirect unauthenticated → `/login`.
- [ ] B2. Gate `/admin/**` on `role === "ADMIN"` in middleware AND re-check with `await auth()` in the admin server components/actions (middleware is convenience, not the security boundary).

### Step C — Login + admin UI

- [ ] C1. `src/app/(auth)/login`: Thai login form (username/password), server action calling `signIn`.
- [ ] C2. `src/app/admin/users`: list users; create user (username, initial password → hashed, role); edit role; reset password. ADMIN only.
- [ ] C3. Add logout + current-user display to layout nav.

### Step D — Seed admin

- [ ] D1. Extend `prisma/seed.ts` to create one ADMIN user with a hashed password (document the default credential; require change on delivery).

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
| Agent-probe | No hashing/secret import leaks into edge middleware | inspect `middleware.ts` + `auth.config.ts` imports | split-config safety | runtime |

High-risk (auth/identity): minimum Hybrid — satisfied by login/role/redirect gates. Known-Gap is NOT permitted for the role-gating behavior.

---

## Exit Gate

```bash
pnpm test                 # Expected: password unit tests green
# Playwright/manual: login as ADMIN and STAFF; confirm STAFF blocked from /admin,
# ADMIN allowed; logged-out user redirected to /login
```

- Login/logout works; ADMIN/STAFF role-gating enforced by middleware AND re-checked server-side.
- Admin can create/edit users and reset passwords.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- `next-auth@5-beta` incompatible with the pinned Next major → surface to user; consider v4 fallback (db-auth REF §5) — document before choosing.
- Hashing lib native build fails on the dev/customer platform → switch to `bcryptjs` (pure JS); document.
- Phase 02 `User` model not present → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7 + STRIDE scan; validate-contract written per example-validate-output.md
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.**

---

## Touchpoints

- `src/auth.config.ts`, `src/auth.ts`, `middleware.ts`, `src/lib/password.ts`
- `src/app/(auth)/login/**`, `src/app/admin/users/**`, `prisma/seed.ts`, `src/app/layout.tsx`

---

## Public Contracts

- Establishes the session/role contract (`session.user.role`) consumed by all later authenticated routes (Phases 04, 05, 06).
- Establishes middleware route-protection covering the whole app; later phases add pages under this umbrella.

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
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). Auth surface — vc-security STRIDE scan required at PVL.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: ⏳ PLANNED

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

(placeholder — vc-validate-agent writes this section before EXECUTE)
