---
name: plan:matrix-print-darkmode-fixes
description: "3 targeted UI/print fixes — dark-mode invisible qty input + muddy seasoning band, print footer 1-page overflow, hide รอยืนยัน badge"
date: 13-07-26
feature: general
---

# matrix-print-darkmode-fixes — Implementation Plan

**Date**: 13-07-26
**Complexity**: Simple
**Status**: ✅ VERIFIED at code level (13-07-26, commit c87dccc) — Fully-Automated gates green
(70 unit, lint, build, Playwright 40 incl. new G9 one-page-fit gate). 3 Agent-Probe rows
(AC1 dark-mode qty-cell keying visibility, AC2 seasoning-band contrast, AC3-final real Chrome
print-preview) remain pending-manual — not re-verified in this UPDATE PROCESS closeout session
(no browser/dev-server session available). Archived to `completed/` with these residuals
documented; see closeout packet in the phase report.

Context: `process/context/all-context.md` (root router) → `process/context/uxui/all-uxui.md`
(pguard tokens, dark-mode overrides, print mm contract) and `process/context/tests/all-tests.md`
(Vitest + Playwright routing) were read before drafting this plan; see Verification Evidence and
Test Infra Improvement Notes below for the resulting test-tier assignments (fully-automated,
hybrid where applicable, and agent-probe).

## Overview

Three small, independent bug fixes surfaced by the user while using the order-matrix in dark mode
and printing a daily sheet:

1. Dark-mode contrast: qty-cell input text is invisible while typing (forced white focus
   background + near-white dark-mode text color) and the เครื่องปรุง (seasoning) column-group band
   is muddy/low-contrast in dark mode (raw, non-theme-aware amber value).
2. Print output overflows to a second page when there are more than a few หมายเหตุ notes — must
   fit one A4 landscape page **without removing the notes**.
3. Hide the "รอยืนยัน" (needsConfirmation) badge on `/shops` and `/products` master-data list
   pages — badge only, rows and underlying `needsConfirmation` data stay untouched.

All three are scoped, additive/cosmetic changes. No schema, API, auth, or payload changes.

## Goals

- G1: Typed digits are clearly legible in a dark-mode focused qty cell and row-notes input.
- G2: The เครื่องปรุง band header reads with clear contrast in dark mode (and light mode stays
  visually consistent with the existing สินค้า green band).
- G3: A typical day's combined-sheet print (≤ ~13 หมายเหตุ lines, per the canonical fixture) fits
  on ONE A4 landscape page, with all note lines still rendered — no notes removed or truncated.
- G4: The "รอยืนยัน" badge no longer renders on `/shops` or `/products`; rows for
  `needsConfirmation` shops/products remain fully visible and editable.

## Scope

**In scope:**
- `src/app/(main)/orders/order-matrix.tsx` — `inputCls` (qty cell, line 287-290), row-notes input
  className (line 550), the เครื่องปรุง band style (line 459-464)
- `src/app/globals.css` — add/adjust a theme-aware focus-surface token and/or seasoning-band token
  with light + `[data-theme="dark"]` values
- `src/app/print/print-table.tsx` — note-tally footer render (lines 111-132)
- `src/styles/print.css` — `.print-footer` / `.tally-col` / `.tally-line` layout rules (lines
  124-141+), possibly `@page` margin as a last-resort lever
- `src/app/(main)/shops/page.tsx` — remove/hide the `needsConfirmation` badge block (lines 44-48)
- `src/app/(main)/products/page.tsx` — remove/hide the `needsConfirmation` badge block (lines 53-57)
- `e2e/print.spec.ts` — extend/add a print gate proving the footer fits one page with the 13-note
  fixture

**Out of scope (do NOT touch):**
- Per-row หมายเหตุ notes themselves — must remain fully present, nothing removed
- `src/lib/order-payload.ts` (buildOrderPayload), `src/lib/totals.ts`, `saveOrderSheet` /
  `src/app/(main)/orders/actions.ts`, the 446 grand-total fixture
- `needsConfirmation` field, schema, and `src/lib/correction-cascade.ts` logic — badge-only change,
  data model and cascade behavior are untouched
- The print mm `<colgroup>` widths / column definitions (`print.css` `.print-sheet col.*`) and the
  29-row / 5mm body-row / totals-row-as-last-tbody-row contract
- `src/components/sheet-header.tsx` seasoning-band styling used by print (print renders on white —
  leave print-side seasoning color as-is; this fix is dark-mode UI only)

## Touchpoints

| File | Change |
|---|---|
| `src/app/globals.css` | Add semantic token(s): a theme-aware focus-surface (e.g. `--surface-focus` light/dark) and a theme-aware seasoning-band pair (e.g. `--seasoning-band` / `--seasoning-band-fg` light/dark) |
| `src/app/(main)/orders/order-matrix.tsx` | Replace `focus:bg-white` in `inputCls` (line ~290) and the notes-input className (line ~550) with the new token; replace the seasoning band's inline `backgroundColor: "var(--amber-800)"` (line ~461) with the new token |
| `src/styles/print.css` | Adjust `.print-footer` / `.tally-col` / `.tally-line` to a multi-column layout with tighter font-size/line-height so 13 notes fit in the remaining ~25mm footer headroom |
| `src/app/print/print-table.tsx` | If needed, wrap `noteTally` rendering to split into 2-3 columns (CSS `column-count` is preferred — no JSX restructuring needed if pure CSS multi-column works) |
| `src/app/(main)/shops/page.tsx` | Remove the `{shop.needsConfirmation && <span>...}` badge block; drop now-unused styling if any |
| `src/app/(main)/products/page.tsx` | Remove the `{p.needsConfirmation && <span>...}` badge block; drop now-unused styling if any |
| `e2e/print.spec.ts` | Add/extend a gate: render the daily print with the 13-NoteLine fixture, assert the footer's rendered height (or page-break absence) stays within the single-page budget |

## Public Contracts

None changed. No server actions, API routes, schema fields, or payload shapes are touched. This is
a pure presentational/CSS change plus removal of one UI badge element.

## Blast Radius

- `src/app/globals.css` (SHARED file — additive tokens only, no removal of existing tokens/values)
- `src/app/(main)/orders/order-matrix.tsx` (className/style edits only — no state, no payload logic)
- `src/styles/print.css` (print-only stylesheet)
- `src/app/print/print-table.tsx` (render-only, no data-fetch change)
- `src/app/(main)/shops/page.tsx`, `src/app/(main)/products/page.tsx` (badge removal only)
- `e2e/print.spec.ts` (new/extended test)

No touch to: `prisma/schema.prisma`, any `actions.ts`, `src/lib/totals.ts`, `src/lib/order-payload.ts`,
`src/lib/correction-cascade.ts`, `test-fixtures/sheet-13-03-69.json` (read-only reuse).

## Implementation Checklist

### Fix 1 — dark-mode contrast (qty input legibility + seasoning band)

1. In `src/app/globals.css`, inside the light-mode token block (near `--bg-surface`, line ~115),
   add `--surface-focus: var(--n-0);` (or equivalent light "white-ish" focus surface, matching the
   current light-mode behavior of `focus:bg-white`).
2. In the `[data-theme="dark"]` block (line ~138) and the `prefers-color-scheme: dark` fallback
   block (line ~175), add `--surface-focus: [dark surface value]` — pick a value that contrasts
   `--text: #DCE5E0` clearly (e.g. a slightly lighter/darker shade than `--bg-surface: #121916`,
   such as `#1C2521` or similar — must NOT be white/near-white, and must NOT equal `--text`).
3. Register the new token for Tailwind's `@theme` mapping alongside `--color-bg-surface` (line
   ~254) as `--color-surface-focus: var(--surface-focus);` so `bg-[var(--surface-focus)]` (or a
   Tailwind utility class) works consistently.
4. In `src/app/(main)/orders/order-matrix.tsx`, replace `focus:bg-white` in `inputCls` (line ~290)
   with `focus:bg-[var(--surface-focus)]`.
5. In the same file, replace `focus:bg-white` in the row-notes input className (line ~550) with the
   same `focus:bg-[var(--surface-focus)]`.
6. Add a `--seasoning-band` (background) and `--seasoning-band-fg` (text, likely stays white) token
   pair to `globals.css`: light-mode value equal to the CURRENT `--amber-800` (`#92490E`) so light
   mode is visually unchanged, and a `[data-theme="dark"]` override with a lighter/more-saturated
   amber that contrasts the dark canvas (pick a value with sufficient contrast against
   `--bg-surface` dark and readable white/near-white band text — do not reuse `--text`'s color for
   the band background).
7. In `order-matrix.tsx` line ~461, replace the inline `backgroundColor: "var(--amber-800)"` with
   `backgroundColor: "var(--seasoning-band)"`. ALSO replace the hardcoded `text-white` class on
   this same div (line ~460) with `text-[var(--seasoning-band-fg)]` so the `--seasoning-band-fg`
   token added in step 6 is actually consumed (VALIDATE finding: without this, `--seasoning-band-fg`
   would be a defined-but-unused token). Set `--seasoning-band-fg: #FFFFFF` in both light and dark
   blocks (white text stays correct against either amber value).
8. Grep for other usages of `--amber-800` (VALIDATE confirmed 4 hits total: the token definition at
   `globals.css:35`, the Tailwind `@theme` passthrough at `globals.css:236`, `order-matrix.tsx:461`
   (this fix's target), and `src/components/ui/chip.tsx:9`'s "accent" chip variant text color) —
   confirm print-side usage is NOT touched (print renders on white paper; only the dark-mode LIVE
   UI usage in `order-matrix.tsx` should switch to the new token). `chip.tsx` is UNAFFECTED by this
   fix since `--amber-800`'s own value is never modified (only a new, separate `--seasoning-band`
   token is introduced) — leave `chip.tsx` untouched. `sheet-header.tsx` has no `--amber-800`
   reference (VALIDATE confirmed via grep) — no action needed there.
9. `pnpm build` + visual check (agent-probe) in both light and dark mode: verify qty digits and
   notes-input text are legible while focused, and the seasoning band reads clearly in dark mode
   while staying visually equivalent in light mode.

### Fix 2 — print footer fits one page (notes kept)

10. Read `e2e/print.spec.ts` and `test-fixtures/sheet-13-03-69.json` to confirm the current 13-note
    baseline and how the existing print gates assert page-fit (if any).
11. In `src/styles/print.css`, change `.print-footer .tally-col` (line ~133-135) to lay out multiple
    tally lines in 2-3 CSS columns instead of one long vertical list — the simplest lever is CSS
    multi-column (`column-count: 2;` or `3;` with `column-gap`) applied to the tally-col container,
    which requires NO JSX restructuring in `print-table.tsx` since `.tally-line` divs will
    auto-flow into columns. VALIDATE finding: `.tally-col`'s current `min-width: 60mm` is too
    narrow to split into legible columns — the fixture's longest note text is 17 characters
    ("ลานนิม (ใส) 1 กก."), which will wrap or crowd at ~18-20mm per column. WIDEN `.tally-col`
    (e.g. to ~130-150mm) and correspondingly narrow `.weight-col` (its content is only two short
    lines and does not need 60mm) — the footer div has ~281mm of available width (more than the
    252.6mm table), so there is room to reallocate without any other layout change.
12. If multi-column alone isn't enough headroom, additionally reduce `.print-footer` font-size
    (line ~130, currently `8pt`) slightly (e.g. `7pt`) and/or `.tally-line` vertical spacing —
    smallest change that closes the remaining gap. Do NOT touch `@page` margin unless columns +
    font-size are insufficient; if margin trim is needed, justify the exact mm reduction and
    confirm it doesn't clip the existing 8mm printer-safe margin rationale (print.css line 17).
13. If CSS-only multi-column doesn't render acceptably (e.g. large content still spills), fall back
    to wrapping the `noteTally.map(...)` render in `print-table.tsx` (lines 117-122) in a
    2-3-column CSS grid/flex split computed from `noteTally.length` — only if step 11's pure-CSS
    approach is insufficient. Prefer CSS-only first.
14. Re-verify the mm `<colgroup>` widths, the 29-row table, and the totals-row-as-last-tbody-row
    contract are UNCHANGED — this fix touches only the footer block below the table.
15. Verify BOTH print routes (`/print/daily/[date]`, `/print/shops/[date]`) render the adjusted
    footer correctly (per-shop sheets typically have far fewer notes per shop, so they were likely
    already fine — confirm no regression).

### Fix 3 — hide รอยืนยัน badge (badge only)

16. In `src/app/(main)/shops/page.tsx`, remove the `{shop.needsConfirmation && (...)}` block (lines
    44-48), leaving `{shop.name}` alone. Confirm no other reference to `needsConfirmation` in this
    file needs updating (check imports/unused vars after removal).
17. In `src/app/(main)/products/page.tsx`, remove the `{p.needsConfirmation && (...)}` block (lines
    53-57), leaving the `isOffList` "นอกรายการ" badge and `{p.name}` untouched. Confirm no unused
    imports remain.
18. Confirm `needsConfirmation` field, its Prisma schema definition, and
    `src/lib/correction-cascade.ts` are UNTOUCHED — grep both files post-edit to ensure only the
    JSX badge blocks were removed, nothing else.
19. Rows for shops/products with `needsConfirmation = true` still render fully (name, status,
    actions) — verify visually that removing the badge doesn't collapse the row layout.

### Final verification

20. Run `pnpm lint`, `pnpm test`, `pnpm build` — all green, no new failures.
21. Run the Playwright print suite (`e2e/print.spec.ts`) including the new/extended one-page-fit
    gate — green.
22. Run the auth/orders/settings/summary-history/mobile Playwright suites unaffected by this change
    as a regression spot-check (or full `pnpm exec playwright test` if time allows) — confirm no
    incidental breakage from the `globals.css` token additions.

## Acceptance Criteria

- AC1 (G1): In dark mode, clicking/focusing a qty cell shows a background that is NOT white and
  NOT equal to the text color — typed digits are visibly legible against it. Light mode focus
  behavior is visually unchanged from before this fix.
- AC2 (G2): In dark mode, the เครื่องปรุง band header text is clearly legible against its
  background (adequate contrast). Light mode seasoning band renders identically to before this fix.
- AC3 (G3): Printing the combined daily sheet with the canonical 13-NoteLine fixture produces
  exactly one physical page (no page-2 spillover) with ALL 13 note lines still rendered (none
  removed, none truncated with "..."). Per-shop print sheets are unaffected.
- AC4 (G4): `/shops` and `/products` list pages no longer show any "รอยืนยัน" badge, for any row.
  All rows (including those with `needsConfirmation = true`) render fully with name, status, and
  action links intact. `needsConfirmation` field/schema/cascade behavior is unchanged (verified by
  existing `correction-cascade` tests staying green).
- AC5: `pnpm test`, `pnpm lint`, `pnpm build` all pass with no new failures.
- AC6: Existing Playwright suites (auth, orders, print, settings, summary-history, mobile) remain
  green.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm test` (unit suite, 70 tests — confirmed current baseline at VALIDATE; plan's earlier "99 tests" figure was stale, sourced from a duplicate context file) | Fully-Automated — `pnpm test` | AC5 — no regression in existing unit coverage |
| `pnpm lint` | Fully-Automated — `pnpm lint` | AC5 — no lint violations introduced |
| `pnpm build` | Fully-Automated — `pnpm build` | AC5 — TypeScript/Next build succeeds |
| `e2e/print.spec.ts` — existing 7 print gates | Fully-Automated — `pnpm exec playwright test e2e/print.spec.ts` | AC3 (partial: colgroup/29-row/totals-row/@page unchanged), AC6 |
| NEW: print footer one-page-fit gate (13-note fixture) | Fully-Automated — new/extended assertion in `e2e/print.spec.ts`; VALIDATE recommends asserting the ACTUAL rendered `page.pdf()` PAGE COUNT (e.g. counting `/Type /Page` object occurrences in the returned PDF byte buffer, no new dependency needed) rather than a DOM-height heuristic, since on-screen flow height and Chromium's `@page` print pagination are computed by different layout passes and a DOM-height proxy could diverge from the actual printed page count; proven by: `print footer PDF output is exactly 1 page` — strategy: Fully-Automated | AC3 — footer fit with notes preserved |
| `e2e/auth.spec.ts`, `e2e/orders.spec.ts`, `e2e/settings.spec.ts`, `e2e/summary-history.spec.ts`, `e2e/mobile.spec.ts` | Fully-Automated — `pnpm exec playwright test` (full suite) | AC6 — no regression outside the 3 fix areas |
| `src/lib/__tests__/correction-cascade.test.ts` (existing) | Fully-Automated — part of `pnpm test` | AC4 — `needsConfirmation` cascade logic unchanged |
| Dark-mode qty-cell keying visibility on a real device/browser | Agent-Probe — manually focus a qty cell in dark mode, confirm typed digits are legible; proven by: `agent visually confirms non-white non-text-colored focus background with legible digits` — strategy: Agent-Probe | AC1 |
| Seasoning-band contrast check (dark + light) | Agent-Probe — visually inspect the เครื่องปรุง band header in both themes; proven by: `agent visually confirms adequate contrast in dark, unchanged appearance in light` — strategy: Agent-Probe | AC2 |
| Actual one-page print output via Chrome print preview | Agent-Probe — open `/print/daily/[date]` in a real browser, trigger print preview, confirm single page with all notes visible; proven by: `agent visually confirms 1-page output with 13 notes rendered` — strategy: Agent-Probe | AC3 (final confirmation beyond the automated height-budget gate) |
| Badge absence + row completeness on `/shops`, `/products` | Fully-Automated — Playwright assertion (extend an existing or add a lightweight spec asserting no `รอยืนยัน` text node + row count unchanged) OR Agent-Probe if no existing spec covers these pages; proven by: `no รอยืนยัน text present; row count matches shop/product count` — strategy: Fully-Automated (preferred) | AC4 |

## Test Infra Improvement Notes

No existing Playwright spec directly asserts `/shops` or `/products` page content — if none is
found during EXECUTE, add a minimal new spec (or extend an existing settings/admin-adjacent spec)
asserting badge absence and row completeness, rather than relying solely on agent-probe for AC4.
This closes a small pre-existing coverage gap at those two pages.

## Risks

- **Token contrast tuning risk (Fix 1):** picking exact hex values for `--surface-focus` and
  `--seasoning-band` dark-mode variants requires visual judgment — mitigated by the Agent-Probe
  gates above; if the first pass isn't legible enough, iterate the hex value before closing EXECUTE.
- **Print footer CSS risk (Fix 2):** CSS multi-column (`column-count`) can behave inconsistently
  across Chromium print-rendering vs on-screen preview — verify specifically in Chromium (the
  documented target browser per `docs/deployment-guide.md`), and prefer the incremental fallback
  path (step 13) if pure CSS columns don't reliably control print pagination.
- **Shared token risk:** `globals.css` is a SHARED file — additions must be strictly additive (new
  token names only) to avoid touching any other component that reads existing tokens.

## Dependencies

None — all three fixes are independent of each other and can be implemented/verified in any order
within a single EXECUTE pass.

## Resume and Execution Handoff

- Selected plan: this file.
- No VALIDATE skip — plan spans multiple files across dark-mode CSS tokens and print layout;
  run VALIDATE before EXECUTE per standard gate (not a trivial single-file change).
- EXECUTE should implement Fix 3 first (smallest, zero-risk), then Fix 1, then Fix 2 (requires the
  most visual iteration), running the relevant test gate after each fix per the
  "per-section test-gate loop" rule.
- If the print footer one-page-fit gate proves difficult to assert deterministically in Playwright,
  document the gap and rely on the Agent-Probe "Chrome print preview" gate as the primary proof for
  AC3, noting this explicitly in the phase report.

## Phase Completion Rules

This is a SIMPLE plan (single EXECUTE pass, no phase program). Completion rule: the plan is
`✅ VERIFIED` only when all Acceptance Criteria (AC1–AC6) are proven per the Verification Evidence
table AND the Validate Contract gate below is PASS or an explicitly accepted CONDITIONAL. Code-only
completion (implementation done, gates not yet run) is `CODE DONE`, not `VERIFIED` — do not mark
this plan VERIFIED until vc-tester's EVL confirmation run is green.

## Validate Contract

Status: PASS
Date: 13-07-26
date: 2026-07-13
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: 0/7 signals present (single-package, no schema/API/auth surface, 1 direction, not a
phase program, no depth request, no high-risk class, blast radius = 6 files) — a single
vc-validate-agent read-only pass was sufficient; no fan-out spawn needed.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | Dark-mode qty-cell focus background is legible (not white, not text-color) | Agent-Probe | Focus a qty cell in dark mode; confirm typed digits legible | A |
| AC2 | Seasoning band header text legible in both themes | Agent-Probe | Visually inspect เครื่องปรุง band header dark + light | A |
| AC3 | Combined daily print with 13-note fixture fits 1 physical page, all notes present, none truncated | Fully-Automated | Playwright print suite — new gate asserts the `page.pdf()` output is exactly 1 page (count `/Type /Page` object occurrences in the PDF byte buffer — no new dependency) | B |
| AC3 (final) | Real Chrome print-preview visual confirmation | Agent-Probe | Open `/print/daily/[date]`, trigger print preview, confirm 1 page / 13 notes visible | A |
| AC4 | รอยืนยัน badge absent on /shops, /products; rows fully render; needsConfirmation data/cascade unchanged | Fully-Automated | New/extended Playwright assertion (no รอยืนยัน text node; row count unchanged) plus the existing correction-cascade unit test | B |
| AC5 | No regression: unit/lint/build all green | Fully-Automated | unit test suite (70 tests — confirmed baseline), lint, build | A |
| AC6 | Existing Playwright suites (auth/orders/print/summary-history/mobile/sidebar) stay green | Fully-Automated | full Playwright suite (39 tests / 8 files, incl. `[setup]`) | A |

gap-resolution legend: A — proven now (gate passes in this cycle). B — fixed in this plan (gate
added by this plan's checklist, to be implemented in EXECUTE).

C-4 reconciliation: `strategy:` carries only Fully-Automated / Agent-Probe for this plan (no
Hybrid rows — nothing here needs a new running-container/live-DB precondition; the sandbox DB is
read-only reused for existing suites, not a new precondition of this plan's own fixes). No
Known-Gap rows — every AC has a proving strategy.

Legacy line form:
- Dark-mode contrast (AC1/AC2): Agent-Probe: focus qty cell + inspect seasoning band, both themes
- Print footer fit (AC3): Fully-automated: Playwright print suite (extended with a PDF page-count assertion) | Agent-Probe: real Chrome print-preview confirmation
- Badge removal (AC4): Fully-automated: new/extended Playwright assertion + correction-cascade unit test
- Regression (AC5/AC6): Fully-automated: unit test suite, lint, TypeScript/Next compile, full Playwright suite

Failing stub (AC3 — new one-page-fit gate):
```
test("should render the combined daily print as exactly 1 PDF page for the 13-note fixture", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: print footer PDF output is exactly 1 page")
})
```

Failing stub (AC4 — badge-absence gate):
```
test("should show no รอยืนยัน text and unchanged row count on /shops and /products", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: no รอยืนยัน text present; row count matches shop/product count")
})
```

Dimension findings:
- Infra fit: PASS — all 9 touchpoint/read files confirmed present on disk (globals.css,
  order-matrix.tsx, print.css, print-table.tsx, shops/page.tsx, products/page.tsx, print.spec.ts,
  sheet-13-03-69.json, sheet-header.tsx); no container/infra/runtime surface touched.
- Test coverage: PASS (after plan fix) — plan's Verification Evidence cited a stale "99 tests"
  baseline (sourced from a duplicate/stray context file `process/context/tests/all-tests 2.md` —
  see Open Gaps); VALIDATE confirmed the real current baseline by running the unit suite = **70
  tests / 14 files, all green**, and listing the Playwright suite = **39 tests / 8 files** (38
  excl. `[setup]`), matching the canonical `all-tests.md`. Plan text corrected in-place (see Plan
  Updates Applied).
- Breaking changes: PASS — no schema, server action, API route, or payload shape touched; grep
  confirmed `needsConfirmation` field/schema/`correction-cascade.ts` untouched by the badge-removal
  edits (only the display `<span>` blocks are removed).
- Security surface: PASS — zero auth/session/secret/trust-boundary surface; pure CSS-token +
  one-badge-removal change. No STRIDE/OWASP vector introduced.
- Fix 1 — dark-mode contrast: PASS (after plan fix) — mechanical feasibility confirmed exact
  (`focus:bg-white` at order-matrix.tsx:290/550, `backgroundColor: "var(--amber-800)"` at line 461,
  all byte-exact to the plan's line citations). Gap found + fixed: step 6 defined a
  `--seasoning-band-fg` token that step 7 never wired into the className (hardcoded `text-white`
  would have made it dead) — plan step 7 now also swaps the className to
  `text-[var(--seasoning-band-fg)]`. Additional `--amber-800` consumer found (`chip.tsx:9`, an
  "accent" chip variant) — confirmed harmless since this plan never modifies `--amber-800`'s own
  value, only introduces a new sibling token; plan step 8 updated to name this explicitly so
  EXECUTE isn't surprised by the 4th grep hit.
- Fix 2 — print footer one-page-fit: PASS (after plan fix, highest-risk section) — recomputed the
  page-fit arithmetic independently: usable page height 194mm (A4 landscape, 8mm @page margins)
  minus title (~7mm) + 3-tier header (15mm, since `print-table.tsx` always sets a `subLabel`,
  forcing `hasSubLabels=true`) + 29 body rows (145mm) + totals row (5mm) + border (~1.5mm) ≈
  173.5mm fixed, leaving **~20.5mm** headroom for the footer — TIGHTER than the plan's own ~23-28mm
  estimate. Current single-column footer would need ~47mm for 13 notes (confirms the bug is real).
  Gap found + fixed: `.tally-col`'s `min-width: 60mm` is too narrow to split into 3 legible
  columns given the fixture's longest note text (17 chars, "ลานนิม (ใส) 1 กก."); plan step 11 now
  instructs widening `.tally-col` (reallocating from `.weight-col`, which needs far less than
  60mm) — the footer has ~281mm available (vs. the table's 252.6mm), so there is room. Also
  recommended (Verification Evidence row updated): the new automated gate should assert the
  ACTUAL `page.pdf()` page count, not a DOM-height heuristic, since Chromium's on-screen flow
  layout and `@page` print pagination are separate layout passes.
- Fix 3 — badge removal: PASS — both `needsConfirmation` JSX blocks are isolated inline `<span>`s
  inside an existing `<td>`, no imports/icons tied to them, no layout-collapse risk; the Prisma
  query already fetches `needsConfirmation` implicitly (no `select` clause) so removing the badge
  doesn't touch data-fetching. Lowest-risk section, confirmed as planned.

Plan Updates Applied (P1-P3, applied directly to the plan file during this VALIDATE pass):
- P1: Verification Evidence — corrected the stale "99 tests" unit-suite figure → confirmed 70-test
  current baseline, with a note on the stale source.
- P2: Fix 1 checklist step 7 — wire `--seasoning-band-fg` into the className instead of leaving it
  unused; step 8 — name the 4th `--amber-800` grep hit (`chip.tsx`) explicitly as harmless.
- P3: Fix 2 checklist step 11 — widen `.tally-col` / narrow `.weight-col`; Verification Evidence —
  recommend PDF-page-count assertion over a DOM-height heuristic for the new one-page-fit gate.

What this coverage does NOT prove:
- The unit/lint/compile gates prove no regression in EXISTING logic — they do not exercise the
  new dark-mode token values or the print footer layout themselves (those are CSS/visual, outside
  the unit runner's reach).
- The new Playwright one-page-fit gate (once implemented per AC3) proves the 13-note fixture fits
  1 PDF page in the AUTOMATED test environment — it does NOT prove real-printer mm fidelity or
  behavior for a day with MORE than 13 notes (out of this plan's stated scope: "≤ ~13 หมายเหตุ
  lines, per the canonical fixture").
- Agent-Probe rows (AC1, AC2, AC3-final) prove visual legibility/contrast AT THE TIME OF THE PROBE
  in the probing agent's rendering context — they do not constitute an automated visual-regression
  baseline for future changes (pre-existing repo-wide gap, not introduced by this plan).
- Badge-removal gates prove absence of the รอยืนยัน text node and unchanged row count — they do
  not re-prove the full `needsConfirmation`/correction-cascade business logic (already covered by
  the untouched `correction-cascade.test.ts`).

Open gaps:
- Stray duplicate context file `process/context/tests/all-tests 2.md` (older content, cites the
  stale 99-test/17-file baseline) exists alongside the canonical `process/context/tests/all-tests.md`
  (correct 70-test/14-file baseline) in `process/context/tests/`. This is OUT OF SCOPE for this
  plan (pure context-hygiene, unrelated to the 3 UI/print fixes) but should be flagged for UPDATE
  PROCESS / context-audit cleanup on this or a future session — the stray file is a likely source
  of the P1 stale-count finding above and could mislead a future agent that discovers it before
  the canonical file.
- Real on-device printer mm fidelity for the adjusted footer remains agent-probe only (matches the
  plan's own Risks section — accepted).

Gate: PASS (0 FAILs, 0 unresolved CONCERNs after applying P1-P3 plan fixes directly to the plan
file during this VALIDATE pass — see Plan Updates Applied above)
Accepted by: N/A — Gate is PASS, no CONDITIONAL concerns require explicit acceptance (all 3
findings identified during VALIDATE were resolved by direct plan-text fixes P1-P3, not deferred
as accepted residual risk)

## Autonomous Goal Block

SESSION GOAL: Fix 3 targeted UI/print bugs in orderstock — dark-mode qty-cell/seasoning-band
contrast, print footer 1-page overflow (notes kept), hide รอยืนยัน badge on /shops+/products.
Charter + umbrella plan: N/A — single plan, no phase program.
Autonomy: Standard RIPER-5 gates apply (no standing /goal declared for this session). EXECUTE
requires explicit "ENTER EXECUTE MODE". EXECUTE should run Fix 3 → Fix 1 → Fix 2 in that order
(smallest/zero-risk first), running the relevant test gate after each fix.
Hard stop conditions / safety constraints:
- Do not touch `src/lib/order-payload.ts`, `src/lib/totals.ts`, `saveOrderSheet`/`actions.ts`, or
  the 446 grand-total fixture.
- Do not touch the `needsConfirmation` field, its Prisma schema definition, or
  `src/lib/correction-cascade.ts` logic — badge-display-only change.
- Do not touch the print mm `<colgroup>` widths, the 29-row/5mm body-row contract, or the
  totals-row-as-last-tbody-row contract — only the footer block below the table.
- `src/app/globals.css` is a SHARED file — additions must be strictly additive (new token names
  only); never remove or repurpose an existing token value other consumers rely on.
- Never touch the customer/production DB — sandbox SQL Server only.
Next phase: EXECUTE: process/general-plans/active/matrix-print-darkmode-fixes_13-07-26/matrix-print-darkmode-fixes_PLAN_13-07-26.md
Validate contract: inline in plan (this section)
Execute start: unit suite (70 tests) → lint → TypeScript/Next compile (fully-auto) | new print
one-page-fit PDF-page-count gate (fully-auto) | Agent-Probe: dark-mode qty focus + seasoning band
+ real print-preview one-page confirmation | high-risk pack: no

## Next Step

Say **ENTER VALIDATE MODE** when ready to validate this plan before EXECUTE.
