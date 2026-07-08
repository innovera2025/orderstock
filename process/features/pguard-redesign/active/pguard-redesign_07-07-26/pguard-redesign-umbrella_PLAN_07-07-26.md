---
name: plan:pguard-redesign-umbrella
description: "pguard-redesign — umbrella/orchestration plan for the 5-phase re-skin of the orderstock frontend to the pguard Design System (no schema/backend rewrite)"
date: 07-07-26
metadata:
  node_type: memory
  type: umbrella
  feature: pguard-redesign
  phase: umbrella
---

# pguard-redesign — Umbrella Plan

**Date**: 07-07-26
**Complexity**: COMPLEX
**Status**: 🔨 CODE DONE (Phase 01 + Phase 02 + Phase 03 ✅ VERIFIED; Phase 04 next)

## Overview

This umbrella orchestrates the pguard-redesign phased delivery plan; the per-phase implementation checklist lives in the five phase plans. Context router: `process/context/all-context.md`. UI/token/shell context: `process/context/uxui/all-uxui.md`. Test routing: `process/context/tests/all-tests.md`. Next Step: run Phase 04 RESEARCH (ENTER EXECUTE MODE only per-phase after each validate-contract is written).

- Program type: PHASE PROGRAM (5 phases, sequential with gated joins)
- Feature folder: `process/features/pguard-redesign/`
- Program task folder: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/`

## Design Handoff References (in the feature `references/` dir)

- `design_handoff_order_sheet_system/README.md` — the pguard handoff overview
- `design_handoff_order_sheet_system/design_tokens/*.css` — token source (copy into globals.css :root + [data-theme=dark])
- `design_handoff_order_sheet_system/*.dc.html` — 3 prototype screens (desktop daily-order matrix, mobile, new screens)

---

## Program Goal Charter

```
pguard-redesign — Program Goal Charter

North star:
- Re-skin and restructure the orderstock frontend to the pguard Design System (Deep Forest green
  #0E3B2E / interactive #1FA971, amber #F59E0B, IBM Plex Sans Thai/Sans/Mono, 1px-border structure,
  radii 11/8/99, green focus ring, light+dark) inside a sidebar(216px)+topbar(62px) shell — reusing
  the existing stack, with NO schema or backend rewrite.

Definition of done (an unattended agent must be able to do all of these):
1. Boot the app in the pguard theme; toggle light/dark from the topbar; reach every route.
2. Record a daily order on the new 20-column MATRIX (KPI strip + grid + 3-tier header) that REPLACES
   the Order Pad, saving via the UNCHANGED saveOrderSheet `cell:{shopId}:{variantId}` / `note:{shopId}` payload.
3. View the two new screens: สรุปยอดผลิต (/summary, bars from computeColumnTotals) and ประวัติออเดอร์
   (/history, REAL OrderSheet rows).
4. Enter orders on mobile (5 screens + bottom tab bar, ≥44px touch) writing the SAME cell:/note: payload.
5. Have ตีลานนิ่ม/ตีลาน product renames + role-label map applied, seed idempotent, and full regression green.

What "verified" means (program level):
- Each phase's exact gate passes with recorded evidence AND regression checks against overlapping
  previously-verified surfaces pass (esp. the 446 fixture, saveOrderSheet payload, and the byte-faithful
  print sheet). validate-contract gates must be recorded alongside phase gates and regression evidence
  for a phase to reach VERIFIED. A phase without a validate-contract (or documented skip) cannot be VERIFIED.

Scope tiers → phase mapping:
- Tier 1 Foundation (tokens, fonts, shell, primitives) → Phase 01.
- Tier 2 Core desktop (login, matrix, master data, admin, settings, print toolbar) → Phase 02.
- Tier 3 New screens + mobile + data align → Phases 03, 04, 05.
- This program retires Tiers 1-3 (the full re-skin scope).

Explicitly out of scope (deferred tier):
- Any schema/backend/data-model change. The following MUST stay working, NOT rewritten: totals.ts,
  order-save.ts, actions.ts (saveOrderSheet), get-sheet-for-print.ts, print-table.tsx, sheet-header.tsx,
  schema.prisma, the 446 fixture, the print sheet layout (byte-faithful).
- New product features / new order semantics. This is a re-skin + restructure only.

Hard safety constraints (non-negotiable, per phase):
- NEVER change the saveOrderSheet payload shape (`cell:{shopId}:{variantId}`, `note:{shopId}`) — new UIs REUSE it.
- NEVER alter schema.prisma, the 446 totals fixture result, or the faithful print sheet output.
- Sandbox DB only; never touch the customer's real SQL Server.
- Do not commit or push without user instruction. Commit each phase before the next; process/plan
  commits separate from execution commits.
```

---

## Stable Program Goal (copy-paste this to start autonomous execution)

```
SESSION GOAL: pguard-redesign — orderstock frontend re-skin to the pguard Design System
Ref: process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md

TARGET: Complete ALL 5 phases until:
- App renders in the pguard theme (light+dark), sidebar+topbar shell, every route reachable
- The 20-col MATRIX saves via the UNCHANGED saveOrderSheet payload; 446 fixture + print sheet stay green
- /summary + /history (real rows) + mobile (same payload) + ตีลานนิ่ม/ตีลาน renames land; full regression green
- Test tiers: automated (iterate-until-green) / hybrid (fix-if-in-blast-radius) / agent-probe (record-judgment)

AUTONOMY: Before ANY subagent spawn, read:
1. Umbrella ## Current Execution State → loop step + validate-contract status
2. Phase plan ## Phase Loop Progress → first unchecked box = next subagent to spawn

PER-PHASE LOOP (7-step inner loop `R → I → P → PVL → E → EVL → UP`, never skip, never reorder; SKIPS SPEC — SPEC runs once in the outer program loop):
  1. RESEARCH → 2. INNOVATE → 3. PLAN-SUPPLEMENT → 4. PVL → 5. EXECUTE → 6. EVL → 7. UPDATE-PROCESS
- PLAN-SUPPLEMENT: plan-agent writes research/innovate gaps into phase plan (or marks "n/a — clean")
- PVL NEVER skipped; contract per example-validate-output.md; partial contract = blocked like placeholder
- Every subagent FIRST ACTION: vc-context-discovery + vc-plan-discovery
- Every phase-END: invoke vc-agent-strategy-compare
- Model: sonnet for all legs; opus ONLY for the EXECUTE (code-writing) leg

Report via phase reports. No approval between phases unless a HARD STOP is hit.

HARD STOPS (pause, wait for user):
- Any change to the saveOrderSheet payload / schema.prisma / 446 fixture / print sheet output
- Any connection to the customer's real SQL Server; commit or push without user instruction
- Net gate = BLOCKED with no backlog resolution path; validate-contract placeholder and PVL cannot run

SAFETY (never override):
- Re-skin only — no schema/backend rewrite; the listed out-of-scope files stay working
- saveOrderSheet payload shape immutable; sandbox DB only; commit each phase before advancing

TEST GATES (every phase exit — full-path validators):
  node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <phase-plan-path>
  node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs <umbrella-plan-path>
  node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs --strict
  node .claude/skills/vc-audit-context/scripts/validate-context.mjs
  node .claude/skills/vc-audit-plans/scripts/validate-plans.mjs
  Plus per-phase product gates: pnpm test (446 fixture) / pnpm lint / pnpm build / Playwright e2e (see each phase plan)

VALIDATE CONTRACT: Per-phase contracts written by vc-validate-agent into each phase plan before EXECUTE.

START: Phase 01 (Foundation), loop step RESEARCH (pending). Spawn vc-research-agent for Phase 01.
```

---

## Phase Sequence

| Phase | Plan file | Scope summary | Depends on |
|---|---|---|---|
| 0 (pre-program) | this file | Confirm folder structure, create sub-phase plans + registry | — |
| 01 — Foundation | `.../phase-01-foundation_PLAN_07-07-26.md` | pguard tokens → globals.css + Tailwind v4 @theme; IBM Plex via next/font/google (replace Sarabun); sidebar/topbar shell (replace (main)/layout.tsx + nav.tsx; 3 menu groups incl. new /summary /history); shared UI primitives | Phase 0 |
| 02 — Core desktop | `.../phase-02-core-desktop_PLAN_07-07-26.md` | Login (split hero); daily-order MATRIX+KPI replacing Order Pad (delete 4 files, new order-matrix.tsx reusing saveOrderSheet); shops; products; admin/users; settings 3-panel; print toolbar reskin (print sheet faithful) | Phase 01 |
| 03 — New screens | `.../phase-03-new-screens_PLAN_07-07-26.md` | /summary (bars from computeColumnTotals + per-shop top-8 + notes) + /history (real OrderSheet rows; today live, past closed) | Phase 02 |
| 04 — Mobile | `.../phase-04-mobile_PLAN_07-07-26.md` | 5 mobile screens (login sheet, shop list w/ progress, per-shop stepper writing SAME payload, summary, users) + bottom tab bar; touch ≥44px | Phase 02 |
| 05 — Data align + verify | `.../phase-05-data-align-verify_PLAN_07-07-26.md` | ตีลานนิ่ม/ตีลาน renames (product-order.ts + seed) + role-label map; reseed idempotent; FULL regression (446 intact, all e2e green, names consistent matrix/summary/print) | Phase 02 + 03 + 04 |

### Join Conditions

- Phase 01 MUST NOT start until Phase 0 exit gate passes (plan files + registry created).
- Phase 02 MUST NOT start until Phase 01 exit gate passes (theme + shell + primitives).
- Phase 03 and Phase 04 MUST NOT start until Phase 02 exit gate passes (both depend on the matrix + shared primitives).
- Phase 05 MUST NOT start until Phases 02 AND 03 AND 04 exit gates all pass (final data align + full regression).

---

## Per-Phase Entry / Exit Gates

| Phase | Entry | Exit gate |
|---|---|---|
| 0 | Program start | Phase plan files + blast-radius registry created; validators pass |
| 01 | Phase 0 complete | App renders in pguard theme; dark toggle flips; all routes reachable; vitest + existing e2e green |
| 02 | Phase 01 exit met | Matrix saves via UNCHANGED saveOrderSheet; 446 fixture + rewritten orders.spec.ts green; print sheet byte-unchanged |
| 03 | Phase 02 exit met | /summary bars == computeColumnTotals; /history lists real OrderSheet rows |
| 04 | Phase 02 exit met | Mobile entry writes identical cell:/note: payload; bottom tabs work; touch ≥44px |
| 05 | Phases 02+03+04 exits met | ตีลานนิ่ม/ตีลาน renames applied; seed idempotent; full regression green; names consistent across matrix/summary/print |

---

## Per-Phase Loop

Each phase executes the canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP`. This inner loop
SKIPS SPEC — SPEC runs once in the outer program loop, not per phase. The 7 steps map to:

1. **RESEARCH** — spawn research-agent: load context, read prior phase reports, check plan drift, document findings.
2. **INNOVATE** — spawn innovate-agent: decide approach; write Decision Summary (chosen approach + rejected alternatives).
3. **PLAN-SUPPLEMENT** — spawn plan-agent: add research/innovate gaps to the checklist, or mark "n/a — research clean".
4. **PVL** — spawn vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`.
5. **EXECUTE** — spawn vc-execute-agent (opus) per approved plan and validate-contract.
6. **EVL** — spawn vc-tester: run phase test gates to green; regression-check overlapping surfaces (446 fixture, saveOrderSheet, print); write EVL HANDOFF SUMMARY.
7. **UPDATE-PROCESS** — write phase report; rewrite umbrella `## Current Execution State` (overwrite, not append).

**PVL is NEVER skipped.** A placeholder `## Validate Contract` = blocked.

---

## Autonomous Execution Rules (During /goal)

During /goal execution of this phase program:
- Agent self-decides at all V5 gates — no user approval needed between phases (except HARD STOPS).
- CONDITIONAL net gate: proceed autonomously, fixes applied in-flight, gaps on record.
- BLOCKED net gate: document items in backlog, continue with remaining phase plans; backlog is always valid.
- Hard stops (must pause): any change to saveOrderSheet payload / schema / 446 fixture / print sheet; commit/push without instruction; plan marks "pause required".
- The phase report is the communication channel — not inline questions.

---

## Global Constraints

- **Re-skin only** — reuse the existing stack; NO schema or backend rewrite.
- **Immutable saveOrderSheet payload:** `cell:{shopId}:{variantId}` / `note:{shopId}` — the new matrix (Phase 02) and mobile (Phase 04) REUSE it unchanged.
- **Matrix ↔ data mapping (LOAD-BEARING):** handoff col 0..19 = `ProductVariant.printOrder` 1..20; row 0..28 = `Shop.rosterOrder` 1..29. Keep this 1:1.
- **Must stay working (out of scope to rewrite):** totals.ts, order-save.ts, actions.ts, get-sheet-for-print.ts, print-table.tsx, sheet-header.tsx, schema.prisma, the 446 fixture, the byte-faithful print sheet.
- **Fonts:** IBM Plex Sans Thai (subsets thai+latin) + IBM Plex Sans + IBM Plex Mono via `next/font/google`, mapped to token vars; REMOVE the self-hosted Sarabun @font-face + woff2.
- **RESOLVED decisions (encode in phases):** keep DB shop tone-marks (เจ๊ not เจ้); ship dark mode WITH topbar toggle (semantic.css has full dark tokens); keep 2 real roles ADMIN/STAFF (role chips are UI labels only, no 3rd real role); ประวัติออเดอร์ lists REAL OrderSheet rows (no mock); product renames ตีลานนิ่ม/ตีลาน applied in Phase 05 only.
- Commit each phase before the next; keep process/plan/context commits separate from execution commits.

---

## Durable Report Destinations

| Phase | Report path (FLAT in the program task folder) |
|---|---|
| 0 (pre-program) | `.../phase-00-planning_REPORT_07-07-26.md` |
| 01 — Foundation | `.../phase-01-foundation_REPORT_07-07-26.md` |
| 02 — Core desktop | `.../phase-02-core-desktop_REPORT_07-07-26.md` |
| 03 — New screens | `.../phase-03-new-screens_REPORT_07-07-26.md` |
| 04 — Mobile | `.../phase-04-mobile_REPORT_07-07-26.md` |
| 05 — Data align + verify | `.../phase-05-data-align-verify_REPORT_07-07-26.md` |

All paths are inside `process/features/pguard-redesign/active/pguard-redesign_07-07-26/`.

---

## Program Status Table

| Phase | Status |
|---|---|
| 0 — Pre-program (plan creation) | ✅ VERIFIED (umbrella + stubs created; validators pass) |
| 01 — Foundation | ✅ VERIFIED (07-07-26 — EVL independent re-run: 10/10 gates green, scope fence empty; UPDATE PROCESS done) |
| 02 — Core desktop | ✅ VERIFIED (07-07-26 — EVL independent re-run: 6/6 gate rows green, scope fence EMPTY on all 9 immutable files, e2e 19/19 + idempotency re-run 3/3; UPDATE PROCESS done) |
| 03 — New screens | ✅ VERIFIED (08-07-26 — EVL independent re-run: all 9 gates green, scope fence EMPTY, e2e 21/21; UPDATE PROCESS done) |
| 04 — Mobile | ⏳ PLANNED (next) |
| 05 — Data align + verify | ⏳ PLANNED |

Status values: ⏳ PLANNED | 🔨 CODE DONE | 🧪 TESTING | ✅ VERIFIED | 🚧 BLOCKED | ✅ COMPLETE

---

## Touchpoints

- Phase 01: `src/app/globals.css`, `tailwind.config`/`@theme`, `src/lib/fonts.ts`, `src/app/(main)/layout.tsx`, `src/components/nav.tsx`, `src/components/ui/*`, remove Sarabun woff2 + @font-face
- Phase 02: `src/app/(auth)/login/**`, `src/app/(main)/orders/**` (new `order-matrix.tsx`; delete `order-grid.tsx`/`shop-rail.tsx`/`shop-order-card.tsx`/`summary-bar.tsx`), `src/app/(main)/{shops,products,admin/users,settings}/**`, print toolbar component
- Phase 03: `src/app/(main)/summary/**`, `src/app/(main)/history/**`
- Phase 04: `src/app/(mobile)/**` (or responsive variants), bottom tab bar component
- Phase 05: `src/lib/product-order.ts`, `prisma/seed.ts`, role-label map

---

## Public Contracts

- `saveOrderSheet` payload (`cell:{shopId}:{variantId}`, `note:{shopId}`) — UNCHANGED; consumed by the new matrix + mobile.
- `computeColumnTotals` / totals.ts — UNCHANGED; consumed by the new /summary bars.
- The print sheet (get-sheet-for-print.ts + print-table.tsx + sheet-header.tsx) — byte-faithful, unchanged output.
- `schema.prisma` — unchanged.

---

## Blast Radius

Files created/modified per phase (see per-phase plans for exact lists):

- Phase 01: globals.css, Tailwind @theme, fonts.ts, (main)/layout.tsx, nav.tsx, components/ui/*; remove Sarabun assets
- Phase 02: login/**, orders/** (new matrix, 4 deletions), shops/**, products/**, admin/users/**, settings/**, print toolbar
- Phase 03: summary/**, history/**
- Phase 04: mobile screens/**, bottom-tab-bar
- Phase 05: product-order.ts, seed.ts, role-label map

Shared-file coordination (tracked in `phase-blast-radius-registry.md`): `src/app/(main)/layout.tsx` + `nav.tsx` established in Phase 01 are extended by 02/03/04; `src/components/ui/*` primitives from Phase 01 are consumed by every later phase; `product-order.ts` is read everywhere but only WRITTEN in Phase 05.

---

## Verification Evidence

```bash
# Umbrella artifact validity
node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs \
  process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
# Expected: no FAIL lines

# All five phase plans valid
for f in process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-0*_PLAN_07-07-26.md; do
  node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs "$f"; done
# Expected: no FAIL lines per file

# Program invariant (every phase): the 446 totals fixture stays green and saveOrderSheet payload unchanged
```

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md`
- Last completed phase: Phase 03 — New screens (✅ VERIFIED 08-07-26; EVL independent re-run all 9 gates green, scope fence EMPTY on 9 immutable files, e2e 21/21).
- Validate-contract status: Phase 01 + Phase 02 + Phase 03 CLEAN/closed. Phase 04 pending (vc-validate-agent writes it after Phase 04 RESEARCH → INNOVATE → PLAN-SUPPLEMENT).
- Next step for a fresh agent: Read this umbrella (esp. `## Current Execution State` carry-forward notes below), read `phase-04-mobile_PLAN_07-07-26.md` and the Phase 03 report, then run the Phase 04 RESEARCH subagent before any EXECUTE work.
- Current phase: Phase 04 (Mobile — 5 screens + bottom tab bar).
- Next action: Spawn vc-research-agent for Phase 04.
- Execute-agent start instruction: Do NOT execute yet. Phase 04 must complete RESEARCH → INNOVATE → PLAN-SUPPLEMENT → PVL first. Never change the saveOrderSheet payload / schema / 446 fixture / print sheet.

---

## Current Execution State

Last updated: 08-07-26
Completed phases: Phase 0 (Planning), Phase 01 (Foundation), Phase 02 (Core desktop), Phase 03 (New screens) — ✅ VERIFIED
Current phase: Phase 04 — Mobile (5 screens + bottom tab bar)
Current loop step: RESEARCH (not started)
Validate-contract status: n/a yet for Phase 04 — PVL runs after Phase 04 RESEARCH → INNOVATE → PLAN-SUPPLEMENT.
Program Net Gate: Phase 01 CLEAN/VERIFIED; Phase 02 CLEAN/VERIFIED; Phase 03 CLEAN/VERIFIED; Phase 04 not yet gated.
Latest validator run: 08-07-26 — see Verification Evidence commands below

Phase 03 carry-forward (read before Phase 04 RESEARCH — durable surfaces now available):
1. **Mobile per-shop entry MUST write the SAME `saveOrderSheet` payload**
   (`cell:{shopId}:{variantId}` + `note:{shopId}`) via `buildOrderPayload`
   (`src/lib/order-payload.ts`) — REUSE it, do not re-derive the emission rules.
2. **Reuse `src/components/ui/*` primitives + pguard tokens** — no new component
   system for mobile; the shared primitives (button/input/card/modal/toast/chip/
   status-dot/switch) are token-driven and should cover mobile needs directly.
3. **Mobile shell = bottom tab bar** (ร้านค้า/สรุปยอด/ผู้ใช้), hidden during per-shop
   entry (per the program charter's mobile screen list: login sheet, shop list w/
   progress, per-shop stepper, summary, users).
4. **Reuse `summary.ts` (`computeShopTotals`/`topShops`) + `totals.ts`
   (`computeColumnTotals`/`computeGrandTotal`)** for the mobile summary screen — both
   are pure, already unit-tested (82 unit tests total), and do not need reimplementing.
5. **HARD STOP still applies** — never touch `saveOrderSheet` payload shape,
   `src/lib/totals.ts` internals, `src/app/(main)/orders/actions.ts` (order-save), the
   print sheet chain (`get-sheet-for-print.ts`/`print-table.tsx`/`sheet-header.tsx`),
   `prisma/schema.prisma`, or the 446 fixture. The 9-file immutable set stayed
   zero-diff through Phase 03 — keep it that way.
6. **The e2e clean-state helper** (`beforeEach`/`afterAll` in
   `e2e/summary-history.spec.ts` — deletes E2E-located sheets, restores renamed shops)
   is a reusable pattern; hoist it into a shared e2e util if Phase 04's e2e specs need
   the same clean-state guarantee (EVL follow-up stub, non-blocking).
7. **Responsive vs. separate mobile routes is an open decision for Phase 04
   RESEARCH** — the design handoff mobile prototype is 390×844; decide during Phase 04
   RESEARCH/INNOVATE whether mobile is a responsive variant of existing routes or a
   dedicated `(mobile)/` route group.

Loop step values: RESEARCH | INNOVATE | PLAN-SUPPLEMENT | PVL | EXECUTE | EVL | UPDATE-PROCESS
Orchestrator rule: read "Current loop step" and "validate-contract status" before spawning any subagent. Never spawn execute-agent when loop step is RESEARCH, INNOVATE, PLAN-SUPPLEMENT, or PVL.

Note: The Stable Program Goal above is fixed. This section is the only part that changes — update-process-agent rewrites it after every phase closeout (overwrite, not append — git history is the audit log).

---

## Pre-PVL Conflict Resolution

(Written by the orchestrator before outer PVL begins. Placeholder for now.)

Shared files across phases: `src/app/(main)/layout.tsx` + `nav.tsx` (Phases 01→02→03→04) and `src/components/ui/*` (Phase 01 creates, 02–05 consume) and `product-order.ts` (read everywhere, written only in Phase 05). These are **parallel-safe by sequencing** — the program runs phases sequentially and each later phase extends (never rewrites) prior state. Phases 03 and 04 both depend on Phase 02 but touch disjoint route folders (`summary`/`history` vs mobile), so they could parallelize post-Phase-02 if desired. No package reassignment required. To be confirmed by the orchestrator before outer PVL: 'No package conflicts — all phases parallel-safe under sequential execution; 03/04 optionally parallel after 02.'

---

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
