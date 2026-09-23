---
name: sales-invoice-basis-pvl-iteration-002
description: PVL cycle 2 — re-validation after the cycle-1 supplement; 4 new FAILs found by reading the real files, all independently confirmed by the orchestrator
date: 2026-09-23
metadata:
  type: report
  loop: PVL
  cycle: 2
  plan: process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md
---

# PVL iteration 002 — sales-invoice-basis

## Result
`Gate: BLOCKED` again — but on a DIFFERENT gap set. Cycle 1's seven fixes all held up under
re-inspection. Cycle 2 read the actual files on disk rather than trusting the plan's prose and
found four new code-level defects the plan would have walked EXECUTE straight into.

## Orchestrator's independent confirmation
Every FAIL below was re-checked directly by the orchestrator before accepting it. All four are real.

| # | FAIL | Independent check run | Result |
|---|---|---|---|
| 1 | Plan says `src/lib/erp/erp-query-columns.ts` | `find src -name erp-query-columns.ts` | only `src/lib/erp-query-columns.ts` exists — plan path is wrong |
| 2 | Plan says `src/lib/sales-url.ts` | `find src -name sales-url.ts` | only `src/app/(main)/dashboards/sales/sales-url.ts` exists — plan path is wrong |
| 3 | Step S1 adds `SalesInvoiceDtl` to the manifest but never adds its `CREATE TABLE` to `db/erp-fixture/00-schema.sql` | listed the fixture's `CREATE TABLE dbo.*` names | 12 tables, `SalesInvoiceDtl` absent; the fixture-conformance test asserts set-equality against the manifest, so Step S1 as written fails its own gate the moment it lands |
| 4 | Step S11 replaces `ExportTable = "list" \| "lines"` with four `do-*`/`invoice-*` members | read `dashboard-export-target.ts` | `"list"`/`"lines"` are used by the purchase and production branches (lines 56, 58) and guarded at line 101; dropping them is a compile break in files this plan never touches |

Why this matters: three of the four are the kind of defect that only surfaces at build or test
time, after EXECUTE has already edited the wrong file. Catching them in the plan is the whole point
of the loop.

## CONCERNs raised (4)
- `SALES_SQL_SOURCES` in `sales-sql.ts` is the array the byte-identity drift test iterates; a new
  constant that is not registered there passes the drift test vacuously. Confirmed present at
  `src/lib/sales-sql.ts:369` and consumed by `sales-basis-reconciliation.test.ts`.
- The verified `SalesInvoiceDtl` column list DOES include `CustOrSuppCode`, contradicting adjacent
  plan prose that says the detail table has no customer column. The design (join to the header for
  customer identity) is still right; the prose needs one clarifying line.
- The invoice section's category filter/chart semantics are underspecified relative to the
  `skipCat` protection the DO side has.
- The URL back-compat rule does not state precedence when a stale bookmark carries both an
  unrecognized `view` and a `doNo`.

## Next
Cycle 3: plan-supplement addressing Gaps 1–8, then re-validate from V1. Cap is 10 cycles; no
plateau (the gap set changed completely between cycles, and these four are mechanical).
