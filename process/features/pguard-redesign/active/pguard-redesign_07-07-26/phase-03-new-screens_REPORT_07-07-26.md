---
phase: phase-03-new-screens
date: 2026-07-08
status: COMPLETE
feature: pguard-redesign
plan: process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-03-new-screens_PLAN_07-07-26.md
---

# Phase 03 — New Screens — EXECUTE Report (DRAFT)

> DRAFT — EVL independent re-run + UPDATE-PROCESS still owned by the orchestrator. All 9 phase gates
> green in this execute session. Both screens are pure READ-ONLY; the 9-file immutable set is zero-diff.

## What Was Done

- **CREATE `src/lib/summary.ts`** (pure, imports `totals.ts`, no re-impl of column totals):
  - `computeShopTotals(cells: OrderLineCell[]): Record<number, number>` — Σ qty per `rosterOrder`.
  - `topShops(cells, n = 8): { rosterOrder, qty }[]` — qty-desc, `rosterOrder`-asc tiebreak, sliced.
- **CREATE `src/lib/__tests__/summary.test.ts`** — TDD red-first (confirmed red: module-missing; then
  green). 7 tests: shop-totals Σ==446; known per-shop values; top-8 exact ordering; default-n≤8;
  empty→{}/[]; per-column reconciliation via the UNCHANGED `computeColumnTotals`.
- **MODIFY `src/app/(main)/summary/page.tsx`** (filled the Phase-01 stub): server component,
  `requireAuth`, `force-dynamic`. Fetches most-recent sheet OR `?date`(+`?location`) via a local
  UTC-midnight `parseDbDate` (mirrors get-sheet-for-print). Builds `OrderLineCell[]`, derives
  `computeColumnTotals`/`computeGrandTotal`/`topShops`. KPI strip (น้ำหนัก "—" / ปี๊บ "—" / ร้านที่สั่ง
  count / รวมจำนวน grandTotal, `data-testid="grand-total"`) → 2fr/1fr grid → LEFT 20-bar Card
  (green GOODS / amber SEASONING via `product.group`, CSS width-%, `data-testid="bar-{printOrder}"` +
  `data-qty`, green-50 footer) → RIGHT top-8 Card + หน่วยพิเศษจากหมายเหตุ Card. Empty state
  "ยังไม่มีใบออเดอร์".
- **MODIFY `src/app/(main)/history/page.tsx`** (filled the stub): server component, `requireAuth`,
  `force-dynamic`. `OrderSheet.findMany` date-desc + ONE `orderLine.groupBy({by:[sheetId,shopId],
  _sum:{qty}})` reduced in memory to `{units, shopCount}`, unioned with a `noteLine.groupBy` for
  note-only shops (matches matrix orderedCount, no N+1). pguard Card table (BE mono date · th-TH
  weekday · ร้านที่สั่ง · รวมหน่วย · unit bar amber-if-today · น้ำหนัก "—" · ปี๊บ "—" · status chip ·
  "เปิดใบงาน"→/orders/{id}). Today (UTC-midnight compare) = amber row + "กำลังกรอก"; past =
  "ปิดยอดแล้ว". Current-month footer (วันทำการ / รวมหน่วย / เฉลี่ย, no weight). Empty state.
- **CREATE `e2e/summary-history.spec.ts`** (ADMIN storage-state) with a `beforeEach` clean-state
  helper (deletes E2E-located sheets, restores " TEST"-suffixed shops — the Phase-02 EVL residual).
  G6: /summary grand 446 + 20 bars for the seeded day. G7: /history today=live, past=closed,
  weight="—", "เปิดใบงาน" href.

## What Was Skipped or Deferred

- weight / ปี๊บ values on both screens render "—" by design (not persisted — existing backlog note
  `backlog/weight-peep-persistence_NOTE_07-07-26.md`). History month footer omits the weight aggregate.

## Test Gate Outcomes

| Gate | Command | Result |
|---|---|---|
| G1 summary unit | `pnpm test src/lib/__tests__/summary.test.ts` | PASS 7/7 (Σ446, top-8, empty) |
| G2 full unit suite | `pnpm test` | PASS 82/82 (446 fixture intact) |
| G3 scope fence | `git diff --exit-code` on 9 immutable files | PASS — EMPTY (exit 0); all 9 paths exist |
| G4 build | `pnpm build` | PASS — `/summary` + `/history` are ƒ dynamic routes |
| G5 lint | `pnpm lint` | PASS (clean) |
| G6 /summary hybrid | Playwright ADMIN | PASS — grand 446, 20 bars, col totals |
| G7 /history hybrid | Playwright ADMIN + clean-state | PASS — live/closed status, weight dash, link |
| G8 e2e regression | `pnpm exec playwright test` | PASS 21/21 (19 prior + 2 new) |
| G9 prototype fidelity | agent-probe screenshots (light+dark) | PASS — pguard theme, 446; `harness/phase-03/*.png` |

## Plan Deviations

- **topShops signature** — takes `cells: OrderLineCell[]` (per the execute-handoff spec) and computes
  shopTotals internally, rather than the checklist A1 "topShops(shopTotals)" wording. Within
  blast-radius (same file, same semantic result); no contract impact.
- **/summary day selection** — used `?date`+`?location` (Decision 3) to make the hybrid gate
  deterministic against the seeded E2E sheet; default (no query) still = most-recent sheet.

## Test Infra Gaps Found

- None new. Reused the 446 fixture as the summary-bars + seed input (as the plan's Test Infra note
  intended). The `beforeEach` clean-state helper now exists in `e2e/summary-history.spec.ts` — a
  candidate to hoist into a shared e2e util if Phase 04 needs it.

## Closeout Packet

- Selected plan: `.../phase-03-new-screens_PLAN_07-07-26.md`
- Finished: summary.ts + tests, /summary, /history, e2e spec — all 9 gates green.
- Verified: G1–G9 in this session. Unverified: independent EVL re-run (orchestrator-owned).
- Remaining: EVL confirmation run; UPDATE-PROCESS (umbrella state, context note, phase commit).
- Best next state: EVL (spawn vc-tester) then UPDATE PROCESS.

## Forward Preview

### Test Infra Found
- `e2e/summary-history.spec.ts` clean-state `beforeEach` (delete E2E sheets + restore renamed shops)
  is reusable by Phase 04 mobile e2e.

### Blast Radius Changes
- New: `src/lib/summary.ts`, `src/lib/__tests__/summary.test.ts`, `e2e/summary-history.spec.ts`.
- Modified: `src/app/(main)/summary/page.tsx`, `src/app/(main)/history/page.tsx`.
- 9 immutable files: zero-diff (confirmed).

### Commands to Stay Green
- `pnpm test` (82) · `pnpm lint` · `pnpm build` · `pnpm exec playwright test` (21).

### Dependency Changes
- None. No new package, no schema change, no new write path. `summary.ts` depends only on `totals.ts`.
```

---

## EVL HANDOFF SUMMARY

**EVL confirmation run (independent, unconditional re-run — vc-tester, 2026-07-08).** All 9 validate-contract gates re-run from scratch (execute-agent's "all green" treated as hypothesis, not skip license). Independent result MATCHES claimed on every gate.

| # | Gate | Command | Independent result |
|---|---|---|---|
| G1 | summary unit | `pnpm test src/lib/__tests__/summary.test.ts` | PASS 7/7 |
| G2 | full unit suite | `pnpm test` | PASS 82/82 (15 files; totals 6/6, summary 7/7) |
| G3 | scope fence | `git diff --exit-code` (9 immutable files) | PASS — exit 0, EMPTY; `summary.ts` is NEW/untracked, `totals.ts` unmodified |
| G4 | build | `pnpm build` | PASS — exit 0; `/summary` + `/history` = ƒ Dynamic |
| G5 | lint | `pnpm lint` | PASS — exit 0 |
| G6 | /summary hybrid | `playwright` (seeded day) | PASS — grand 446, 20 bars, col totals 137/99/82 |
| G7 | /history hybrid | `playwright` (clean-state) | PASS — live/closed chips, weight "—", /orders/{id} link |
| G8 | e2e regression | `pnpm exec playwright test` | PASS 21/21 (19 prior + 2 new) |
| G9 | prototype fidelity | agent-probe screenshots | PASS — `harness/phase-03/*.png` (light+dark) + orchestrator live-confirm |

- **Summary-invariant verdict:** CONFIRMED. `/summary` LEFT bars fed by `computeColumnTotals(cells)`, grand via `computeGrandTotal(cells)` (page.tsx L88–89); `computeShopTotals`/`topShops` are pure additive per-shop helpers that do NOT re-derive column totals.
- **History-correctness verdict:** CONFIRMED. Two `groupBy` aggregates + one `findMany` (no per-sheet N+1 loop); today-vs-closed via UTC-midnight key compare (`dbDayKey` vs `todayKey`, not naive `new Date`); weight/ปี๊บ render "—"; shopCount unions NoteLine shops.
- **e2e determinism:** CONFIRMED. `beforeEach(cleanState)` + `afterAll(cleanState)` in `summary-history.spec.ts` drop E2E-located sheets and restore renamed shops → re-runnable regardless of order.
- **Deviation audit (2):** both BENIGN. (1) `topShops(cells)` computes shopTotals internally vs the A1 "shopTotals" arg wording — same file, same result, documented. (2) `/summary` `?date`+`?location` hybrid selector with most-recent default — matches Decision 3.

```yaml
gates_green: [G1, G2, G3, G4, G5, G6, G7, G8, G9]
known_gaps: [weight/ปี๊บ unpersisted — render "—" by design, backlog note registered; multi-location same-day summary out of scope]
follow_up_stubs: [hoist e2e clean-state beforeEach into shared util if Phase 04 needs it]
context_partial: []
preliminary_packet_path: process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-03-new-screens_REPORT_07-07-26.md
closeout_classification: CLEAN
```
