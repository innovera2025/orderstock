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
**Status**: ⏳ PLANNED
**Program:** erp-dashboards
**Umbrella plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
**SPEC (frozen, governs this phase):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
**Blast-radius registry:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-blast-radius-registry.md` (Phase 2 section — OWNED PATHS below MUST match that section)
**Phase status:** ⏳ PLANNED
**Report destination:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_REPORT_18-09-26.md` (flat in the program task folder)

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
- `InventoryItem` — `ItemCode` (PK), `ItemGRP` (2-char group code; joins `tbl_ItemGroup.ICCode`;
  `'F'`=finished goods is the group most Sales lines will fall under, but do not filter by ItemGRP
  unless a fixture row proves cross-group DO lines exist — RESEARCH should confirm this before
  EXECUTE), `MainUnits` (35 distinct live values — **NEVER SUM quantities across different
  `MainUnits` values into one number; aggregate strictly per-unit or per-product**, per the umbrella
  Program Goal Charter's hard safety constraint). The exact join path from `tbl_Dodtl.ItemCode` →
  `tbl_ItemGroup`/`tbl_CATEGORY` for a "category" breakdown was NOT executed during RESEARCH
  (confirmed only that the tables exist via `sys.tables`) — if this phase's RESEARCH step cannot
  confirm the join column within its own budget, the product breakdown groups by `ItemCode`/item
  name only (no category rollup) and the category gap is recorded as a known-gap in the phase
  report, not invented.
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

### Fixture Data Requirements (`erp_fixture`, owned jointly with Phase 1's DDL — this phase supplies SEED ROWS only, not the DDL)

The fixture seed rows this phase depends on are written to `db/erp-fixture/sales-seed.sql` —
Phase 2's exclusively-owned per-domain seed file per the registry's "Per-Domain Fixture Seed
Split" rule (PVL fix, 18-09-26: the registry resolved this ownership question after this
paragraph was first drafted; this phase NEVER appends to Phase 1's shared/base
`db/erp-fixture/*.sql` file — if a shared/base table or column is missing, the gap is routed back
to Phase 1 via PLAN-SUPPLEMENT, never edited directly here):
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

---

## UI Details (Thai labels)

- Page title: "การขาย" (Sales)
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

1. **INNOVATE step:** decide the ONE chart to spike (recommend: quantity-per-unit or DO-count-by-week
   bar chart — pick whichever has the most fixture rows to render meaningfully).
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

- [ ] A1. Create `src/lib/sales-basis.ts`: `resolveSalesBasis()` reading an `AppSetting` key (e.g.
  `salesBasis`, mirroring `src/lib/app-settings.ts`'s key/get/set pattern) that currently only
  resolves to `"do"` (DO/DOdtl basis); document the extension point for a future `"so"`/`"invoice"`
  value without implementing it. Confirm during RESEARCH whether Phase 1 already stubbed a
  shared `resolveXxxBasis`-style helper to mirror, and whether the `AppSetting` model needs a new
  key registered anywhere else (check `src/lib/app-settings.ts`'s `APP_SETTING_KEYS` — this phase's
  key is Sales-scoped and independent, so it should live in its OWN small helper rather than
  extending Phase-02-unowned `app-settings.ts`, unless RESEARCH finds a strong reason to share).
- [ ] A2. Write `db/erp-queries/sales/do-headers.sql`, `do-lines.sql`, `do-by-product.sql`,
  `do-by-customer.sql`, `sales-invoice-excluded-total.sql` — parameterized `SELECT`/`WITH`-only SQL
  matching the Data/SQL Details section above; every query passes through `guardedQuery()`.
- [ ] A3. Write `src/lib/__tests__/sales-basis-reconciliation.test.ts` — asserts header-sum-equals-
  detail-sum against the `erp_fixture` seed data (AC3), AND asserts `resolveSalesBasis()` itself:
  returns `"do"` when the `salesBasis` AppSetting is unset (default), returns `"do"` when explicitly
  set to `"do"`, and documents (via a code comment + a skipped/todo test case, not a real assertion)
  the not-yet-implemented `"so"`/`"invoice"` extension point — PVL fix, 18-09-26: this function is
  developed behavior in Step A1 and needs its own named automated gate, not just the DO-basis
  arithmetic it enables.
- [ ] A4. Write `src/lib/__tests__/sales-money-coverage-footnote.test.ts` — asserts the coverage %
  calculation and the excluded-total query return the expected fixture numbers (AC4's automated
  half; the footnote wording/placement itself is the Hybrid/Agent-Probe half — see Verification
  Evidence).
- [ ] A5. Create `db/erp-fixture/sales-seed.sql` (Phase 2's exclusively-owned per-domain seed
  file — see registry) with the fixture seed rows listed under "Fixture Data Requirements" above,
  and apply it against the `erp_fixture` sandbox database using the same manual/CI mechanism
  Phase 1's own `00-schema.sql`/`01-seed.sql` documents (confirm the exact invocation during
  RESEARCH — do not invent a new mechanism). Never edit Phase 1's base `db/erp-fixture/*.sql` file.

### Step B — Page shell + KPI tiles + filters

- [ ] B1. Create `src/app/(main)/dashboards/sales/page.tsx` — `requireAuth()`, `force-dynamic`,
  reads `searchParams` (confirm `Promise<{...}>` shape per Next 16 convention — see `summary/page.tsx`
  for the exact pattern already used in this codebase), computes `canSeeMoney`, renders the pilot
  banner (Phase 1 component), the degrade banner (conditionally, Phase 1 component), and dispatches
  to `sales-breakdown-tables.tsx` / `do-list-table.tsx` / `do-lines-table.tsx` per the Drilldown
  Routing Decision.
- [ ] B2. Create `src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx` — renders `Card`-wrapped tiles
  for delivery count, line count, per-unit quantity (one row per unit, never combined), and the
  Admin-only money tile + coverage % + reconciliation footnote.
- [ ] B3. Wire date-range (`from`/`to`) filter UI updating the URL (mirrors `shop-location-filter`'s
  `useRouter`-driven `?location=` navigation precedent) — reload reproduces the same filtered view
  (AC10).

### Step C — Chart (Recharts spike)

- [ ] C1. Run the Recharts spike per "Recharts Spike — Step-by-Step" above; create
  `src/app/(main)/dashboards/sales/sales-chart.tsx` with the adopted or fallback implementation.
- [ ] C2. Record the pass/fail decision + actual peer-dep state in this phase's report (not just in
  chat) — Phase 3/4 read this before their own INNOVATE step.

### Step D — Breakdown + drilldown tables

- [ ] D1. Create `src/app/(main)/dashboards/sales/sales-breakdown-tables.tsx` — product breakdown
  (group by `ItemCode`/item name; category rollup ONLY if RESEARCH confirmed the join path, else
  documented known-gap) and customer breakdown (group by `CustCode`, display `CustName`), each row
  linking to the filtered DO list (Drilldown Routing Decision).
- [ ] D2. Create `src/app/(main)/dashboards/sales/do-list-table.tsx` using Phase 1's shared
  data-table component — sort + paginate + dynamic money column (per `canSeeMoney`) + mobile card
  view (confirm the shared component's mobile-card behavior is automatic — if not, this phase adds
  the card-view branch itself, mirroring `users-mobile.tsx`'s pattern).
- [ ] D3. Create `src/app/(main)/dashboards/sales/do-lines-table.tsx` — line-item detail for a
  selected `doNo`, same money-gating + mobile pattern.

### Step E — Auth, mobile, and shared-file appends

- [ ] E1. Confirm `requireAuth()` (no role param) gates `/dashboards/sales` for both ADMIN and STAFF
  — SPEC AC1/AC2 (unauth → redirect to login, matching `e2e/auth.spec.ts`'s existing pattern).
- [ ] E2. Verify mobile-card rendering at 390×844 (AC13) — either automatic via Phase 1's shared
  component, or an explicit `md:hidden` card branch in `do-list-table.tsx` mirroring
  `users-mobile.tsx`.
- [ ] E3. Append this phase's new route(s) to `src/lib/__tests__/auth-guard-coverage.test.ts`
  (append-only — do not touch other phases' entries).
- [ ] E4. Update this phase's own status line in the `erp-dashboards` feature entry inside
  `process/context/all-context.md` (append/update only the Phase-2 line, per registry rule).

### Step F — Tests

- [ ] F1. Write `e2e/dashboards-sales.spec.ts` covering: nav visibility (shared with Phase 1's own
  gate — this phase only asserts the Sales link specifically), auth redirect, reconciliation display,
  coverage/footnote presence, filter URL round-trip, drilldown navigation (breakdown row → DO list →
  DO lines), sort+paginate, mobile card view (`test.use({ viewport: { width: 390, height: 844 } })`
  inline in the spec file — do NOT edit `playwright.config.ts`; this keeps the mobile-viewport gate
  entirely inside this phase's OWNED path, see Registry Change Requests below for why).
- [ ] F2. Run `pnpm test` (targeted: `sales-*.test.ts`) and `pnpm test:e2e -- dashboards-sales.spec.ts`
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

- [ ] 1. RESEARCH — research-agent: confirm Phase 1's actual delivered exports/file names (shared
  data-table component API, `src/lib/erp/*` exports, `erp_fixture` seed file structure), confirm
  `searchParams` Promise shape, confirm (or rule out within budget) the `ItemCode → tbl_ItemGroup`
  join path
- [ ] 2. INNOVATE — innovate-agent: decide which single chart to spike with Recharts; confirm the
  Drilldown Routing Decision above still holds after RESEARCH; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: update this phase plan with RESEARCH/INNOVATE findings (or
  "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per
  `.claude/skills/vc-validate-findings/references/example-validate-output.md` (Status / Gate / Plan
  updates applied / Execute-agent instructions / Test gates / High-risk pack / Backlog artifacts /
  Known gaps / Accepted by)
- [ ] 5. EXECUTE — all checklist items (A-F) done; per-section test gates run and green (or gaps
  documented); Recharts spike decision recorded in the phase report
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella `## Current Execution State` updated,
  commit done

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
8. `pnpm test`, `pnpm lint`, `pnpm build`, and the new `dashboards-sales.spec.ts` e2e suite all pass.

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
| `sales-basis-reconciliation.test.ts` — header sum equals detail sum on fixture data | Fully-Automated | AC3 |
| `sales-basis-reconciliation.test.ts` — `resolveSalesBasis()` defaults to `"do"` and reads the `salesBasis` AppSetting correctly (PVL fix, 18-09-26) | Fully-Automated | Umbrella charter's "switch mechanism built" claim — no numbered AC, closes a net-gate coverage gap |
| `sales-money-coverage-footnote.test.ts` — coverage % calculation + excluded-total query return expected fixture numbers | Fully-Automated (numeric half) | AC4 (numeric half) |
| Agent-probe visual check of footnote wording/placement (names the excluded ฿858,937.21 explicitly, visible directly under the money tile) | Agent-Probe | AC4 (wording/placement half) |
| `dashboards-sales.spec.ts` — unauth redirect | Fully-Automated | AC2 |
| `dashboards-sales.spec.ts` — money column present for ADMIN session, absent from server-rendered HTML for STAFF session (not CSS-hidden) | Fully-Automated | AC9 (Sales) |
| `dashboards-sales.spec.ts` — filter URL round-trip (`from`/`to` params, reload reproduces view) | Fully-Automated | AC10 (Sales) |
| `dashboards-sales.spec.ts` — breakdown row → DO list → DO lines navigation | Fully-Automated | AC11 (Sales) |
| `dashboards-sales.spec.ts` — sort + paginate DO list without losing filters | Fully-Automated | AC12 (Sales) |
| `dashboards-sales.spec.ts` — mobile card view at 390×844 (`test.use()` inline viewport override) | Fully-Automated | AC13 (Sales) |
| Recharts spike — `pnpm add recharts`, render one chart light+dark, record actual peer-dep resolution | Hybrid (requires real install/build step; pass/fail judged against observed, not assumed, state) | Umbrella Phase-2 exit gate's "Recharts spike decision recorded" |
| Product/category rollup via `tbl_ItemGroup`/`tbl_CATEGORY` join | Known-Gap (if RESEARCH cannot confirm the join path within budget — falls back to item-code-only grouping, backlog note written) | n/a — not a numbered AC; a design-quality item noted in Background/Research Findings |

---

## Test Infra Improvement Notes

(none identified yet — this is the first phase to build an e2e spec against `erp_fixture`; if the
fixture-seeding mechanism proves awkward to extend per-domain, note it here during EXECUTE for
Phase 3/4 and Phase 5's benefit)

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_PLAN_18-09-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: spawn vc-research-agent for RESEARCH (Step 1) — confirm Phase 1's actual delivered file
  names/exports before writing any code against assumed names in this plan's Touchpoints section.
- Dependency: this phase cannot begin EXECUTE until Phase 1's exit gate has passed (see Entry Gate).

---

## Validate Contract

Status: PASS
Date: 18-09-26
date: 2026-09-18
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: Signal score 2/7 (S4 phase-program classification, S7 5+ files in blast radius —
S1/S2/S3/S5/S6 not present: single Next.js app not a multi-package monorepo, no schema/API/auth
primitive change, INNOVATE has not surfaced 3+ directions, no explicit user depth request, and
`canSeeMoney = role === 'ADMIN'` reuses an existing role-check pattern rather than a new
trust-boundary primitive). Nominal band is MEDIUM (parallel-subagents), but Strategy-by-Fit
overrides to **sequential, single vc-execute-agent (opus)**: Implementation Checklist Steps
A→B→C→D→E→F are sequentially dependent (B/D import A's SQL layer + `resolveSalesBasis()`; E
depends on B/D existing; F depends on all) — no independent-review fan-out benefit exists here.
Run Steps A→F in order with the per-section test gate discipline the plan's Step F2 already
specifies (fix inline before advancing, per `phase-programs.md`).

Test gates (C3 5-column table — ADDITIVE; existing consumers still parse the legacy line form below it):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC3 | DO/DOdtl reconciliation: header sum = detail sum on fixture data | Fully-Automated | `pnpm test -- sales-basis-reconciliation` (`src/lib/__tests__/sales-basis-reconciliation.test.ts`) | A |
| infra (net-gate fix) | `resolveSalesBasis()` defaults to `"do"` and reads the `salesBasis` AppSetting key correctly | Fully-Automated | `pnpm test -- sales-basis-reconciliation` (same file, extended per PVL fix — see Plan updates applied) | A |
| AC4 (numeric half) | coverage % (priced/unpriced ratio) + excluded-total (`SalesInvoiceHdr`, ฿858,937.21-equivalent fixture pool) query return expected fixture numbers | Fully-Automated | `pnpm test -- sales-money-coverage-footnote` (`src/lib/__tests__/sales-money-coverage-footnote.test.ts`) | A |
| AC4 (wording/placement half) | reconciliation footnote names the excluded amount explicitly, rendered directly under the money tile | Agent-Probe | Manual visual scan of `/dashboards/sales` (Admin session) after EXECUTE — confirm footnote text names the excluded ฿-figure and sits immediately under the money tile, never separately hidden | A |
| AC1 (Sales slice) | "แดชบอร์ด" nav Sales link resolves to a working `/dashboards/sales` page for Staff/Admin | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (nav + page-load scenario) | A |
| AC2 | unauthenticated request to `/dashboards/sales` redirects to login | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (auth-redirect scenario) | A |
| AC9 (Sales slice) | Admin sees every money figure/column/series; Staff sees none, server-side (diffed server-rendered HTML, not CSS-hidden) | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (money-visibility-role-gate scenario) | A |
| AC10 (Sales slice) | date-range filter URL round-trip; reload reproduces the filtered view | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (filter-url-roundtrip scenario) | A |
| AC11 (Sales slice) | breakdown row → DO list → DO lines drilldown navigation | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (drilldown-navigation scenario) | A |
| AC12 (Sales slice) | DO list sort + paginate without losing filters | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (table-sort-paginate scenario) | A |
| AC13 (Sales slice) | mobile card view at 390×844 (inline `test.use()` viewport override, no `playwright.config.ts` edit) | Fully-Automated | `pnpm test:e2e -- dashboards-sales.spec.ts` (mobile-card-view scenario) | A |
| Umbrella exit gate | Recharts adopt-or-fallback spike decision recorded with the ACTUAL observed peer-dependency state (not assumed) | Hybrid — precondition: `pnpm add recharts` actually run against React 19.2.4 in a real install/build step; pass/fail judged against observed, not assumed, state | `pnpm add recharts` + render `sales-chart.tsx` light+dark against fixture data; on FAIL, `git checkout package.json pnpm-lock.yaml` + hand-rolled CSS-bars fallback (plan's own Step C1/C2 procedure) | B |
| Design-quality (not a numbered AC) | Product/category rollup via `tbl_ItemGroup`/`tbl_CATEGORY` join | Known-Gap — join path not traced in RESEARCH (`erp-data-dictionary_REF_18-09-26.md` confidence LOW, "concrete next step, not attempted") | — (falls back to item-code/name-only grouping, itself proven by the AC11 drilldown scenario above) | D |
| regression | full build/lint/e2e regression | Fully-Automated | `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm test:e2e -- dashboards-sales.spec.ts`, `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` (plan's own Exit Gate block) | A |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: the `strategy:` column carries ONLY the 3 proving strategies (Fully-Automated /
Hybrid / Agent-Probe). Known-Gap above is a named residual row (gap-resolution D), never a strategy
that proves a behavior.

Legacy line form (retained so existing validate-contract consumers still parse):
- Sales basis/SQL layer: Fully-automated: `pnpm test -- sales-basis-reconciliation sales-money-coverage-footnote` | known-gap: category rollup join path documented, item-code fallback shipped
- Page/KPI/filters/breakdown/drilldown/money-gating: Fully-automated: `pnpm test:e2e -- dashboards-sales.spec.ts` (7 scenarios) | agent-probe: footnote wording/placement visual scan
- Recharts spike: hybrid: `pnpm add recharts` + light/dark render check + precondition (real install/build step, React 19.2.4) | revert path: `git checkout package.json pnpm-lock.yaml`
- Full regression: fully-automated: `pnpm test && pnpm lint && pnpm build && pnpm test:e2e -- dashboards-sales.spec.ts`

### Plan updates applied

- [x] P1 — Corrected `src/app/auth-guard.ts` → `src/lib/auth-guard.ts` in the IMPORT ONLY
  Touchpoints list (Layer 1 infra-fit finding: path did not exist at the stated location; verified
  the real import path via `src/app/(main)/summary/page.tsx`/`history/page.tsx`, both of which
  import `requireAuth` from `@/lib/auth-guard`).
- [x] P2 — Added `db/erp-fixture/sales-seed.sql` to the Touchpoints CREATE list and the Blast
  Radius section (Layer 2 Section A finding: the registry's "Per-Domain Fixture Seed Split" rule
  exclusively grants Phase 2 this file, but it was missing from both lists — an omission that could
  have led execute-agent to append rows into Phase 1's shared base fixture file instead, which the
  registry explicitly forbids).
- [x] P3 — Rewrote the "Fixture Data Requirements" intro paragraph, Step A5, and the matching Risk
  table row to remove the stale "OR ... confirm during RESEARCH" / "confirm whether Phase 1's seed
  file is append-friendly" hedge language (Layer 2 Section A finding: this wording pre-dated the
  registry's per-domain seed-file split and directly conflicted with it — the registry itself
  already flags this exact ambiguity as resolved "regardless of any earlier phase-plan wording to
  the contrary"). All three now unambiguously state Phase 2 creates and owns only
  `db/erp-fixture/sales-seed.sql` and never edits Phase 1's base file.
- [x] P4 — Extended Step A3 to require `resolveSalesBasis()` itself have named unit coverage
  (defaults to `"do"`; reads the `salesBasis` AppSetting key correctly) and added a matching
  Verification Evidence row (Net-gate vacuous-green ban finding: this function is developed
  behavior introduced by Step A1 that had zero named automated/hybrid gate — only the DO-basis
  arithmetic it enables was covered, not the resolver/switch mechanism itself).

### Execute-agent instructions

- E1 — Before Step B (page shell), re-confirm Phase 1's ACTUAL delivered names for: the shared
  data-table component's file/export name, its dynamic (role-conditional) column-list prop
  contract, `src/lib/erp/*`'s exported symbols, and the exact `erp_fixture` seed-application
  mechanism. If any name has drifted from what this plan assumes, update the edit target and
  record the correction in the phase report — do NOT guess or silently rename. If the shared
  component cannot support a dynamic column list, this blocks Step D2/D3 and must route to a
  PLAN-SUPPLEMENT on Phase 1's plan, not a workaround edit to Phase 1's owned files (already stated
  in the plan's own "Blockers" section — reinforced here as a hard EXECUTE-time check).
- E2 — Every parameterized SQL file in `db/erp-queries/sales/*.sql` (esp. `do-by-product.sql`/
  `do-by-customer.sql`, which take optional `customer`/`product`/`from`/`to` filter params) must
  build its `WHERE` clause via `guardedQuery()`'s named-parameter `ErpQueryParams` input — never
  string-concatenate a filter value into the SQL text, even for an optional/sometimes-absent filter.
  This is the STRIDE/injection-surface finding from the security-surface dimension check: optional
  filter combinations are exactly the shape that tempts ad hoc string-building.
- E3 — Confirm at EXECUTE time whether `sales-basis-reconciliation.test.ts` and
  `sales-money-coverage-footnote.test.ts` connect to a REAL `erp_fixture` sandbox DB connection
  (via `guardedQuery`/the ERP pool) or assert against an in-memory JSON/object fixture (mirroring
  this codebase's existing `test-fixtures/sheet-13-03-69.json` + `totals.test.ts`/`roster.test.ts`
  pattern). If they require a live sandbox connection, reclassify both as **Hybrid** (precondition:
  sandbox container up + `erp_fixture` seeded) in the phase report and this plan's Verification
  Evidence table — matching Phase 1's own convention of classifying its `/api/health/erp` DB-backed
  check as Hybrid, not Fully-Automated. This is a classification clarification only; it does not
  change the underlying test content or the net gate.
- E4 — Record the Recharts spike's pass/fail decision AND the actual observed peer-dependency
  state (never an assumed one) in the phase report per Step C2 — this is Phase 3/4's own INNOVATE
  input, not just this phase's own record.

### Test gates

See the C3 5-column table and legacy line form above; all commands were cross-checked against
`package.json`'s real `scripts` block (`test`: `vitest run`, `test:e2e`: `playwright test`) and
`playwright.config.ts`'s real project `testMatch`/`testIgnore` regexes (the `chromium` project's
`testIgnore` does not exclude `dashboards-sales.spec.ts`, so the plan's inline `test.use({viewport})`
mobile-card scenario runs correctly without a config edit, exactly as the plan's own "Registry
Change Requests" section states).

### Dimension findings

- Infra fit: PASS — Next 16 App Router `(main)` route-group pattern, `searchParams: Promise<{...}>`
  shape, `AppSetting` model, `Card`/`Chip` primitives, and the `users-mobile.tsx` mobile-card
  precedent were all cross-checked against real repo files and confirmed compatible. One path error
  found and fixed (P1).
- Test coverage: PASS — full Fully-Automated/Hybrid/Agent-Probe/Known-Gap waterfall correctly
  applied per `vc-test-coverage-plan`; one net-gate vacuous-green gap found and fixed (P4, see
  above); one tier-classification ambiguity noted as an execute-agent instruction (E3), not blocking.
- Breaking changes: PASS — no existing route/schema/print-surface change; `resolveSalesBasis()` is
  a new, additive, Sales-scoped `AppSetting` key that does not alter `src/lib/app-settings.ts`'s
  existing `APP_SETTING_KEYS` contract; `requireAuth()`'s signature is unchanged.
- Security surface: PASS — every ERP read is IMPORT-ONLY through Phase 1's `guardedQuery` choke
  point (never invented here); money-visibility uses the existing `role === 'ADMIN'` server-side
  pattern, never a client-side hide; one hardening instruction added (E2, parameterized-filter
  reminder) as defense-in-depth, not a blocking finding.
- Section A feasibility (Sales basis + SQL layer): PASS after fix — mechanically feasible (all
  target files are new, no collision); gap found (fixture-seed-file ownership ambiguity vs. the
  registry) and fixed (P2/P3); highest-risk edit is the optional-filter SQL param-building,
  mitigated via E2.
- Section B feasibility (Page shell + KPI + filters): PASS — `searchParams` Promise pattern
  confirmed against the real, currently-passing `summary/page.tsx`; dynamic-column-list dependency
  on Phase 1's not-yet-built component is correctly deferred to RESEARCH/E1, not assumed.
- Section C feasibility (Chart spike): PASS — self-contained, time-boxed, explicit revert path;
  no repo file currently depends on `recharts`/`react-is` (confirmed absent from `package.json`).
- Section D feasibility (Breakdown + drilldown tables): PASS — same dynamic-column-list dependency
  as Section B, same mitigation (E1).
- Section E feasibility (Auth/mobile/shared appends): PASS after fix — the wrong `auth-guard.ts`
  path was the only defect found (P1); append-only touches (`auth-guard-coverage.test.ts`,
  `all-context.md`) exactly match the registry's Phase 2 shared-file rules.
- Section F feasibility (Tests): PASS — `pnpm test`/`pnpm test:e2e` commands and the `chromium`
  project's `testIgnore` regex were verified against the real `package.json`/`playwright.config.ts`,
  not assumed.

Open gaps: none unresolved. One accepted, non-blocking Known-Gap on record (product/category
rollup join path — see Known Gaps below); one classification clarification left to execute-agent
(E3, non-blocking).

### What This Coverage Does NOT Prove

- The Fully-Automated reconciliation/coverage unit tests prove the ARITHMETIC is correct against
  fixture data; they do NOT prove the real, eventual `db_TCL` scoped read-only login can execute
  these same queries under production permissions (that is AC18's Agent-Probe row, owned by Phase 5).
- The Fully-Automated e2e suite proves navigation/auth/filter/sort/mobile behavior against
  `erp_fixture`; it does NOT prove visual/typographic quality of the footnote or KPI tiles — that is
  the Agent-Probe row's job, and it is explicitly NOT automated.
- The Hybrid Recharts spike proves ONE chart renders correctly against small fixture volumes in both
  themes; it does NOT prove chart performance/legibility at real production data volumes (the
  program's own data reality is genuinely small — 73 DOs, 1,433 lines — so this is a low-priority gap).
- The Known-Gap product/category rollup fallback proves the BASIC product breakdown (by item
  code/name) works; it does NOT prove a category-level rollup exists, because the join path was
  never traced (`erp-data-dictionary_REF_18-09-26.md` §B, confidence LOW) — the fallback is a
  deliberate scope reduction, not a bug.
- None of these gates prove Phase 1's actual deliverables match this plan's assumed names/shapes —
  that is RESEARCH (Step 1) + execute-agent instruction E1's explicit job, re-run fresh at EXECUTE
  time, not assumed from this PVL pass.

Gate: PASS (no FAILs, plan updated — 4 plan-text fixes applied; 4 execute-agent instructions
recorded; 1 known-gap on record, matching the plan's own pre-existing acceptance)

Accepted by: session (autonomous outer-PVL run) — no CONCERN required user acceptance because
every concern found was resolved directly in the plan text (P1–P4) rather than merely accepted;
the one Known-Gap (product/category rollup) was already documented and accepted by the plan's own
Risks/Phase Completion Rules sections before this PVL pass, and is re-confirmed here, unchanged.
