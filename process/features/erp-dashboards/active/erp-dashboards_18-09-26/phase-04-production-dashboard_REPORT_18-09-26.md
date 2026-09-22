---
name: report:erp-dashboards-phase-04-production-dashboard
description: "ERP Dashboards — Phase 4 EXECUTE+EVL+closeout report: plan-only Production dashboard, MO status donut, raw-material-issue drilldown, EVL confirmed all-green"
phase: phase-04
date: 2026-09-22
status: COMPLETE
feature: erp-dashboards
plan: process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_PLAN_18-09-26.md
metadata:
  node_type: memory
  type: report
  feature: erp-dashboards
  phase: phase-04
---

# Phase 4 — Production Dashboard — EXECUTE report

**TL;DR** `/dashboards/production` ships plan-only: KPI tiles (MO count, planned quantity **per
unit**, MOs with material issues), a per-product planned-quantity bar chart, an MO status **donut**
with a visible small-sample note, and an MO list whose "ผลิตจริง" column renders the literal
`ยังไม่มีข้อมูลผลิตจริง` on every row and drills into that MO's raw-material issues at a
bookmarkable nested route. **No achievement % anywhere. No money anywhere.** All automated gates
green: `pnpm test` 406/406, `pnpm test:e2e` 93 passed (17 new Production gates), lint + build clean,
both harness validators clean. Not committed (a git agent owns that).

## What Was Done

| Step | Outcome |
|---|---|
| A1–A2 | `src/lib/production-status.ts` — pure `deriveMoStatus()` (cancel → closed → approved → pending, `ISNULL(IsClosed,0)` semantics), `plannedQuantity()` (LotQty, Prodqty fallback), `plannedQtyByUnit()` (never sums across units). TDD: gate written first. |
| A3–A4 | `db/erp-queries/production/mo-list.sql` + `material-issues.sql` — single-statement SELECT/WITH, named params only, no locking hint (E6), highest-`Roworder`-wins `InventoryItem` tie-break, `LTRIM(RTRIM(...))` on both sides of the `MONo` match. |
| A5 | `src/lib/production-sql.ts` (embedded byte-identical copies + `PRODUCTION_SQL_SOURCES`) and `src/lib/production-data.ts` (`getProductionMoList` / `getMaterialIssuesForMo`, both through `guardedQuery` + Phase 1 TTL cache, both returning plain objects for Phase 5's export). |
| Fixture | `db/erp-fixture/production-seed.sql` — self-provisions `tbl_MoHdr` / `tbl_BatchOrder` / `InventoryFlowHdr` / `InventoryFlowDtl`, seeds 12 MOs (11 live + 1 cancelled) and 10 ledger detail rows. Idempotent, LOCAL sandbox only. |
| B1–B3 | Three gates: `production-status-derivation` (26), `production-plan-only-empty-state` (10), `production-material-issue-drilldown` (7). |
| C1–C9 | `page.tsx`, `production-filter-bar.tsx`, `production-kpi-tiles.tsx`, `production-plan-chart.tsx`, `production-status-donut.tsx`, `mo-list-table.tsx`, `production-unavailable.tsx`, `[moNumber]/page.tsx`, `production-url.ts`. |
| D1 | `e2e/dashboards-production.spec.ts` — 17 gates incl. the in-file `test.use({viewport})` mobile override (no `playwright.config.ts` edit). |
| D4 | Full regression green (below). |

### Decision Summary (restated verbatim per execute-agent instruction E3)

- **Chosen: nested route** `dashboards/production/[moNumber]/page.tsx` — bookmarkable URL,
  consistent with AC10/AC11 + the existing `/orders/[id]` precedent.
- **Rejected: in-page expand/collapse** — loses bookmarkability.
- **Chart tech (E4): CSS bars**, reusing `src/lib/sales-chart-scale.ts`'s `computeBarScale`
  px-scale helper. Never percentage sizing (Phase 2's proven zero-height-bar defect).
  `package.json` and the lockfile are byte-unchanged.

### Honesty guarantees (AC7), and how each is enforced

1. **Structural** — `ActualProducedCell` in `mo-list-table.tsx` takes **zero props**. No numeric
   value exists anywhere in its call path, so it cannot regress into printing `Prodqty`.
2. **Data shape** — `mo-list.sql` never returns `Prodqty` as its own column; it appears only inside
   `COALESCE(m.LotQty, m.Prodqty, 0) AS PlannedQty`. A gate asserts no returned field name matches
   `/actual|percent|pct|achiev/`.
3. **Module surface** — a gate asserts `production-status.ts` exports nothing percentage-shaped.
4. **Rendered page** — an e2e gate strips the single disclaimer sentence and then asserts the whole
   body text contains no `NN%` and no "ความสำเร็จ".

### Money (AC9 input for Phase 5)

Production has **no money figure in scope at all** — no THB on planned-quantity or material-issue
data — so this dashboard has **no `canSeeMoney` gate by design**. Verified: the server-rendered HTML
for both ADMIN and STAFF contains no `฿` / `บาท` / `THB`. Phase 5's cross-dashboard money audit must
read "no money gate found" on Production as **correct**, not a bug.

## Test Gate Outcomes

| Gate | Result |
|---|---|
| `pnpm test production-status-derivation` | PASS — 26 tests |
| `pnpm test production-plan-only-empty-state` | PASS — 10 tests |
| `pnpm test production-material-issue-drilldown` | PASS — 7 tests |
| `pnpm test` (full regression) | PASS — 406 passed, 1 todo, 30 files (was 363/27) |
| `pnpm test:e2e -- e2e/dashboards-production.spec.ts` | PASS — 17 Production gates; whole suite 93 passed, 7 skipped, 0 failed |
| `pnpm lint` | PASS — clean |
| `pnpm build` | PASS — `/dashboards/production` and `/dashboards/production/[moNumber]` both ƒ (dynamic) |
| Agent-Probe: visual check desktop + mobile | PASS — screenshots at 1440×1000, 390×844 and the drilldown; bars and donut arcs have real geometry, `scrollWidth - clientWidth = 0` at every width |
| `validate-agent-parity.mjs` | PASS — 0 failures (1 pre-existing unrelated warning) |
| `validate-context-discovery.mjs` | PASS — 0 failures, 0 warnings |
| `validate-plan-artifact.mjs` (E5) | PASS — 0 failures (3 pre-existing legacy-shape warnings) |

All gates ran against the **local `erp_fixture` sandbox** with inline `ERP_DATABASE_URL` +
`ERP_ALLOW_WRITE_CAPABLE_LOGIN=1`. `.env` was never read or edited. db_TCL was never contacted.

## Plan Deviations

| # | Deviation | Why | Class |
|---|---|---|---|
| 1 | Pure logic + data layer live at `src/lib/production-{status,sql,data}.ts`, not inside `src/app/(main)/dashboards/production/`. | The run's owned-paths list names `src/lib/production-*.ts`; the gate filenames import `../production-status`; Phase 2 put `sales-basis-core.ts` / `sales-queries.ts` in `src/lib` for the same reason. Exported function names are unchanged, so Phase 5's contract holds. | within-blast-radius |
| 2 | No separate `production-mobile.tsx`. | Phase 1's `DashboardDataTable` already renders the `md:hidden` card list from the same `rows` array (Phase 2 took the same path — it has no `sales-mobile.tsx`). A second component would duplicate data with no behavioural gain. AC13 is proven against `dashboard-data-cards`. | within-blast-radius |
| 3 | Added `src/lib/production-sql.ts` (not in the plan's Touchpoints). | Required by the repo's standalone-bundle constraint — `db/` is not in the production image, so SQL must be embedded. A drift gate keeps it byte-identical to the `.sql` files. Same pattern the run's task mandates ("mirrored byte-identically into a TS constants module"). | within-blast-radius |
| 4 | No สัปดาห์/เดือน/ปี period toggle on the filter bar. | The approved mockup's production tab has no such control, and Production has no time-series chart for a granularity to govern — a toggle that changed nothing would read as a bug. Date range + status filter as per the mockup. | documented default-taken |
| 5 | **Steps D2 and D3 not performed** — `src/lib/__tests__/auth-guard-coverage.test.ts` and `process/context/all-context.md` untouched. | The run's task explicitly lists both as DO-NOT-EDIT, reserved for the combined closeout agent that runs after both parallel phases. | task override of plan |
| 6 | `material-issues.sql` reads the unit from `InventoryItem.MainUnits`, not a per-line `InventoryFlowDtl.Unit`. | The real-data extract shows per-line units (`ml`, `หลา`) that suggest a detail-level column, but no reference document confirms `InventoryFlowDtl.Unit` exists in db_TCL. Querying an unverified column would break against the live DB. Followed the plan's own SQL. | within-blast-radius |
| 7 | `mo-list.sql` extends the plan's sample with the date/status filters, the `InventoryItem` join and an issue-line count sub-select. | All three are explicitly required by the plan's own Scope/Data bullets (filters, unit grouping, "MOs with material issues" KPI); the sample in the plan text was the status-CASE core only. | within-blast-radius |

## Test Infra Gaps Found

- The `mobile` Playwright project's `testMatch` still does not pick up this spec — handled with the
  in-file `test.use({ viewport })` override exactly as Phase 2's PVL resolved. No shared-config edit.
- `pnpm test:e2e -- <file>` does **not** scope the run: pnpm swallows the `--` and Playwright runs
  the whole suite. Harmless (the whole suite is green and the named gates are visibly reported), but
  the gate command in the validate-contract is effectively "run everything". Worth normalising to
  `pnpm exec playwright test <file>` in a future phase.

## Known Gaps (carried forward, per the validate-contract)

1. **Status-precedence confidence is LOW.** Only 2 of the 4 branches have ever been exercised by
   real data (n=3 MOs: 2 รออนุมัติ, 1 อนุมัติแล้ว, all `IsClosed = 0`, none cancelled). The gates
   prove the CASE logic mechanically, **not** the real-world distribution. Shipped as the
   best-available derivation, not a validated enum. Do not upgrade this confidence without new
   evidence. The `ISNULL(IsClosed,0)` wrapper is a **defensive precaution borrowed from
   `tbl_PurchaseOrderHdr`**, not a confirmed `tbl_MoHdr` fact.
2. **No FG-receipt-into-stock signal exists** (data dictionary §65: 0 of 218 `InventoryFlowHdr` rows
   are an FG-from-production receipt). Deliberately not built. Not a bug.
3. **AC18 live boot-probe** against the real scoped read-only login is Phase 5's, not this phase's.

## Backlog Items Surfaced

- "แสดงใบสั่งผลิตที่ยกเลิก" toggle — cancelled MOs are filtered out entirely today.
- Reusable Vitest helper for "no numeric value in a designated empty-state cell" (the AC7 pattern).
- Phase 1's `PilotBanner` chip wraps awkwardly at 390px (pre-existing, affects Sales identically) —
  Phase 1/5 owned, not touched here.

## EVL Results (independent confirmation run, 22-09-26)

One independent EVL confirmation cycle was run against this phase, re-executing every gate in
Verification Evidence rather than trusting EXECUTE's own report:

| Gate | Result |
|---|---|
| AC7-status — `pnpm test production-status-derivation` | PASS — 26/26 |
| AC7-empty-state — `pnpm test production-plan-only-empty-state` (Hybrid, real `erp_fixture` rows) | PASS — 10/10 |
| AC8-drilldown — `pnpm test production-material-issue-drilldown` (Hybrid) | PASS — 7/7 |
| AC1/AC10/AC11/AC12/AC13 — `pnpm test:e2e -- e2e/dashboards-production.spec.ts` | PASS — all 17 Production gates; full suite 93 passed / 7 skipped / 0 failed |
| AC7-visual-quality — Agent-Probe manual check (1440px, 390px, drilldown, served build + `e2e/.auth/admin.json`) | PASS — no achievement %, real bar/donut geometry, mobile card list + tab bar, drilldown clean |
| harness-parity — `validate-agent-parity.mjs` | PASS — 0 failures |
| harness-context — `validate-context-discovery.mjs` | PASS — 0 failures, 0 warnings |
| full unit suite — `pnpm test` | PASS — 406 passed / 1 todo / 30 files, 0 failures |
| `pnpm lint` | PASS |
| `pnpm build` | PASS — both Production routes present |

**`gates_green: true` — every gate passed on the first independent EVL cycle.** No fix cycle was
needed. This is the one clean confirmation across the whole combined closeout (contrast with Phase
3's env-blocked Hybrid gates) — Production's Hybrid tests reached the fixture successfully in this
tester session.

## SPEC Achievement

Scored against `erp-dashboards_SPEC_18-09-26.md`'s acceptance criteria, Production-owned subset:

| Criterion | Status | Note |
|---|---|---|
| AC1 (Production share of nav reachability) | **met** | Nav group is Phase-1-owned; Production route exists at the wired path and is reachable — proven at EVL. |
| AC7 (planned quantity shown, no achievement %) | **met** | Structural + data-shape + module-surface + rendered-page guarantees, all independently re-confirmed at EVL (see "Honesty guarantees" above). |
| AC8 (material-issue drilldown) | **met** | `production-material-issue-drilldown.test.ts` (Hybrid) + e2e drilldown gate, both re-confirmed at EVL. |
| AC9 (money gating) | **N/A — met by design** | Production carries no money figure in scope at all; the server-rendered HTML for both roles contains no `฿`/`บาท`/`THB`. Phase 5's cross-dashboard money audit must read this as correct, not a gap. |
| AC10 (filter/URL roundtrip, Production) | **met** | e2e gate, EVL-confirmed. |
| AC11 (drilldown navigation, Production) | **met** | e2e gate, EVL-confirmed. |
| AC12 (sort/paginate, Production) | **met** | e2e gate, EVL-confirmed. |
| AC13 (mobile card view, Production) | **met** | e2e gate, EVL-confirmed (reuses Phase 1's `DashboardDataTable` card view, no separate mobile component). |

**Unmet:** none for this phase's owned criteria. AC14–AC18 are explicitly Phase 5's scope.

## USER-RUN Items

None required to close this phase — every gate reached the local `erp_fixture` sandbox
successfully in the EVL confirmation session and passed. The only forward-looking manual items
belong to Phase 5, not this phase:

1. (Phase 5 scope, not blocking) AC18 live boot-probe confirming the scoped read-only ERP login
   cannot write, against real `db_TCL`.
2. (Phase 5 scope, not blocking) Real-world confirmation of the MO status distribution once more
   live data accumulates — the current fixture only exercises 2 of 4 `derivePoStatus`-style
   branches (see Known Gaps #1).

## Closeout Packet

- **Selected plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_PLAN_18-09-26.md`
- **Finished:** Steps A–D of the Implementation Checklist (D2/D3 completed by the combined
  closeout agent, 22-09-26); Phase Loop Progress Steps 1–7 all ticked.
- **Verified:** every Fully-Automated gate + the Agent-Probe visual gate + the full e2e regression,
  all independently re-confirmed at EVL against `erp_fixture` with zero fix cycles needed.
- **Unverified:** real-world MO status distribution (only 2 of 4 branches exercised by current
  fixture volume); behaviour against live `db_TCL` data volumes; AC18 live boot-probe — all
  explicitly Phase 5 scope, not this phase's gap.
- **Remaining:** none outstanding for this phase — D2 (auth-guard coverage append), D3
  (`all-context.md` status line), the registry ledger append, and the umbrella `## Current
  Execution State` rewrite are all done by this combined closeout pass. Commit remains with the
  git agent.
- **Classification:** `Keep in active/testing` — this phase's own gates are fully green with no
  known-gap of its own, but the umbrella program (Phase 5) is not yet complete, so the phase plan
  stays in `active/` alongside its siblings until the whole program closes.
- **Next:** proceed to Phase 5 (hardening, CSV export, money-gate audit, full regression, manual
  live-reconcile, AC18 boot-probe, production rollout readiness) — see the umbrella's `## Current
  Execution State` for the exact next step.

## Forward Preview

### Test Infra Found
Vitest 3.2.6 + Playwright 1.61.1, unchanged. Unit suite now **406 tests / 30 files**; e2e now
**93 passing** (7 skipped). ERP gates self-skip loudly when `ERP_DATABASE_URL` is unset.

### Blast Radius Changes
Added, all new files: `src/app/(main)/dashboards/production/**` (9 files incl. `[moNumber]/page.tsx`),
`src/lib/production-{status,sql,data}.ts`, `src/lib/__tests__/production-*.{test.ts,ts}` (4),
`db/erp-queries/production/*.sql` (2), `db/erp-fixture/production-seed.sql`,
`e2e/dashboards-production.spec.ts`. Zero files outside this phase's owned paths were modified.

### Commands to Stay Green
```
SA=$(docker exec orderstock-sql printenv MSSQL_SA_PASSWORD)
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=${SA};encrypt=true;trustServerCertificate=true"
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1
docker cp db/erp-fixture/production-seed.sql orderstock-sql:/tmp/ && \
  docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -i /tmp/production-seed.sql'
pnpm test && pnpm lint && pnpm build && pnpm test:e2e
```

### Dependency Changes
**None.** `package.json` and the lockfile are byte-unchanged.
