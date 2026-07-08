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
**Phase status:** ✅ VERIFIED (EVL independent re-run 08-07-26: all 9 gates green + scope fence EMPTY; awaiting UPDATE PROCESS)
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
- REUSE `src/components/ui/*` + uxui tokens + the order-matrix KPI-strip markup; consume `totals.ts` unchanged. Token/primitive contract: `process/context/uxui/all-uxui.md`.

---

## Dependencies

- Phase 02 (matrix data + primitives + `computeColumnTotals` availability). Independent of Phase 04 (mobile) — the two could run in parallel post-Phase-02.

---

## Blast Radius (exact file touch list)

**CREATE:** `src/lib/summary.ts` (computeShopTotals + topShops(8), pure, imports totals.ts), `src/lib/__tests__/summary.test.ts`.
**MODIFY:** `src/app/(main)/summary/page.tsx` (fill stub), `src/app/(main)/history/page.tsx` (fill stub).
- consumes (unchanged, read-only): `totals.ts` (`computeColumnTotals`/`computeGrandTotal`), OrderSheet query layer, `src/components/ui/*`, order-matrix KPI-strip markup, `parseDbDate`/`ceToBeDisplay`.
**IMMUTABLE (git-diff ZERO change):** `totals.ts`, `order-save.ts`, `actions.ts`, `schema.prisma`, `test-fixtures/sheet-13-03-69.json`, `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`.

---

## Decisions (from INNOVATE — both screens pure read-only)

| # | Decision | Chosen |
|---|---|---|
| 1 | Summary LEFT | The 20 `computeColumnTotals` columns rendered ONE BAR EACH (label=product name, sub=unit, color green=GOODS / amber=SEASONING via `product.group`) — NOT a product-group rollup. The gate "summary bars == computeColumnTotals" is LITERALLY this. |
| 2 | Summary RIGHT | Top-8 per-shop totals (new pure `computeShopTotals` in `src/lib/summary.ts`) + "หน่วยพิเศษจากหมายเหตุ" (NoteLine text per shop). |
| 3 | Summary day | Default the MOST RECENT OrderSheet (`findFirst orderBy date desc, id desc`); optional `?date=yyyy-mm-dd`(+`?location=`) reusing the get-sheet-for-print date convention (`parseDbDate` — NO naive `new Date` compare). Empty state "ยังไม่มีใบออเดอร์". No date-picker (YAGNI). |
| 4 | History rows | Query REAL OrderSheet rows date-desc; per-sheet aggregates via Prisma `groupBy({by:["sheetId","shopId"], _sum:{qty}})` reduced in-memory to `{units, shopCount}` (ONE query, no N+1). "ร้านที่สั่ง" counts shops with ≥1 OrderLine OR NoteLine (union NoteLine shopIds — matches the matrix orderedCount). Today (date==today, UTC-midnight compare) → chip "กำลังกรอก" + amber-50 row; else → "ปิดยอดแล้ว" success chip. DROP the prototype's "รอเชื่อมฐานข้อมูล" mock chip. |
| 5 | History weight/ปี๊บ | Columns → "—" (not persisted). Month footer → วันทำการ N วัน · รวมหน่วย Σ · เฉลี่ย Σ/N (OMIT the weight aggregate — no data source). |
| 6 | History links/labels | "เปิดใบงาน" → `/orders/{id}`. Weekday label via `toLocaleDateString("th-TH",{weekday:"short"})`. BE date via `ceToBeDisplay`. |

**IMMUTABLE (read-only consumers only; git-diff ZERO change on the 9 immutable files):** `totals.ts`, `order-save.ts`, `actions.ts`, `schema.prisma`, `test-fixtures/sheet-13-03-69.json`, `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`. Scope-fence git-diff still applies.

---

## /summary Page Spec (encode)

Server component, `requireAuth`, `force-dynamic`. Fetch (mirror `get-sheet-for-print.ts`): sheet (most recent or `?date`), variants (printOrder not null, include `product.group`+`name`), orderLines, noteLines, shops. Build `OrderLineCell[]` (map variantId→printOrder). `columnTotals=computeColumnTotals`, `grandTotal=computeGrandTotal`, `shopTotals=computeShopTotals→topShops(8)`.
- Layout: KPI strip (REUSE order-matrix markup: น้ำหนัก "—" / ปี๊บ "—" / ร้านที่สั่ง count / รวมจำนวน grandTotal) → grid 2fr/1fr.
- LEFT Card "ยอดผลิตตามสินค้า": 20 rows (grid `180px 1fr 70px`, 8px bar width=`v/max%`, mono qty, green/amber legend, green-50 footer "รวมทุกสินค้า {grandTotal} หน่วย").
- RIGHT: Card "ร้านที่สั่งมากที่สุด" top-8 (5px bar) + Card "หน่วยพิเศษจากหมายเหตุ" (shop→note).
- Bars: CSS width-% only (`max=Math.max(1,...)`).
- Test hooks: `data-testid` on the grand total + a per-column bar value for e2e.

## /history Page Spec (encode)

Server component, `requireAuth`, `force-dynamic`. `OrderSheet.findMany` date-desc + the groupBy aggregate (units+shopCount per sheet, union note shops).
- Table (pguard Card): วันที่ (mono BE) · วัน (Thai weekday) · ร้านที่สั่ง · รวมหน่วย (mono) · units bar (`v/maxUnits`, amber if today) · น้ำหนัก "—" · ปี๊บ "—" · status chip · "เปิดใบงาน" → `/orders/{id}`.
- Today row amber-50 + "กำลังกรอก"; else "ปิดยอดแล้ว".
- Month footer (current month): วันทำการ + รวมหน่วย + เฉลี่ย (no weight). Empty state.

---

## Inner Loop Refresh Note

- **Date:** 07-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after outer RESEARCH + INNOVATE (both screens pure read-only).
- **Sections changed:** Entry Gate (reuse ui/* + KPI-strip markup + uxui contract), NEW Decisions section (summary left=20 computeColumnTotals bars not group-rollup, right=computeShopTotals top-8 + note units, most-recent-sheet default + optional ?date via parseDbDate, history groupBy one-query aggregate + union note shops + today/closed chips dropping mock chip, weight/ปี๊บ "—", th-TH weekday + ceToBeDisplay), NEW /summary + /history page specs, Blast Radius (add src/lib/summary.ts + test + immutable set), Implementation Checklist rewritten to concrete build, Test Plan (summary.test.ts unit + scope-fence git-diff + beforeEach clean-state helper), Phase Loop 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key facts folded in:** summary bars ARE the 20 computeColumnTotals columns (literal gate); computeShopTotals+topShops pure in src/lib/summary.ts (imports totals.ts, no re-impl); most-recent-sheet default + optional ?date/?location via parseDbDate (no naive Date); history single groupBy aggregate (no N+1) with union note-shop count matching matrix orderedCount; today/closed status via UTC-midnight compare; weight/ปี๊บ = "—" (not persisted); month footer omits weight; th-TH weekday + ceToBeDisplay + /orders/{id} links; summary.test.ts (446 sum, topShops≤8 desc, column reconcile, empty→{}); Hybrid e2e adds a beforeEach clean-state helper (Phase-02 residual) for deterministic /history.
- **Validate-contract left untouched** (placeholder) — PVL writes it next.

---

## Implementation Checklist

### Step A — summary lib (TDD RED FIRST)

- [x] A1. CREATE `src/lib/summary.ts`: pure `computeShopTotals(cells)` + `topShops(cells, n=8)` — imports `totals.ts`, NO re-impl of column totals. (topShops takes `cells` per the execute-handoff signature, computing shopTotals internally — within-blast-radius deviation from the "shopTotals" arg wording.)
- [x] A2. CREATE `src/lib/__tests__/summary.test.ts` (red-first, confirmed red→green): `computeShopTotals(fixture.cells)` sums to 446; `topShops`≤8 sorted desc (rosterOrder-asc tiebreak) == hand-computed; column totals via `computeColumnTotals` reconcile to `fixture.expectedColumnTotals`; empty→{}. 7/7 green.

### Step B — สรุปยอดผลิต (/summary)

- [x] B1. MODIFY `src/app/(main)/summary/page.tsx` (fill stub) per the /summary Page Spec: server component, `requireAuth`, `force-dynamic`; fetch most-recent sheet (or `?date`/`?location` via `parseDbDate`); build OrderLineCell[]; KPI strip (reuse order-matrix markup); 2fr/1fr grid; LEFT 20-bar Card (green=GOODS/amber=SEASONING), RIGHT top-8 + note-units Cards; CSS width-% bars; empty state "ยังไม่มีใบออเดอร์". Test hooks on grand-total + a per-column bar value.

### Step C — ประวัติออเดอร์ (/history)

- [x] C1. MODIFY `src/app/(main)/history/page.tsx` (fill stub) per the /history Page Spec: `OrderSheet.findMany` date-desc + ONE `groupBy` aggregate (units+shopCount, union NoteLine shops); pguard Card table (วันที่ BE mono / วัน th-TH weekday / ร้านที่สั่ง / รวมหน่วย / units bar amber-if-today / น้ำหนัก "—" / ปี๊บ "—" / status chip / "เปิดใบงาน"→/orders/{id}); today row amber-50 + "กำลังกรอก" else "ปิดยอดแล้ว" (drop the mock chip); month footer (วันทำการ + รวมหน่วย + เฉลี่ย, no weight); empty state.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: summary bars (core correctness)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | `summary.test.ts`: computeShopTotals sums 446; topShops≤8 desc; columns reconcile to fixture.expectedColumnTotals; empty→{} | `pnpm test` on `src/lib/__tests__/summary.test.ts` | shop-totals + column-consistency correctness | visual |
| Fully-automated | Scope-fence: IMMUTABLE set has ZERO git diff | `git diff --exit-code -- totals.ts order-save.ts actions.ts schema.prisma test-fixtures/sheet-13-03-69.json get-sheet-for-print.ts print-table.tsx sheet-header.tsx print/layout.tsx` | no forbidden-file change | UI |
| Hybrid | /summary renders bars for the seeded 13/3/69 day (grand 446) | Playwright (ADMIN storage-state) on the seeded day | end-to-end summary grand 446 | pixel fidelity |

**Area: history (real rows)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | /history lists real OrderSheet rows w/ correct today/closed status + weight dash | Playwright (ADMIN storage-state): seed today + a past sheet; assert statuses. ADD a beforeEach clean-state helper (Phase-02 residual) so /history is deterministic | real-data listing | UI polish |
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

- [x] 1. RESEARCH — research-agent: DONE (outer research) — read-only screens; get-sheet-for-print fetch pattern, parseDbDate convention, OrderSheet groupBy aggregate, union note-shop count confirmed (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — Decisions resolved (summary=20 computeColumnTotals bars, computeShopTotals top-8, most-recent-default + optional ?date, history one-query groupBy + today/closed chips, weight/ปี๊บ dash, th-TH weekday)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated with the full /summary + /history build + summary.ts lib; Inner Loop Refresh Note written
- [x] 4. PVL — validate-contract written (orchestrator-authored after PVL agent completed checks but was API-cut-off twice mid-write); net gate CONDITIONAL, 0 FAILs, read-only phase
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green. G1 unit 7/7, G2 full 82/82, G3 scope-fence EMPTY, G4 build ok (/summary+/history dynamic), G5 lint ok, G6/G7 e2e green, G8 regression 21/21, G9 probe 446 (see `harness/phase-03/`). Report drafted.
- [x] 6. EVL — independent unconditional re-run (vc-tester, 08-07-26): all 9 gates green (unit 82/82, scope-fence EMPTY, build, lint, e2e 21/21, probe 446); summary-invariant + history-correctness + e2e-determinism CONFIRMED; 2 deviations benign; EVL HANDOFF SUMMARY + harness/phase-03/verification.json written
- [x] 7. UPDATE PROCESS — phase report written, umbrella state updated, context updated, commit done

**Validate-contract required before execute.**

---

## Touchpoints

- CREATE `src/lib/summary.ts` + `src/lib/__tests__/summary.test.ts`; MODIFY `src/app/(main)/summary/page.tsx` + `src/app/(main)/history/page.tsx`; IMMUTABLE zero-diff set (9 files)

---

## Public Contracts

- Read-only consumers of `computeColumnTotals` + the OrderSheet query layer — no new write path, no schema change.
- Fills the `/summary` + `/history` nav routes stubbed in Phase 01.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Summary bars == computeColumnTotals; computeShopTotals sums 446 | Fully-Automated | DoD #3 (summary bars) — proven by: summary.test.ts unit gate |
| IMMUTABLE set has ZERO git diff | Fully-Automated | Program invariant — proven by: scope-fence git-diff gate |
| /history lists real OrderSheet rows | Hybrid | DoD #3 (real rows, no mock) — proven by: history hybrid gate |
| Screens match handoff prototype | Agent-Probe | Re-skin fidelity — proven by: screenshot agent-probe |

---

## Test Infra Improvement Notes

- Reuse the 446 fixture as the summary-bars assertion input so /summary is anchored to the same canonical dataset. Record in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-03-new-screens_PLAN_07-07-26.md`
- Last completed step: 3. PLAN-SUPPLEMENT (full /summary + /history build + summary.ts lib folded in)
- Validate-contract status: pending — NEXT STEP is PVL (spawn vc-validate-agent). Do NOT execute yet.
- Next step: Spawn vc-validate-agent for PVL (Step 4). Both screens are pure read-only; the immutable 9-file set must show ZERO git diff; summary bars ARE the 20 computeColumnTotals columns.

---

## Plan Metadata

**Date**: 07-07-26
**Complexity**: COMPLEX (one phase of the pguard-redesign program)
**Status**: ✅ VERIFIED

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

<!-- generated-by: inner-pvl: phase-03 (contract authored by orchestrator after the PVL agent completed all checks but was cut off twice by an API connection error mid-write; checks confirmed BRANCH B + zero FAILs on this read-only phase) -->

**Net gate: CONDITIONAL** — 0 FAILs. Read-only phase (adds `/summary` + `/history` pages + a pure `src/lib/summary.ts`; consumes `totals.ts` unchanged). No new write path, no schema change; the 9-file immutable set must stay zero-diff. All gates below are proven at EXECUTE/EVL.

**Accepted by:** orchestrator on the user's advance consent to proceed to EXECUTE if the net gate has no FAILs (read-only phase). Auto-selected: most-recent-sheet default for /summary (optional `?date`), history month-footer omits the unpersisted weight aggregate — both recorded as Decisions in this plan; open to override before EXECUTE.

### Gates (per-item verification)
| # | Gate | Command / method | Tier | Pass condition |
|---|---|---|---|---|
| G1 | summary aggregation | `pnpm test src/lib/__tests__/summary.test.ts` | Fully-Automated | `computeShopTotals(fixture.cells)` sums to 446; `topShops(cells,8)` ≤8, sorted desc, matches hand-computed; per-column via `computeColumnTotals` reconciles to `fixture.expectedColumnTotals`; empty→`{}` no throw |
| G2 | full unit suite | `pnpm test` | Fully-Automated | all green incl the existing 446 fixture test (totals.ts unchanged) |
| G3 | scope fence | `git diff --exit-code -- src/app/(main)/orders/actions.ts src/lib/order-save.ts src/lib/totals.ts prisma/schema.prisma test-fixtures/sheet-13-03-69.json src/lib/get-sheet-for-print.ts src/app/print/print-table.tsx src/components/sheet-header.tsx src/app/print/layout.tsx` | Fully-Automated | exit 0, EMPTY (summary.ts is NEW; totals.ts NOT modified) |
| G4 | build | `pnpm build` | Fully-Automated | exit 0; `/summary` + `/history` are real dynamic routes |
| G5 | lint | `pnpm lint` | Fully-Automated | exit 0 |
| G6 | /summary hybrid | Playwright (ADMIN storage-state), open `/summary` on the seeded 13/3/69 day | Hybrid | grand total 446 rendered; 20 product bars present (green GOODS / amber SEASONING); top-8 shops + notes list render |
| G7 | /history hybrid | Playwright, open `/history` with a `beforeEach` clean-state helper | Hybrid | lists real OrderSheet rows date-desc; today row = "กำลังกรอก" (amber), past = "ปิดยอดแล้ว"; weight/ปี๊บ show "—"; "เปิดใบงาน" → /orders/{id} |
| G8 | existing e2e regression | `pnpm exec playwright test` | Hybrid | auth/orders(446+D2)/print/settings all green (19/19+) |
| G9 | prototype fidelity | agent-probe screenshot vs the `.dc.html` summary/history screens | Agent-Probe | pguard theme, layout matches |

### EVL evidence required
- G1 test output (446 reconcile); G3 git-diff exit 0; G4/G5 exit 0; G6/G7/G8 Playwright green with the clean-state helper; G9 screenshot. Regression: Phases 01–02 surfaces (matrix save 446, print sheet, auth) still green via G8.

### What this coverage does NOT prove
- weight/ปี๊บ values (unpersisted — render "—" by design; a future schema field, backlog note registered).
- Multi-location same-day summary (single-location assumption per Decisions).
