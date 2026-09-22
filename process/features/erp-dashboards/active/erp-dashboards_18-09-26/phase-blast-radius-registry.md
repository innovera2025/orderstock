---
name: plan:erp-dashboards-blast-radius-registry
description: "ERP Dashboards — per-phase owned paths and shared-file touch rules; proves P2/P3/P4 blast radii are disjoint for parallel execution"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: registry
---

# ERP Dashboards — Phase Blast-Radius Registry

Append-only. Each phase's section is appended by that phase's agent (or by plan-agent during
kickoff, for the initial claim). Never overwrite another phase's section — only append new
sections or amend your OWN section.

Purpose: prove Phases 2, 3, and 4 (Sales / Purchase / Production dashboards) have DISJOINT blast
radii so they can run in parallel, and give every phase an explicit, unambiguous touch rule for
every file more than one phase must edit.

---

## Phase 0 — Prerequisites

**Owned paths** (only Phase 0 creates/edits these):
- `db/create-erp-readonly-login.sql` (new delivery script for the DBA — never run by any agent,
  ever, at any phase)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-questions_REF_18-09-26.md`
  (new — customer/KRS ERP-team question list)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_REPORT_18-09-26.md`
- Any correction commits to the ~15-commit-behind prod deploy backlog (user-run on host; Phase 0
  only documents/coordinates, does not itself deploy)

**Shared files Phase 0 touches (with explicit rule):**
- `process/context/database/all-database.md` — Phase 0 corrects the stale "ERP-shaped clone"
  claim near line ~411 and any downstream guidance built on it. No later phase re-edits this
  correction; later phases may ADD new database/all-database.md content for their own ERP
  read-layer patterns (P1) but must not re-touch Phase 0's correction lines.
- `process/context/tests/all-tests.md` — Phase 0 corrects the stale claim near line ~161. Later
  phases (P1+) may APPEND new testing-convention entries for ERP fixture/guard tests but must not
  re-edit Phase 0's correction.
- `process/context/all-context.md` — Phase 0 adds the initial "erp-dashboards" feature-folder
  entry to the Current Features table. Every later phase's UPDATE-PROCESS step appends/updates its
  own status line in that same entry (see Phase 1-5 sections below) rather than replacing Phase 0's
  initial entry.

---

## Phase 1 — ERP Read Foundation

status: DONE (22-09-26 — EXECUTE complete, all owned paths created/edited as listed; no file outside this section was touched; EVL confirmation run PASS same date, `gates_green: true`, no fix cycle; phase ✅ VERIFIED at agent level)

**Owned paths** (only Phase 1 creates/edits these — later phases IMPORT, never edit):
- `src/lib/erp/erp-adapter.ts` (guardedQuery choke point, assertReadOnlySql tokenizer/denylist,
  compile-time no-write-method type guard, boot permission probe)
- `src/lib/erp/pool.ts` (or equivalent — the separate `mssql.ConnectionPool` singleton +
  `globalThis` dev-hot-reload guard)
- `src/lib/erp/resolve-erp-database-url.ts` (raw-read env resolver, mirrors
  `src/lib/resolve-database-url.ts`'s `$`-in-password fix)
- `src/lib/erp/cache.ts` (short-TTL cache wrapper, ~5 min)
- `src/lib/erp/degrade.ts` or equivalent (last-cached-value + "ข้อมูลอาจไม่ล่าสุด" banner logic)
- `src/app/api/health/erp/route.ts` (new, separate from `/api/health`)
- `src/lib/__tests__/erp-adapter.test.ts` (or equivalent) — the ~24 ported
  `assertReadOnlySql` guard test cases
- `src/components/dashboard-data-table.tsx` (or equivalent name) — the ONE shared responsive
  data-table component (server-rendered, URL-driven sort+paginate, mobile card view) reused
  read-only by P2/P3/P4 and extended for CSV export support in P5
- `db/erp-fixture/*.sql` EXCLUDING the per-domain seed files listed below — the shared/base
  ERP-shaped fixture DDL and any shared/cross-domain seed rows (e.g. shared master lookups,
  common reference data), targeting a SEPARATE sandbox database (recommended name
  `erp_fixture`, distinct from the Prisma `orderstock` sandbox DB). **This is Phase 1's owned
  BASE file only.** Per-domain fixture data lives in separate, phase-owned seed files — see the
  "Per-Domain Fixture Seed Split" rule below. Phase 1 never edits a per-domain seed file itself;
  if Phase 1 needs to change shared/base DDL that a domain seed depends on, it documents the
  change in its own report and the domain phase re-checks compatibility at its next PLAN-SUPPLEMENT
  step — Phase 1 does not reach into a domain seed file to "fix it up."
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_REPORT_18-09-26.md`

**Per-Domain Fixture Seed Split (resolves the Phase-1-vs-P2/P3/P4 fixture-ownership ambiguity):**

The Phase 1 fixture directory is split into ONE shared/base file (owned by Phase 1, above) plus
THREE per-domain seed files, each owned exclusively by its matching dashboard phase:

- `db/erp-fixture/sales-seed.sql` — owned exclusively by **Phase 2**
- `db/erp-fixture/purchase-seed.sql` — owned exclusively by **Phase 3**
- `db/erp-fixture/production-seed.sql` — owned exclusively by **Phase 4**

Rules (apply uniformly to Phases 2, 3, and 4 — no phase has a different rule from the others):
1. A domain phase (2/3/4) creates and edits ONLY its own seed file. It never edits Phase 1's base
   file, and never edits another domain phase's seed file.
2. If a domain phase discovers it needs a NEW shared/base fixture table, column, or cross-domain
   row (not specific to its own domain) that does not yet exist in Phase 1's base file, it does
   NOT edit Phase 1's file directly. It routes the request back to Phase 1 via a PLAN-SUPPLEMENT
   (documents the gap in its own phase report; Phase 1's plan is supplemented and Phase 1 applies
   the change in its own next pass) — the exact pattern Phase 4's Dependencies section already
   uses for fixture gaps. This same PLAN-SUPPLEMENT-only pattern is now the uniform rule for
   Phase 2 and Phase 3 as well: neither phase has license to append rows directly into Phase 1's
   base seed file, regardless of any earlier phase-plan wording to the contrary.
3. Phase 1 is only responsible for the shared/base file; it is never blocked waiting on a
   domain-specific seed decision from Phase 2/3/4.

**Shared files Phase 1 touches (with explicit rule):**
- `src/app/nav-links.tsx` — Phase 1 adds the ENTIRE "แดชบอร์ด" nav group with all 3 links (Sales,
  Purchase, Production) in one pass. Phases 2/3/4 do NOT edit this file — their routes just need
  to exist at the paths Phase 1 already wired. If a phase discovers its route path must change, it
  documents the gap in its phase report and Phase 1's owned entry is amended via a follow-up
  PLAN-SUPPLEMENT to Phase 1, never edited directly by P2/P3/P4.
- `src/lib/__tests__/auth-guard-coverage.test.ts` — Phase 1 adds its own new routes
  (`/api/health/erp` and any P1-only pages, if any). Each LATER phase (2, 3, 4, 5) appends ONLY
  its own routes to this file in its own edit — never removes or reorders another phase's entries.
- `process/context/database/all-database.md` / `process/context/tests/all-tests.md` — Phase 1 may
  APPEND new ERP-read-layer / ERP-fixture-testing sections; must not re-edit Phase 0's correction
  lines (see Phase 0 section above).
- `process/context/all-context.md` — Phase 1 updates the erp-dashboards feature entry's status
  line to reflect Phase 1 complete; does not touch Phase 0's original entry structure.

---

## Cross-Phase Precondition — InventoryItem Roworder Tie-Break (applies to Phases 2, 3, 4)

`InventoryItem`'s real primary key is composite (`Roworder`, `ItemCode`) — `ItemCode` is NOT
unique (~85 codes / 172 rows duplicated; see `erp-domain-discovery_REF_18-09-26.md` lines
878/904 and Phase 1's plan known-gap note, line ~914). Chosen tie-break: **highest `Roworder`
wins**.

Before Phase 2, 3, or 4 write their own `db/erp-fixture/{sales,purchase,production}-seed.sql` file
or any real `db/erp-queries/*.sql` that joins a transactional table to `InventoryItem` by
`ItemCode`, that phase's RESEARCH step (Step 1 of the 7-step inner loop) MUST explicitly confirm
and apply the highest-`Roworder`-wins tie-break rule (e.g. `ROW_NUMBER() OVER (PARTITION BY
ItemCode ORDER BY Roworder DESC)` or equivalent) — never assume `ItemCode` is unique. This is a
forward-guidance precondition from Phase 1, elevated here to a uniform cross-phase rule so no
domain phase can skip it. Record the confirmation (or the tie-break query pattern applied) in that
phase's own report.

---

## Phase 2 — Sales Dashboard

**Owned paths** (exclusively Phase 2 — DISJOINT from Phase 3 and Phase 4):
- `src/app/(main)/dashboards/sales/**` (page.tsx, KPI tiles, chart, breakdown tables, DO list / DO
  line drilldown tables, all Sales-only components)
- `src/lib/sales-basis.ts` or equivalent (`resolveSalesBasis()` AppSetting-backed helper — Sales-
  only; does not touch Purchase/Production logic)
- `db/erp-queries/sales/*.sql`
- `db/erp-fixture/sales-seed.sql` — Phase 2's own per-domain fixture seed additions (see
  "Per-Domain Fixture Seed Split" in the Phase 1 section above). Phase 2 never edits Phase 1's
  base fixture file or Phase 3/4's seed files. Any needed shared/base fixture change is routed
  back to Phase 1 via PLAN-SUPPLEMENT, never applied directly.
- `src/lib/__tests__/sales-*.test.ts` (or equivalent) — sales-basis-reconciliation,
  sales-money-coverage-footnote fixture tests
- `e2e/dashboards-sales.spec.ts` (or equivalent) — Sales-specific e2e gates (AC3, AC4, plus Sales'
  share of AC1/AC9/AC10-AC13)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_REPORT_18-09-26.md`

**Recharts spike (Phase 2 only):**
- `package.json` — ONLY Phase 2 may add `recharts` as a dependency, and only if its INNOVATE-step
  spike (peer-dep compatibility with React 19.2, bundle-size check) passes. If the spike fails,
  Phase 2 reverts the `package.json` change and falls back to hand-rolled CSS bars (matching
  `/summary`'s existing pattern) — Phase 2 records the pass/fail decision in its phase report.
  Phases 3 and 4 do NOT add or remove the `recharts` dependency; they independently decide
  (per their own INNOVATE step) whether to adopt it (if Phase 2's spike passed) or use CSS bars,
  but they never edit `package.json` for this decision — that edit belongs to Phase 2 only.

**Shared files Phase 2 touches (with explicit rule):**
- `src/lib/__tests__/auth-guard-coverage.test.ts` — Phase 2 appends ONLY its own Sales routes.
- `process/context/all-context.md` — Phase 2 updates its own status line in the erp-dashboards
  feature entry.

**Explicit non-overlap with Phase 3 / Phase 4:** Phase 2 never edits any file under
`src/app/(main)/dashboards/purchase/**` or `src/app/(main)/dashboards/production/**`, any
`db/erp-queries/purchase/*` or `db/erp-queries/production/*` file, `db/erp-fixture/purchase-seed.sql`
or `db/erp-fixture/production-seed.sql`, Phase 1's `db/erp-fixture/*.sql` base file, or any
Purchase/Production-named test/spec file. (Phase 5 has one narrow named exception to edit Phase
2's own `dashboards/sales/page.tsx` for export-trigger prop wiring only — see Phase 5's section.)

---

## Phase 3 — Purchase Dashboard

**Owned paths** (exclusively Phase 3 — DISJOINT from Phase 2 and Phase 4):
- `src/app/(main)/dashboards/purchase/**` (page.tsx, dual-basis KPI tiles, PO-status derivation,
  received/outstanding logic, supplier breakdown, PO list / PO line drilldown tables)
- `db/erp-queries/purchase/*.sql`
- `db/erp-fixture/purchase-seed.sql` — Phase 3's own per-domain fixture seed additions (see
  "Per-Domain Fixture Seed Split" in the Phase 1 section above). Phase 3 never edits Phase 1's
  base fixture file or Phase 2/4's seed files directly — this is the SAME rule as Phase 2 and
  Phase 4 (no phase has a different, more permissive rule). Any needed shared/base fixture change
  is routed back to Phase 1 via PLAN-SUPPLEMENT, never applied directly, and never appended
  straight into Phase 1's base seed file regardless of how the change originates.
- `src/lib/__tests__/purchase-*.test.ts` (or equivalent) — purchase-dual-basis-reconciliation,
  purchase-status-flag-edge-cases fixture tests
- `e2e/dashboards-purchase.spec.ts` (or equivalent) — Purchase-specific e2e gates (AC5, AC6, plus
  Purchase's share of AC1/AC9/AC10-AC13)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_REPORT_18-09-26.md`

**Shared files Phase 3 touches (with explicit rule):**
- `src/lib/__tests__/auth-guard-coverage.test.ts` — Phase 3 appends ONLY its own Purchase routes.
- `process/context/all-context.md` — Phase 3 updates its own status line in the erp-dashboards
  feature entry.

**Explicit non-overlap with Phase 2 / Phase 4:** Phase 3 never edits any file under
`src/app/(main)/dashboards/sales/**` or `src/app/(main)/dashboards/production/**`, any
`db/erp-queries/sales/*` or `db/erp-queries/production/*` file, `db/erp-fixture/sales-seed.sql` or
`db/erp-fixture/production-seed.sql`, Phase 1's `db/erp-fixture/*.sql` base file, `package.json`
(no dependency decisions belong to Phase 3), or any Sales/Production-named test/spec file. (Phase 5
has one narrow named exception to edit Phase 3's own `dashboards/purchase/page.tsx` for
export-trigger prop wiring only — see Phase 5's section.)

---

## Phase 4 — Production Dashboard

**Owned paths** (exclusively Phase 4 — DISJOINT from Phase 2 and Phase 3):
- `src/app/(main)/dashboards/production/**` (page.tsx, plan-only MO list, explicit
  "ยังไม่มีข้อมูลผลิตจริง" empty state, MO status, raw-material-issue drilldown)
- `db/erp-queries/production/*.sql`
- `db/erp-fixture/production-seed.sql` — Phase 4's own per-domain fixture seed additions (see
  "Per-Domain Fixture Seed Split" in the Phase 1 section above; this is the pattern the other two
  domain phases now explicitly mirror). Phase 4 never edits Phase 1's base fixture file or
  Phase 2/3's seed files. Any needed shared/base fixture change is routed back to Phase 1 via
  PLAN-SUPPLEMENT, never applied directly.
- `src/lib/__tests__/production-*.test.ts` (or equivalent) — production-plan-only-empty-state,
  production-material-issue-drilldown fixture tests
- `e2e/dashboards-production.spec.ts` (or equivalent) — Production-specific e2e gates (AC7, AC8,
  plus Production's share of AC1/AC9/AC10-AC13)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_REPORT_18-09-26.md`

**Shared files Phase 4 touches (with explicit rule):**
- `src/lib/__tests__/auth-guard-coverage.test.ts` — Phase 4 appends ONLY its own Production routes.
- `process/context/all-context.md` — Phase 4 updates its own status line in the erp-dashboards
  feature entry.

**Explicit non-overlap with Phase 2 / Phase 3:** Phase 4 never edits any file under
`src/app/(main)/dashboards/sales/**` or `src/app/(main)/dashboards/purchase/**`, any
`db/erp-queries/sales/*` or `db/erp-queries/purchase/*` file, `db/erp-fixture/sales-seed.sql` or
`db/erp-fixture/purchase-seed.sql`, Phase 1's `db/erp-fixture/*.sql` base file, `package.json`, or
any Sales/Purchase-named test/spec file. (Phase 5 has one narrow named exception to edit Phase 4's
own `dashboards/production/page.tsx` for export-trigger prop wiring only — see Phase 5's section.)

---

## Parallel-Safety Statement (P2 / P3 / P4)

Phases 2, 3, and 4 own fully disjoint file sets: separate route subtrees
(`dashboards/{sales,purchase,production}`), separate `db/erp-queries/{sales,purchase,production}`
folders, separate per-domain fixture seed files (`db/erp-fixture/{sales,purchase,production}-seed.sql`
— see "Per-Domain Fixture Seed Split" in the Phase 1 section), separate fixture-test files, and
separate e2e spec files. Their ONLY shared-file intersection is
`src/lib/__tests__/auth-guard-coverage.test.ts` and `process/context/all-context.md`, and both have
an explicit append-only rule ("append ONLY your own routes / status line") that removes any write
conflict — three agents can append to the same file in any order without semantic collision as long
as each only adds its own lines. This is the basis for the umbrella plan's "P2/P3/P4 may run in
parallel after P1" join condition.

---

## Phase 5 — Hardening, Export & Rollout

**Owned paths** (only Phase 5 creates/edits these):
- `src/app/api/dashboards/export/**` or equivalent CSV export route handler(s) (UTF-8 BOM, Thai
  headers, Buddhist-era dates, STAFF money-column-stripped, row cap)
- `src/lib/erp/live-reconcile-script.ts` (or a `.sql`/`.ts` script) — the manual, human-run
  reconcile-vs-KRS-report-procs check
- `src/lib/__tests__/dashboards-money-audit.test.ts` (or equivalent) — the cross-dashboard
  money-gate audit (AC9, all 3 dashboards + exports)
- `e2e/dashboards-export.spec.ts`, `e2e/dashboards-degraded-mode.spec.ts` (or equivalent) —
  AC14/AC15/AC16/AC17/AC18 cross-cutting gates
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_REPORT_18-09-26.md`

**Shared files Phase 5 touches (with explicit rule):**
- `src/components/dashboard-data-table.tsx` (Phase 1's owned component) — Phase 5 EXTENDS it
  additively (adds export-trigger wiring) rather than rewriting Phase 1's sort/paginate logic; any
  behavior change to existing sort/paginate must be flagged as a regression risk in Phase 5's
  research step and regression-checked against Phases 2/3/4's existing usage.
- `src/app/(main)/dashboards/{sales,purchase,production}/page.tsx` (owned by Phases 2/3/4) —
  **narrow named exception**: Phase 5 MAY add ONLY the export-trigger call-site prop wiring (the
  single prop/call passing each page's current filtered view into the CSV export route) to these
  three files, without needing a PLAN-SUPPLEMENT back to Phase 2/3/4. Phase 5's own RESEARCH Step 0
  MUST first confirm whether Phase 2/3/4 already left a stub call site (checked per-phase report);
  if so, no edit is needed at all. Phase 5 may NOT touch any other logic in these files — any other
  change (KPI/query/table logic) is out of scope and must route back to the owning phase.
- `src/lib/__tests__/auth-guard-coverage.test.ts` — Phase 5 appends its own export-route entries
  (does not touch P1-P4's entries).
- `process/context/all-context.md` — Phase 5 writes the program-complete status line and moves
  the umbrella program's status forward.

**Explicit non-overlap:** Phase 5 does not edit Sales/Purchase/Production dashboard PAGE files
directly for new features — it only adds the export route(s) that read those pages' existing data
functions, and it only ADDS new audit/regression test files. Any bug found in a dashboard's own
logic during Phase 5's audit is routed back as a PLAN-SUPPLEMENT to that dashboard's own phase
(2, 3, or 4), never fixed inline by Phase 5 editing that phase's owned files.

---

## Status Ledger

Per orchestration.md §BLOCKED Escalation Path — valid `status:` values below are `BLOCKED-skipped
/ DONE / SUPERSEDED / (no field)`. `status: BLOCKED` alone is a legacy read-compatibility alias
only; always write `status: BLOCKED-skipped` for new entries.

| Phase | status |
|---|---|
| Phase 0 | DONE — all owned paths touched exactly as claimed; no shared-file collision; 12/12 EVL gates PASS (18-09-26) |
| Phase 1 | DONE — all owned paths touched exactly as claimed; no shared-file collision; EVL confirmation PASS, `gates_green: true`, no fix cycle (22-09-26); ✅ VERIFIED at agent level |
| Phase 2 | (no field — not started) |
| Phase 3 | (no field — not started) |
| Phase 4 | (no field — not started) |
| Phase 5 | (no field — not started) |
