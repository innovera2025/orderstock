---
name: plan:phase1-order-system-phase-06-db-settings-delivery
description: "orderstock Phase 1 — Phase 06: runtime connection-string settings page (ADO.NET→adapter, test-connection, singleton swap) + delivery packaging"
date: 06-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: order-system
  phase: phase-06
---

# Phase 06 — DB Settings & Delivery

**Program:** phase1-order-system
**Umbrella plan:** process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
**Phase status:** ✅ VERIFIED (07-07-26 — EXECUTE + independent EVL confirmation done; all gates green)
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-06-db-settings-delivery_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Deliver the runtime DB configuration and the customer handoff package. Build an ADMIN-only settings page (individual fields primary; optional connection-string paste-prefill) that validates and test-connects a Prisma 7 adapter config (`@prisma/adapter-mssql`, `SELECT 1`), then **rewrites `.env`'s `DATABASE_URL`** (the single source of truth read by BOTH `src/lib/db.ts` AND `prisma.config.ts` — no CLI/app divergence) and **restarts the app** to apply. Then package delivery: the final vendor T-SQL schema script, a hand-authored DB-creation/login/permission script, and a Thai deployment guide for the customer's Windows environment. This is a HIGH-RISK auth/secrets + delivery surface — STRIDE scan required; the customer prod-DB safety boundary is retired ONLY at this gate.

**Two RESEARCH-corrected design flaws (LOAD-BEARING):** (1) `AppSetting` CANNOT store the connection string — it lives INSIDE the target DB (chicken-and-egg) and the schema explicitly forbids secrets there; use `.env` rewrite instead. (2) A bad stored string locks the admin out (auth reads the DB) — recovery is a documented MANUAL `.env` edit / `.env.bak` restore, NOT an in-app authless bootstrap (rejected trust-boundary hole).

---

## Entry Gate

- Phase 02 exit gate passed (schema + vendor SQL export pipeline).
- Phase 05 exit gate passed (app is functionally complete and printable).
- A SECOND disposable sandbox DB is available to prove switching (still NOT the customer's real prod DB unless the user explicitly authorizes the delivery test).

---

## Blast Radius

- `src/app/(main)/settings/db/**` — ADMIN-only settings page (inside the route group, admin/users precedent, ADMIN-only nav link): individual fields (host, port, instance?, database, user, password, encrypt/trustServerCertificate) + optional paste-prefill helper + test-connection + save/apply(restart); requireAuth("ADMIN") on ALL actions
- `src/lib/connection-string.ts` — build a JDBC-style `sqlserver://` DATABASE_URL from fields; optional best-effort ADO.NET/mssql parse for the paste-prefill (parser NEVER load-bearing — admin reviews before save)
- `src/lib/env-write.ts` — safe `.env` rewrite: copy `.env`→`.env.bak` BEFORE every write; escape/quote the value so embedded newlines / `KEY=value` sequences cannot inject or clobber other keys (env-injection defense — unit-tested)
- `src/auth.config.ts` — add `/settings` to the ADMIN branch of the `authorized` edge callback (defense-in-depth, mirrors `/admin`; server `requireAuth` remains the real boundary)
- `src/app/nav.tsx` — ADMIN-only settings nav link (mirrors the existing admin-link `role === "ADMIN"` guard)
- `db/create-orderstock-schema.sql` — final vendor schema script (regenerated from Phase 02 pipeline)
- `db/create-database-and-login.sql` — hand-authored DB + login + permission script (Prisma does NOT generate this)
- `docs/deployment-guide.md` — Thai customer Windows deployment guide
- `auth-guard-coverage.test.ts` — extend BOTH the MODULES action-coverage array (new settings `actions.ts`) AND the page-grep path (new settings page)
- NOTE: `src/lib/db.ts` is NOT modified — it already reads `DATABASE_URL` at module init, so a restart genuinely applies the change; NO singleton hot-swap

---

## Decisions (from INNOVATE — verdict GO + 2 cheap mitigations)

| # | Decision | Chosen |
|---|---|---|
| 1 | Storage | `.env` `DATABASE_URL` rewrite + `.env.bak` backup-before-write; NO JSON config (CLI divergence), NO AppSetting (in-DB chicken-and-egg + no-secrets rule). |
| 2 | Apply | Restart-required, AUTOMATED: save → validate → test-connection → write `.env` → `process.exit(0)`; under NSSM auto-restart ≈2-5s seamless; UI (Thai) "บันทึกแล้ว กำลังรีสตาร์ท..." + polls `/api/health` to confirm reconnection; manual-restart fallback documented. NO hot singleton swap. |
| 3 | Lockout escape | Manual `.env` edit + `.env.bak` restore, documented in the deployment guide troubleshooting. No in-app authless bypass. |
| 4 | Input shape | Individual FIELDS primary/authoritative (host, port, instance?, database, user, password, encrypt/trustServerCertificate); optional "วางค่า connection string เพื่อเติมอัตโนมัติ" paste-prefill (best-effort `parseConnectionString`; admin reviews before save — parser NEVER load-bearing). |
| 5 | Parser spike | Ordinary EXECUTE-time task (not a blocking probe) — verify `parseConnectionString` coverage; fallback pkg `mssql-connection-string` if gaps. |
| 6 | Hosting + guide | Recommend `next start` under **NSSM Windows service** (auto-restart on exit), marked "pending customer IT confirmation"; IIS reverse-proxy alternative note. Guide = `docs/deployment-guide.md` (Thai where user-facing). |
| 7 | Names/placement | Settings page at `src/app/(main)/settings/db/`; SQL file = `db/create-database-and-login.sql` (FIX umbrella touchpoint that said `create-login.sql`). |
| 8 | Gate | Hybrid e2e: setup creates `orderstock2` on the SAME container + runs schema script into it → settings switch → verify app reads `orderstock2` (data-distinguishing sentinel) → switch BACK to `orderstock` (round-trip proof). No second container (host memory ~334MiB free). |

---

## Inner Loop Refresh Note

- **Date:** 06-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after RESEARCH (2 design-flaw corrections) + INNOVATE (GO + 2 mitigations).
- **Sections changed:** Purpose (AppSetting→.env rewrite; singleton-swap→restart-required; lockout recovery), Blast Radius (settings page moved to (main)/settings/db; NEW env-write.ts safe-rewrite; connection-string.ts now field→URL builder + optional parse; db.ts NOT modified; auth-guard-coverage extension), Implementation Checklist (fields+prefill, env backup-before-write + injection-safe serialization, restart-apply + health-poll, requireAuth ADMIN on all actions, hand-authored SQL with CREATE DATABASE/LOGIN/USER/grants + collate/compat TODO, Thai deployment guide sections, round-trip gate), Test Plan (env-line escaping + field validation + masking Fully-Automated; save/test-connection + orderstock2 round-trip Hybrid with process.exit test-mode handling; guide Agent-Probe), Blockers (lockout recovery documented; process.exit test handling), Verification Evidence, Phase Loop 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key findings folded in:** AppSetting infeasible (in-DB + no-secrets) → `.env` DATABASE_URL rewrite (single source of truth for db.ts + prisma.config.ts); `.env.bak` backup-before-write; env-injection-safe serialization (unit-tested); requireAuth-lockout risk → documented manual recovery, NO authless bootstrap; restart-required apply under NSSM + health-poll; fields-primary input + non-load-bearing paste-prefill; hand-authored DB/login SQL; Thai deployment guide; orderstock2 same-container round-trip gate.
- **Umbrella fix:** touchpoint `create-login.sql` → `create-database-and-login.sql`.

## PVL Refresh Note (STRIDE hardening — 06-07-26)

- **Date:** 06-07-26 — inner-PVL (step 4) folded 8 STRIDE concerns into the checklist + test plan as applied plan-updates. Entry-gate facts verified against live code (db.ts / prisma.config.ts read `process.env.DATABASE_URL`; `.gitignore` `.env*` covers `.env` + `.env.bak`; `/api/health` already sanitizes errors; `authorized` callback ADMIN-gates only `/admin`; auth-guard-coverage.test.ts MODULES array + PRINT_PAGES grep exist).
- **Applied plan-updates:** A2 hostile-input enumeration (newlines, `KEY=value`, quotes/backslashes, Thai-char passwords); B2 test-connection error sanitization (never echo string/password); B3 `process.exit` gated behind a test-mode flag (pinned name); B4 auth-guard coverage extended to the settings **actions module** (not just the page) + ADMIN assertion; NEW B5 edge `/settings` ADMIN gate + ADMIN-only nav link; NEW A3 `.env.bak` gitignore-assertion test; round-trip gate now requires a data-distinguishing sentinel each direction; sandbox-only fixture rule made explicit.
- Validate-contract written below (STRIDE scan complete). Net gate: CONDITIONAL (8 concerns folded in; 0 FAILs; EXECUTE-ready).

---

## Implementation Checklist

### Step A — Config builder + safe env write

- [ ] A1. `src/lib/connection-string.ts`: build a JDBC-style `sqlserver://` `DATABASE_URL` from individual fields (host, port, instance?, database, user, password brace-escaped, encrypt, trustServerCertificate) per db-auth REF §1; validate required fields. Add an OPTIONAL best-effort `parseConnectionString` (ADO.NET/mssql) for the paste-prefill — parser output is admin-reviewable, NEVER load-bearing.
- [ ] A2. `src/lib/env-write.ts`: (a) copy `.env` → `.env.bak` IMMEDIATELY before every write (one-command rollback); (b) injection-safe serialization — escape/quote the written value so embedded newlines / `KEY=value` cannot inject or clobber other keys; (c) rewrite ONLY the `DATABASE_URL` line, preserving all others. NEVER log the value. **Injection-safe unit test MUST exercise these hostile inputs explicitly:** embedded `\n`/`\r\n`, a `\nAUTH_SECRET=attacker` clobber payload, double/single quotes, backslashes, and a Thai-character password (e.g. `รหัสผ่าน`) — assert ONLY the `DATABASE_URL` line changes and no other key is injected/overwritten.
- [ ] A3. Secret-hygiene gate: add a Fully-Automated test asserting `.env.bak` is matched by `.gitignore` (`.env*` already covers it) so the backup is never committed. (No new gitignore entry needed — this is a regression guard.)

### Step B — Settings page + apply (restart-required)

- [ ] B1. ADMIN-only `src/app/(main)/settings/db` page + `actions.ts`: individual fields (prefilled from current parsed `DATABASE_URL`, password MASKED — never render the plaintext password value into client HTML) + optional "วางค่า connection string เพื่อเติมอัตโนมัติ" paste-prefill. `requireAuth("ADMIN")` at the top of the page AND in EVERY server action (mirror `admin/users` precedent).
- [ ] B2. Test-connection: construct a throwaway `PrismaClient` (adapter) + `SELECT 1` via `$queryRaw`; report ok/error (Thai). **SANITIZE the error — return a fixed Thai message (e.g. "เชื่อมต่อฐานข้อมูลไม่สำเร็จ") and NEVER echo the connection string, host, user, or password back to the client** (mirror `/api/health` which logs the raw error server-side only). No `.env` write on failure.
- [ ] B3. Save = validate → test-connection → (only if ok) `env-write` (backup + injection-safe) → `process.exit(0)`. **Save-gate invariant: the `env-write` call MUST be unreachable unless test-connection returned ok** (a bad string never reaches the write, so `process.exit` never fires on a bad string). Gate the exit for tests: `if (process.env.NODE_ENV !== "test" && process.env.ORDERSTOCK_NO_EXIT !== "1") process.exit(0)` — so the Hybrid gate can drive save up-to-and-including the `.env` write without killing the test server. Under NSSM the service auto-restarts (~2-5s). UI shows "บันทึกแล้ว กำลังรีสตาร์ท..." and polls `/api/health` to confirm reconnection; manual-restart fallback documented for non-NSSM. NO hot singleton swap; `src/lib/db.ts` unchanged.
- [ ] B4. Extend `auth-guard-coverage.test.ts`: (a) add `src/app/(main)/settings/db/actions.ts` to the `MODULES` array with its `expected` action names (e.g. `testConnection`, `saveDbSettings`) so every settings action is asserted to call `requireAuth`; (b) add the settings **page** to the page-grep path (`export default async function` + `requireAuth(`); (c) add the settings actions to the ADMIN-specific assertion (`requireAuth(State)?("ADMIN")`).
- [ ] B5. Defense-in-depth: (a) `src/auth.config.ts` — add `pathname.startsWith("/settings")` to the ADMIN branch of the `authorized` edge callback (currently only `/admin`); (b) `src/app/nav.tsx` — render the settings link only when `role === "ADMIN"` (mirror the existing admin-link guard). Server `requireAuth("ADMIN")` remains the real boundary; these are convenience + belt-and-suspenders.

### Step C — Delivery package

- [ ] C1. Regenerate `db/create-orderstock-schema.sql`: `pnpm tsx scripts/export-schema-sql.ts` (final schema).
- [ ] C2. Hand-author `db/create-database-and-login.sql`: `CREATE DATABASE` (+ COLLATE note + `COMPATIBILITY_LEVEL 140/150` with TODO pending customer version), `CREATE LOGIN`, `CREATE USER`, role grants (document `db_owner` for initial vs scoped least-privilege option), run-order comments (THIS first, then `create-orderstock-schema.sql`).
- [ ] C3. Write `docs/deployment-guide.md` (Thai where user-facing): prereqs (Node LTS, `pnpm install`), `.env` setup + `AUTH_SECRET` generation (openssl), SQL scripts run order, NSSM registration, health verify, admin seed, PRINT INSTRUCTIONS (Phase 05 carry-forward: Chrome/Edge, Scale 100%, ปิด headers/footers, on-site test print), backup guidance (SQL backup + `.env`/`.env.bak`), troubleshooting incl. **lockout recovery (manual `.env` edit / `.env.bak` restore)**.

---

## Test Plan (TDD-first — tier assignments)

Tier assignments confirmed against the loaded test context: Vitest 3.2.6 (`vitest.config.ts` — `src/**/*.test.ts(x)`, node env) is the Fully-Automated runner; Playwright E2E (`e2e/`) is the Hybrid runner. STRIDE scan (vc-security) complete for the secrets/connection surface — see the validate-contract.

**Area: connection-string parser (high-risk: secrets/trust boundary)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Fields → DATABASE_URL build (host,port; instance; brace-escaping) + field validation | Vitest on `connection-string.ts` incl. special-char passwords, named instance | URL build correctness | live connect |
| Fully-automated | env-line injection-safe serialization — hostile inputs: `\n`, `\nAUTH_SECRET=` clobber, quotes, backslashes, Thai-char password | Vitest on `env-write.ts` — assert only DATABASE_URL line changes, no injection/clobber | env-injection defense | runtime |
| Fully-automated | Backup-before-write (.env → .env.bak) | Vitest asserts `.env.bak` written before `.env` mutated | rollback safety | — |
| Fully-automated | `.env.bak` is gitignored (never committed) | Vitest asserts `.gitignore` `.env*` matches `.env.bak` | secret-file hygiene | — |
| Fully-automated | Password never appears in logs; masked in UI; test-connection error sanitized | Vitest asserts masked output + no string/password in the returned error | secret hygiene | runtime |
| Fully-automated | Auth-guard covers the new settings page AND actions module (ADMIN-gated) | `auth-guard-coverage.test.ts` — settings `actions.ts` in MODULES + ADMIN assertion + page-grep | ADMIN-only coverage | runtime redirect |

**Area: runtime DB switch (high-risk: DB config)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Round-trip switch: orderstock → orderstock2 → back, data-distinguishing each way | precondition: `orderstock2` created on the SAME container + schema script run + seeded with a DISTINGUISHING sentinel (e.g. a shop/row absent from `orderstock`); switch via settings, assert the app reads orderstock2 by OBSERVING the sentinel (not merely a successful connect), switch back and assert the sentinel is GONE. **process.exit apply**: gate drives save up-to-and-including the `.env` write with `ORDERSTOCK_NO_EXIT=1` (or `NODE_ENV=test`) and asserts the new URL + `.env.bak`; the actual restart is a documented manual step (test server must not be killed) | runtime switch round-trip | customer prod |
| Hybrid | Test-connection reports failure on bad string (no `.env` write, sanitized error) | enter invalid string; expect a clear FIXED Thai error (no string/password echoed), no crash, `.env` untouched | validation robustness + fail-safe + info-disclosure defense | — |
| Agent-probe | Deployment guide complete + runnable in order (incl. lockout recovery + print instructions) | review `docs/deployment-guide.md` vs checklist | delivery readiness | customer env |

**Sandbox-only fixture rule (charter, non-negotiable):** every test fixture / connection string used by these gates MUST target `localhost:1433` sandbox DBs (`orderstock` + `orderstock2`) ONLY. No non-sandbox / customer host may appear in any fixture, seed, or `.env` under test. Any request to test against the customer's real prod DB without explicit user authorization = HARD STOP.

High-risk (secrets/DB config): minimum Hybrid — satisfied by round-trip switch + failure gates. Known-Gap not permitted for the switch behavior. STRIDE scan (vc-security) complete at PVL for the `.env`-write/secrets surface (see validate-contract).

---

## Exit Gate

```bash
pnpm test   # Expected: connection-string build + env-write injection/backup/gitignore + masking/sanitize + auth-guard (page + actions module) unit tests green
# Hybrid: create orderstock2 on the same container + run schema script + seed a distinguishing sentinel;
#   switch via the settings page; assert the app READS orderstock2 by observing the sentinel;
#   switch BACK to orderstock and assert the sentinel is gone (round-trip). .env.bak written; bad string never writes .env
pnpm tsx scripts/export-schema-sql.ts   # Expected: final vendor schema script regenerated
```

- Round-trip DB switch (orderstock → orderstock2 → back) via the settings page works with a data-distinguishing assertion each way; `.env.bak` backup present; bad string fails safe (no `.env` write, sanitized error).
- Delivery package produced: `db/create-orderstock-schema.sql`, `db/create-database-and-login.sql`, `docs/deployment-guide.md` (Thai, incl. lockout recovery + print instructions).
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- `process.exit(0)` apply cannot be exercised in the test server without killing it → gate the exit behind `NODE_ENV==="test"` / `ORDERSTOCK_NO_EXIT=1`, stop at the `.env` write + assert the new URL/`.env.bak`, and document the manual-restart step as the Hybrid procedure — NOT a hard block.
- Customer SQL Server version still unconfirmed → the login/compat script cannot be finalized to the exact target; ship with the assumed `COMPATIBILITY_LEVEL 140/150` + a clearly-flagged TODO — surface to user.
- Non-NSSM hosting (no auto-restart) → document the manual-restart fallback; NOT a block.
- Any request to test against the customer's REAL prod DB without explicit user authorization → HARD STOP (safety boundary — sandbox DBs only).

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE_WITH_CONCERNS — 2 design flaws found (AppSetting infeasible for the string → .env rewrite; requireAuth lockout → documented manual recovery); .env = single source of truth for db.ts + prisma.config.ts (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — verdict GO + 2 mitigations; Decision Summary (.env rewrite + .env.bak backup, restart-under-NSSM apply + health-poll, fields-primary input, orderstock2 round-trip gate) written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: full V1-V7 + STRIDE scan complete; validate-contract written per example-validate-output.md; 8 STRIDE concerns folded in (CONDITIONAL, 0 FAILs)
- [x] 5. EXECUTE — DONE 06-07-26: all checklist items A1-A3/B1-B5/C1-C3 done; 8 Fully-Automated gates green (vitest 70/70), build+lint clean, Hybrid round-trip gate PASS (.env restored), Agent-Probe guide GO, 5-artifact evidence pack validated. Report: phase-06-db-settings-delivery_REPORT_06-07-26.md. Deviation: settings page at `(main)/settings/db` (within-blast-radius). Awaiting independent EVL.
- [x] 6. EVL — DONE 07-07-26 (independent vc-tester sweep + fix-cycle confirmation): ALL gates independently green — `pnpm build` exit 0 (`/settings/db` in route table), `pnpm exec playwright test` **19 passed** incl. 3 genuine `/settings/db` runtime auth probes (unauth→/login, STAFF denied, ADMIN served), `pnpm test` 70/70, `pnpm lint` clean, round-trip switch ✓, no `.env` drift, prisma status up-to-date (orderstock). The first EVL sweep caught a build FAIL (`mssql` missing `@types/mssql`) + a runtime-auth coverage gap; the fix cycle (@types/mssql devDep + `.ts` import extensions dropped + new `e2e/settings.spec.ts`) resolved both, independently re-confirmed. Only documented customer known-gaps remain. EVL HANDOFF SUMMARY updated in the report.
- [x] 7. UPDATE PROCESS — archived; context updated; committed (program folder moved active/ → completed/ 07-07-26; this is the FINAL phase — the whole phase1-order-system program is now complete)

**Validate-contract written — EXECUTE may proceed after user consent (ENTER EXECUTE MODE).**

---

## Touchpoints

- `src/app/(main)/settings/db/**`, `src/lib/connection-string.ts`, `src/lib/env-write.ts`, `src/auth.config.ts`, `src/app/nav.tsx`, `auth-guard-coverage.test.ts`
- `db/create-orderstock-schema.sql`, `db/create-database-and-login.sql`, `docs/deployment-guide.md`
- (`src/lib/db.ts` NOT modified — already reads DATABASE_URL)

---

## Public Contracts

- Establishes the runtime DB-config contract: settings page fields → `DATABASE_URL` in `.env` (single source of truth for `src/lib/db.ts` + `prisma.config.ts`); apply = restart. Must remain stable post-delivery.
- The two SQL scripts + Thai deployment guide are the delivery contract with the customer's DBA/IT.
- `src/lib/db.ts` is NOT modified (already reads `DATABASE_URL`).

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Fields → DATABASE_URL build unit | Fully-Automated | DoD #6 (accept customer config) — proven by: connection-string unit gate |
| env-write injection-safe (hostile inputs) + backup-before-write + `.env.bak` gitignored | Fully-Automated | Secrets/env safety — proven by: env-write unit gates |
| Password masked; test-connection error sanitized; auth-guard covers settings page + actions module | Fully-Automated | Secrets + ADMIN-only safety — proven by: masking/sanitize + auth-guard unit gates |
| Round-trip switch orderstock→orderstock2→back (data-distinguishing) | Hybrid | DoD #6 (runtime DB switch) — proven by: round-trip hybrid gate |
| Deployment package complete (incl. lockout recovery) | Agent-Probe | DoD #6 (delivery packaging) — proven by: guide agent-probe |

```bash
# Expected: after applying a second sandbox connection string, the app reads the second DB (sentinel observed)
```

---

## Test Infra Improvement Notes

- Add a second named Docker sandbox DB (`orderstock2`) to the compose/test setup so the runtime-switch hybrid test has a real target. Record the two-DB setup in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-06-db-settings-delivery_PLAN_06-07-26.md`
- Last completed step: 4. PVL (validate-contract written; STRIDE complete)
- Validate-contract status: WRITTEN — gate CONDITIONAL (8 STRIDE concerns folded in; 0 FAILs). NEXT STEP is EXECUTE (Step 5) after user consent (ENTER EXECUTE MODE). Sandbox DBs only (orderstock + orderstock2 on the same container); customer prod DB OFF-LIMITS unless the user explicitly authorizes.
- Next step: Spawn vc-execute-agent (opus) for EXECUTE once the user consents. Follow the Execute-Agent Instructions in the validate-contract.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: ✅ VERIFIED (07-07-26 — all EVL gates independently green after fix cycle; only documented customer known-gaps remain)

## Overview

This is a phase plan within the phase1-order-system phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`phase1-order-system-umbrella_PLAN_06-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan has completed VALIDATE (PVL); ENTER EXECUTE MODE (with user consent) to begin implementation.

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

Status: CONDITIONAL
Date: 06-07-26
date: 2026-07-06
generated-by: inner-pvl: phase-06

Parallel strategy: sequential
Rationale: 4/7 signals present (S2 auth/secrets, S4 phase-program, S6 secrets/trust-boundary high-risk, S7 6+ blast-radius files); but the fan-out was a read-only validation of ONE finished plan with no cross-agent talk, so Simple-Mode inline two-layer synthesis (dominant signal: S6 secrets/trust-boundary) is the cost-efficient fit. EXECUTE = sequential one-agent (cohesive dependent pipeline, /goal phase-program leg).

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| A1 | Fields → `sqlserver://` DATABASE_URL build (host/port, named instance, brace-escaped special-char + Thai password) + required-field validation | Fully-Automated | Vitest `src/lib/__tests__/connection-string.test.ts` — build + validation cases | B |
| A2 | env-write injection-safe: hostile inputs (`\n`, `\nAUTH_SECRET=` clobber, quotes, backslashes, Thai password) change ONLY the DATABASE_URL line | Fully-Automated | Vitest `src/lib/__tests__/env-write.test.ts` — assert single-line change, no injection/clobber | B |
| A2b | `.env` → `.env.bak` backup written BEFORE `.env` is mutated | Fully-Automated | Vitest `env-write.test.ts` — order assertion | B |
| A3 | `.env.bak` is matched by `.gitignore` (`.env*`) — backup never committed | Fully-Automated | Vitest asserts gitignore pattern matches `.env.bak` | B |
| B1 | Password masked in UI; never rendered as plaintext into client HTML | Fully-Automated | Vitest asserts masked field output | B |
| B2 | Test-connection error is a FIXED Thai message — no connection string / host / user / password echoed | Fully-Automated | Vitest asserts sanitized error string | B |
| B4 | Every settings server action + the settings page call `requireAuth("ADMIN")` | Fully-Automated | `auth-guard-coverage.test.ts` — settings `actions.ts` in MODULES + ADMIN assertion + page-grep | B |
| Dec8 | Round-trip DB switch orderstock→orderstock2→back, data-distinguishing sentinel each way; save drives up-to-`.env`-write under `ORDERSTOCK_NO_EXIT=1`; `.env.bak` present | Hybrid | Playwright/Vitest hybrid — precondition: `orderstock2` on same container + schema + sentinel seed | B |
| B2h | Bad string → test-connection fails, `.env` untouched, sanitized Thai error, no crash | Hybrid | Hybrid negative case | B |
| C3 | Deployment guide complete + runnable in order (lockout recovery + print instructions) | Agent-Probe | Review `docs/deployment-guide.md` vs checklist | D |

gap-resolution legend: A — proven now; B — fixed in this plan (gate added by this plan's checklist); C — deferred to a named later phase/plan; D — backlog test-building stub / named residual.

C-4 reconciliation: the `strategy:` column carries ONLY Fully-Automated / Hybrid / Agent-Probe. The `C3` guide row is Agent-Probe (judgment), the only non-fully-automatable behavior; it is a named residual (D), not a silent Known-Gap — the guide's runnability is judged by an agent probe, and the delivery scripts themselves are proven by C1/C2 regeneration + the Hybrid switch gate. No developed behavior rests on Known-Gap alone → not vacuously green.

Legacy line form (retained for existing consumers):
- connection-string build: Fully-automated: `pnpm test` (connection-string.test.ts)
- env-write injection/backup/gitignore: Fully-automated: `pnpm test` (env-write.test.ts)
- masking + sanitize + auth-guard (page + actions): Fully-automated: `pnpm test` (auth-guard-coverage.test.ts)
- round-trip DB switch: hybrid: Playwright + `orderstock2` on same container + sentinel seed + `ORDERSTOCK_NO_EXIT=1`
- deployment guide: agent-probe: review `docs/deployment-guide.md` vs checklist

Failing stub (A1):
test("should build a sqlserver:// DATABASE_URL from fields with a brace-escaped special-char password", () => { throw new Error("NOT IMPLEMENTED — TDD stub: fields → DATABASE_URL build") })

Failing stub (A2):
test("should change only the DATABASE_URL line and reject a newline KEY=value injection payload", () => { throw new Error("NOT IMPLEMENTED — TDD stub: env-write injection-safe serialization") })

Failing stub (A2b):
test("should write .env.bak before mutating .env", () => { throw new Error("NOT IMPLEMENTED — TDD stub: backup-before-write") })

Failing stub (A3):
test("should have .env.bak matched by the .gitignore .env* pattern", () => { throw new Error("NOT IMPLEMENTED — TDD stub: .env.bak gitignored") })

Failing stub (B1):
test("should mask the password field and never render plaintext into client HTML", () => { throw new Error("NOT IMPLEMENTED — TDD stub: password masking") })

Failing stub (B2):
test("should return a fixed Thai error with no connection string or password echoed", () => { throw new Error("NOT IMPLEMENTED — TDD stub: test-connection error sanitization") })

Failing stub (B4):
test("should assert every settings action and the settings page call requireAuth ADMIN", () => { throw new Error("NOT IMPLEMENTED — TDD stub: auth-guard coverage of settings actions module + page") })

Dimension findings:
- Infra fit: PASS — db.ts + prisma.config.ts both read `process.env.DATABASE_URL` (verified in source), so ".env rewrite + restart, db.ts unmodified" is mechanically coherent; single container `orderstock-sql` matches the same-container orderstock2 decision; `/api/health` exists for the reconnection poll; export-schema-sql.ts exists for C1.
- Test coverage: CONCERN — Vitest (fully-automated) + Playwright (hybrid) runners confirmed; the switch behavior is Hybrid (correct for the high-risk DB-config class); process.exit test-mode flag now pinned; round-trip now requires a data-distinguishing sentinel (was under-specified). Guide readiness is Agent-Probe (residual D, justified).
- Breaking changes: PASS — greenfield; db.ts NOT modified (already reads DATABASE_URL); `.env` `DATABASE_URL` is the single source of truth for app + CLI; new settings contract is additive.
- Security surface: CONCERN — STRIDE scan complete; 6 of 8 concerns are security-surface (injection hostile-input enumeration, test-connection error sanitization, auth-guard coverage of the ACTIONS module not just the page, edge `/settings` ADMIN gate, `.env.bak` gitignore assertion, save-gate ordering). All folded into the checklist as applied plan-updates + execute-agent instructions. Existing defenses confirmed: `.gitignore` `.env*` covers `.env`+`.env.bak`; `/api/health` sanitizes; `requireAuth` re-reads DB (E4). No FAIL.
- Section A (config builder + safe env write) feasibility: CONCERN — mechanically feasible (new files, no collision); highest-risk edit = env-write serialization; mitigated by explicit hostile-input unit test (A2) + backup-before-write (A2b) + gitignore guard (A3).
- Section B (settings page + apply) feasibility: CONCERN — admin/users is an exact precedent (page `requireAuth("ADMIN")` + per-action guard + role-gated nav); highest-risk edit = the save→exit ordering; mitigated by save-gate invariant (test-connection MUST pass before write) + test-mode exit flag + auth-guard coverage extension to the actions module.
- Section C (delivery package) feasibility: PASS — export-schema-sql.ts regeneration is deterministic; hand-authored SQL + Thai guide are content tasks with a clear content list; guide completeness is Agent-Probe.

Open gaps: none blocking. Residuals: (1) guide runnability is Agent-Probe judgment (D — record judgment at EVL); (2) customer SQL Server version/compat unconfirmed → ship `COMPATIBILITY_LEVEL 140/150` + flagged TODO (carried known-gap, surfaced to user); (3) on-site real-printer mm fidelity (Phase 05 carry-forward agent-probe, closed at delivery via print instructions).

What this coverage does NOT prove:
- connection-string build gate: does NOT prove a live connection to any SQL Server (URL string correctness only).
- env-write gates: do NOT prove runtime `.env` reload (that requires the restart, which is a documented manual/NSSM step, not exercised in unit tests).
- masking/sanitize/auth-guard gates: do NOT prove the runtime redirect for a logged-out/STAFF user (static source-coverage only; the edge gate + server `requireAuth` enforce at runtime).
- Round-trip Hybrid gate: does NOT prove behavior against the customer's real prod DB (sandbox `orderstock`/`orderstock2` only — charter HARD STOP) and does NOT exercise the actual `process.exit`/NSSM restart (test-mode flag stops at the `.env` write; restart is a documented manual step).
- Deployment-guide agent-probe: does NOT prove the guide works in the customer's actual Windows/NSSM/SQL-Server environment.

Execute-agent instructions:
- E1 (Section A): env-write.ts MUST escape/serialize so embedded newlines and `KEY=value` payloads cannot inject or clobber other keys; write `.env.bak` BEFORE mutating `.env`; rewrite ONLY the DATABASE_URL line; NEVER log the value. Red-first: land A2/A2b/A3 stubs failing, then implement.
- E2 (Section B, save-gate ordering): the `env-write` + `process.exit` path MUST be unreachable unless test-connection returned ok. A bad string never reaches the write. Gate exit: `if (process.env.NODE_ENV !== "test" && process.env.ORDERSTOCK_NO_EXIT !== "1") process.exit(0)`.
- E3 (Section B, info disclosure): test-connection returns a FIXED Thai error; NEVER echo the connection string/host/user/password to the client (log raw server-side only, like /api/health).
- E4 (Section B, elevation): add the settings `actions.ts` to `auth-guard-coverage.test.ts` MODULES + the ADMIN assertion + the page-grep — do NOT ship with only the page grep. Add `/settings` to the `authorized` edge callback ADMIN branch and gate the nav link on `role === "ADMIN"`.
- E5 (charter, HARD STOP): every fixture/connection string under test targets `localhost:1433` sandbox DBs (`orderstock`/`orderstock2`) ONLY. Any request to point at the customer's real prod DB without explicit user authorization = STOP and ask.
- E6 (Hybrid gate): seed `orderstock2` with a data-distinguishing sentinel; assert the app READS orderstock2 by observing the sentinel (not merely a successful connect), and assert the sentinel is ABSENT after switching back.
- E7 (delivery): regenerate `db/create-orderstock-schema.sql` via `pnpm tsx scripts/export-schema-sql.ts`; hand-author `db/create-database-and-login.sql` with the full content list (CREATE DATABASE + COLLATE + COMPATIBILITY_LEVEL TODO, CREATE LOGIN/USER, grants, run-order); write `docs/deployment-guide.md` with the C3 section list incl. lockout recovery + Phase 05 print instructions.
- E8 (high-risk evidence pack): this is a secrets/trust-boundary high-risk class — produce the 5-artifact evidence pack in `.../phase1-order-system_06-07-26/harness/phase-06/` before reporting DONE (risk-gate, context-snippets, verification, review-decision, adversarial-validation).

Gate: CONDITIONAL (8 concerns noted and folded into the plan as applied plan-updates + execute-agent instructions; 0 FAILs; high-risk switch behavior has a Hybrid gate — not vacuously green; EXECUTE-ready after user consent)
Accepted by: session (autonomous, /goal execution) — accepted concerns: env-write hostile-input enumeration; test-connection error sanitization; auth-guard coverage of the settings actions module (not just page); edge `/settings` ADMIN gate + ADMIN nav link; `.env.bak` gitignore assertion; save-gate ordering invariant; process.exit test-mode flag pinned; round-trip data-distinguishing sentinel + sandbox-only fixture rule.

Autonomous goal block: governed by the umbrella `## Stable Program Goal` (BRANCH B — no per-phase goal block written). Reference for latest state: process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
