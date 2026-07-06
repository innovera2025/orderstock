---
name: note:weight-factors
description: "Backlog — per-variant weightKg + pipConversion factors (customer Q22) needed to validate computed total weight against the 13/3/69 form's 4,670 กก / 163 ปี๊บ"
date: 06-07-26
metadata:
  node_type: memory
  type: note
  feature: order-system
  phase: phase-04
---

# Weight/ปี๊บ Conversion Factors (Customer Q22)

## Priority

Low — does not block Phase 05 (Printing). Piece-count (446) is the hard gate for Phase 04; this
note tracks the still-open weight-total validation.

## Problem

`src/lib/totals.ts` ships `computeTotalWeight(cells, weightByPrintOrder)` — the arithmetic shape is
implemented and unit-tested, but every `ProductVariant.weightKg` / `ProductVariant.pipConversion` in
the seed data is `null`. The 13/3/69 scan form's footer reports a total weight of **4,670 กก** and
**163 ปี๊บ (pip/tin units)**, but there is currently no way to reproduce those numbers because the
per-variant conversion factors (kg per unit, and units-per-ปี๊บ) are unknown.

## Root Cause

The factors were never captured during Phase 02 seeding — they require a direct question to the
customer (tracked as "customer Q22" across the program's research references). This is an external
data dependency, not a code defect.

## Fix Options

1. **(Preferred) Ask the customer directly** for each product-variant's `weightKg` and
   `pipConversion` value, then backfill via a data migration / seed update. Re-run
   `computeTotalWeight` against the 13/3/69 fixture and assert it equals 4,670 กก / 163 ปี๊บ — this
   becomes the new Fully-Automated gate closing the known-gap.
2. Infer approximate factors from publicly known packaging conventions for the product line, flag as
   `needsConfirmation`, and let the existing correction-cascade / edit-and-confirm CRUD flow
   (Phase 02 decision 6 mechanism) resolve them in-app once confirmed. Lower confidence than option 1.
3. Leave as a permanent known-gap if the customer confirms weight totals are not operationally
   important (unlikely given the form already computes and displays them).

## Notes

- `ProductVariant.weightKg` / `pipConversion` are `@db.Decimal(10,3)?` — already schema-ready for
  this data; no migration needed once values are known (see `database/all-database.md`).
- `test-fixtures/sheet-13-03-69.json` already contains the exact cell quantities for the gate day;
  once factors are known, the validation gate is a straightforward assertion against the existing
  fixture — no new test data needed.
- Raised during Phase 04 PVL/EXECUTE; accepted as a known-gap for both Phase 04 and Phase 05
  (Phase 05 print output can render the (currently unvalidated) weight figure but should not block
  on this note).
