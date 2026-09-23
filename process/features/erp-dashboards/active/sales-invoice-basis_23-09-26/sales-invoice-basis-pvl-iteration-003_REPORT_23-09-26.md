---
name: sales-invoice-basis-pvl-iteration-003
description: PVL cycle 3 — supplement fixing two wrong file paths, a missing fixture-DDL step, and an ExportTable widening that would have broken the purchase and production dashboards
date: 2026-09-23
metadata:
  type: report
  loop: PVL
  cycle: 3
  plan: process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md
---

# PVL iteration 003 — sales-invoice-basis

## Gaps closed (4 FAIL + 4 CONCERN)

| # | Severity | Fix applied |
|---|---|---|
| 1 | FAIL | `src/lib/erp/erp-query-columns.ts` → `src/lib/erp-query-columns.ts` everywhere |
| 2 | FAIL | `src/lib/sales-url.ts` → `src/app/(main)/dashboards/sales/sales-url.ts` everywhere |
| 3 | FAIL | `db/erp-fixture/00-schema.sql` added to Touchpoints/Blast Radius; Step S1 now adds the `CREATE TABLE dbo.SalesInvoiceDtl` block as ONE atomic change with the manifest edit, and its verification runs `erp-fixture-schema-conformance.test.ts` too |
| 4 | FAIL | `ExportTable` widening made ADDITIVE — `"list" \| "lines" \| "invoice-list" \| "invoice-lines"`, so the purchase and production dashboards' existing `"list"`/`"lines"` usage is untouched |
| 5 | CONCERN | Step S6 must register each new mirror constant in `SALES_SQL_SOURCES`, or the drift test iterates nothing and passes vacuously |
| 6 | CONCERN | Research Findings prose corrected: `SalesInvoiceDtl` DOES carry `CustOrSuppCode`; it is deliberately unused because the header is the authoritative per-document customer |
| 7 | CONCERN | Invoice-side `cat` is a pure narrowing filter (no chart to protect); invoice section gets NO `status` filter (all four live invoices share one status); the delivery section keeps its existing `skipCat` chart protection |
| 8 | CONCERN | URL precedence stated: `doNo`/`invoiceNo` is checked FIRST and wins over an unrecognized `view`; a bare legacy `doNo` resolves to the delivery drilldown; the combined stale-bookmark case is now a required unit test |

## Orchestrator's independent verification of the supplement
Re-ran the checks rather than trusting the report:
- zero occurrences of either wrong path remain before the `## Validate Contract` section ✓
- zero occurrences of the incoherent `"do-list"`/`"do-lines"` literals remain ✓
- the additive `ExportTable` union appears in the Touchpoints row, Public Contracts and Step S11 ✓
- `db/erp-fixture/00-schema.sql` appears in Touchpoints, Blast Radius and Step S1 ✓
- extracted all 27 source paths the plan references and tested each for existence: every one exists
  except the 5 new `invoice-*.sql` files this plan creates (expected) and
  `src/lib/__tests__/sales-basis-core.test.ts`, which the plan hedges as "(or equivalent)" — a new
  test file, not a wrong path. Carried to cycle 4 as a minor item, not a blocker.

Plan artifact validator: 0 failures, 0 warnings, 889 lines.

## Next
Cycle 4: re-validate from V1. Cycles used: 3 of 10. No plateau — each cycle's gap set has been
disjoint from the last, and cycle 3's were mechanical.
