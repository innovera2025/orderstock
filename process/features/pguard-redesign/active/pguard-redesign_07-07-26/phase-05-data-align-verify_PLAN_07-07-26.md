---
name: plan:pguard-redesign-phase-05-data-align-verify
description: "pguard-redesign — Phase 05: apply ตีลานนิ่ม/ตีลาน renames + role-label map, idempotent reseed, FULL regression (446 intact, all e2e green, names consistent)"
date: 07-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: pguard-redesign
  phase: phase-05
---

# Phase 05 — Data Align + Verify

**Program:** pguard-redesign
**Umbrella plan:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-05-data-align-verify_REPORT_07-07-26.md (flat in the program task folder)

---

## Purpose

Final alignment + whole-program verification. Apply the two product renames ตีลานนิ่ม/ตีลาน (in `product-order.ts` + seed) and the role-label map, reseed idempotently, then run FULL regression: the 446 fixture stays intact, all e2e suites are green, and the renamed product names are consistent across matrix / summary / print. The DB already holds the equivalent data — this phase only aligns the 2 product names and labels; it does NOT change schema or the order semantics.

---

## Objective

Renames applied everywhere; seed is idempotent; full regression is green; product names read consistently across the matrix, /summary, and the print sheet.

---

## Entry Gate

- Phases 02, 03, 04 exit gates all passed (matrix, new screens, mobile).

---

## Dependencies

- Phases 02 + 03 + 04 (the rename must land after every surface that renders product names exists, so consistency can be verified end-to-end).

---

## Blast Radius (exact file touch list)

- `src/lib/product-order.ts` — apply ตีลานนิ่ม/ตีลาน renames (display labels; printOrder mapping UNCHANGED)
- `prisma/seed.ts` — align the 2 product names; role-label map; IDEMPOTENT upsert
- role-label map (UI labels for ADMIN/STAFF — 2 real roles only, no 3rd role)
- MUST NOT modify: schema.prisma, saveOrderSheet, totals.ts, the 446 fixture RESULT (the numeric totals stay identical; only display names change), print sheet renderers

---

## Implementation Checklist

### Step A — Renames + labels

- [ ] A1. `product-order.ts`: apply ตีลานนิ่ม/ตีลาน display renames; keep `printOrder` 1..20 mapping unchanged.
- [ ] A2. Role-label map: ADMIN/STAFF UI labels (chips are labels only; no 3rd real role).
- [ ] A3. `prisma/seed.ts`: align the 2 product names; keep DB shop tone-marks (เจ๊ not เจ้).

### Step B — Idempotent reseed

- [ ] B1. Make/confirm seed is IDEMPOTENT (upsert on natural keys); run twice → no duplicates, same result.

### Step C — Full regression

- [ ] C1. Run vitest — 446 fixture totals numerically intact (only display names changed).
- [ ] C2. Run all Playwright e2e (orders/matrix, summary, history, mobile) — green.
- [ ] C3. Consistency check: the renamed product names read identically in the matrix header, /summary bars, and the print sheet.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: renames + seed**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | 446 totals numerically intact after renames | `pnpm test` (totals suite) | no totals regression | display |
| Fully-automated | Seed idempotent (run twice → identical) | run seed x2; assert no dup + same counts | idempotency | live |
| Fully-automated | Rename applied in product-order.ts | Vitest asserts new labels at correct printOrder | rename correctness | UI |

**Area: cross-surface consistency + full regression**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Full e2e suite green (matrix/summary/history/mobile) | `pnpm test:e2e` on sandbox | whole-program regression | — |
| Agent-probe | Renamed names consistent across matrix / summary / print | inspect the 3 surfaces for identical strings | name consistency | pixel fidelity |

High-risk (schema-adjacent data): the rename is display-only; schema unchanged. Minimum Hybrid for the full-regression gate.

---

## Exit Gate

```bash
pnpm test              # Expected: 446 totals intact + rename + seed-idempotency units green
pnpm test:e2e          # Expected: ALL e2e suites green
pnpm tsx prisma/seed.ts && pnpm tsx prisma/seed.ts   # Expected: idempotent (no dup, same result)
# Agent-probe: ตีลานนิ่ม/ตีลาน read identically in matrix header, /summary, print sheet
```

- ตีลานนิ่ม/ตีลาน renames applied; seed idempotent; full regression green; names consistent across matrix/summary/print.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- The rename changes the 446 numeric totals (should be impossible — display-only) → STOP; the printOrder mapping was accidentally touched.
- Any e2e suite red that requires a data-path change to fix → route as a follow-up (out of re-skin scope); document.
- Phases 02/03/04 exit gates not all met → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per example-validate-output.md
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.**

---

## Touchpoints

- `src/lib/product-order.ts`, `prisma/seed.ts`, role-label map

---

## Public Contracts

- Display-only rename: `printOrder` mapping + saveOrderSheet payload + 446 numeric totals all UNCHANGED.
- Final program invariant proof: whole-program regression green across all re-skinned surfaces.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| 446 totals numerically intact | Fully-Automated | Program invariant — proven by: totals gate |
| Seed idempotent | Fully-Automated | DoD #5 (seed idempotent) — proven by: seed-idempotency gate |
| Rename applied at correct printOrder | Fully-Automated | DoD #5 (renames applied) — proven by: rename unit gate |
| Full e2e suite green | Hybrid | DoD #5 (full regression) — proven by: e2e hybrid gate |
| Names consistent matrix/summary/print | Agent-Probe | DoD #5 (consistency) — proven by: consistency agent-probe |

---

## Test Infra Improvement Notes

- After this phase, promote the whole-program e2e suite (matrix + summary + history + mobile) into a single documented regression command in `process/context/tests/all-tests.md` for future maintenance.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-05-data-align-verify_PLAN_07-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). Rename is DISPLAY-ONLY — the printOrder mapping and 446 numeric totals must stay identical. FINAL phase → full regression is the gate.

---

## Plan Metadata

**Date**: 07-07-26
**Complexity**: COMPLEX (one phase of the pguard-redesign program)
**Status**: ⏳ PLANNED

## Overview

This is a phase plan within the pguard-redesign phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`pguard-redesign-umbrella_PLAN_07-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan enters the RIPER-5 VALIDATE (PVL) step before EXECUTE (ENTER EXECUTE MODE only after the contract is written).

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
