---
name: note:erp-dashboards-open-ui-questions
description: "erp-dashboards — 4 open UI questions the user never answered, recorded with the defaults the program shipped"
date: 22-09-26
metadata:
  node_type: memory
  type: note
  feature: erp-dashboards
  phase: post-program
---

# Backlog: Open UI questions (recorded defaults, program shipped without answers)

**Priority:** LOW — none blocked the program; each shipped with a stated, reversible default.

1. **No phone route into the dashboards.** The phone bottom-tab-bar stays UNCHANGED at 3 tabs
   (ADMIN) / 2 tabs (STAFF) — dashboards are reachable only via the sidebar nav group on
   tablet/desktop. This is an explicit umbrella charter hard constraint ("never add a 4th tab"),
   not an oversight — but the user never confirmed whether phone access is wanted at all via a
   different mechanism (e.g. a dashboards entry inside an existing tab).
2. **Donut-vs-pie mix.** Shipped per the approved mockup (status = donut, category = pie) without a
   final user sign-off on the specific chart-type choice per metric.
3. **Menu/page naming.** "แดชบอร์ด" nav group with Sales/Purchase/Production sub-labels shipped as
   the working name; never explicitly confirmed as final Thai copy with the customer.
4. **App-wide white-on-green button contrast (3.0:1).** Noted as a SEPARATE accessibility pass,
   not part of this program's scope — see the dedicated note below.

## Action

If/when the user answers any of these, the fix is a small, isolated UI change — does not require
reopening the erp-dashboards program. Route to a new task folder under
`process/features/erp-dashboards/active/` (or `process/general-plans/` if it becomes cross-cutting,
e.g. the button-contrast item touches non-dashboard UI too).
