---
name: plan:pguard-redesign-phase-03-new-screens
description: "pguard-redesign — Phase 03: สรุปยอดผลิต (/summary from computeColumnTotals) + ประวัติออเดอร์ (/history real OrderSheet rows)"
date: 07-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: pguard-redesign
  phase: phase-03
---

# Phase 03 — New Screens

**Program:** pguard-redesign
**Umbrella plan:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-03-new-screens_REPORT_07-07-26.md (flat in the program task folder)

---

## Purpose

Build the two net-new screens the pguard handoff adds: สรุปยอดผลิต (`/summary`) — a 2fr/1fr production-summary with per-column bars derived from the UNCHANGED `computeColumnTotals`, a per-shop top-8, and a notes list — and ประวัติออเดอร์ (`/history`) — a list of REAL `OrderSheet` rows (no mock data), with today's sheet shown as "กำลังกรอก" (live) and past sheets as "ปิดยอดแล้ว" (closed). Both are read-only views over existing data; no new write paths.

---

## Objective

`/summary` bars equal `computeColumnTotals` for the selected day; `/history` lists real `OrderSheet` rows with correct live/closed status — both rendered in pguard, reachable from the Phase-01 nav.

---

## Entry Gate

- Phase 02 exit gate passed (matrix + shell + primitives; totals.ts confirmed unchanged).

---

## Dependencies

- Phase 02 (matrix data + primitives + `computeColumnTotals` availability). Independent of Phase 04 (mobile) — the two could run in parallel post-Phase-02.

---

## Blast Radius (exact file touch list)

- `src/app/(main)/summary/**` — สรุปยอดผลิต page: 2fr/1fr layout, per-column bars from `computeColumnTotals`, per-shop top-8, notes list
- `src/app/(main)/history/**` — ประวัติออเดอร์ page: real `OrderSheet` rows, today="กำลังกรอก" live, past="ปิดยอดแล้ว"
- consumes (unchanged): `totals.ts` (`computeColumnTotals`), the OrderSheet query layer, `src/components/ui/*`
- MUST NOT modify: `totals.ts`, schema, saveOrderSheet, print sheet

---

## Implementation Checklist

### Step A — สรุปยอดผลิต (/summary)

- [ ] A1. `/summary` page: 2fr/1fr layout; per-column bars fed DIRECTLY by `computeColumnTotals(orderLines)` (no re-derivation).
- [ ] A2. Per-shop top-8 panel + notes list from the same day's data.
- [ ] A3. Wire into the Phase-01 nav `/summary` route.

### Step B — ประวัติออเดอร์ (/history)

- [ ] B1. `/history` page: query REAL `OrderSheet` rows (no mock); order by date desc.
- [ ] B2. Status mapping: today's sheet = "กำลังกรอก" (live); past sheets = "ปิดยอดแล้ว" (closed).
- [ ] B3. Row → open the matrix for that date (reuse Phase-02 route).

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: summary bars (core correctness)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Summary bars == computeColumnTotals for the 446 fixture | Vitest: feed fixture → assert bar values equal `computeColumnTotals` output | totals-consistency | visual |
| Hybrid | /summary renders the day's bars from real data | Playwright on sandbox seeded day | end-to-end summary | pixel fidelity |

**Area: history (real rows)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | /history lists real OrderSheet rows w/ correct live/closed status | Playwright: seed today + a past sheet; assert statuses | real-data listing | UI polish |
| Agent-probe | Screens render in pguard matching the handoff prototype | screenshot vs the .dc.html prototype | visual fidelity | data |

---

## Exit Gate

```bash
pnpm test        # Expected: summary-bars == computeColumnTotals unit green
pnpm build && pnpm lint
# Hybrid: /summary bars match a seeded day; /history lists real sheets with correct live/closed status
```

- /summary bars == `computeColumnTotals`; /history lists real `OrderSheet` rows with correct status.
- Both screens render in pguard and are reachable from nav.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- Achieving the summary bars would require changing `computeColumnTotals` → STOP (totals.ts is out of scope; consume it, don't change it).
- No OrderSheet query surface exists for /history → surface to research; may need a read-only query helper (allowed — no schema change).
- Phase 02 exit gate not met → dependency BLOCKED.

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

- `src/app/(main)/summary/**`, `src/app/(main)/history/**`

---

## Public Contracts

- Read-only consumers of `computeColumnTotals` + the OrderSheet query layer — no new write path, no schema change.
- Fills the `/summary` + `/history` nav routes stubbed in Phase 01.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Summary bars == computeColumnTotals | Fully-Automated | DoD #3 (summary bars) — proven by: totals-consistency unit gate |
| /history lists real OrderSheet rows | Hybrid | DoD #3 (real rows, no mock) — proven by: history hybrid gate |
| Screens match handoff prototype | Agent-Probe | Re-skin fidelity — proven by: screenshot agent-probe |

---

## Test Infra Improvement Notes

- Reuse the 446 fixture as the summary-bars assertion input so /summary is anchored to the same canonical dataset. Record in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-03-new-screens_PLAN_07-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). Read-only screens — consume computeColumnTotals + OrderSheet query, change neither.

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
