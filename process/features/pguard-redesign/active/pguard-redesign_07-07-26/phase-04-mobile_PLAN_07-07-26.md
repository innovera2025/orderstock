---
name: plan:pguard-redesign-phase-04-mobile
description: "pguard-redesign — Phase 04: 5 mobile screens (login sheet, shop list, per-shop stepper writing same payload, summary, users) + bottom tab bar"
date: 07-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: pguard-redesign
  phase: phase-04
---

# Phase 04 — Mobile

**Program:** pguard-redesign
**Umbrella plan:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-04-mobile_REPORT_07-07-26.md (flat in the program task folder)

---

## Purpose

Deliver the pguard mobile experience: 5 screens — login (bottom-sheet), shop list (with per-shop progress), per-shop stepper entry, summary, and users — plus a bottom tab bar. The critical constraint: the per-shop stepper entry writes the SAME `cell:{shopId}:{variantId}` / `note:{shopId}` payload as the desktop matrix, through the UNCHANGED saveOrderSheet action. Touch targets ≥44px.

---

## Objective

Mobile order entry writes an identical `cell:`/`note:` payload to desktop; the bottom tab bar navigates all 5 screens; touch targets are ≥44px — all in pguard.

---

## Entry Gate

- Phase 02 exit gate passed (matrix + saveOrderSheet payload proven; primitives available).

---

## Dependencies

- Phase 02 (payload contract + primitives). Independent of Phase 03 — could run in parallel post-Phase-02.

---

## Blast Radius (exact file touch list)

- `src/app/(mobile)/**` (or responsive route variants) — 5 screens: login bottom-sheet, shop list (progress), per-shop stepper entry, summary, users
- `src/components/bottom-tab-bar.tsx` — mobile bottom tab bar
- consumes (unchanged): `saveOrderSheet`, `computeColumnTotals`, `src/components/ui/*`
- MUST NOT modify: saveOrderSheet/actions.ts, totals.ts, schema, print sheet

---

## Implementation Checklist

### Step A — Shell + navigation

- [ ] A1. `bottom-tab-bar.tsx`: mobile bottom tabs to the 5 screens; ≥44px touch targets.
- [ ] A2. Responsive breakpoint / `(mobile)` route wiring so mobile users get the mobile screens.

### Step B — Entry path (critical)

- [ ] B1. Shop list screen with per-shop progress indicator (derived from existing order data).
- [ ] B2. Per-shop stepper entry: increment/decrement per product-variant; builds the EXACT `cell:{shopId}:{variantId}` / `note:{shopId}` payload and calls the UNCHANGED `saveOrderSheet`.
- [ ] B3. Login bottom-sheet + summary + users screens (reskin of existing flows).

### Step C — Parity check

- [ ] C1. Assert the mobile-entered payload is byte-identical to the desktop-matrix payload for the same edits.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: mobile entry payload (high-risk: data write path)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Mobile stepper builds identical `cell:`/`note:` payload as desktop | Vitest: same edits via both builders → assert equal | payload parity | live save |
| Hybrid | Mobile entry saves + reloads via unchanged action | Playwright mobile viewport on sandbox | end-to-end mobile save | pixel fidelity |
| Agent-probe | Touch targets ≥44px; 5 screens + tabs render in pguard | mobile-viewport screenshot + measure | mobile ergonomics | data |

High-risk (data write path): minimum Hybrid — satisfied by the mobile-save gate. Known-Gap NOT permitted for the payload-parity behavior.

---

## Exit Gate

```bash
pnpm test        # Expected: mobile↔desktop payload-parity unit green
pnpm build && pnpm lint
# Hybrid: mobile viewport entry saves + reloads (identical payload); bottom tabs navigate all 5 screens
```

- Mobile entry writes identical `cell:`/`note:` payload; bottom tabs work; touch ≥44px.
- 5 screens render in pguard.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- Mobile stepper cannot reach payload parity without an action change → STOP (payload immutable — HARD STOP boundary).
- Responsive/route strategy conflicts with the Phase-01 shell → resolve with the shell owner; document.
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

- `src/app/(mobile)/**` (5 screens), `src/components/bottom-tab-bar.tsx`

---

## Public Contracts

- Consumes and PRESERVES the `saveOrderSheet` payload contract — the mobile stepper is a new UI over the same action.
- Reuses the Phase-01 primitives and Phase-02 order data; no schema/action change.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Mobile == desktop `cell:`/`note:` payload | Fully-Automated | DoD #4 (same payload) — proven by: payload-parity unit gate |
| Mobile entry saves + reloads (e2e) | Hybrid | DoD #4 (mobile entry) — proven by: mobile hybrid gate |
| Touch ≥44px; 5 screens + tabs render | Agent-Probe | DoD #4 (mobile ergonomics) — proven by: mobile agent-probe |

---

## Test Infra Improvement Notes

- Add a Playwright mobile-viewport project (e.g. iPhone preset) reusing the STAFF fixture so mobile specs run headless. Record in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-04-mobile_PLAN_07-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). The mobile stepper MUST write the identical saveOrderSheet payload — the action is immutable.

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
