---
phase: phase-05-data-align-verify
date: 2026-07-08
status: COMPLETE
feature: pguard-redesign
plan: process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-05-data-align-verify_PLAN_07-07-26.md
---

# Phase 05 — Data Align + Verify — EXECUTE Report (DRAFT)

FINAL phase of the pguard-redesign program. Applied the ตีลานนิ่ม/ตีลาน display renames + seed
rename-migration, verified role labels, and ran full-program regression. All gates PASS.

## What Was Done

- **A1** `src/lib/product-order.ts`: renamed 4 display names only — printOrder 2,3 ดีลานนิ่ม→ตีลานนิ่ม;
  printOrder 4,5 ดีลาน→ตีลาน. printOrder/column/group/packSize/labelVariant UNCHANGED. printOrder 1
  (ดีนิ่ม A) untouched. `OFF_LIST_ITEMS` untouched.
- **A2** Created `src/lib/__tests__/product-names.test.ts` (6 tests, Fully-Automated) — red→green
  confirmed. Asserts via `variantDisplayName`: printOrder 2="ตีลานนิ่ม 1 กก.", 3="ตีลานนิ่ม 1/2 กก.",
  4="ตีลาน 1 กก.", 5="ตีลาน 1/2 กก.", printOrder 1 not renamed, no legacy base names remain.
- **B1** `prisma/seed.ts main()`: added an idempotent rename-migration block BEFORE the PRINT_VARIANTS
  loop — `updateMany({where:{name:oldName,isOffList:false},data:{name:newName}})` for both renames.
  Renames master Product rows in place so the loop's `findFirst({name})` matches → update, no CREATE.
- **B2** Reseed idempotency: ran `pnpm tsx prisma/seed.ts` twice → stable counts (20 in-order variants,
  8 off-list, 25 shops both runs). DB assertions: 20 in-order variants, NO duplicate printOrder,
  ดีลานนิ่ม/ดีลาน Product count == 0, ตีลานนิ่ม/ตีลาน count == 2.
- **C1** `package.json`: added `"test:e2e": "playwright test"` (additive).
- **D1** Verified `ROLE_LABELS` = ADMIN:"ผู้ดูแลระบบ", STAFF:"พนักงาน" (2 roles). No edit — no-op verify.
- **E1–E5** Full program regression, all PASS (see Test Gate Outcomes).

## What Was Skipped or Deferred

- No retroactive backfill of `OrderLine.variantNameAtEntry` snapshots (per HARD STOP / decision 3 —
  historical fidelity is intended). Old sheets keep their ดีลาน snapshots.
- Optional cosmetic refresh of `correction-cascade.test.ts` input string (not required; passes as-is).

## Test Gate Outcomes

| Gate | Result | Key evidence |
|---|---|---|
| A2 rename unit | PASS | product-names.test.ts 6/6 (red→green) |
| E1 `pnpm test` | PASS | 88 units, 16 files (≥84); totals/order-payload/summary/correction-cascade/rename all green |
| E2 `pnpm lint` | PASS | clean |
| E2 `pnpm build` | PASS | 20 routes |
| E3 `pnpm exec playwright test` | PASS | 25/25 (setup + 20 chromium desktop + 4 mobile); 446 D1/mobile, D2, print G1-G8, auth, settings |
| B2/E4 seed idempotency | PASS | 2 runs stable; 20 in-order, no dup printOrder, old-name count 0, new-name count 2 |
| E4 scope-fence git-diff | PASS | exit 0 (EMPTY) on all 9 immutable files |
| E5 agent-probe | PASS | LIVE master = ตีลานนิ่ม/ตีลาน; FROZEN OrderLine snapshots = ดีลาน (27 lines, ตีลาน 0) |

## Plan Deviations

None. Implemented exactly per checklist A–E.

## Test Infra Gaps Found

None new. `test:e2e` script gap (cited by prior exit gate) resolved this phase (C1).

## Closeout Packet

- Selected plan: process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-05-data-align-verify_PLAN_07-07-26.md
- Finished: A–E all complete; all gates green.
- Verified: rename unit, 88 units, lint, build (20 routes), 25/25 e2e, seed idempotency, scope-fence EMPTY, agent-probe live=ตีลาน / frozen=ดีลาน.
- Remaining: EVL (orchestrator spawns vc-tester to independently re-run gates), then PROGRAM CLOSEOUT
  in UPDATE-PROCESS (move active→completed, umbrella → COMPLETE, mark feature complete, commit).
- Best next state: Ready for EVL, then UPDATE PROCESS archival.

## Forward Preview

### Test Infra Found
- Whole-program e2e suite (matrix + summary + history + mobile + print + auth) green in ~1 min single worker.

### Blast Radius Changes
- Edited this phase: `src/lib/product-order.ts`, `prisma/seed.ts`, `package.json`, new `src/lib/__tests__/product-names.test.ts`.
- 9 immutable files byte-unchanged (scope-fence exit 0).

### Commands to Stay Green
- `pnpm test` · `pnpm lint` · `pnpm build` · `pnpm exec playwright test` · `pnpm tsx prisma/seed.ts` (x2, idempotent).

### Dependency Changes
- None (no new packages; `test:e2e` uses already-installed @playwright/test).

## EVL Independent Re-Verification (vc-tester, 08-07-26)

Terminal-phase EVL. All gates re-run independently (not trusting execute-agent claims). Every gate green.

| Gate | Claimed (execute) | Independent (EVL) | Verdict |
|---|---|---|---|
| Rename source (product-order.ts) | 2/3=ตีลานนิ่ม, 4/5=ตีลาน, 1=ดีนิ่ม A | Confirmed by READ (lines 54-58) | MATCH |
| Rename unit (product-names.test.ts) | 6/6 | 6/6 pass | MATCH |
| Full unit `pnpm test` | 88 | 88 pass (16 files) | MATCH |
| 446 totals test | green | totals.test.ts computeGrandTotal==446 green (3 asserts) | MATCH |
| `pnpm lint` | clean | clean | MATCH |
| `pnpm build` | 20 routes | 20 routes | MATCH |
| `pnpm exec playwright test` | 25/25 | 25/25 (21 desktop + 4 mobile) | MATCH |
| Seed idempotency | 20/8/25 stable | reseed → 20 in-order / 8 off-list / 25 shops | MATCH |
| Scope fence (9 immutable) | EMPTY | `git diff --exit-code` exit 0 (exact 9 paths) | MATCH |
| DB no-dup printOrder | no dup | 20 in-order, duplicatePrintOrders=NONE | MATCH |
| DB old-name count | 0 | ดีลานนิ่ม=0, ดีลาน=0 | MATCH |
| DB new-name count | 2 | ตีลานนิ่ม=2, ตีลาน=2 | MATCH |
| Frozen-vs-live | live=ตีลาน / frozen=ดีลาน | LIVE product.name=ตีลาน; FROZEN OrderLine snapshots (printOrder 4/5, 15 lines)=ดีลาน 1 กก./ดีลาน 1/2 กก. | MATCH |
| 446 DB re-derivation | 446 | earliest sheet 2026-03-13 (13/3/69) OrderLine qty sum = 446 | MATCH |

**Frozen-vs-live verdict:** CORRECT. Historical fidelity preserved — printOrder 4/5 OrderLine snapshots still read the FROZEN ดีลาน string (NOT backfilled), while the live master Product.name is ตีลาน. Both the historical-snapshot and live-rename requirements hold simultaneously.

**446 numeric intact:** CONFIRMED two ways — totals.test.ts unit (`computeGrandTotal==446`) and independent DB aggregation of the 13/3/69 sheet OrderLines (qty sum = 446).

No divergence between claimed and independent results. No git commit/push performed. Dev server not touched.

## EVL HANDOFF SUMMARY
```yaml
gates_green: [rename-source, rename-unit, full-unit-88, totals-446, lint, build-20-routes, e2e-25, seed-idempotency, scope-fence-empty, db-no-dup, db-name-counts, frozen-vs-live, 446-db-rederivation]
known_gaps: none
follow_up_stubs: none
context_partial: []
preliminary_packet_path: process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-05-data-align-verify_REPORT_07-07-26.md
closeout_classification: CLEAN
```

## touched_files
- src/lib/product-order.ts (MODIFIED — 4 display names)
- prisma/seed.ts (MODIFIED — rename-migration block)
- package.json (MODIFIED — test:e2e script)
- src/lib/__tests__/product-names.test.ts (CREATED)
- (plan file checklist ticked; pre-modified by PLAN/PVL)
