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
**Umbrella plan:** process/features/pguard-redesign/completed/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ✅ VERIFIED (EVL independent re-run all gates green — rename correct, 88 units, 25/25 e2e, seed idempotent + no-dup, scope-fence EMPTY, 446 intact, frozen ดีลาน snapshots preserved) — PROGRAM COMPLETE (08-07-26)
**Report destination:** process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-05-data-align-verify_REPORT_07-07-26.md (flat in the program task folder)

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

**MODIFY:** `src/lib/product-order.ts` (4 display names only), `prisma/seed.ts` (rename-migration block before the loop), `package.json` (add `test:e2e` script).
**CREATE:** `src/lib/__tests__/product-names.test.ts` (rename correctness unit).
- role-label map = NO-OP verify (ROLE_LABELS already correct from Phase 02).
**IMMUTABLE (git-diff ZERO change; product-order.ts/seed.ts/package.json ARE edited this phase so the fence covers ONLY):** `saveOrderSheet`/`actions.ts`, `order-save.ts`, `totals.ts`, `schema.prisma`, `test-fixtures/sheet-13-03-69.json` (the 446 RESULT), `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`.

---

## Decisions (from INNOVATE — FINAL phase)

| # | Decision | Chosen |
|---|---|---|
| 1 | RENAME MECHANISM (load-bearing — avoids name-keyed-upsert duplicate trap) | The seed keys Product by `name` (`findFirst {name,isOffList}`), so a naive PRINT_VARIANTS edit would CREATE duplicate products + duplicate printOrder 2/3/4/5 variants. SAFE path: (a) `product-order.ts` edits ONLY the 4 display names (printOrder 2,3 ดีลานนิ่ม→ตีลานนิ่ม; printOrder 4,5 ดีลาน→ตีลาน; printOrder/column/group/packSize/labelVariant UNCHANGED; `ดีนิ่ม A` printOrder 1 NOT touched); (b) `prisma/seed.ts main()` adds an idempotent rename-migration BEFORE the PRINT_VARIANTS loop: `for ([old,new] of [["ดีลานนิ่ม","ตีลานนิ่ม"],["ดีลาน","ตีลาน"]]) await prisma.product.updateMany({where:{name:old,isOffList:false}, data:{name:new}})` → renames existing Product rows IN PLACE (same id/variants/printOrder) so the loop's `findFirst({name:"ตีลานนิ่ม"})` MATCHES → update-in-place, NO CREATE. Idempotent (2nd run: updateMany matches 0). |
| 2 | 446 fixture + totals | PROVEN safe: fixture/totals/order-payload key on printOrder/rosterOrder/qty, never names → rename cannot change 446. (Immutable set — NOT edited.) |
| 3 | Historical snapshots | FROZEN (keep-as-is, correct): old sheets (13/3/69) keep their ดีลาน `variantNameAtEntry` snapshots (historical fidelity — the seed `updateMany` touches only master Product/Variant rows, does NOT run the CRUD correction-cascade). NEW sheets + live matrix header + /summary bars show ตีลาน (data-driven from Product.name). Intended design; NO retroactive backfill. |
| 4 | Role labels | NO-OP verify: `ROLE_LABELS` already ADMIN=ผู้ดูแลระบบ / STAFF=พนักงาน (Phase 02). 2 real roles only. No edit; just verify consistency. |
| 5 | Off-list items | NOT renamed (`OFF_LIST_ITEMS` untouched — rename scope is only the 2 ดีลาน bases). |
| 6 | test:e2e script | Add `"test:e2e": "playwright test"` to `package.json` (the exit-gate cited `pnpm test:e2e` which didn't exist — low risk, package.json is edited this phase). |

**IMMUTABLE (git-diff ZERO change) — note `product-order.ts`/`seed.ts`/`package.json` ARE edited this phase, so the fence covers ONLY:** `saveOrderSheet`/`actions.ts`, `order-save.ts`, `totals.ts`, `schema.prisma`, `test-fixtures/sheet-13-03-69.json` (the 446 RESULT), `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`.

---

## Inner Loop Refresh Note

- **Date:** 08-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after outer RESEARCH + INNOVATE. FINAL phase.
- **Sections changed:** NEW Decisions section (load-bearing rename-migration mechanism to avoid the name-keyed-upsert duplicate trap; 446 proven-safe; frozen historical snapshots; role-label no-op verify; off-list untouched; add test:e2e), Blast Radius (product-order.ts 4 names + seed rename-migration block + package.json test:e2e + NEW product-names.test.ts; immutable fence covers 9 files, NOT product-order/seed/package.json this phase), Implementation Checklist rewritten to A–E concrete build (rename+unit / seed-migration+idempotency / test:e2e / role-label verify / FULL PROGRAM REGRESSION), Test Plan (rename unit + seed idempotency + no-duplicate-printOrder + ดีลานนิ่ม/ดีลาน count==0 + full 25/25 e2e + frozen-snapshot agent-probe), Exit Gate (full program regression list), NEW Program Closeout note in Resume, Phase Loop 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key facts folded in:** rename-migration BEFORE the seed loop (updateMany in-place, no CREATE, idempotent) to defeat the name-keyed findFirst duplicate trap; product-order.ts edits ONLY 4 display names (printOrder unchanged, ดีนิ่ม A untouched); 446 proven-safe (keys on printOrder/qty); historical ดีลาน snapshots FROZEN (no backfill) while new/live surfaces show ตีลาน; ROLE_LABELS no-op verify; OFF_LIST_ITEMS untouched; add test:e2e=playwright test; FULL PROGRAM REGRESSION gate (pnpm test ≥84 units incl 446+order-payload+summary+correction-cascade+rename, lint, build 20 routes, playwright 25/25 = 21 desktop + 4 mobile, seed idempotency, scope-fence git-diff on 9 immutable, agent-probe matrix/summary/new-print show ตีลาน + old-sheet print shows frozen ดีลาน).
- **Validate-contract left untouched** (placeholder) — PVL writes it next.
- **NOTE (do NOT execute now):** the UPDATE-PROCESS after EVL is the PROGRAM CLOSEOUT — see the Resume section.

---

## Implementation Checklist

### Step A — product-order.ts rename (4 display names)

- [x] A1. `src/lib/product-order.ts`: edit ONLY the 4 display names (printOrder 2,3 ดีลานนิ่ม→ตีลานนิ่ม; printOrder 4,5 ดีลาน→ตีลาน). printOrder/column/group/packSize/labelVariant UNCHANGED; `ดีนิ่ม A` (printOrder 1) NOT touched. `OFF_LIST_ITEMS` untouched.
- [x] A2. CREATE `src/lib/__tests__/product-names.test.ts` (Fully-Automated): assert printOrder 2/3 = "ตีลานนิ่ม …" and 4/5 = "ตีลาน …" via `variantDisplayName`.

### Step B — seed.ts rename-migration + idempotency

- [x] B1. `prisma/seed.ts main()`: add BEFORE the PRINT_VARIANTS loop — `for ([old,new] of [["ดีลานนิ่ม","ตีลานนิ่ม"],["ดีลาน","ตีลาน"]]) await prisma.product.updateMany({where:{name:old,isOffList:false}, data:{name:new}})` (renames master Product rows in place; the loop's `findFirst({name:"ตีลานนิ่ม"})` then MATCHES → update, NO CREATE). Keep DB shop tone-marks (เจ๊ not เจ้).
- [x] B2. Reseed idempotency: run `pnpm tsx prisma/seed.ts` TWICE → stable counts; 20 in-order variants; NO duplicate printOrder; `product.name` count for "ดีลานนิ่ม"/"ดีลาน" == 0 after.

### Step C — package.json script

- [x] C1. Add `"test:e2e": "playwright test"` to `package.json` scripts (the exit gate cites `pnpm test:e2e`).

### Step D — Role-label verify (no edit expected)

- [x] D1. Verify `ROLE_LABELS` already ADMIN=ผู้ดูแลระบบ / STAFF=พนักงาน (2 real roles); no cosmetic 3rd role. Consistency-only.

### Step E — FULL PROGRAM REGRESSION (prove all 4 prior phases + rename)

- [x] E1. `pnpm test` — units incl 446 + order-payload + summary + correction-cascade + the new rename unit (expect ≥84).
- [x] E2. `pnpm lint`; `pnpm build` (20 routes).
- [x] E3. `pnpm exec playwright test` — 25/25 (21 desktop + 4 mobile: matrix 446 + D2 + print G1-G8 + auth + settings + mobile 446).
- [x] E4. Seed idempotency (Step B2) + scope-fence git-diff EMPTY on the 9 immutable files.
- [x] E5. Agent-probe: matrix header + /summary bars + a NEW print sheet show ตีลาน; a PRE-EXISTING sheet's print shows the frozen ดีลาน snapshot.
- Note: no test hardcodes the seed name in an ASSERTING way (correction-cascade.test.ts uses ดีลานนิ่ม only as arbitrary input — passes regardless); optional cosmetic refresh, not required.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: renames + seed**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | 446 totals numerically intact after renames | `pnpm test` (totals suite) | no totals regression | display |
| Hybrid | Seed idempotent (run twice → identical); NO duplicate printOrder; product.name ดีลานนิ่ม/ดีลาน count==0 after | `pnpm tsx prisma/seed.ts` x2 + DB count assertions — precondition: sandbox DB running | idempotency + no-dup rename | live |
| Fully-automated | Rename applied in product-order.ts | Vitest asserts new labels at correct printOrder | rename correctness | UI |

**Area: cross-surface consistency + full regression**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Scope-fence: IMMUTABLE set has ZERO git diff | `git diff --exit-code -- actions.ts order-save.ts totals.ts schema.prisma test-fixtures/sheet-13-03-69.json get-sheet-for-print.ts print-table.tsx sheet-header.tsx print/layout.tsx` | payload/schema/totals/print untouched | UI |
| Hybrid | FULL PROGRAM regression: 25/25 e2e (21 desktop + 4 mobile) + ≥84 units | `pnpm test` + `pnpm exec playwright test` on sandbox | whole-program regression across all 4 prior phases + rename | — |
| Agent-probe | New surfaces show ตีลาน; a PRE-EXISTING sheet print shows the frozen ดีลาน snapshot | inspect matrix header + /summary + a new print vs an old-sheet print | data-driven rename + historical fidelity | pixel fidelity |

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
- A naive PRINT_VARIANTS rename (without the seed updateMany migration) creates duplicate products / duplicate printOrder → STOP; use the rename-migration block (decision 1).
- Any e2e suite red that requires a data-path change to fix → route as a follow-up (out of re-skin scope); document.
- Phases 02/03/04 exit gates not all met → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE (outer research) — seed keys Product by name (naive rename → duplicate trap); 446/totals key on printOrder not names; correction-cascade untouched by seed; test:e2e script missing (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — Decisions resolved (rename-migration updateMany-before-loop, 4 display names only, frozen historical snapshots, role-label no-op verify, off-list untouched, add test:e2e)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated with the safe rename mechanism + full-program regression gate; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: DONE — full V1-V7; net gate PASS (no FAILs); validate-contract written (see `## Validate Contract`). Duplicate-trap, 446 invariant, frozen-snapshot, scope-fence feasibility all code-verified.
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [x] 6. EVL — all EVL gates green (independent re-run); scope-fence EMPTY; rename correct; 446 intact; no dup printOrder; frozen ดีลาน snapshots preserved; EVL HANDOFF SUMMARY written
- [x] 7. UPDATE PROCESS — phase report written, umbrella state updated, program folder archived active→completed, context updated; commit done

**Validate-contract written — EXECUTE unblocked.**

---

## Touchpoints

- MODIFY `src/lib/product-order.ts` (4 names) + `prisma/seed.ts` (rename-migration) + `package.json` (test:e2e); CREATE `src/lib/__tests__/product-names.test.ts`; role-label map = no-op verify; IMMUTABLE zero-diff set (9 files)

---

## Public Contracts

- Display-only rename: `printOrder` mapping + saveOrderSheet payload + 446 numeric totals all UNCHANGED.
- Final program invariant proof: whole-program regression green across all re-skinned surfaces.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| 446 totals numerically intact | Fully-Automated | Program invariant — proven by: totals gate |
| Seed idempotent | Hybrid | DoD #5 (seed idempotent) — proven by: seed-idempotency gate (sandbox DB) |
| Rename applied at correct printOrder | Fully-Automated | DoD #5 (renames applied) — proven by: rename unit gate |
| IMMUTABLE set has ZERO git diff | Fully-Automated | Program invariant — proven by: scope-fence git-diff gate |
| FULL PROGRAM regression 25/25 e2e + ≥84 units | Hybrid | DoD #5 (full regression) — proven by: whole-program hybrid gate |
| New surfaces ตีลาน; old-sheet print frozen ดีลาน | Agent-Probe | DoD #5 (consistency + historical fidelity) — proven by: rename+snapshot agent-probe |

---

## Test Infra Improvement Notes

- After this phase, promote the whole-program e2e suite (matrix + summary + history + mobile) into a single documented regression command in `process/context/tests/all-tests.md` for future maintenance.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-05-data-align-verify_PLAN_07-07-26.md`
- Last completed step: 7. UPDATE PROCESS (program closeout complete)
- Validate-contract status: WRITTEN (PASS). EXECUTE + EVL complete; all gates green.
- Program status: pguard-redesign is ✅ COMPLETE (08-07-26). This phase folder has been archived — see below.

### PROGRAM CLOSEOUT (terminal phase — DONE)

This was the LAST phase. After EVL passed, step-7 UPDATE-PROCESS performed the program closeout:
- Moved the whole program folder `active/pguard-redesign_07-07-26/` → `completed/pguard-redesign_07-07-26/` (git mv, folder name unchanged).
- Umbrella: all phases → ✅ VERIFIED; program → ✅ COMPLETE.
- Wrote `phase-05-data-align-verify_REPORT_07-07-26.md`.
- `process/context/all-context.md`: pguard-redesign feature marked COMPLETE (08-07-26) / archived; final context updates applied.
- process/plan/context artefacts committed separately from execution commits.

---

## Plan Metadata

**Date**: 07-07-26
**Complexity**: COMPLEX (one phase of the pguard-redesign program)
**Status**: ✅ VERIFIED — PROGRAM COMPLETE (08-07-26)

## Overview

This is a phase plan within the pguard-redesign phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`pguard-redesign-umbrella_PLAN_07-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan has passed the RIPER-5 VALIDATE (PVL) step; ENTER EXECUTE MODE.

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

Status: PASS
Date: 08-07-26
date: 2026-07-08
generated-by: inner-pvl: phase-5

Parallel strategy: sequential
Rationale: 1 signal (S2 schema-adjacent data touch); single-domain display rename + regression gate. All load-bearing claims code-verified inline during V1–V3; no fan-out needed.

Test gates (C3 5-column — ADDITIVE; legacy line form retained below):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| A2 | product-order.ts printOrder 2/3="ตีลานนิ่ม …", 4/5="ตีลาน …" | Fully-Automated | `pnpm test` → `src/lib/__tests__/product-names.test.ts` asserts via `variantDisplayName` | B (test added this plan) |
| 446 | 446 grand total numerically intact after rename | Fully-Automated | `pnpm test` totals suite (fixture keys printOrder/qty, not names) | A (passes now) |
| B2 | Seed idempotent x2: 20 in-order variants, NO dup printOrder, ดีลานนิ่ม/ดีลาน count==0 | Hybrid | `pnpm tsx prisma/seed.ts` ×2 + DB count assertions — precondition: sandbox DB running | A (proven at EXECUTE) |
| E4 | IMMUTABLE 9-file set has ZERO git diff | Fully-Automated | `git diff --exit-code -- actions.ts order-save.ts totals.ts schema.prisma test-fixtures/sheet-13-03-69.json get-sheet-for-print.ts print-table.tsx sheet-header.tsx print/layout.tsx` | A (passes now) |
| E3 | FULL regression 25/25 e2e (21 desktop + 4 mobile) + ≥84 units | Hybrid | `pnpm test` + `pnpm exec playwright test` — precondition: sandbox DB + app | A (proven at EXECUTE) |
| E5 | New matrix/summary/new-print show ตีลาน; old-sheet print shows frozen ดีลาน | Agent-Probe | inspect matrix header + /summary + new print vs old-sheet print | A (judgment recorded at EVL) |

gap-resolution legend: A — proven now/at run; B — test added by this plan; C — deferred to named later phase; D — backlog stub.
C-4: `strategy` column carries only Fully-Automated / Hybrid / Agent-Probe. No Known-Gap rows — every developed behavior has a Fully-Automated or Hybrid gate (frozen-snapshot behavior is also covered by the existing correction-cascade.test.ts unit).

Legacy line form (retained for existing consumers):
- product-order rename: Fully-automated: `pnpm test` (product-names.test.ts)
- 446 invariant: Fully-automated: `pnpm test` (totals suite)
- seed idempotency + no-dup: hybrid: `pnpm tsx prisma/seed.ts` ×2 + DB count asserts — precondition: sandbox DB
- scope-fence: Fully-automated: `git diff --exit-code -- <9 immutable files>`
- full regression: hybrid: `pnpm test` + `pnpm exec playwright test` — precondition: sandbox DB + app
- frozen snapshot: agent-probe: new surfaces ตีลาน vs old-sheet print ดีลาน

Failing stub (Fully-Automated rows):
- A2: `test("printOrder 2/3 read ตีลานนิ่ม and 4/5 read ตีลาน", () => { throw new Error("NOT IMPLEMENTED — TDD stub: product-order rename at correct printOrder") })`
- 446: `test("446 grand total unchanged after rename", () => { throw new Error("NOT IMPLEMENTED — TDD stub: 446 invariant intact") })`
- E4: `test("IMMUTABLE 9-file set has zero git diff", () => { throw new Error("NOT IMPLEMENTED — TDD stub: scope-fence git-diff empty") })`

Dimension findings:
- Infra fit: PASS — runner `vitest run`; @playwright/test + tsx installed; `test:e2e` absent (plan adds it, additive/safe); git repo present (branch main) so scope-fence git-diff is runnable.
- Test coverage: PASS — rename unit + 446 + seed-idempotency/no-dup + scope-fence + full 25 e2e + frozen-snapshot probe; every developed behavior has a Fully-Auto or Hybrid gate.
- Breaking changes: PASS — display-only; printOrder/saveOrderSheet payload/schema/totals unchanged; 446 keys on printOrder not names (verified: 51 printOrder / 64 qty / 0 name keys); frozen snapshots preserved (no backfill).
- Security surface: PASS — no auth/billing/secret/trust-boundary change; seed admin logic untouched (not in blast radius); rename is display strings only.
- Section A (product-order rename + unit): PASS — 4 `productName:` edits uniquely matchable (printOrder 2,3=ดีลานนิ่ม / 4,5=ดีลาน; printOrder 1 ดีนิ่ม A untouched); new unit file, no collision.
- Section B (seed rename-migration + idempotency): PASS — highest-risk edit; `updateMany`-before-loop verified against `upsertProduct` findFirst({name,isOffList}) + `upsertVariant` findFirst({productId,packSize,labelVariant}) keying → genuinely prevents duplicate Product/printOrder. Mitigation: place updateMany BEFORE the PRINT_VARIANTS loop; assert no-dup + count==0 after x2.
- Section C (package.json test:e2e): PASS — additive script, no consumer breakage.
- Section D (role-label verify): PASS — ROLE_LABELS already ADMIN=ผู้ดูแลระบบ/STAFF=พนักงาน (confirmed); no-op.
- Section E (full regression): PASS — gate complete, buildable, real commands (pnpm test / lint / build / pnpm exec playwright test / seed x2 / git diff).

Open gaps: none.

What this coverage does NOT prove:
- product-names.test.ts (Fully-Auto): proves the display strings at printOrder 2-5; does NOT prove UI render or DB state.
- 446 totals gate (Fully-Auto): proves numeric grand total; does NOT prove display names anywhere.
- seed-idempotency gate (Hybrid): proves no duplicate rows / count==0 given a running sandbox DB; does NOT prove behavior against the customer's real SQL Server (out of scope — sandbox only).
- scope-fence git-diff (Fully-Auto): proves the 9 immutable files are byte-unchanged; does NOT prove UI correctness.
- full-regression e2e (Hybrid): proves the whole-program flows green given a running app + sandbox DB; does NOT prove pixel-level print fidelity (that is the agent-probe's job).
- frozen-snapshot agent-probe: proves human-judged old=ดีลาน / new=ตีลาน; does NOT provide an automated assertion (backed by correction-cascade.test.ts for the underlying lock).

Gate: PASS (no FAILs; all load-bearing claims code-verified; plan validator 0 failures/0 warnings)
Accepted by: session (autonomous, /goal execution — user pre-consented "ทำเฟส 5 ต่อจนจบ" to proceed to EXECUTE + program closeout on a no-FAIL gate). No CONCERNs required acceptance (net gate PASS).

Note (goal block): umbrella plan holds `## Stable Program Goal` → BRANCH B; no `## Autonomous Goal Block` written to this phase plan. The umbrella /goal governs. Reference for latest state: process/features/pguard-redesign/completed/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
