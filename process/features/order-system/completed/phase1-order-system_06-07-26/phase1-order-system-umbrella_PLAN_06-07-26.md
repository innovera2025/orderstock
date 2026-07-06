---
name: plan:phase1-order-system-umbrella
description: "orderstock Phase 1 — umbrella/orchestration plan for the 6-phase Thai order-sheet management program (record + print daily order sheets on SQL Server)"
date: 06-07-26
metadata:
  node_type: memory
  type: umbrella
  feature: order-system
  phase: umbrella
---

# orderstock Phase 1 (Order System) — Umbrella Plan

**Date**: 06-07-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED

## Overview

This umbrella orchestrates the phase1-order-system phased delivery plan; the per-phase implementation checklist lives in the six phase plans. Context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. Next Step: run Phase 01 RESEARCH (ENTER EXECUTE MODE only per-phase after each validate-contract is written).

- Program type: PHASE PROGRAM (6 phases, sequential with gated joins)
- Date: 06-07-26
- Feature folder: `process/features/order-system/`
- Program task folder: `process/features/order-system/active/phase1-order-system_06-07-26/`

## Research References (co-located FLAT in this program folder)

- `form-canonical_REF_06-07-26.md` — scan-verified structural transcription of the reference form (`Scan2026-07-04_170934.pdf`): 22 ruled columns (20 numeric product-variants + ลำดับ + ร้านค้า + หมายเหตุ with qty strip), 29 shop rows, totals, footer tallies, ~30 uncertain name readings pending user confirmation.
- `db-auth-feasibility_REF_06-07-26.md` — Prisma 7 + `@prisma/adapter-mssql` driver-adapter pattern, ADO.NET→JDBC conversion, `migrate diff --script` offline export, SQL Server 2017+ floor, Docker sandbox, next-auth v5 credentials/JWT/roles.
- `print-approach_REF_06-07-26.md` — browser print `@page A4 landscape` primary, Playwright `page.pdf()` fallback reusing the same route, Sarabun (OFL) font, why @react-pdf/renderer and `transform: scale()` are rejected.

---

## Program Goal Charter

```
orderstock Phase 1 (Order System) — Program Goal Charter

North star:
- Thai-speaking staff can record a day's customer order sheet exactly as the current paper form
  ("ใบออเดอร์สินค้า") captures it, and print combined-day and per-shop sheets that match the
  scanned typeset form layout, running on the customer's SQL Server.

Definition of done (an unattended agent must be able to do all of these):
1. Boot the Next.js app, connect to a sandbox SQL Server, and pass a DB health check.
2. Manage master data: shops, products with package-size/flavor variants (fixed print order,
   product groups สินค้า/เครื่องปรุง), and export a vendor-ready T-SQL creation script.
3. Log in as ADMIN or STAFF with role-gated route protection.
4. Record a daily order sheet (rows=shops, columns=product-variants in print order, per-row notes +
   qty strip) with auto per-column totals and total weight; recreate the 13/3/69 scan day and match
   its column totals and grand total (446 pieces).
5. Print a combined daily sheet and per-shop sheets on A4 landscape that visually match the scan.
6. Point the app at a different SQL Server via a runtime connection-string settings page, and
   package the SQL + DB/login script + deployment guide for customer delivery.

What "verified" means (program level):
- Each phase's exact exit gate passes with recorded evidence (command output, screenshots, or
  runtime DB state as specified in that phase plan), AND regression checks against overlapping
  previously-verified surfaces pass.
- validate-contract gates must be recorded alongside phase gates and regression evidence for a phase
  to reach VERIFIED. A phase without a validate-contract (or documented skip reason) cannot be
  marked VERIFIED.

Scope tiers → phase mapping:
- Tier 1 Foundation (app boots, connects, prints scaffold) → Phases 01, 02.
- Tier 2 Access + capture (auth, order entry) → Phases 03, 04.
- Tier 3 Output + delivery (printing, runtime DB settings, packaging) → Phases 05, 06.
- This program retires Tiers 1-3 (the full confirmed Phase-1 product scope).

Explicitly out of scope (deferred tier):
- Stock deduction / inventory balance (the "stock" half of the product name) — recording + printing
  only in Phase 1.
- Reporting/analytics dashboards, multi-branch aggregation beyond the single สถานที่ header field.
- PDF-archive/email automation unless the customer confirms a requirement (fallback PDF route is
  designed but its productization is deferred).

Hard safety constraints (non-negotiable, per phase):
- NEVER connect to or modify the customer's real SQL Server during development — sandbox (Docker
  SQL Server 2022 under Rosetta) ONLY until the Phase 06 delivery gate.
- No destructive database operations outside the disposable Docker sandbox.
- Every phase EXECUTE requires explicit user consent (ENTER EXECUTE MODE) unless a standing /goal
  grants it; even then, outward-facing/irreversible actions are deferred-and-reported.
- Do not commit or push without user instruction; never push to the (empty) GitHub remote unprompted.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context
  commits separate from execution commits.
```

---

## Stable Program Goal (copy-paste this to start autonomous execution)

```
SESSION GOAL: order-system — orderstock Phase 1 (Order System)
Ref: process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md

TARGET: Complete ALL 6 phases until:
- Every phase exit gate passes with recorded evidence
- 13/3/69 scan day recreatable with matching totals (446 pieces); print output matches the scan
- Runtime DB switch (sandbox → second DB) works via the settings page
- Test tiers: automated (iterate-until-green) / hybrid (fix-if-in-blast-radius) / agent-probe (record-judgment)

AUTONOMY: Before ANY subagent spawn, read:
1. Umbrella ## Current Execution State → loop step + validate-contract status
2. Phase plan ## Phase Loop Progress → first unchecked box = next subagent to spawn

PER-PHASE LOOP (7-step inner loop `R → I → P → PVL → E → EVL → UP`, never skip, never reorder; SKIPS SPEC — SPEC runs once in the outer program loop):
  1. RESEARCH → 2. INNOVATE → 3. PLAN-SUPPLEMENT → 4. PVL → 5. EXECUTE → 6. EVL → 7. UPDATE-PROCESS
- PLAN-SUPPLEMENT: plan-agent writes research/innovate gaps into phase plan (or marks "n/a — clean")
- PVL NEVER skipped; contract must follow example-validate-output.md full format; partial contract
  (missing Plan updates applied / Execute-agent instructions / Test gates) = blocked same as placeholder
- Every subagent FIRST ACTION: run vc-context-discovery (context group files + process/context/tests/all-tests.md
  routing chain) AND vc-plan-discovery (same-feature full depth + other features active + general-plans active)
- Every phase-END: invoke vc-agent-strategy-compare for next-step strategy recommendation
- Model: sonnet for all legs; opus ONLY for the EXECUTE (code-writing) leg

Report via phase reports. No approval between phases unless a HARD STOP is hit.

HARD STOPS (pause, wait for user):
- Any attempt to connect to / mutate the customer's real SQL Server (sandbox-only until Phase 06 gate)
- Commit or push to the git remote without user instruction
- Net gate = BLOCKED with no backlog resolution path
- Validate-contract is placeholder and vc-validate-agent cannot run; or agent count > 100

SAFETY (never override):
- Dev DB = disposable Docker sandbox ONLY; never touch customer prod DB before delivery
- No destructive DB ops outside the Docker sandbox; commit each phase before advancing
- Process/plan and execution commits stay separate

TEST GATES (every phase exit — full-path validators):
  node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <phase-plan-path>
  node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs <umbrella-plan-path>
  node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs --strict
  node .claude/skills/vc-audit-context/scripts/validate-context.mjs   (run after any context change)
  node .claude/skills/vc-audit-plans/scripts/validate-plans.mjs       (active-plan hygiene)
  Plus per-phase product gates: pnpm build / pnpm test / pnpm lint / prisma migrate diff --script (see each phase plan)

VALIDATE CONTRACT: Per-phase contracts written by vc-validate-agent into each phase plan before EXECUTE.

START: Phase 01 (Foundation), loop step RESEARCH (pending). Spawn vc-research-agent for Phase 01.
```

---

## Phase Sequence

| Phase | Plan file | Scope summary | Depends on |
|---|---|---|---|
| 0 (pre-program) | this file | Confirm folder structure, create sub-phase plans, blast-radius registry | — |
| 01 — Foundation | `.../phase-01-foundation_PLAN_06-07-26.md` | Next.js+TS scaffold, Prisma 7 + adapter-mssql wiring, Docker SQL Server 2022 sandbox + compat level, Sarabun font, Thai layout shell, DB health check | Phase 0 |
| 02 — Schema & Master Data | `.../phase-02-schema-master-data_PLAN_06-07-26.md` | Full schema (shops, products+variants+print order+groups, sheets, lines, users, settings), migrations, shops/products CRUD, seed from canonical form (uncertain names flagged), vendor SQL-script export | Phase 01 |
| 03 — Auth | `.../phase-03-auth_PLAN_06-07-26.md` | next-auth v5 credentials, password hashing, ADMIN/STAFF roles, middleware route protection, admin user-management, seed admin | Phase 02 |
| 04 — Order Entry | `.../phase-04-order-entry_PLAN_06-07-26.md` | Daily order-sheet grid UI, per-column totals + total weight, create/edit/list by date+location, Buddhist-era date display | Phase 02 + Phase 03 |
| 05 — Printing | `.../phase-05-printing_PLAN_06-07-26.md` | Print routes (combined day + per-shop), A4 landscape mm layout, print CSS, visual comparison, optional Playwright PDF fallback | Phase 04 |
| 06 — DB Settings & Delivery | `.../phase-06-db-settings-delivery_PLAN_06-07-26.md` | Connection-string settings page (ADO.NET→adapter, test-connection, singleton swap/restart), delivery packaging (SQL + login script + deploy guide) | Phase 02 + Phase 05 |

### Join Conditions

- Phase 01 MUST NOT start until Phase 0 exit gate passes (all plan files created).
- Phase 02 MUST NOT start until Phase 01 exit gate passes (app boots + connects to sandbox).
- Phase 03 MUST NOT start until Phase 02 exit gate passes (schema + CRUD working).
- Phase 04 MUST NOT start until Phase 02 AND Phase 03 exit gates both pass.
- Phase 05 MUST NOT start until Phase 04 exit gate passes (scan day recreatable).
- Phase 06 MUST NOT start until Phase 02 AND Phase 05 exit gates both pass.

---

## Per-Phase Entry / Exit Gates

| Phase | Entry | Exit gate |
|---|---|---|
| 0 | Program start | Phase plan files + blast-radius registry created; validators pass |
| 01 | Phase 0 complete | App boots (`pnpm build`+`pnpm dev`), connects to Docker sandbox DB, health/DB-status endpoint returns green |
| 02 | Phase 01 exit met | Shops/products CRUD works e2e on sandbox; `prisma migrate diff --from-empty --to-schema --script` produces valid T-SQL; seed loads canonical form data with uncertain names flagged |
| 03 | Phase 02 exit met | Login/logout works; ADMIN/STAFF role-gating enforced by middleware AND re-checked server-side; admin can manage users |
| 04 | Phases 02+03 exits met | 13/3/69 scan-day data recreatable; per-column totals + grand total match scan (446 pieces); dates display in BE, stored CE |
| 05 | Phase 04 exit met | Combined + per-shop print output visually matches the reference scan structure on A4 landscape |
| 06 | Phases 02+05 exits met | Switching sandbox → a second DB via the settings page works; delivery package (SQL script + login script + deploy guide) produced |

---

## Per-Phase Loop

Each phase executes the canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP`. This inner
loop SKIPS SPEC — SPEC runs once in the outer program loop, not per phase. The 7 steps map to:

1. **RESEARCH** — spawn research-agent: load context, read prior phase reports, check plan drift, document findings.
2. **INNOVATE** — spawn innovate-agent: decide approach; write Decision Summary (chosen approach + rejected alternatives).
3. **PLAN-SUPPLEMENT** — spawn plan-agent: add research/innovate gaps to the checklist, or mark "n/a — research clean" and tick step 3.
4. **PVL** — spawn vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` format.
5. **EXECUTE** — spawn vc-execute-agent (opus) per approved plan and validate-contract.
6. **EVL** — spawn vc-tester: run phase test gates to green; regression-check overlapping surfaces; register follow-up stubs; write EVL HANDOFF SUMMARY.
7. **UPDATE-PROCESS** — write phase report to durable path; rewrite umbrella `## Current Execution State` (overwrite, not append).

**PVL is NEVER skipped.** A placeholder `## Validate Contract` = blocked. Do not spawn execute-agent while the Validate Contract section reads "(placeholder — vc-validate-agent writes this section before EXECUTE)".

---

## Autonomous Execution Rules (During /goal)

During /goal execution of this phase program:
- Agent self-decides at all V5 gates — no user approval needed between phases (except HARD STOPS).
- CONDITIONAL net gate: proceed autonomously, fixes applied in-flight, gaps on record.
- BLOCKED net gate: document items in backlog, continue with remaining phase plans; backlog is always a valid resolution.
- Hard stops (must pause for user approval):
  - Any connection to / mutation of the customer's real SQL Server (sandbox-only until Phase 06 gate).
  - Commit or push to the git remote without user instruction.
  - Plan file explicitly marks "pause required" at a step.
- The phase report is the communication channel for conflicts, errors, and learnings — not inline questions.

---

## Global Constraints

- Prisma 7 driver-adapter pattern (`@prisma/adapter-mssql`) from day one — old `datasourceUrl`/`datasources` tutorials are WRONG for v7. Pin exact Prisma 7.8.x.
- Pin exact `next-auth@5.0.0-beta.31`; INNOVATE (Phase 01) confirmed it is compatible with **Next 16.2.x**, which is the pinned Next major.
- **RESOLVED (Phase 03 PLAN-SUPPLEMENT):** Next 16 route protection uses **`proxy.ts`** (NOT `middleware.ts`, which is silently ignored). Auth.js v5 also requires `src/app/api/auth/[...nextauth]/route.ts` and env vars `AUTH_SECRET`/`AUTH_TRUST_HOST`. Encoded in the Phase 03 plan; bcryptjs chosen for hashing; login rate-limiting added.
- **CROSS-PHASE (LOAD-BEARING, Phase 04/05 input):** Phase 02 (decision 6) adds historical name-snapshot columns `shopNameAtEntry`/`variantNameAtEntry` on `OrderLine`/`NoteLine`. Phase 04 MUST write these at line-create time AND preserve pre-existing snapshots on re-save (delete-recreate carries them forward); Phase 05 MUST render from them (never live names). A shared correction-cascade back-fills snapshots only while the referenced entity is still `needsConfirmation=true`.
- **CROSS-PHASE (Phase 05 input):** Phase 04 exports the reusable two-tier `src/components/sheet-header.tsx` header component and the `test-fixtures/sheet-13-03-69.json` gate fixture — Phase 05 print imports both (do not duplicate the header or re-derive the fixture).
- **PRINT FETCH DRIFT (LOAD-BEARING):** print MUST use a NEW shared `getSheetForPrint(date)` reading snapshot columns — NOT the live `/orders/[id]` fetch (which renders current names). Table width faithful ≈251mm (NOT 281mm). Server-side PDF fallback is DEFERRED to backlog (test-side page.pdf only).
- Schema and generated T-SQL must stay compatible with SQL Server 2017+ (2016 is an OPEN QUESTION with the customer — do not assume it works).
- Thai UI text; English code/identifiers/filenames.
- Printed output must visually match `Scan2026-07-04_170934.pdf` — the scan is the layout spec (typeset spreadsheet, not handwriting).
- NEVER use @react-pdf/renderer (Thai sara-am bugs) or `transform: scale()` for print fit.
- Confirm the ~30 uncertain master-data name readings (form-canonical REF §4/§5) with the user BEFORE Phase 02 seeding.
- Bundle Sarabun (OFL 1.1) self-hosted; never depend on the Google CDN or fonts installed on customer PCs.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context commits separate from execution commits.

---

## Durable Report Destinations

| Phase | Report path (FLAT in the program task folder) |
|---|---|
| 0 (pre-program) | `.../phase-00-planning_REPORT_06-07-26.md` |
| 01 — Foundation | `.../phase-01-foundation_REPORT_06-07-26.md` |
| 02 — Schema & Master Data | `.../phase-02-schema-master-data_REPORT_06-07-26.md` |
| 03 — Auth | `.../phase-03-auth_REPORT_06-07-26.md` |
| 04 — Order Entry | `.../phase-04-order-entry_REPORT_06-07-26.md` |
| 05 — Printing | `.../phase-05-printing_REPORT_06-07-26.md` |
| 06 — DB Settings & Delivery | `.../phase-06-db-settings-delivery_REPORT_06-07-26.md` |

All paths are inside `process/features/order-system/active/phase1-order-system_06-07-26/`.

---

## Program Status Table

| Phase | Status |
|---|---|
| 0 — Pre-program (plan creation) | 🧪 TESTING (this umbrella + stubs created; validators pending) |
| 01 — Foundation | ✅ VERIFIED (all 7 inner-loop steps done; EVL independently re-ran all 6 gates green; `.env` created with user approval; 2 known-gaps accepted) |
| 02 — Schema & Master Data | ✅ VERIFIED (all 7 inner-loop steps done; EVL independently re-ran all 7 gates + Phase-01 regression clean; 4 accepted known-gaps; UPDATE PROCESS complete — context updated, backlog stub registered) |
| 03 — Auth | ✅ VERIFIED (all 7 inner-loop steps done; EVL independently re-ran all gates + adversarial auth probes + Phase 01/02 regression clean; 4 accepted known-gaps; UPDATE PROCESS complete — `auth/` context group created, `all-context.md`/`all-tests.md` updated, no new backlog beyond pre-existing revocation-hardening note) |
| 04 — Order Entry | ✅ VERIFIED (all 7 inner-loop steps done; EVL independently re-ran all gates + DB probe + Phase 01-03 regression clean; 2 accepted known-gaps backlogged (weight-factors, order-sheet-dup-index); UPDATE PROCESS complete — `database/all-database.md`/`all-context.md`/`tests/all-tests.md` updated, `sheet-header.tsx` + shared fixture confirmed exported for Phase 05) |
| 05 — Printing | ✅ VERIFIED (all 7 inner-loop steps done; EVL independently re-ran vitest 41/41, playwright 16/16, build+lint clean, migrate status clean, route-group deviation preserves all URLs + auth boundary, DB unpolluted, agent-probe visual GO; 3 known-gaps carried to delivery (Q30 shading, Q22 weight, on-site printer fidelity); UPDATE PROCESS complete — context updated, 2 new backlog stubs registered) |
| 06 — DB Settings & Delivery | ✅ VERIFIED (all 7 inner-loop steps done; EVL ran 2 rounds — round 1 caught a build FAIL + a runtime-auth coverage gap, fix cycle resolved both, round 2 independently re-confirmed all gates green; 3 accepted known-gaps carried to delivery (customer SQL Server version/compat, on-site printer fidelity, Q30/Q22 customer-input items); UPDATE PROCESS complete — program folder archived to completed/, context updated) |

**ALL 6 PHASES VERIFIED — PROGRAM COMPLETE (07-07-26).**

Status values: ⏳ PLANNED | 🔨 CODE DONE | 🧪 TESTING | ✅ VERIFIED | 🚧 BLOCKED | ✅ COMPLETE

---

## Touchpoints

- Phase 01: `package.json`, `next.config.ts`, `tsconfig.json`, `prisma/schema.prisma` (datasource + minimal model), `prisma.config.ts`, `src/lib/db.ts`, `src/lib/fonts.ts`, `src/app/layout.tsx`, `src/app/api/health/route.ts`, `docker-compose.yml`, `.env`, `vitest.config.ts`
- Phase 02: `prisma/schema.prisma` (full), `prisma/migrations/**`, `prisma/seed.ts`, `scripts/export-schema-sql.ts`, `src/app/shops/**`, `src/app/products/**`, `src/lib/product-order.ts`
- Phase 03: `src/auth.ts`, `src/auth.config.ts`, `middleware.ts`, `src/app/(auth)/login/**`, `src/app/admin/users/**`, `src/lib/password.ts`, `User` model
- Phase 04: `src/app/orders/**`, `src/lib/totals.ts`, `src/lib/be-date.ts`, order-sheet + order-line models
- Phase 05: `src/app/print/daily/[date]/**`, `src/app/print/shops/[date]/**`, `src/app/api/print/**` (fallback), `src/styles/print.css`
- Phase 06: `src/app/settings/db/**`, `src/lib/connection-string.ts`, `db/create-orderstock-schema.sql`, `db/create-database-and-login.sql`, `docs/deployment-guide.md`

---

## Public Contracts

- No prior app exists (greenfield); no external API contract to preserve at program start.
- Once established, the runtime connection-string contract (settings page accepts customer ADO.NET string → validated adapter config) must remain stable from Phase 06 onward.
- The generated vendor T-SQL script is a delivery contract with the customer's DBA — its shape must remain reproducible via `prisma migrate diff`.

---

## Blast Radius

Files directly modified or created across the program (grouped by phase — see per-phase plans for exact lists):

- Phase 01: root config (`package.json`, `next.config.ts`, `tsconfig.json`, `docker-compose.yml`, `.env`, `vitest.config.ts`), `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/{db,fonts}.ts`, `src/app/layout.tsx`, `src/app/api/health/route.ts`, one Vitest smoke test
- Phase 02: `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, `scripts/export-schema-sql.ts`, `src/app/{shops,products}/**`, `src/lib/product-order.ts`
- Phase 03: `src/auth.ts`, `src/auth.config.ts`, `middleware.ts`, `src/app/(auth)/login/**`, `src/app/admin/users/**`, `src/lib/password.ts`
- Phase 04: `src/app/orders/**`, `src/lib/{totals,be-date}.ts`
- Phase 05: `src/app/print/**`, `src/app/api/print/**`, `src/styles/print.css`
- Phase 06: `src/app/settings/db/**`, `src/lib/connection-string.ts`, `db/**`, `docs/deployment-guide.md`

Shared-file coordination (tracked in `phase-blast-radius-registry.md`): `prisma/schema.prisma` is touched by Phases 01 (datasource + minimal), 02 (full schema), and 03 (User fields). Phases must extend, not rewrite, prior schema. `src/app/layout.tsx` established in 01 is extended by 03 (auth nav) and 04.

---

## Verification Evidence

```bash
# Umbrella artifact validity
node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs \
  process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
# Expected: no FAIL lines

# All six phase plans valid
for f in process/features/order-system/active/phase1-order-system_06-07-26/phase-0*_PLAN_06-07-26.md; do
  node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs "$f"; done
# Expected: no FAIL lines per file

# Program-level product proof (after Phase 04): recreated scan-day grand total
# Expected: sum of 20 column totals == 446, matching form-canonical_REF §5
```

---

## Resume and Execution Handoff

- Selected plan file path (now archived): `process/features/order-system/completed/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md`
- Last completed phase: Phase 06 (DB Settings & Delivery — ✅ VERIFIED, FINAL phase). **PROGRAM COMPLETE.**
- Validate-contract status: Phases 01-06 all satisfied (see Current Execution State above).
- Next step for a fresh agent: this program is complete. If new order-system work is requested, check `process/features/order-system/backlog/` for deferred items first, or scope a new follow-up feature/plan for anything beyond the original Program Goal Charter.
- Current phase: none — program complete.
- Next action: none for this program. See backlog notes for deferred customer-input items.
- Phase 05 carry-forward for Phase 06 RESEARCH:
  - Delivery scope now includes communicating print instructions to the customer (Chrome/Edge only, printer Scale setting = 100%, run an on-site test print before relying on the layout) — the on-site printer-fidelity known-gap from Phase 05 travels here as the closing verification step, not a separate backlog item.
  - Known-gaps traveling to delivery: Q30 shading (CSS layer ready, OFF by default — flip if customer confirms), Q22 weight factors (labels render, values blank), customer SQL Server version/compat unconfirmed (2016 would be below the Prisma 7 / compat-150 floor — confirm before finalizing scripts), on-site real-printer mm fidelity (agent-probe only so far).
  - The connection-string settings page must accept the formats `@prisma/adapter-mssql` actually uses (JDBC-style `sqlserver://...` string, or an `sql.config`-shaped object — see `db-auth-feasibility_REF_06-07-26.md` §1) — plan for an ADO.NET-string → accepted-format conversion step, since customers/DBAs typically hand over an ADO.NET connection string.
  - The vendor SQL script (`db/create-orderstock-schema.sql`, generated via `scripts/export-schema-sql.ts`) already exists from Phase 02 — Phase 06 regenerates it against the final schema and hand-authors the companion DB-creation/login/permissions scripts alongside it (not a fresh design from scratch).
  - Runtime connection-string switching needs an explicit decision: swap the `PrismaClient` singleton in place (`src/lib/db.ts` constructor-level only — Prisma 7 has no live-URL-swap API) vs. requiring an app restart after settings are saved. Decide and document this in the Phase 06 plan before EXECUTE.

---

## Current Execution State

Last updated: 07-07-26 (Phase 06 UPDATE PROCESS closeout — ✅ VERIFIED; **PROGRAM COMPLETE — all 6 phases VERIFIED**)
Completed phases: Phase 0 (Planning), Phase 01 (Foundation — ✅ VERIFIED), Phase 02 (Schema & Master Data — ✅ VERIFIED), Phase 03 (Auth — ✅ VERIFIED), Phase 04 (Order Entry — ✅ VERIFIED), Phase 05 (Printing — ✅ VERIFIED), Phase 06 (DB Settings & Delivery — ✅ VERIFIED, FINAL phase)
Current phase: none — program complete.
Current loop step: n/a — all 7 inner-loop steps done for all 6 phases.
Validate-contract status: Phases 01-06 all satisfied (validate-contracts recorded in each phase plan).
Program Net Gate: **PROGRAM COMPLETE** — all 6 phase exit gates passed with recorded evidence; regression clean through Phase 06; the 13/3/69 scan day recreates with matching totals (446); print output matches the scan; runtime DB switch (sandbox → orderstock2) proven via Hybrid round-trip gate.
Latest validator run: 07-07-26 (this UPDATE PROCESS session, program closeout) — see this session's closeout packet for exact validator results (validate-all-context.mjs, validate-context-discovery.mjs, plan-artifact validators for phase-06 + umbrella, run against the moved `completed/` paths).

Loop step values: RESEARCH | INNOVATE | PLAN-SUPPLEMENT | PVL | EXECUTE | EVL | UPDATE-PROCESS

### Program Closing Summary

**What the program delivered:** a real, buildable Next.js 16 + Prisma 7 + SQL Server app that lets Thai-speaking staff log in (ADMIN/STAFF role-gated), manage shop/product master data, record a daily order sheet matching the paper form's 29-shop x 20-variant grid with live totals and Buddhist-era dates, print combined-day and per-shop A4-landscape sheets that visually match the reference scan, and — as the final delivery gate — switch the app's target SQL Server at runtime via an ADMIN-only settings page (individual fields → safe `.env` rewrite → restart-to-apply), packaged with a vendor T-SQL schema script, a hand-authored DB-creation/login script, and a Thai deployment guide.

**Remaining customer-input known-gaps (all backlogged, none blocking delivery):**
- `process/features/order-system/backlog/weight-factors_NOTE_06-07-26.md` — per-variant weight/pip conversion factors (Q22)
- `process/features/order-system/backlog/order-sheet-dup-index_NOTE_06-07-26.md` — optional DB-level duplicate-sheet index hardening
- `process/features/order-system/backlog/order-notes-ui-followups_NOTE_06-07-26.md` — minor note-match UI/e2e follow-ups
- `process/features/order-system/backlog/print-shading-q30_NOTE_06-07-26.md` — semantic print-fill colors (Q30), CSS layer ready but OFF
- `process/features/order-system/backlog/print-pdf-fallback_NOTE_06-07-26.md` — deferred server-side PDF export route
- `process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md` — headless CRUD DB-integration harness for shops/products (order sheets already closed via Phase 04 hybrid gates)
- Customer SQL Server version/compatibility level unconfirmed — TODO-flagged in `db/create-database-and-login.sql`; confirm before finalizing delivery scripts
- On-site real-printer mm fidelity — agent-probe only so far; deployment guide instructs an on-site test print (Chrome/Edge, Scale 100%) before relying on the layout

**Program learnings (what worked):** the 7-step inner loop (R→I→P→PVL→E→EVL→UP) caught real issues across all 6 phases before they reached "done" status — Prisma 7's removal of the `datasourceUrl` constructor API, Next 16's silent `middleware.ts`→`proxy.ts` rename, SQL Server's connector constraints (no enums, one-NULL-per-UNIQUE, `NoAction`-only cascades), a snapshot-preservation bug in the order-save write path, and a stale-green `pnpm build` claim at Phase 06 EVL (caught by independent re-run, not trusted from the execute-agent's own report). Independent EVL re-confirmation (not just trusting the execute-agent's self-report) was the single highest-value gate across the program — it caught the Phase 06 build regression that the execute-agent had missed.

Program status: **COMPLETE for the scoped Phase 1 foundation goal** (record + print daily order sheets on SQL Server, with runtime DB switching and delivery packaging). Stock deduction/inventory balance and any broader expansion work are explicitly out of scope for this program (see Program Goal Charter) and belong in a new follow-up feature if pursued later — this feature folder should not be kept artificially "in progress" for that adjacent future work.

Note: The Stable Program Goal above is fixed. This section is the only part that changes — update-process-agent rewrites it after every phase closeout (overwrite, not append — git history is the audit log). This is the FINAL update for this program.

---

## Pre-PVL Conflict Resolution

(Written by the orchestrator before outer PVL begins. Placeholder for now.)

Shared package/file conflicts across phases: `prisma/schema.prisma` (Phases 01, 02, 03) and `src/app/layout.tsx` (Phases 01, 03, 04) are the only cross-phase shared files. These are **parallel-safe by sequencing** — the program runs phases sequentially, and each phase extends (never rewrites) the prior state. No package reassignment required. Full classification to be confirmed by the orchestrator before outer PVL: 'No package conflicts — all phases are parallel-safe under sequential execution.'

---

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
