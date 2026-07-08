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
**Umbrella plan:** process/features/pguard-redesign/completed/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ✅ VERIFIED (EVL independent re-run 07-07-26: all gates green + scope fence empty; only documented within-blast-radius residuals)
**Report destination:** process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-02-core-desktop_REPORT_07-07-26.md (flat in the program task folder)

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
- REUSE the Phase-01 pguard primitives (`src/components/ui/*`), semantic tokens, and shell `#topbar-actions` slot. Token/primitive contract: `process/context/uxui/all-uxui.md`.

---

## Dependencies

- Phase 01 (shell + primitives + tokens). Downstream: Phase 03 (/summary, /history) and Phase 04 (mobile) both build on the matrix + primitives.

---

## Blast Radius (exact file touch list)

**CREATE:** `src/app/(main)/orders/order-matrix.tsx`, `src/lib/app-settings.ts`, settings panel components (establishment/display).
**MODIFY:** `login/page.tsx`+`login-form.tsx`, `orders/[id]/page.tsx` (OrderGrid→OrderMatrix, +productId/productName columns, blank active:false shops, save/print→#topbar-actions), `orders/page.tsx`+`new-sheet-form.tsx` (reskin, keep name=date/location + "เปิดใบออเดอร์"), `shops/**`, `products/**`, `admin/users/**`, `settings/**` (ADD establishment+display alongside EXISTING settings/db — do NOT disturb settings/db), `print/print-controls.tsx` (reskin to ui/button, keep window.print()).
**DELETE:** `orders/{order-grid,shop-rail,shop-order-card,summary-bar}.tsx` (4 files).
**REWRITE:** `e2e/orders.spec.ts` (drive matrix cells via testids).
**IMMUTABLE (git-diff ZERO change):** `orders/actions.ts`, `order-save.ts`, `totals.ts`, `schema.prisma`, `test-fixtures/sheet-13-03-69.json`, `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`.

---

## Decisions (from INNOVATE — resolved)

| # | Decision | Chosen |
|---|---|---|
| 1 | Shop "delete" | Soft-delete (`active:false`, `rosterOrder` preserved). The entry matrix renders `active:false` slots as BLANK GAPS (name cleared, slot kept) — adjust the matrix row build in `orders/[id]/page.tsx` (mutable). Print uses snapshot names → unaffected. |
| 2 | Establishment settings | PERSIST via `AppSetting` (model exists, zero current usage) — additive read helper + write server-action, NO schema change. Keys: `placeName` / `recorderName` / `recorderRole` / `hlFilled`. `placeName` reflects in topbar + print header + sidebar. **PVL:** do NOT change the `/settings/db` route or its heading "ตั้งค่าการเชื่อมต่อฐานข้อมูล" (settings.spec + settings-secret-hygiene.test.ts must stay green); new establishment/display panels are SIBLING components/routes only. Add `src/lib/app-settings.ts` (get/set via `prisma.appSetting`) + a settings server-action. |
| 3 | Users | 2 real roles only → 2 role chips (ADMIN="ผู้ดูแลระบบ", STAFF="พนักงาน"); no cosmetic 3rd role; no self-suspend (disable the toggle on own row). |
| 4 | Login | KEEP `name="username"` + `name="password"` (real NextAuth via existing `login/actions.ts` — DO NOT rename to email); Thai labels; split-hero reskin; OMIT the demo-password box in prod (optional dev-only autofill gated `NODE_ENV!=="production"`). **PVL:** keep `button[type="submit"]` + render the generic error "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" as visible text; `login/actions.ts` stays UNCHANGED (auth.spec SEC-enum + login-issues-session). |
| 5 | Tier-2 header data-driven | Extend the `columns` query in `orders/[id]/page.tsx` to add `productId` + `productName` (ADDITIVE) so the 3-tier header groups by `productId` (colspan = variant count) and reflects `Product.name` renames automatically. |
| 6 | weight/peep | UI-only transient inputs — NOT persisted, NOT emitted in the save payload. Backlog note registered: `process/features/pguard-redesign/backlog/weight-peep-persistence_NOTE_07-07-26.md` (future `OrderSheet.totalWeightKg`/`pip` columns or `computeTotalWeight` wiring — needs schema migration, outside this program's HARD STOP). |

**IMMUTABLE (git-diff must show ZERO change):** `orders/actions.ts`, `order-save.ts`, `totals.ts`, `schema.prisma`, `test-fixtures/sheet-13-03-69.json`, `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`.

---

## order-matrix.tsx — Component Spec (encode)

- **Props** = OrderGrid's props + `columns` gains `productId`/`productName`. **State** = SAME flat shape: `cells: Record<"${shopId}:${variantId}",string>`, `notes: Record<number,string>` + transient `weight`/`peep`/`query`/`hlFilled`.
- **Hidden-input payload BYTE-IDENTICAL:** `cell:{shopId}:{variantId}` + `note:{shopId}` (weight/peep NOT emitted). Save via `useActionState(saveOrderSheet.bind(null, sheetId))` — unchanged.
- Grid `grid-template-columns: 40px 172px repeat(20,45px) 168px`; header rows 26/30/22px.
- **Tier-1 band:** "สินค้า" grid-column 3/19 green-800/green-50; "เครื่องปรุง" 19/23 amber-800/amber-50; cols 1,2,23 span rows 1/4.
- **Tier-2:** group consecutive columns by `productId`, colspan=count, label=`productName`.
- **Tier-3:** unit sublabel per column (packSize 1กก./½กก., หมู/ไก่ for เลอรส) — derive from packSize or a `COL_SUB` static array.
- **Body:** 20 numeric inputs/row (mono, tabular, center, border:none), filled bg `#E9F6F0` (gated on `hlFilled`), focus = inset 2px `var(--brand-int)` + white bg; note text input; blank-gap rows have no shopId (disabled/empty).
- **Totals row:** green-50 bg, "รวมทั้งหมด" green-900 bold, 20 per-column totals mono bold (zero faint `#94A29D`), grand total. Live via `computeColumnTotals`/`computeGrandTotal` (map variantId→printOrder from columns) — REUSE `totals.ts`.
- **KPI strip** (4 cells, repeat(4,1fr), border-left dividers, mono 27px): (1) รวมน้ำหนัก = weight manual, (2) รวมปี๊บ = peep manual, (3) ร้านที่สั่ง = live count of slots with ≥1 cell-or-note / named-shop-count, (4) รวมจำนวน(หน่วย) = grandTotal live.
- **Toolbar:** search (filter rows by shop name), "รีเซ็ตตามใบงาน" (reset cells→initialCells) secondary, "ล้างทั้งหมด" danger-ghost. Save button + lastEdit → `#topbar-actions`.
- **TEST HOOKS (add):** `data-testid="grand-total"`; `data-testid={"total-"+printOrder}` on totals cells (always visible); `data-testid={"cell-"+rosterOrder+"-"+printOrder}` on each numeric input.

---

## Inner Loop Refresh Note

- **Date:** 07-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after outer RESEARCH + INNOVATE (decisions resolved).
- **Sections changed:** Entry Gate (reuse Phase-01 primitives/tokens/#topbar-actions; uxui contract), NEW Decisions section (soft-delete blank-gap, AppSetting establishment persistence, 2 role chips/no-self-suspend, login keeps username/password + dev-only demo, data-driven tier-2 header via additive columns query, weight/peep transient + backlog note), NEW order-matrix.tsx component spec (grid, 3-tier header, body, totals, KPI, toolbar, test hooks, byte-identical payload), Implementation Checklist rewritten to concrete CREATE/MODIFY/DELETE/REWRITE build, IMMUTABLE zero-diff set, Test Plan (buildPayload unit + scope-fence git-diff + rewritten e2e drive), Blockers, Phase Loop 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key facts folded in:** full order-matrix.tsx spec (byte-identical cell:/note: payload, useActionState(saveOrderSheet.bind), grid template, 3-tier data-driven header, totals via computeColumnTotals/computeGrandTotal, KPI, test hooks); file touch list CREATE/MODIFY/DELETE/REWRITE; IMMUTABLE zero-diff set (9 files); e2e/orders.spec.ts matrix-driven rewrite (enterCell via cell-testids, D1 446 + spot totals 137/82/99, D2 shopNameAtEntry unchanged); AppSetting establishment persistence (additive, no schema change); soft-delete blank-gap matrix rows; 2 role chips + no self-suspend; login username/password kept + prod demo-box omitted; weight/peep backlog note registered.
- **Validate-contract left untouched** (placeholder) — PVL writes it next.
- **Backlog artifact created:** `process/features/pguard-redesign/backlog/weight-peep-persistence_NOTE_07-07-26.md`.

---

## Implementation Checklist

### Step A — Login + matrix (highest risk)

- [x] A1. `login/page.tsx` + `login-form.tsx`: split-hero pguard reskin; KEPT `name="username"` + `name="password"` + `button[type=submit]` + generic error; dev-only autofill gated `NODE_ENV!=="production"`; `login/actions.ts` untouched. (auth.spec green)
- [x] A2. CREATED `src/app/(main)/orders/order-matrix.tsx` per the Component Spec (grid `40px 172px repeat(20,45px) 168px`, 3-tier data-driven header, body inputs w/ filled-bg + focus, totals row, KPI strip, toolbar, test hooks `grand-total`/`total-{p}`/`cell-{roster}-{p}`). REUSES `src/components/ui/*` + tokens.
- [x] A3. Extracted PURE `src/lib/order-payload.ts` `buildOrderPayload(cells,notes)` (RED→GREEN unit `src/lib/__tests__/order-payload.test.ts` vs 446 fixture); matrix emits byte-identical hidden inputs via it; save = `useActionState(saveOrderSheet.bind(null,sheetId))`. Save button portaled to `#topbar-actions`, associated back by `form=` id.
- [x] A4. `orders/[id]/page.tsx`: swapped `OrderGrid`→`OrderMatrix`; `columns` query extended with `productId`/`productName`/`packSize`/`labelVariant` (additive); `active:false`/null rows render as blank gaps; print links + save moved into `#topbar-actions`.
- [x] A5. `orders/page.tsx` + `new-sheet-form.tsx`: reskinned to pguard, KEPT `name="date"`/`name="location"` + "เปิดใบออเดอร์".
- [x] A6. DELETED `orders/{order-grid,shop-rail,shop-order-card,summary-bar}.tsx` (grepped: no external refs); clean build confirms no dangling imports.
- [x] A7. REWROTE `e2e/orders.spec.ts` matrix-driven (`enterCell` via `cell-{roster}-{print}`); D1 446+reload+totals 137/82/99, D2 `cell-26-1` + snapshot preserved. Both green.

### Step B — Master data + admin + settings

- [x] B1. `shops/page.tsx` + `shop-form.tsx` reskinned; PRESERVED `input[name="name"]`, `input[name="needsConfirmation"]`, save "บันทึก" (D2 green); soft-delete rows render as blank gaps in the matrix.
- [x] B2. `products/page.tsx` reskinned; tier-2 header is data-driven off the additive `productName` query (inline rename via existing edit form reflects live).
- [x] B3. `admin/users/page.tsx` + `user-row.tsx`: 2 role chips (ADMIN/STAFF via ROLE_LABELS ผู้ดูแลระบบ/พนักงาน); no self-suspend (own-row ระงับ disabled via `isSelf`); heading "จัดการผู้ใช้" kept (auth.spec green).
- [x] B4. CREATED `src/lib/app-settings.ts` (get/set via `prisma.appSetting`, keys placeName/recorderName/recorderRole/hlFilled) + `settings/actions.ts` + `settings/page.tsx` + `settings-panels.tsx` (establishment + display panels, ADMIN-gated). `/settings/db` + its actions + tests UNTOUCHED (settings.spec + secret-hygiene green). NOTE: live placeName reflection in topbar/sidebar/print DEFERRED — see Deviations.

### Step C — Print toolbar

- [x] C1. `print/print-controls.tsx` reskinned to `ui/Button`, `window.print()` kept. Print sheet renderers zero-diff (scope-fence) + print.spec G1–G8 green (byte-faithful, 446).

---

### e2e/orders.spec.ts REWRITE (encode)

- Replace the Order-Pad combobox `enterCell` with matrix: `enterCell(rosterOrder,printOrder,qty) = page.getByTestId("cell-"+rosterOrder+"-"+printOrder).fill(String(qty))`. `openSheet` unchanged (date/location/เปิดใบออเดอร์).
- **D1:** enter the 13/3/69 fixture → `grand-total` 446 → save (button บันทึก in topbar) → "บันทึกล่าสุด" visible → reload → 446 persists → spot-check `total-4`=137, `total-8`=82, `total-2`=99.
- **D2:** same as now but the initial cell via the new `enterCell` + `cell-26-1`; server assertions on `shopNameAtEntry` unchanged.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: order matrix ↔ saveOrderSheet (high-risk: data write path)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | `buildPayload` from matrix state == 446 fixture `cell:`/`note:` shape | Vitest on the matrix payload builder vs `sheet-13-03-69.json` | payload byte-identical | live save |
| Fully-automated | Scope-fence: IMMUTABLE set has ZERO git diff | `git diff --exit-code -- orders/actions.ts order-save.ts totals.ts schema.prisma test-fixtures/sheet-13-03-69.json get-sheet-for-print.ts print-table.tsx sheet-header.tsx print/layout.tsx` | no forbidden-file change | UI |
| Fully-automated | 446 fixture totals unchanged | `pnpm test` (existing totals suite) | no totals regression | UI |
| Hybrid | Enter 13/3/69 via matrix cells → grand-total 446 → save → reload → 446 persists (totals 137/82/99) | rewritten `e2e/orders.spec.ts` D1 on sandbox | end-to-end matrix save via unchanged action | print |
| Hybrid | D2 shopNameAtEntry server assertions unchanged | rewritten `e2e/orders.spec.ts` D2 | snapshot behavior intact | UI |
| Agent-probe | Print sheet byte-unchanged after toolbar reskin | diff print render pre/post | print faithfulness | — |
| Agent-probe | Each core screen renders in pguard; 13/3/69 matrix shows 446 | visual review of login/orders/shops/products/users/settings + matrix grand-total | re-skin fidelity | pixel-exact |

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
- The `columns` query cannot expose productId/productName without touching an immutable file → it is in `[id]/page.tsx` (mutable); if a truly immutable file blocks it, STOP and surface.
- Any non-zero git diff on the IMMUTABLE set → revert that touch (HARD STOP boundary).
- Phase 01 exit gate not met → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE (outer research) — matrix↔data mapping, columns-query extensibility, AppSetting-unused, immutable-set inventory confirmed (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — Decisions resolved (soft-delete blank-gap, AppSetting establishment persistence, 2 role chips/no self-suspend, login username/password kept, data-driven tier-2 header, weight/peep transient+backlog)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated with the full matrix build + e2e rewrite + immutable set; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: full V1-V7 DONE 07-07-26; validate-contract written (Net Gate CONDITIONAL — 6 concerns folded into checklist as execute-instructions; program charter pre-authorizes CONDITIONAL→proceed)
- [x] 5. EXECUTE — 07-07-26: all checklist items A1–C1 done; gates green (pnpm test 75/75 incl order-payload+446; lint clean; build all routes; scope-fence ZERO diff on 9 immutable files; e2e orders D1 446 + D2 + auth/settings/print regression 17/17). One within-blast-radius deviation (deferred live placeName reflection). Report written.
- [x] 6. EVL — 07-07-26: INDEPENDENT re-run all gates green (unit 75/75, lint 0, build 20 routes, scope-fence exit 0 ZERO-diff on 9 immutable files, e2e 19/19 incl orders D1 446+D2, run TWICE re-runnable); payload-identity + selector-preservation + print byte-faithful confirmed; EVL HANDOFF SUMMARY written to report
- [x] 7. UPDATE PROCESS — archived; context updated; committed

**Validate-contract required before execute.**

---

## Touchpoints

- CREATE `order-matrix.tsx`, `src/lib/app-settings.ts`, settings panels; MODIFY login/orders/shops/products/users/settings + `print-controls.tsx`; DELETE 4 Order-Pad files; REWRITE `e2e/orders.spec.ts`; IMMUTABLE zero-diff set (9 files)

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
| IMMUTABLE set has ZERO git diff | Fully-Automated | Program invariant (payload/schema/print/totals untouched) — proven by: scope-fence git-diff gate |
| Print sheet byte-unchanged | Agent-Probe | Program invariant (print faithful) — proven by: render-diff agent-probe |

---

## Test Infra Improvement Notes

- Capture a golden pre-reskin print-sheet render so Phase 02 (and later phases) can diff byte-for-byte. Record its path in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-02-core-desktop_PLAN_07-07-26.md`
- Last completed step: 3. PLAN-SUPPLEMENT (full matrix build + e2e rewrite + immutable set folded in)
- Validate-contract status: pending — NEXT STEP is PVL (spawn vc-validate-agent). Do NOT execute yet.
- Next step: Spawn vc-validate-agent for PVL (Step 4). Flagship phase — the IMMUTABLE 9-file set (payload/schema/print/totals/fixture) must show ZERO git diff; matrix is a UI-only replacement.

---

## Plan Metadata

**Date**: 07-07-26
**Complexity**: COMPLEX (one phase of the pguard-redesign program)
**Status**: ✅ VERIFIED (EVL 07-07-26)

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

Status: CONDITIONAL
Date: 07-07-26
date: 2026-07-07
generated-by: inner-pvl: phase-02

Parallel strategy: parallel-subagents (executed inline — single fire-and-forget validate agent with all blast-radius evidence pre-loaded)
Rationale: 5/7 signals (S2 auth+data-write surface, S4 phase-program, S6 high-risk data-write/auth/public-contract, S7 15+ files, breadth of 7 route sections). Read-only VALIDATE fan-out over ONE finished plan needs no cross-agent talk -> parallel-subagents fit; synthesized inline for token efficiency.

### Net Gate Derivation

| Layer 1 dimension | Status |
|---|---|
| Infra fit | PASS |
| Test coverage | CONCERN |
| Breaking changes | CONCERN |
| Security surface | PASS |

| Layer 2 section | Status |
|---|---|
| A — Login + matrix (payload) | CONCERN |
| A — e2e rewrite (orders.spec) | PASS (buildable) |
| B — Master data + admin + settings | CONCERN |
| C — Print toolbar reskin | PASS |

Totals: 0 FAILs / 4 CONCERNs / 4 PASSes -> **Net Gate: CONDITIONAL** (0 FAILs; concerns folded into checklist as execute-instructions; no developed behavior rests on Known-Gap alone). Program charter (umbrella Autonomous Execution Rules) pre-authorizes CONDITIONAL -> proceed autonomously.

### Test gates (C3 5-column table)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| DoD#2-payload | matrix `buildOrderPayload` emits byte-identical `cell:{shopId}:{variantId}`/`note:{shopId}` set vs the 446 fixture | Fully-Automated | `pnpm test` — new `src/app/(main)/orders/__tests__/order-payload.test.ts` asserts buildPayload(fixture cells+notes) == exact FormData key/value set (qty int>0 -> cell trimmed; note trim!="" -> raw) | B (added by A2/A3) |
| INV-scope-fence | the 9 IMMUTABLE files show ZERO git diff | Fully-Automated | `git diff --exit-code --stat -- "src/app/(main)/orders/actions.ts" "src/lib/order-save.ts" "src/lib/totals.ts" "prisma/schema.prisma" "test-fixtures/sheet-13-03-69.json" "src/lib/get-sheet-for-print.ts" "src/app/print/print-table.tsx" "src/components/sheet-header.tsx" "src/app/print/layout.tsx"` exits 0 | A (verified clean now) |
| INV-totals | 446 fixture totals engine unchanged | Fully-Automated | `pnpm test` (covers `src/lib/__tests__/totals.test.ts` + `order-save.test.ts`) | A |
| INV-secret | settings/db secret hygiene intact | Fully-Automated | `pnpm test` (covers `settings-secret-hygiene.test.ts` + `secret-leak.test.ts`) | A |
| DoD#2-e2e-D1 | enter 13/3/69 via matrix cells -> grand-total 446 -> save -> reload -> 446 (spot totals 137/82/99) | Hybrid | `pnpm build && pnpm exec playwright test e2e/orders.spec.ts` (precondition: sandbox SQL Server up + `pnpm tsx prisma/seed.ts`; webServer=`pnpm start`) | B (rewritten by A7) |
| REG-D2 | rename confirmed shop -> re-save -> `shopNameAtEntry` snapshot preserved (initial cell via `cell-26-1`) | Hybrid | same playwright run, D2 | B (rewritten by A7) |
| REG-auth | login/role-gate/redirect/enum unchanged after login+admin reskin | Hybrid | `pnpm exec playwright test e2e/auth.spec.ts` (unchanged spec, must stay green) | A |
| REG-settings | /settings/db route + heading + role-gate intact | Hybrid | `pnpm exec playwright test e2e/settings.spec.ts` (unchanged spec) | A |
| INV-print | print sheet DOM (G1-G8) byte-faithful after toolbar reskin | Hybrid + Agent-Probe | `pnpm exec playwright test e2e/print.spec.ts` (unchanged) + visual render diff of `/print/daily` pre/post | A |
| PROBE-screens | login/orders/shops/products/users/settings render in pguard; matrix shows 446 | Agent-Probe | visual review of each core screen + matrix grand-total cell | D (record judgment) |

gap-resolution legend: A proven now · B added by this plan's checklist · C deferred to named phase · D backlog/named-residual.

C-4 reconciliation: strategy column carries only Fully-Automated / Hybrid / Agent-Probe. No Known-Gap strategy used — the high-risk save-payload behavior is proven by DoD#2-payload (unit) + DoD#2-e2e-D1 (hybrid), never a gap.

Legacy line form:
- order matrix <-> saveOrderSheet payload: Fully-automated: `pnpm test` (order-payload unit) + Hybrid: `pnpm exec playwright test e2e/orders.spec.ts` D1/D2
- scope fence (9 immutable files): Fully-automated: `git diff --exit-code --stat -- <9 full paths above>` exits 0
- totals/secret regression: Fully-automated: `pnpm test`
- login/settings/print regression: Hybrid: `pnpm exec playwright test e2e/auth.spec.ts e2e/settings.spec.ts e2e/print.spec.ts` (all unchanged, stay green)
- print byte-faithful + per-screen pguard render: Agent-probe: render diff + visual review

### Dimension findings

- Infra fit: PASS — all target paths resolve; `#topbar-actions` slot present (`src/app/topbar.tsx:39`); `src/components/ui/*` primitives + Phase-01 tokens/fonts (VERIFIED) available; AppSetting model present (additive read/write, no schema change); test runner `vitest run`, e2e via `pnpm start` webServer. NOTE: `sheet-header.tsx` lives at `src/components/sheet-header.tsx` (not the print dir) — scope-fence command uses the correct full path above.
- Test coverage: CONCERN — `pnpm test` genuinely covers totals/order-save/secret suites; scope-fence git-diff verified mechanical (exit 0 now); fixture matches 446/137/82/99 (51 cells). Concern: the Fully-Automated payload gate is only real if the payload emission is EXTRACTED into a pure importable `buildOrderPayload` under `src/**/*.test.ts` (folded into A3). e2e is correctly Hybrid (needs sandbox DB + built app).
- Breaking changes: CONCERN — saveOrderSheet payload contract PRESERVED (matrix reuses `cell:`/`note:` + `saveOrderSheet.bind`, confirmed vs order-grid.tsx + actions.ts). Concern: reskins must preserve selectors other e2e specs assert — folded into checklist: login submit+error (A1), shops-edit name/needsConfirmation/บันทึก for D2 (B1), admin heading (B3), settings/db route+heading (B4), plus already-present new-sheet name=date/location+เปิดใบออเดอร์ (A5).
- Security surface: PASS — vc-security STRIDE: login reskin keeps real NextAuth (username/password + generic anti-enumeration error preserved via A1; login/actions.ts untouched); AppSetting stores non-secret display values (schema: "No secrets written here"); settings/db secret path explicitly UNTOUCHED (secret-hygiene + secret-leak stay green); sandbox DB only. High-risk classes (auth/identity + data-write + public-contract) meet the hybrid-minimum via e2e D1/D2 + payload unit. No risk-evidence-pack blocker: this phase touches NO auth logic and NO secret path (UI reskin only).
- A — Login + matrix (payload): CONCERN — mechanically feasible (order-matrix.tsx CREATE; page.tsx additive productId/productName on the existing `product` select; OrderGrid->OrderMatrix swap). Highest-risk edit = the hidden-input payload -> mitigate by writing the buildOrderPayload unit RED-first vs the fixture, then wiring the matrix, then the scope-fence. Blank-gap rows: page.tsx already emits rows with shopId=null -> matrix renders those disabled.
- A — e2e rewrite: PASS — hooks specified (`grand-total`, `total-{printOrder}`, `cell-{rosterOrder}-{printOrder}`); openSheet unchanged; enterCell swaps combobox->`cell-`fill; D1 446+reload+137/82/99; D2 initial cell via `cell-26-1`, server `shopNameAtEntry` assertions unchanged. Buildable.
- B — Master data + admin + settings: CONCERN — feasible; app-settings.ts additive via `prisma.appSetting` (model confirmed, zero current usage). Concern = the preserve-selectors set (B1/B3/B4 folded in).
- C — Print toolbar: PASS — only print-controls.tsx reskinned (window.print() kept); print-table/sheet-header/layout immutable (scope-fence covers them); print.spec G1-G8 assert the print-table DOM (not the controls) -> stay green with renderers untouched.

### Execute-Agent Instructions (regression-preservation — read before EXECUTE)

- E1 (payload, Section A entry): Extract `buildOrderPayload(cells, notes)` as a pure importable function BEFORE building the matrix JSX. Write `order-payload.test.ts` RED-first asserting the exact FormData set against `test-fixtures/sheet-13-03-69.json` (rules: cell emitted only when Number.isInteger(qty) && qty>0, value=trimmed; note emitted when text.trim()!="" , value=RAW text). The matrix's hidden inputs MUST render exactly this set.
- E2 (scope fence, after each section + at exit): run the INV-scope-fence command (full 9 paths above). ANY non-zero diff on the immutable set = HARD STOP -> revert that touch.
- E3 (login, A1): keep `name="username"`/`name="password"`/`button[type="submit"]` + render the generic error text; do NOT edit `login/actions.ts`.
- E4 (shops, B1): the shops-edit reskin MUST keep `input[name="name"]`, `input[name="needsConfirmation"]`, save button "บันทึก" — orders.spec D2 drives them.
- E5 (admin, B3): keep the "จัดการผู้ใช้" heading; (settings, B4) keep /settings/db route + "ตั้งค่าการเชื่อมต่อฐานข้อมูล" heading.
- E6 (deletions, A6): delete all 4 Order-Pad files together (order-grid/shop-rail/shop-order-card/summary-bar) — they form a self-contained import cluster; only `[id]/page.tsx` (a MODIFY target) references them externally. Confirm a clean `pnpm build` (no dangling imports) after the swap.
- E7 (regression run, exit): run auth.spec + settings.spec + print.spec UNCHANGED and confirm green (do not edit them); rewrite ONLY orders.spec.

Open gaps: none blocking. Residuals: (1) weight/peep persistence — known-gap: documented as NEW PLAN REQUIRED — see `process/features/pguard-redesign/backlog/weight-peep-persistence_NOTE_07-07-26.md` (needs schema migration, outside program HARD STOP). (2) Per-screen pguard visual fidelity is Agent-Probe (judgment, not pixel-exact) — record judgment in the phase report.

What this coverage does NOT prove:
- DoD#2-payload unit proves the FormData shape is byte-identical, NOT that a live save round-trips (that is DoD#2-e2e-D1).
- INV-scope-fence proves the immutable files are untouched, NOT that the new UI is correct.
- INV-totals/INV-secret (`pnpm test`) prove no regression in totals/secret logic, NOT any matrix UI behavior.
- DoD#2-e2e-D1/REG-D2 prove end-to-end matrix save + snapshot preservation on the sandbox, NOT print output.
- REG-auth/REG-settings/INV-print prove the unchanged specs still pass, NOT pixel/visual fidelity.
- PROBE-screens proves screens render in pguard by judgment, NOT pixel-exactness and NOT the byte-faithful print (that is INV-print render diff).

Gate: CONDITIONAL (0 FAILs; 6 concerns folded into the checklist as execute-instructions E1-E7; program charter pre-authorizes CONDITIONAL -> proceed; no vacuous green — every developed behavior has a Fully-Automated or Hybrid gate).
Accepted by: session (autonomous, /goal execution — umbrella Autonomous Execution Rules pre-authorize CONDITIONAL -> proceed). Accepted concerns: (1) payload-builder extraction/testability [E1], (2) login selector+error preservation [E3], (3) shops-edit selector preservation for D2 [E4], (4) admin heading preservation [E5], (5) settings/db route+heading preservation [E5], (6) e2e hybrid precondition (sandbox DB + built app) [documented].
