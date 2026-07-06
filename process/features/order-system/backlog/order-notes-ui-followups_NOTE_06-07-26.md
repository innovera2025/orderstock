---
name: note:order-notes-ui-followups
description: "Backlog (minor UI) — note-match ✓/✗ badge in the order grid and an orphan-NoteLine e2e round-trip test"
date: 06-07-26
metadata:
  node_type: memory
  type: note
  feature: order-system
  phase: phase-04
---

# Order Entry Minor UI/Test Follow-ups

## Priority

Low — both items are non-blocking polish/coverage gaps identified during Phase 04 EVL, not defects
in shipped behavior.

## Item 1 — Note-match ✓/✗ indicator

**Problem:** Phase 04 decision 5 called for a light "matched ✓/✗" indicator next to the free-text
note input, showing whether the off-list text auto-resolved to a `ProductVariant` via exact-text
match. The server-side auto-resolve logic is fully implemented (`saveOrderSheet` sets
`productVariantId` on exact match while always keeping the raw text), but the on-screen badge was not
surfaced in the Phase 04 grid — the note column is currently a single plain text input.

**Fix option:** Extend the order grid's note cell to read back `NoteLine.productVariantId` (available
after save/reload) and render a small ✓ (matched) / ✗ (unlinked) badge next to the text input.
Client-side pre-save preview (before the round-trip) would need either a debounced lookup against
the known off-list variant names or can be deferred to post-save display only — the latter is
simpler and matches how `needsConfirmation` badges already work elsewhere in the app.

## Item 2 — Orphan NoteLine e2e round-trip

**Problem:** The Phase 04 gate fixture (`test-fixtures/sheet-13-03-69.json`) includes an orphan
`NoteLine` (row 20, `shopId` null — a note with no associated shop). The D1 Playwright E2E only
enters OrderLine grid cells through the UI; the orphan NoteLine's persistence is currently proven
only by code inspection (`actions.ts`), not by an actual DB round-trip through the real UI.

**Fix option:** Extend `e2e/orders.spec.ts` (or a follow-up spec) to also enter the orphan note
through the UI's notes column with no shop selected, save, reload, and assert (via prisma query or
UI re-render) that the `NoteLine` persisted with `shopId = null` and the correct text/qty.

## Notes

- Both items were flagged as non-blocking observations in the Phase 04 EVL HANDOFF SUMMARY, not as
  gate failures — the phase was still promoted to ✅ VERIFIED.
- Neither item affects Phase 05 (Printing) input contracts — Phase 05 renders from persisted
  `NoteLine`/`OrderLine` snapshot columns regardless of how the note was entered.
