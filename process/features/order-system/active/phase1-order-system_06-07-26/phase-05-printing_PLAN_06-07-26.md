---
name: plan:phase1-order-system-phase-05-printing
description: "orderstock Phase 1 — Phase 05: print routes (combined day + per-shop), A4 landscape mm layout matching the scan, print CSS, optional Playwright PDF fallback"
date: 06-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: order-system
  phase: phase-05
---

# Phase 05 — Printing

**Program:** phase1-order-system
**Umbrella plan:** process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-05-printing_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Produce printable output matching the scanned typeset form: a combined daily sheet (all shops in one table) and per-shop sheets, rendered at true A4-landscape millimetre dimensions with the 22-column ruled grid, group divider, totals row, and footer tallies. Primary path is browser print (`@page { size: A4 landscape }`, mm-based `table-layout: fixed`, Sarabun); an optional Playwright `page.pdf()` fallback reusing the SAME print route is decided (and optionally implemented) here. @react-pdf/renderer and `transform: scale()` are explicitly rejected (print REF §2/§1).

---

## Entry Gate

- Phase 04 exit gate passed (sheets recordable; totals correct; scan-day fixture exists).
- Sarabun font already bundled (Phase 01).

---

## Blast Radius

- `src/app/print/daily/[date]/**` — combined daily sheet route (renders ONLY the form, no app chrome)
- `src/app/print/shops/[date]/**` — per-shop sheets, one shop per page (`break-after: page`)
- `src/styles/print.css` — `@page` + `@media print`, mm column widths via `<colgroup>`, borders-not-fills
- `src/app/api/print/**` — OPTIONAL Playwright PDF fallback route reusing the print URL
- `next.config.ts` — `serverExternalPackages` for playwright IF the fallback is implemented

---

## Implementation Checklist

### Step A — Print layout

- [ ] A1. Build the combined-day print route rendering the 22-column grid at true mm (usable ≈281mm at 8mm margins), `table-layout: fixed`, explicit `<colgroup>` mm widths per form-canonical REF §2/§9 (ร้านค้า ≈9.7%, สินค้า cols ≈3.3%, เครื่องปรุง ≈2.3%, หมายเหตุ ≈11% incl. qty strip).
- [ ] A2. Reproduce structure: 3-tier header band, group divider before น้ำปลา, totals row, footer tally lists + รวมน้ำหนัก + ปี๊บ.
- [ ] A3. Use border-based styling (dodge the "Background graphics" checkbox); prefer rules over fills per print REF §1.
- [ ] A4. `src/styles/print.css`: `@page { size: A4 landscape; margin: 8mm }`, `thead { display: table-header-group; break-inside: avoid }`, `tr { break-inside: avoid }`. Totals in the last tbody row (NOT tfoot, to avoid per-page repeat).

### Step B — Per-shop sheets

- [ ] B1. Per-shop route: one `.sheet { break-after: page }` per selected shop; single print job.
- [ ] B2. On-screen preview styled with the SAME mm dimensions (`width: 297mm` container) so screen ≈ paper.

### Step C — Fidelity check + fallback decision

- [ ] C1. Visually compare printed/preview output against `Scan2026-07-04_170934.pdf`; record diffs.
- [ ] C2. Decide on the Playwright PDF fallback (print REF §4 escalation triggers: dialog-mangled printouts / archived PDFs / non-Chromium PCs). If adopted: add `GET /api/print/daily/[date].pdf` opening the print URL in warm headless Chromium, `page.pdf({ preferCSSPageSize: true, printBackground: true })` after `document.fonts.ready`.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: print markup structure**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Print route renders 22 columns + totals row for scan-day fixture | Vitest/RTL or Playwright DOM assertion on `/print/daily/[date]` | structure present | visual fidelity |
| Fully-automated | Per-shop route emits one page per shop | assert `.sheet` count == selected shops | pagination | layout |

**Area: visual fidelity (agent-probe — cannot be mechanically asserted)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Agent-probe | Combined sheet visually matches the scan structure | Playwright screenshot at A4 landscape vs `Scan2026-07-04_170934.pdf`; agent judges grid/divider/totals/footer match | layout fidelity | printer-exact mm |
| Hybrid | Optional PDF fallback produces A4-landscape PDF | precondition: playwright + fonts.ready; `curl /api/print/daily/[date].pdf` → valid PDF | deterministic output | — |

Visual fidelity is inherently agent-probe; it is a proving strategy here, recorded with judgment — not a known-gap.

---

## Exit Gate

```bash
pnpm test           # Expected: structure assertions green
# Agent-probe: screenshot combined + per-shop output at A4 landscape; compare to the scan; record verdict
```

- Combined + per-shop print output visually matches the reference scan structure on A4 landscape.
- Fallback decision recorded (adopted+implemented, or deferred with rationale).
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- Thai tone-mark/sara-am rendering wrong in print (should NOT happen with Chromium+Sarabun; if it does, do NOT switch to @react-pdf/renderer — investigate font loading per print REF §3) → BLOCKED with evidence.
- 22 columns cannot fit legibly at 281mm even with abbreviated/rotated headers → escalate to a layout decision with the user.
- Phase 04 exit gate not met → dependency BLOCKED.

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

- `src/app/print/daily/[date]/**`, `src/app/print/shops/[date]/**`, `src/styles/print.css`
- `src/app/api/print/**` (optional fallback), `next.config.ts` (if fallback adopted)

---

## Public Contracts

- Print routes consume the Phase 04 sheet data shape and the Phase 02 `printOrder` contract — no new external API unless the PDF fallback route is added.
- If adopted, `GET /api/print/daily/[date].pdf` becomes a delivery contract.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Print route renders 22 cols + totals | Fully-Automated | DoD #5 (print combined sheet) — proven by: structure gate |
| One page per shop | Fully-Automated | DoD #5 (per-shop sheets) — proven by: pagination gate |
| Visual match to scan | Agent-Probe | DoD #5 (match scanned form) — proven by: screenshot agent-probe |
| PDF fallback valid A4 landscape | Hybrid | DoD #5 (optional archivable output) — proven by: pdf hybrid gate |

---

## Test Infra Improvement Notes

- Add Playwright screenshot baselines at A4-landscape viewport for the scan-day fixture so future changes get a visual-regression anchor. Record baseline path in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-05-printing_PLAN_06-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). Reuse the scan-day fixture from Phase 04.

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
