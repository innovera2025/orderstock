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
**Phase status:** ✅ VERIFIED (EVL independent re-run 06-07-26 by vc-tester — vitest 41/41, playwright 16/16, build+lint ✓, migrate clean, route-group deviation preserves all URLs + auth boundary, DB unpolluted, agent-probe GO; only documented known-gaps Q30/Q22 + on-site printer fidelity remain — classified delivery-time, not blockers)
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-05-printing_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Produce printable output matching the scanned typeset form: a combined daily sheet (all shops in one table) and per-shop sheets, rendered at true A4-landscape millimetre dimensions with the 22-column ruled grid (24 physical colgroup cols / 20 semantic data cols), group divider, totals row, and footer tallies. Table width is a faithful **≈251mm (85% of page — the scan has a deliberate ~10% blank right margin; do NOT stretch to 281mm)**. Primary path is browser print (`@page { size: A4 landscape }`, mm-based `table-layout: fixed`, Sarabun). Server-side Playwright `page.pdf()` fallback is **DEFERRED to backlog** (no escalation trigger confirmed); the gate uses a TEST-SIDE `page.pdf()` inside e2e only. @react-pdf/renderer and `transform: scale()` are explicitly rejected (print REF §2/§1).

---

## Entry Gate

- Phase 04 exit gate passed (sheets recordable; totals correct).
- Phase 04 exports available: reusable two-tier `src/components/sheet-header.tsx` + `test-fixtures/sheet-13-03-69.json` gate fixture — IMPORT both; do NOT duplicate the header or re-derive the fixture.
- Sarabun font already bundled (Phase 01).
- **Fetch drift (LOAD-BEARING):** the existing `/orders/[id]` fetch renders LIVE names — print MUST NOT reuse it. A new shared `getSheetForPrint(date)` reads the snapshot columns (`shopNameAtEntry`/`variantNameAtEntry`) + NoteLines (Phase-02 decision 6 / Phase-04 write).

---

## Blast Radius

- `src/app/print/layout.tsx` — dedicated NO-NAV layout for the `/print` segment (structural nav exclusion, NOT print-only CSS hiding)
- `src/app/print/daily/[date]/**` — combined daily sheet route (renders ONLY the form; calls `requireAuth()` explicitly)
- `src/app/print/shops/[date]/**` — per-shop sheets, one shop per page (`break-after: page`); calls `requireAuth()`
- `src/lib/get-sheet-for-print.ts` — NEW shared fetch reading snapshot columns + NoteLines (NOT the live `/orders/[id]` fetch); daily renders all 29 slots incl. blank gaps; per-shop filters the same result in memory
- `src/components/sheet-header.tsx` — EXTEND (Phase 04's) with optional generic props (subLabel per column → 3-tier; optional mm colgroup mode); NO print-specific logic; NO duplicate print header
- `src/styles/print.css` — `@page` + `@media print`, mm `<colgroup>` widths, borders/weight-emphasis (semantic fills as an additive layer, off by default)
- Backlog (DEFERRED): server-side `/api/print/daily/[date].pdf` + `next.config.ts` serverExternalPackages — written to backlog, NOT implemented this phase

---

## mm Layout Spec (print CSS contract — write the full table into the plan)

A4 landscape 297×210mm, `@page margin: 8mm`. **TABLE WIDTH ≈251mm** (85% page — deliberate ~10% blank right margin; do NOT stretch to 281mm).

| Column group | mm width |
|---|---|
| ลำดับ | 7.1 |
| ร้านค้า | 28.8 |
| สินค้า — 16 cols | 9.8 each |
| เครื่องปรุง — 4 cols | 6.8 each |
| หมายเหตุ text | 23.8 |
| หมายเหตุ qty strip | 8.9 |

**Heights:** 3-tier header 12.6mm + 29 rows × 5.0mm = **145.0mm** + totals row 5.0mm + footer block 27.3mm → total ≈**190mm** ≤ 194mm usable → **SINGLE PAGE fit confirmed.** (Column mm widths sum to 252.6mm; the ≈251mm label is the rounded target.)

**Borders:** outer ~2pt solid; ~1.5pt solid under header band + around totals band; **heavy solid vertical at the สินค้า/เครื่องปรุง boundary (between C18/C19)**; interior separators dotted ~0.5pt; dotted divider inside หมายเหตุ before the qty strip.

**Totals row = LAST tbody row, NEVER `tfoot`** (Chromium repeats `table-footer-group` on every page); `thead` = `table-header-group` as the pagination safety net only.

**Footer data split:** totals row + grand 446 mechanical via `totals.ts`; รวมน้ำหนัก/ปี๊บ lines via `computeTotalWeight(orderLines, factorMap)` — labels always render in position, values BLANK until Q22 factors arrive (never fabricate numbers); yellow 24/21 NEVER rendered; tally lists render from NoteLine aggregates + standing reminder lines.

---

## Decisions (from INNOVATE — verdict GO, 1 CAUTION)

| # | Decision | Chosen |
|---|---|---|
| 1 | Shading | Border/weight-emphasis ONLY as default (survives Background-graphics OFF); semantic fills (header cream / totals salmon / footer green) prepared as a pure-CSS additive layer to flip when Q30 answered; noise fills (blue-gray/khaki/pink) NEVER reproduced. |
| 2 | Table width | Faithful 251mm with blank right margin — the scan is the spec. |
| 3 | Column-count gate | Assert BOTH: physical `<colgroup>` col count = 24 AND semantic data columns = 20 (printOrder 1–20). Ambiguity permanently pinned. |
| 4 | Header | EXTEND `sheet-header.tsx` with optional generic props (subLabel per column → 3-tier; optional mm colgroup mode) — no print-specific logic in the shared component; no duplicate print header. |
| 5 | Weight footer | `computeTotalWeight(orderLines, factorMap)` compute-if-factors-exist-else-blank; labels always render in position, values blank until factors exist; never fabricate numbers. |
| 6 | PDF fallback | DEFER server-side `/api/print` + `next.config` change to backlog (no escalation trigger confirmed); gate uses TEST-SIDE `page.pdf()` inside e2e only. Exit gate C2 = "deferred with rationale" (plan-compliant). |
| 7 | Auth + chrome (CAUTION) | `/print/**` already inside the proxy matcher BUT pages/handlers MUST call `requireAuth()` explicitly (matcher is convenience, not the boundary — auth/ context rule); nav excluded via a dedicated no-nav layout for the `/print` segment (NOT print-only CSS hiding). |
| 8 | Fetch | Single shared `getSheetForPrint(date)` — daily renders all 29 slots incl. blank gaps; per-shop filters in memory; both routes share it; reads snapshot columns, never live names. |

---

## Inner Loop Refresh Note

- **Date:** 06-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after RESEARCH (mm layout spec + fetch drift) + INNOVATE (GO, 1 CAUTION).
- **Sections changed:** Purpose (251mm not 281mm; 24 physical/20 semantic cols; PDF deferred), Entry Gate (import Phase-04 header + fixture; fetch-drift getSheetForPrint), Blast Radius (no-nav print layout; getSheetForPrint; extend sheet-header; PDF to backlog), NEW mm Layout Spec section (col widths, heights, borders, totals-row-last-tbody, footer split), NEW Decisions section, Implementation Checklist (mm colgroup 251mm; C18/C19 heavy divider; requireAuth on print routes; snapshot fetch; extend shared header; column-count gate 24+20; weight-blank-until-factors; PDF deferred-to-backlog), Test Plan (Playwright DOM asserts w/ staff.json: colgroup=24 + data=20, 29 rows, 3-tier header, totals from fixture, @page A4 landscape present, snapshot-render gate, per-shop .sheet count; hybrid test-side page.pdf; agent-probe visual; known-gaps Q30 shading + Q22 weight), Blockers (kept), Verification Evidence (24+20 + snapshot), Phase Loop Progress 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key findings folded in:** full mm layout spec (table 251mm, col widths, heights → single-page fit); borders + heavy C18/C19 divider; totals row = last tbody never tfoot; print fetch drift (getSheetForPrint reads snapshots, NOT /orders/[id] live names); footer weight blank-until-Q22; yellow 24/21 never rendered; server-side PDF deferred to backlog (test-side page.pdf only); requireAuth explicit on print routes + no-nav layout; extend shared sheet-header; reuse Phase-04 fixture.
- **Validate-contract left untouched** (placeholder) — PVL writes it next.
- **Backlog item created (to write at EXECUTE):** server-side PDF fallback route + next.config change — deferred with rationale (no confirmed escalation trigger).

---

## Implementation Checklist

### Step A — Shared fetch + auth + layout

- [x] A1. `src/lib/get-sheet-for-print.ts`: shared fetch reading snapshot columns (`shopNameAtEntry`/`variantNameAtEntry`) + NoteLines — NOT the live `/orders/[id]` fetch. Daily returns all 29 roster slots incl. blank gaps; per-shop filters this in memory.
- [x] A2. `src/app/print/layout.tsx`: dedicated NO-NAV layout for the `/print` segment (structural exclusion, not CSS hiding).
- [x] A3. Both print routes call `requireAuth()` explicitly (proxy matcher is convenience, not the boundary — auth/ context rule).

### Step B — Print layout (mm spec)

- [x] B1. Combined-day route: `table-layout: fixed`, explicit `<colgroup>` at the mm widths in the mm Layout Spec above (table ≈**251mm**, NOT 281mm). EXTEND `sheet-header.tsx` for the 3-tier + mm colgroup mode.
- [x] B2. Reproduce structure: 3-tier header band; **heavy solid vertical divider between C18/C19 (สินค้า/เครื่องปรุง)**; totals row = **LAST tbody row (NEVER tfoot)**; footer tally lists + รวมน้ำหนัก/ปี๊บ (values blank until Q22 factors).
- [x] B3. `src/styles/print.css`: `@page { size: A4 landscape; margin: 8mm }`, `thead { display: table-header-group; break-inside: avoid }`, `tr { break-inside: avoid }`; borders/weight-emphasis default; semantic fills as an additive layer OFF by default.

### Step C — Per-shop + fallback disposition

- [x] C1. Per-shop route: one `.sheet { break-after: page }` per selected shop (single print job); on-screen preview at the same mm dimensions. Visually compare vs `Scan2026-07-04_170934.pdf`; record diffs.
- [x] C2. **PDF fallback = DEFERRED**: write a backlog NOTE (server-side `/api/print/daily/[date].pdf` + `next.config` serverExternalPackages, with rationale = no confirmed escalation trigger). Do NOT implement the server route this phase. The gate's PDF check uses a TEST-SIDE `page.pdf()` inside e2e only.

---

### Step E — PVL-supplement items (CONDITIONAL gaps — explicit, must implement)

- [x] E1. **Column-header name source (zero-order columns):** header uses `variantNameAtEntry` when ≥1 OrderLine exists for that printOrder on the date; else falls back to live `ProductVariant.name`. Document this fallback in the phase report.
- [x] E2. **colgroup ownership:** the print ROUTE emits its own mm `<colgroup>`; `sheet-header.tsx` gains ONLY an optional 3rd-tier `subLabel` prop (defaults OFF) — stays logic-free / print-agnostic. The existing orders grid must render UNCHANGED.
- [x] E3. **Print e2e self-seeds its fixture:** `beforeAll` seeds the 13/3/69 sheet via prisma on a DEDICATED date+location (writing snapshot columns) — NO ordering coupling to `orders.spec.ts`.
- [x] E4. **Snapshot-render gate isolation:** rename via prisma on a dedicated slot/date + RESTORE in `finally` (mirror Phase-04 D2 pattern) so the shared sandbox is never poisoned for later specs.
- [x] E5. **Weight footer blank-not-zero:** render weight LABELS in position with BLANK values when `factorMap` is empty — never render `computeTotalWeight`'s `0` as a value (0 ≠ blank; "0 กก." is misleading).
- [x] E6. **Auth gate for pages:** add a NEW page-grep assertion path in `auth-guard-coverage.test.ts` (print pages are `export default async function`; the existing parser only handles `export async function` actions) + an e2e unauth → `/login` redirect probe for `/print` routes.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: print markup structure (Playwright DOM asserts on `/print/daily/[date]` with `staff.json`)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | colgroup=24 physical cols AND data cols=20 (printOrder 1–20) | Playwright DOM assert both counts | column-count pinned | visual fidelity |
| Fully-automated | 29 rows + 3-tier header + totals row values from fixture (all 20 + 446) | Playwright DOM assert row count/header tiers/totals vs `sheet-13-03-69.json` | structure + totals present | pixel fidelity |
| Fully-automated | `@page A4 landscape` rule present | assert stylesheet rule | page format | printer output |
| Fully-automated | Snapshot-render gate (rename shop in DB → print STILL shows old snapshot) | mirror Phase 04 D2 on a DEDICATED slot/date; rename then assert print output unchanged; RESTORE in finally | snapshot-not-live fetch + sandbox not poisoned | — |
| Fully-automated | Auth-guard covers print PAGES (`export default async function`) | `auth-guard-coverage.test.ts` new page-grep path asserts every `/print` page calls requireAuth | page-level guard coverage | runtime redirect |
| Fully-automated | Unauth request to `/print/**` → `/login` redirect | Playwright logged-out probe | route protection | — |
| Fully-automated | Weight footer BLANK (not 0) when factorMap empty | assert weight cells render label + empty value, never "0 กก." | blank≠zero | filled-factor values (Q22) |
| Fully-automated | Per-shop `.sheet` count + `break-after: page` | assert count == selected shops + break rule | pagination | layout |

**Area: PDF + visual (hybrid / agent-probe / known-gap)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Test-side `page.pdf({preferCSSPageSize:true})` → valid A4-landscape PDF | precondition: playwright + fonts.ready; assert magic bytes + page size | Chromium PDF pipeline works | server route (deferred) |
| Agent-probe | Combined sheet visually matches the scan | screenshot at A4 viewport vs `Scan2026-07-04_170934.pdf`; agent judges grid/divider/totals/footer | layout fidelity | printer-exact mm |
| Known-gap | Shading fidelity (Q30) + weight-footer values (Q22) | — | — | Unanswered customer questions — documented, additive CSS layer + blank labels ready |

Visual fidelity is agent-probe (a proving strategy, recorded with judgment). Shading/weight are documented Known-Gaps pending Q30/Q22 — NOT proving strategies.

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
- 22 columns cannot fit legibly within the 251mm faithful table width even with abbreviated headers → escalate to a layout decision with the user (RESEARCH single-page fit ≈191mm/194mm was confirmed, so this is unlikely).
- Phase 04 exit gate not met → dependency BLOCKED.

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE — full mm layout spec (251mm table, col widths, heights → single-page fit), totals-row-last-tbody, print fetch drift (getSheetForPrint reads snapshots), footer weight blank-until-Q22 (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — verdict GO (1 CAUTION); Decision Summary (border-only default shading, 251mm, 24+20 col-count gate, extend shared header, PDF deferred-to-backlog, explicit requireAuth + no-nav layout, shared snapshot fetch) written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: DONE — V1–V7 complete; validate-contract CONDITIONAL (0 FAILs, 6 concerns as instructions E1–E7 + 2 documented known-gaps Q30/Q22); written per example-validate-output.md format
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [x] 6. EVL — vc-tester independent re-run 06-07-26: all gates green (vitest 41/41, playwright 16/16, build+lint ✓, migrate clean); route-group deviation URL/auth audit PASS; DB unpolluted (0 RENAMED, restore-in-finally verified); follow-up stubs registered; EVL HANDOFF SUMMARY written to phase report; harness/phase-05/verification.json written; status → ✅ VERIFIED
- [x] 7. UPDATE PROCESS — phase report written; umbrella state updated (Phase 05 → ✅ VERIFIED, current phase → 06); context docs updated (all-context.md, tests/all-tests.md); validators run; commit routed to orchestrator (this session does not commit)

**Validate-contract required before execute.**

---

## Touchpoints

- `src/app/print/layout.tsx`, `src/app/print/daily/[date]/**`, `src/app/print/shops/[date]/**`, `src/styles/print.css`
- `src/lib/get-sheet-for-print.ts`, `src/components/sheet-header.tsx` (extend)
- Backlog NOTE for the deferred server-side `/api/print/**` + `next.config.ts` change

---

## Public Contracts

- Print routes consume the Phase 04 sheet data via the NEW shared `getSheetForPrint(date)` (snapshot columns, never live names) and the Phase 02 `printOrder` contract. No new external API this phase (server-side PDF route deferred to backlog).
- Extends the shared `sheet-header.tsx` with generic optional props — must stay logic-free / print-agnostic so Phase 04 screen usage is unaffected.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| colgroup=24 + data cols=20 + 29 rows + totals from fixture | Fully-Automated | DoD #5 (print combined sheet, faithful structure) — proven by: DOM structure gate |
| Snapshot-render (rename shop → print unchanged) | Fully-Automated | Historical-fidelity contract (Phase-02 dec 6) — proven by: snapshot-render gate |
| One page per shop (`.sheet` count + break-after) | Fully-Automated | DoD #5 (per-shop sheets) — proven by: pagination gate |
| Visual match to scan | Agent-Probe | DoD #5 (match scanned form) — proven by: screenshot agent-probe |
| Test-side `page.pdf()` valid A4 landscape | Hybrid | DoD #5 (Chromium PDF pipeline) — proven by: pdf hybrid gate |
| Shading (Q30) + weight values (Q22) | Known-Gap | documented; additive CSS + blank labels ready |

---

## Test Infra Improvement Notes

- Add Playwright screenshot baselines at A4-landscape viewport for the scan-day fixture so future changes get a visual-regression anchor. Record baseline path in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-05-printing_PLAN_06-07-26.md`
- Last completed step: 3. PLAN-SUPPLEMENT (RESEARCH + INNOVATE folded in)
- Validate-contract status: WRITTEN — CONDITIONAL (0 FAILs; concerns E1–E7 + known-gaps Q30/Q22). PVL step 4 ticked. Do NOT execute until user consents (ENTER EXECUTE MODE).
- Next step: EXECUTE (Step 5) pending user consent. EXECUTE starts with Step A (getSheetForPrint reading snapshot columns + no-nav layout + requireAuth on both print pages), then the 6 fully-automated gates red-first. Honor execute-agent instructions E1–E8 in the Validate Contract.

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

Status: CONDITIONAL
Date: 06-07-26
date: 2026-07-06
generated-by: inner-pvl: phase-05

Parallel strategy: sequential
Rationale: 3/7 signals (S4 phase-program, S6 permission/trust-boundary — print exposes historical order data behind auth, S7 6 blast-radius files) → MEDIUM; but the plan is self-contained and its EXECUTE steps are strictly sequential (fetch → layout → per-shop → gates), so one vc-execute-agent (opus) is the correct fit, not a fan-out. The VALIDATE fan-out itself ran as one Simple-Mode in-agent pass (agent count = 1; no cost guard).


### PVL-supplement cycle 1 (CLOSED)

All 6 CONDITIONAL concerns from the first PVL pass were folded into the plan as explicit **Step E checklist items (E1–E6)** — now plan-tracked (P-type), not instruction-only. Mapping (plan Step E ↔ contract instruction/gate):
- Plan E1 (column-header name source, zero-order cols) ↔ contract E1b / G4-note
- Plan E2 (colgroup ownership + sheet-header additive-only) ↔ contract E2
- Plan E3 (print e2e self-seeds its fixture) ↔ contract E3
- Plan E4 (snapshot-render isolation + RESTORE-in-finally) ↔ contract E4 / G4
- Plan E5 (weight footer BLANK-not-zero) ↔ contract E6 / G11
- Plan E6 (auth page-grep + unauth→/login redirect) ↔ contract E1a / G6 / G8

mm arithmetic slips fixed in the mm Layout Spec (145.0mm rows / ≈190mm total / 252.6mm column sum noted) — contract E5 is now informational (the plan text itself is corrected). Only residuals remaining: Q30 shading + Q22 weight values (external customer questions, documented known-gaps G10/G11).


### Test gates (C3 5-column table)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| G1 (VE#1 / DoD#5) | `<colgroup>` has 24 physical cols AND 20 semantic data cols (printOrder 1–20) | Fully-Automated | Playwright DOM assert on `/print/daily/[date]` with `e2e/.auth/staff.json`: `colgroup > col` count === 24 AND data-column `th`/`col` count === 20 | B |
| G2 (VE#1 / DoD#5) | 29 roster rows (incl. blank gaps) + 3-tier header band + totals row = LAST tbody row with all 20 column totals + grand 446 from `test-fixtures/sheet-13-03-69.json` | Fully-Automated | Playwright DOM assert row count === 29, header tier count === 3, totals-row cells vs fixture `expectedColumnTotals` + `expectedGrandTotal` (446) | B |
| G3 (DoD#5) | `@page { size: A4 landscape }` rule present in the print stylesheet | Fully-Automated | Playwright: assert the `@page` rule with `size: A4 landscape` is present (query `document.styleSheets` cssRules or assert the linked print.css text) | B |
| G4 (VE#2 / Phase-02 dec6) | Snapshot-render: rename a shop in the sandbox DB → print STILL renders the old `shopNameAtEntry` snapshot (mirror Phase-04 D2 isolation) | Fully-Automated | Playwright on a DEDICATED slot+date+location: seed sheet → rename shop via prisma → assert `/print/daily/[date]` output still shows original name → **RESTORE original name in finally** | B |
| G5 (VE#3 / DoD#5) | Per-shop route emits one `.sheet { break-after: page }` per selected shop (single print job) | Fully-Automated | Playwright assert `.sheet` count === selected-shop count AND `break-after: page` computed on each | B |
| G6 (E1 / trust-boundary) | Both print page files call `requireAuth()` explicitly (defense-in-depth; proxy is convenience only) | Fully-Automated | EXTEND `src/lib/__tests__/auth-guard-coverage.test.ts` with a NEW page-level block: read each print page source, assert `/requireAuth\(/` present (parser note: pages are `export default async function`, NOT the `export async function` action shape the existing parser splits on — needs its own grep path, not a MODULES-array append) | B |
| G7 (VE#5 / DoD#5) | Test-side `page.pdf({ preferCSSPageSize: true })` produces a valid A4-landscape PDF | Hybrid | precondition: chromium project (headless — playwright.config uses `devices["Desktop Chrome"]`, no `headless:false`) + `document.fonts.ready`; assert `%PDF` magic bytes + A4-landscape page dimensions. Server-side `/api/print` route stays DEFERRED to backlog | A/B |
| G8 (E1 / trust-boundary) | Logged-out request to `/print/daily/[date]` redirects to `/login` (proves the proxy matcher covers `/print`) | Hybrid | precondition: running server + no storage-state; goto `/print/daily/[date]` → expect redirect to `/login` (variant of the existing `auth.spec.ts` logged-out-redirect test) | A/B |
| G9 (VE#4 / DoD#5) | Combined + per-shop output visually matches the scan (grid / heavy C18/C19 divider / totals band / footer tallies) | Agent-Probe | screenshot at A4-landscape viewport for the 13/3/69 fixture day; agent judges vs `Scan2026-07-04_170934.pdf`; record verdict + diffs | A |
| G10 (VE#6 / Q30) | Shading fidelity — border/weight-emphasis default renders correctly with Background-graphics OFF; semantic fills prepared as an additive CSS layer, OFF by default | (residual) | — behavior (border-only default) proven by G1/G9; final fill colors gap-blocked on customer Q30 | D |
| G11 (VE#6 / Q22) | Weight-footer values — รวมน้ำหนัก/ปี๊บ labels render in position, values BLANK until Q22 factors arrive (never fabricate; never render `computeTotalWeight`'s 0 as a value) | (residual) | — label-in-position-blank behavior proven by G2 structure; numeric values gap-blocked on customer Q22 (`weight-factors_NOTE_06-07-26.md`) | D |

gap-resolution legend: A — proven now · B — gate added by this plan's EXECUTE checklist (red-first) · C — deferred to a later phase · D — backlog test-building stub / named residual.

C-4 reconciliation: the `strategy` column carries only the 3 proving strategies (Fully-Automated / Hybrid / Agent-Probe). Known-Gap (G10/G11) is NOT a strategy — it is a named residual via gap-resolution D.

Legacy line form (retained for existing consumers):
- print markup structure (colgroup 24+20, 29 rows, 3-tier, totals, @page): Fully-automated: Playwright DOM asserts on `/print/daily/[date]` with `e2e/.auth/staff.json`
- snapshot-render fidelity: Fully-automated: rename-shop → assert print unchanged → restore (mirror Phase-04 D2)
- print-page auth: Fully-automated: extend `auth-guard-coverage.test.ts` grep + Hybrid: e2e unauth→/login redirect
- test-side PDF: Hybrid: `page.pdf({preferCSSPageSize:true})` on headless chromium — precondition fonts.ready
- visual fidelity: Agent-probe: screenshot vs `Scan2026-07-04_170934.pdf`
- shading (Q30) + weight values (Q22): known-gap: documented; additive CSS layer + blank labels ready

### Failing stubs (Fully-Automated rows only — TDD red-first for EXECUTE)

```
test("should render colgroup with 24 physical cols and 20 semantic data cols", () => { throw new Error("NOT IMPLEMENTED — TDD stub: colgroup=24 + data=20 on /print/daily/[date]") })
test("should render 29 rows + 3-tier header + totals-last-tbody with column totals and grand 446 from fixture", () => { throw new Error("NOT IMPLEMENTED — TDD stub: 29 rows + 3-tier + totals 446 from sheet-13-03-69.json") })
test("should include an @page A4 landscape rule in the print stylesheet", () => { throw new Error("NOT IMPLEMENTED — TDD stub: @page size A4 landscape present") })
test("should render the old shopNameAtEntry snapshot after the live shop is renamed", () => { throw new Error("NOT IMPLEMENTED — TDD stub: snapshot-render gate, rename then assert unchanged then restore") })
test("should emit one .sheet with break-after page per selected shop", () => { throw new Error("NOT IMPLEMENTED — TDD stub: per-shop .sheet count + break-after page") })
test("should assert every print page source calls requireAuth", () => { throw new Error("NOT IMPLEMENTED — TDD stub: print-page requireAuth grep in auth-guard-coverage.test.ts") })
```

### Dimension findings

- Infra fit: PASS — single Next 16 app, no container/port/runtime surface added; server-side PDF route correctly deferred to backlog; `/print` already inside the `src/proxy.ts` matcher (guarded, not excluded); playwright.config `workers:1` + `fullyParallel:false` share ONE sandbox DB (bears on isolation, see E4).
- Test coverage: CONCERN — 6 fully-automated + 2 hybrid + 1 agent-probe gates cover all developed behavior; two residuals (Q30/Q22) are external-customer-question known-gaps, not silent. Concerns: (a) the "extend auth-guard-coverage" claim needs a NEW page-grep code path (existing parser only handles `export async function` action exports, not `export default async function` pages); (b) fixture dependency chain for the print sheet is unpinned (see E3).
- Breaking changes: CONCERN — `sheet-header.tsx` extension MUST stay additive/logic-free so the Phase-04 orders screen (2-tier) is unchanged; the full existing suite (39 vitest + 9 playwright) is the mandatory regression gate. `<colgroup>` cannot live inside the shared `<thead>` component without a structural change (see E2).
- Security surface: PASS — print routes READ historical order data behind the existing proxy matcher + explicit `requireAuth()`; no auth logic, schema, or public API is modified this phase (STRIDE: elevation covered by G6 grep + G8 redirect probe; no new trust boundary).
- Section A (fetch/auth/layout) feasibility: CONCERN — `getSheetForPrint` mechanically feasible (reads snapshot columns per OrderLine/NoteLine, mirrors the `orders/[id]/page.tsx` roster-of-29 loop but from snapshots, NOT live `shop.name`/`variant.name`). Gap: column-HEADER variant-name source for zero-order columns is unspecified (see E1b). `requireAuth()` throws AuthError (error boundary), not a redirect — proxy handles the redirect first, so the page call is belt-and-suspenders (see E1c).
- Section B (mm layout) feasibility: CONCERN — highest-risk edit is the `sheet-header.tsx` extension (backward-compat) + the mm `<colgroup>` placement; mm per-column values are arithmetically correct (verified against REF percentages: 9.8/28.8/7.1/6.8/23.8mm), but the roll-up labels have transcription slips (see E5).
- Section C (per-shop / PDF) feasibility: PASS — per-shop `.sheet` + `break-after:page` in a single job is standard; PDF fallback correctly deferred to backlog with test-side `page.pdf()` as the gate.

### Execute-Agent Instructions

- E1a — Both print page files (`src/app/print/daily/[date]/page.tsx`, `src/app/print/shops/[date]/page.tsx`) MUST call `requireAuth()` explicitly at the top (proxy matcher is convenience, not the boundary — `auth/all-auth.md`).
- E1b — Pin the column-HEADER variant-name source: use `variantNameAtEntry` when ≥1 OrderLine for that printOrder exists on the date; else fall back to live `ProductVariant.name` by printOrder (a zero-order column has no snapshot). Document the fallback in the phase report. The snapshot-render gate (G4) tests SHOP-row names; the header fallback is a documented boundary, not a fidelity regression.
- E1c — `requireAuth()` throws AuthError (→ Next error boundary), NOT a redirect. The unauth→/login redirect UX is provided by `src/proxy.ts` (which matches `/print`). If a graceful in-page redirect is wanted, catch AuthError → `redirect("/login")`. Do not rely on the throw for UX.
- E2 — Keep `sheet-header.tsx` logic-free / print-agnostic (Decision 4 + Public Contracts). Add ONLY an optional `subLabel`/3rd-tier prop, DEFAULTING OFF so the Phase-04 2-tier screen usage is byte-identical. The mm `<colgroup>` is print-specific and must NOT go into the shared component — the print route emits its own `<colgroup>` (mm widths from the mm Layout Spec / print.css). Rationale: `<colgroup>` must be a direct `<table>` child before `<thead>`, and putting mm logic in the shared component contradicts "no print-specific logic."
- E3 — Pin the fixture dependency chain: the print e2e MUST seed its OWN 13/3/69 sheet directly via prisma in `beforeAll` (from `test-fixtures/sheet-13-03-69.json` cells, writing `shopNameAtEntry`/`variantNameAtEntry` snapshots) on a DEDICATED date+location (e.g. "E2E-PRINT"). Do NOT depend on `orders.spec.ts` D1 having run first (ordering coupling — fragile) and do NOT re-enter via the slow grid UI. [auto-selected: conservative — self-contained seed]
- E4 — The snapshot-render gate (G4) MUST use Phase-04 D2 isolation EXACTLY: a dedicated roster slot NOT in the D1/print fixture, a dedicated date, rename via prisma, assert, then **RESTORE the original name in a `finally`/cleanup step** (`prisma.shop.update({... name: originalName})`). One shared sandbox DB (workers:1) means an un-restored rename poisons later specs. [auto-selected: conservative — restore mandatory]
- E5 — Use the per-column mm values verbatim from the mm Layout Spec (they are correct). Ignore the two roll-up transcription slips: column sum is 252.6mm (not the "≈251mm" label — still ≤281mm usable, ~28mm right blank margin, faithful); "29 rows × 5.0mm = 146mm" should be 145.0mm (total ≈190mm, not 191). Single-page fit holds either way (≤194mm usable).
- E6 — Weight footer: render the รวมน้ำหนัก/ปี๊บ LABELS in position but leave VALUES BLANK when no factor map exists. Do NOT call `computeTotalWeight` with an empty map and render its `0` — 0 is a fabricated value; blank is required (Decision 5; `weight-factors_NOTE_06-07-26.md`). Yellow 24/21 NEVER rendered.
- E7 — Regression gate (mandatory before EVL): full `pnpm test` (39 vitest) AND full `pnpm exec playwright test` (9 e2e incl auth + orders D1/D2) MUST stay green after the `sheet-header.tsx` extension.
- E8 — Sandbox `orderstock-sql` DB only; do not touch a customer/remote DB; do not stop/restart the 9 unrelated Docker containers; no git commit/push without user instruction.

### Backlog Artifacts

| Artifact | Location | What it tracks |
|---|---|---|
| server-side PDF fallback NOTE (write at EXECUTE C2) | process/features/order-system/backlog/print-pdf-fallback_NOTE_06-07-26.md | Deferred `/api/print/daily/[date].pdf` + `next.config.ts` serverExternalPackages — rationale: no confirmed escalation trigger |
| shading-Q30 NOTE (write at EXECUTE) | process/features/order-system/backlog/print-shading-q30_NOTE_06-07-26.md | Semantic fills (header cream / totals salmon / footer green) gated on customer Q30; additive CSS layer ready to flip |
| weight-factors_NOTE_06-07-26.md (pre-existing) | process/features/order-system/backlog/weight-factors_NOTE_06-07-26.md | Per-variant weightKg factors unknown until Q22 — printed weight values blank until then |

### Open gaps

- Q30 shading fidelity: known-gap: documented as external customer question — additive CSS fill layer prepared, OFF by default (border/weight-emphasis default renders now).
- Q22 weight-footer values: known-gap: documented as external customer question — labels render in position, values blank; math shape shipped via `computeTotalWeight`.

### What this coverage does NOT prove

- G1/G2/G3/G5/G6 (Playwright DOM + vitest grep): prove DOM structure, counts, totals arithmetic, and the presence of the `@page` rule and `requireAuth` call — they do NOT prove pixel-level visual fidelity, printer output, or that the browser's actual paginated print looks like the scan (that is G9 agent-probe).
- G4 (snapshot-render): proves SHOP-row names come from snapshots, not live names — it does NOT prove the column-HEADER variant-name fallback (E1b) for zero-order columns.
- G7 (test-side page.pdf): proves the Chromium PDF pipeline yields a valid A4-landscape PDF in headless test — it does NOT prove a server-side `/api/print` route (deferred to backlog) nor real-printer output.
- G8 (unauth redirect): proves the proxy matcher redirects logged-out `/print` requests — it does NOT prove the in-page `requireAuth()` throw path (unreachable for normal unauth because proxy intercepts first; E1c).
- G9 (agent-probe visual): a recorded human/agent judgment against the scan — it does NOT prove printer-exact millimetre placement.
- G10/G11 (known-gaps): the border-only default + blank-label behavior is proven; the final shading fills and weight numbers are NOT proven (gap-blocked on customer Q30/Q22).

Gate: CONDITIONAL (0 FAILs; 6 concerns FOLDED INTO THE PLAN as explicit Step E checklist items E1–E6 via PVL-supplement cycle 1 [1 recorded fix cycle] + honored as execute-agent instructions E1a–E8; only 2 external-customer known-gaps Q30/Q22 remain as documented residuals; user away — auto-accepted for override before EXECUTE)
Accepted by: session (autonomous, /goal execution) — accepted concerns: [test-coverage: auth-grep needs page-grep path (E1a/G6); test-coverage: fixture dependency chain pinned to self-seed (E3); breaking-changes: sheet-header additive+regression gate (E2/E7); Section-A: column-header name fallback (E1b) + requireAuth-throws-not-redirect (E1c); Section-B: colgroup placement (E2) + mm roll-up transcription slips (E5); weight 0≠blank (E6)]. All auto-selected conservatively; flagged for user override before ENTER EXECUTE MODE.
