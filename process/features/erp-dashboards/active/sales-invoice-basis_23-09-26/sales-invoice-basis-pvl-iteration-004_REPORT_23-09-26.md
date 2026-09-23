---
name: sales-invoice-basis-pvl-iteration-004
description: PVL cycle 4 — re-validation after the cycle-3 supplement; 2 new FAILs found by tracing real runtime call graphs (not just file existence), all 15 prior gaps re-confirmed still resolved
date: 2026-09-23
metadata:
  type: report
  loop: PVL
  cycle: 4
  plan: process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md
---

# PVL iteration 004 — sales-invoice-basis

## Result
`Gate: BLOCKED` again — on a DIFFERENT, deeper gap set. Cycle 3's eight fixes all held up under
re-inspection (paths, additive `ExportTable`, fixture DDL step, `SALES_SQL_SOURCES` registration,
research clarification, `cat`/`status` semantics, URL precedence — all re-confirmed correct). This
cycle went past "does the named file exist at the named path" into "does the named file's actual
code do what the plan's step text assumes" and found two genuine defects the prior three cycles
did not reach.

## Findings

| # | Severity | Finding | Real-file evidence |
|---|---|---|---|
| 1 | FAIL | `dashboard-export-target.ts`'s `deriveExportTarget()` decides the sales export table shape from `doNo` presence ALONE (`table: one(searchParams.doNo) ? "lines" : "list"`) — cannot express the invoice section's export at all | read `dashboard-export-target.ts` lines 51-54 |
| 1 | FAIL | `parseExportTarget()` hard-rejects any `table` value other than `"list"`/`"lines"`, returning HTTP 400 for the new invoice shapes before `loadExportDataset` is ever reached | read `dashboard-export-target.ts` lines 97-105; confirmed `route.ts` calls this first and 400s on `null` |
| 1 | FAIL | `export-datasets.ts`'s `loadExportDataset()` switch has no `sales:invoice-list`/`sales:invoice-lines` cases; its `default:` silently calls `productionLines(target.key ?? "")` | read `export-datasets.ts` lines 320-339; none of this file is in the plan's Touchpoints/Blast Radius at all |
| 2 | FAIL | Step S8 says "reuse the existing `sales-unavailable.tsx` component... per section," but the real component renders the WHOLE page shell (`<main data-testid="sales-dashboard">`, header, `PilotBanner`, `SalesFilterBar` all inside it) — rendering it twice (once per section) would duplicate the page root and its test id | read `sales-unavailable.tsx` in full |
| 3 | CONCERN | Step S2's test-file reference (`sales-basis-core.test.ts` "or equivalent") hedges between a nonexistent file and the real one; `resolveSalesBasisFromValue` is already tested in `sales-basis-reconciliation.test.ts` | grep confirmed the describe block lives there |
| 4 | CONCERN | Step S13's footnote-rewrite checklist names 3 files but misses the ACTUAL Thai template string (`reconciliationNote()` in `sales-basis-core.ts`, rendered by `sales-kpi-tiles.tsx`), a stale comment in `sales-seed.sql`, and never decides the delivery section's post-plan fate of that footnote | read `sales-basis-core.ts`, `sales-kpi-tiles.tsx`, grepped `sales-seed.sql` line 210 |

Also specifically re-checked and found clean (no plan change needed): the money reconciliation
between the invoice header total and the invoice line-level `SUM(Amount)` (Research Findings
already proves no gap; SQL `SUM()` already no-ops on NULL); the cache-key independence between
future invoice fetch wrappers and existing DO wrappers (confirmed via `cache.ts` + `sales-queries.ts`'s
`cacheKey()`, fully compatible with Step S8's independent per-section degrade design); the
`canSeeMoney` gate reuse in both `page.tsx` and `route.ts`.

## Why this matters
Finding 1 is not a compile break (the ADDITIVE `ExportTable` widening from cycle 3 is correct and
holds) — it's a **missing runtime wiring** defect: the type was widened but nothing that actually
dispatches on that type's value was updated, and none of the 3 files responsible
(`deriveExportTarget`, `parseExportTarget`, `export-datasets.ts`) are named in Touchpoints for
anything beyond the type declaration. As scoped, EXECUTE would ship a CSV export button for the new
invoice tables that 400s on every click. Finding 2 is a literal reuse-instruction that cannot be
followed as written without first splitting the named component.

## Next
Cycle 5: plan-supplement addressing the 2 FAIL + 2 CONCERN above (see the plan's "Layer 2 findings
detail" table for exact proposed fixes), then re-validate from V1. 4 of 10 cycles used; no plateau —
cycle 4's gap set is disjoint from cycles 0/2's and strictly narrower in kind (wrong
paths/incoherent types → unwired runtime call graphs), which is convergence, not a stall.
