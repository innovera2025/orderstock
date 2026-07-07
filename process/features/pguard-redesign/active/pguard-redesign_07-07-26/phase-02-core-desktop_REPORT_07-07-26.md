---
phase: phase-02-core-desktop
date: 2026-07-07
status: COMPLETE
feature: pguard-redesign
plan: process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-02-core-desktop_PLAN_07-07-26.md
---

# Phase 02 — Core Desktop — Execution Report

## What Was Done

Flagship phase: the 20-column daily-order MATRIX replaces the Order Pad, reusing the UNCHANGED
`saveOrderSheet` payload. All core desktop surfaces reskinned to pguard.

- **E1 payload unit (TDD RED→GREEN):** extracted pure `src/lib/order-payload.ts`
  `buildOrderPayload(cells, notes)` — emits `cell:{shopId}:{variantId}` = trimmed qty ONLY when
  `Number.isInteger(qty) && qty>0`, `note:{shopId}` = RAW text when `text.trim()!==""`. Unit test
  `src/lib/__tests__/order-payload.test.ts` (6 tests) asserts it against the 13/3/69 fixture
  (51 cells, grand total 446) + gating edge cases. Confirmed RED (missing helper) then GREEN.
- **order-matrix.tsx (CREATE):** flat `cells`/`notes` state; byte-identical hidden inputs via
  `buildOrderPayload`; grid `40px 172px repeat(20,45px) 168px`; data-driven 3-tier header (tier-1
  สินค้า/เครื่องปรุง bands, tier-2 grouped by productId, tier-3 packSize/labelVariant sublabels);
  body numeric inputs (mono/tabular, filled bg `#E9F6F0` gated on hlFilled, focus inset 2px
  brand-int); totals row via `computeColumnTotals`/`computeGrandTotal` (REUSED totals.ts); 4-cell
  KPI strip (weight/peep manual UI-only, ร้านที่สั่ง + รวมจำนวน live); toolbar (search / รีเซ็ตตามใบงาน
  / ล้างทั้งหมด). Test hooks: `grand-total`, `total-{printOrder}`, `cell-{roster}-{printOrder}`.
  Save + lastEdit + print links portaled into `#topbar-actions`, associated back to the form via
  `form="order-sheet-form"`.
- **[id]/page.tsx (MODIFY):** OrderGrid→OrderMatrix; `columns` query gained
  `productId`/`productName`/`packSize`/`labelVariant` (additive `include`); null/`active:false`
  shop rows render as blank gaps; print/save relocated to the topbar slot.
- **Sibling reskins:** login split-hero (selectors + generic error preserved, `login/actions.ts`
  untouched, dev-only autofill); orders list + new-sheet-form (name=date/location + เปิดใบออเดอร์
  kept); shops (name/needsConfirmation/บันทึก kept); products (data-driven tier-2 rename);
  admin/users (2 role chips, no self-suspend, จัดการผู้ใช้ heading kept); settings (NEW
  establishment + display panels + `src/lib/app-settings.ts` + `settings/actions.ts` on
  `prisma.appSetting`; `/settings/db` + its actions + tests untouched); print-controls (ui/Button,
  window.print() kept).
- **Deletions:** the 4 Order-Pad files (order-grid/shop-rail/shop-order-card/summary-bar) removed
  together after grep confirmed no external importers.
- **e2e rewrite:** `e2e/orders.spec.ts` now drives the matrix via `cell-{roster}-{print}` testids.

## What Was Skipped or Deferred

- **Live `placeName` reflection in topbar / sidebar / print header** (plan decision 2): the
  AppSetting persistence works and is proven by the settings panel, but wiring the saved
  `placeName` live into the topbar/sidebar and (especially) the print header was deferred — the
  print header is an IMMUTABLE file (`sheet-header.tsx`, HARD STOP), so reflecting there is out of
  scope for this phase. Within-blast-radius deviation (see below).
- **Persisted `hlFilled` → matrix default:** the matrix has its own local highlight toggle
  (default on); wiring the saved `hlFilled` value as the server-provided default was deferred with
  the same rationale (avoid extra server plumbing this phase). Non-gated, cosmetic.
- **weight/peep persistence:** transient UI-only by design (decision 6); backlog note already
  registered at `process/features/pguard-redesign/backlog/weight-peep-persistence_NOTE_07-07-26.md`.

## Test Gate Outcomes

| Gate | Command | Result | Key evidence |
|---|---|---|---|
| Payload unit (Fully-Automated, RED-first) | `pnpm test order-payload` | PASS | 6/6; buildPayload vs fixture sums to 446 |
| Full unit suite | `pnpm test` | PASS | 75/75 (incl order-payload, totals, order-save, settings-secret-hygiene) |
| Lint | `pnpm lint` | PASS | exit 0, 0 problems |
| Compile / all routes | `pnpm build` | PASS | 20 routes incl new `/settings`; TS OK |
| **Scope-fence (Fully-Automated)** | `git diff --exit-code --stat -- <9 immutable>` | **PASS** | **exit 0 — ZERO diff on all 9 immutable files** |
| e2e D1 — matrix 446 round-trip (Hybrid) | `playwright test e2e/orders.spec.ts` | PASS | grand-total 446 live + after reload; total-4=137, total-8=82, total-2=99 |
| e2e D2 — snapshot preserved (Hybrid) | same | PASS | shopNameAtEntry carried forward through rename+resave |
| e2e auth regression (Hybrid) | `playwright test e2e/auth.spec.ts` | PASS | 4/4 SEC-enum + role-gate + login-session |
| e2e settings regression (Hybrid) | `playwright test e2e/settings.spec.ts` | PASS | 3/3 /settings/db route protection |
| e2e print regression (Hybrid+Probe) | `playwright test e2e/print.spec.ts` | PASS | 7/7 G1–G8: 24 cols / 29 rows / grand 446 / snapshot / A4-landscape PDF |
| Print byte-faithful (Agent-Probe) | scope-fence on renderers + print.spec | PASS | renderers zero-diff AND print DOM assertions green |
| Per-screen pguard render (Agent-Probe) | build renders all routes; e2e drives matrix | PASS (judgment) | login served new split-hero markup; matrix shows 446 in e2e; all routes compile |

No Known-Gap strategy used for any developed behavior. The high-risk save-payload behavior is
proven by DoD#2-payload (unit) + DoD#2-e2e-D1 (hybrid).

## Plan Deviations

1. **Payload helper location** — placed at `src/lib/order-payload.ts` + test at
   `src/lib/__tests__/order-payload.test.ts` (per the EXECUTE handoff instruction), rather than the
   validate-contract's illustrative `src/app/(main)/orders/__tests__/order-payload.test.ts`. Both
   satisfy the `src/**/*.test.ts` requirement; the helper is a pure lib util so `src/lib` is the
   natural home. Within-blast-radius.
2. **Save button portal association** — the save button is portaled into `#topbar-actions` (outside
   the `<form>` DOM subtree), so it is linked back via the HTML `form="order-sheet-form"` attribute.
   Discovered during e2e (a portaled submit button does not submit its React-parent form by DOM
   ancestry). `TopbarActions` uses `useSyncExternalStore` (hydration-safe, same pattern as
   theme-toggle) so the portal reliably attaches on every navigation. Within-blast-radius.
3. **Deferred live `placeName`/`hlFilled` reflection** — see "What Was Skipped or Deferred". Chosen
   to avoid touching the IMMUTABLE print header (`sheet-header.tsx`) and to keep the phase scoped;
   persistence itself is complete. Within-blast-radius (no immutable file touched, no gate rests on
   it). Continued under /goal per deviation policy.

No HARD-STOP-class deviations. saveOrderSheet payload / schema / 446 fixture / print sheet all
untouched (scope-fence proves it).

## Test Infra Gaps Found

- **Order e2e is first-run-clean, not idempotent.** `createOrderSheet` dedups by date+location, so a
  persisted E2E-D1/E2E-D2 sheet from a prior failed run makes step 1 carry forward a stale snapshot;
  a shop renamed by a failed D2 run also pollutes. Recovered by a one-off cleanup (delete E2E sheets
  + restore shop 26 via `prisma/load-env` + prisma). Recommend a `beforeEach` that clears E2E-located
  sheets and restores slot-26's name so D2 is re-runnable. CONTEXT note for `tests/all-tests.md`.
- Stale `.next/types/*d 2.ts`/`*d 3.ts` duplicate-named files produce spurious `tsc --noEmit`
  duplicate-identifier errors (not from source). Filter tsc to `^(src|e2e)/` or clear `.next`.

## Closeout Packet

- **Selected plan:** `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-02-core-desktop_PLAN_07-07-26.md`
- **Finished:** all checklist items A1–A7, B1–B4, C1; 4 Order-Pad files deleted; e2e rewritten.
- **Verified:** unit 75/75, lint, build, scope-fence ZERO-diff (9 immutable), e2e orders D1(446)+D2,
  auth+settings+print regression 17/17.
- **Still unverified:** per-screen pixel fidelity (agent-probe judgment only); deferred live
  placeName/hlFilled reflection.
- **Cleanup remaining:** none blocking. UPDATE-PROCESS should (a) add the e2e-idempotency infra note
  to `tests/all-tests.md`, (b) note `src/lib/app-settings.ts` + `#topbar-actions` portal pattern in
  `process/context/uxui/all-uxui.md`, (c) commit (execution commit separate from process commits).
- **How to see the matrix:** run the app, log in, go to `/orders`, open/create a sheet (date +
  optional location) → `/orders/{id}`. Enter the 13/3/69 fixture to see the KPI strip + totals row
  with grand total **446** (KPI cell `data-testid="grand-total"`). Print sheet: the two topbar
  print links → `/print/daily/{date}` (byte-unchanged).
- **Single best next state:** `Ready for UPDATE PROCESS archival` after EVL independent re-run.

## Forward Preview

### Test Infra Found
- Order e2e needs a clean-state `beforeEach` (delete E2E-located sheets + restore renamed shops) to
  be idempotent — Phases 03/04 that add e2e should adopt this.
- `prisma/load-env` is the way to run standalone tsx scripts against the sandbox DB.

### Blast Radius Changes
- NEW: `src/lib/order-payload.ts` (pure, imported by the matrix + its unit test; Phase 04 mobile
  should REUSE it for the identical payload).
- NEW: `src/lib/app-settings.ts` (`prisma.appSetting` get/set) + `settings/actions.ts` + `/settings`
  route (establishment/display panels).
- `#topbar-actions` slot is now consumed by the matrix via a `useSyncExternalStore` portal + `form=`
  association — Phases 03/04 filling the slot should follow this pattern.
- DELETED: the 4 Order-Pad files. `order-matrix.tsx` is the desktop order surface.

### Commands to Stay Green
- `pnpm test` · `pnpm lint` · `pnpm build`
- `git diff --exit-code --stat -- <9 immutable files>` (scope fence)
- `pnpm exec playwright test e2e/orders.spec.ts e2e/auth.spec.ts e2e/settings.spec.ts e2e/print.spec.ts`
  (precondition: sandbox `orderstock-sql` up; clean E2E state)

### Dependency Changes
- None. No package added; reused existing stack (react `createPortal`/`useSyncExternalStore`,
  prisma, ui primitives). saveOrderSheet payload contract unchanged.

## EVL HANDOFF SUMMARY

Independent EVL re-verification 07-07-26 (vc-tester, orchestrator-owned confirmation sweep).
Prior execute-agent evidence treated as unconfirmed and re-run from scratch. All EXACT
validate-contract gates re-run (NOT diff-aware).

### Gate table (independent re-run vs claimed)

| Gate | Command | Claimed | Independent | Match |
|---|---|---|---|---|
| Unit suite | `pnpm test` | 75/75 | **75/75** (14 files; order-payload 6, totals, order-save, secret-hygiene) | ✅ |
| Lint | `pnpm lint` | 0 | **0 problems (exit 0)** | ✅ |
| Build | `pnpm build` | 20 routes | **compiled OK, TS OK, 20 routes** | ✅ |
| **Scope fence** | `git diff --exit-code -- <9 immutable>` | ZERO diff | **exit 0 — EMPTY diff on all 9** | ✅ |
| e2e (full) | `pnpm exec playwright test` | orders+auth+print+settings green | **19/19 passed** | ✅ |
| e2e idempotency | orders.spec 2nd run | first-run-clean noted | **re-ran D1+D2 → 3/3 green** (re-runnable) | ✅ |

### Scope-fence result (CRITICAL — key safety property)
`git diff` on the 9 immutable files (actions.ts, order-save.ts, totals.ts, schema.prisma,
sheet-13-03-69.json, get-sheet-for-print.ts, print-table.tsx, sheet-header.tsx, print/layout.tsx)
= **EMPTY (exit 0)**. The 4 Order-Pad files are DELETED; `grep` finds NO importers referencing them.

### Payload-identity verdict: PASS
`order-matrix.tsx` renders hidden inputs EXCLUSIVELY from `payloadEntries = buildOrderPayload(cells, notes)`
(line 192/506-507). `buildOrderPayload` emits `cell:{shopId}:{variantId}` (trimmed, only Number.isInteger&&>0)
+ `note:{shopId}` (RAW, only trim!=""); weight/peep are separate `useState` (line 113-114), NEVER fed to
the payload map. Unit test asserts the exact set against the 446 fixture (51 cells). Byte-identical to the
retired Order Pad — server contract preserved.

### Print verdict: PASS (byte-faithful)
print.spec G1-G8 all green against the live server: 24 physical / 20 semantic cols, 29 rows, 3-tier header,
grand total **446**, snapshot-name render, A4-landscape @page + valid PDF. Renderers (print-table.tsx,
sheet-header.tsx, print/layout.tsx) are zero-diff per the scope fence.

### e2e-idempotency note
Ran the full suite (19/19) then orders.spec again (3/3) — re-runnable on the existing dirty sandbox DB.
The report's "first-run-clean" caveat concerns recovery from a prior *failed* run's pollution, not
flakiness on success; two consecutive green runs confirm no order-dependence. Recommend the documented
`beforeEach` cleanup for Phases 03/04 hardening (non-blocking).

### Deviation audit (3 documented, all within-blast-radius)
1. Payload helper at `src/lib/order-payload.ts` (not `orders/__tests__`) — satisfies `src/**/*.test.ts`; pure lib util. FINE.
2. Save-button portal `form="order-sheet-form"` association (useSyncExternalStore) — PROVEN: e2e D1 saves the matrix + reload persists 446. WORKS.
3. Deferred live placeName/hlFilled topbar reflection — a DEFERRAL (persistence complete, live wiring skipped to avoid touching IMMUTABLE sheet-header.tsx), not a break. No gate rests on it. ACCEPTABLE.

### Verified-status decision: ✅ VERIFIED
Rationale: every validate-contract gate independently green + scope fence EMPTY (the key safety property) +
payload byte-identity confirmed + print byte-faithful + all preserved selectors present + only documented
within-blast-radius residuals (no HARD-STOP deviation, no immutable file touched). Plan status promoted
🧪 TESTING → ✅ VERIFIED. Step 6 ticked.

```yaml
gates_green: [pnpm test (75/75), pnpm lint, pnpm build (20 routes), scope-fence git-diff (exit 0, 9 immutable), e2e playwright (19/19), e2e-idempotency (orders 3/3 2nd run)]
known_gaps: [live placeName/hlFilled topbar+sidebar reflection deferred (persistence complete), weight/peep persistence (backlog note registered)]
follow_up_stubs: [e2e beforeEach clean-state for Phases 03/04, tests/all-tests.md idempotency note, uxui/all-uxui.md app-settings+#topbar-actions portal pattern]
context_partial: []
preliminary_packet_path: process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-02-core-desktop_REPORT_07-07-26.md
closeout_classification: CLEAN
```
