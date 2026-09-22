---
name: plan:erp-dashboards-phase-02-sales-dashboard
description: "ERP Dashboards — Phase 02: /dashboards/sales, DO/DOdtl basis via resolveSalesBasis(), count/qty KPIs, priced-only THB + coverage + reconciliation footnote, product/customer drilldown, Recharts spike"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: phase-02
---

# Phase 02 — Sales Dashboard

**Date**: 18-09-26
**Complexity**: COMPLEX
**Status**: ✅ VERIFIED at agent level (22-09-26)
**Program:** erp-dashboards
**Umbrella plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
**SPEC (frozen, governs this phase):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
**Blast-radius registry:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-blast-radius-registry.md` (Phase 2 section — OWNED PATHS below MUST match that section)
**Phase status:** ✅ VERIFIED at agent level (22-09-26)
**Report destination:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_REPORT_22-09-26.md`
(the EXECUTE-time report, formerly `phase-02-sales-dashboard_REPORT_18-09-26.md`, was folded into
the 22-09-26 report's Appendix and deleted at UPDATE PROCESS, 22-09-26)

---

## Overview

Phase 2 of the 6-phase `erp-dashboards` program (see umbrella plan). This phase builds the first
customer-facing dashboard — `/dashboards/sales` — on top of the shared read-only ERP layer Phase 1
delivers. It is a COMPLEX plan: multi-file new route, a new AppSetting-backed basis-resolution
helper, a new-dependency spike (Recharts), fixture-DB-backed SQL, and cross-cutting money-visibility
gating. Context: the umbrella `## Program Goal Charter`, the SPEC's Sales-relevant acceptance
criteria (AC1, AC2, AC3, AC4, AC9, AC10-AC13), and the approved proposal's Sales basis decision
(`erp-dashboards-proposal_REF_18-09-26.md`) govern this phase; this plan does not re-derive them,
only implements against them.

## Purpose

Build the first of the three domain dashboards — `/dashboards/sales` — over the read-only ERP layer
Phase 1 delivers. This is the "best data" dashboard (the only ERP transactional table with real,
arithmetically-reconciled volume: `tbl_DOhdr`/`tbl_Dodtl`, 73 delivery orders, 1,433 lines, header
total = detail total = ฿234,403 exactly) and is deliberately built first so its Recharts
adopt-or-fallback spike result can inform Phases 3 and 4. Every number this dashboard shows is
either a real, verified count/quantity or an explicitly labeled "priced-only" money figure with a
visible reconciliation footnote — the dashboard must never imply DO-basis sales are the ERP's only
or canonical sales figure, because they are not (KRS's own `sp_SalesAmount`/`sp_SalesInvoiceMonth`
report procs would return ~฿0 today; a larger ฿858,937.21 pool of `SalesInvoiceHdr` value exists and
is explicitly excluded from this dashboard's total).

---

## Entry Gate

- Phase 1 exit gate passed: `guardedQuery`/`assertReadOnlySql` guard + ~24 ported test cases green
  against `erp_fixture`; `/api/health/erp` live; cache wrapper + degrade banner proven; nav group
  renders all 3 links (Sales/Purchase/Production) with the phone bottom-tab-bar still showing
  exactly 3 tabs; shared data-table component (`src/components/dashboard-data-table.tsx` or
  equivalent — confirm actual name/path from Phase 1's report before EXECUTE) renders sort+paginate
  on a fixture dataset.
- `erp_fixture` sandbox database exists and is seeded with Sales-domain fixture rows reproducing the
  documented edge cases below (see Fixture Data Requirements).
- RESEARCH (Step 1) has re-read Phase 1's actual delivered file names/exports (`src/lib/erp/*`,
  the shared data-table component's real prop contract, `resolveSalesBasis`'s home if Phase 1 placed
  a stub) — this plan uses the NAMES Phase 1 was asked to deliver per the registry, but Phase 1's
  actual RESEARCH/EXECUTE may have renamed things; RESEARCH must confirm before EXECUTE begins.

---

## Scope

- `/dashboards/sales` page: pilot banner, KPI tiles, ONE chart (Recharts spike, adopt-or-fallback to
  CSS bars), product/category breakdown table, customer breakdown table, DO list → DO lines
  drilldown tables, URL-driven date-range (+ customer/product) filters, sort+paginate, mobile card
  view, money-column server-side gating, CSV-export readiness (export button itself is Phase 5's
  route handler — this phase wires the page to be exportable via the shared data-table component's
  existing contract, but does NOT build the export route).
- `resolveSalesBasis()` — an `AppSetting`-backed helper (mirrors `src/lib/locations.ts`/
  `src/lib/app-settings.ts`) that resolves which ERP table set backs "sales" for this dashboard.
  This phase hard-codes the DO/DOdtl basis as the only implemented resolver branch and wires the
  AppSetting key/switch mechanism so a LATER, out-of-program migration to SO/Invoice basis needs no
  redeploy — implementing the SO/Invoice branch itself is explicitly OUT OF SCOPE (SPEC "Out Of
  Scope": "Migrating the Sales dashboard's underlying basis").
- ONE Recharts spike: `pnpm add recharts` (+ `react-is` only if npm/pnpm's own peer-dep resolution
  asks for it), build ONE Thai-labeled chart (light+dark) with real fixture data, record the actual
  peer-dep resolution against React 19.2. Pass → adopt (this becomes the shipped chart; document
  the decision for Phase 3/4 to independently consider). Fail or unacceptable peer state → revert
  `package.json`, fall back to hand-rolled CSS/div bars matching `/summary`'s existing pattern.
- `db/erp-queries/sales/*.sql` — versioned, reviewable SQL for every Sales-domain read.
- Sales-specific fixture-backed unit tests + a new Playwright spec.
- **Period-granularity toggle** ("แบ่งกราฟตาม" — สัปดาห์/เดือน/ปี, default เดือน per orchestrator
  defaults-taken): ONE shared segmented control driving the bin-key (`sales-period-toggle.tsx`,
  URL-synced via a `period` searchParam) that BOTH sales charts read — the DO-count-by-period bar
  chart (all users) and the Admin-only money-by-period bar chart (money-gated, same as every other
  money surface). This is a single shared `timeBins()`/`salesBins()` pure helper in `sales-basis.ts`,
  not two independent implementations.
- **Donut/pie cross-filter semantics** (per the approved mockup, `erp-dashboards-mockup_REF_18-09-26.html`):
  the delivery-status donut (with center total) and the product/category pie are each filtered by
  every OTHER active filter (date range, customer, product) but NOT by their own dimension — i.e.
  the status donut always shows the full status distribution for the currently-filtered date range
  regardless of any `?status=` selection, so a user can still click a different status slice to
  change the selection. Clicking a slice sets its own filter param and re-renders every OTHER panel
  filtered by it.
- **CSV-export-readiness (documented convention only, no route this phase):** this phase defines its
  own column-shape convention for future CSV export (a `csvLabel`/`csvValue` pair per
  `DataTableColumn`-equivalent definition, documented inline in each breakdown/DO-list/DO-lines table
  component) rather than assuming Phase 1's shared data-table component already has export wiring —
  it does not (verified: `dashboard-data-table.tsx` has no `csv`/`filename` fields). The export ROUTE
  itself remains Phase 5's job; this phase only shapes its own column definitions so Phase 5 has a
  convention to consume.

### Out of Scope (this phase)

- Any change to `src/app/(main)/dashboards/purchase/**` or `.../production/**` — Phase 3/4 own those.
- The CSV export route handler itself, the cross-dashboard money-gate audit test, and the manual
  live-reconcile script — all Phase 5.
- Implementing the SO/Invoice `resolveSalesBasis()` branch — mechanism only, not the branch itself.
- Any edit to `src/app/nav-links.tsx`, `src/lib/erp/*` (Phase 1's owned files) — this phase IMPORTS
  them, never edits them. If Phase 1's exports are missing something this phase needs, the gap is
  recorded in this phase's report and routed as a PLAN-SUPPLEMENT to Phase 1 (never fixed inline
  here by editing Phase 1's owned files).
- Production DB / db_TCL access of any kind — every gate in this phase runs against `erp_fixture`.
  Boot-permission-probe / live-login concerns are Phase 1 + Phase 5 (AC18), not this phase.

---

## Touchpoints (exact files — create vs edit)

**CREATE:**
- `src/app/(main)/dashboards/sales/page.tsx` — server component, `requireAuth()`, `force-dynamic`
- `src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx` — presentational KPI tile row
- `src/app/(main)/dashboards/sales/sales-chart.tsx` — the Recharts-or-CSS-bars chart component
  (renders BOTH the count-by-period and, conditionally, the money-by-period series)
- `src/app/(main)/dashboards/sales/sales-period-toggle.tsx` — the shared สัปดาห์/เดือน/ปี
  period-granularity segmented control (URL-synced `period` searchParam), added per
  PLAN-SUPPLEMENT (22-09-26)
- `src/app/(main)/dashboards/sales/sales-status-donut.tsx` — delivery-status donut with center
  total (Scope section — cross-filter-but-self-unfiltered semantics)
- `src/app/(main)/dashboards/sales/sales-category-pie.tsx` — product/category pie grouped by
  `InventoryItem.ItemGRP` (INNOVATE decision, 22-09-26 — no `tbl_ItemGroup`/`tbl_CATEGORY` join)
- `src/app/(main)/dashboards/sales/sales-breakdown-tables.tsx` — product/category + customer
  breakdown tables (server-rendered, drillable)
- `src/app/(main)/dashboards/sales/[[...slug]]/` OR flat query-param drilldown — see Drilldown
  Routing Decision below; exact created files depend on that decision (resolved at PLAN, not
  deferred to EXECUTE — see decision block)
- `src/app/(main)/dashboards/sales/do-list-table.tsx` — DO list table (uses Phase 1's shared
  data-table component)
- `src/app/(main)/dashboards/sales/do-lines-table.tsx` — DO line-item drilldown table
- `src/lib/sales-basis.ts` — `resolveSalesBasis()` + the DO-basis query-building helpers
- `db/erp-queries/sales/do-headers.sql`, `db/erp-queries/sales/do-lines.sql`,
  `db/erp-queries/sales/do-by-product.sql`, `db/erp-queries/sales/do-by-customer.sql`,
  `db/erp-queries/sales/sales-invoice-excluded-total.sql` (the reconciliation-footnote query)
- `db/erp-fixture/sales-seed.sql` — Phase 2's EXCLUSIVELY-owned per-domain fixture seed file, per
  the registry's "Per-Domain Fixture Seed Split" rule (PVL fix — this file was implied by the
  Fixture Data Requirements section below but missing from this Touchpoints list; this phase
  creates ONLY this file and never appends to Phase 1's base `db/erp-fixture/*.sql` file)
- `src/lib/__tests__/sales-basis-reconciliation.test.ts`
- `src/lib/__tests__/sales-money-coverage-footnote.test.ts`
- `e2e/dashboards-sales.spec.ts`

**EDIT (own-path files created by this phase in earlier checklist steps only — no cross-phase edits):**
- none beyond the create list above; this phase does not edit any file outside its OWNED PATHS.

**IMPORT ONLY (read/consume, never edit in this phase):**
- `src/lib/erp/*` (Phase 1) — `guardedQuery`, the ERP pool, cache wrapper, degrade helper
- the shared responsive data-table component (Phase 1) — sort/paginate/mobile-card contract
- `src/lib/be-date.ts` (existing) — BE date display for filters and table cells
- `src/components/ui/card.tsx`, `src/components/ui/chip.tsx` (existing pguard primitives) — KPI
  tiles use `Card`; status/coverage badges use `Chip`
- `src/lib/auth-guard.ts` → `requireAuth()` (existing, unchanged signature; corrected path — PVL fix, was mistakenly written as `src/app/auth-guard.ts`)

**APPEND-ONLY (registry-sanctioned shared files):**
- `src/lib/__tests__/auth-guard-coverage.test.ts` — append ONLY this phase's new route entries
  (`/dashboards/sales` and any Sales-only API route this phase adds). Do not touch other phases'
  entries; do not reorder.
- `process/context/all-context.md` — append/update ONLY this phase's own status line in the
  `erp-dashboards` feature entry (per registry rule for Phase 2).

---

## Drilldown Routing Decision (resolved now, not deferred)

The SPEC requires: clicking a breakdown row (product or customer) navigates to a filtered DO list;
clicking a DO in that list navigates to its line-item detail. Two options exist:

- **Option A (chosen):** single page `/dashboards/sales`, URL-searchParam-driven state machine —
  `?view=summary|documents|lines&customer=CODE&product=CODE&doNo=DO-####-####&from=YYYY-MM-DD&to=YYYY-MM-DD`.
  All three "views" (summary, DO list, DO lines) render from the SAME `page.tsx` based on which
  params are present; no nested route segments. Matches the existing `?location=` searchParam
  precedent (`shop-location-filter`) exactly — one page, URL is the state.
- **Option B (rejected):** nested routes `/dashboards/sales/documents`, `/dashboards/sales/documents/[doNo]`.
  Rejected because it multiplies Touchpoints files for no behavioral gain and the SPEC's own Flow
  diagram describes "navigate" purely in terms of filtered views, not distinct URL trees; every
  other filter/drilldown precedent in this codebase (`shop-location-filter`, `orders` list→detail)
  uses flat query params or a numeric `[id]` segment, never a multi-level nested tree for a
  read-only report page.

**Chosen implementation:** `/dashboards/sales/page.tsx` reads `searchParams` (a `Promise<{...}>` per
Next 16 App Router convention — confirm exact shape against Phase 1's data-table component props
during RESEARCH) and conditionally renders `sales-breakdown-tables.tsx` (no `doNo`/`customer`/
`product` param), `do-list-table.tsx` (a `customer` or `product` param present, no `doNo`), or
`do-lines-table.tsx` (`doNo` param present). Filters (`from`/`to`) apply at every view level.

---

## Data / SQL Details

All queries below run through Phase 1's `guardedQuery()` choke point against **`erp_fixture`**
during PLAN/EXECUTE/PVL/EVL. Live `db_TCL` values quoted below are from RESEARCH evidence
(`erp-domain-discovery_REF_18-09-26.md`, `erp-data-dictionary_REF_18-09-26.md`) and are the EXPECTED
values the fixture dataset must reproduce — they are not queried live by this phase's own gates.

### Basis tables

- `tbl_DOhdr` (73 live rows) — columns used: `TransactionNo` (PK, join key to `tbl_Dodtl`), `DoNo`,
  `Dodate` (date filter column), `CustCode`, `CustName` (display only — **group/filter by `CustCode`,
  never `CustName`**, per the data dictionary's explicit drilldown-by-code caution), `TotalAmount`,
  `IsApproved`, `IsClosed`, `IsComplete`, `IsCheck` (status derivation — relabel as "สถานะการส่งมอบ",
  never "SO Status"), `SalesInvoiceNo` (nullable — only 3/73 rows have it; NOT used by this phase's
  totals, informational only if ever surfaced).
- `tbl_Dodtl` (1,433 live rows) — columns used: `TransactionNo` (FK to `tbl_DOhdr`), `ItemCode`
  (FK to `InventoryItem.ItemCode` — 0 orphans confirmed), `Qty`, `MainUnit` or the unit column on the
  line (confirm exact column name against `InventoryItem.MainUnits`/line-level unit during RESEARCH
  — the data dictionary references `InventoryItem.MainUnits` as the canonical per-item unit; if
  `tbl_Dodtl` carries no unit of its own, join to `InventoryItem.MainUnits` for the unit label),
  `Amount`, `Saleprice` (only 13/1,433 rows nonzero — this is the priced-lines set), `SoNo` (NULL on
  100% of rows in live data — never join on this).
- `InventoryItem` — **real PK is composite (`Roworder`, `ItemCode`) — `ItemCode` alone is NOT
  unique** (~85 codes / 172 rows duplicated in live data; registry Cross-Phase Precondition,
  `phase-blast-radius-registry.md` — PVL fix, 22-09-26 inner pass: this plan previously said
  "`ItemCode` (PK)", which is factually wrong and could mislead a query into treating `ItemCode` as
  unique). Chosen tie-break (per registry): **highest `Roworder` wins** — every query/grouping that
  joins a transactional table to `InventoryItem` by `ItemCode` (Step A2's `do-by-product.sql`, Step
  D1's category-pie grouping) must resolve to exactly one canonical row per `ItemCode` via this
  tie-break (e.g. `ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC)` or equivalent),
  never assume `ItemCode` is unique — see execute-agent instruction E5. `ItemGRP` (2-char group
  code; joins `tbl_ItemGroup.ICCode`; `'F'`=finished goods is the group most Sales lines will fall
  under, but do not filter by ItemGRP unless a fixture row proves cross-group DO lines exist —
  RESEARCH should confirm this before EXECUTE), `MainUnits` (35 distinct live values — **NEVER SUM
  quantities across different `MainUnits` values into one number; aggregate strictly per-unit or
  per-product**, per the umbrella Program Goal Charter's hard safety constraint — PVL fix, 22-09-26
  inner pass: this rule now has its own dedicated Fully-Automated gate, see Step A3(ii) and the
  Verification Evidence table's "never-sum-across-units" row).
  **INNOVATE decision (22-09-26 — smallest option consistent with the mockup):** the category pie
  ("หมวดสินค้า") is built directly from `InventoryItem.ItemGRP` + a small code-to-Thai-label map
  (e.g. `F`→"สินค้าสำเร็จรูป", `R`→"วัตถุดิบ", `P`→"งานระหว่างผลิต", default→"อื่นๆ") — matching the
  approved mockup exactly, which itself groups by a flat `itemGroup` field, never via a
  `tbl_ItemGroup`/`tbl_CATEGORY` join. This DOWNGRADES the previously-declared category-rollup
  Known-Gap to a buildable Fully-Automated item for the common case. The unconfirmed
  `tbl_Dodtl.ItemCode` → `tbl_ItemGroup`/`tbl_CATEGORY` join path is NOT needed for this phase and
  remains untraced — if a future phase needs a deeper category taxonomy than raw `ItemGRP` codes,
  that join path is still an open research item, tracked as a residual backlog note, not blocking
  this phase's `✅ VERIFIED` bar. Live `ItemGRP` value enumerability beyond the fixture's `F`/`R`/`P`
  set was not independently re-verified against production `db_TCL` by this supplement — if EXECUTE
  discovers additional live `ItemGRP` codes, extend the label map rather than falling back further.
- `SalesInvoiceHdr` (3 live rows, ฿858,937.21 total, `DocuType='SI'`) — used ONLY for the
  reconciliation-footnote query (a single `SELECT SUM(TotalAmount), COUNT(*) FROM SalesInvoiceHdr`)
  — this phase never treats these rows as part of the dashboard's own sales total.

### Reconciliation basis (AC3)

`SUM(tbl_DOhdr.TotalAmount)` MUST equal `SUM(tbl_Dodtl.Amount)` exactly (live value: ฿234,403 both
sides — the fixture dataset must reproduce this exact-match property, not just similar totals).
Both sums are computed and compared at read time (or asserted once in the fixture-backed unit test)
— if they ever diverge, surface a visible data-integrity warning rather than silently picking one.

### Coverage / footnote basis (AC4)

- Coverage % = `COUNT(tbl_Dodtl rows WHERE Amount <> 0 OR Saleprice <> 0) / COUNT(all tbl_Dodtl rows in filtered range)`.
  Live value: 13/1,433 ≈ 0.9%.
- Footnote text (Thai, exact wording to finalize during EXECUTE, meaning locked now): states that a
  larger pool of ERP sales-invoice value (the live `SalesInvoiceHdr` total, ฿858,937.21) exists and
  is **not** included in this dashboard's total, because it is not currently the basis this
  dashboard uses. Must name the excluded amount, not just say "some data is excluded."

### KPI tiles (primary = counts/quantities, not money)

- Delivery count: `COUNT(DISTINCT tbl_DOhdr.TransactionNo)` for the filtered range.
- Line count: `COUNT(tbl_Dodtl.*)` for the filtered range.
- Quantity per unit: `SUM(tbl_Dodtl.Qty) GROUP BY unit` (never a single cross-unit sum).
- Money (secondary, THB, Admin-only): `SUM(tbl_Dodtl.Amount)` (priced lines only) + coverage % + the
  reconciliation footnote, all three always shown together, never money alone.

### Date filter

`tbl_DOhdr.Dodate` is the date-range filter column (mirrors the existing `OrderSheet.date` +
`be-date.ts` BE-display convention already used elsewhere in the app). `from`/`to` searchParams are
CE `yyyy-mm-dd` (native date input convention); display uses `ceToBeDisplay()`.

### Fixture Data Requirements (`db/erp-fixture/sales-seed.sql` — Phase 2 owns BOTH the DDL and the seed rows for the Sales-domain tables)

**RESEARCH finding (22-09-26, PLAN-SUPPLEMENT):** Phase 1's fixture DB
(`db/erp-fixture/00-schema.sql` + `01-seed.sql`) contains ONLY `dbo.InventoryItem`. There is NO
`tbl_DOhdr`, `tbl_Dodtl`, `SalesInvoiceHdr`, `tbl_ItemGroup`, or `tbl_CATEGORY` table anywhere in
the fixture DB yet. This corrects the earlier assumption that Phase 2 only supplies seed ROWS —
**Phase 2's `db/erp-fixture/sales-seed.sql` MUST also contain the `CREATE TABLE` DDL for
`tbl_DOhdr`, `tbl_Dodtl`, and `SalesInvoiceHdr`** (matching the live `db_TCL` column shapes
documented in the Basis tables section above), not just `INSERT` rows into pre-existing tables.
Phase 2 owns this DDL because Phase 1 never created it — this is a same-file addition (DDL +
seed rows both live in `sales-seed.sql`), not a cross-phase edit, and does not touch Phase 1's
base `db/erp-fixture/*.sql` file per the registry's "Per-Domain Fixture Seed Split" rule (PVL fix,
18-09-26: the registry resolved this ownership question after this paragraph was first drafted;
this phase NEVER appends to Phase 1's shared/base `db/erp-fixture/*.sql` file — if a shared/base
table or column is missing, the gap is routed back to Phase 1 via PLAN-SUPPLEMENT, never edited
directly here). No `tbl_ItemGroup`/`tbl_CATEGORY` DDL is needed — see the INNOVATE decision above
(category grouping uses `InventoryItem.ItemGRP` directly, no join).

The fixture seed rows this phase depends on are written to the same `db/erp-fixture/sales-seed.sql`
file:
1. At least 2 `tbl_DOhdr` rows whose `TotalAmount` sums, together with their `tbl_Dodtl` line
   `Amount` sums, to an EXACT match (proves AC3's reconciliation).
2. At least 2 different `MainUnits` values represented across `tbl_Dodtl` lines joined to
   `InventoryItem` (proves the "never sum across units" behavior is exercised, not just asserted).
3. A mix of priced (`Saleprice`/`Amount` <> 0) and unpriced lines, at a ratio that is NOT 100%
   priced or 100% unpriced (proves the coverage-% calculation actually divides, not just returns 0
   or 100).
4. At least one `SalesInvoiceHdr` row with a nonzero `TotalAmount`, `DocuType='SI'` (proves the
   reconciliation footnote's excluded-amount query returns a real, nonzero, correctly-labeled
   number).
5. At least 2 distinct `CustCode` values across `tbl_DOhdr` rows (proves the customer breakdown
   groups correctly and does not accidentally group by `CustName`).
6. At least one `tbl_Dodtl.SoNo` value populated as NULL (matches live 100%-NULL reality — the
   fixture must NOT invent a populated `SoNo`, since production code must work with it always NULL).
7. Enough total DO rows (recommend 12+) to exercise pagination on the DO list table (proves AC12
   against more than one page).
8. DO rows spanning at least 2 distinct calendar months (PVL fix, 22-09-26 inner pass) so the
   สัปดาห์/เดือน/ปี period toggle produces visibly different bin counts per granularity, not a
   degenerate single-bucket result (proves AC8).

---

## UI Details (Thai labels)

- Page title AND nav-menu label: "ยอดขาย" (per Defaults Taken #3, 22-09-26 — supersedes an earlier "การขาย" draft)
- Pilot banner: "ข้อมูลนำร่อง" (per umbrella charter — shared banner component from Phase 1; this
  phase only renders it, does not build it)
- KPI tile labels: "จำนวนใบส่งสินค้า" (delivery/DO count), "จำนวนรายการ" (line count), "จำนวนสินค้า
  (ตามหน่วย)" (quantity per unit — render one tile or one row per distinct unit, never a combined
  cross-unit number)
- Money tile label: "ยอดเงินเฉพาะรายการที่มีราคา" (verbatim from SPEC AC4) + coverage % inline
  (e.g. "ครอบคลุม 0.9% ของรายการ") — Admin-only via `canSeeMoney`
- Reconciliation footnote: rendered directly under the money tile, small muted text, visible
  whenever the money tile is visible (never hidden separately from it)
- Status column label: "สถานะการส่งมอบ" (delivery status — derived from `IsApproved`/`IsClosed`/
  `IsComplete`/`IsCheck`; NEVER label this "สถานะ SO" or reference SalesOrder, since the SO module is
  unused)
- Chart: Thai axis/legend labels matching whichever breakdown it charts (product name or unit)
- Breakdown table headers: "สินค้า" (product), "ลูกค้า" (customer — display `CustName`, group/link by
  `CustCode`), "จำนวน" (qty), "หน่วย" (unit)
- DO list table headers: "เลขที่ใบส่งสินค้า" (DoNo), "วันที่" (Dodate, BE display), "ลูกค้า"
  (CustName), "จำนวนรายการ" (line count), "ยอดเงิน" (Admin-only), "สถานะการส่งมอบ"
- DO lines table headers: "สินค้า", "จำนวน", "หน่วย", "ราคา/หน่วย" (Admin-only), "ยอดเงิน" (Admin-only)
- Empty/degraded states reuse Phase 1's shared banner/empty-state components verbatim (this phase
  does not invent new copy for "ข้อมูลอาจไม่ล่าสุด")

---

## Money Visibility (AC9 — this phase's implementation)

- `const canSeeMoney = (await requireAuth()).role === "ADMIN";` computed once per page render in
  `page.tsx`, passed as a prop to every child component that might render a money column/tile/chart
  series. NEVER computed client-side, NEVER passed as a boolean the client could flip (it is a
  server-computed prop baked into server-rendered markup — Staff-rendered HTML never contains the
  money `<td>`/tile at all, not a CSS-hidden one).
- Chart: if the Recharts spike is adopted, money-series data points are simply omitted from the
  dataset object passed to the chart component when `!canSeeMoney` (never rendered then hidden).
- Every breakdown/DO-list/DO-lines table conditionally includes the money column(s) in its column
  definition array based on `canSeeMoney` — the shared data-table component (Phase 1) must accept a
  dynamic column list; confirm this during RESEARCH against Phase 1's actual component API.

---

## Recharts Spike — Step-by-Step (INNOVATE + EXECUTE)

**INNOVATE decision (22-09-26, PLAN-SUPPLEMENT — scope reconciliation):** the RESEARCH pass found
the approved mockup renders TWO synced bar charts sharing one period-granularity control (the
DO-count-by-period chart, all users; the Admin-only money-by-period chart) PLUS the delivery-status
donut and the product/category pie described in the Scope section above. This phase's Recharts
spike remains ONE dependency-adoption decision (`pnpm add recharts` either adopted for ALL chart
forms or reverted for ALL of them, per the fallback path below) — it is not scoped down to "one
chart type." The bar-chart component (`sales-chart.tsx`) renders both the count series and,
conditionally on `canSeeMoney`, the money series, both driven by the shared `period` state from
`sales-period-toggle.tsx`. The donut (status) and pie (category) are separate small components using
the SAME adopted-or-fallback charting technology decided by this one spike — they are not a second,
independent spike.

1. **INNOVATE step:** decide the ONE chart FORM to spike first for the pass/fail decision (recommend:
   the DO-count-by-period bar chart — pick whichever has the most fixture rows to render
   meaningfully); once the technology choice is proven (adopt or fallback), apply the SAME decision
   to the money-by-period chart, status donut, and category pie — no second spike needed.
2. **EXECUTE step, before writing chart code:** run `pnpm add recharts` (add `react-is` only if the
   installer's own peer-dependency resolution output asks for it — do not preemptively add it).
   Record the ACTUAL resolved dependency tree state (any peer warnings, any version pins pnpm
   applied) — do not assume a specific known failure mode; observe and record what actually happens.
3. Build ONE chart component (`sales-chart.tsx`) rendering real fixture data, in both light and dark
   theme (`data-theme` toggle — verify via the existing `theme-toggle.tsx` mechanism), with Thai
   axis/legend labels.
4. **Decision:**
   - PASS (renders correctly in both themes, no unacceptable peer-dep conflict, bundle-size impact
     reasonable) → keep the `package.json` change, ship this chart, record PASS + peer-dep state in
     the phase report for Phase 3/4 to independently consider adopting.
   - FAIL (peer conflict, rendering breakage, unacceptable bundle impact) → `git checkout
     package.json pnpm-lock.yaml` (revert), rebuild `sales-chart.tsx` as hand-rolled CSS/div bars
     matching `/summary`'s existing pattern (`computeColumnTotals`-style bar rendering — reuse the
     same visual approach, not the same data, since `/summary` bars are order-system-specific).
5. Record the pass/fail decision AND the actual peer-dep state observed (not a hypothesis) in the
   phase report's own section — this is the single source of truth Phase 3/4 read before their own
   INNOVATE step.

---

## Implementation Checklist

### Step A — Sales basis + SQL layer

- [x] A1. Create `src/lib/sales-basis.ts`: `resolveSalesBasis()` reading an `AppSetting` key (e.g.
  `salesBasis`, mirroring `src/lib/app-settings.ts`'s key/get/set pattern) that currently only
  resolves to `"do"` (DO/DOdtl basis); document the extension point for a future `"so"`/`"invoice"`
  value without implementing it. Confirm during RESEARCH whether Phase 1 already stubbed a
  shared `resolveXxxBasis`-style helper to mirror, and whether the `AppSetting` model needs a new
  key registered anywhere else (check `src/lib/app-settings.ts`'s `APP_SETTING_KEYS` — this phase's
  key is Sales-scoped and independent, so it should live in its OWN small helper rather than
  extending Phase-02-unowned `app-settings.ts`, unless RESEARCH finds a strong reason to share).
- [x] A2. Write `db/erp-queries/sales/do-headers.sql`, `do-lines.sql`, `do-by-product.sql`,
  `do-by-customer.sql`, `sales-invoice-excluded-total.sql` — parameterized `SELECT`/`WITH`-only SQL
  matching the Data/SQL Details section above; every query passes through `guardedQuery()`.
  **`do-by-product.sql` MUST apply the highest-`Roworder`-wins tie-break when joining `ItemCode` to
  `InventoryItem`** (registry Cross-Phase Precondition — PVL fix, 22-09-26 inner pass; this is a
  checklist-mandated, code-review-verifiable requirement regardless of whether the local fixture
  currently contains a duplicate-`ItemCode` row to exercise it against — see Data/SQL Details and
  the Verification Evidence table's Known-Gap row on this topic).
- [x] A3. Write `src/lib/__tests__/sales-basis-reconciliation.test.ts` covering THREE things, split
  by DB-dependency (PVL fix, 22-09-26 inner pass — resolves execute-agent instruction E3's
  classification ambiguity definitively rather than deferring it to EXECUTE-time discovery):
  (i) **Fully-Automated, zero DB precondition** — `resolveSalesBasis()`'s DECISION logic: extract a
  pure function (e.g. `resolveSalesBasisFromValue(raw: string | null): "do"`) that the DB-touching
  `resolveSalesBasis()` wrapper calls after its own thin `getAppSetting`-style read (mirrors the
  `locations.ts`/`locations-core.ts` DB-helper/pure-transform split — this repo's own
  `app-settings.ts`, the pattern Step A1 mirrors, has NO unit test at all for its live-Prisma
  get/set calls, so the DB-touching half of `resolveSalesBasis()` should not be unit-tested with a
  live connection either). Assert: returns `"do"` for `null`/unset, returns `"do"` when explicitly
  `"do"`, and documents (code comment + skipped/todo case, not a real assertion) the not-yet-
  implemented `"so"`/`"invoice"` extension point.
  (ii) **Fully-Automated, zero DB precondition** — the "never sum across units" hard safety
  constraint: a pure function (e.g. `sumQuantityByUnit(lines): Map<unit, number>` in
  `sales-basis.ts`) asserted against literal in-memory fixture-shaped line objects (no DB call) with
  ≥2 distinct `MainUnits` values (mirrors Fixture Data Requirement #2): proves the result is grouped
  per-unit (multiple map entries) and that no single combined cross-unit number is ever produced.
  (iii) **Hybrid, precondition: `orderstock-sql` container up + `db/erp-fixture/sales-seed.sql`
  applied (on top of Phase 1's base `00-schema.sql`/`01-seed.sql`)** — header-sum-equals-detail-sum
  against the REAL `erp_fixture` seed data via `guardedQuery()` (AC3): this exercises the actual SQL
  in `do-headers.sql`/`do-lines.sql`, not in-memory arithmetic, so it is DB-dependent like Phase 1's
  own DB-backed checks (fixture-present, live health probe — see `all-tests.md` § ERP fixture /
  guard testing), never Fully-Automated. This precondition is LOCAL-ONLY (`orderstock-sql`
  container) — it never touches `db_TCL`.
- [x] A4. Write `src/lib/__tests__/sales-money-coverage-footnote.test.ts` — **Hybrid, same
  precondition as A3(iii)** (PVL fix, 22-09-26 inner pass: this test queries real `tbl_Dodtl`/
  `SalesInvoiceHdr` rows via `guardedQuery()` against `erp_fixture`, so it is DB-dependent like the
  reconciliation test, never Fully-Automated) — asserts the coverage % calculation and the
  excluded-total query return the expected fixture numbers (AC4's automated half; the footnote
  wording/placement itself is the separate Agent-Probe half — see Verification Evidence).
- [x] A5. Create `db/erp-fixture/sales-seed.sql` (Phase 2's exclusively-owned per-domain seed
  file — see registry) containing BOTH the `CREATE TABLE` DDL for `tbl_DOhdr`/`tbl_Dodtl`/
  `SalesInvoiceHdr` (PLAN-SUPPLEMENT finding, 22-09-26 — none of these tables exist in the fixture
  DB yet) AND the fixture seed rows listed under "Fixture Data Requirements" above, and apply it
  against the `erp_fixture` sandbox database using the same manual/CI mechanism Phase 1's own
  `00-schema.sql`/`01-seed.sql` documents (confirm the exact invocation during RESEARCH — do not
  invent a new mechanism). Never edit Phase 1's base `db/erp-fixture/*.sql` file.

### Step B — Page shell + KPI tiles + filters

- [x] B1. Create `src/app/(main)/dashboards/sales/page.tsx` — `requireAuth()`, `force-dynamic`,
  reads `searchParams` (confirm `Promise<{...}>` shape per Next 16 convention — see `summary/page.tsx`
  for the exact pattern already used in this codebase), computes `canSeeMoney`, renders the pilot
  banner (Phase 1 component), the degrade banner (conditionally, Phase 1 component), and dispatches
  to `sales-breakdown-tables.tsx` / `do-list-table.tsx` / `do-lines-table.tsx` per the Drilldown
  Routing Decision.
- [x] B2. Create `src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx` — renders `Card`-wrapped tiles
  for delivery count, line count, per-unit quantity (one row per unit, never combined), and the
  Admin-only money tile + coverage % + reconciliation footnote.
- [x] B3. Wire date-range (`from`/`to` + `customer`/`product`/`status`/`period`) filter UI as a
  single `<form>` submitted as one GET navigation (INNOVATE decision, 22-09-26 — mirrors the
  APPROVED mockup's actual filter-bar implementation exactly, rather than `shop-location-filter`'s
  per-field `useRouter` push pattern; smallest-option choice: one native form submit updates every
  filter param at once, with dismissible filter chips showing active non-date filters) — reload
  reproduces the same filtered view (AC10).

### Step C — Chart (Recharts spike)

- [x] C1. Run the Recharts spike per "Recharts Spike — Step-by-Step" above; create
  `src/app/(main)/dashboards/sales/sales-chart.tsx` with the adopted or fallback implementation.
- [x] C2. Record the pass/fail decision + actual peer-dep state in this phase's report (not just in
  chat) — Phase 3/4 read this before their own INNOVATE step.

### Step D — Breakdown + drilldown tables

- [x] D1. Create `src/app/(main)/dashboards/sales/sales-breakdown-tables.tsx` — product breakdown
  (group by `ItemCode`/item name) AND a category pie grouped directly by `InventoryItem.ItemGRP` + a
  small code-to-Thai-label map (INNOVATE decision, 22-09-26 — see Data/SQL Details; no
  `tbl_ItemGroup`/`tbl_CATEGORY` join needed) and customer breakdown (group by `CustCode`, display
  `CustName`), each row linking to the filtered DO list (Drilldown Routing Decision). **Both the
  product-name lookup and the `ItemGRP` grouping resolve one canonical `InventoryItem` row per
  `ItemCode` via the highest-`Roworder`-wins tie-break (PVL fix, 22-09-26 inner pass — see Data/SQL
  Details and E5) — a duplicate `ItemCode` with a different `ItemGRP` on a lower-`Roworder` row must
  never silently win.**
- [x] D2. Create `src/app/(main)/dashboards/sales/do-list-table.tsx` using Phase 1's shared
  data-table component — sort + paginate + dynamic money column (per `canSeeMoney`) + mobile card
  view (confirm the shared component's mobile-card behavior is automatic — if not, this phase adds
  the card-view branch itself, mirroring `users-mobile.tsx`'s pattern).
- [x] D3. Create `src/app/(main)/dashboards/sales/do-lines-table.tsx` — line-item detail for a
  selected `doNo`, same money-gating + mobile pattern.

### Step E — Auth, mobile, and shared-file appends

- [x] E1. Confirm `requireAuth()` (no role param) gates `/dashboards/sales` for both ADMIN and STAFF
  — SPEC AC1/AC2 (unauth → redirect to login, matching `e2e/auth.spec.ts`'s existing pattern).
- [x] E2. Verify mobile-card rendering at 390×844 (AC13) — either automatic via Phase 1's shared
  component, or an explicit `md:hidden` card branch in `do-list-table.tsx` mirroring
  `users-mobile.tsx`.
- [x] E3. Append this phase's new route(s) to `src/lib/__tests__/auth-guard-coverage.test.ts`
  (append-only — do not touch other phases' entries).
- [x] E4. Update this phase's own status line in the `erp-dashboards` feature entry inside
  `process/context/all-context.md` (append/update only the Phase-2 line, per registry rule).

### Step F — Tests

- [x] F1. Write `e2e/dashboards-sales.spec.ts` covering: nav visibility (shared with Phase 1's own
  gate — this phase only asserts the Sales link specifically), auth redirect, reconciliation display,
  coverage-percent and footnote presence, filter URL round-trip (`from`/`to`), **period-toggle
  round-trip (`period` param — สัปดาห์/เดือน/ปี, defaults เดือน, reload reproduces the selected bin) (AC8 — PVL
  fix, 22-09-26 inner pass: named as its own scenario; was previously undercovered by the generic
  "filter URL round-trip" wording)**, **status donut + category pie render, and selecting a slice
  filters every OTHER panel while the donut/pie's OWN dimension stays unfiltered by its own
  selection (PVL fix, 22-09-26 inner pass — see Scope section's cross-filter semantics, previously
  undercovered)**, drilldown navigation (breakdown row → DO list → DO lines), sort+paginate, mobile
  card view (`test.use({ viewport: { width: 390, height: 844 } })` inline in the spec file — do NOT
  edit `playwright.config.ts`; this keeps the mobile-viewport gate entirely inside this phase's
  OWNED path, see Registry Change Requests below for why).
- [x] F2. Run `pnpm test` (targeted: `sales-*.test.ts`) and `pnpm test:e2e -- dashboards-sales.spec.ts`
  until green; fix inline per the per-section test-gate loop (phase-programs.md).

---

## Registry Change Requests

None required to complete this phase. One deliberate design choice avoids a registry change:

- **`playwright.config.ts` is NOT edited by this phase.** The existing `mobile` project's
  `testMatch: /mobile\.spec\.ts/` regex would need widening (or a new project added) to run
  `dashboards-sales.spec.ts` at the 390×844 mobile viewport via a Playwright *project*. Instead, this
  phase uses an in-file `test.use({ viewport: { width: 390, height: 844 } })` override inside
  `e2e/dashboards-sales.spec.ts` for the mobile-card scenario, which achieves the same viewport
  assertion without touching a file no phase in the registry currently owns. **If Phase 3 or Phase 4
  find the same need, they should independently apply the same in-file `test.use()` pattern in their
  own spec files** rather than either phase editing the shared config — flagging this here so the
  orchestrator/plan-agent for those phases can reuse this exact resolution instead of proposing a
  registry change of their own.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `tbl_Dodtl.ItemCode → tbl_ItemGroup/tbl_CATEGORY` join path unconfirmed (RESEARCH gap noted in erp-data-dictionary) | Product "category" rollup may not be buildable as designed | Product breakdown falls back to item-code/name-only grouping (no category rollup) if RESEARCH cannot confirm the join within budget; documented as a known-gap, not invented |
| Recharts peer-dep behavior with React 19.2 is genuinely unknown (neither package installed anywhere in the repo today) | Spike could fail unpredictably, consuming EXECUTE time | Time-boxed single spike (one chart, one phase) with an explicit revert path back to CSS bars; failure is a valid, planned outcome, not a blocker |
| Coverage-% and reconciliation-footnote wording could read as burying the excluded ฿858,937.21 rather than disclosing it | Violates the umbrella charter's "never silently drop a larger real number" hard constraint | Footnote must NAME the excluded amount explicitly (not "some data is excluded"); Hybrid/Agent-Probe gate below specifically checks wording/placement, not just presence |
| `Next 16 searchParams` is a `Promise` (confirmed in `summary/page.tsx`) — an implementation using the OLD (pre-async) prop shape would silently break at build/runtime | Broken filters | RESEARCH step explicitly re-confirms the Promise shape against a currently-passing page (`summary/page.tsx`) before writing `page.tsx` |
| Money-gating regresses to a client-side hide if a component author reaches for a CSS class instead of a prop | Violates AC9 + umbrella hard safety constraint | `canSeeMoney` is computed ONLY in `page.tsx` (server) and passed down as data-shaping (column list / dataset filtering), never as a `hidden` className; PVL/EVL gate explicitly diffs server-rendered HTML for STAFF vs ADMIN sessions |
| ~~Fixture seed additions could accidentally collide with Phase 3/4's own fixture rows if seeded into a shared file without namespacing~~ — **RESOLVED at PVL (18-09-26):** the registry's "Per-Domain Fixture Seed Split" rule already defines separate `db/erp-fixture/{sales,purchase,production}-seed.sql` files, one per domain phase; this phase creates and owns only `sales-seed.sql` | Cross-phase fixture pollution, flaky tests | No longer applicable — namespacing is structural (separate files), not a naming convention to confirm during RESEARCH |

---

## Blockers That Would Justify BLOCKED Status

- Phase 1's exit gate has not actually passed (guard tests not green, `erp_fixture` not seeded, or
  the shared data-table component does not exist yet).
- Phase 1's actual delivered API for the shared data-table component cannot support a dynamic
  (role-conditional) column list, and no reasonable workaround exists without editing Phase 1's
  owned files — this blocks Step D2/D3 and should be routed as a PLAN-SUPPLEMENT to Phase 1, not
  worked around by editing Phase 1's files directly.
- The `erp_fixture` database itself does not exist or cannot be reached from the sandbox container.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop
`R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: confirmed Phase 1's actual delivered exports/file names match
  this plan's assumptions exactly (no stale names); found the fixture DB has NO DDL for
  `tbl_DOhdr`/`tbl_Dodtl`/`SalesInvoiceHdr`/`tbl_ItemGroup`/`tbl_CATEGORY` yet; found the mockup's
  category pie needs only `InventoryItem.ItemGRP`, not the unconfirmed join; found the mockup's
  period toggle + two synced charts + donut/pie cross-filter semantics + CSV-readiness convention
  gap — all folded into this PLAN-SUPPLEMENT (22-09-26). `searchParams` Promise shape confirmed
  against `summary/page.tsx`.
- [x] 2. INNOVATE — decisions made (22-09-26, folded directly into this PLAN-SUPPLEMENT rather than
  a separate agent pass, per orchestrator instruction): (a) filter bar = single form-submit GET
  navigation with dismissible chips, matching the approved mockup exactly, not per-field `useRouter`
  push; (b) category grouping = direct `InventoryItem.ItemGRP` + label map, no
  `tbl_ItemGroup`/`tbl_CATEGORY` join; (c) Recharts spike stays ONE dependency-adoption decision
  applied uniformly to all 4 chart forms (count bar, money bar, status donut, category pie), not a
  second spike. Drilldown Routing Decision (single-page searchParam state machine) reconfirmed,
  unchanged.
- [x] 3. PLAN-SUPPLEMENT — plan-agent: applied all 6 RESEARCH supplement items, folded in the 5
  orchestrator defaults (see "## Defaults Taken (22-09-26)" below), added the period toggle to
  scope/Touchpoints/acceptance criteria. See "## Inner Loop Refresh Note" below.
- [x] 4. PVL — vc-validate-agent: full V1-V7 re-run (22-09-26 inner pass, triggered by the
  22-09-26 Inner Loop Refresh Note being newer than the 18-09-26 outer-pvl contract);
  validate-contract rewritten below with `generated-by: inner-pvl: phase-2`, `supersedes: 2026-09-18
  (outer-pvl)`. 5 new plan-text fixes applied (P5-P9, on top of the outer pass's P1-P4); Gate: PASS.
- [x] 5. EXECUTE — all checklist items (A-F) done (22-09-26); per-section test gates run and
  green against the local `erp_fixture` (unit: 23 files / 282 tests; e2e: 72 passed, 0 failed;
  lint clean; production compile clean; agent-parity clean). Charting decision recorded in the
  phase report: hand-rolled CSS/SVG shipped, `recharts` NOT adopted (never installed).
- [x] 6. EVL — orchestrator-run EVL confirmation (22-09-26, 2 cycles): Cycle 1 was env-blocked
  (11/17 gates skipped — `ERP_DATABASE_URL` unavailable in that session) but found and fixed a real
  defect (cold-cache 500 → `sales-unavailable.tsx`); Cycle 2 (this session, env configured against
  local `erp_fixture`) is `all_pass: true`, `gates_green: true`, no further fix needed. EVL HANDOFF
  SUMMARY consumed by UPDATE PROCESS.
- [x] 7. UPDATE PROCESS — phase report written (`phase-02-sales-dashboard_REPORT_22-09-26.md`),
  umbrella `## Current Execution State` updated, registry ledger updated, context docs updated;
  commit NOT done this session (execution + process commits listed for the user, not made)

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract`
reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must
spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent
instructions / Test gates sections is treated as a placeholder.

---

## Exit Gate

```bash
pnpm test -- sales-basis-reconciliation sales-money-coverage-footnote
# Expected: all pass, exit 0

pnpm lint
# Expected: exit 0

pnpm build
# Expected: exit 0 (confirms no ERP table leaked into prisma/schema.prisma-adjacent build paths,
# confirms Recharts decision — adopted or reverted — leaves a clean build either way)

pnpm test:e2e -- dashboards-sales.spec.ts
# Expected: all scenarios pass, exit 0

node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs
# Expected: exit 0
```

- All Implementation Checklist items (A1-F2) checked.
- AC1, AC3, AC4, AC9 (Sales), AC10-AC13 (Sales) green against `erp_fixture` (per umbrella Phase
  Ordering table's Phase-2 exit gate).
- Recharts spike decision (adopt or fallback) recorded in the phase report, including the actual
  observed peer-dependency state — not an assumed one.
- Phase report written to the report destination above.

---

## Touchpoints

(Duplicated from the Touchpoints section above for the phase-stub template's required heading.)

- `src/app/(main)/dashboards/sales/**` (new)
- `src/lib/sales-basis.ts` (new)
- `db/erp-queries/sales/*.sql` (new)
- `src/lib/__tests__/sales-*.test.ts` (new)
- `e2e/dashboards-sales.spec.ts` (new)
- `src/lib/__tests__/auth-guard-coverage.test.ts` (append-only)
- `process/context/all-context.md` (append/update own status line only)
- `package.json` (conditional — only if the Recharts spike passes; reverted if it fails)

---

## Public Contracts

- No existing route, schema, or print surface changes — `/dashboards/sales` is a wholly new route.
- `requireAuth()`'s existing signature is unchanged; this phase uses the existing no-role-arg call
  plus an inline `canSeeMoney` check, introducing no new auth primitive.
- The phone bottom-tab-bar's existing 3-tab contract (`e2e/mobile.spec.ts`) is unchanged — this
  phase never edits `bottom-tab-bar.tsx`.
- `resolveSalesBasis()` is a new, additive, Sales-scoped helper — it does not change any existing
  `AppSetting` key's meaning or `src/lib/app-settings.ts`'s existing `APP_SETTING_KEYS` contract.

---

## Blast Radius

(PLAN-SUPPLEMENT, 22-09-26: the new `sales-period-toggle.tsx`, `sales-status-donut.tsx`, and
`sales-category-pie.tsx` files added to Touchpoints all fall under the existing
`src/app/(main)/dashboards/sales/**` glob below — no registry change needed.)

Stays entirely within this phase's OWNED PATHS per `phase-blast-radius-registry.md`'s Phase 2
section: `src/app/(main)/dashboards/sales/**`, `src/lib/sales-basis.ts`,
`db/erp-queries/sales/*.sql`, `db/erp-fixture/sales-seed.sql` (Phase 2's exclusively-owned
per-domain fixture seed file — PVL fix, added 18-09-26 for consistency with the registry),
`src/lib/__tests__/sales-*.test.ts`, `e2e/dashboards-sales.spec.ts`,
plus the two registry-sanctioned append-only shared files
(`src/lib/__tests__/auth-guard-coverage.test.ts`, `process/context/all-context.md`) and the
conditional `package.json` Recharts dependency (exclusively owned by Phase 2 per the registry).
This phase never edits `src/app/(main)/dashboards/purchase/**`, `.../production/**`, any
`db/erp-queries/purchase/*` or `db/erp-queries/production/*` file, or any Purchase/Production-named
test/spec file.

---

## Acceptance Criteria

This phase is done when all of the following are testably true (mapped to the SPEC's numbered ACs
via the Verification Evidence table below):

1. AC1 (Sales-specific slice): the "แดชบอร์ด" nav group's Sales link resolves to a working
   `/dashboards/sales` page for a logged-in Staff or Admin user.
2. AC2: an unauthenticated request to `/dashboards/sales` redirects to login.
3. AC3: the displayed delivery count, line count, and per-unit quantity totals reconcile exactly
   against an independently computed total from the same fixture data (header sum = detail sum).
4. AC4: the money tile shows "ยอดเงินเฉพาะรายการที่มีราคา" + a coverage % + a footnote naming the
   excluded ฿858,937.21-equivalent fixture pool.
5. AC9 (Sales slice): Admin sees every money figure/column/series; Staff sees none, enforced
   server-side (verified by diffing server-rendered HTML, not a client-side hide).
6. AC10-AC13 (Sales slice): filter URL round-trip, breakdown→DO-list→DO-lines drilldown navigation,
   sort+paginate without losing filters, and mobile card view at phone width all work as specified.
7. The Recharts adopt-or-fallback spike decision is recorded (pass or fail, with the actual observed
   peer-dependency state) in the phase report.
8. (Added by PLAN-SUPPLEMENT, 22-09-26) The สัปดาห์/เดือน/ปี period toggle changes the bin key for
   BOTH the DO-count chart and the Admin-only money chart simultaneously, defaults to เดือน, and
   round-trips through the URL like the other filters (AC10).
9. `pnpm test`, `pnpm lint`, `pnpm build`, and the new `dashboards-sales.spec.ts` e2e suite all pass.

## Phase Completion Rules

- Code-only completion (all checklist items done, gates green in a local run) is `🔨 CODE DONE`,
  never `✅ VERIFIED`.
- `✅ VERIFIED` requires: the EVL confirmation run (an independent vc-tester re-run of every gate in
  the Verification Evidence table, not just execute-agent's own claim) all green, the Recharts spike
  decision recorded with actual (not assumed) peer-dependency state, and the Agent-Probe footnote
  wording/placement check explicitly performed and recorded.
- A phase without a written `## Validate Contract` (PVL step 4 unchecked, or the section still reads
  the placeholder text) cannot be marked `✅ VERIFIED` — per the umbrella Program Goal Charter's
  "what verified means" clause.
- If the product/category rollup join path cannot be confirmed (see Risks), the phase may still reach
  `✅ VERIFIED` provided the fallback (item-code-only grouping) is implemented, tested, and the gap is
  recorded as a known-gap/backlog note — this is an accepted residual, not a blocker.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `sales-basis-reconciliation.test.ts` — `resolveSalesBasisFromValue()` pure decision logic (defaults `"do"`, reads `"do"` explicit, documents unimplemented `"so"`/`"invoice"` extension point) | Fully-Automated (zero DB precondition — pure function; PVL fix, 22-09-26 inner pass: split from the DB-touching `resolveSalesBasis()` wrapper, mirrors `app-settings.ts`'s never-unit-tested-live convention) | Umbrella charter's "switch mechanism built" claim — no numbered AC, closes a net-gate coverage gap |
| `sales-basis-reconciliation.test.ts` — `sumQuantityByUnit()` groups ≥2 distinct `MainUnits` per-unit, never combines them into one cross-unit total (PVL fix, 22-09-26 inner pass — new named gate) | Fully-Automated (zero DB precondition — pure function over literal fixture-shaped line objects) | Umbrella Program Goal Charter's hard safety constraint ("never sum across units") — no numbered AC |
| `sales-basis-reconciliation.test.ts` — header sum equals detail sum on the REAL `erp_fixture` seed data via `guardedQuery()` | Hybrid — precondition: `orderstock-sql` container up + `db/erp-fixture/sales-seed.sql` applied on top of Phase 1's base fixture (PVL fix, 22-09-26 inner pass: reclassified from Fully-Automated — exercises the real SQL in `do-headers.sql`/`do-lines.sql`, not in-memory arithmetic, matching Phase 1's own DB-backed-check convention; LOCAL-ONLY, never `db_TCL`) | AC3 |
| `sales-money-coverage-footnote.test.ts` — coverage-percent calculation + excluded-total query return expected fixture numbers | Hybrid — same precondition as above (PVL fix, 22-09-26 inner pass: reclassified from Fully-Automated for the same reason) | AC4 (numeric half) |
| Agent-probe visual check of footnote wording/placement (names the excluded ฿858,937.21 explicitly, visible directly under the money tile) | Agent-Probe | AC4 (wording/placement half) |
| `dashboards-sales.spec.ts` — unauth redirect | Fully-Automated | AC2 |
| `dashboards-sales.spec.ts` — money column present for ADMIN session, absent from server-rendered HTML for STAFF session (not CSS-hidden) | Fully-Automated | AC9 (Sales) |
| `dashboards-sales.spec.ts` — filter URL round-trip (`from`/`to` params, reload reproduces view) | Fully-Automated | AC10 (Sales) |
| `dashboards-sales.spec.ts` — period-toggle round-trip (`period` param, สัปดาห์/เดือน/ปี, defaults เดือน, reload reproduces the selected bin) (PVL fix, 22-09-26 inner pass — new named gate) | Fully-Automated | AC8 (Sales, added by 22-09-26 PLAN-SUPPLEMENT) |
| `dashboards-sales.spec.ts` — status donut + category pie render; selecting a slice filters every OTHER panel while its own dimension stays unfiltered by its own selection (PVL fix, 22-09-26 inner pass — new named gate) | Fully-Automated | Scope section's cross-filter semantics — no separately numbered AC, part of AC10/AC11's filter+drilldown behavior |
| `dashboards-sales.spec.ts` — breakdown row → DO list → DO lines navigation | Fully-Automated | AC11 (Sales) |
| `dashboards-sales.spec.ts` — sort + paginate DO list without losing filters | Fully-Automated | AC12 (Sales) |
| `dashboards-sales.spec.ts` — mobile card view at 390×844 (`test.use()` inline viewport override) | Fully-Automated | AC13 (Sales) |
| Recharts spike — time-boxed OPTIONAL check (Defaults Taken #5): hand-rolled CSS/SVG is the preferred default; `pnpm add recharts` only attempted if hand-rolled genuinely cannot deliver a needed chart form; record actual peer-dep resolution if attempted (PVL fix, 22-09-26 inner pass — wording synced to the Defaults Taken #5 reframing already applied to the plan's prose) | Hybrid (requires a real install-then-build step only if attempted; pass/fail judged against observed, not assumed, state) | Umbrella Phase-2 exit gate's "Recharts spike decision recorded" (satisfied by either "not adopted, hand-rolled shipped" or "adopted, spike passed") |
| Product/category rollup via `tbl_ItemGroup`/`tbl_CATEGORY` join | Known-Gap (if RESEARCH cannot confirm the join path within budget — falls back to item-code-only grouping, backlog note written) | n/a — not a numbered AC; a design-quality item noted in Background/Research Findings |
| InventoryItem highest-`Roworder`-wins tie-break in `do-by-product.sql` + category-pie grouping — SQL pattern is checklist-mandated (Step A2/D1) and code-review-verifiable now; automated proof against a duplicate-`ItemCode` fixture row needs a shared/base fixture addition Phase 2 cannot make unilaterally (registry ownership rule) (PVL fix, 22-09-26 inner pass — new named Known-Gap, registry Cross-Phase Precondition) | Known-Gap — gap-resolution D: route a duplicate-`ItemCode` fixture-row request to Phase 1 via PLAN-SUPPLEMENT if EXECUTE confirms automated proof is needed; live data reality (~85 duplicated codes) makes the SQL-level fix itself non-optional regardless | Registry Cross-Phase Precondition — no numbered AC, a data-correctness requirement |

---

## Test Infra Improvement Notes

(none identified yet — this is the first phase to build an e2e spec against `erp_fixture`; if the
fixture-seeding mechanism proves awkward to extend per-domain, note it here during EXECUTE for
Phase 3/4 and Phase 5's benefit)

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_PLAN_18-09-26.md`
- Last completed step: Step 3 (PLAN-SUPPLEMENT) complete, 22-09-26
- Validate-contract status: PASS (18-09-26, outer-pvl) but STALE — a newer Inner Loop Refresh Note
  (22-09-26) exists; inner PVL must re-run from V1 before EXECUTE begins
- Next step: spawn vc-validate-agent for inner PVL (Step 4) against this updated plan
- Dependency: this phase cannot begin EXECUTE until Phase 1's exit gate has passed (see Entry Gate)
  AND the inner PVL re-run reaches PASS or an accepted CONDITIONAL.

---

## Defaults Taken (22-09-26)

The following are ORCHESTRATOR DEFAULTS taken because the user was asked about these four/five open
design questions, did not choose, and said "start Phase 2." These are recorded as defaults-taken,
NOT as user decisions — they are reversible and should be revisited if the user later has an
opinion.

1. **Phone-width access to dashboards:** unchanged in this phase (sidebar/drawer only; the bottom
   tab bar stays exactly 3 tabs, per Phase 1's existing contract). Deferred to Phase 5 rollout.
2. **Circle charts:** follow the reviewed mockup exactly — donut (with center total) for
   delivery-status share, full pie for item-category share. See Scope + Touchpoints additions above.
3. **Menu label vs page title:** made to MATCH — "ยอดขาย" for both the nav item and the page
   `<h1>`/title (supersedes this plan's earlier "การขาย" page-title text in the UI Details section —
   see correction below).
4. **Button/chip text colour:** kept as the app's existing tokens today (NOT the mockup's darkened
   text) — the contrast concern is app-wide and belongs to a separate accessibility pass, recorded
   here as a backlog note, not fixed in this phase.
5. **Charting technology:** hand-rolled CSS/SVG charts (matching the mockup, which proves this
   renders correctly with IBM Plex Sans Thai in light/dark) are PREFERRED. The Recharts spike
   becomes a time-boxed OPTIONAL check — only adopt the `recharts` dependency if hand-rolled cannot
   deliver a needed chart form; otherwise record "not adopted" with the reason and add no
   dependency. This slightly reframes (not contradicts) the plan's existing "Recharts Spike —
   Step-by-Step" section: the pass criterion for "adopt" now requires demonstrating hand-rolled
   CSS/SVG genuinely cannot deliver the needed form (e.g. the donut's center-total layout, or smooth
   theme-aware transitions) — a plain "it renders" is no longer sufficient justification to adopt a
   new dependency when the reviewed mockup already proves the hand-rolled path works.

**Correction applied per default 3:** the UI Details section's "Page title: 'การขาย' (Sales)" line
is SUPERSEDED — the page title and nav-menu label must both read "ยอดขาย" (this plan's earlier text
predates this default; execute-agent should use "ยอดขาย" for both, not "การขาย").

## Inner Loop Refresh Note

**Date:** 2026-09-22
**Trigger:** Step 1 RESEARCH + Step 2 INNOVATE findings folded into this PLAN-SUPPLEMENT pass.

**Sections changed:**
- Scope — added period-granularity toggle, donut/pie cross-filter semantics, CSV-export-readiness
  convention clarification, filter-bar interaction-model decision.
- Data/SQL Details — added INNOVATE decision on category grouping via `InventoryItem.ItemGRP`
  (downgrades the prior category-rollup Known-Gap to buildable for the common case).
- Fixture Data Requirements — corrected DDL ownership: `sales-seed.sql` now owns `CREATE TABLE` for
  `tbl_DOhdr`/`tbl_Dodtl`/`SalesInvoiceHdr`, not just seed rows (none of these tables exist in the
  fixture DB yet).
- Implementation Checklist — Step A5 (DDL ownership), Step B3 (filter-bar model), Step D1 (category
  grouping via ItemGRP).
- Recharts Spike section — reframed as one dependency-adoption decision applied uniformly across 4
  chart forms; reframed per Defaults Taken #5 as a time-boxed OPTIONAL check preferring hand-rolled
  CSS/SVG.
- Touchpoints (CREATE list) — added `sales-period-toggle.tsx`, `sales-status-donut.tsx`,
  `sales-category-pie.tsx`.
- Blast Radius — confirmed new files stay within the existing OWNED PATHS glob, no registry change.
- Acceptance Criteria — added AC for the period toggle (item 8), renumbered the final test-commands
  criterion to item 9.
- UI Details — "การขาย" page title superseded by "ยอดขาย" per Defaults Taken #3.
- New: "## Defaults Taken (22-09-26)" section (this supplement).
- Phase Loop Progress — Steps 1–3 ticked.

**This note supersedes the plan text it references above; it does not replace the existing
Validate Contract below, which remains the PVL record from the outer-loop pass (18-09-26). Per
`orchestration.md`'s pre-routing check, this Refresh Note's date (2026-09-22) is newer than the
Validate Contract's `date: 2026-09-18` — inner PVL must re-run from V1 before EXECUTE begins.**

## Validate Contract

Status: PASS
Date: 22-09-26
date: 2026-09-22
generated-by: inner-pvl: phase-2
supersedes: 2026-09-18 (outer-pvl) — inner PVL has current evidence (Inner Loop Refresh Note,
2026-09-22, is newer than the prior outer-pvl contract date; full V1-V7 re-run per
`orchestration.md`'s pre-routing check)

Parallel strategy: sequential
Rationale: Signal score 2/7 (S4 phase-program classification, S7 5+ files in blast radius —
S1/S2/S3/S5/S6 not present, unchanged from the outer pass). Nominal band is MEDIUM
(parallel-subagents), but Strategy-by-Fit overrides to **sequential, single vc-execute-agent
(opus)**: Implementation Checklist Steps A→B→C→D→E→F remain sequentially dependent (B/D import A's
SQL layer + `resolveSalesBasis()`; E depends on B/D existing; F depends on all). Unchanged from the
outer pass — this inner PVL cycle found no new fan-out signal.

Test gates (C3 5-column table — ADDITIVE; existing consumers still parse the legacy line form below it):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| infra (net-gate fix) | `resolveSalesBasisFromValue()` pure decision logic defaults to `"do"`, reads `"do"` explicit, documents unimplemented `"so"`/`"invoice"` extension point | Fully-Automated | `pnpm test -- sales-basis-reconciliation` (pure-function assertions, zero DB precondition — PVL fix, 22-09-26: split from the DB-touching wrapper) | A |
| infra (net-gate fix) | "never sum across units" hard safety constraint — `sumQuantityByUnit()` groups ≥2 distinct `MainUnits` per-unit, never one combined cross-unit total | Fully-Automated | `pnpm test -- sales-basis-reconciliation` (same file, pure function over literal fixture-shaped line objects, zero DB precondition — PVL fix, 22-09-26: new named gate) | A |
| AC3 | DO/DOdtl reconciliation: header sum = detail sum via real SQL against `erp_fixture` | Hybrid — precondition: `orderstock-sql` container up + `db/erp-fixture/sales-seed.sql` applied on top of Phase 1's base fixture | `pnpm test -- sales-basis-reconciliation` (same file, DB-backed assertion — PVL fix, 22-09-26: reclassified from Fully-Automated to Hybrid; exercises real `do-headers.sql`/`do-lines.sql` SQL via `guardedQuery()`, not in-memory arithmetic; LOCAL-ONLY, never `db_TCL`) | A |
| AC4 (numeric half) | coverage-percent (priced/unpriced ratio) + excluded-total (`SalesInvoiceHdr`, ฿858,937.21-equivalent fixture pool) query return expected fixture numbers | Hybrid — same precondition as AC3 above | `pnpm test -- sales-money-coverage-footnote` (PVL fix, 22-09-26: reclassified from Fully-Automated to Hybrid for the same DB-dependency reason) | A |
| AC4 (wording/placement half) | reconciliation footnote names the excluded amount explicitly, rendered directly under the money tile | Agent-Probe | Manual visual scan of `/dashboards/sales` (Admin session) after EXECUTE — confirm footnote text names the excluded ฿-figure and sits immediately under the money tile, never separately hidden | A |
| AC1 (Sales slice) | "แดชบอร์ด" nav Sales link resolves to a working `/dashboards/sales` page for Staff/Admin | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (nav + page-load scenario) | A |
| AC2 | unauthenticated request to `/dashboards/sales` redirects to login | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (auth-redirect scenario) | A |
| AC9 (Sales slice) | Admin sees every money figure/column/series; Staff sees none, server-side (diffed server-rendered HTML, not CSS-hidden) | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (money-visibility-role-gate scenario) | A |
| AC10 (Sales slice) | date-range filter URL round-trip; reload reproduces the filtered view | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (filter-url-roundtrip scenario) | A |
| AC8 (Sales slice, PVL fix 22-09-26 — new named gate) | สัปดาห์/เดือน/ปี period-toggle round-trip, defaults เดือน, reload reproduces the selected bin | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (period-toggle-roundtrip scenario — previously undercovered by the generic filter-round-trip wording) | A |
| Scope cross-filter semantics (PVL fix 22-09-26 — new named gate) | status donut + category pie render; selecting a slice filters every OTHER panel while its own dimension stays unfiltered by its own selection | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (donut-pie-cross-filter scenario — previously undercovered) | A |
| AC11 (Sales slice) | breakdown row → DO list → DO lines drilldown navigation | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (drilldown-navigation scenario) | A |
| AC12 (Sales slice) | DO list sort + paginate without losing filters | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (table-sort-paginate scenario) | A |
| AC13 (Sales slice) | mobile card view at 390×844 (inline `test.use()` viewport override, no `playwright.config.ts` edit) | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (mobile-card-view scenario) | A |
| Umbrella exit gate | Recharts adopt-or-fallback decision recorded with the ACTUAL observed state (PVL fix, 22-09-26: reframed per Defaults Taken #5 — hand-rolled CSS/SVG is the preferred default; `recharts` is attempted ONLY if hand-rolled cannot deliver a needed form) | Hybrid — precondition: only if the spike is actually attempted, a real install-then-build step against React 19.2.4; pass/fail judged against observed, not assumed, state | `pnpm add recharts` (only if attempted) + render `sales-chart.tsx` light+dark against fixture data; on FAIL or "not attempted", hand-rolled CSS bars ship and the reason is recorded (plan's own Step C1/C2 procedure) | B |
| Registry Cross-Phase Precondition (PVL fix, 22-09-26 — new named gate) | `InventoryItem` highest-`Roworder`-wins tie-break applied in `do-by-product.sql` + category-pie grouping | Known-Gap — SQL pattern is checklist-mandated (Step A2/D1) and code-review-verifiable now; automated proof against a duplicate-`ItemCode` fixture row needs a shared/base fixture addition Phase 2 cannot make unilaterally (registry ownership rule) | — (code review confirms `ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC)` or equivalent is present in `do-by-product.sql`; duplicate-row fixture proof deferred, route via PLAN-SUPPLEMENT to Phase 1 if EXECUTE confirms it is needed) | D |
| Design-quality (not a numbered AC) | Product/category rollup via `tbl_ItemGroup`/`tbl_CATEGORY` join | Known-Gap — join path not traced in RESEARCH (`erp-data-dictionary_REF_18-09-26.md` confidence LOW, "concrete next step, not attempted") | — (falls back to item-code/name-only grouping, itself proven by the AC11 drilldown scenario above) | D |
| regression | full test, lint, build, e2e regression | Fully-Automated | `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm test:e2e -- dashboards-sales.spec.ts`, `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` (plan's own Exit Gate block) | A |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: the `strategy:` column carries ONLY the 3 proving strategies (Fully-Automated /
Hybrid / Agent-Probe). Known-Gap above is a named residual row (gap-resolution D), never a strategy
that proves a behavior.

Legacy line form (retained so existing validate-contract consumers still parse):
- Sales basis/SQL layer: fully-automated: `pnpm test -- sales-basis-reconciliation` (pure decision + never-sum-across-units, zero DB precondition) | hybrid: `pnpm test -- sales-basis-reconciliation sales-money-coverage-footnote` (DB-backed reconciliation/coverage halves — precondition: `orderstock-sql` container up + `db/erp-fixture/sales-seed.sql` applied) | known-gap: category rollup join path documented, item-code fallback shipped; InventoryItem Roworder tie-break SQL pattern checklist-mandated, duplicate-fixture-row proof deferred
- Page/KPI/filters/breakdown/drilldown/money-gating/period-toggle/donut-pie: fully-automated: `pnpm test:e2e -- dashboards-sales.spec.ts` (9 scenarios, incl. 2 new PVL-fix scenarios: period-toggle round-trip, donut/pie cross-filter) | agent-probe: footnote wording/placement visual scan
- Recharts spike (time-boxed OPTIONAL, hand-rolled preferred): hybrid, only if attempted: `pnpm add recharts` + light/dark render check + precondition (real install-then-build step, React 19.2.4) | revert path: `git checkout package.json pnpm-lock.yaml`
- Full regression: fully-automated: `pnpm test && pnpm lint && pnpm build && pnpm test:e2e -- dashboards-sales.spec.ts`

### Plan updates applied

- [x] P1 — (carried from 18-09-26 outer-pvl pass, unchanged) Corrected `src/app/auth-guard.ts` →
  `src/lib/auth-guard.ts` in the IMPORT ONLY Touchpoints list.
- [x] P2 — (carried from 18-09-26 outer-pvl pass, unchanged) Added `db/erp-fixture/sales-seed.sql`
  to the Touchpoints CREATE list and the Blast Radius section.
- [x] P3 — (carried from 18-09-26 outer-pvl pass, unchanged) Rewrote the "Fixture Data
  Requirements" intro paragraph, Step A5, and the matching Risk table row.
- [x] P4 — (carried from 18-09-26 outer-pvl pass, superseded/refined by P5 below) Originally
  extended Step A3 to require `resolveSalesBasis()` have named unit coverage — this inner pass
  found the requirement, as originally worded, would need a live Prisma connection to unit-test a
  thin DB wrapper, contradicting this repo's own established convention (`app-settings.ts`, the
  pattern Step A1 mirrors, has NO unit test for its live-Prisma get/set calls). P5 below refines
  this into a DB-free pure-function split instead.
- [x] P5 (22-09-26 inner pass) — Split `resolveSalesBasis()`'s test coverage requirement (Step A3)
  into a Fully-Automated, zero-DB-precondition pure-function half (`resolveSalesBasisFromValue()`)
  plus an untested thin DB wrapper, mirroring the `locations.ts`/`locations-core.ts` DB-helper/
  pure-transform split (Test coverage dimension finding: the prior wording risked either an
  inconsistent live-DB unit test or a silently-skipped requirement at EXECUTE time).
- [x] P6 (22-09-26 inner pass) — Reclassified `sales-basis-reconciliation.test.ts`'s AC3 assertion
  and `sales-money-coverage-footnote.test.ts` from Fully-Automated to **Hybrid** (Steps A3(iii), A4)
  — both execute real SQL via `guardedQuery()` against `erp_fixture`, matching Phase 1's own
  DB-backed-check convention (fixture-present, live health probe are both Hybrid, not
  Fully-Automated). Resolves execute-agent instruction E3's classification ambiguity from the outer
  pass definitively, rather than leaving it to be discovered mid-EXECUTE (Test coverage dimension
  finding).
- [x] P7 (22-09-26 inner pass) — Corrected the Data/SQL Details `InventoryItem` bullet, which
  incorrectly stated `ItemCode` (PK) — the real PK is composite (`Roworder`, `ItemCode`) per the
  registry's Cross-Phase Precondition; `ItemCode` alone is NOT unique (~85 codes / 172 rows
  duplicated in live data). Added the highest-`Roworder`-wins tie-break requirement to Steps A2 and
  D1 as a hard, checklist-mandated, code-review-verifiable item (Infra fit + data-correctness
  finding: this plan's RESEARCH step did not record the registry-required tie-break confirmation
  before this PLAN-SUPPLEMENT — see execute-agent instruction E5).
- [x] P8 (22-09-26 inner pass) — Added a dedicated Fully-Automated, zero-DB-precondition test
  requirement (`sumQuantityByUnit()`, Step A3(ii)) for the umbrella charter's hard safety
  constraint "never sum quantities across different `MainUnits` values" — previously only the
  fixture data ensured ≥2 distinct units existed; no gate asserted the aggregation logic itself
  never collapses them into one cross-unit total (net-gate vacuous-green finding, per the task's
  own explicit emphasis on this rule this PVL cycle).
- [x] P9 (22-09-26 inner pass) — Added period-toggle (AC8) and donut/pie cross-filter-semantics
  scenarios to Step F1's e2e checklist and Fixture Data Requirement #8 (DO rows spanning ≥2
  calendar months), and added matching Verification Evidence / Test Gates rows for both — these
  two acceptance-criteria-bearing behaviors (AC8 and the Scope section's cross-filter semantics)
  previously had zero named automated gate, only implied coverage under the generic "filter URL
  round-trip" wording (net-gate vacuous-green finding).

### Execute-agent instructions

- E1 — (carried from 18-09-26 outer-pvl pass, unchanged) Before Step B (page shell), re-confirm
  Phase 1's ACTUAL delivered names for the shared data-table component, `src/lib/erp/*`'s exported
  symbols, and the exact `erp_fixture` seed-application mechanism. **This inner pass independently
  re-verified all of these against the real repo files** (see Dimension findings below) — no
  drift found; E1 stays in force as a defense-in-depth EXECUTE-time re-check in case Phase 1's
  files change again before EXECUTE actually runs.
- E2 — (carried from 18-09-26 outer-pvl pass, unchanged) Every parameterized SQL file in
  `db/erp-queries/sales/*.sql` must build its `WHERE` clause via `guardedQuery()`'s named-parameter
  `ErpQueryParams` input — never string-concatenate a filter value into the SQL text.
- E3 (refined, 22-09-26 inner pass) — The classification ambiguity this instruction originally
  flagged is now RESOLVED at plan level (see P6): `sales-basis-reconciliation.test.ts`'s AC3
  assertion and `sales-money-coverage-footnote.test.ts` are Hybrid; the `resolveSalesBasisFromValue()`
  and `sumQuantityByUnit()` halves of `sales-basis-reconciliation.test.ts` are Fully-Automated with
  zero DB precondition (see P5, P8). Execute-agent should implement to this split directly rather
  than re-deciding the classification at EXECUTE time.
- E4 — (carried from 18-09-26 outer-pvl pass, unchanged) Record the Recharts spike's pass/fail
  decision AND the actual observed peer-dependency state (never an assumed one) in the phase
  report — reframed per Defaults Taken #5: if hand-rolled CSS/SVG is shipped without attempting the
  `recharts` dependency, record "not attempted, hand-rolled preferred per Defaults Taken #5" as a
  valid, sufficient outcome; the spike is now optional, not mandatory.
- E5 (22-09-26 inner pass) — `do-by-product.sql`'s `ItemCode → InventoryItem` join and
  `sales-category-pie.tsx`'s `ItemGRP` grouping MUST resolve one canonical `InventoryItem` row per
  `ItemCode` via the highest-`Roworder`-wins tie-break (e.g. `ROW_NUMBER() OVER (PARTITION BY
  ItemCode ORDER BY Roworder DESC)` or equivalent) — registry Cross-Phase Precondition, not
  independently confirmed by this plan's own RESEARCH step (Phase Loop Progress Step 1). This is a
  hard EXECUTE-time check, not optional; the current local fixture (Phase 1's `01-seed.sql`, 10
  rows, all distinct `ItemCode`) has no duplicate row to prove this against automatically, so
  automated proof is a named Known-Gap (see Test Gates table) — the SQL implementation itself is
  NOT optional regardless, given the live data reality (~85 duplicated codes).
- E6 (22-09-26 inner pass) — If `resolveSalesBasis()`'s DB-touching half (the actual
  `prisma.appSetting` read) is written without an injectable seam, `sales-basis-reconciliation.test.ts`
  should still test ONLY the pure `resolveSalesBasisFromValue()` decision function — do not add a
  live-Prisma-connection unit test for the DB wrapper itself, matching `app-settings.ts`'s
  established (untested-wrapper) precedent. If a DB-round-trip proof of the AppSetting persistence
  is later judged necessary, it should be an agent-probe against the sandbox, mirroring this
  repo's existing convention for shops/products CRUD round-trips (`all-tests.md` § DB-level testing
  pattern), not a new live-connection unit test.

### Test gates

See the C3 5-column table and legacy line form above; all commands were cross-checked against
`package.json`'s real `scripts` block (`test`: `vitest run`, `test:e2e`: `playwright test`) and
`playwright.config.ts`'s real project `testMatch`/`testIgnore` regexes (the `chromium` project's
`testIgnore` does not exclude `dashboards-sales.spec.ts`; the `mobile` project's `testMatch` does
NOT include `dashboards-sales.spec.ts` — confirmed this inner pass — so the plan's inline
`test.use({viewport})` mobile-card scenario correctly runs under `chromium` without any config edit,
exactly as the plan's own "Registry Change Requests" section states). All Hybrid gates in this
table precondition on the LOCAL `orderstock-sql` sandbox container + `erp_fixture` database —
**none require `db_TCL`**, matching the plan's own Out of Scope declaration.

### Dimension findings

- Infra fit: CONCERN → fixed. Re-verified this inner pass against real repo files:
  `src/lib/auth-guard.ts` exists (P1's outer-pass correction holds), `src/lib/app-settings.ts`
  exists and has NO unit test for its live-Prisma get/set calls (confirms the P5/E6 convention),
  `summary/page.tsx`'s `searchParams: Promise<{...}>` shape confirmed, the `AppSetting` model
  (`key`/`value`/`updatedAt`) confirmed unchanged, all 5 `src/lib/erp/*` files present
  (`erp-adapter.ts`, `pool.ts`, `resolve-erp-database-url.ts`, `cache.ts`, `degrade.ts`), the shared
  `dashboard-data-table.tsx` accepts a caller-supplied `columns: DataTableColumn[]` prop (confirms
  E1's dynamic-column-list dependency is NOT a blocker — the caller trivially builds a different
  array per `canSeeMoney`), `nav-links.tsx` already reads "ยอดขาย" for the Sales link (Defaults
  Taken #3 already applied, no further action needed), and `db/erp-fixture/` contains only
  `00-schema.sql`/`01-seed.sql` (confirms Phase 2 must supply its own DDL in `sales-seed.sql`, per
  the plan's own Fixture Data Requirements). ONE real defect found and fixed: the `InventoryItem`
  bullet incorrectly claimed `ItemCode` is the PK (P7); the registry's Cross-Phase Precondition
  (highest-`Roworder`-wins tie-break) was not recorded as confirmed by this plan's RESEARCH step
  (fixed via P7 + E5, Known-Gap on the automated-proof half only).
- Test coverage: CONCERN → fixed. Re-ran the Test Tier Decision Waterfall against the updated
  Scope (period toggle, donut/pie cross-filter semantics) and the umbrella's hard safety
  constraint. Found and fixed: (1) `sales-basis-reconciliation.test.ts`/
  `sales-money-coverage-footnote.test.ts` were classified Fully-Automated despite querying real SQL
  against `erp_fixture` — reclassified Hybrid (P6); (2) the "never sum across units" rule had zero
  dedicated gate — added (P8); (3) AC8 (period toggle) and the Scope section's donut/pie
  cross-filter semantics had zero named Verification Evidence row — added (P9); (4) the prior
  pass's `resolveSalesBasis()` test requirement (P4) risked a live-DB unit test inconsistent with
  repo convention — refined into a pure/DB split (P5, E6). All four are net-gate vacuous-green
  findings, now closed.
- Breaking changes: PASS — unchanged from the outer pass. No existing route/schema/print-surface
  change; `resolveSalesBasis()` remains a new, additive, Sales-scoped `AppSetting` key;
  `requireAuth()`'s signature is unchanged.
- Security surface: PASS — unchanged from the outer pass. Every ERP read remains IMPORT-ONLY
  through Phase 1's `guardedQuery` choke point; money-visibility uses the existing
  `role === 'ADMIN'` server-side pattern; E2's parameterized-filter reminder stands.
- Section A feasibility (Sales basis + SQL layer): CONCERN → fixed. The `InventoryItem` PK/tie-break
  defect (P7) and the reconciliation/footnote-test DB-dependency misclassification (P6) both live
  in this section; both fixed. Highest-risk edit is now the tie-break-correct join in
  `do-by-product.sql`, mitigated via E5.
- Section B feasibility (Page shell + KPI + filters): PASS — unchanged from the outer pass.
- Section C feasibility (Chart spike): PASS — unchanged in mechanics; test-gate wording synced to
  Defaults Taken #5's reframing (hand-rolled preferred, Recharts now optional).
- Section D feasibility (Breakdown + drilldown tables): CONCERN → fixed. The category-pie grouping
  by `ItemGRP` shares the same `InventoryItem` tie-break dependency as Section A's product lookup —
  added the same E5 reinforcement to Step D1 (P7).
- Section E feasibility (Auth/mobile/shared appends): PASS — unchanged from the outer pass.
- Section F feasibility (Tests): CONCERN → fixed. F1's e2e checklist enumeration did not name the
  period-toggle or donut/pie scenarios despite both being Scope/AC-bearing behaviors — added (P9).

Open gaps: One accepted, non-blocking Known-Gap on record (product/category rollup join path,
carried unchanged from the outer pass). One NEW accepted, non-blocking Known-Gap this inner pass:
InventoryItem highest-`Roworder`-wins tie-break's automated proof against a duplicate-`ItemCode`
fixture row — the SQL implementation itself is checklist-mandated and non-optional (Step A2/D1,
E5); only the fixture-backed automated PROOF is deferred, because the shared/base fixture file
(`db/erp-fixture/01-seed.sql`, Phase 1's own file) has no duplicate-`ItemCode` row and Phase 2
cannot add one unilaterally per the registry's ownership rule — route to Phase 1 via
PLAN-SUPPLEMENT if EXECUTE confirms this proof is needed. Two classification clarifications
resolved definitively this pass (E3/E6), no longer open.

### What This Coverage Does NOT Prove

- The Fully-Automated pure-function tests (`resolveSalesBasisFromValue()`, `sumQuantityByUnit()`)
  prove the DECISION and AGGREGATION logic is correct in isolation; they do NOT prove the
  DB-touching `resolveSalesBasis()` wrapper itself correctly reads/writes the `salesBasis`
  `AppSetting` row against a live Prisma connection — that round-trip is untested by design (E6),
  matching this repo's `app-settings.ts` precedent, and would need an agent-probe if ever needed.
- The Hybrid reconciliation/coverage tests prove the ARITHMETIC and SQL are correct against
  `erp_fixture` data; they do NOT prove the real, eventual `db_TCL` scoped read-only login can
  execute these same queries under production permissions (AC18's Agent-Probe row, owned by
  Phase 5).
- The Fully-Automated e2e suite (incl. the two new period-toggle and donut/pie scenarios) proves
  navigation/auth/filter/sort/mobile/cross-filter behavior against `erp_fixture`; it does NOT prove
  visual/typographic quality of any chart, the footnote, or the KPI tiles — that is the Agent-Probe
  row's job, and it is explicitly NOT automated.
- The Known-Gap InventoryItem tie-break row proves the SQL PATTERN is checklist-mandated and
  code-review-verifiable; it does NOT prove, via an automated fixture-backed test, that the
  tie-break actually resolves correctly on a real duplicate-`ItemCode` row, because no such row
  exists in the current local fixture and Phase 2 cannot add one unilaterally.
- The Known-Gap product/category rollup fallback proves the BASIC product breakdown (by item
  code/name) works; it does NOT prove a category-level rollup exists via
  `tbl_ItemGroup`/`tbl_CATEGORY`, because that join path was never traced.
- None of these gates prove Phase 1's actual deliverables match this plan's assumed names/shapes
  at the moment EXECUTE actually runs — this inner pass re-confirmed them fresh (Dimension findings
  above), but a future drift before EXECUTE begins would still need E1's re-check.

Gate: PASS (no FAILs; 5 new plan-text fixes applied this inner pass — P5-P9 — on top of the 4
carried from the outer pass; 2 execute-agent instructions refined — E3, E4 — and 2 new ones added
— E5, E6; 2 known-gaps on record, one carried unchanged, one new this pass, both non-blocking)

Accepted by: session (autonomous inner-PVL run, /goal-style automatic execution per orchestrator
instruction — no user menu presented) — no CONCERN required user acceptance because every concern
found (Infra fit, Test coverage, and their 5 Section-level echoes) was resolved directly in the
plan text (P5-P9) rather than merely accepted; the two Known-Gaps (product/category rollup;
InventoryItem tie-break automated proof) are both named residuals with written justification and a
clear resolution path (PLAN-SUPPLEMENT to Phase 1 if/when needed), not silent passes.
