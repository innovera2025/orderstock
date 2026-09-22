---
phase: phase-02-sales-dashboard
date: 2026-09-22
status: COMPLETE
feature: erp-dashboards
plan: process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_PLAN_18-09-26.md
---

# Phase 2 — Sales Dashboard — UPDATE PROCESS Closeout Report

**TL;DR** — Phase 2 is **✅ VERIFIED at agent level**. `/dashboards/sales` is built; the EVL
confirmation loop ran TWO cycles. Cycle 1 (env-blocked: `ERP_DATABASE_URL` unavailable in that
sandboxed session) surfaced a real product defect — a cold-cache ERP failure threw through
`page.tsx` into Next's generic error page instead of the approved mockup's Thai empty state — which
was fixed in-flight (`sales-unavailable.tsx`, new). Cycle 2 (this session, run with
`ERP_DATABASE_URL` + `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` against the local `erp_fixture`) is
**`all_pass: true`** — all 17 gates green, `gates_green: true`, no further fix needed. Money figures
(10,111.00 บาท, 19.4% coverage, 858,937.21 บาท excluded) were independently re-derived against the
live fixture, not just re-asserted from execute-agent's own claim. Charting decision: hand-rolled
CSS/SVG shipped; `recharts` was never installed. Zero schema change, db_TCL never contacted, nothing
committed yet. This report supersedes and REPLACES the EXECUTE-time report
(`phase-02-sales-dashboard_REPORT_18-09-26.md`), which has been deleted; its full per-step detail is
folded in below as an Appendix.

---

## What Was Done

- **Sales basis + SQL layer**: `sales-basis-core.ts` (pure transforms — basis decision, per-unit
  quantity sums, coverage %, period bins, reconciliation-note text), `sales-basis.ts` (thin
  `AppSetting` read wrapper, mirrors `app-settings.ts`'s untested-wrapper precedent),
  `sales-queries.ts` (ERP read layer, every read through Phase 1's `guardedQuery`), `sales-sql.ts`
  (SQL embedded as byte-identity-gated constants — see Deviation 1 in the Appendix),
  5 new `db/erp-queries/sales/*.sql` files, and `db/erp-fixture/sales-seed.sql` (Phase 2's
  exclusively-owned fixture file, idempotent, all 8 fixture requirements satisfied).
- **Page + KPIs + filters**: `page.tsx` (`requireAuth()`, `force-dynamic`, server-computed
  `canSeeMoney`), `sales-kpi-tiles.tsx` (count/qty-per-unit tiles + ADMIN-only money tile with
  coverage meter + reconciliation footnote as one inseparable unit), `sales-filter-bar.tsx`
  (single `method="get"` form + dismissible chips, per Defaults Taken).
- **Charts**: `sales-chart.tsx` (DO-count + ADMIN money bars, one shared bin set), 
  `sales-period-toggle.tsx` (สัปดาห์/เดือน/ปี, default เดือน), `sales-slice-chart.tsx` (new shared
  SVG arc renderer) powering `sales-status-donut.tsx` (donut + centre total) and
  `sales-category-pie.tsx` (full pie) — matching the reviewed mockup exactly.
- **Breakdown + drilldown**: `sales-breakdown-tables.tsx` (by product / by customer, unit-split, no
  cross-unit total), `do-list-table.tsx` / `do-lines-table.tsx` (Phase 1's shared
  `DashboardDataTable`), `sales-url.ts` (URL state machine for sort/paginate/filter).
- **Tests**: `sales-basis-reconciliation.test.ts`, `sales-money-coverage-footnote.test.ts`,
  `sales-fixture-expected.ts` (shared constants), `e2e/dashboards-sales.spec.ts` (16 scenarios,
  later +2 resilience gates — see Appendix Fix Cycle 1).
- **Resilience fix (EVL Fix Cycle 1)**: `sales-unavailable.tsx` (new) + a `try/catch` in `page.tsx`
  around the ERP read — a cold-cache ERP failure now renders the Thai unavailable state instead of
  a 500. Full detail in the Appendix.
- **This session (UPDATE PROCESS)**: ran the independent EVL confirmation (2 cycles), wrote this
  closeout report, ticked Phase Loop Progress Steps 6–7, rewrote the umbrella's `## Current
  Execution State`, appended Phase 2's status to the blast-radius registry ledger, updated context
  docs, consolidated the duplicate Phase 1 report, ran the Tier-1 audits.

## What Was Skipped/Deferred

- **Recharts spike** — not attempted; hand-rolled CSS/SVG delivered every chart form the mockup
  needs (Defaults Taken #5). Not a gap — an accepted, documented outcome.
- **CSV export route** — Phase 5's job. This phase shipped only the column-shape convention
  (`csvLabel`/`csvValue` pairs + `DO_LIST_CSV_COLUMNS`/`DO_LINES_CSV_COLUMNS`).
- **Duplicate-`ItemCode` fixture proof** — pre-declared Known-Gap D. The tie-break SQL
  (`ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC)`) is implemented and grepped
  for, but not proven against a real duplicate row (needs a Phase-1-owned fixture change) →
  routed as PLAN-SUPPLEMENT P1-SUPP-1 (see Appendix Follow-Up Stubs).
- **`tbl_ItemGroup`/`tbl_CATEGORY` join** — not needed; `InventoryItem.ItemGRP` direct per INNOVATE
  decision. Pre-declared Known-Gap, unchanged.
- **`"so"`/`"invoice"` basis branches** — explicitly out of SPEC scope; recorded as `it.todo`.
- **Product/category rollup via a real `tbl_ItemGroup` join** and **on-site visual UX sign-off** —
  both remain open per the EVL HANDOFF SUMMARY; neither blocks ✅ VERIFIED (both are pre-declared
  Known-Gaps / manual-confirmation residuals, not code defects).

No new follow-up plan stubs were created this session beyond the two already routed to Phase 1
during EXECUTE (P1-SUPP-1, P1-SUPP-2 — see Appendix).

## Test Gate Outcomes

Two EVL cycles were run this program. **Cycle 2 is the authoritative, final result.**

### EVL Cycle 1 (env-blocked — orchestrator-run, this session, before ERP_DATABASE_URL was available)

| Gate | Result |
|---|---|
| Unit — pure/net-gate halves (`resolveSalesBasisFromValue`, `sumQuantityByUnit`) | ✅ pass |
| Hybrid AC3 (DO/DOdtl reconciliation) | ⛔ SKIPPED — no `ERP_DATABASE_URL` in this sandboxed session |
| Hybrid AC4 (coverage %/excluded total) | ⛔ SKIPPED — same cause |
| Agent-Probe AC4 wording/placement | ⛔ blocked — page 500'd without `ERP_DATABASE_URL` |
| e2e AC1/AC2/AC8/AC9/AC10/AC11/AC12/AC13 + cross-filter (10 scenarios) | ⛔ all failed — root cause confirmed as the missing env var, not a code defect |
| Recharts spike / InventoryItem tie-break (code-review-verifiable) | ✅ pass |
| Full regression (`pnpm test`/`lint`/`build`/agent-parity) | ✅ pass |
| Full e2e regression | ⛔ 15 of 78 failed, same single root cause |

11 of 17 gates could not be independently confirmed — environment/credential-access limitation, not
a code defect. **Investigation during this cycle found a real defect anyway**: the getCached
cold-cache rethrow escaping into a raw Next 500 (see Appendix, EVL Fix Cycle 1) — fixed in-flight
even though it wasn't the reason the fixture-backed gates were skipped.

### EVL Cycle 2 (this session, with `ERP_DATABASE_URL` + `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` set against the local `erp_fixture`) — FINAL

| Gate | Result |
|---|---|
| Unit net-gates (basis decision, never-sum-across-units) | ✅ pass |
| Hybrid AC3 (DO/DOdtl reconciliation) | ✅ pass — header `TotalAmount` sum == detail `Amount` sum **exactly** = 10,111.00; 14 DOs / 31 lines; `SoNo` NULL on every row |
| Hybrid AC4 numeric (coverage %/excluded total) | ✅ pass — 6/31 = 19.4% coverage; excluded `SalesInvoiceHdr` pool = 858,937.21 over 3 `DocuType='SI'` rows, proven LARGER than the dashboard total |
| Agent-Probe AC4 wording/placement | ✅ pass — DOM inspection of a real ADMIN render confirms the footnote sits inside the money tile, names 858,937.21 explicitly with the exclusion reason |
| e2e AC1/AC2/AC8 (period-toggle)/AC9 (money role gate)/AC10 (filter URL)/AC11 (drilldown)/AC12 (sort+paginate)/AC13 (mobile card) | ✅ pass — 17 passed (16 sales scenarios + `[setup]`), 0 failed |
| Donut/pie cross-filter (3 scenarios) | ✅ pass |
| Recharts spike (Hybrid, optional) | ✅ pass — N/A by design, `package.json`/lockfile byte-unchanged |
| InventoryItem tie-break (Known-Gap D, code-review) | ✅ pass — `ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC)` confirmed present in `do-by-product.sql` |
| Product/category rollup join path (Known-Gap D) | ✅ pass — unchanged accepted known-gap, `ItemGRP` direct is sufficient |
| Full regression | ✅ pass — `pnpm test`: 23 files/282 passed/1 todo/0 skipped; `pnpm lint`: exit 0; `pnpm build`: compiled successfully, `/dashboards/sales` listed `ƒ`; `validate-agent-parity.mjs`: `failures: []` |

**Net EVL result: `gates_green: true`, `all_pass: true`.** This independent, credentialed re-run —
not execute-agent's own claim — is what promotes the phase from `🔨 CODE DONE` to **✅ VERIFIED**.

## Plan Deviations

Unchanged from EXECUTE (all three within blast radius — see Appendix for full detail), plus one
new deviation applied during EVL Fix Cycle 1:

1. Versioned SQL embedded in `sales-sql.ts`, not read from disk at runtime — production
   `output: "standalone"` doesn't ship `db/`; mitigated by a byte-identity unit gate.
2. Extra files inside owned paths beyond the plan's Touchpoints list (`sales-basis-core.ts`,
   `sales-queries.ts`, `sales-sql.ts`, `sales-url.ts`, `sales-filter-bar.tsx`,
   `sales-slice-chart.tsx`) — all within `src/app/(main)/dashboards/sales/**` / `sales-basis.ts`
   registry entries.
3. `sales-fixture-expected.ts` extracted to a non-`.test.ts` module so the shared fixture constants
   aren't re-executed as a second describe block.
4. **(New, EVL Fix Cycle 1)** `sales-unavailable.tsx` was not an explicit plan checklist item. It
   is within Phase 2's owned paths, adds no dependency, changes no contract, and serves the
   approved mockup's empty/stale-state requirement. The alternative (changing Phase 1-owned
   `cache.ts`'s deliberate rethrow) was rejected as a cross-phase edit.

## Test Infra Gaps Found

- **`ERP_DATABASE_URL` / `ERP_ALLOW_WRITE_CAPABLE_LOGIN` are not in `.env`** — required by every
  Hybrid gate in this phase and Phase 1's. → backlog NOTE: document as a standing local-dev
  precondition (not a product bug; `.env` is out of every phase's blast radius).
- **First-load ERP failure previously 500'd instead of showing the degrade banner** — FIXED this
  session (`sales-unavailable.tsx`); the fix is Phase-2-owned and does not touch Phase 1's
  `cache.ts` contract. Still worth a backlog NOTE for Phase 5 to audit the same pattern across
  Purchase/Production.
- **`pnpm test:e2e -- <spec>` does not filter** (the `--` argument is swallowed) — → backlog NOTE:
  Phases 3/4 should use `pnpm exec playwright test <spec>` for a scoped run.
- **E2E count bookkeeping discrepancy** — Phase 1's report recorded 56 e2e tests excl. `[setup]`,
  but `playwright test --list` now reports a pre-Phase-2 baseline of 61. Likely a counting-
  convention difference around cross-tier duplicate registrations. → backlog NOTE: reconcile in a
  future maintenance pass; no gate depends on it.
- **Duplicate-`ItemCode` fixture row not yet added** — routed as PLAN-SUPPLEMENT P1-SUPP-1 to
  Phase 1 (see Appendix); not resolved this session (Phase 2 may not edit Phase 1's base fixture).
- **This EVL run used `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1`** against the LOCAL `erp_fixture` sandbox
  only (never `db_TCL`) — the app's own boot-time warning documents this as needing eventual
  migration to the scoped read-only login (`db/create-erp-readonly-login.sql`); this is an existing
  Phase 1 accepted-known-gap, not a Phase 2 defect, and is a hard Phase 5 rollout gate.

## SPEC Achievement

Scored against `erp-dashboards_SPEC_18-09-26.md`'s acceptance criteria owned by this phase.

| AC | Criterion (short) | Status |
|---|---|---|
| AC1 | Nav + page load (Sales half) | **met** — e2e, both roles |
| AC2 | Unauth redirect | **met** — e2e |
| AC3 | DO/DOdtl reconciliation | **met** — Hybrid gate, exact sum match against `erp_fixture` |
| AC4 | Priced-only THB + coverage % + reconciliation footnote (numeric + wording/placement) | **met** — Hybrid numeric + Agent-Probe both pass |
| AC8 | Period toggle (สัปดาห์/เดือน/ปี, default เดือน) round-trip | **met** — e2e |
| AC9 | Money hidden server-side for STAFF (Sales) | **met** — e2e asserts absence from raw server-rendered HTML, not CSS-hidden |
| AC10 | Filter URL round-trip | **met** — e2e |
| AC11 | Product/customer drilldown | **met** — e2e, 2 scenarios |
| AC12 | Sort/paginate preserving filters | **met** — e2e |
| AC13 | Mobile card view | **met** — e2e at 390×844 |

**Recharts spike** — a time-boxed optional check per Defaults Taken #5, not a scored AC; resolved
"not adopted, hand-rolled preferred" (see Appendix Charting Decision).

**Known-Gap (declared, not scored unmet):** duplicate-`ItemCode` tie-break proof against real
duplicate rows (needs a Phase-1 fixture change, routed as PLAN-SUPPLEMENT), and the `tbl_ItemGroup`
join path (INNOVATE decision made it unnecessary). Neither is a Phase-2 miss.

**No unmet criterion within Phase 2's own scope.**

## Closeout Packet

1. **Selected plan path:**
   `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_PLAN_18-09-26.md`
2. **Closeout classification:** Program continues (inner-loop phase, not archived) — equivalent
   single-plan state: **Ready for UPDATE PROCESS archival** in every respect except that phase
   programs archive only at program completion. Phase 2 itself is **✅ VERIFIED at agent level**;
   umbrella and phase plan both stay in `active/`.
3. **What was finished:** all Implementation Checklist items (A–F), the EVL Fix Cycle 1 resilience
   fix, and both EVL confirmation cycles.
4. **Verified vs unverified:** Verified — every gate in EVL Cycle 2 (unit, both Hybrid gates,
   Agent-Probe, full e2e incl. mobile, lint, build, agent-parity), all against real `erp_fixture`
   data. Unverified — live `db_TCL` behavior (by design, Phase 5's job); duplicate-`ItemCode`
   tie-break against a real duplicate row; a human's visual sign-off of the live dashboard UX.
4b. **Validate-contract compliance:** Present — inner-pvl contract dated 22-09-26, `Gate: PASS`,
   `generated-by: inner-pvl: phase-2`, supersedes the 18-09-26 outer-pvl contract. VALIDATE was
   run, not skipped.
5. **Cleanup done vs still needed:** Done — phase report (this file, consolidated), Phase Loop
   Progress Steps 6–7 ticked, umbrella `## Current Execution State` rewritten, registry ledger
   updated, context docs updated, duplicate Phase 1 report consolidated, Tier-1 audits run. Still
   needed — nothing blocking; Phase 3 (Purchase) and Phase 4 (Production) may now run in parallel
   per the umbrella's join condition. Nothing is committed; see the Commit-Checkpoint recommendation
   below for the split.
6. **Single best next valid state:** Continue the program — spawn `vc-research-agent` for Phase 3
   (`phase-03-purchase-dashboard_PLAN_18-09-26.md`) and/or Phase 4
   (`phase-04-production-dashboard_PLAN_18-09-26.md`); their blast radii are disjoint from Phase 2
   and from each other per the registry.
7. **Commit-checkpoint recommendation:** Execution commit recommended before further phases —
   Phase 2's implementation is well-tested and EVL-confirmed green. Two commits, in order:
   - **Execution commit**: `src/app/(main)/dashboards/sales/**`, `src/lib/sales-*.ts`,
     `src/lib/__tests__/sales-*.test.ts`, `src/lib/__tests__/sales-fixture-expected.ts`, the
     `auth-guard-coverage.test.ts` append, `db/erp-queries/sales/**`, `db/erp-fixture/sales-seed.sql`,
     `e2e/dashboards-sales.spec.ts`.
   - **Process commit**: `process/features/erp-dashboards/**` (plan/report/registry/SPEC/REF files
     touched this session), `process/context/{all-context.md,tests/all-tests.md,uxui/all-uxui.md}`.
   No commit was made this session — not requested.
8. **Regression status:** Checked against Phase 0/Phase 1's owned surfaces (context-doc correction
   lines, `src/lib/erp/*`, `nav-links.tsx`) — untouched, confirmed via `git status` scope check
   against the registry. Phase 1 remains ✅ VERIFIED; no regression introduced.
9. **SPEC achievement:** see "SPEC Achievement" section above — no unmet criterion within Phase 2's
   own scope.

## Forward Preview

### Test Infra Found
Both Hybrid gates need `ERP_DATABASE_URL` → local `erp_fixture` plus
`ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` (sandbox `sa` is write-capable). `LineNo` is a reserved word in
SQL Server — use `Roworder` for the line key in fixture DDL. Use
`pnpm exec playwright test <spec>` for a scoped e2e run, not `pnpm test:e2e -- <spec>`.

### Blast Radius Changes
No registry change required — everything landed inside Phase 2's declared OWNED PATHS.
`playwright.config.ts`, `package.json`, `pnpm-lock.yaml`, `prisma/schema.prisma`, `next.config.ts`,
`Dockerfile`, `src/app/nav-links.tsx`, and every `src/lib/erp/*` file are unchanged.

### Commands to Stay Green
```bash
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox sa>;encrypt=true;trustServerCertificate=true"
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1   # LOCAL FIXTURE ONLY — never in production

pnpm test -- sales-basis-reconciliation sales-money-coverage-footnote
pnpm test && pnpm lint && pnpm build
pnpm exec playwright test e2e/dashboards-sales.spec.ts
node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs
```

### Dependency Changes
None. `package.json`/`pnpm-lock.yaml` byte-unchanged — `recharts` was never installed. Phases 3/4
should reuse `sales-slice-chart.tsx`'s pattern rather than re-running the spike.

### For Phase 3 (and 4)
Reuse Phase 2's degrade-on-cold-cache pattern (`sales-unavailable.tsx` + `try/catch` around the ERP
read in `page.tsx`) rather than letting a first-load ERP outage 500 — this is now the proven
Sales-owned reference implementation, not yet lifted to a shared component. Confirm and apply the
highest-`Roworder`-wins `InventoryItem` tie-break in your own RESEARCH step before writing any query
that joins by `ItemCode` (registry Cross-Phase Precondition, unchanged).

---

## Appendix — EXECUTE-time step detail (folded in from the deleted 18-09-26 report)

Preserved verbatim (lightly trimmed) for historical fidelity — the sections above are the
authoritative, EVL-confirmed record.

### Step-by-step build detail

- **Step A — Sales basis + SQL layer**: `sales-basis-core.ts` (pure transforms, zero DB/Prisma/ERP
  import — mirrors the `locations-core.ts` split pattern per PVL fix P5); `sales-basis.ts` (thin
  `AppSetting` wrapper, deliberately untested against a live Prisma connection per E6, matching
  `app-settings.ts`'s convention — the switch mechanism ships, `"so"`/`"invoice"` branches stay out
  of scope); `sales-queries.ts` (every read through `guardedQuery()`, every filter a named
  parameter); 5 `db/erp-queries/sales/*.sql` files, each a single `WITH … SELECT` using
  `(@p IS NULL OR col = @p)` optional-filter pattern (no string concatenation); `sales-sql.ts` (SQL
  embedded as constants, see Deviation 1); `db/erp-fixture/sales-seed.sql` (DDL + seed rows for
  `tbl_DOhdr`/`tbl_Dodtl`/`SalesInvoiceHdr`, idempotent, Phase 1's base file untouched).
- **Step B — Page shell, KPI tiles, filters**: `page.tsx` (`requireAuth()` no role arg,
  `force-dynamic`, `searchParams` as a Next 16 `Promise`, `canSeeMoney` computed once server-side,
  reads issued in parallel); `sales-kpi-tiles.tsx`; `sales-filter-bar.tsx` (one native
  `method="get"` form per INNOVATE decision, hidden inputs preserve params with no visible control,
  dismissible chips for active non-date filters).
- **Step C — Charts**: `sales-chart.tsx` (DO-count bars all users, money bars ADMIN-only, one
  shared bin set so bars can't be cut on different boundaries, each bar a link that narrows the
  range); `sales-period-toggle.tsx`; `sales-slice-chart.tsx` (new shared SVG renderer) +
  `sales-status-donut.tsx` + `sales-category-pie.tsx` (each queried with its own dimension
  excluded so a selected slice never collapses its own chart).
- **Step D — Breakdown + drilldown**: `sales-breakdown-tables.tsx` (by product/`ItemCode`, by
  customer/`CustCode`+`CustName`, unit-split rows, no cross-unit total); `do-list-table.tsx` /
  `do-lines-table.tsx` (Phase 1's shared `DashboardDataTable`); `sales-url.ts` (URL state machine).
- **Step E — Auth, mobile, shared-file appends**: appended Sales entries to
  `auth-guard-coverage.test.ts` (append-only); mobile card view automatic via the shared
  component; updated Phase 2's status line in `all-context.md`.
- **Step F — Tests**: `e2e/dashboards-sales.spec.ts` (16 tests covering every named scenario) via
  an in-file `test.use()` override for the mobile viewport (`playwright.config.ts` not edited).

### Charting Decision (the umbrella exit-gate item)

**Decision: hand-rolled CSS/SVG. `recharts` was NOT adopted and was never installed.** Per
Defaults Taken #5 the Recharts spike was a time-boxed optional check, attempted only if hand-rolled
could not deliver a needed chart form:

| Chart form the mockup needs | Hand-rolled implementation | Outcome |
|---|---|---|
| DO-count bars per period | flex + percentage-height divs, one link per bar | delivered |
| Money bars per period (ADMIN) | same component, second series | delivered |
| Delivery-status donut with centre total | SVG arc paths (outer + inner radius) + `<text>` centre | delivered |
| Product-category full pie | same SVG renderer, `pie` variant | delivered |

Because no form was missing, no install was attempted — so there is no observed peer-dependency
state to report (execute-agent instruction E4's second sanctioned outcome). `package.json` and
`pnpm-lock.yaml` are byte-unchanged. Additional reasons this was the right default: charting
libraries are client-side and would force a `"use client"` boundary on components that currently
ship zero JS; every colour is a pguard token so light/dark correctness is inherited; zero bundle
cost. **Recommendation to Phases 3/4:** reuse `sales-slice-chart.tsx`'s approach rather than
re-running the spike, unless a genuinely new chart form (stacked/dual-axis) appears.

### Fixture requirement coverage (all 8 satisfied)

| Req | Requirement | Satisfied by |
|---|---|---|
| 1 | header sum == detail sum exactly | 10,111.00 both sides |
| 2 | ≥2 distinct MainUnits | KG / BAG / LITRE / PCS / `-` (5, incl. null-unit bucket) |
| 3 | mixed priced/unpriced | 6 priced of 31 = 19.35% |
| 4 | ≥1 nonzero `SalesInvoiceHdr` `DocuType='SI'` | 3 rows, 858,937.21 |
| 5 | ≥2 distinct `CustCode` | 4 (CUS-001…004) |
| 6 | `SoNo` NULL | NULL on 100% of rows |
| 7 | ≥12 DOs for pagination | 14 → "หน้า 1 จาก 2" |
| 8 | ≥2 calendar months | 2026-08 and 2026-09 |

### EVL Fix Cycle 1 detail (22-09-26, vc-execute-agent supplement mode)

**Root cause (re-confirmed, not re-diagnosed):** all 11 env-blocked failing gates from EVL Cycle 1
share one root cause — no `ERP_DATABASE_URL`. Re-probed via the app's own resolver (structural
facts only, no value printed): `{"configured":false,"error":"ERP_DATABASE_URL is not set …"}`.
No attempt was made to read `.env` or inspect container env.

**What WAS a real code defect (and is now fixed):** every failing e2e's 500 was not only an env
symptom — Phase 1's `getCached()` deliberately re-throws when a live ERP read fails and nothing has
ever been cached (cold process after a deploy/restart, or an outage beginning before the first
successful read). That throw escaped `page.tsx` and Next rendered its generic error screen. In
production that means a db_TCL blip shows a broken English error page instead of the approved
mockup's Thai empty/stale state.

Fix (all inside Phase 2 OWNED PATHS):

| File | Change |
|---|---|
| `sales-unavailable.tsx` | NEW — same `data-testid="sales-dashboard"` root, pilot banner, Thai notice "ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้", a working filter bar, ZERO figures (zero money markup for every role) |
| `page.tsx` | ERP fetch wrapped in `try/catch`; on throw, logs the message only (never the connection string/rows) and returns `<SalesUnavailable/>`. The stale-data path is untouched — a last-known-good value still renders the full dashboard with `DegradeBanner` |
| `e2e/dashboards-sales.spec.ts` | +2 DB-independent gates: page always returns 200 with a dashboard root, never Next's error text; with ERP unreachable, the Thai notice renders, filters round-trip, no money markup exists |

Gate movement at that point: `dashboards-sales.spec.ts` went from 15 failed/2 passed to 13
failed/6 passed; full `pnpm test:e2e` from 15 failed/6 skipped/57 passed to 13 failed/6 skipped/61
passed. Recovered: AC1/AC2 nav+page-load for both roles (previously 500). **Vacuous-green warning
recorded at the time (now resolved by EVL Cycle 2):** the two new resilience gates proved only the
*unavailable* path, not AC9's money-role gate — that required the fixture-backed e2e, which EVL
Cycle 2 (this session) subsequently ran and confirmed green.

### Follow-Up Stubs Created (PLAN-SUPPLEMENT requests to Phase 1)

- **P1-SUPP-1** (duplicate-`ItemCode` fixture row): add a second `dbo.InventoryItem` row sharing an
  existing `ItemCode` with a different `Roworder`/`Description`/`ItemGRP`, so the
  highest-`Roworder`-wins tie-break can be proven against real duplicate rows. Benefits Phases 2,
  3, 4 equally.
- **P1-SUPP-2** (first-load degrade): consider serving a rendered empty state behind the degrade
  banner when the ERP is unreachable AND the cache is cold, instead of relying on each phase's own
  `try/catch`. Phase 2 already solved this locally (`sales-unavailable.tsx`); Phase 5 hardening may
  be the better owner for lifting it to a shared component.
