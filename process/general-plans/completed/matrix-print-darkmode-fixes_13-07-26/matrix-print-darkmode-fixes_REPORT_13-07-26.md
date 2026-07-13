---
phase: matrix-print-darkmode-fixes
date: 2026-07-13
status: COMPLETE_WITH_GAPS
feature: general
plan: process/general-plans/completed/matrix-print-darkmode-fixes_13-07-26/matrix-print-darkmode-fixes_PLAN_13-07-26.md
---

# matrix-print-darkmode-fixes — UPDATE PROCESS Closeout

## What Was Done

Three targeted UI/print fixes shipped in commit `c87dccc` (main, pushed):

1. **Dark-mode contrast** — added `--surface-focus` token (light + `[data-theme="dark"]`) and
   replaced `focus:bg-white` on the qty-cell and row-notes inputs in `order-matrix.tsx`. Added a
   `--seasoning-band` / `--seasoning-band-fg` token pair and swapped the เครื่องปรุง band's raw
   `backgroundColor: "var(--amber-800)"` + hardcoded `text-white` for the new tokens.
   `--amber-800`'s own value is untouched (still consumed by `chip.tsx`'s accent variant).
2. **Print one-page fit** — `.print-footer` note-tally now lays out in 4 CSS columns at 7pt with a
   narrowed `.weight-col`, so the combined daily sheet (13-note fixture) fits one A4 landscape page
   with all notes kept (no truncation). New e2e gate G9 asserts the rendered `page.pdf()` output is
   exactly 1 page (190.2mm actual vs 194mm usable budget).
3. **รอยืนยัน badge removed** — the `needsConfirmation` badge `<span>` block removed from
   `/shops` and `/products` list pages. Field, Prisma schema, and `correction-cascade.ts` logic
   untouched — display-only change.

Gates run (per commit message + plan's Verification Evidence table): 70 unit tests, lint, build,
Playwright 40 tests incl. `[setup]` (39 excl.) incl. new G9 — all green.

## What Was Skipped/Deferred

- Real Chrome print-preview visual confirmation (AC3-final) — Agent-Probe, not re-run in this
  UPDATE PROCESS session (no browser/dev-server session available). → backlog NOTE.
- Dark-mode qty-cell keying visibility (AC1) and seasoning-band contrast (AC2) real-device/browser
  visual confirmation — Agent-Probe, not re-run this session. → backlog NOTE.
- These three rows were already flagged in the plan's own Validate Contract as Agent-Probe-only;
  this closeout does not newly discover them, it carries them forward as pending-manual residuals.

## Test Gate Outcomes

| Gate | Result | Command |
|---|---|---|
| Unit suite | GREEN (70 tests / 14 files) | `pnpm test` |
| Lint | GREEN | `pnpm lint` |
| Build | GREEN | `pnpm build` |
| Playwright full suite | GREEN (40 incl. `[setup]` / 39 excl.) | `pnpm exec playwright test` |
| New G9 (print one-page-fit, PDF page-count) | GREEN | `pnpm exec playwright test e2e/print.spec.ts` |

All from the EXECUTE session per the commit message; not independently re-run in this UPDATE
PROCESS session (documentation/archival only per the handoff scope — no DB/build re-invocation
requested).

## Plan Deviations

None. Implementation matches the plan's Touchpoints/Blast Radius exactly — `git show c87dccc
--stat` confirms exactly the 6 files listed in the plan's Blast Radius (`order-matrix.tsx`,
`globals.css`, `print.css`, `shops/page.tsx`, `products/page.tsx`, `e2e/print.spec.ts`), no more,
no less.

## Test Infra Gaps Found

None new. The plan's own "Test Infra Improvement Notes" gap (no existing spec directly asserting
`/shops`/`/products` page content) was closed by this plan's own checklist (AC4's new/extended
Playwright assertion, part of the 39 e2e count) — not a residual gap.

## SPEC Achievement

No SPEC file exists for this plan (Simple plan, no phase program — `Charter + umbrella plan: N/A`
per the plan's own Autonomous Goal Block). Acceptance criteria were plan-native (AC1–AC6):

| Criterion | Status | Note |
|---|---|---|
| AC1 (dark-mode qty focus legible) | **unmet** (residual) | Agent-Probe only, not re-run this session → backlog NOTE |
| AC2 (seasoning band contrast) | **unmet** (residual) | Agent-Probe only, not re-run this session → backlog NOTE |
| AC3 (print 1-page, notes kept) | **met** | Fully-Automated G9 gate green (per commit) |
| AC3-final (real print-preview) | **unmet** (residual) | Agent-Probe only, not re-run this session → backlog NOTE |
| AC4 (badge removed, rows intact, data unchanged) | **met** | Fully-Automated Playwright assertion + correction-cascade unit test |
| AC5 (no regression: unit/lint/build) | **met** | 70/lint/build green |
| AC6 (existing Playwright suites green) | **met** | Full suite green (39 excl. setup) |

Per the vacuous-green ban: AC1/AC2/AC3-final are NOT claimed "met" — they rest on Agent-Probe
residuals only, so the plan is classified `✅ VERIFIED at code level` (not blanket VERIFIED) and 3
backlog NOTEs are written for the pending-manual visual confirmations.

## Closeout Packet

1. **Selected plan path:** `process/general-plans/active/matrix-print-darkmode-fixes_13-07-26/matrix-print-darkmode-fixes_PLAN_13-07-26.md` (archiving to `completed/` this session)
2. **Closeout classification:** Ready for UPDATE PROCESS archival — validate-contract present (`Gate: PASS`), all Fully-Automated/Hybrid criteria met, 3 Agent-Probe residuals explicitly documented as backlog NOTEs (not blocking archival per plan-lifecycle: code-complete + all automated gates green + residuals tracked).
3. **What was finished:** see "What Was Done" above.
4. **Verified vs unverified:** Verified — unit/lint/build/Playwright incl. new G9 (Fully-Automated, per commit). Unverified — 3 Agent-Probe visual confirmations (AC1, AC2, AC3-final).
4b. **Validate-contract compliance:** VALIDATE was run; `## Validate Contract` present inline in the plan, `Gate: PASS` (0 FAILs, 0 unresolved CONCERNs after 3 direct plan-text fixes P1-P3 during VALIDATE).
5. **Cleanup done vs still needed:** Done this session — plan archived, stray duplicate context file removed, `uxui/all-uxui.md` + `tests/all-tests.md` + `all-context.md` updated with new tokens/gate/counts, 3 backlog NOTEs written, memory updated, process commit made. Nothing else outstanding for this plan.
6. **Single best next valid state:** Session complete for this fix set. The 3 backlog NOTEs (Agent-Probe residuals) are the only follow-up, resolvable on the next session with a live browser/dev-server available — no new plan needed, just a manual verification pass.
7. **Commit-checkpoint recommendation:** N/A — the execution commit (`c87dccc`) already happened before this UPDATE PROCESS session per the handoff. This session's changes (plan archival, context docs, backlog notes, memory) form the process commit, made at the end of this session.
8. **Regression status:** N/A — single-plan session, not a phase program; no prior-phase overlapping surfaces to regression-check.
9. **SPEC achievement:** see "SPEC Achievement" section above — no SPEC file for this plan; plan-native AC1-AC6 scored, 4/6 met (AC1/AC2/AC3-final unmet, tracked as backlog NOTEs).

**Drift score:** MEDIUM (3 signals — (a) 6 files touched in the EXECUTE commit; (c) 3+ memory-worthy
observations this session: new dark-mode focus-trap gotcha, new print-footer 4-col-fit CSS pattern,
badge-removal precedent; (d) feature-folder structural change: task folder archived active→completed
this session). Recommend UPDATE PROCESS -- significant changes detected.

**Next valid state:** No further action required for this fix set. Backlog NOTEs cover the 3
Agent-Probe residuals for a future manual-verification pass.
