---
name: sales-invoice-basis-pvl-iteration-005
description: PVL cycle 5 — supplement wiring the CSV export runtime path, closing a wrong-data-served catch-all, and splitting the ERP-unavailable component so it can degrade per section
date: 2026-09-23
metadata:
  type: report
  loop: PVL
  cycle: 5
  plan: process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md
---

# PVL iteration 005 — sales-invoice-basis

## Gaps closed (2 FAIL + 2 CONCERN)

**Gap 1 (FAIL) — CSV export was wired to fail on every click.** The type widening from cycle 3 was
correct but touched nothing that makes an export work. Three real call sites were missing from the
plan: `deriveExportTarget()` picks the sales export shape from `doNo` presence alone;
`parseExportTarget()` hard-rejects anything but `"list"`/`"lines"` (a 400 before the loader is ever
reached); and `loadExportDataset()` has no invoice cases. Both files are now in
Touchpoints/Blast Radius, and Step S11 requires a full
`deriveExportTarget → buildExportHref → parseExportTarget → loadExportDataset` round-trip test plus
an end-to-end HTTP-200-with-real-rows assertion — a type-level check alone would have passed while
every click 400'd.

**The orchestrator's addition — a wrong-data-served risk closed at the same time.** The
`loadExportDataset()` switch ends in `default: return productionLines(target.key ?? "")`. It is a
silent catch-all, not a rejection. It is harmless today only because it stands in for the single
remaining pair. Adding two union members would make any unhandled sales-invoice pair return **the
production dashboard's rows under a sales export filename**. The plan now requires an explicit
`case "production:lines"` plus a rejecting `default:`, with a test asserting an unrecognized pair is
refused and never served as production data. This is a latent defect in already-shipped code that
this plan happens to expose, not a new one it introduces.

**Gap 2 (FAIL) — the ERP-unavailable component cannot be reused per section.** `SalesUnavailable`
renders the entire page shell: `<main data-testid="sales-dashboard">` wrapping the header,
`PilotBanner`, the notice, `SalesFilterBar` and a `Card`. Rendering it twice would duplicate the page
root and its test id. Resolution: extract the inner notice into a new scoped
`sales-unavailable-fragment.tsx` with a per-instance test id; keep `SalesUnavailable` unchanged as
the both-sections-down whole-page fallback, so its existing e2e gates keep passing. The plan now
names all three states — both down, one down, stale-but-cached — instead of one blurred "degrade".

**Gap 3 (CONCERN)** — the plan cited a test file that does not exist. Now points at the real
`src/lib/__tests__/sales-basis-reconciliation.test.ts` and its existing
`resolveSalesBasisFromValue` describe block. The plan was grepped for other filename hedges; the one
remaining "(or equivalent)" is a legitimate SQL equivalence (`ISNULL` vs `COALESCE`).

**Gap 4 (CONCERN)** — the copy-rewrite checklist missed the actual Thai template. It now lists all
six real locations including `reconciliationNote()` in `sales-basis-core.ts` and its render site in
`sales-kpi-tiles.tsx`, and it DECIDES the delivery section's footnote fate rather than deferring:
the delivery section gets its own plain priced-coverage caveat (13 of 1,623 lines, 0.8%), and the
cross-reference runs one way only, from the invoice section.

## Orchestrator's independent verification
Both FAILs were confirmed by reading the real files before the supplement was commissioned:
`dashboard-export-target.ts:53` and its `parseExportTarget` allow-list, the `loadExportDataset`
switch and its `productionLines` default, and `sales-unavailable.tsx` in full. This cycle the
supplement agent was also required to verify every symbol it named, and its report lists what it
opened — a direct response to cycles 2 and 4, both of which were lost to plan text describing code
that did not exist.

## Trend
FAIL counts per validation pass: 4 → 4 → 2. Each gap set has been disjoint from the last and each
has been a layer deeper — first missing sections, then wrong paths, now runtime behavior inside
correctly-named files. Cycles used: 5 of 10.

## Next
Cycle 6: re-validate from V1.
