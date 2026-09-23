---
name: sales-invoice-basis-pvl-iteration-001
description: PVL cycle 1 — plan supplement closing the 4 FAIL + 3 CONCERN gaps raised by the first VALIDATE pass
date: 2026-09-23
metadata:
  type: report
  loop: PVL
  cycle: 1
  plan: process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md
---

# PVL iteration 001 — sales-invoice-basis

## Baseline (cycle 0)
First VALIDATE pass returned `Gate: BLOCKED` — 4 FAILs, 3 CONCERNs. All were plan-text gaps, not
code defects and not customer-input gaps. Eight orchestrator-seeded concerns (C1–C8) were checked
against the real files; three were confirmed correct as written (manifest state, money gating,
ERP-env test restriction) and two proved worse than seeded.

## Gaps closed this cycle

| # | Severity | Gap | Resolution applied to the plan |
|---|---|---|---|
| 1 | FAIL | Step S10 proposed a nested route, contradicting `sales-url.ts`'s documented "ONE page, search params ARE the state" decision; no URL param carried a section dimension, yet both sections render simultaneously | Nested route deleted. `view` extended to `summary \| invoice-documents \| invoice-lines \| delivery-documents \| delivery-lines`; new `invoiceNo` param mirroring `doNo`; per-section breakdown pagination keys; full param table written into Public Contracts incl. stale-link fallback |
| 2 | FAIL | `dashboard-export-target.ts`'s `ExportTable = "list" \| "lines"` cannot express the 4 sales exports | Widened to `do-list \| do-lines \| invoice-list \| invoice-lines`; every existing consumer (purchase, production) must be `tsc --noEmit`-checked for exhaustive-switch fallthrough |
| 3 | FAIL | `live-reconcile-script.ts` imports the query Step S4 might delete (4 importers, not 1–2) | Added to Touchpoints/Blast Radius; S4 resolved as KEEP-and-rewrite-comment (the query is unconditional by design, a different shape from the date-filtered `invoice-headers.sql`) |
| 4 | FAIL | `erp-query-columns.ts` absent from the plan although every `.sql` file needs an entry there | Added to Touchpoints/Blast Radius; per-file column-contract entry required in the same sub-step as each new query |
| 5 | CONCERN | `erp_fixture` has zero `SalesInvoiceDtl` rows, so the NULL-`Amount` test and the Hybrid render gates cannot run | New Step S2b before S3 extends `db/erp-fixture/sales-seed.sql` with synthetic line rows incl. a NULL-`Amount` invoice, order-independent |
| 6 | CONCERN | AC5 "DO-path tests unmodified" conflicts with the locked decision to relocate the status donut | Reworded: DO data/query logic unmodified (no DO figure may change) vs DO test assertions may be updated for the new layout |
| 7 | CONCERN | One combined `Promise.all`/try-catch means an invoice-only outage blanks the healthy delivery section | Locked as independent per-section degrade, reusing `sales-unavailable.tsx` per section, cold cache covered |

Housekeeping: Step S1's dead `SalesInvoiceHdr` re-verification branch removed (already in the
manifest); `## Autonomous Goal Block` added stating EXECUTE is authorized only after a fresh
PASS/CONDITIONAL.

## Verification
`node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>` → 0 failures,
0 warnings. Plan grew to ~840 lines. No source file touched; no ERP query run; the pre-supplement
`## Validate Contract` was preserved verbatim with a resolutions subsection appended.

## Next
Re-run VALIDATE from V1. The gate can only move off BLOCKED by a fresh validation pass.
