---
name: note:app-wide-button-contrast-accessibility
description: "App-wide white-on-green button contrast (3.0:1, below WCAG AA) — a separate accessibility pass surfaced during the erp-dashboards program, out of that program's scope"
date: 22-09-26
metadata:
  node_type: memory
  type: note
  feature: general
  phase: post-program
---

# Backlog: App-wide button contrast accessibility pass

**Priority:** LOW-MEDIUM — accessibility gap, not a functional defect; affects the whole app, not
just the erp-dashboards feature.

**Origin:** Surfaced as an open question during the `erp-dashboards` program's UI review — the
existing white-on-green button treatment (pguard Design System) measures ~3.0:1 contrast, below the
WCAG AA 4.5:1 threshold for normal text. This program deliberately left the treatment unchanged and
scoped the fix out — it is an app-wide token/primitive decision, not specific to any one dashboard
or feature.

## Scope for the fix (when picked up)

- Audit `src/app/globals.css`'s semantic-alias token layer (see `process/context/uxui/all-uxui.md`)
  for every button variant using the green-on-white combination.
- Likely fix: either darken the green token or lighten/darken the text token to reach 4.5:1,
  applied at the TOKEN layer (not per-component overrides) so every consumer inherits the fix.
- Needs a full regression pass across every screen using the primary button primitive
  (`src/components/ui/button.tsx`) — this is a shared primitive, so the blast radius is wide.

## Action

Route to a new general-plans task folder (`process/general-plans/active/`) when picked up — this is
cross-cutting UI/token work, not feature-scoped.
