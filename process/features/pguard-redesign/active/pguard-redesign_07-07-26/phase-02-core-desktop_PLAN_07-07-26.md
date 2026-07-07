---
name: plan:pguard-redesign-phase-02-core-desktop
description: "pguard-redesign — Phase 02: login, daily-order 20-col MATRIX replacing Order Pad (reusing saveOrderSheet), master data, admin, settings, print toolbar reskin"
date: 07-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: pguard-redesign
  phase: phase-02
---

# Phase 02 — Core Desktop

**Program:** pguard-redesign
**Umbrella plan:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-02-core-desktop_REPORT_07-07-26.md (flat in the program task folder)

---

## Purpose

Re-skin and restructure the core desktop surfaces to pguard, the highest-risk phase because it REPLACES the Order Pad with the 20-column daily-order MATRIX. The matrix maps 1:1 onto existing data (handoff col 0..19 = `ProductVariant.printOrder` 1..20; row 0..28 = `Shop.rosterOrder` 1..29) and REUSES `saveOrderSheet`'s `cell:{shopId}:{variantId}` / `note:{shopId}` payload UNCHANGED. Login (split hero), shops, products, admin/users, settings (3-panel), and the print toolbar are reskinned; the print sheet itself must stay byte-faithful.

---

## Objective

The new matrix saves via the unchanged saveOrderSheet action; the 446 fixture and the rewritten `orders.spec.ts` are green; the print sheet output is byte-unchanged; all core desktop screens render in pguard.

---

## Entry Gate

- Phase 01 exit gate passed (tokens, shell, primitives, IBM Plex).
- Confirmed matrix↔data mapping (printOrder 1..20 ↔ col 0..19; rosterOrder 1..29 ↔ row 0..28).

---

## Dependencies

- Phase 01 (shell + primitives + tokens). Downstream: Phase 03 (/summary, /history) and Phase 04 (mobile) both build on the matrix + primitives.

---

## Blast Radius (exact file touch list)

- `src/app/(auth)/login/**` — split-hero login reskin
- `src/app/(main)/orders/**` — NEW `order-matrix.tsx` (KPI strip + grid `40px 172px repeat(20,45px) 168px` + 3-tier header); **DELETE** `order-grid.tsx`, `shop-rail.tsx`, `shop-order-card.tsx`, `summary-bar.tsx`
- `src/app/(main)/shops/**` — reskin
- `src/app/(main)/products/**` — reskin; 15 fixed groups; inline rename → header updates
- `src/app/(main)/admin/users/**` — reskin; role chips (UI labels, no self-suspend)
- `src/app/(main)/settings/**` — 3-panel (establishment/display/data)
- print toolbar component (reskin only) — **print sheet stays faithful** (`get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx` UNCHANGED)
- `e2e/orders.spec.ts` — rewritten for the matrix UI (asserts unchanged payload)
- MUST NOT modify: `saveOrderSheet`/`actions.ts`, `order-save.ts`, `totals.ts`, `schema.prisma`, the 446 fixture, the print sheet renderers

---

## Implementation Checklist

### Step A — Login + matrix (highest risk)

- [ ] A1. `src/app/(auth)/login`: split-hero pguard reskin (server action unchanged).
- [ ] A2. NEW `order-matrix.tsx`: KPI strip + grid `40px 172px repeat(20,45px) 168px` + 3-tier header; cells map col 0..19 → printOrder 1..20, rows → rosterOrder 1..29.
- [ ] A3. Matrix save builds the EXACT `cell:{shopId}:{variantId}` / `note:{shopId}` payload and calls the UNCHANGED `saveOrderSheet` — no action/payload change.
- [ ] A4. DELETE `order-grid.tsx`, `shop-rail.tsx`, `shop-order-card.tsx`, `summary-bar.tsx`; remove their references.
- [ ] A5. Rewrite `e2e/orders.spec.ts` for the matrix; assert the persisted payload/ totals are identical to pre-reskin.

### Step B — Master data + admin + settings

- [ ] B1. Shops pages reskin.
- [ ] B2. Products pages reskin: 15 fixed groups; inline rename updates the matrix header live.
- [ ] B3. admin/users reskin: role chips are UI labels only (2 real roles); no self-suspend.
- [ ] B4. settings 3-panel reskin (establishment / display / data).

### Step C — Print toolbar

- [ ] C1. Reskin the print toolbar/entry only; verify the print sheet output is BYTE-UNCHANGED (diff against pre-reskin render).

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: order matrix ↔ saveOrderSheet (high-risk: data write path)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Matrix cell edits build identical `cell:`/`note:` payload | Vitest on the matrix→payload builder vs known fixture | payload unchanged | live save |
| Fully-automated | 446 fixture totals unchanged | `pnpm test` (existing totals suite) | no totals regression | UI |
| Hybrid | Enter the day via the matrix, save, reload → same persisted data | rewritten `e2e/orders.spec.ts` on sandbox | end-to-end save via unchanged action | print |
| Agent-probe | Print sheet byte-unchanged after toolbar reskin | diff print render pre/post | print faithfulness | — |

High-risk (data write path): minimum Hybrid — satisfied by the e2e matrix-save gate. Known-Gap NOT permitted for the save-payload behavior.

---

## Exit Gate

```bash
pnpm test        # Expected: 446 fixture + matrix payload-builder units green
pnpm build && pnpm lint   # Expected: exit 0
# Hybrid: rewritten orders.spec.ts green (matrix save round-trips identical payload)
# Agent-probe: print sheet render diff == 0 (byte-unchanged)
```

- Matrix saves via the UNCHANGED saveOrderSheet action; 446 fixture + rewritten e2e green; print sheet byte-unchanged.
- Order Pad 4 files deleted; all core desktop screens render in pguard.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- The matrix cannot build the exact `cell:`/`note:` payload without an action change → STOP (payload is immutable — HARD STOP boundary).
- Print sheet render diff is non-zero after the toolbar reskin → the sheet renderer was touched; revert that touch.
- Phase 01 exit gate not met → dependency BLOCKED.

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

- `src/app/(auth)/login/**`, `src/app/(main)/orders/**` (new `order-matrix.tsx`; 4 deletions), `src/app/(main)/{shops,products,admin/users,settings}/**`, print toolbar component, `e2e/orders.spec.ts`

---

## Public Contracts

- Consumes and PRESERVES the `saveOrderSheet` payload contract (`cell:`/`note:`) — the matrix is a new UI over the same action.
- Preserves the byte-faithful print sheet (renderers unchanged).
- Establishes `order-matrix.tsx` as the desktop order surface reused conceptually by Phase 04 mobile (same payload).

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Matrix → identical `cell:`/`note:` payload | Fully-Automated | DoD #2 (matrix saves via unchanged action) — proven by: payload-builder unit gate |
| 446 fixture unchanged | Fully-Automated | Program invariant — proven by: totals gate |
| Matrix save round-trips (e2e) | Hybrid | DoD #2 (record a day on the matrix) — proven by: rewritten orders.spec.ts |
| Print sheet byte-unchanged | Agent-Probe | Program invariant (print faithful) — proven by: render-diff agent-probe |

---

## Test Infra Improvement Notes

- Capture a golden pre-reskin print-sheet render so Phase 02 (and later phases) can diff byte-for-byte. Record its path in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-02-core-desktop_PLAN_07-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). saveOrderSheet payload + print sheet are IMMUTABLE — the matrix is a UI-only replacement.

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
