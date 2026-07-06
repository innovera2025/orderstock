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
**Phase status:** ✅ VERIFIED (all 7 inner-loop steps done 06-07-26; all validate-contract gates independently re-verified by vc-tester; DB integrity confirmed on sandbox; Phase 01-03 regression clean; only 2 pre-accepted known-gaps remain — weight validation + dup-TOCTOU, both backlogged. UPDATE PROCESS complete — see backlog stubs, `database/all-database.md`, `all-context.md`, `tests/all-tests.md`. Program continues at Phase 05 Printing.)
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

- `src/app/orders/**` — list sheets by date+location; whole-sheet editable matrix (29 slots × 20 cols + notes col); edit; save
- `src/lib/totals.ts` — pure `computeColumnTotals` / `computeGrandTotal(orderLines: OrderLineCell[])` / weight; ONE module imported by both client live display AND server save-time verify
- `src/lib/be-date.ts` — CE↔BE conversion (Intl `th-TH-u-ca-buddhist`) + Thai d/m/yy display helpers
- `src/lib/order-save.ts` — pure snapshot-merge helper `mergeSnapshots(existingLines, incomingCells, liveNames)` (carry-forward vs fresh decision), unit-testable without a DB (mirrors the Phase-02 `CascadeDb` extract-pure-logic pattern) — **PVL-added**
- `src/components/sheet-header.tsx` — reusable logic-free two-tier สินค้า/เครื่องปรุง header component (**Phase 05 print imports this** — cross-phase)
- `test-fixtures/sheet-13-03-69.json` — canonical gate fixture (shared with Phase 05 print tests)
- `src/lib/__tests__/auth-guard-coverage.test.ts` — EXTEND the `MODULES` array with `src/app/orders/actions.ts` (mechanical ELEV-guard) — **PVL-added**
- order-sheet + order-line + note-line persistence via existing Prisma models (Phase 02); ALL server actions wrapped by `requireAuth` (Phase 03 auth-guard)

---

## Gate Fixture — 13/3/69 (fully specified by RESEARCH; write INTO code so EXECUTE needs no re-derivation)

**Cells** `rShop:{printOrder=qty}` (OrderLine grid only). Blank = omit line (never qty 0). qty positive Int:

```
r1:{4:15,5:5}  r2:{4:2,6:5,8:8}  r3:{8:2,9:2}  r5:{4:5,5:2,6:10,17:16}
r7:{8:2}  r9:{4:20}  r10:{6:4,7:2}  r11:{5:12,6:2,17:10,18:10}  r12:{5:1,6:1}
r14:{2:10,3:2,4:5,5:1,6:3}  r15:{6:10}  r16:{4:5,8:10,17:8}  r17:{2:5,3:2,6:2,7:2}
r18:{2:2,4:30}  r19:{17:4}  r21:{2:10,3:10}  r22:{2:1,8:5}  r24:{2:5,4:5,6:2,8:5}
r25:{2:16}  r27:{2:30,4:30,8:50}  r28:{2:20,4:20}
```

**Column totals** (printOrder→total): 1→0, 2→99, 3→14, 4→137, 5→21, 6→39, 7→4, 8→82, 9→2, 10→0, 11→0, 12→0, 13→0, 14→0, 15→0, 16→0, 17→38, 18→10, 19→0, 20→0. **GRAND = 446.**

**446 counts ONLY OrderLine grid cells — NoteLine qty is EXCLUDED** (r9 qty=1 and r16 qty=20 are NOT in the 446). Type-level: `computeGrandTotal(orderLines: OrderLineCell[])` cannot accept notes (no `includeNotes` flag).

**PVL arithmetic verification (spot-checked independently 06-07-26):** col 2 = 10+5+2+10+1+5+16+30+20 = 99 ✓; col 4 = 15+2+5+20+5+5+30+5+30+20 = 137 ✓; col 6 = 5+10+4+2+1+3+10+2+2 = 39 ✓; col 8 = 8+2+2+10+5+5+50 = 82 ✓; col 17 = 16+10+8+4 = 38 ✓; grand = 99+14+137+21+39+4+82+2+38+10 = 446 ✓. Fixture is internally consistent.

**NoteLines** (13 total; orphan row 20 has shopId null): r1 "ดีขาว 1/2 กก" · r2 "ดีนิม (A) 1/2กก" · r5 "พริกแดง 10 กก" · r9 "ดีขาว 1/2 กก" qty=1 · r12 "ดีขาว 1/2 กก" · r16 "ลานนิม (ใส) 1 กก." qty=20 · r19 "แดง" (no FK — ambiguous, text only) · **r20 orphan (shopId null)** "ดีขาว 1 กก." · r22 "ดีขาว 1 กก." · r23 "ดีนิม (A) 1/2กก" · r24 "ดีขาว 1 กก." · r27 "รอง 5 กก." · r28 "ดีนิม (A) 1/2กก".

---

## Decisions (from INNOVATE — verdict GO)

| # | Decision | Chosen |
|---|---|---|
| 1 | Entry model | Single whole-sheet editable matrix (29 slots × 20 cols + notes col); whole-form submit via useActionState/ActionState convention; mobile = horizontal scroll + sticky ลำดับ/ร้านค้า columns. |
| 2 | Save strategy | Delete-and-recreate inside `$transaction`, **BUT preserve pre-existing snapshot text** (carry forward `shopNameAtEntry`/`variantNameAtEntry` for cells that already existed; fresh snapshot ONLY for new cells). Naive re-derive from live names would break the Phase-02 correction-cascade lock guarantee. Show `lastUpdated` on the sheet (last-write-wins accepted). |
| 3 | Duplicate sheets | App-level check-then-create inside the SAME transaction (OrderSheet has NO DB unique on date+location); on conflict redirect to the existing sheet ("เปิดชีตนี้"). NO schema migration. |
| 4 | Date control | Native `input[type=date]` (CE) + read-only BE label (13/3/69 via `th-TH-u-ca-buddhist`) + "วันนี้" default/shortcut. Custom BE picker deferred. |
| 5 | Note off-list linking | Auto-resolve exact-text match → set `productVariantId` AND always keep raw text (never null text on match); no match → text only ("แดง" stays unlinked); light "matched ✓/✗" indicator. |
| 6 | Layout fidelity | Always render all 29 roster slots incl. blank gaps (4/6/20/29); two-tier สินค้า/เครื่องปรุง header = reusable logic-free component (Phase 05 imports it — cross-phase). |
| 7 | Totals engine | Single `src/lib/totals.ts` pure functions; client live display + server save-time verify import the SAME function; `computeGrandTotal(orderLines: OrderLineCell[])` type-excludes notes. |

**Verified facts:** BE via Intl `th-TH-u-ca-buddhist` on Node 22 (native date input shows CE only). Sparse grid (~45 cells/day of 580) → NO virtualization. Weight totals = known-gap (weightKg/pipConversion null until Q22) — ship computation, mark un-validatable.

---

## Inner Loop Refresh Note

- **Date:** 06-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after RESEARCH (full gate fixture) + INNOVATE (GO).
- **Sections changed:** Blast Radius (whole-sheet matrix, single totals module, reusable sheet-header component for Phase 05, shared JSON fixture, requireAuth on all actions), NEW Gate Fixture section (all cells + all 20 column totals + 446 + 13 NoteLines incl. orphan), NEW Decisions section, Implementation Checklist (TDD ordering: totals-red-first → be-date → grid → snapshot-preserving persistence + duplicate check + note auto-resolve → Playwright hybrid; assert ALL 20 columns + grand 446; snapshot-carry-forward; duplicate redirect), Test Plan (expand totals gate to all 20 cols + note-exclusion assertion), Blockers (weight known-gap kept), Verification Evidence (all-20-columns), Phase Loop Progress 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key findings folded in:** full 13/3/69 fixture (write into code); gate asserts ALL 20 column totals + 446; 446 excludes NoteLine qty; OrderSheet has no DB unique (app-level dup check); BE via Intl th-TH-u-ca-buddhist; weight known-gap; blank=omit line; sparse grid no virtualization; snapshot-preserving save (protects Phase-02 correction-cascade lock); note auto-resolve keeps raw text.
- **Validate-contract now written** (PVL step 4 complete 06-07-26).
- **Cross-phase ripple:** shared `sheet-header.tsx` two-tier header + shared `sheet-13-03-69.json` fixture reusable by Phase 05 print tests. Propagated to umbrella + registry.

---

## Implementation Checklist

### Step A — Totals engine (TDD RED FIRST)

- [x] A1. Commit `test-fixtures/sheet-13-03-69.json` from the Gate Fixture section above (cells + 20 column totals + 446 + NoteLines). ✅ created.
- [x] A2. `src/lib/totals.ts`: `computeColumnTotals` + `computeGrandTotal(orderLines: OrderLineCell[])` (type-excludes notes; NO includeNotes flag) + weight `Σ(qty×weightKg)`. ✅
- [x] A3. Vitest (red-first CONFIRMED: test failed on missing module before impl): fixture → asserts ALL 20 column totals AND grand==446 AND NoteLine qty excluded. ✅ 6/6 green.

### Step B — Date + grid skeleton

- [x] B1. `src/lib/be-date.ts`: CE↔BE via Intl `en-US-u-ca-buddhist` (formatToParts to strip the " BE" era suffix); store CE, display 13/3/69; Vitest CE↔BE unit tests. ✅ 5/5 green (red-first confirmed).
- [x] B2. Whole-sheet matrix (`order-grid.tsx`, 29 roster slots incl. blank gaps 4/6/20/29 × 20 cols + notes col); reusable two-tier `sheet-header.tsx`; cells positive-int only (blank=omit); sticky ลำดับ/ร้านค้า; live footer imports `totals.ts`. ✅
- [x] B3. Header (`new-sheet-form.tsx`): native `input[type=date]` (CE) + read-only BE label + "วันนี้" shortcut. ✅

### Step C — Persistence + list (all actions wrapped by requireAuth)

- [x] C1. Save = delete-and-recreate inside `$transaction`, **preserving pre-existing snapshot text** (read-first → explicit child delete → mergeSnapshots carry-forward → keep same sheet row). ✅ `orders/actions.ts saveOrderSheet`. **REQUIRED order of operations (PVL — SQL Server `NoAction` cascade):** (1) inside the tx, READ existing `OrderLine`/`NoteLine` rows for the sheet FIRST (capture their `shopNameAtEntry`/`variantNameAtEntry`); (2) EXPLICITLY delete the child `OrderLine` + `NoteLine` rows for the sheet — do NOT rely on cascade (all FKs are `onDelete: NoAction`; deleting the sheet would be rejected while children exist); (3) re-insert cells, carrying forward the captured snapshot text for cells that already existed (matched by shopId+variantId) and writing a FRESH snapshot only for genuinely new cells; (4) keep the SAME `OrderSheet` row (update its `updatedAt`/`lastUpdated`), do not delete+recreate the sheet itself. Extract the carry-forward-vs-fresh decision into the pure `src/lib/order-save.ts` `mergeSnapshots()` helper so it is unit-testable without a DB.
- [x] C1b. **(PVL-added) Snapshot-preservation red-first unit test** — `src/lib/__tests__/order-save.test.ts`: `mergeSnapshots()` returns OldName for the pre-existing cell and live NewName only for a brand-new cell. ✅ 3/3 green (impl written after test).
- [x] C2. Duplicate prevention: app-level check-then-create in the SAME `$transaction`; on conflict redirect to existing sheet. List sheets by date + location on `/orders`; open to edit. ✅
- [x] C3. Note off-list auto-resolve: exact-text match → set `productVariantId` AND keep raw text; no match → text only. ✅ (server-side in `saveOrderSheet`; note snapshot also carried forward on resave). See Deviations re: the ✓/✗ indicator.
- [x] C4. **(PVL-added) Extended `src/lib/__tests__/auth-guard-coverage.test.ts`** MODULES with `{ file: "src/app/orders/actions.ts", expected: ["createOrderSheet","saveOrderSheet"] }`. Both call `requireAuthState()`. ✅ 5/5 green.

### Step D — Hybrid gate

- [x] D1. Playwright (`e2e/orders.spec.ts`, reuses `e2e/.auth/staff.json`): enters the full 13/3/69 fixture through the real UI, saves, reloads; asserts grand 446 + column totals (4→137, 8→82, 2→99) persist. ✅ green.
- [x] D2. **(PVL-added) Snapshot round-trip hybrid:** create sheet → rename shop → re-save → assert (via prisma) the pre-existing cell's `shopNameAtEntry` is UNCHANGED while the live shop name changed. **DEVIATION (test-strengthening):** used the CONFIRMED-lock shop (needsConfirmation=false) instead of the contract's unconfirmed shop — the confirmed case is the ONLY branch that distinguishes carry-forward from naive re-derive end-to-end (see Deviations). ✅ green.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS CONFIRMED at PVL (test routing chain `all-tests.md` loaded + existing blast-radius tests discovered: `auth-guard-coverage.test.ts`, `correction-cascade.test.ts`; Playwright `e2e/.auth/{admin,staff}.json` fixtures confirmed present).

**Area: totals engine (`src/lib/totals.ts`) — core correctness**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | 13/3/69 fixture → ALL 20 column totals + grand 446; NoteLine qty excluded | `pnpm test` (vitest run) on `totals.test.ts` w/ `sheet-13-03-69.json`; assert every printOrder total (2→99,3→14,4→137,5→21,6→39,7→4,8→82,9→2,17→38,18→10, rest→0) AND grand==446 AND notes(r9=1,r16=20) excluded | totals correctness + note-exclusion | UI wiring |
| Fully-automated | CE↔BE conversion (13/3/2026 CE ↔ 13/3/69 BE) | `pnpm test` on `be-date.test.ts` | date logic | display rendering |
| Fully-automated | total-weight computation from variant factors | `pnpm test` on `totals.test.ts` | weight math shape | factor accuracy (weightKg null — known-gap) |

**Area: grid entry + persistence (`src/app/orders/**`, `src/lib/order-save.ts`) — high-risk: destructive write + auth**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Every exported order action calls requireAuth (ELEV-guard) | `pnpm test` on `auth-guard-coverage.test.ts` (orders added to MODULES) | no missed auth guard | guard internal correctness |
| Fully-automated | **Snapshot carry-forward on re-save** (naive re-derive FAILS) | `pnpm test` on `order-save.test.ts` — `mergeSnapshots()` returns OldName for existing cell, NewName only for new cell | preserve-on-resave logic | full DB round-trip |
| Hybrid | Enter scan day, save, reload → totals persist | `pnpm exec playwright test` — precondition: sandbox up + seeded + `e2e/.auth/staff.json` | round-trip persistence | print output |
| Hybrid | Rename shop (needsConfirmation) → re-save sheet → snapshot text unchanged | `pnpm exec playwright test` (or agent-probe against sandbox) — precondition: sandbox + staff fixture | preserve-on-resave end-to-end | print output |
| Agent-probe | Grid column order + 29-slot fidelity matches paper | inspect grid vs form-canonical REF §3 (all 29 slots incl. blank 4/6/20/29; 20 cols in print order) | print-order/layout fidelity | print output |
| Known-gap | Total weight validated vs form's 4,670 กก / 163 ปี๊บ | — | — | weightKg/pipConversion null until customer Q22 |
| Known-gap | Duplicate-sheet TOCTOU race under concurrent saves | — | — | no DB unique on date+location (decision 3); READ COMMITTED lets 2 saves both pass the check |

**Gaps and resolution options**

| Gap | Resolution options |
|---|---|
| Snapshot-preservation unproven | A) proven-now unit gate `order-save.test.ts` (30 min). **B) added by this plan (C1b) — CHOSEN.** C) accept known-gap — REJECTED (load-bearing, protects Phase-02 lock). D) backlog. |
| auth-guard not extended to orders | **A/B) add orders to MODULES in `auth-guard-coverage.test.ts` (C4) — CHOSEN.** C) accept — REJECTED (#1 elevation risk). |
| Weight validation | **C) accept known-gap (factors unknown until Q22) — CHOSEN.** D) backlog stub `weight-factors_NOTE`. |
| Duplicate TOCTOU | **C) accept known-gap (LAN-internal, low concurrency, decision 3 accepts no DB unique) — CHOSEN.** B) filtered unique index — deferred. |
| Registry drift (sheet-header.tsx + fixture not in Phase 04 registry claim) | **A) execute-agent appends both files to registry Phase 04 section — CHOSEN (E-instruction).** |

---

## Exit Gate

```bash
pnpm test   # Expected: totals + be-date + order-save (snapshot) + auth-guard-coverage green, INCLUDING grand-total == 446
pnpm exec playwright test   # Hybrid: recreate the 13/3/69 sheet in the UI, save, reload; column totals + grand total match the scan
```

- 13/3/69 scan-day data recreatable; per-column totals + grand total match the scan (446 pieces).
- Snapshot text preserved on re-save (order-save unit gate green; hybrid rename-resave confirms).
- Every order action guarded (auth-guard-coverage green with orders in MODULES).
- Dates display BE, store CE.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- Per-product weight/ปี๊บ conversion factors unknown (OPEN QUESTION with customer) → total-weight cannot be validated against the form's 4,670 กก / 163 ปี๊บ; ship the computation but mark weight as CONDITIONAL/known-gap with a backlog stub — piece-count total (446) is still the hard gate. NOT a full block.
- Phase 02 or 03 exit gates not met → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE — full 13/3/69 gate fixture specified (all cells, 20 column totals, 446, 13 NoteLines); OrderSheet no DB-unique; BE via Intl; weight known-gap (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — verdict GO; Decision Summary (whole-sheet matrix, snapshot-preserving save, app-level dup check, note auto-resolve, single totals module) written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: full V1-V7 done 06-07-26; validate-contract written (net gate CONDITIONAL, 0 FAILs; 4 concerns resolved in-plan + 2 accepted residuals); arithmetic independently verified; snapshot + auth-guard gates added
- [x] 5. EXECUTE — DONE 06-07-26: all A/B/C/D checklist items implemented; per-section TDD gates red-first→green; pnpm test 39/39, pnpm build ✓, pnpm lint ✓, playwright 9/9 (incl. D1 446 + D2 snapshot-preserve, Phase-03 auth regression clean). Report drafted. 2 accepted known-gaps (weight, dup-TOCTOU) unchanged. Awaiting EVL.
- [x] 6. EVL — DONE 06-07-26 (vc-tester independent re-run): ALL validate-contract gates independently green (pnpm test 39/39, build ✓, lint ✓, playwright 9/9); DB probe confirms sheet 13/3/69 grand 446 + column totals match fixture + 0 empty snapshots + 0 qty≤0; Phase 01-03 regression clean (migrate up-to-date, seed idempotent, health 200, /orders→307); 3 deviations audited & confirmed accurate; verification.json evlConfirmation block written; EVL HANDOFF SUMMARY appended to report. Classification CLEAN.
- [x] 7. UPDATE PROCESS — phase report reconciled; umbrella state updated (Phase 04 ✅ VERIFIED, current phase → 05); backlog stubs written (weight-factors, order-sheet-dup-index); `database/all-database.md`, `all-context.md`, `tests/all-tests.md` updated; validators run. Commit routed by orchestrator (not this agent).

**Validate-contract written — EXECUTE gated on explicit user consent (charter hard stop).**

---

## Touchpoints

- `src/app/orders/**`, `src/lib/totals.ts`, `src/lib/be-date.ts`, `src/lib/order-save.ts`, `src/components/sheet-header.tsx`, `test-fixtures/sheet-13-03-69.json`, `src/lib/__tests__/auth-guard-coverage.test.ts` (extend)

---

## Public Contracts

- Defines the `OrderSheet`/`OrderLine`/`NoteLine` write shape consumed by Phase 05 print routes.
- Establishes the totals contract (per-column + grand + weight) that the printed footer must reproduce.
- **Cross-phase:** exports the reusable two-tier `sheet-header.tsx` component and the `sheet-13-03-69.json` fixture — Phase 05 print imports both.
- Writes historical snapshot columns (Phase-02 decision 6) at line-create time; preserves existing snapshots on re-save.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| ALL 20 column totals + grand total == 446 (notes excluded) | Fully-Automated | DoD #4 (recreate scan day, totals match) — proven by: totals unit gate |
| CE↔BE date conversion | Fully-Automated | DoD #4 (BE display / CE store) — proven by: be-date unit gate |
| Snapshot carry-forward on re-save | Fully-Automated | Cross-phase constraint (protect Phase-02 lock) — proven by: order-save unit gate |
| Every order action calls requireAuth | Fully-Automated | Auth boundary (Phase-03 contract) — proven by: auth-guard-coverage gate |
| Enter→save→reload persists totals | Hybrid | DoD #4 (record a sheet) — proven by: persistence hybrid gate |
| Rename→resave preserves snapshot | Hybrid | Cross-phase constraint end-to-end — proven by: snapshot round-trip hybrid |
| Grid column order matches form | Agent-Probe | DoD #4 (form fidelity) — proven by: grid agent-probe |

```bash
pnpm test -t "grand total"   # Expected: asserts 446
```

---

## Test Infra Improvement Notes

- Commit the 13/3/69 scan matrix (form-canonical REF §5) as a shared test fixture reused by Phase 05 print snapshot tests. Record fixture path in `process/context/tests/all-tests.md`.
- Extend `auth-guard-coverage.test.ts` MODULES with each new authenticated action file as phases land (orders this phase; print/settings later).

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-04-order-entry_PLAN_06-07-26.md`
- Last completed step: 4. PVL (validate-contract written — net gate CONDITIONAL, auto-selected acceptances recorded for override before EXECUTE)
- Validate-contract status: WRITTEN (CONDITIONAL). NEXT STEP is EXECUTE (Step 5) — **gated on explicit user consent (ENTER EXECUTE MODE)** per charter hard stop.
- Execute-agent start: sandbox `orderstock-sql` DB only; never touch a customer/remote DB; do not stop/restart the 9 unrelated Docker containers; no git commit/push without user instruction. Start with Step A (totals TDD red-first), then B, C (snapshot-preserving persistence — read old snapshots before delete), D.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: ✅ VERIFIED (EVL independent re-run passed 06-07-26; awaiting step 7 UPDATE PROCESS)

## Overview

This is a phase plan within the phase1-order-system phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`phase1-order-system-umbrella_PLAN_06-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan has completed VALIDATE (PVL); ENTER EXECUTE MODE only with explicit user consent.

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

Status: CONDITIONAL
Date: 06-07-26
date: 2026-07-06
generated-by: inner-pvl: phase-04

Parallel strategy: parallel-subagents (recommended for EXECUTE)
Rationale: 4/7 signals present (S2 schema/auth surface, S4 phase program, S6 high-risk destructive write, S7 5+ files) — dominant S6. The PVL validation fan-out itself was synthesized in-session (read-only, no cross-agent coordination, full Deep-Mode context bundle already loaded + verified against real code).

### Net gate

0 FAILs / 4 resolvable CONCERNs (all applied to plan) / 2 accepted residuals. → CONDITIONAL. Piece-count 446 is proven by real Fully-Automated + Hybrid gates (NOT vacuous); snapshot-preservation gate added (C1b) so no developed behavior rests on Known-Gap alone.

### Test gates (C3 5-column table)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| A3 | 20 column totals + grand 446, notes excluded | Fully-Automated | `pnpm test` on `totals.test.ts` w/ `sheet-13-03-69.json` | A — proven by this plan's checklist |
| B1 | CE↔BE conversion (13/3/2026 ↔ 13/3/69) | Fully-Automated | `pnpm test` on `be-date.test.ts` | A |
| A2 | total-weight math shape | Fully-Automated | `pnpm test` on `totals.test.ts` | A (values known-gap D) |
| C4 | every order action calls requireAuth | Fully-Automated | `pnpm test` on `auth-guard-coverage.test.ts` (orders in MODULES) | B — gate added by this plan |
| C1b | snapshot carry-forward on re-save (naive re-derive FAILS) | Fully-Automated | `pnpm test` on `order-save.test.ts` (`mergeSnapshots()`) | B — gate added by this plan |
| D1 | enter→save→reload persists 446 | Hybrid | `pnpm exec playwright test` — precondition: sandbox + seeded + `e2e/.auth/staff.json` | B |
| D2 | rename→resave preserves snapshot text | Hybrid | `pnpm exec playwright test` (or sandbox agent-probe) | B |
| B2 | grid column order + 29-slot fidelity | Agent-Probe | inspect grid vs form-canonical REF §3 | B |
| — | weight validated vs 4,670 กก/163 ปี๊บ | — | — | D — backlog `weight-factors_NOTE` (factors unknown until Q22) |
| — | duplicate-sheet TOCTOU under concurrent save | — | — | D — accepted residual (no DB unique; LAN-internal) |

gap-resolution legend: A = proven now · B = gate added by this plan's checklist · C = deferred to later phase · D = backlog/named residual.

C-4 reconciliation: `strategy` column carries only the 3 proving strategies (Fully-Automated / Hybrid / Agent-Probe). Known-Gap is never a strategy — the two `—` rows are named residuals via gap-resolution D.

Legacy line form (retained for existing consumers):
- totals engine: Fully-automated: `pnpm test` (totals.test.ts) — 20 columns + 446 + note-exclusion
- be-date: Fully-automated: `pnpm test` (be-date.test.ts) — CE↔BE
- auth coverage: Fully-automated: `pnpm test` (auth-guard-coverage.test.ts, orders in MODULES)
- snapshot preserve: Fully-automated: `pnpm test` (order-save.test.ts) — mergeSnapshots carry-forward
- persistence round-trip: Hybrid: `pnpm exec playwright test` + precondition sandbox/seeded/staff.json
- snapshot round-trip: Hybrid: `pnpm exec playwright test` (rename→resave) + precondition sandbox
- grid fidelity: Agent-probe: inspect vs form-canonical REF §3
- weight validation: known-gap: documented (factors unknown until Q22)
- duplicate TOCTOU: known-gap: documented (no DB unique; LAN-internal accepted residual)

### Plan updates applied (auto-selected, conservative — user away)

- [x] P1. Added `src/lib/order-save.ts` (`mergeSnapshots()` pure helper) to Blast Radius + Touchpoints.
- [x] P2. Added checklist C1b — red-first snapshot-preservation unit gate (`order-save.test.ts`) so naive re-derive-from-live-names FAILS a gate.
- [x] P3. Rewrote C1 with the REQUIRED SQL Server `NoAction` transaction order: read old snapshots FIRST → explicitly delete child OrderLine/NoteLine (no cascade) → re-insert carrying forward existing snapshots, fresh only for new cells → keep the same OrderSheet row.
- [x] P4. Added checklist C4 — extend `auth-guard-coverage.test.ts` MODULES with `src/app/orders/actions.ts` (ELEV-guard).
- [x] P5. Added checklist D2 — snapshot round-trip hybrid/agent-probe (rename→resave preserves text; CascadeDb never raw prisma).
- [x] P6. Expanded Test Plan tables + gap-resolution table + Verification Evidence with the new gates.

### Execute-agent instructions

- E1 (Section C entry): SQL Server FKs on OrderLine/NoteLine are `onDelete: NoAction`. On save, inside `$transaction`: (1) READ existing lines for the sheet FIRST and capture their snapshot text; (2) EXPLICITLY delete child OrderLine + NoteLine rows — never rely on cascade (deleting the sheet with children present is rejected); (3) re-insert, carrying forward captured snapshot text for cells that already existed (match by shopId+variantId), fresh snapshot only for new cells; (4) keep the SAME OrderSheet row, update `updatedAt`/`lastUpdated`.
- E2 (Section C — cascade wiring): if any snapshot back-fill goes through `correction-cascade.ts`, pass a real `CascadeDb` adapter, NEVER raw `prisma` (silently no-ops, no error — documented gotcha in `database/all-database.md`).
- E3 (Section C — auth): use `requireAuthState()` for `useActionState` state-returning order actions and `requireAuth()` for void actions, per `src/app/shops/actions.ts`. Each domain has its own ActionState type — create `OrderSheetActionState` etc., merge the `{ error }` shape from `requireAuthState`.
- E4 (registry): append `src/components/sheet-header.tsx` and `test-fixtures/sheet-13-03-69.json` to the Phase 04 section of `phase-blast-radius-registry.md` (currently missing — registry drift). Additive, no conflict.
- E5 (TDD order): Step A red-first (write `totals.test.ts` failing, then `totals.ts`); C1b red-first (`order-save.test.ts` before `mergeSnapshots` impl). Assert ALL 20 column totals + 446 + note-exclusion.
- E6 (safety): sandbox `orderstock-sql` DB only; never a customer/remote DB; do not stop/restart the 9 unrelated Docker containers; no git commit/push without user instruction; secrets never quoted in reports.

### Dimension findings

- Infra fit: CONCERN — all 5 new files collision-free; runners confirmed; registry Phase 04 claim missing sheet-header.tsx + fixture (E4 resolves).
- Test coverage: CONCERN → resolved — snapshot-preservation gate (C1b) + auth-guard extension (C4) added; totals/be-date Fully-Automated; Playwright hybrid fixtures present.
- Breaking changes: PASS — no schema migration; additive use of existing models; only downstream consumer (Phase 05) is unbuilt + declared.
- Security surface: CONCERN → resolved — ELEV closed by C4 mechanical guard; snapshot-rewrite (tampering) closed by C1b; TOCTOU + weight = accepted residuals; no new secrets/PII.
- Section A (totals engine): PASS — arithmetic independently verified (446); type-excludes notes.
- Section B (date + grid): PASS — Intl BE confirmed; 29 slots via Shop.rosterOrder; highest risk (BE) covered by B1.
- Section C (persistence): CONCERN → resolved — snapshot preserve + NoAction delete order + CascadeDb + TOCTOU addressed via P2/P3/E1/E2 + accepted residual.
- Section D (hybrid gate): PASS — Playwright staff.json fixture present.

Open gaps:
- weight-total validation: known-gap: documented as backlog `weight-factors_NOTE` — per-product weightKg/pipConversion unknown until customer Q22; piece-count 446 remains the hard gate.
- duplicate-sheet TOCTOU: known-gap: documented — accepted residual (no DB unique on date+location per decision 3; READ COMMITTED lets two concurrent saves both pass the existence check; LAN-internal low-concurrency app; filtered unique index is the deferred hardening).

### What This Coverage Does NOT Prove

- `totals.test.ts` (446): proves piece-count arithmetic + note-exclusion only — does NOT prove the UI wires the grid cells to `computeColumnTotals`, nor print output.
- `be-date.test.ts`: proves CE↔BE math — does NOT prove the on-screen BE label renders in the header component.
- `order-save.test.ts` (snapshot): proves the pure `mergeSnapshots()` carry-forward decision — does NOT prove the server action actually calls it inside the transaction (the D2 hybrid covers that end-to-end).
- `auth-guard-coverage.test.ts`: proves each order action CALLS requireAuth — does NOT prove the guard's internal role logic (covered by Phase-03 gates + its adversarial pack).
- Playwright persistence hybrid (446): proves DB round-trip on the sandbox — does NOT prove print output (Phase 05) nor behavior on the customer's real SQL Server.
- Snapshot round-trip hybrid: proves preserve-on-resave for a renamed still-unconfirmed shop — does NOT prove the confirmed-entity LOCK branch (Phase-02 correction-cascade owns that).
- Grid agent-probe: proves visual column order/29-slot fidelity by judgment — does NOT prove pixel-accurate print layout.
- Weight computation: ships but is NOT validated against 4,670 กก / 163 ปี๊บ (factors unknown — known-gap).
- Duplicate TOCTOU: no gate proves behavior under truly concurrent saves (accepted residual).

### High-risk pack

Required: no. Rationale: destructive writes are confined to the disposable Docker sandbox (`orderstock-sql`); no auth/identity flow change (consumes the existing Phase-03 `requireAuth` boundary, does not modify it); no billing/secrets/public-API/deploy surface. The mechanical ELEV-guard (C4) + snapshot gate (C1b) are the recorded evidence. Re-evaluate to `yes` only if EXECUTE introduces a new auth path or touches a non-sandbox DB.

### Backlog artifacts to create during durable capture

- `process/features/order-system/backlog/weight-factors_NOTE_06-07-26.md` — tracks the per-product weightKg/pipConversion factors (customer Q22) needed to validate total weight vs 4,670 กก / 163 ปี๊บ.
- (optional) `process/features/order-system/backlog/order-sheet-dup-index_NOTE_06-07-26.md` — tracks the deferred filtered-unique-index hardening for the date+location TOCTOU residual.

### Known gaps on record

- Total-weight validation — accepted (session, auto-selected): factors unknown until customer Q22; ship computation, mark un-validatable; piece-count 446 is the hard gate.
- Duplicate-sheet TOCTOU race — accepted (session, auto-selected): no DB unique (decision 3), LAN-internal low concurrency; filtered unique index deferred.

Gate: CONDITIONAL (0 FAILs; 4 concerns resolved via plan updates P1-P6 + execute instructions E1-E6; 2 known-gaps accepted)

Accepted by: session (auto-selected, user away — /goal-style conservative selection). FLAGGED FOR USER OVERRIDE BEFORE EXECUTE. Accepted concerns/gaps by name: (1) snapshot-preservation → resolved via C1b gate; (2) auth-guard-coverage extension → resolved via C4; (3) transaction NoAction order → resolved via E1; (4) registry drift → resolved via E4; (5) total-weight validation → accepted known-gap; (6) duplicate-sheet TOCTOU → accepted known-gap.
