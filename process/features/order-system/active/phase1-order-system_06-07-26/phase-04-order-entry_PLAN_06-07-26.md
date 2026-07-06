---
name: plan:phase1-order-system-phase-04-order-entry
description: "orderstock Phase 1 — Phase 04: daily order-sheet grid UI, per-column totals + total weight, create/edit/list by date+location, Buddhist-era dates"
date: 06-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: order-system
  phase: phase-04
---

# Phase 04 — Order Entry

**Program:** phase1-order-system
**Umbrella plan:** process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-04-order-entry_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Build the daily order-sheet entry experience matching the paper form: a grid with rows = shops and columns = product-variants in fixed print order, per-row notes plus a quantity strip for off-list items, automatic per-column totals and a grand total, and a total-weight computation. Support create/edit/list of sheets by date + location (สถานที่). Dates store CE and display in Buddhist Era. The definitional proof gate is recreating the 13/3/69 scan day and matching its column totals and grand total (446 pieces).

---

## Entry Gate

- Phase 02 exit gate passed (schema, variants in print order, seed).
- Phase 03 exit gate passed (auth; order entry is an authenticated STAFF/ADMIN action).
- Confirmed off-list note items exist as seed data (from Phase 02) so the note qty strip can tally.

---

## Blast Radius

- `src/app/orders/**` — list sheets by date+location; new-sheet grid; edit; save
- `src/lib/totals.ts` — per-column totals, grand total, total-weight computation (uses `ProductVariant.weightKg`/`pipConversion`)
- `src/lib/be-date.ts` — CE↔BE conversion + Thai d/m/yy display helpers
- order-sheet + order-line persistence via existing Prisma models (Phase 02)

---

## Implementation Checklist

### Step A — Grid UI

- [ ] A1. New-sheet page: header inputs วันที่ (BE display, CE store) + สถานที่; grid with shop rows (roster order) × 20 variant columns in `product-order.ts` order + หมายเหตุ free-text + qty strip.
- [ ] A2. Cells accept positive integers only (blank = no order); keyboard-friendly for fast entry.
- [ ] A3. Support the form's edge cases from form-canonical REF §4: empty rows, named rows with no data, an orphan note row with no shop (row 20).

### Step B — Totals + weight

- [ ] B1. `src/lib/totals.ts`: per-column sums, grand total = sum of all column totals, total weight = Σ(qty × variant.weightKg) with ปี๊บ conversion where defined.
- [ ] B2. Live totals row under the grid; grand total displayed (matches the form's faint 446 cell semantics).
- [ ] B3. Note qty strip aggregates off-list items into a footer tally (form REF §7 semantics).

### Step C — Persistence + list

- [ ] C1. Save sheet + lines transactionally; edit reloads and updates.
- [ ] C2. List/filter sheets by date and location; open to edit.
- [ ] C3. `src/lib/be-date.ts`: store CE in `OrderSheet.date`; display 13/3/69-style BE short format.

### Step D — Scan-day proof fixture

- [ ] D1. Provide a way (seed or test fixture) to enter the 13/3/69 scan day's exact matrix (form-canonical REF §5) and assert totals.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: totals engine (core correctness)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | 13/3/69 matrix → column totals match REF §5 | Vitest on `totals.ts` with the scan matrix fixture; assert ดลน1=99, ดล1=137, กรวด=39, รอง1=82, grand=446 | totals correctness | UI wiring |
| Fully-automated | CE↔BE conversion (13/3/2026 CE ↔ 13/3/69 BE) | Vitest on `be-date.ts` | date logic | display |
| Fully-automated | total-weight computation from variant factors | Vitest on `totals.ts` | weight math | factor accuracy (customer data) |

**Area: grid entry + persistence (high-risk: data write)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Enter scan day, save, reload → totals persist | precondition: sandbox + auth; Playwright/manual | round-trip persistence | print |
| Agent-probe | Grid visually matches paper column order | inspect grid vs form-canonical REF §3 | print-order fidelity | print output |

---

## Exit Gate

```bash
pnpm test   # Expected: totals + be-date unit tests green, INCLUDING grand-total == 446
# Hybrid: recreate the 13/3/69 sheet in the UI, save, reload; column totals + grand total match the scan
```

- 13/3/69 scan-day data recreatable; per-column totals + grand total match the scan (446 pieces).
- Dates display BE, store CE.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- Per-product weight/ปี๊บ conversion factors unknown (OPEN QUESTION with customer) → total-weight cannot be validated against the form's 4,670 กก / 163 ปี๊บ; ship the computation but mark weight as CONDITIONAL/known-gap with a backlog stub — piece-count total (446) is still the hard gate. NOT a full block.
- Phase 02 or 03 exit gates not met → dependency BLOCKED.

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

- `src/app/orders/**`, `src/lib/totals.ts`, `src/lib/be-date.ts`

---

## Public Contracts

- Defines the `OrderSheet`/`OrderLine`/`NoteLine` write shape consumed by Phase 05 print routes.
- Establishes the totals contract (per-column + grand + weight) that the printed footer must reproduce.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| 13/3/69 column totals + grand total == 446 | Fully-Automated | DoD #4 (recreate scan day, totals match) — proven by: totals unit gate |
| CE↔BE date conversion | Fully-Automated | DoD #4 (BE display / CE store) — proven by: be-date unit gate |
| Enter→save→reload persists totals | Hybrid | DoD #4 (record a sheet) — proven by: persistence hybrid gate |
| Grid column order matches form | Agent-Probe | DoD #4 (form fidelity) — proven by: grid agent-probe |

```bash
pnpm test -t "grand total"   # Expected: asserts 446
```

---

## Test Infra Improvement Notes

- Commit the 13/3/69 scan matrix (form-canonical REF §5) as a shared test fixture reused by Phase 05 print snapshot tests. Record fixture path in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-04-order-entry_PLAN_06-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). The 446 grand-total match is the hard proof gate.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: ⏳ PLANNED

## Overview

This is a phase plan within the phase1-order-system phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`phase1-order-system-umbrella_PLAN_06-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan enters the RIPER-5 VALIDATE (PVL) step before EXECUTE (ENTER EXECUTE MODE only after the contract is written).

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
