---
name: plan:pguard-redesign-phase-04-mobile
description: "pguard-redesign — Phase 04: 5 mobile screens (login sheet, shop list, per-shop stepper writing same payload, summary, users) + bottom tab bar"
date: 07-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: pguard-redesign
  phase: phase-04
---

# Phase 04 — Mobile

**Program:** pguard-redesign
**Umbrella plan:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ✅ VERIFIED (EVL 2026-07-08 — all gates green on independent re-run; scope-fence EMPTY; payload byte-identity STRUCTURAL)
**Report destination:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-04-mobile_REPORT_07-07-26.md (flat in the program task folder)

---

## Purpose

Deliver the pguard mobile experience: 5 screens — login (bottom-sheet), shop list (with per-shop progress), per-shop stepper entry, summary, and users — plus a bottom tab bar. **Architecture: RESPONSIVE shared-component — NOT a separate `(mobile)` route group.** The mobile per-shop stepper is a breakpoint-gated VIEW rendered by the SAME `order-matrix.tsx` client component over the SAME `cells`/`notes` state + the SAME `<form id="order-sheet-form">` + the SAME `buildOrderPayload(cells,notes)` → payload byte-identity is STRUCTURAL (a different visual projection of one code path, exactly how the retired Order Pad related to the grid). No new save path, no `(mobile)/` folder, no immutable-file touch. Breakpoint = Tailwind `md` (768px): desktop matrix at md+, mobile view below. Touch targets ≥44px.

---

## Objective

Mobile order entry writes an identical `cell:`/`note:` payload to desktop; the bottom tab bar navigates all 5 screens; touch targets are ≥44px — all in pguard.

---

## Entry Gate

- Phase 02 exit gate passed (matrix + saveOrderSheet payload proven; primitives available).
- REUSE `src/components/ui/*` + uxui tokens + order-matrix state + `buildOrderPayload` + `summary.ts`. Token/primitive contract: `process/context/uxui/all-uxui.md`.

---

## Dependencies

- Phase 02 (payload contract + primitives). Independent of Phase 03 — could run in parallel post-Phase-02.

---

## Blast Radius (exact file touch list)

**CREATE:** `src/components/bottom-tab-bar.tsx`; OPTIONAL presentational `src/app/(main)/orders/order-mobile-list.tsx` + `order-mobile-entry.tsx` (imported by OrderMatrix, same state setters — keep in orders/, NOT a (mobile) group).
**MODIFY:** `src/app/(main)/orders/order-matrix.tsx` (mobile list+entry branch over same state; desktop matrix stays md+), `src/app/(main)/layout.tsx` (sidebar md+ / bottom tab bar below), `src/app/(auth)/login/page.tsx` (responsive bottom-sheet; LoginForm/name=username unchanged), `src/app/(main)/summary/page.tsx` (responsive stack), `src/app/(main)/admin/users/*` (responsive card list; reuse active toggle + CreateUserForm modal).
- consumes (unchanged): `saveOrderSheet`, `buildOrderPayload`, `computeColumnTotals`, `summary.ts`, `src/components/ui/*`.
**IMMUTABLE (git-diff ZERO change):** `actions.ts`, `order-save.ts`, `totals.ts`, `order-payload.ts` (consumed, NOT edited), `schema.prisma`, `test-fixtures/sheet-13-03-69.json`, `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`. **NO `(mobile)/` route group is created.**

---

## Decisions (from INNOVATE — responsive shared-component)

| # | Decision | Chosen |
|---|---|---|
| 1 | Bottom tab bar | NEW `src/components/bottom-tab-bar.tsx`, rendered by `(main)/layout.tsx`, mobile-only via CSS (sidebar shows on md+). 3 tabs → /orders (ร้านค้า), /summary (สรุปยอด), /admin/users (ผู้ใช้ — ADMIN-only, hidden for STAFF). Active `#15885B` via `usePathname` (like nav-links.tsx). ≥44px. |
| 2 | ร้านค้า tab | → /orders (responsive sheet list on mobile); the mobile shop-list ↔ per-shop entry live INSIDE `/orders/[id]` (order-matrix mobile branch). Avoids find-or-create-today ambiguity. |
| 3 | list ↔ entry | CLIENT SUB-STATE of order-matrix (preserves single-form/state parity). NOT a subroute. |
| 4 | Per-shop entry | FULL-VIEWPORT mobile overlay (fixed, covers the tab bar; z-index) with a back button → shop-list. No shared-state signal needed to hide the tab bar. |
| 5 | Summary mobile | reuse /summary most-recent-sheet default (same as desktop), responsive stack. |
| 6 | Users tab | ADMIN-only (server boundary unchanged); STAFF never sees the ผู้ใช้ tab. |

**IMMUTABLE (git-diff ZERO change):** `actions.ts`, `order-save.ts`, `totals.ts`, `order-payload.ts` (consumed, NOT edited), `schema.prisma`, `test-fixtures/sheet-13-03-69.json`, `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `print/layout.tsx`.

---

## Mobile Screen Specs (encode, 390×844)

- **Login sheet**: green gridded gradient hero top (`155deg #0E5238→#082619`) + white sheet radius `18px 18px 0 0` bottom with the UNCHANGED LoginForm (username/password, real NextAuth, generic error). Button `min-h 48px`.
- **รายชื่อร้าน** (order-matrix mobile branch, list sub-state): green header `#0E3B2E` (brand + BE-date chip + amber progress bar `done/total` from `orderedCount/namedRows.length`); search (reuse `query` state); cards per named row (circle rosterOrder, shopName, "รวม n หน่วย · {note}", status chip กรอกแล้ว green / ยังไม่สั่ง amber, chevron), ≥44px. Tap → entry sub-state for that shop.
- **กรอกทีละร้าน** (entry sub-state, full-viewport overlay, tab bar covered): top bar back "‹ ร้านค้า" + shopName + "ร้านที่ n จาก 29 · รวม x หน่วย" + ‹ › prev/next (clamp 0..28); 2 sections สินค้า(GOODS)/เครื่องปรุง(SEASONING); each of 20 rows = label+unit(columnSub) / − / mono numeric input 44px `inputMode=numeric` / + calling `setCell(shopId,variantId,...)`; filled-row bg `#F1FBF6`; note field → `setNote(shopId)`; sticky bottom "บันทึก แล้วไปร้านถัดไป" (`type=submit form="order-sheet-form"`) → whole-sheet save (idempotent) + advance shopIdx (last shop → back to list). ≥44px.
- **สรุปยอด**: /summary responsive — green header + 2 KPI (ร้านที่สั่ง done/total, รวมจำนวน grandTotal) + per-product bars (reuse computeColumnTotals green/amber), stack 2fr/1fr → single col below md.
- **ผู้ใช้**: /admin/users responsive card list (avatar initials, name + "คุณ" for self, role·status, ระงับ/เปิด via existing active toggle, "+ เพิ่ม" CreateUserForm as modal, logout). ADMIN-only.

---

## Inner Loop Refresh Note

- **Date:** 08-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after outer RESEARCH (responsive shared-component recommended) + INNOVATE (decisions resolved).
- **Sections changed:** Purpose (RESPONSIVE shared-component architecture — NOT a (mobile) route group; structural payload byte-identity; md breakpoint), Entry Gate (reuse order-matrix state + buildOrderPayload + summary.ts + uxui contract), NEW Decisions section (bottom-tab-bar via layout mobile-only, ร้านค้า→/orders responsive, list↔entry client sub-state, full-viewport entry overlay, summary reuse, users ADMIN-only tab), NEW 5 Mobile Screen Specs (390×844), Blast Radius (drop (mobile) folder → responsive branches inside order-matrix + presentational subcomponents in orders/; add immutable set incl order-payload.ts consumed-not-edited), Implementation Checklist rewritten (bottom tab bar + layout responsive; order-matrix mobile list+entry branch over same state; login/summary/users responsive), Test Plan (payload parity STRUCTURAL via existing order-payload.test.ts — no new builder; NEW 390×844 Playwright mobile spec reusing staff.json + hoisted clean-state helper; scope-fence git-diff; tab-bar-hidden-during-entry), Phase Loop 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key facts folded in:** responsive shared-component (no (mobile) group; same order-matrix.tsx + cells/notes state + <form id=order-sheet-form> + buildOrderPayload → structural byte-identity; md=768px); bottom-tab-bar in (main)/layout.tsx mobile-only, 3 tabs, users ADMIN-only, active #15885B; shop-list↔entry as client sub-state inside /orders/[id]; full-viewport entry overlay covering tab bar; 5 screen specs at 390×844; payload parity already covered by order-payload.test.ts (no new builder); NEW mobile e2e (390×844, staff.json, hoist Phase-03 clean-state helper to e2e/util) enters 13/3/69 via steppers → save → reload → 446 + tab nav + tab-bar-hidden-during-entry; scope-fence 9 immutable files.
- **Validate-contract left untouched** (placeholder) — PVL writes it next.

---

## Implementation Checklist

### Step A — Shell + bottom tab bar

- [x] A1. CREATE `src/components/bottom-tab-bar.tsx`: 3 tabs (/orders ร้านค้า, /summary สรุปยอด, /admin/users ผู้ใช้ [ADMIN-only, hidden for STAFF]); active `#15885B` via `usePathname`; ≥44px.
- [x] A2. MODIFY `src/app/(main)/layout.tsx`: render the sidebar on md+ and the bottom tab bar below md (CSS breakpoint only — NO `(mobile)/` route group).

### Step B — Order-matrix mobile branch (critical — same state, same payload)

- [x] B1. MODIFY `src/app/(main)/orders/order-matrix.tsx`: add a breakpoint-gated mobile branch (list + entry) rendered below md over the SAME `cells`/`notes` state, the SAME `<form id="order-sheet-form">`, and the SAME `buildOrderPayload(cells,notes)`. Desktop matrix stays for md+. Payload byte-identity is STRUCTURAL (one code path).
- [x] B2. OPTIONAL presentational subcomponents `src/app/(main)/orders/order-mobile-list.tsx` + `order-mobile-entry.tsx` (imported by OrderMatrix, receive the SAME state setters `setCell`/`setNote` — parity preserved; keep in `orders/`, NOT a `(mobile)` group). Build per the Mobile Screen Specs (รายชื่อร้าน list sub-state + กรอกทีละร้าน full-viewport overlay covering the tab bar; sticky "บันทึก แล้วไปร้านถัดไป" submits `form="order-sheet-form"`).

### Step C — Login / summary / users responsive

- [x] C1. MODIFY `src/app/(auth)/login/page.tsx`: responsive bottom-sheet variant (LoginForm / name=username UNCHANGED).
- [x] C2. MODIFY `src/app/(main)/summary/page.tsx`: responsive stack (2fr/1fr → single col below md), reuse most-recent-sheet default.
- [x] C3. MODIFY `src/app/(main)/admin/users/*`: responsive card list (reuse the active toggle + CreateUserForm as a mobile modal). ADMIN-only.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: mobile entry payload (high-risk: data write path)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Payload parity is STRUCTURAL (mobile + desktop share `buildOrderPayload`) — covered by existing `order-payload.test.ts` | `pnpm test` (no new builder) | one-builder parity | live save |
| Fully-automated | Scope-fence: IMMUTABLE set has ZERO git diff | `git diff --exit-code -- actions.ts order-save.ts totals.ts order-payload.ts schema.prisma test-fixtures/sheet-13-03-69.json get-sheet-for-print.ts print-table.tsx sheet-header.tsx print/layout.tsx` | no forbidden-file change | UI |
| Hybrid | Enter 13/3/69 via the mobile per-shop steppers → save → reload → grand-total 446; bottom tabs navigate 3 screens; tab bar HIDDEN during entry (overlay) | NEW Playwright project 390×844 reusing `e2e/.auth/staff.json` + hoist the Phase-03 clean-state helper to a shared `e2e/util` | end-to-end mobile save + nav | pixel fidelity |
| Agent-probe | 5 mobile screens render in pguard at 390×844; touch ≥44px | mobile-viewport screenshot + measure | mobile ergonomics | data |

High-risk (data write path): minimum Hybrid — satisfied by the mobile-save gate. Known-Gap NOT permitted for the payload-parity behavior.

---

## Exit Gate

```bash
pnpm test        # Expected: mobile↔desktop payload-parity unit green
pnpm build && pnpm lint
# Hybrid: mobile viewport entry saves + reloads (identical payload); bottom tabs navigate all 5 screens
```

- Mobile entry writes identical `cell:`/`note:` payload; bottom tabs work; touch ≥44px.
- 5 screens render in pguard.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- Mobile stepper cannot reach payload parity without an action change → STOP (payload immutable — HARD STOP boundary).
- The mobile branch would require a separate save path (breaking structural byte-identity) → STOP; it MUST reuse buildOrderPayload + the shared form.
- Phase 02 exit gate not met → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE (outer research) — RESPONSIVE shared-component recommended (no (mobile) group); order-matrix state/form/buildOrderPayload reuse + md breakpoint confirmed
- [x] 2. INNOVATE — innovate-agent: DONE — Decisions resolved (bottom-tab-bar mobile-only in layout, ร้านค้า→/orders, list↔entry client sub-state, full-viewport entry overlay, summary reuse, users ADMIN-only tab)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated with the responsive mobile build + 5 screen specs; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: DONE — validate-contract written (net gate PASS, no FAILs). EXECUTE next.
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [x] 6. EVL — all EVL gates green (independent unconditional re-run: unit 82/82, lint, build 20 routes, e2e 25/25, scope-fence EMPTY, 5-screen probe); no follow-up stubs; EVL HANDOFF SUMMARY written; harness/phase-04/verification.json recorded
- [x] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.**

---

## Touchpoints

- CREATE `src/components/bottom-tab-bar.tsx` (+ optional order-mobile-list/entry.tsx in orders/); MODIFY order-matrix.tsx + (main)/layout.tsx + login + summary + admin/users; IMMUTABLE zero-diff set (10 files); NO (mobile) route group

---

## Public Contracts

- Consumes and PRESERVES the `saveOrderSheet` payload contract — the mobile view is a breakpoint projection of the SAME order-matrix code path (structural byte-identity via shared `buildOrderPayload` + `<form id=order-sheet-form>`).
- Reuses Phase-01 primitives, Phase-02 order-matrix state, and Phase-03 summary.ts; no schema/action/payload change.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Payload parity STRUCTURAL (shared buildOrderPayload) | Fully-Automated | DoD #4 (same payload) — proven by: existing order-payload.test.ts |
| IMMUTABLE set has ZERO git diff | Fully-Automated | Program invariant — proven by: scope-fence git-diff gate |
| Mobile entry saves + reloads (e2e) | Hybrid | DoD #4 (mobile entry) — proven by: mobile hybrid gate |
| Touch ≥44px; 5 screens + tabs render | Agent-Probe | DoD #4 (mobile ergonomics) — proven by: mobile agent-probe |

---

## Test Infra Improvement Notes

- Add a Playwright mobile-viewport project (e.g. iPhone preset) reusing the STAFF fixture so mobile specs run headless. Record in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-04-mobile_PLAN_07-07-26.md`
- Last completed step: 4. PVL (validate-contract written; net gate PASS)
- Validate-contract status: WRITTEN (net gate PASS, no FAILs). NEXT STEP is EXECUTE (Step 5).
- Next step: Spawn vc-execute-agent (opus) for EXECUTE (Step 5). Start with Step A (bottom tab bar + layout responsive swap), then Step B (order-matrix mobile branch over the SAME state/form/buildOrderPayload — expose stable testids per contract E1), then Step C. The 10-file immutable set must show ZERO git diff. Payload byte-identity is STRUCTURAL — no new save path.

---

## Plan Metadata

**Date**: 07-07-26
**Complexity**: COMPLEX (one phase of the pguard-redesign program)
**Status**: ✅ VERIFIED (EVL 2026-07-08)

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

Status: PASS
Date: 08-07-26
date: 2026-07-08
generated-by: inner-pvl: phase-04

Parallel strategy: parallel-subagents
Rationale: 4 Layer-1 dimensions + 3 Layer-2 sections, independent read-only feasibility checks, no mid-run coordination (score 2/7 — S2 data-write surface [reused, not new] + 6-file blast radius).

### Test gates (C3 5-column — additive; legacy line form retained below)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| DoD#4-payload | Mobile + desktop emit the IDENTICAL `cell:`/`note:` payload (one shared `buildOrderPayload`) | Fully-Automated | `pnpm test` green on `src/lib/__tests__/order-payload.test.ts` (structural — no new builder) | A |
| scope-fence | 10 immutable files show ZERO git diff | Fully-Automated | `git diff --exit-code -- src/app/(main)/orders/actions.ts src/app/(main)/orders/order-save.ts src/lib/totals.ts src/lib/order-payload.ts prisma/schema.prisma test-fixtures/sheet-13-03-69.json src/app/(main)/orders/get-sheet-for-print.ts src/app/print/print-table.tsx src/app/print/sheet-header.tsx src/app/print/layout.tsx` exits 0 | A |
| DoD#4-mobile-e2e | Enter 13/3/69 via mobile per-shop steppers → save (form="order-sheet-form") → reload → grand-total 446 | Hybrid | NEW Playwright 390×844 project reusing `e2e/.auth/staff.json` + hoisted `cleanState()` helper | B |
| tab-nav | 3 bottom tabs navigate ร้านค้า/สรุปยอด/ผู้ใช้ (ผู้ใช้ ADMIN-only); tab bar HIDDEN during entry overlay | Hybrid | same 390×844 project | B |
| mobile-ergonomics | 5 mobile screens render at 390×844; touch targets ≥44px | Agent-Probe | 390×844 screenshot + measure | B |

gap-resolution legend: A — proven now · B — gate added by this plan's EXECUTE · C — deferred to named later phase · D — backlog stub.

C-4: the `strategy` column carries only the 3 proving strategies (Fully-Automated / Hybrid / Agent-Probe). No Known-Gap row — the developed mobile-entry behavior rests on the Hybrid e2e gate + the Fully-Automated structural test, never on a gap.

Failing stubs: none required. The DoD#4-payload row is an EXISTING green test (structural coverage — a red stub would be false); the scope-fence row is a `git diff` command gate, not a `test()`. Hybrid/Agent-Probe rows receive no stubs by rule.

Legacy line form (retained for existing consumers):
- mobile-payload: Fully-automated: `pnpm test` (existing `order-payload.test.ts` — structural parity, shared buildOrderPayload)
- scope-fence: Fully-automated: `git diff --exit-code -- <10 immutable files>` exits 0 (corrected path: `test-fixtures/sheet-13-03-69.json`, not `src/test-fixtures/...`)
- mobile-e2e-446: hybrid: NEW Playwright 390×844 project + precondition: dev server + `e2e/.auth/staff.json` + hoisted clean-state helper
- tab-nav: hybrid: same 390×844 project + precondition: dev server
- 5-screen ergonomics: agent-probe: 390×844 screenshot + >=44px measure

Dimension findings:
- Infra fit: PASS — all 6 modify targets + the `(main)/layout.tsx` shell swap point exist; playwright.config (setup+chromium only) is cleanly extensible with a 390×844 project; `staff` storage state + `cleanState()` (test.beforeEach in summary-history.spec.ts) are present and hoistable to `e2e/util`.
- Test coverage: PASS — payload parity is structurally covered by the existing unit test; scope-fence is fully-automated; the mobile e2e Hybrid gate is BUILDABLE provided EXECUTE exposes stable selectors (see E1).
- Breaking changes: PASS — payload byte-identity is STRUCTURAL (single `buildOrderPayload` code path + single `<form id="order-sheet-form">`); no schema/action/payload edit; 10-file immutable set fenced by git-diff gate; `order-payload.ts` is consumed, not edited.
- Security surface: PASS — no new write path (reuses proven saveOrderSheet); LoginForm/`name=username` unchanged (auth.spec preserved); ผู้ใช้ tab ADMIN-only matches the server boundary (STAFF never sees it). Not a high-risk-class change requiring an evidence pack — no new auth/data emission.
- Section A (shell + bottom tab bar): PASS — layout.tsx renders `<Nav/>`; add CSS-breakpoint swap (Nav md+ / tab bar below). Highest-risk edit: ADMIN-only tab visibility must mirror the server boundary — gate the ผู้ใช้ tab on the same role check nav uses; verified by tab-nav Hybrid.
- Section B (order-matrix mobile branch): PASS — CRITICAL anchor confirmed present (one cells/notes state, one buildOrderPayload, one form id, shared setCell/setNote). Highest-risk edit: accidentally introducing a second save path — mitigated by keeping the mobile "บันทึกแล้วไปร้านถัดไป" a `type=submit form="order-sheet-form"` (no new action), enforced by the payload unit test staying green + scope-fence.
- Section C (login/summary/users responsive): PASS — all target files exist; LoginForm name=username unchanged; reuse the active toggle + CreateUserForm modal + summary most-recent-sheet default.

Execute-agent instructions:
- E1 (Section B): expose STABLE selectors on the mobile view before the Hybrid gate can run — `data-testid` on each stepper numeric input, the "บันทึกแล้วไปร้านถัดไป" submit button, and the 3 bottom-tab links. The mobile e2e is not authorable without them. Do NOT skip — the Hybrid gate is the only end-to-end proof of mobile save.
- E2 (Section B): the mobile save button MUST be `type="submit" form="order-sheet-form"` — never a separate save action. If a separate path seems needed -> STOP (HARD STOP: payload immutability).
- E3 (Section A): render the ผู้ใช้ tab only for ADMIN using the same role gate as nav; confirm STAFF storage state does not see it in the tab-nav gate.
- E4 (infra): hoist `cleanState()` from `e2e/summary-history.spec.ts` to a shared `e2e/util` before authoring the mobile spec (Phase-03 EVL residual); add the 390×844 project to playwright.config reusing `e2e/.auth/staff.json`.

Open gaps: none.

What this coverage does NOT prove:
- `pnpm test` (payload/structural): proves one-builder parity; does NOT prove the live mobile UI actually calls `setCell`/`setNote` with correct ids — that is the mobile-e2e-446 gate's job.
- scope-fence git-diff: proves no forbidden-file change; does NOT prove UI correctness.
- mobile-e2e-446 (Hybrid): proves end-to-end mobile save + reload identity + tab nav + tab-bar-hidden-during-entry; does NOT prove pixel fidelity or every one of the 20x29 cells.
- 5-screen agent-probe: proves render + >=44px touch ergonomics at 390x844; does NOT prove data correctness.

Gate: PASS (no FAILs, no blocking CONCERNs; developed mobile-entry behavior is proven by the Hybrid e2e gate + the Fully-Automated structural test — not vacuously green).
Accepted by: session (autonomous /goal execution) — net gate PASS, no concerns to accept.
