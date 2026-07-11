---
name: plan:responsive-drawer-sidebar
description: "Collapsible drawer sidebar for tablet (768-1024px) so the app shell fits iPad; fixed sidebar stays on desktop, bottom-tab-bar stays on phone"
date: 11-07-26
feature: general
---

# Responsive Collapsible (Drawer) Sidebar — Plan

**Date**: 11-07-26
**Status**: `CODE DONE` (11-07-26) — code-complete, committed (`b4c8ff9`). All Fully-Automated and
Hybrid gates confirmed green per the commit message: `pnpm test` 70 unit clean, lint/build clean,
`pnpm exec playwright test` 38 e2e (excl. `[setup]`) green, including the new `tablet` project
(`e2e/sidebar-drawer.spec.ts`) and the new desktop-collapse spec
(`e2e/sidebar-desktop-collapse.spec.ts`). **NOT yet `VERIFIED`** per this plan's own Phase
Completion Rules — the 3 Agent-Probe rows (iPad 768px/1024px real-viewport usability, dark-mode
legibility with the drawer/backdrop open, `prefers-reduced-motion` OS-level check) were not run in
this session (documentation-only UPDATE PROCESS closeout, no browser/dev-server session available)
and remain **pending-manual**. Recommend a short manual pass before calling this plan fully
`VERIFIED`; not release-blocking since all automated/Hybrid gates are green.
**Complexity**: SIMPLE→MEDIUM (single-session, ~17 checklist items, no schema/API/auth/payload changes)

Context: `process/context/all-context.md` (root router) → `process/context/uxui/all-uxui.md`
(pguard tokens/shell/breakpoint patterns) → `process/context/tests/all-tests.md` (test baseline
and gate commands). Read these before EXECUTE.

## Overview

Today the sidebar (`src/app/nav.tsx`) shows fixed at the `md` breakpoint (768px+) and the
bottom-tab-bar shows below it. On iPad portrait (768px = exactly `md`), the fixed 216px sidebar
crowds the 20-column order-matrix. This plan makes the sidebar a **hidden slide-in drawer** on
tablet (768–1024px), toggled by a ☰ hamburger in the topbar, while keeping phone (<768px)
bottom-tab-bar behavior **unchanged**. Desktop (≥1024px) defaults to the fixed sidebar but the
SAME ☰ hamburger can explicitly collapse/reopen it (LOCKED decision — see Design → Desktop
optional collapse).

## Goals

1. Three responsive tiers for the app shell: phone (<768px, unchanged bottom-tab-bar), tablet
   (768–1024px, off-canvas drawer + hamburger), desktop (≥1024px, fixed sidebar by default,
   hamburger genuinely collapses/reopens it — same store drives all three tiers).
2. Drawer: slide-in `<aside>` + backdrop, closes on backdrop click / Escape / route change,
   respects `prefers-reduced-motion`, dark-mode aware, uses existing pguard tokens/easing.
3. Accessible hamburger: `aria-expanded`, `aria-controls`, `aria-label`; focus enters drawer on
   open, Escape closes and (at minimum) returns focus to the hamburger.
4. order-matrix scrolls horizontally within its own container on narrow widths — never forces
   page-level horizontal scroll. (Already has `overflow-x-auto` wrapper — verified present.)
5. Zero changes to: `order-payload.ts`, `totals.ts`, `order-save.ts`, `actions.ts`
   (`saveOrderSheet`/`createOrderSheet`), the 446 fixture, print layout, schema, auth logic,
   `BottomTabBar` mobile behavior.

## Non-Goals

- No `(mobile)/` route group split — this stays a CSS-breakpoint + client-state shell swap,
  consistent with the existing pguard-redesign mobile pattern.
- No change to `Nav`'s server-side `auth()` read or role-gating logic.
- No new dependency — everything buildable with existing Tailwind v4 + tokens + `lucide-react`
  (already a dependency, used by `Nav`/`BottomTabBar`).
- No animated width transition on the desktop-collapse reservation gap — an instant width
  toggle is acceptable for this pass (see Design → Desktop optional collapse).

## Current State (read this session)

- `src/app/(main)/layout.tsx` — SERVER: `<div className="hidden shrink-0 md:block"><Nav/></div>`,
  `<Topbar/>`, `<main className="... pb-16 md:pb-0">`, `<BottomTabBar role={role}/>`.
- `src/app/nav.tsx` — SERVER (`await auth()`), returns `<aside className="... w-[216px] ...">`
  with logo + `<NavLinks role>` + user card + logout, or `null` when logged out.
- `src/app/topbar.tsx` — CLIENT, 62px header, left = route-derived title, right =
  `#topbar-actions` slot + TH/EN toggle + `<ThemeToggle/>`.
- `src/components/bottom-tab-bar.tsx` — CLIENT, `md:hidden` (shown <768px only), fixed
  `z-40` bottom nav, 3 tabs (ร้านค้า/สรุปยอด/ผู้ใช้ ADMIN-only).
- `src/components/theme-toggle.tsx` — reference pattern for external-state client toggle via
  `useSyncExternalStore` (hydration-safe, no `data-theme` SSR mismatch), AND for a second
  established precedent used by this plan: reading `window.matchMedia(...)` client-side to
  resolve a live system/viewport condition (theme uses `prefers-color-scheme`; this plan reuses
  the identical technique for `(min-width: 1024px)`).
- `src/app/(main)/orders/order-matrix.tsx:433` — desktop table ALREADY wrapped in
  `<div className="overflow-x-auto rounded-[var(--r-lg)] border ... ">` — confirmed present on
  disk this VALIDATE session, no change needed (verify only, checklist item 12).
- Tokens: `process/context/uxui/all-uxui.md` — pguard token layer in `src/app/globals.css`
  (semantic aliases only, e.g. `var(--bg-surface)`, `var(--border)`, `var(--r-md)`,
  `var(--focus-ring)`). Motion convention observed repo-wide: Tailwind `transition-colors
  duration-100` (100ms) on interactive elements — reuse `duration-200` for the drawer
  slide/backdrop (slightly longer for a translate, still cheap/fast, consistent family).
- `playwright.config.ts` — confirmed on disk: `chromium` project currently has
  `testIgnore: /mobile\.spec\.ts/` (runs every spec except the mobile one); `mobile` project has
  `testMatch: /mobile\.spec\.ts/` (inclusion-scoped, only picks up that one file). This plan's
  new specs must follow the SAME dual-sided pattern (see Design → Playwright project wiring).

## Design

### Breakpoints (Tailwind v4 defaults, no config change needed)

| Tier | Range | Sidebar | Bottom-tab-bar | Hamburger |
|---|---|---|---|---|
| Phone | <768px (`<md`) | none | shown (`md:hidden`, unchanged) | hidden |
| Tablet | 768–1023px (`md` to `<lg`) | drawer (off-canvas, default closed) | hidden | shown, toggles drawer |
| Desktop | ≥1024px (`lg+`) | fixed, default open | hidden | shown, toggles fixed↔collapsed |

Implementation: replace the current single `md:block` gate on `<Nav/>`'s wrapper with a new
client `SidebarShell` component that owns all responsive visibility internally (see Touchpoints).

### Server/client split (load-bearing constraint)

`Nav` MUST stay a server component — it does the `await auth()` read for the user
card/role/logout form and must return `null` when logged out. The drawer open/close and
hamburger are pure client concerns. Composition:

```
MainLayout (server)
 └─ SidebarShell (NEW, client) — owns nothing itself; just positions children responsively
     └─ children: <Nav/>  (server output, passed through as React children — server components
                            CAN be passed as children into a client component without becoming
                            client themselves; this is the standard RSC "server component as
                            children of a client component" pattern, already implicitly proven
                            by Next's own layout composition)
 └─ Topbar (client) — gets a NEW hamburger button (md+ only) that calls the SAME toggle store
 └─ BottomTabBar (client, unchanged)
```

State sharing between `Topbar` (hamburger) and `SidebarShell` (drawer) — two CLIENT siblings,
neither is an ancestor of the other — needs a shared store. Follow the exact `theme-toggle.tsx`
pattern: a tiny external mutable-state module (`src/lib/sidebar-drawer-store.ts`) exposing
`getSnapshot()`, `getServerSnapshot()` (returns `null`), `subscribe()`, plus exported
`openDrawer()`, `closeDrawer()`, `toggleDrawer()`, `useDrawerOpen()` (raw tri-state hook) and
`useDrawerVisible()` (resolved boolean hook — see below), backed by one module-level
`open: boolean | null` + a `window` CustomEvent (mirrors `THEME_EVENT`/`useSyncExternalStore`
exactly — NOT React Context, to stay consistent with the one external-state pattern this
codebase already uses and avoid a new Context provider wrapping the whole layout).

### Desktop optional collapse (Decision 1 — LOCKED: FUNCTIONAL, not inert)

The desktop ☰ genuinely toggles the fixed sidebar open/closed, using the SAME store as the
tablet drawer (this overrides this plan's original draft default of "inert-at-desktop" per the
user's locked decision — do not re-open whether it should be functional, only how).

**Store shape**: `open: boolean | null` — `null` = auto (defer to the pure-CSS responsive
default: closed `<lg`, open `≥lg`; this default is a static Tailwind class list resolved by the
browser's CSS engine per real-time viewport width, so it carries **zero SSR/hydration-mismatch
risk** — server and client render byte-identical class attributes for the `null` state, unlike
theme's localStorage-driven preference, which is why `getServerSnapshot()` can safely return
`null` with no flash-of-wrong-state concern). `true` = explicitly forced open (all breakpoints).
`false` = explicitly forced closed (all breakpoints, including `lg+` — this is what makes the
desktop collapse real).

**`toggleDrawer()` semantics**: cannot do a plain `!open` flip when `open === null`, because
"currently visible" differs by breakpoint at that moment (visible at desktop, hidden at
tablet/phone). So `toggleDrawer()` reads `window.matchMedia('(min-width: 1024px)').matches`
(the SAME technique `theme-toggle.tsx` already uses for `prefers-color-scheme`) to resolve
"is it currently visually open" only in the `null` case, then sets the explicit opposite
(`true`→ becomes `false` if it was visually open, i.e. desktop; `true` if it was visually
closed, i.e. tablet). Once explicit (`true`/`false`), later toggles are a plain boolean flip.
`closeDrawer()` (route-change / Escape / backdrop-click) always sets `false` explicitly (never
back to `null`) so an Escape-close at tablet doesn't silently reopen the sidebar if the viewport
is later resized past 1024px in the same session.

**`useDrawerVisible()`** (NEW second hook, for `aria-expanded` and any other JS branching that
needs "is it ACTUALLY visible right now", not the raw tri-state): a `useSyncExternalStore`
subscribing to BOTH the drawer-store CustomEvent AND a `matchMedia('(min-width: 1024px)')`
change listener (mirrors `theme-toggle.tsx` subscribing to both `THEME_EVENT` and its own
`matchMedia` `change` listener — same dual-subscription shape, different media query). Its
snapshot resolves `open === null ? isDesktopMatch : open`.

**CSS class list** (on the wrapping `<div>` in `sidebar-shell.tsx`, around `<Nav/>`'s `<aside>`,
which itself only gains `id="app-sidebar"` and stays otherwise untouched — see Touchpoints):
- `open === null` (auto): `-translate-x-full lg:translate-x-0` (this plan's original default,
  unchanged mechanically)
- `open === true` (forced open): `translate-x-0` (visible at ALL breakpoints — an unprefixed
  Tailwind utility applies everywhere unless a more specific breakpoint variant is also present;
  none is emitted in this branch)
- `open === false` (forced closed): `-translate-x-full` (hidden at ALL breakpoints, including
  `lg+` — no competing `lg:translate-x-*` utility is emitted in this branch, so the base utility
  persists at every width)

**Width reservation (desktop only)** — today's `layout.tsx` wraps `<Nav/>` in a `shrink-0` div
that reserves 216px of flex-row space at `md:block`. For desktop collapse to actually reclaim
that space (not just visually hide the sidebar behind a blank 216px gap), the SAME store drives
a SECOND, independent class on that outer reservation div: `lg:w-[216px]` when visible (`open`
is `null` or `true`), `lg:w-0 lg:overflow-hidden` when explicitly closed (`open === false`) —
scoped to `lg:` only, since tablet/phone never reserve flex width (the sidebar is `fixed`,
out of flow, below `lg`). This is a plain instant width toggle — no animation requirement this
pass (Non-Goals); execute-agent MAY add `transition-[width]` if it reads clean during EXECUTE,
but it is not required and must not block the gate.

No backdrop appears at desktop when collapsing (consistent with the existing backdrop rule,
`lg:hidden` — desktop collapse is a pure layout-reflow toggle, not a modal overlay).

### Drawer visuals (tablet + when hamburger toggles it)

- `<aside>` container (rendered inside `sidebar-shell.tsx`'s wrapper — see CSS class list
  above for the three `open` states): `fixed inset-y-0 left-0 z-50 w-[216px] ... border-r
  border-[var(--border)] bg-[var(--bg-surface)] transition-transform duration-200
  ease-[cubic-bezier(0.25,0.46,0.45,0.94)] motion-reduce:transition-none lg:static lg:z-auto
  lg:transition-none` plus the `open`-state-dependent translate classes above — at `lg+`,
  `lg:static` makes the sidebar participate in the flex layout again (its visibility there is
  now governed by the wrapper's width-reservation class, not just translate).
- Backdrop: `fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:block lg:hidden`
  rendered only when visually open at tablet width (conditional mount, not just opacity-0, so it
  never intercepts clicks when closed) — hidden at `lg+` (no backdrop for the desktop collapse).
- Backdrop click → `close()`. `Escape` keydown (attached only while open, via `useEffect`) →
  `close()` + refocus the hamburger button (store a ref or use `document.getElementById`).
- Route change (`usePathname()` change) → `close()`. (At `lg+` this sets `open=false` explicitly,
  which per the new design ALSO collapses the desktop sidebar on navigation — this is a
  behavior change from "desktop always visible" to "desktop respects the same close-on-route
  trigger." Given AC4 below only requires default-open + togglable, and no acceptance criterion
  demands "desktop never auto-closes on navigation," this is accepted as in-scope; flag as an
  Execute-Agent Instruction to double check during EXECUTE it doesn't feel surprising, and note
  as a candidate follow-up if the user finds constant desktop route-triggered collapse
  undesirable — trivial one-line fix later: skip `closeDrawer()` when `isDesktopMatch` is true.)

### Hamburger (Topbar)

- New button, left of the title (`aria-label="เปิด/ปิดเมนู"`, `aria-controls="app-sidebar"`),
  class includes `hidden md:inline-flex` (**hidden below 768px** so PHONE stays byte-identical
  to today — Acceptance Criterion 5 — and shown at `md` and up, covering both the tablet-drawer
  and desktop-collapse cases). `aria-expanded` is bound to `useDrawerVisible()` (the RESOLVED
  visible boolean, not the raw tri-state store) so it reads correctly whether the current
  visibility comes from the CSS auto-default or an explicit toggle.
- Icon: `lucide-react` `Menu`/`X` (already a repo dependency), 18–20px, matches `ThemeToggle`'s
  button sizing (`h-9 w-9`, `rounded-[var(--r-md)]`, `hover:bg-[var(--bg-sunken)]`,
  `focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]`).
- `<Nav>`'s `<aside>` needs `id="app-sidebar"` added for `aria-controls` to resolve.

### Focus management

- On open (tablet): move focus to the first focusable element inside the drawer (the logo link
  or first nav link) via a `ref` + `useEffect` keyed on visible-open transitioning true→ (tablet
  range only — skip auto-focus-steal when the desktop collapse toggles open, since that isn't a
  modal-style reveal and stealing focus there would be surprising; gate this on
  `!isDesktopMatch`).
- On close via Escape: return focus to the hamburger button.
- On close via backdrop click or route change: no explicit refocus required (natural DOM focus
  loss is acceptable per WCAG since the trigger wasn't keyboard-Escape).

### Playwright project wiring

Two new spec files, wired the SAME dual-sided way the existing `mobile` project is wired
(inclusion via `testMatch` on the new project + exclusion via `testIgnore` on `chromium` for the
tablet-only spec):

- `e2e/sidebar-drawer.spec.ts` — **tablet-tier** assertions (drawer hidden by default, ☰
  opens it + backdrop, backdrop/Escape closes it, no page-level horizontal overflow). Picked up
  ONLY by the new `tablet` project (`testMatch: /sidebar-drawer\.spec\.ts/`, mirroring
  `mobile`'s `testMatch: /mobile\.spec\.ts/`). MUST be added to `chromium`'s `testIgnore` regex
  (`/mobile\.spec\.ts|sidebar-drawer\.spec\.ts/`) — otherwise it also runs under `chromium`'s
  default ~1280×720 (desktop-tier) viewport, where the tablet-only assertions (e.g. "drawer
  hidden by default via CSS auto, not yet forced open") don't hold the same meaning and would
  produce a false-negative failure, breaking the "e2e stays green" requirement (AC7).
- `e2e/sidebar-desktop-collapse.spec.ts` — **desktop-tier** assertions (☰ collapses the fixed
  sidebar + content reclaims the 216px, re-clicking ☰ reopens it, no backdrop appears). Runs
  under the EXISTING `chromium` project's default viewport (already ≥1024px = desktop tier) —
  no new project or config needed for this file; it is simply a new spec that `chromium`'s
  inclusive `testIgnore` pattern picks up automatically (do not add it to any exclusion list).
  This upgrades the desktop-collapse behavior from Agent-Probe to a real Hybrid gate (see
  Verification Evidence) — important since Decision 1 (functional desktop collapse) is now a
  genuinely new, load-bearing behavior, not a decorative no-op.

## Acceptance Criteria

1. At tablet widths (768–1023px), the sidebar is NOT visible on initial page load — only the ☰
   hamburger and topbar are shown; the order-matrix / page content has full width.
2. Clicking the ☰ hamburger at tablet width opens the drawer (slide-in from left) with a visible
   backdrop; `aria-expanded` on the hamburger flips to `true`.
3. Clicking the backdrop, pressing Escape, or navigating to a new route closes the drawer.
4. At desktop widths (≥1024px), the sidebar is visible by default (fixed, 216px) and can be
   explicitly collapsed/reopened via the SAME ☰ hamburger — collapsing hides it and reclaims its
   216px of layout width; reopening restores it. No backdrop appears at desktop.
5. At phone widths (<768px), behavior is byte-identical to before this plan: no sidebar, no
   hamburger (hidden `<md`), `BottomTabBar` still the only nav surface.
6. `order-matrix.tsx`'s 20-column table scrolls horizontally within its own container at
   tablet width — the page itself never gains horizontal scroll.
7. `pnpm test`, `pnpm lint`, `pnpm build`, and the full existing `pnpm exec playwright test`
   suite (99 unit / 34 e2e baseline) all stay green — zero regressions.
8. `saveOrderSheet`, `createOrderSheet`, `buildOrderPayload`, `totals.ts`, `order-save.ts`, and
   all print routes are byte-identical (no diff) after this plan.
9. Dark mode: drawer and backdrop are legible and correctly themed in both light and dark mode.
10. `prefers-reduced-motion` is respected — no slide/opacity transition plays for a user with
    that OS preference set.

## Phase Completion Rules

This is a SIMPLE→MEDIUM single-phase plan (not a phase program) — "complete" means:

- All 17 Implementation Checklist items are done.
- All 10 Acceptance Criteria are met and evidenced per the Verification Evidence table.
- The plan is `CODE DONE` once EXECUTE finishes and the Fully-Automated + Hybrid gates are
  green; it is `VERIFIED` only after the Agent-Probe rows (iPad 768px/1024px usability check,
  dark-mode check, reduced-motion check) are also confirmed and recorded in the phase report.
  Do not mark VERIFIED on Fully-Automated/Hybrid gates alone.

## Implementation Checklist

1. Create `src/lib/sidebar-drawer-store.ts` — external mutable-state module mirroring
   `theme-toggle.tsx`'s pattern: module-level `let open: boolean | null = null`,
   `SIDEBAR_EVENT` CustomEvent name, `getSnapshot()` (returns raw `open`), `getServerSnapshot()`
   (returns `null`), `subscribe()`, plus exported `openDrawer()` (sets `true`), `closeDrawer()`
   (sets `false`), `toggleDrawer()` (the `matchMedia('(min-width: 1024px)')`-aware resolver
   described in Design → Desktop optional collapse), `useDrawerOpen()` (raw tri-state hook) and
   `useDrawerVisible()` (resolved-boolean hook, dual-subscribed to the store event AND a
   `matchMedia('(min-width: 1024px)')` change listener, mirroring `theme-toggle.tsx`'s two-source
   `subscribe()`).
2. Create `src/app/(main)/sidebar-shell.tsx` — NEW client component. Props: `{ children:
   React.ReactNode }` (receives the server-rendered `<Nav/>` output). Renders: (a) the OUTER
   width-reservation wrapper (`shrink-0` + the `lg:w-[216px]` / `lg:w-0 lg:overflow-hidden`
   class pair from Design), (b) the backdrop (conditional on visually-open, `md:block lg:hidden`)
   as a sibling, and (c) wraps `children` in the transform/position classlist (fixed/static +
   translate states) described in Design — do NOT modify `Nav`'s own `<aside>` className from
   outside (see item 3).
3. Edit `src/app/nav.tsx` — add `id="app-sidebar"` to the `<aside>` ONLY. `Nav` stays a SERVER
   component and is otherwise untouched — all transform/position/width classes described in
   Design live on `SidebarShell`'s wrapper `<div>`s (item 2), not on `Nav`'s own className, so
   no prop threading into the server component is needed.
4. Edit `src/app/(main)/layout.tsx` — replace `<div className="hidden shrink-0 md:block">
   <Nav/></div>` with `<SidebarShell><Nav/></SidebarShell>` (no `hidden`/`md:block` wrapper
   needed anymore — `SidebarShell` handles all responsive visibility internally, including the
   phone tier where the drawer/reservation containers render `hidden` entirely below `md` since
   phone uses `BottomTabBar` instead, per Goals #1/#5 "phone unchanged"). Keep `BottomTabBar`
   and `<main>` padding exactly as-is.
5. Edit `src/app/topbar.tsx` — import `Menu`, `X` from `lucide-react` and
   `useDrawerVisible`/`toggleDrawer` from the new store; add the hamburger `<button>` to the left
   of `<h1>` inside the header, matching `ThemeToggle`'s visual/focus-ring style, with class
   `hidden md:inline-flex` (hidden on phone — see Design → Hamburger); wire `aria-expanded`
   (from `useDrawerVisible()`), `aria-controls="app-sidebar"`, `aria-label`.
6. In `sidebar-drawer-store.ts` or `sidebar-shell.tsx`, add the route-change auto-close:
   `usePathname()` + `useEffect` that calls `closeDrawer()` whenever pathname changes (skip the
   initial mount to avoid a no-op call).
7. In `sidebar-shell.tsx`, add the Escape-key handler: `useEffect` attaching a `keydown`
   listener only while visually-open is true, calling `closeDrawer()` on `Escape`, cleaning up on
   unmount/close.
8. In `sidebar-shell.tsx`, add focus-on-open (tablet only, see Design → Focus management): a
   `ref` on the drawer container (or use `document.getElementById('app-sidebar')`) + `useEffect`
   keyed on visually-open transitioning true, gated on `!isDesktopMatch`, that calls `.focus()`
   on the first focusable descendant — target the first `<a>` inside `NavLinks`, or fall back to
   focusing the `<aside>` itself with `tabIndex={-1}` if no link is reliably queryable — pick the
   `tabIndex={-1}` fallback for simplicity and note it in the report.
9. Add `motion-reduce:transition-none` (or equivalent `prefers-reduced-motion` handling) to
   both the drawer transform and backdrop opacity transitions.
10. Confirm dark-mode: all classes use existing semantic tokens (`var(--bg-surface)`,
    `var(--border)`) — no new raw colors; backdrop `bg-black/40` is intentionally
    theme-invariant (a dimming overlay, not surface color) — verify this reads correctly in both
    themes via the agent-probe gate (item 15).
11. Verify `BottomTabBar` visibility is unaffected: still `md:hidden` (shown <768px only) — no
    edit needed, confirm only.
12. Verify `order-matrix.tsx:433` `overflow-x-auto` wrapper already exists around the table —
    no edit needed (confirmed present this session); if narrower testing reveals the wrapper
    doesn't constrain width correctly at 768–1024px, add `max-w-full` to the wrapper only (no
    change to cell/notes state, `buildOrderPayload`, totals, or save path).
13. Add the `tablet` project to `playwright.config.ts` (820×1180, matching the existing `mobile`
    project pattern at 390×844, `testMatch: /sidebar-drawer\.spec\.ts/`, same `dependencies:
    ["setup"]`). Update the `chromium` project's `testIgnore` to
    `/mobile\.spec\.ts|sidebar-drawer\.spec\.ts/` (adds the new tablet-only spec to the existing
    exclusion — required, see Design → Playwright project wiring; without this the new spec
    double-runs under chromium's desktop viewport and false-fails).
14. Create `e2e/sidebar-drawer.spec.ts` (tablet project) asserting: drawer/backdrop hidden by
    default; hamburger click → backdrop visible + drawer `translate-x-0`; backdrop click →
    drawer closes; Escape → drawer closes; order-matrix container has no page-level horizontal
    overflow (`document.documentElement.scrollWidth <= viewport width + small tolerance`).
    Create `e2e/sidebar-desktop-collapse.spec.ts` (runs under the existing `chromium` project,
    no config change needed) asserting: sidebar visible by default at desktop viewport;
    hamburger click → sidebar hidden + content area reclaims the 216px (assert on a layout
    dimension, e.g. the main content container's bounding-box width increases, or the sidebar's
    `getBoundingClientRect().width` is 0/off-screen); hamburger click again → sidebar reopens;
    no backdrop element is visible at any point in this spec.
15. Run `pnpm lint` and `pnpm build` — fix any type/lint errors introduced by the new files.
16. Run the full existing suite (`pnpm test`, `pnpm exec playwright test`) to confirm zero
    regressions in the current 99 unit / 34 e2e baseline (per `tests/all-tests.md`), PLUS the 2
    new spec files (tablet project + the new chromium-tier desktop-collapse spec) all green.
17. Agent-probe pass (see Verification Evidence): iPad-equivalent 768px/1024px usability, dark
    mode legibility with the drawer/backdrop open, and `prefers-reduced-motion` (OS-level toggle,
    confirm no transform/opacity animation plays). Record results in the phase report before
    marking the plan VERIFIED.

## Touchpoints

| File | Change |
|---|---|
| `src/lib/sidebar-drawer-store.ts` | NEW — tri-state external store (`boolean \| null`), mirrors `theme-toggle.tsx` pattern (event + matchMedia dual-subscribe) |
| `src/app/(main)/sidebar-shell.tsx` | NEW — client wrapper owning drawer positioning/width-reservation/backdrop/focus/escape/route-close |
| `src/app/nav.tsx` | Add `id="app-sidebar"` only (server component untouched otherwise) |
| `src/app/(main)/layout.tsx` | Replace `<div className="hidden shrink-0 md:block"><Nav/></div>` with `<SidebarShell><Nav/></SidebarShell>` |
| `src/app/topbar.tsx` | Add hamburger button (`hidden md:inline-flex`) + import store hooks |
| `src/app/(main)/orders/order-matrix.tsx` | Verify-only (item 12); at most add `max-w-full` to existing scroll wrapper |
| `playwright.config.ts` | Add `tablet` project (820×1180); update `chromium`'s `testIgnore` to also exclude `sidebar-drawer.spec.ts` |
| `e2e/sidebar-drawer.spec.ts` | NEW spec (tablet project), 4-5 gates |
| `e2e/sidebar-desktop-collapse.spec.ts` | NEW spec (chromium project), desktop-collapse gates |

## Public Contracts

None. No server action, API route, schema, or payload-emission function is touched. `Nav`'s
prop signature (`{}`, none) is unchanged; `SidebarShell`'s prop signature (`{ children }`) is
new but internal-only (not exported/consumed outside `(main)/layout.tsx`).

## Blast Radius

- 7 edited/new source files (2 new: store + shell; 4 edited: nav id-only, layout, topbar,
  possibly order-matrix wrapper; 1 config: playwright.config.ts) + 2 new e2e specs = 9 files
  total.
- Zero DB/schema/migration/seed changes. Zero auth/session changes. Zero API/action signature
  changes. `saveOrderSheet`/`createOrderSheet`/`buildOrderPayload`/`totals.ts`/`order-save.ts`/
  print routes/soft-delete flow are NOT in this blast radius and MUST remain byte-identical.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm test` (existing 99 unit) stays green | Fully-Automated | No regression to existing logic (proven by: full existing Vitest suite) |
| `pnpm lint` clean | Fully-Automated | New files follow repo lint rules |
| `pnpm build` succeeds | Fully-Automated | New client/server composition compiles, no RSC boundary violation |
| `pnpm exec playwright test` (existing 34 e2e) stays green | Hybrid (needs sandbox + dev server) | No regression to existing desktop/mobile flows (proven by: full existing Playwright suite) |
| NEW `e2e/sidebar-drawer.spec.ts` — drawer hidden by default at tablet viewport | Hybrid — precondition: sandbox up, seeded admin, `pnpm start` webServer (same as existing e2e), `tablet` project wired per Design | proven by: tablet-drawer-default-closed gate — "sidebar becomes a hidden drawer on tablet" |
| NEW spec — ☰ opens drawer, backdrop visible, `aria-expanded=true` | Hybrid | proven by: hamburger-opens-drawer gate — "hamburger toggles it open/closed" |
| NEW spec — backdrop click closes drawer | Hybrid | proven by: backdrop-closes-drawer gate |
| NEW spec — Escape closes drawer | Hybrid | proven by: escape-closes-drawer gate — accessibility requirement |
| NEW spec — order-matrix no page-level horizontal overflow at tablet width | Hybrid | proven by: matrix-scroll-contained gate — "matrix fits/scrolls cleanly" |
| NEW `e2e/sidebar-desktop-collapse.spec.ts` — desktop ☰ collapses + reopens sidebar, content reclaims width, no backdrop | Hybrid — precondition: same sandbox/webServer, runs under existing `chromium` project (default desktop viewport) | proven by: desktop-collapse gate — Decision 1 "the ☰ button genuinely collapses the fixed sidebar" (upgraded from Agent-Probe to Hybrid during VALIDATE — see Validate Contract) |
| iPad portrait (768px) and landscape (1024px) real-device-equivalent usability | Agent-Probe | proven by: manual verification note per user's original ask — "verify at 768px / 1024px the layout is usable" |
| Dark mode — drawer/backdrop legible in both themes | Agent-Probe | proven by: manual toggle-theme-while-drawer-open check |
| `prefers-reduced-motion` — no transform animation | Agent-Probe | proven by: manual OS-level reduced-motion toggle check (no automated Playwright emulation added — low value for a CSS-only concern; can be added later if desired) |

## Validate Contract

Status: PASS
Date: 11-07-26
date: 2026-07-11
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: score 1/7 (only S7 "5+ files in blast radius" present) — single-package, no
schema/API/auth surface, no phase-program structure; sequential single-agent VALIDATE was
correct and sufficient (see full scoring in phase report / this write-up's rationale below).

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC7 | Existing 99 unit tests unaffected | Fully-Automated | `pnpm test` | A |
| AC7 | Lint clean on new files | Fully-Automated | `pnpm lint` | A |
| AC7 | Build compiles, no RSC boundary violation | Fully-Automated | `pnpm build` | A |
| AC7 | Existing 34 e2e specs unaffected | Hybrid — sandbox + `pnpm start` up | `pnpm exec playwright test` (chromium + mobile + setup projects) | A |
| AC1, AC5 | Drawer hidden by default at tablet; phone unaffected | Hybrid — sandbox + `pnpm start` up, `tablet` project | `pnpm exec playwright test --project=tablet` → `e2e/sidebar-drawer.spec.ts` "drawer hidden by default" | B |
| AC2 | ☰ opens drawer + backdrop + `aria-expanded` | Hybrid — same precondition | `e2e/sidebar-drawer.spec.ts` "hamburger opens drawer" | B |
| AC3 | Backdrop click / Escape / route-change closes drawer | Hybrid — same precondition | `e2e/sidebar-drawer.spec.ts` "backdrop closes", "escape closes" | B |
| AC6 | order-matrix no page-level horizontal overflow at tablet | Hybrid — same precondition | `e2e/sidebar-drawer.spec.ts` "matrix scroll contained" | B |
| AC4 | Desktop ☰ collapses/reopens fixed sidebar, content reclaims width, no backdrop | Hybrid — sandbox + `pnpm start` up, `chromium` project (default viewport) | `pnpm exec playwright test --project=chromium` → `e2e/sidebar-desktop-collapse.spec.ts` | B |
| AC9 | Dark mode legibility of drawer/backdrop | Agent-Probe | manual toggle-theme-while-drawer-open check (checklist item 17) | D |
| — | iPad 768px/1024px usability | Agent-Probe | manual real-viewport pass (checklist item 17) | D |
| AC10 | `prefers-reduced-motion` respected | Agent-Probe | manual OS-level reduced-motion toggle check (checklist item 17) | D |

gap-resolution legend: A — proven now (pre-existing gate, unaffected by this plan). B — fixed
in this plan (new gate added by this plan's checklist, items 13-14). D — backlog test-building
stub (named residual: no automated `prefers-reduced-motion`/dark-mode/real-device Playwright
emulation exists anywhere in the repo yet — flagged, not blocking, consistent with pre-existing
Test Infra Improvement Notes below).

Legacy line form:
- Unit/lint/build/existing-e2e: [Fully-automated: `pnpm test` / `pnpm lint` / `pnpm build`] |
  [hybrid: `pnpm exec playwright test` — precondition: sandbox SQL Server up, seeded admin,
  `pnpm start` webServer running]
- New tablet-drawer behavior: [hybrid: `pnpm exec playwright test --project=tablet` —
  precondition: same sandbox/webServer + `tablet` project wired per checklist item 13]
- New desktop-collapse behavior: [hybrid: `pnpm exec playwright test --project=chromium` (new
  spec file) — same precondition, no new project needed]
- Dark mode / iPad real-viewport / reduced-motion: [agent-probe: manual pass, checklist item 17]

C-4 reconciliation: no `Known-Gap` strategy value is used in the table above — every developed
behavior in this plan's blast radius has a Fully-Automated, Hybrid, or Agent-Probe gate. The
reduced-motion/dark-mode/real-device Agent-Probe rows are legitimate manual-judgment proving
strategies (gap-resolution D = named residual, backlog-tracked via the pre-existing Test Infra
Improvement Notes section), not a silent Known-Gap pass-through — net-gate vacuous-green ban
satisfied.

Dimension findings:
- Infra fit: PASS — no container/infra/port surface touched; all referenced current-state files
  (`nav.tsx`, `topbar.tsx`, `layout.tsx`, `bottom-tab-bar.tsx`, `theme-toggle.tsx`,
  `order-matrix.tsx:433`, `playwright.config.ts`) confirmed present on disk and match the plan's
  "Current State" description verbatim (read directly during VALIDATE V2).
- Test coverage: CONCERN → FIXED IN PLAN — the new `tablet`-only spec needed an explicit
  `chromium` `testIgnore` update (it would otherwise double-run at the wrong viewport and
  false-fail AC7's "34 e2e stays green"); added as checklist item 13 + a new
  `e2e/sidebar-desktop-collapse.spec.ts` was added to give AC4 (functional desktop collapse) a
  real Hybrid gate instead of leaving it Agent-Probe-only, since Decision 1 makes it a genuinely
  new, load-bearing behavior. See Design → Playwright project wiring.
- Breaking changes: PASS — no API/schema/payload changes; Public Contracts section correctly
  states none; Touchpoints correctly excludes `order-payload.ts`/`totals.ts`/`actions.ts`/print
  routes — confirmed no edits proposed to any of those files anywhere in the checklist.
- Security surface: PASS — no auth/trust-boundary changes; `Nav`'s `await auth()` read and
  role-gating are untouched (only a static `id` attribute is added); no new client-exposed data,
  no new server action, no new route.
- Section — Design/Implementation feasibility: CONCERN → FIXED IN PLAN — two mechanical gaps
  found and resolved by rewriting the Design section this VALIDATE pass: (1) the plan's original
  "Desktop optional collapse" design explicitly picked an INERT desktop hamburger (CSS
  force-override always wins at `lg+`, ignoring store state) which contradicts the user's locked
  Decision 1 (desktop ☰ must be FUNCTIONAL) — resolved with a tri-state store
  (`boolean | null`) + `matchMedia`-aware `toggleDrawer()` + an independent width-reservation
  class, all following the existing `theme-toggle.tsx` dual-subscription precedent, so the fix
  needed no new dependency or architectural pattern; (2) the original Hamburger design text
  concluded "always rendered (no breakpoint hiding)," which would show a new ☰ button on PHONE
  and directly contradict Acceptance Criterion 5 ("byte-identical to before this plan" on
  phone) — resolved with `hidden md:inline-flex`. Both fixes are now reflected in the Design,
  Implementation Checklist, Touchpoints, and Acceptance Criteria sections above.

Open gaps: none blocking. Named residuals (gap-resolution D, backlog-tracked, not blocking
PASS): no automated Playwright emulation exists repo-wide for `prefers-reduced-motion` or
dark-mode visual diffing, and no real-device lab exists for iPad-equivalent tactile usability —
these three rows stay Agent-Probe by design (see Test Infra Improvement Notes, unchanged from
the original plan draft).

What this coverage does NOT prove:
- `pnpm test` / `pnpm lint` / `pnpm build`: does not prove any runtime browser behavior — no
  DOM, no viewport, no user interaction is exercised by these three gates.
- `pnpm exec playwright test` (existing 34 e2e, unaffected baseline): does not exercise any new
  sidebar-drawer code path — it only proves the EXISTING flows still work after this plan's
  files are added, not that the new drawer/collapse behavior itself is correct.
- `e2e/sidebar-drawer.spec.ts` (tablet project, 820×1180 only): does not prove correctness at
  other tablet-range widths (e.g. 768px exactly, or 1023px exactly, the tier boundaries) — only
  the single chosen viewport is exercised; boundary-width behavior is left to the Agent-Probe
  iPad pass (checklist item 17).
- `e2e/sidebar-desktop-collapse.spec.ts` (chromium project, default ~1280×720 viewport): does
  not prove behavior at the 1024px boundary itself, nor at very large desktop widths; does not
  prove the width-reservation reflow is visually smooth (only that dimensions end up correct) —
  visual smoothness/jump-free-ness is left to the Agent-Probe pass.
- Agent-Probe rows (dark mode, iPad usability, reduced-motion): manual judgment only, not
  re-run automatically on future regressions — a future code change could silently break any of
  these three without CI ever catching it; this is the named, accepted residual from Test Infra
  Improvement Notes (pre-existing, not newly introduced by this plan).
(Required until C3 is implemented — temporary C3 mitigation)

Gate: PASS (no FAILs, plan updated — both CONCERNs found were fixed in the plan text itself
during this VALIDATE session, not deferred)
Accepted by: N/A — Gate is PASS; no CONCERNs remain open to accept (both found CONCERNs were fixed in the plan text this session, see Dimension findings above)

## Autonomous Goal Block

SESSION GOAL: Ship the responsive collapsible drawer sidebar (phone bottom-tab-bar unchanged,
tablet 768-1024px hidden drawer + hamburger, desktop >=1024px fixed sidebar with a functional
hamburger collapse/reopen) with zero regressions to order-payload/totals/save/print.
Charter + umbrella plan: N/A — single plan, not part of a phase program.
Autonomy: standard /goal autonomous execution rules (process/development-protocols/orchestration.md
SS Autonomous /goal Phase Program Execution) apply if invoked under a standing /goal; otherwise
standard interactive RIPER-5 gates apply (explicit ENTER EXECUTE MODE required before EXECUTE).
Hard stop conditions / safety constraints:
- Zero changes to order-payload.ts, totals.ts, order-save.ts, actions.ts (saveOrderSheet /
  createOrderSheet), the 446 fixture, print layout, schema, or auth logic (Nav's await auth()
  read and role-gating must stay untouched beyond the id="app-sidebar" attribute).
- No new dependency may be introduced (lucide-react is already installed).
- pnpm test (99 unit), pnpm lint, pnpm build, and the full existing Playwright suite (34 e2e)
  must stay green throughout; any regression is a hard stop, not a note-and-continue.
- Do not re-open the 3 locked design decisions (functional desktop collapse, 216px drawer
  width, new tablet Playwright project) during EXECUTE.
Next phase: EXECUTE: process/general-plans/active/responsive-drawer-sidebar_11-07-26/responsive-drawer-sidebar_PLAN_11-07-26.md
Validate contract: inline in plan (see ## Validate Contract above)
Execute start: pnpm test && pnpm lint && pnpm build | pnpm exec playwright test --project=tablet
--project=chromium (new specs) | Agent-Probe: iPad 768/1024px usability + dark mode +
prefers-reduced-motion (checklist item 17) | high-risk pack: no (no auth/billing/schema/API/
deploy surface touched)

## Test Infra Improvement Notes

- Playwright currently has `setup` + `chromium` + `mobile` (390×844) projects. This plan adds a
  4th `tablet` project (820×1180) — the same "add a project rather than manual viewport calls in
  one spec" pattern already established by the `mobile` project (pguard-redesign Phase 04). Any
  future tablet-specific work should reuse this new project rather than re-adding ad hoc
  `setViewportSize` calls.
- No `prefers-reduced-motion` Playwright emulation exists anywhere in the current suite
  (`page.emulateMedia({ reducedMotion: 'reduce' })` is available but unused repo-wide) — flagged
  as a known gap, not blocking, consistent with this being a CSS-only concern already covered by
  the `motion-reduce:` Tailwind variant.
- No dark-mode visual-diffing Playwright coverage exists repo-wide either — same category of
  named residual as reduced-motion above.

## Resume and Execution Handoff

- **Selected plan file:** `process/general-plans/active/responsive-drawer-sidebar_11-07-26/responsive-drawer-sidebar_PLAN_11-07-26.md`
- **Entry point for EXECUTE:** start at Implementation Checklist item 1 (new store file) —
  items 1–2 have no dependency on anything else and can be built/tested in isolation before
  touching `layout.tsx`/`topbar.tsx`/`nav.tsx`.
- **Order dependency:** items 1→2→3→4 must land together before the drawer renders correctly
  (store → shell → nav id → layout wiring); items 5–10 (topbar hamburger, route-close, escape,
  focus, reduced-motion) can follow in any order once 1–4 are done; items 11–12 are
  verify-only; items 13–16 are the Playwright wiring + closing gate run; item 17 is the
  Agent-Probe pass, recorded in the phase report before marking VERIFIED.
- **Design decisions — ALL LOCKED, do not re-open during EXECUTE:** (1) desktop ☰ is
  FUNCTIONAL (collapses/reopens the fixed sidebar) — see Design → Desktop optional collapse for
  the exact tri-state mechanism; (2) drawer width = 216px (reuses desktop sidebar width); (3)
  new `tablet` Playwright project at 820×1180, mirroring the `mobile` project pattern.
- **Rollback:** every change is additive/CSS/new-file except the one-line `<Nav/>` wrapper swap
  in `layout.tsx`, the `id` addition in `nav.tsx`, and the `testIgnore` regex edit in
  `playwright.config.ts` — `git diff` on those 3 files plus deleting the 4 new files (store,
  shell, 2 e2e specs) fully reverts.

## Open Questions

All three original open questions are RESOLVED (locked by the user before this VALIDATE pass —
kept here for audit trail, not re-opened):

1. ~~Should the hamburger at desktop (`lg+`) actually collapse the sidebar to an icon rail, or
   is an always-visible-but-clickable (inert) hamburger acceptable?~~ **RESOLVED: functional —
   the ☰ genuinely collapses/reopens the fixed sidebar (not an icon-rail collapse, a full
   hide/show — icon-rail-collapse remains a possible future follow-up, out of scope here).**
2. ~~Tablet drawer width: reuse 216px or go narrower?~~ **RESOLVED: 216px, reusing the existing
   desktop sidebar width.**
3. ~~New `tablet` Playwright project vs. inline viewport override in one spec?~~ **RESOLVED: new
   `tablet` project (820×1180), consistent with the `mobile` project precedent.**

---

Plan validated (PASS) and updated in place during VALIDATE — both CONCERNs found (desktop-collapse
mechanism gap, phone-hamburger-visibility contradiction, and the Playwright testIgnore wiring gap)
were fixed directly in this plan's Design/Checklist/Touchpoints/Verification Evidence sections.

**Next instruction:** Say **ENTER EXECUTE MODE** to have vc-execute-agent implement this plan
per the Implementation Checklist above, starting at item 1.
