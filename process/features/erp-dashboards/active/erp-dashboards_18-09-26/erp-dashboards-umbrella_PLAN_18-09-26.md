---
name: plan:erp-dashboards-umbrella
description: "ERP Dashboards — umbrella/orchestration plan for the 6-phase program (Sales/Purchase/Production read-only dashboards over db_TCL)"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: umbrella
---

# ERP Dashboards — Umbrella Plan

**Date:** 18-09-26
**Complexity:** COMPLEX
**Status:** ⏳ PLANNED

- Program type: PHASE PROGRAM (6 phases: P0 prerequisites → P1 ERP read foundation → P2/P3/P4
  dashboards in parallel → P5 hardening/export/rollout)
- Feature folder: `process/features/erp-dashboards/`
- SPEC (frozen, governs every phase): `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
- Approved proposal (architecture source of record): `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-proposal_REF_18-09-26.md`
- Supporting REFs: `erp-data-dictionary_REF_18-09-26.md`, `erp-domain-discovery_REF_18-09-26.md`,
  `erp-master-data_REF_18-09-26.md`, `erp-table-inventory_REF_18-09-26.md`,
  `repo-research-brief_REF_18-09-26.md` (ERP sections superseded by the proposal + data dictionary —
  keep the repo-shape sections, ignore superseded ERP claims until P0 corrects them)

---

## Program Goal Charter

```
ERP Dashboards — Program Goal Charter

North star:
- Give orderstock staff and admins a read-only, honestly-labeled view of ERP sales, purchase, and
  production activity (three dashboards under a new "แดชบอร์ด" nav group) without ever risking the
  live shared ERP database (db_TCL) staff use for daily accounting.

Definition of done (an unattended agent must be able to do all of these):
1. Load /dashboards/sales, /dashboards/purchase, /dashboards/production — each renders KPI tiles,
   a bar chart, and a sortable/paged document table, all URL-filter-driven, all mobile-card on
   phone width, all gated by requireAuth() with money columns server-hidden for STAFF.
2. Every ERP read goes through one guarded read-only choke point (assertReadOnlySql denylist +
   compile-time no-write-method type guard + boot permission probe) — never through Prisma,
   never through $queryRaw, never against the app's own orderstock DB pool.
3. Every dashboard degrades gracefully (last-cached value + "ข้อมูลอาจไม่ล่าสุด" banner) when the
   ERP connection is down, and always shows the "ข้อมูลนำร่อง" pilot banner.
4. An Admin (STAFF money-column-stripped) can export any dashboard's current filtered view to a
   UTF-8-BOM CSV with Thai headers and Buddhist-era dates.
5. All 18 SPEC acceptance criteria (AC1–AC18) are provably met — 17 Fully-Automated/Hybrid, 1
   Agent-Probe (the live read-only-login boot probe, AC18) — with the boot probe passing against
   the real (eventually provisioned) scoped read-only ERP login before any dashboard goes live for
   real customer use.

What "verified" means (program level):
- Every phase's validate-contract gates plus regression evidence recorded (a phase without a
  validate-contract, or a documented skip reason, cannot be marked VERIFIED).
- The `assertReadOnlySql` guard's ~24 ported test cases are green.
- The ERP fixture database (in the local sandbox container, a SEPARATE database from the
  `orderstock` Prisma sandbox DB — recommend `erp_fixture`) backs every automated/hybrid gate;
  no phase gate depends on live db_TCL access except the boot-probe agent-probe row.
- A manual read-only live-reconcile pass against KRS's own report procs is completed and recorded
  before any dashboard is declared ready for real customer rollout (P5).
- Money-visibility server-side gating (AC9) is proven on every screen AND every export — never a
  client-side hide.

Scope tiers → phase mapping:
- Tier 1 (prerequisites/safety) → Phase 0.
- Tier 2 (shared ERP read infrastructure — guard, pool, cache, degrade path, shared data-table
  component) → Phase 1.
- Tier 3 (per-domain dashboards) → Phases 2, 3, 4 (parallel after Phase 1).
- Tier 4 (money-gate audit, CSV export, regression, live reconcile, production rollout) → Phase 5.
- This program retires Tiers 1-4.

Explicitly out of scope (deferred tier, Tier 5):
- Writing/editing/deleting any ERP data — strictly read-only, forever, in this program.
- `.xlsx` native Excel export — CSV only in this program; `.xlsx` deferred to a future phase.
- A 4th phone bottom-tab-bar entry — dashboards are sidebar/drawer-only on tablet+desktop.
- A production "percent achieved" figure — no genuine actual-production measurement exists in the
  ERP schema (confirmed by the residual BatchMRP/BatchPJBal/BatchLot finding); never invent one.
- Migrating the Sales basis off delivery documents — the switch mechanism
  (`resolveSalesBasis()`/AppSetting) is built, but the actual switch to SO/Invoice basis does not
  happen in this program.
- An automated, continuously-running ERP reconciliation job — manual, human-run reconciliation only.
- Any change to orderstock's own order-entry/print/schema surfaces — this program only reads a
  separate ERP system; it never touches `prisma/schema.prisma`'s existing order-system models.

Hard safety constraints (non-negotiable, per phase):
- NEVER run `prisma migrate reset`, `migrate dev`, or `db push` against db_TCL. Any schema/login/DDL
  change to db_TCL is a hand-authored delivery script for the customer's DBA to run — never
  executed by an agent, ever, in this program.
- NEVER re-run `db/create-database-and-login.sql` (or any equivalent existing delivery script)
  against the live db_TCL server.
- NEVER alter `COMPATIBILITY_LEVEL` on db_TCL.
- NEVER use the `sa` login, or the app's existing full-access `orderstock_app` login, to back the
  ERP read pool in production. Production ERP reads MUST use a dedicated, provisioned, scoped
  read-only login (e.g. `orderstock_dash`, `db_datareader` or `GRANT SELECT`-only) — going live to
  real customer use is HARD-GATED on that login existing and passing the boot permission probe.
  Until then, all development and testing runs against a local ERP-shaped FIXTURE database in the
  sandbox container, never against db_TCL directly, except the manual reconcile/probe steps
  explicitly scoped to read-only checks.
- NEVER add ERP tables to `prisma/schema.prisma` or route ERP reads through the Prisma
  `PrismaClient`/`$queryRaw` — the ERP read layer is a SEPARATE `mssql` `ConnectionPool`
  (`src/lib/erp/*`), its own env var, its own raw-read URL resolver (mirroring the `$`-in-password
  dotenv-expand gotcha fix in `resolve-database-url.ts`), and its own `globalThis` dev-hot-reload
  singleton guard.
- NEVER let a dashboard, filter, drill-down, or export execute a write/update/delete/DDL statement
  against the ERP — every ERP query passes through the single `guardedQuery` choke point with the
  `assertReadOnlySql` tokenizer/denylist and a compile-time no-write-method type guard.
- NEVER show a Staff-role user a money figure/column/chart-series anywhere (screen or export) — the
  gate is server-side (`canSeeMoney = role === 'ADMIN'`), never a client-side visual hide.
- NEVER substitute a planned/copy-of-plan figure for a genuine "actual" measurement (Production) —
  show the explicit "ยังไม่มีข้อมูลผลิตจริง" empty state instead.
- NEVER silently drop a real, larger ERP number a customer could independently check (Sales basis
  exclusion) — disclose it via the required reconciliation footnote.
- NEVER sum quantities across different `InventoryItem.MainUnits` (35 distinct units) into one
  number — aggregate strictly per-unit or per-product.
- NEVER add a 4th tab to `bottom-tab-bar.tsx` — `e2e/mobile.spec.ts` asserts exactly 3 tabs; this
  assertion must not regress.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context
  commits separate from execution commits.
```

---

## Stable Program Goal (copy-paste this to start autonomous execution)

```
SESSION GOAL: erp-dashboards — ERP Dashboards Program
Ref: process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md

TARGET: Complete P0-P5 until:
- All 18 SPEC ACs (erp-dashboards_SPEC_18-09-26.md) provably met with recorded evidence
- assertReadOnlySql guard tests green (~24 cases); ERP fixture DB backs all automated/hybrid gates
- money-visibility gate proven server-side on every screen + export
- Test tiers: automated (iterate-until-green) / hybrid (fix-if-in-blast-radius) / agent-probe
  (record-judgment; AC18 boot-probe requires the real scoped read-only login before go-live)

AUTONOMY: Before ANY subagent spawn, read:
1. Umbrella ## Current Execution State -> loop step + validate-contract status
2. Phase plan ## Phase Loop Progress -> first unchecked box = next subagent to spawn
3. phase-blast-radius-registry.md -> confirm no cross-phase file collision before touching a shared file

PER-PHASE LOOP (7-step inner loop R -> I -> P -> PVL -> E -> EVL -> UP, SKIPS SPEC — the SPEC above
governs every phase, no inner phase writes its own SPEC):
  1. RESEARCH -> 2. INNOVATE -> 3. PLAN-SUPPLEMENT -> 4. PVL -> 5. EXECUTE -> 6. EVL -> 7. UPDATE-PROCESS
- PVL NEVER skipped; contract follows example-validate-output.md full format; partial contract =
  blocked same as placeholder
- Every subagent FIRST ACTION: vc-context-discovery (incl. process/context/tests/all-tests.md
  routing chain) + vc-plan-discovery
- Every phase-END: invoke vc-agent-strategy-compare for next-step strategy

HARD STOPS (pause, wait for user):
- Any DDL/DML/login change proposed against db_TCL — always a delivery script for the DBA, never
  agent-executed
- `sa` or `orderstock_app` login proposed for the production ERP pool
- Real production go-live before the scoped read-only ERP login + boot probe pass
- Net gate = BLOCKED with no backlog resolution path

SAFETY (never override):
- ERP reads only through src/lib/erp/*'s single guardedQuery choke point; never Prisma/$queryRaw
  for ERP tables; never add ERP models to prisma/schema.prisma
- Never sum quantities across different MainUnits; never show a Production achievement-%; never
  hide the Sales-basis reconciliation footnote
- Money columns hidden server-side for STAFF, on screen and in every export, never client-side only
- Never add a 4th bottom-tab-bar entry
- Commit each phase before advancing; process and execution commits separate

TEST GATES (every phase exit):
  node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs
  node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs
  pnpm test (Vitest — unit/guard/fixture gates)
  pnpm test:e2e (Playwright — nav/auth/filter/export/drilldown gates, incl. mobile project)

VALIDATE CONTRACT: Per-phase contracts written by vc-validate-agent into each phase plan before EXECUTE.

START: Phase 0, loop step RESEARCH (pending). Spawn vc-research-agent for Phase 0
(process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_PLAN_18-09-26.md).
```

---

## Phase Ordering

| Phase | Plan file | Scope summary | Depends on |
|---|---|---|---|
| 0 — Prerequisites | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_PLAN_18-09-26.md` | Clear ~15-commit prod deploy backlog (user-run on host); prepare `db/create-erp-readonly-login.sql` delivery script for the DBA (never run by an agent); write the KRS/customer question list; correct stale ERP-shaped-clone claims in `database/all-database.md`/`tests/all-tests.md`; confirm fixture-DB plan | — |
| 1 — ERP Read Foundation | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_PLAN_18-09-26.md` | Port `src/lib/erp/*` (guardedQuery/assertReadOnlySql/pool/env resolver), ERP-fixture DB (`erp_fixture`) + DDL/seed, short-TTL cache wrapper, `/api/health/erp`, ERP-down degrade path + "ข้อมูลอาจไม่ล่าสุด" banner, shared responsive data-table component, nav "แดชบอร์ด" group (all 3 links), guard test port (~24 cases) | Phase 0 |
| 2 — Sales Dashboard | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_PLAN_18-09-26.md` | `/dashboards/sales`: DO/DOdtl basis via `resolveSalesBasis()`, count/qty-per-unit KPIs, priced-only THB + coverage % + reconciliation footnote, product/customer breakdowns + drilldown, DO list -> DO lines tables, ONE Recharts spike (adopt or fall back to CSS bars) | Phase 1 |
| 3 — Purchase Dashboard | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_PLAN_18-09-26.md` | `/dashboards/purchase`: dual-basis totals (PurchaseInvoiceHdr KRS-rule + PurchaseOrderHdr committed), derived PO status w/ "unvalidated" badge (`ISNULL(IsClosed,0)`), received/outstanding per `sp_Popending` logic, supplier breakdown + drilldown, PO list -> PO lines tables | Phase 1 |
| 4 — Production Dashboard | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_PLAN_18-09-26.md` | `/dashboards/production`: plan-only MO list (LotQty/PlanQty/Prodqty), explicit "ยังไม่มีข้อมูลผลิตจริง" empty state (no achievement-%), MO status, raw-material-issue drilldown (InventoryFlowDtl.MONo), MO list -> raw-material-issue tables | Phase 1 |
| 5 — Hardening, Export & Rollout | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_PLAN_18-09-26.md` | Money-gate audit across all 3 dashboards + exports, CSV export (UTF-8 BOM, Thai headers, BE dates, STAFF money-stripped, row cap, requireAuth() + auth-guard-coverage entries), full regression suite, manual live-reconcile-vs-KRS-procs script, AC18 boot-probe against the real scoped login, production rollout readiness | Phases 2, 3, 4 |

### Join Conditions

- Phase 1 MUST NOT start until Phase 0 exit gate passes.
- Phases 2, 3, and 4 MUST NOT start until Phase 1 exit gate passes; they run in PARALLEL (disjoint
  blast radii — see `phase-blast-radius-registry.md`).
- Phase 5 MUST NOT start until Phases 2, 3, AND 4 exit gates all pass.

---

## Per-Phase Entry / Exit Gates

| Phase | Entry | Exit gate |
|---|---|---|
| 0 | Program start | Prod deploy backlog cleared or explicitly deferred with owner noted; `db/create-erp-readonly-login.sql` delivery script written (not run); KRS/customer question list written; stale ERP-clone claims corrected in context docs; fixture-DB approach confirmed in a phase report |
| 1 | Phase 0 complete | `guardedQuery`/`assertReadOnlySql` guard + ~24 ported test cases green against `erp_fixture`; boot permission probe (mock/fixture mode) refuses a write-capable login; `/api/health/erp` live; cache wrapper + degrade banner proven (mock-down scenario); nav group renders all 3 links, 3-tab phone bar unchanged; shared data-table component renders sort+paginate on a fixture dataset |
| 2 | Phase 1 exit met | AC1, AC2 (unauthenticated `/dashboards/sales` redirects to login), AC3, AC4, AC9 (Sales), AC10-AC13 (Sales) green against `erp_fixture`; Recharts spike recorded pass/fail with a documented adopt-or-fallback decision |
| 3 | Phase 1 exit met | AC1, AC5, AC6, AC9 (Purchase), AC10-AC13 (Purchase) green against `erp_fixture` |
| 4 | Phase 1 exit met | AC1, AC7, AC8, AC9 (Production), AC10-AC13 (Production) green against `erp_fixture` |
| 5 | Phases 2+3+4 exits met | AC9 (full cross-dashboard money audit), AC14 (CSV export all 3), AC15, AC16, AC17 green; AC2 confirmed for `/dashboards/purchase` and `/dashboards/production` specifically (Phase 2 already proved AC2 for `/dashboards/sales` — see Phase 2's report; Phase 5's Step 0 reads that report and adds the unauth-redirect e2e assertion ONLY for the Purchase and Production routes, not re-deriving Sales); full regression suite green; manual live-reconcile record written; AC18 boot-probe recorded (fixture-mode always; live-mode pending real login — documented known-gap if login not yet provisioned) |

---

## Per-Phase Loop

Each phase executes the canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP`. This inner
loop SKIPS SPEC — the umbrella SPEC (`erp-dashboards_SPEC_18-09-26.md`) governs every phase; no
inner phase writes its own SPEC. Phase-level scope gaps vs. the SPEC are recorded in that phase's
report under its own `## SPEC Gaps` heading, never by editing the frozen SPEC.

1. **RESEARCH** — spawn research-agent: load context, read prior phase reports, check plan drift,
   read the approved proposal + data dictionary sections relevant to this phase, document findings.
   Phase 5's RESEARCH step MUST explicitly read Phase 2's report to confirm whether AC2 was already
   proven for `/dashboards/sales` (it was — see Phase 2's exit gate above) before assuming AC2
   coverage is uniformly unconfirmed across all three dashboards.
2. **INNOVATE** — spawn innovate-agent: decide approach; write Decision Summary (chosen approach +
   rejected alternatives) — e.g. Phase 2's Recharts-vs-CSS-bars decision
3. **PLAN-SUPPLEMENT** — spawn plan-agent: if research/innovate found gaps/pre-conditions not in
   the checklist, add them; otherwise mark "n/a — research clean" and tick step 3
4. **PVL** — spawn vc-validate-agent: full V1-V7; validate-contract written per
   `.claude/skills/vc-validate-findings/references/example-validate-output.md` format (Status /
   Gate / Plan updates applied / Execute-agent instructions / Test gates / High-risk pack /
   Backlog artifacts / Known gaps / Accepted by)
5. **EXECUTE** — spawn vc-execute-agent per approved plan and validate-contract
6. **EVL** — spawn vc-tester: run phase test gates to green; register follow-up stubs; write EVL
   HANDOFF SUMMARY
7. **UPDATE-PROCESS** — write phase report to durable report path, rewrite umbrella
   `## Current Execution State` section (overwrite, not append — git history is the audit log)

**PVL is NEVER skipped.** A placeholder `## Validate Contract` = blocked. Do not spawn
execute-agent while the Validate Contract section reads "(placeholder — vc-validate-agent writes
this section before EXECUTE)".

---

## Autonomous Execution Rules (During /goal)

During /goal execution of a phase program:
- Agent self-decides at all V5 gates — no user approval needed between phases
- CONDITIONAL net gate: proceed autonomously, fixes applied in-flight, gaps on record
- BLOCKED net gate: document items in backlog, continue with remaining phase plans; backlog is
  always a valid resolution — always find a path forward
- Hard stops (must pause for user approval):
  - Any DDL/DML/login change against db_TCL, or `sa`/`orderstock_app` backing the production ERP
    pool — always deferred-and-reported, never executed autonomously
  - Real production rollout of any dashboard before the AC18 live boot-probe passes
  - Plan file explicitly marks "pause required" at a step
- Agent writes phase reports, updates phase plans, creates new sub-plans as needed — all
  autonomously
- The phase report is the communication channel for conflicts, errors, and learnings — not inline
  questions

---

## Global Constraints

- Never lower `assertReadOnlySql` guard strictness or widen its allowlist without explicit user
  approval.
- Never route an ERP read through Prisma, `$queryRaw`, or the app's existing `orderstock_app`
  Prisma pool — the ERP pool is a separate `mssql.ConnectionPool` singleton, always.
- Never add ERP tables/models to `prisma/schema.prisma`.
- After every phase that touches agent/harness files, run the parity validator and confirm exit 0
  before declaring the phase DONE.
- Money-column server-side hiding must be re-verified (not assumed unchanged) at every phase that
  adds a new screen or export surface.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context
  commits separate from execution commits.
- `InventoryItem`'s real PK is composite (`Roworder`, `ItemCode`) — `ItemCode` is NOT unique.
  Phases 2, 3, and 4 MUST have their RESEARCH step confirm and apply the highest-`Roworder`-wins
  tie-break rule before writing their per-domain fixture seed file or any real ERP query that joins
  a transactional table to `InventoryItem` by `ItemCode` — see
  `phase-blast-radius-registry.md` §Cross-Phase Precondition for the full rule and rationale.
- Advisory (recorded from Phase 4's outer PVL pass): Phase 3's own plan text for its mobile-card
  test gate references the shared Playwright `mobile` project's `testMatch`, which is known (from
  Phase 2/4's findings) to not auto-pick-up new spec files. Phase 3's own PVL/RESEARCH pass should
  re-check this at execution time and apply the same in-file `test.use({ viewport: ... })` pattern
  Phase 4 used, rather than relying on the `mobile` project. This is a forward-looking note, not an
  edit to Phase 3's plan file.

---

## Durable Report Destinations

| Phase | Report path (inside task folder) |
|---|---|
| 0 — Prerequisites | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_REPORT_18-09-26.md` |
| 1 — ERP Read Foundation | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_REPORT_22-09-26.md` (sole report; the 18-09-26 EXECUTE-time report was folded into its Appendix and deleted, 22-09-26) |
| 2 — Sales Dashboard | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_REPORT_22-09-26.md` (sole report; the 18-09-26 EXECUTE-time report was folded into its Appendix and deleted, 22-09-26) |
| 3 — Purchase Dashboard | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_REPORT_18-09-26.md` |
| 4 — Production Dashboard | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_REPORT_18-09-26.md` |
| 5 — Hardening, Export & Rollout | `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_REPORT_18-09-26.md` |

---

## Program Status Table

| Phase | Status |
|---|---|
| 0 — Prerequisites | ✅ VERIFIED (agent level; 4 USER-RUN items pending, non-blocking) |
| 1 — ERP Read Foundation | ✅ VERIFIED (agent level; 1 pre-declared known-gap, AC18 live login, owned by Phase 5, non-blocking) |
| 2 — Sales Dashboard | ✅ VERIFIED at agent level (22-09-26) |
| 3 — Purchase Dashboard | ⏳ PLANNED |
| 4 — Production Dashboard | ⏳ PLANNED |
| 5 — Hardening, Export & Rollout | ⏳ PLANNED |

Status values: ⏳ PLANNED | 🔨 CODE DONE | 🧪 TESTING | ✅ VERIFIED | 🚧 BLOCKED | ✅ COMPLETE

---

## Touchpoints

- `src/lib/erp/*` (new — guardedQuery, assertReadOnlySql, pool, env resolver, cache wrapper) — P1
- `db/erp-queries/{sales,purchase,production}/*.sql` (new, versioned SQL reviewable by KRS ERP team) — P1-P4
- `db/create-erp-readonly-login.sql` (new delivery script, never run by an agent) — P0
- `src/app/(main)/dashboards/{sales,purchase,production}/**` (new routes) — P2/P3/P4
- `src/app/nav-links.tsx` (extended — "แดชบอร์ด" nav group) — P1
- `src/components/ui/*` (reused — card.tsx, chip.tsx) and a new shared data-table component — P1
- `src/lib/__tests__/auth-guard-coverage.test.ts` (extended per-phase) — P1-P5
- `process/context/database/all-database.md`, `process/context/tests/all-tests.md` (corrections) — P0
- `process/context/all-context.md` (feature status updates) — every phase UPDATE-PROCESS
- `package.json` (Recharts add, ONLY if P2 spike passes) — P2

---

## Public Contracts

- Existing orderstock order-system routes, schema, and print surfaces are completely unchanged —
  this program only adds new `/dashboards/*` routes and reads a separate ERP connection.
- `requireAuth()`'s existing signature is unchanged; money-visibility uses an inline
  `canSeeMoney = role === 'ADMIN'` check within dashboard code, not a new auth primitive.
- The phone bottom-tab-bar's existing 3-tab contract (`e2e/mobile.spec.ts`) is unchanged — no 4th tab.
- `prisma/schema.prisma`'s existing models are unchanged — no ERP tables added to Prisma.

---

## Blast Radius

Files directly modified or created across the program (see `phase-blast-radius-registry.md` for
the authoritative per-phase ownership split):

- New: `src/lib/erp/*`, `db/erp-queries/**/*.sql`, `db/create-erp-readonly-login.sql`,
  `src/app/(main)/dashboards/**`, a new shared responsive data-table component, CSV export route
  handler(s), ERP fixture DDL/seed files, ~24 ported guard test cases, dashboard-specific Vitest +
  Playwright specs
- Extended: `src/app/nav-links.tsx`, `src/lib/__tests__/auth-guard-coverage.test.ts`,
  `process/context/database/all-database.md`, `process/context/tests/all-tests.md`,
  `process/context/all-context.md`, `package.json` (conditionally, P2 only)

---

## Verification Evidence

```bash
node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md
# Expected: PASS (0 failures)

node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs
# Expected: exit 0

node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs
# Expected: exit 0
```

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
- Last completed phase: Phase 2 — Sales Dashboard (✅ VERIFIED at agent level, 22-09-26)
- Validate-contract status: Phases 0, 1, 2 PASS (inner-pvl); Phases 3-5 PASS (outer-pvl, pending
  their own inner-loop passes)
- Next step for a fresh agent: read this umbrella plan, read Phase 2's report
  (`phase-02-sales-dashboard_REPORT_22-09-26.md`), then read `phase-03-purchase-dashboard_PLAN_18-09-26.md`
  and `phase-04-production-dashboard_PLAN_18-09-26.md` and run each phase's own RESEARCH subagent
  (may parallelize — disjoint blast radii per the registry).
- Current phase: Phase 3 — Purchase Dashboard AND Phase 4 — Production Dashboard (RESEARCH, Step 1,
  not started for either)
- Next action: spawn vc-research-agent for Phase 3 and/or Phase 4
- Execute-agent start instruction: read this file, read the target phase's plan, run the RESEARCH
  subagent first — do not spawn execute-agent until PVL (step 4) is green.

---

## Current Execution State

Last updated: 22-09-26
Current phase: 2 of 6 complete (Phase 0 ✅ VERIFIED, Phase 1 ✅ VERIFIED, Phase 2 ✅ VERIFIED;
  program advancing to Phases 3/4, which may run in parallel per the join conditions — both are
  disjoint from Phase 2's blast radius and from each other)
Phase 2 name: Sales Dashboard
Phase 2 status: ✅ VERIFIED at agent level — all inner-loop steps 1–7 complete. Inner-PVL Gate:
  PASS (22-09-26, `generated-by: inner-pvl: phase-2`). `/dashboards/sales` is built: DO/DOdtl basis
  via `resolveSalesBasis()`, count/qty-per-unit KPIs, priced-only THB + coverage % + reconciliation
  footnote, product/customer drilldown, hand-rolled CSS/SVG charts (donut+pie+bars — `recharts`
  never adopted). EVL ran 2 cycles: Cycle 1 was env-blocked (11/17 gates skipped, no
  `ERP_DATABASE_URL` in that session) but found and fixed a real defect — a cold-cache ERP failure
  was 500ing instead of showing the Thai unavailable state (`sales-unavailable.tsx`, new, within
  Phase 2's owned paths). Cycle 2 (this session, env configured against local `erp_fixture`) is
  `all_pass: true`, `gates_green: true` — every gate independently re-confirmed with real fixture
  data (10,111.00 บาท reconciliation match, 19.4% coverage, 858,937.21 บาท excluded pool). db_TCL
  was never contacted; zero schema change. Known-gaps (non-blocking, owned elsewhere): duplicate-
  `ItemCode` tie-break proof against a real duplicate row (routed to Phase 1 as PLAN-SUPPLEMENT
  P1-SUPP-1), a human's visual UX sign-off. See `phase-02-sales-dashboard_REPORT_22-09-26.md` for
  full detail (supersedes the EXECUTE-time `..._REPORT_18-09-26.md`, now deleted, as the closeout
  record — folded into that report's Appendix). Also this session: the duplicate Phase 1 report
  (`..._REPORT_18-09-26.md` vs `..._REPORT_22-09-26.md`) was consolidated — the 18-09-26 file is
  deleted, its unique step detail folded into the 22-09-26 report's Appendix, and all cross-file
  references updated. **Nothing from Phase 2 is committed yet** — the report's Closeout Packet
  recommends an execution commit (source/test/fixture files) followed by a separate process commit
  (this UPDATE PROCESS session's plan/report/registry/context artifacts), per the umbrella
  charter's commit-hygiene hard constraint. Phase 1's own execution commit is ALSO still
  outstanding from the prior phase closeout — both remain to be made by the user/vc-git-manager.
Phase 2 EVL: PASS (`all_pass: true`) after 1 in-flight fix cycle — unit 23 files/282 passed/1 todo,
  e2e 17 passed (16 sales scenarios + `[setup]`), lint clean, build exit 0, agent-parity clean;
  orchestrator-run 22-09-26.
Phase 2 report: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_REPORT_22-09-26.md`
Next phase: Phase 3 (Purchase Dashboard) and Phase 4 (Production Dashboard), each starting their
  own loop step RESEARCH (Step 1) — spawn vc-research-agent against
  `phase-03-purchase-dashboard_PLAN_18-09-26.md` and `phase-04-production-dashboard_PLAN_18-09-26.md`
  respectively. Both may run in parallel by separate agents/teammates per the registry's
  Parallel-Safety Statement (disjoint blast radii from each other and from Phase 2). All continue
  against the local `erp_fixture` sandbox database; real production go-live remains gated on the
  scoped read-only ERP login (AC18) — owned by Phase 5, not a blocker for Phases 3/4.

Validate-contracts written for all phases (outer PVL pass, 18-09-26; Phases 0, 1, and 2
additionally re-validated via inner-PVL, superseding their outer-pvl contracts):
| Phase | Gate |
|---|---|
| phase-00-prerequisites | PASS (inner-pvl: phase-0, supersedes outer-pvl) |
| phase-01-erp-read-foundation | PASS (inner-pvl: phase-1, supersedes outer-pvl) |
| phase-02-sales-dashboard | PASS (inner-pvl: phase-2, supersedes outer-pvl) |
| phase-03-purchase-dashboard | PASS (outer-pvl) |
| phase-04-production-dashboard | PASS (outer-pvl) |
| phase-05-hardening-export-rollout | PASS (outer-pvl) |

Program Net Gate: PASS — Phases 0, 1, and 2 fully closed (RIPEV+UP complete, all ✅ VERIFIED).
  Phases 3/4's outer-pvl contracts remain current pending their own inner-loop RESEARCH/INNOVATE
  passes, which may each trigger inner-PVL re-validation per the Inner Loop Refresh Note mechanism.
Latest validator run: 22-09-26 — `validate-context-discovery.mjs`, `validate-plan-inventory.mjs`,
  and `validate-agent-parity.mjs` all re-run at this UPDATE PROCESS step for Phase 2's closeout
  (see the phase report's Closeout Packet / this UPDATE PROCESS session's audit results for exact
  exit codes).

Loop step values: RESEARCH | INNOVATE | PLAN-SUPPLEMENT | PVL | EXECUTE | EVL | UPDATE-PROCESS
Orchestrator rule: read each phase plan's own "## Phase Loop Progress" checkboxes before spawning
any subagent. Never spawn execute-agent for a phase whose Validate Contract is still a placeholder
or reads BLOCKED. Next action: spawn vc-research-agent for Phase 3 and Phase 4 (may parallelize) —
Step 1 of each phase's own inner loop.

Note: The Stable Program Goal above is fixed. This section is the only part that changes —
update-process-agent rewrites it after every phase closeout (overwrite, not append — git history
is the audit log).

---

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
