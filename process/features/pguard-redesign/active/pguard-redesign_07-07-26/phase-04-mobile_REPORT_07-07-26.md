---
phase: phase-04-mobile
date: 2026-07-08
status: COMPLETE
feature: pguard-redesign
plan: process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-04-mobile_PLAN_07-07-26.md
---

# Phase 04 — Mobile — EXECUTE Report

TL;DR: All 7 checklist items done. 5 mobile screens (login sheet, shop list, per-shop stepper,
summary, users) + a bottom tab bar shipped as a RESPONSIVE shared-component build (no `(mobile)`
route group). The mobile per-shop stepper writes through the SAME `order-matrix` cells/notes state +
the SAME `<form id="order-sheet-form">` + the SAME `buildOrderPayload` → entering the 13/3/69 fixture
via the mobile steppers and saving reconstructs grand total **446** (proven by the new 390×844
Playwright project). Every gate green; the 10-file immutable set shows ZERO git diff.

## What Was Done

- **A1 — `src/components/bottom-tab-bar.tsx` (NEW):** 3 mobile-only tabs (ร้านค้า `/orders`, สรุปยอด
  `/summary`, ผู้ใช้ `/admin/users` — ADMIN-only, hidden for STAFF via a `role` prop). Active `#15885B`
  via `usePathname`. `data-testid="tab-{orders|summary|users}"` (E1). Tap targets `min-h-12` (48px).
- **A2 — `src/app/(main)/layout.tsx`:** now `async`, reads `auth()` for `role`; sidebar `<Nav/>`
  wrapped `hidden md:block`, `<BottomTabBar role/>` rendered below md; `<main>` gets `pb-16 md:pb-0`
  so the fixed bar never covers content. CSS-breakpoint swap only — NO `(mobile)` route group.
- **B1 — `src/app/(main)/orders/order-matrix.tsx`:** added a breakpoint-gated mobile branch
  (`md:hidden`) over the SAME `cells`/`notes` state; desktop matrix wrapped `hidden md:flex`
  (unchanged, its `cell-`/`total-`/`grand-total` testids intact). New shared helpers `stepCell`
  (±1 clamp) + `setCellDigits` (numeric sanitize) call the existing `setCell`. Added optional
  `dateLabel` prop (BE date for the list header chip).
- **B2 — `order-mobile-list.tsx` + `order-mobile-entry.tsx` (NEW, presentational):** list sub-state
  (green `#0E3B2E` header + BE-date chip + amber progress `orderedCount/namedRows.length` + search +
  shop cards) and a FULL-VIEWPORT fixed `z-50` entry overlay (back / shop name / `ร้านที่ n จาก 29 ·
  รวม x` / clamped ‹ › / สินค้า+เครื่องปรุง stepper sections / note / sticky save). The sticky
  **"บันทึก แล้วไปร้านถัดไป"** is `type="submit" form="order-sheet-form"` (E2) → whole-sheet save +
  advance (last → back to list). `data-testid="mobile-cell-{roster}-{printOrder}"`, `"mobile-save"`,
  `"mobile-entry"`, `"mobile-shop-{roster}"` (E1).
- **C1 — `src/app/(auth)/login/page.tsx`:** responsive — md+ keeps the split-hero; below md a green
  gridded hero + white bottom-sheet (radius 18px) holding the UNCHANGED `LoginForm`
  (`name=username`/`password` preserved).
- **C2 — `src/app/(main)/summary/page.tsx`:** `grid-cols-[2fr_1fr]` → `grid-cols-1
  md:grid-cols-[2fr_1fr]` (single column below md). One-line change; bars/testids unchanged.
- **C3 — `src/app/(main)/admin/users/*`:** desktop table wrapped `hidden md:block`; NEW
  `users-mobile.tsx` (`md:hidden`) — green header + `+ เพิ่ม` opening `CreateUserForm` in the shared
  `Modal`, card list reusing the SAME server actions (editRole / resetPassword / de-/activate), plus
  a mobile logout (the sidebar logout is hidden below md). ADMIN-only (page `requireAuth("ADMIN")`).
- **Test infra:** hoisted `cleanState()` from `summary-history.spec.ts` to `e2e/util/clean-state.ts`
  (Phase-03 EVL residual); added a 390×844 `mobile` Playwright project (reuses `e2e/.auth/staff.json`
  + `admin.json`); NEW `e2e/mobile.spec.ts`.

## What Was Skipped or Deferred

- None. All checklist items completed.

## Test Gate Outcomes

| Gate | Strategy | Command | Result |
|---|---|---|---|
| Payload parity (structural) | Fully-Automated | `pnpm test` | PASS — 82/82 (incl `order-payload.test.ts` 6, `totals` 6, `summary` 7) |
| Scope-fence (10 immutable) | Fully-Automated | `git diff --exit-code -- <10 files>` | PASS — EMPTY (exit 0) |
| Lint | Fully-Automated | `pnpm lint` | PASS — 0 errors, 0 warnings |
| Build | Fully-Automated | `pnpm run build` | PASS — all 20 routes compiled |
| Mobile e2e 446 + tabs + overlay | Hybrid | `pnpm exec playwright test` | PASS — **25/25** (21 desktop chromium + 4 mobile) |
| 5 screens @390×844, ≥44px | Agent-Probe | 390×844 screenshots | PASS — 5 screens render (harness/phase-04/*.png) |

Key lines:
- `enter 13/3/69 via mobile steppers → save → reload reconstructs grand total 446` — PASS (12.7s);
  asserts `grand-total`=446, `total-4`=137, `total-8`=82.
- `per-shop entry overlay is full-viewport (covers the bottom tab bar)` — PASS (overlay boundingBox
  y≤1, height≥800 at 844 viewport).
- `STAFF never sees the ADMIN-only ผู้ใช้ tab` — PASS (`tab-users` count 0).
- `3 bottom tabs navigate ร้านค้า / สรุปยอด / ผู้ใช้` (admin) — PASS.
- Scope-fence: `SCOPE-FENCE: EMPTY (PASS)` on actions.ts / order-save.ts / totals.ts / order-payload.ts
  / schema.prisma / sheet-13-03-69.json / get-sheet-for-print.ts / print-table.tsx / sheet-header.tsx
  / print/layout.tsx.

## Plan Deviations (all within blast radius)

1. **`dateLabel` prop added to `OrderMatrix` + passed from `orders/[id]/page.tsx`.** Reason: the mobile
   list header BE-date chip needs the sheet date, which the matrix did not previously receive. `[id]/
   page.tsx` already computed `ceToBeDisplay(...)`; passed it through. Within-blast-radius (orders/).
2. **`users-mobile.tsx` created under `admin/users/`.** The plan's C3 says "responsive card list
   (reuse the active toggle + CreateUserForm as a mobile modal)"; a client card component was the
   clean way to reuse the same server actions. Within the `admin/users/*` blast radius.
3. **Touch targets bumped to 44px.** The design handoff used 40px steppers/prev-next; the plan requires
   ≥44px, so the stepper ±, prev/next, and back buttons were set to `h-11`/`w-11` (44px) to satisfy the
   gate. Cosmetic, honors the plan over the prototype.
4. **Cosmetic (not a code deviation):** on the mobile `/orders/[id]` list screen the Phase-01 topbar +
   the existing page `<h1>` remain visible above the green mobile header (the topbar is the immutable
   Phase-01 shell — out of scope to remove). Functionally correct; a pure-prototype match would need a
   later shell decision. Noted, non-blocking.

No hard-stop-class deviations. Payload shape, schema, 446 fixture, and print chain untouched
(scope-fence EMPTY).

## Test Infra Gaps Found

- None blocking. The `cleanState()` hoist to `e2e/util/clean-state.ts` (Phase-03 EVL residual) is now
  resolved and shared by `summary-history.spec.ts` + `mobile.spec.ts`. `E2E_LOCATIONS` gained
  `E2E-MOBILE`.

## Closeout Packet

- Selected plan: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-04-mobile_PLAN_07-07-26.md`
- Finished: A1/A2/B1/B2/C1/C2/C3 + test infra; Phase Loop step 5 (EXECUTE) ticked.
- Verified: unit 82, lint, build, e2e 25/25 (incl mobile 446 reconstruction), scope-fence EMPTY,
  agent-probe 5 screens. Still unverified: independent EVL re-run (orchestrator-owned, step 6).
- Cleanup remaining: EVL (step 6) then UPDATE-PROCESS (step 7 — context capture in `uxui/all-uxui.md`
  for the mobile branch + bottom tab bar, umbrella state rewrite, commit).
- Best next state: **Keep in active/testing** — code complete, awaiting EVL confirmation.

## Forward Preview

**Test Infra Found:** 390×844 `mobile` Playwright project (reuses staff/admin storage state); shared
`e2e/util/clean-state.ts`; new stable mobile testids (`mobile-cell-{r}-{po}`, `mobile-save`,
`mobile-entry`, `mobile-shop-{r}`, `tab-{name}`).

**Blast Radius Changes:** Phase 05 (data align) touches `product-order.ts` + `seed.ts` + role labels —
disjoint from the mobile files here. The mobile list/entry read product names live from the `columns`
query, so the ตีลานนิ่ม/ตีลาน renames will flow through automatically.

**Commands to Stay Green:** `pnpm test` · `pnpm lint` · `pnpm run build` · `pnpm exec playwright test`
(needs sandbox DB up + seeded admin/staff). Scope-fence: `git diff --exit-code -- <10 immutable>`.

**Dependency Changes:** none (no new packages). Layout is now an `async` server component reading
`auth()`.

## EVL HANDOFF SUMMARY

EVL Step 3 — vc-tester independent unconditional re-run (2026-07-08). All validate-contract gates
re-run from scratch (prior EXECUTE evidence treated as unconfirmed hypothesis). Every gate green;
scope-fence EMPTY on the 10 immutable files; payload byte-identity confirmed STRUCTURAL (one builder,
one form, one save path). `harness/phase-04/verification.json` written.

| Gate | Command | Independent result | Claimed |
|---|---|---|---|
| Unit suite | `pnpm test` | PASS — 82/82 (15 files) | 82/82 ✓ |
| Scope-fence (10 immutable) | `git diff --exit-code -- <10>` | PASS — EMPTY (exit 0) | EMPTY ✓ |
| Lint | `pnpm lint` | PASS — 0/0 | 0/0 ✓ |
| Build | `pnpm run build` | PASS — 20 routes | 20 routes ✓ |
| E2E (mobile drives mobile) | `pnpm exec playwright test` | PASS — 25/25 (21 desktop + 4 mobile) | 25/25 ✓ |
| 5-screen agent-probe @390×844 | screenshots | PASS — 5 pngs | 5 ✓ |

- **Payload identity:** ONE `buildOrderPayload` (order-payload.ts) · ONE call (order-matrix.tsx:214) ·
  ONE `<form id="order-sheet-form">` (order-matrix.tsx:298) · mobile save `type=submit form=FORM_ID`
  routing to the SAME `setCell`/`setNote`. `order-payload.ts` CONSUMED, not edited.
- **Mobile e2e drives mobile view:** test 22 enters 13/3/69 via `mobile-cell-{r}-{po}` steppers →
  `mobile-save` → reload → `grand-total`=446, `total-4`=137, `total-8`=82. Confirmed mobile project.
- **Tab-bar ADMIN gate:** STAFF sees `tab-users` count 0 (test 24); ADMIN sees all 3 (test 25).
- **Deviation audit (4):** all benign — dateLabel (additive), users-mobile.tsx (reuses server
  actions, no new write path), 44px targets (plan compliance), topbar cosmetic (Phase-01 shell).

```yaml
gates_green: [unit-82, scope-fence-empty, lint, build-20-routes, e2e-25, agent-probe-5-screens]
known_gaps: none
follow_up_stubs: none
context_partial: []
preliminary_packet_path: process/features/pguard-redesign/active/pguard-redesign_07-07-26/harness/phase-04/verification.json
closeout_classification: CLEAN
```
