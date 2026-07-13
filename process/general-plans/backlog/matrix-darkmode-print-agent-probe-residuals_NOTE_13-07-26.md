---
name: note:matrix-darkmode-print-agent-probe-residuals
description: "Backlog test-building stub — 3 Agent-Probe-only visual confirmations from matrix-print-darkmode-fixes need a manual pass with a live browser/dev-server"
date: 13-07-26
feature: general
---

# Agent-Probe residuals — matrix-print-darkmode-fixes (13-07-26)

Source plan: `process/general-plans/completed/matrix-print-darkmode-fixes_13-07-26/matrix-print-darkmode-fixes_PLAN_13-07-26.md`
(archived — commit `c87dccc`, all Fully-Automated/Hybrid gates green).

Three acceptance criteria in that plan's Validate Contract were scored Agent-Probe-only and were
NOT re-verified during the EXECUTE or UPDATE PROCESS sessions (no browser/dev-server session
available in either). Per the vacuous-green ban, these are tracked here as unmet residuals rather
than silently marked done.

## Items

1. **AC1 — dark-mode qty-cell focus legibility.** Focus a qty cell in the order-matrix
   (`/orders/[id]`) in dark mode; confirm typed digits are visibly legible against the new
   `--surface-focus` background (not white, not equal to `--text`).
2. **AC2 — seasoning band contrast.** Visually inspect the เครื่องปรุง column-group header band in
   both light and dark mode; confirm the new `--seasoning-band`/`--seasoning-band-fg` tokens read
   clearly in dark mode and are visually unchanged in light mode.
3. **AC3-final — real Chrome print-preview confirmation.** Open `/print/daily/[date]` for a sheet
   using the 13/3/69 canonical fixture (or any day with ~13 หมายเหตุ notes) in a real Chrome/Edge
   browser, trigger print preview, and confirm the output is exactly 1 physical page with all note
   lines visible (none truncated). This is the final human-fidelity check beyond the automated
   `page.pdf()` page-count gate (G9), which is already green.

## Fix

No code fix needed — this is a verification-only gap. Resolve by running the 3 checks above with a
running dev server + browser (`pnpm dev` or `pnpm start`, then visit the routes) and updating this
note (or simply closing/deleting it) once confirmed. If any check fails, file a new plan.

## Priority

Low — all Fully-Automated/Hybrid gates are green; this is polish/confirmation, not a known defect.
