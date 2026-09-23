---
name: sales-invoice-basis-pvl-iteration-006
description: PVL cycle 6 — re-validate from V1 against real source files; confirms cycle-5's fixes hold, regression-clean on cycles 1/3, and lands the plan at CONDITIONAL with one new deep-layer CSV-export concern
date: 2026-09-23
metadata:
  type: report
  loop: PVL
  cycle: 6
  plan: process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md
---

# PVL iteration 006 — sales-invoice-basis

## Verdict: Gate: CONDITIONAL (0 FAIL, 1 new CONCERN, cycles 1/3/4 fixes confirmed intact)

## What this cycle did differently
Prior cycles progressively moved from "does the plan mention the right file" (cycle 2) to "does
the named file's real code do what the plan assumes" (cycle 4). This cycle went one layer further:
for the fixes cycle 5 just applied, does the *mechanism* actually work once **two tables render
from the same URL state at once** — which is the plan's own headline design (invoice section +
delivery section, simultaneously, on the default view)?

## Cycle-5's 4 fixes — all confirmed correct against real files
- `dashboard-export-target.ts` read in full: `deriveExportTarget()` line 51-54 and
  `parseExportTarget()` line 97-105 match the plan's cited defect exactly.
- `export-datasets.ts` read in full: the `default: return productionLines(...)` catch-all at
  line 337-338 matches exactly; no `sales:invoice-*` cases exist yet (correct — not built yet).
- `sales-unavailable.tsx` read in full (62 lines): confirmed it IS the whole-page shell
  (`<main data-testid="sales-dashboard">` wrapping header/PilotBanner/SalesFilterBar/notice/Card).
  The cycle-5 fix's scoping of the new fragment (banner + card only, lines ~41-59) is precisely
  correct — no more, no less than what must be extracted.
- `sales-kpi-tiles.tsx:143`, `sales-basis-core.ts:375` (`reconciliationNote`),
  `sales-seed.sql:210` ("EXCLUDED pool" comment), `sales-unavailable.tsx:35` (subtitle) — all six
  S13 locations independently re-read and confirmed real, matching the plan's rewritten checklist.
- `sales-basis-reconciliation.test.ts` describe block name confirmed byte-exact:
  `"resolveSalesBasisFromValue — the sales-basis switch decision"`.

## Cycles 1 & 3 — regression-clean
Grepped the current plan text for both historical wrong paths
(`src/lib/erp/erp-query-columns.ts`, `src/lib/sales-url.ts`) — the only hit is the cycle-3
recap line that names them *as the thing that no longer appears*, not a live recurrence.
`db/erp-fixture/00-schema.sql`, `SALES_SQL_SOURCES`, the additive `ExportTable` union, and the
`CustOrSuppCode`/`cat`/`status` semantics are all still present and internally consistent. Manifest
independently checked: `dbo.SalesInvoiceHdr` (151 cols) present, `dbo.SalesInvoiceDtl` correctly
absent (Step S1 will add it); `00-schema.sql` mirrors the same state. `SalesBasis` confirmed to
have exactly 2 real call sites repo-wide (`sales-basis.ts`, `sales-basis-core.ts`), matching the
plan's claim.

## New finding this cycle (CONCERN, not FAIL)
`DoListTable` (existing) and any new `InvoiceListTable` both call the shared
`DashboardDataTable` with the **same** `basePath="/dashboards/sales"`. Today `deriveExportTarget()`
tells them apart because at most one of them is ever mounted at a time (`view === "documents"` vs
`"summary"`/`"lines"` are mutually exclusive branches in the current `page.tsx`) — proven by
reading `sales-breakdown-tables.tsx`'s own comment: it opts out of the auto-derived export button
(`exportHref={false}`) specifically *because* `deriveExportTarget()` can't tell a breakdown table
apart from the DO list table on the same URL, and would silently hand it the wrong file.

The plan's new 5-value `view` enum (`summary | invoice-documents | invoice-lines |
delivery-documents | delivery-lines`) does keep the two sections' *document-list* tables mutually
exclusive (only one of `invoice-documents`/`delivery-documents` is ever the active view at once),
so the worst-case collision I first suspected — both list tables mounted together on `summary` —
does not materialize, provided EXECUTE keeps that mutual exclusivity (which the single `view`
string structurally enforces). But once neither `doNo` nor `invoiceNo` is present (i.e. exactly
the list-level, non-drilldown case for either section), the **only** signal left to tell
"invoice section's list" from "delivery section's list" apart is `searchParams.view` itself — and
the plan's Step S11 instruction ("derive the table from the resolved section... using the same
view/invoiceNo/doNo state sales-url.ts's own parser resolves") does not say *how*
`dashboard-export-target.ts` — a deliberately dependency-free, no-React/Next/DB, generic-across-3-
dashboards utility — obtains that same section-resolution precedence without either duplicating
`sales-url.ts`'s precedence rules (a drift risk with no drift-test named, unlike the byte-identical
SQL/TS mirror this codebase is otherwise careful to gate) or importing `parseSalesUrl` directly
(which couples a currently dashboard-agnostic file to one dashboard's page module).

This is why it lands as CONDITIONAL, not BLOCKED: the mechanism (`view` param) genuinely IS
sufficient information, and any reasonable EXECUTE choice compiles and works — this is a real gap
in explicitness, not a defect that ships broken.

## Trend
FAIL counts per validation pass: 4 → 4 → 2 → 0. Each pass has gone one layer deeper into the same
CSV-export runtime-wiring area and found something narrower each time — this is the expected shape
of a convergent loop reaching its floor, not a stall. Cycles used: 6 of 10.

## Next
Route to EXECUTE per the CONDITIONAL gate. Step S11 gains one required execute-agent instruction
(name the section-resolution mechanism explicitly + add the view-only test scenarios) — see the
plan's `## Validate Contract` for the exact wording.
