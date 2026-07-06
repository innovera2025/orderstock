---
name: note:print-shading-q30
description: "Backlog (customer Q30) — semantic fill colors for the print form (header cream / totals salmon / footer green); additive CSS layer prepared and OFF by default"
date: 06-07-26
metadata:
  node_type: memory
  type: note
  feature: order-system
  phase: phase-05
---

# Backlog — Print shading fidelity (customer Q30)

## Known-gap

The scanned form uses shaded cells (header band cream, totals band salmon/pink, footer block pale
green) plus noise fills (blue-gray / khaki / pink) that are almost certainly spreadsheet artefacts.
It is NOT confirmed which shading the customer wants reproduced (Q30).

## Current behavior (shipped Phase 05)

- Default = BORDER / weight-emphasis ONLY, so the form is faithful even when the print dialog's
  "Background graphics" checkbox is OFF (the paper form is essentially black rules).
- The semantic-fill layer (header cream `#fdf6e3`, totals salmon `#f4c9c0`, footer green `#e6f0e0`)
  is prepared as an ADDITIVE, COMMENTED-OUT block at the bottom of `src/styles/print.css`. Flipping
  it on is purely additive — no structure, border, or column-width change.
- Noise fills (blue-gray / khaki / pink) are intentionally NEVER reproduced.
- The yellow "24" / "21" footer figures are NEVER reproduced (meaning unknown; likely spreadsheet
  check cells — form-canonical REF §7).

## Resolution when Q30 is answered

Uncomment the additive layer in `print.css` (and/or adjust colors), and add
`print-color-adjust: exact` is already present in that block. Instruct users to enable
"Background graphics" in the print dialog if fills are wanted.
