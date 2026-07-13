---
name: context:all-uxui
description: "UI/UX context entrypoint for orderstock — pguard Design System tokens, semantic-alias contract, shared src/components/ui/* primitives, sidebar+topbar shell, dark mode, and print-font behavior"
keywords: ui, ux, design, tokens, pguard, theme, dark mode, dark-mode, sidebar, topbar, nav, primitives, button, input, card, modal, toast, chip, switch, ibm plex, font, focus ring, radius, print font, order-matrix, matrix, topbar-actions, portal, app-settings, settings persistence, summary, history, bar chart, top shops, groupby, shop totals, mobile, responsive, breakpoint, bottom tab bar, touch target, mobile entry, mobile overlay, drawer, sidebar drawer, hamburger, tablet, collapse, sidebar-shell, sidebar-drawer-store, surface-focus, seasoning-band, dark-mode contrast, print footer, one-page print, tally-col, print pagination
related: [context:all-tests, context:all-database]
date: 13-07-26
metadata:
  read_when: any UI/token/component/shell/theme work
---

# orderstock — UI/UX (uxui) Context

Entrypoint for the pguard Design System introduced in `pguard-redesign` Phase 01 (07-07-26,
✅ VERIFIED), extended by Phase 02 (07-07-26, ✅ VERIFIED — matrix, settings persistence,
`#topbar-actions` portal pattern), Phase 03 (08-07-26, ✅ VERIFIED — สรุปยอดผลิต bar-chart
pattern, ประวัติออเดอร์ groupBy-aggregate pattern), Phase 04 (08-07-26, ✅ VERIFIED — mobile
responsive breakpoint pattern, bottom tab bar, mobile order-matrix branch), and Phase 05 (08-07-26,
✅ VERIFIED — ตีลานนิ่ม/ตีลาน display renames, no UI-pattern changes). Post-program,
`matrix-print-darkmode-fixes_13-07-26` (✅ VERIFIED at code level, commit `c87dccc`) added the
`--surface-focus` and `--seasoning-band`/`--seasoning-band-fg` tokens and the print one-page-fit
footer pattern — see the two dedicated sections below. Read this before
touching `src/app/globals.css`, `src/components/ui/*`, the sidebar/topbar shell,
`src/lib/app-settings.ts`, or any dark-mode/theme/topbar-portal/mobile-responsive logic.
**pguard-redesign is PROGRAM COMPLETE (08-07-26)** — all 5 phases verified, folder archived to
`process/features/pguard-redesign/completed/pguard-redesign_07-07-26/`. Every pattern documented
below is stable, live code; any new UI work (e.g. persisting the weight/ปี๊บ KPI inputs, see
`process/features/pguard-redesign/backlog/`) should open its own new task folder rather than
reopen this program.

## Scope

Covers: the pguard token layer (colors/typography/spacing/radius/elevation), the semantic-alias
contract components must follow, the shared presentational primitives in `src/components/ui/*`,
the sidebar+topbar app shell, the dark-mode mechanism, and the print-font interaction.

Does NOT cover: order-form domain logic (see root `all-context.md`), auth/session (see
`auth/all-auth.md`), database/schema (see `database/all-database.md`), or test commands/routing
(see `tests/all-tests.md`).

## Source of truth

- Token source: `process/features/pguard-redesign/references/design_tokens/*.css` (handoff
  originals — copied verbatim into `globals.css`, do not hand-edit values without checking here
  first)
- Live implementation: `src/app/globals.css`, `src/lib/fonts.ts`, `src/components/ui/*`,
  `src/app/nav.tsx` / `src/app/nav-links.tsx` / `src/app/topbar.tsx` /
  `src/components/theme-toggle.tsx`, `src/app/(main)/layout.tsx`
- Phase plan/report: `process/features/pguard-redesign/completed/pguard-redesign_07-07-26/phase-01-foundation_PLAN_07-07-26.md`
  and `phase-01-foundation_REPORT_07-07-26.md`

## pguard token reference

All tokens live in `src/app/globals.css` on `:root` (light) with a `[data-theme="dark"]`
override block, plus a `@media (prefers-color-scheme: dark) :root:not([data-theme])` first-paint
fallback that sets the same dark values.

**Raw palette (do not consume directly in components — see Semantic-alias contract below):**
- Brand green ramp `--green-50`..`--green-950` (interactive base `--green-500` = `#1FA971`; brand
  anchor `--green-900` = `#0E3B2E` "Deep Forest")
- Accent amber ramp `--amber-50`..`--amber-900` (accent base `--amber-500` = `#F59E0B`)
- Neutrals (green-tinted slate) `--n-0`..`--n-950`
- Semantic status colors: `--success`/`--success-bg`, `--warning`/`--warning-bg`,
  `--danger`/`--danger-bg`, `--info`/`--info-bg`, plus `--on-amber`

**Scale tokens:**
- Typography: type scale + `--lh-*` line-heights (Thai-tuned) + `--ls-thai: 0.01em` tracking
- Spacing (4pt base): `--sp-1` (4px) .. `--sp-12` (96px)
- Radius: `--r-xs` 4px / `--r-sm` 6px / `--r-md` 8px / `--r-lg` 11px / `--r-xl` 14px /
  `--r-2xl` 18px / `--r-full` 999px
- Elevation: `--sh-xs`..`--sh-xl` + `--sh-brand` / `--sh-accent` (soft green/amber-tinted shadows,
  no shadows on primitives by default — cards use a 1px border, not a shadow)
- Touch target: `--tap: 44px` (mobile touch minimum — relevant for Phase 04)

## Semantic-alias contract (LOAD-BEARING — read before writing any component)

Components MUST reference the SEMANTIC aliases below, never the raw palette vars
(`--green-*`/`--amber-*`/`--n-*`) directly. This is what makes dark mode a single flip of
`[data-theme]` instead of a per-component rewrite.

| Alias | Light value | Purpose |
|---|---|---|
| `--bg-app` | `var(--n-50)` | page background |
| `--bg-surface` | `var(--n-0)` | card/panel/sidebar/topbar background |
| `--bg-raised` | `var(--n-0)` | elevated surface (modal) |
| `--bg-sunken` | `var(--n-100)` | inset/well background |
| `--bg-inverse` | `var(--green-900)` | inverted surfaces |
| `--border` / `--border-strong` | `var(--n-200)` / `var(--n-300)` | 1px hairline borders (default elevation strategy — no drop-shadow) |
| `--text-strong` / `--text` / `--text-muted` / `--text-faint` | `var(--n-900..400)` ramp | text hierarchy by lightness, not weight |
| `--text-on-brand` | `#FFFFFF` | text on brand-colored surfaces |
| `--brand` / `--brand-int` / `--brand-int-hover` | `var(--green-900)` / `var(--green-500)` / `var(--green-600)` | brand anchor vs interactive (buttons/links) vs its hover |
| `--accent` / `--accent-hover` | `var(--amber-500)` / `var(--amber-600)` | amber accent, sparingly |
| `--focus-ring` | `rgba(31,169,113,.45)` | the green focus ring — apply as `0 0 0 4px var(--focus-ring)` on `:focus-visible` |
| `--surface-focus` | `var(--n-0)` (white-ish) | qty-cell / notes-input focus BACKGROUND (added `matrix-print-darkmode-fixes_13-07-26`) — dark-mode value is a distinct near-canvas shade, deliberately NOT white and NOT equal to `--text`, so typed digits stay legible while focused |
| `--seasoning-band` / `--seasoning-band-fg` | `var(--amber-800)` / `#FFFFFF` | เครื่องปรุง column-group header band background/text (added `matrix-print-darkmode-fixes_13-07-26`) — dark-mode override lightens/saturates the band so it isn't muddy against the dark canvas; `--amber-800` itself is UNCHANGED (still consumed directly by `chip.tsx`'s accent variant) |

Dark-mode values for every alias above live in the `[data-theme="dark"]` block in
`globals.css` — do not add a new alias without adding both light and dark values.

**Gotcha — `focus:bg-white` is a dark-mode trap:** any Tailwind utility that hardcodes a literal
color (`bg-white`, `text-white`, etc.) on a `focus:`/`hover:` state silently breaks dark mode even
if the resting state is fully token-driven — the fix found in `matrix-print-darkmode-fixes_13-07-26`
was that `order-matrix.tsx`'s qty-cell and notes-input `focus:bg-white` forced a white background
under dark-mode near-white text, making typed digits invisible. Always route focus/hover/active
state colors through a semantic token (`--surface-focus` etc.), never a literal Tailwind color
utility, even for states that "only show briefly."

**Tailwind v4 wiring:** `@theme inline` in `globals.css` maps the palette + semantic aliases to
Tailwind color utilities (`--color-*`) and `--font-sans` (Thai)/`--font-mono`. Prefer Tailwind
utility classes generated from these tokens over ad-hoc inline styles.

## Fonts

`src/lib/fonts.ts` uses `next/font/google` (self-hosted at build, no runtime CDN dependency):

- `IBM_Plex_Sans_Thai` — subsets `thai`+`latin`, weights 300–700, CSS var `--font-thai`,
  `display: swap` — the default body/UI font (handles Thai AND Latin glyphs in one shaped family)
- `IBM_Plex_Sans` — Latin-only companion, weights 400–700, CSS var `--font-latin`
- `IBM_Plex_Mono` — weights 400–600, CSS var `--font-mono` — **use for numbers, dates, IDs**
  (matrix cells, order totals, print figures) to match the pguard prototype's tabular-number
  treatment
- Combined `fontVariables` export applies all three var classes to `<html>` in the ROOT
  `src/app/layout.tsx` (not `(main)/layout.tsx`)
- Sarabun is fully removed: `src/app/fonts.css` deleted, all 6 self-hosted `Sarabun-*.woff2`
  deleted, `sarabunFontFamily` export removed

**Print-font note:** `src/styles/print.css` sets NO `font-family` of its own — the print sheet
inherits the global body font. The Sarabun→IBM Plex swap therefore re-typefaces `/print` too.
This was verified faithful in Phase 01 (Thai tone marks shape correctly, column fit preserved,
grand total 446 intact — agent-probe gate `G-print-font`). If a future phase's font/CSS change
regresses print fidelity, the documented escape hatch is pinning `.print-canvas` to an explicit
Thai font stack in `print.css` WITHOUT touching `print-table.tsx`/`sheet-header.tsx`/
`get-sheet-for-print.ts` structure — see Phase 01 plan's `E-PRINT-FONT` instruction for the exact
pattern.

## Shared primitives — `src/components/ui/*`

Presentational, token-driven. Phases 02–05 MUST reuse these rather than reinventing equivalents:

- `button.tsx` — variants primary (brand-int, hover brand-int-hover, active `translateY(1px)`) /
  secondary (white + 1.5px border-strong) / danger-ghost (red)
- `input.tsx` — green focus ring `0 0 0 4px var(--focus-ring)`
- `card.tsx` — `--r-lg` radius, 1px border, NO shadow (hairline-border elevation strategy)
- `modal.tsx` — scrim `rgba(8,20,15,.5)` + `backdrop-blur(3px)`, fade+scale `.96→1` 200ms,
  click-scrim/Esc closes
- `toast.tsx` — green-900 background, bottom-center, ~2.2s auto-dismiss
- `chip.tsx` — tone pill (status labels)
- `status-dot.tsx` — active/working/offline states + ring
- `switch.tsx` — 200ms slide toggle

`src/components/theme-toggle.tsx` is the dark-mode control (not in `ui/` — it's shell-specific,
not a generic primitive): flips `data-theme` on `<html>`, persists to `localStorage`, reads
current theme via `useSyncExternalStore` (hydration-safe — do not replace with
`useState`+`useEffect`, which causes a flash/hydration mismatch).

## Shell structure

- `src/app/nav.tsx` — SERVER component, 216px sidebar, `--bg-surface` + 1px `--border`
  right edge. Reads session/role via `await auth()`. Renders: green-gradient (`160deg
  #1FA971→#0E3B2E`) "ย" logo + product name at top; the client `NavLinks` component; a user card
  (avatar/name/role) + logout button at the bottom. The logout button's accessible name MUST stay
  exactly "ออกจากระบบ" (asserted by `e2e/auth.spec.ts`). Since `responsive-drawer-sidebar_11-07-26`
  the `<aside>` also carries `id="app-sidebar"` (for the topbar hamburger's `aria-controls`) — all
  positioning/visibility classes now live on the NEW `sidebar-shell.tsx` wrapper (below), not here;
  `nav.tsx` itself is otherwise byte-identical and stays a server component.
- `src/app/nav-links.tsx` — CLIENT component (`"use client"`, `usePathname`), owns ONLY
  active-link highlighting (active = `--green-50` bg + `--green-800` text). Receives `role` as a
  prop from the server shell — do NOT convert `nav.tsx` itself to a client component, or the
  server-side session read is lost. Three groups, Lucide icons (stroke 2):
  - **ปฏิบัติการ**: `/orders` (ออเดอร์รายวัน), `/summary` (สรุปยอดผลิต), `/history` (ประวัติออเดอร์)
  - **ข้อมูลหลัก**: `/shops` (จัดการร้านค้า), `/products` (จัดการสินค้า), `/admin/users` (ผู้ใช้, admin-only)
  - **ระบบ**: `/settings` (ตั้งค่าระบบ, admin-only) — repointed from `/settings/db` (removed
    11-07-26, `remove-settings-db` plan; the establishment/display panel below is now the sole
    `/settings` surface)
  - `adminOnly` gating on nav items is COSMETIC ONLY — the real security boundary is server-side
    `requireAuth(role)`, unaffected by nav changes.
- `src/app/topbar.tsx` — 62px, `--bg-surface` + 1px `--border` bottom edge. Left: (since
  `responsive-drawer-sidebar_11-07-26`) a ☰ hamburger button (`hidden md:inline-flex`,
  `aria-controls="app-sidebar"`) then route-derived page title. Right: TH/EN toggle (EN not
  supported yet → toast "ยังไม่รองรับ EN"), dark-mode toggle (sun/moon Lucide icons), and an EMPTY
  `#topbar-actions` slot/portal placeholder for per-page controls. **Phase 02 fills this slot**
  with the order-matrix's print/save actions — do not move existing Order Pad controls into it
  before Phase 02.
- `src/app/(main)/layout.tsx` — composes sidebar (`nav.tsx`, wrapped in `sidebar-shell.tsx` since
  `responsive-drawer-sidebar_11-07-26`) + `topbar.tsx` + a scrollable `<main>`. This is the layout
  every authenticated app route renders under (route group, no URL segment — see root
  `all-context.md` for the route-group pattern rationale).

See § Responsive Drawer Sidebar Shell below for the full 3-tier breakpoint mechanism.

## Dark-mode mechanism

- `[data-theme="dark"]` attribute on `<html>` is the source of truth; `theme-toggle.tsx` flips it
  and persists the choice to `localStorage`.
- **No-flash bootstrap:** an inline `<script>` in `<head>` (in ROOT `src/app/layout.tsx`) reads
  the persisted theme from `localStorage` and sets `data-theme` BEFORE paint — required to avoid
  a light-mode flash on a dark-mode reload. Do not remove this script when touching root layout.
- **First-paint fallback:** `@media (prefers-color-scheme: dark) :root:not([data-theme])` sets
  the same dark token values for the rare case where the inline script hasn't run yet (JS
  disabled or slow parse) and no explicit `data-theme` is present.
- Both themes must stay legible — verified in Phase 01 via agent-probe (light bg `#F6F8F7`, dark
  bg `#0A0F0D`; screenshots at `probe-orders-light/dark.png`).

## Settings persistence pattern (`src/lib/app-settings.ts`, added pguard-redesign Phase 02)

The `AppSetting` Prisma model existed since the original schema but was unused until Phase 02.
`src/lib/app-settings.ts` exposes `get`/`set` helpers over `prisma.appSetting` (key/value rows) —
**no schema change**. Established keys: `placeName` / `recorderName` / `recorderRole` /
`hlFilled`. Consumed by `src/app/(main)/settings/actions.ts` + `settings-panels.tsx`
(establishment + display panels, ADMIN-gated). This is now the SOLE `/settings` surface — the
sibling `/settings/db` runtime DB-connection route was removed 11-07-26 (`remove-settings-db`
plan; its dead "การเชื่อมต่อฐานข้อมูล" card was also removed from `settings-panels.tsx`). This is
the reference pattern for any future
small persisted app-wide setting: add a key to the `AppSetting` table via `get`/`set`, never a new
schema column, unless the value needs to be queried/joined (in which case use a real column).

**Known deferred gap:** the saved `placeName` value is PERSISTED (proven by the settings panel
round-trip) but not yet reflected LIVE in the topbar, sidebar, or print header. The print header
(`sheet-header.tsx`) is an IMMUTABLE file (program HARD STOP), so wiring `placeName` there is
explicitly out of scope until the print-header immutability constraint is relaxed by a future
phase decision. `hlFilled` has the same persist-but-not-wired-as-default gap for the matrix's
local highlight toggle. Both are documented Phase 02 within-blast-radius deviations, not bugs.

## `#topbar-actions` portal pattern (established pguard-redesign Phase 02)

`src/app/topbar.tsx`'s empty `#topbar-actions` slot (Phase 01) is filled by per-page controls via
a React portal, not by passing props down through the layout. The pattern, established by
`order-matrix.tsx`'s save/print/lastEdit controls:

1. The page-level client component renders its action buttons via `createPortal(..., el)` where
   `el` is looked up by `document.getElementById("topbar-actions")`.
2. Portal attachment is **hydration-safe** via `useSyncExternalStore` (the same mechanism as
   `theme-toggle.tsx` — do NOT use `useState`+`useEffect`, which causes a flash/attach-race on
   navigation) so the portal reliably re-attaches on every route change.
3. Because the portaled button lives OUTSIDE the `<form>` DOM subtree it submits, it cannot rely
   on DOM-ancestry form submission — associate it back explicitly via the HTML `form="{id}"`
   attribute (e.g. `form="order-sheet-form"`). This was discovered during Phase 02 e2e (a portaled
   `<button type="submit">` does not submit its React-parent form without this).

Any future phase adding a per-page topbar action (Phase 03's สรุปยอดผลิต/ประวัติออเดอร์, Phase 04
mobile) should reuse this exact three-part pattern rather than inventing a new one.

## `order-matrix.tsx` structure reference (pguard-redesign Phase 02)

`src/app/(main)/orders/order-matrix.tsx` is the desktop order-entry surface (replaced the 4-file
Order Pad). Structure, useful as a template for Phase 03's screens that also render dense
data-driven tables:

- **3-tier data-driven header**: tier-1 group bands (สินค้า/เครื่องปรุง, colored by
  `Product.group`), tier-2 grouped by `productId` (colspan = variant count, label =
  `Product.name` — reflects renames automatically since it reads live product data via the
  additive `productId`/`productName` query fields), tier-3 per-column sublabel (packSize/label
  variant). Not hardcoded column labels — always derive from the `columns` query result.
- **Byte-identical payload boundary**: all persisted state funnels through
  `buildOrderPayload(cells, notes)` (`src/lib/order-payload.ts`, pure/importable) which is the
  ONLY place that decides what gets emitted as hidden `cell:`/`note:` inputs. Any future
  UI-seam-adjacent screen that writes the same payload (Phase 04 mobile) should import this same
  helper rather than re-deriving the emission rules.
- KPI strip + totals row are LIVE via `computeColumnTotals`/`computeGrandTotal` (`totals.ts`,
  unchanged) — see the Settings persistence pattern above for the two KPI cells (weight/peep)
  that remain deliberately transient/UI-only (backlog:
  `process/features/pguard-redesign/backlog/weight-peep-persistence_NOTE_07-07-26.md`).

## สรุปยอดผลิต (`/summary`) bar-chart pattern (pguard-redesign Phase 03)

`src/app/(main)/summary/page.tsx` — server component, `requireAuth`, `force-dynamic`. Fetches the
most-recent `OrderSheet` OR one selected via `?date`(+`?location`) using a local UTC-midnight
`parseDbDate` helper (mirrors `get-sheet-for-print.ts`'s date-key convention). Builds
`OrderLineCell[]` from the sheet's `OrderLine` rows, then derives everything from `totals.ts` and
the new `src/lib/summary.ts` — **no re-implementation of column-total arithmetic**:

- **LEFT: 20-column bar Card** — one bar per `ProductVariant.printOrder` (1..20), width = CSS
  percentage of `computeColumnTotals(cells)[printOrder]` against the max column total. Bar color
  is green (`--brand-int`) for `product.group === "GOODS"` (สินค้า) and amber (`--accent`) for
  `"SEASONING"` (เครื่องปรุง) — same two-group color convention as the matrix header tiers.
  `data-testid="bar-{printOrder}"` + `data-qty` attrs for e2e assertions. Footer row uses
  `--green-50` background with the grand total (`computeGrandTotal(cells)`).
- **KPI strip**: น้ำหนัก / ปี๊บ render `"—"` (not persisted — see Known deferred gap below and
  `backlog/weight-peep-persistence_NOTE_07-07-26.md`); ร้านที่สั่ง = shop count with ≥1 nonzero
  cell or note; รวมจำนวน = `computeGrandTotal`, `data-testid="grand-total"`.
- **RIGHT: top-8 shops Card** — `src/lib/summary.ts` exports two pure helpers (imports only
  `totals.ts`, unit-tested in `src/lib/__tests__/summary.test.ts`, 7 tests):
  - `computeShopTotals(cells: OrderLineCell[]): Record<number, number>` — Σ qty per
    `rosterOrder` (per-shop total across all 20 columns).
  - `topShops(cells, n = 8): { rosterOrder, qty }[]` — qty-desc, `rosterOrder`-asc tiebreak,
    sliced to `n` (default 8).
  Any future screen needing a per-shop leaderboard (mobile summary, Phase 04) should import these
  same two helpers rather than re-deriving shop-total arithmetic.
- Empty state: "ยังไม่มีใบออเดอร์" when no sheet exists for the resolved date.

**Reusable pattern for any future dense-summary screen:** column-level aggregates come from
`totals.ts` (unchanged), shop-level aggregates come from `summary.ts` (new, pure, additive) —
never mix the two derivations in one place.

## ประวัติออเดอร์ (`/history`) groupBy-aggregate pattern (pguard-redesign Phase 03)

`src/app/(main)/history/page.tsx` — server component, `requireAuth`, `force-dynamic`. Lists REAL
`OrderSheet` rows (`findMany`, date-desc) with per-sheet aggregates computed via **exactly one**
`prisma.orderLine.groupBy({ by: ["sheetId", "shopId"], _sum: { qty: true } })` reduced in memory to
`{ units, shopCount }` per sheet, **unioned with one** `prisma.noteLine.groupBy(...)` for note-only
shops (shops with a note but zero ordered qty — matches the matrix's `orderedCount` semantics). No
per-sheet N+1 query loop.

- Table columns: BE-mono date (`be-date.ts`), th-TH weekday, ร้านที่สั่ง (shopCount), รวมหน่วย
  (units), a unit bar (amber if today, per `--accent`), น้ำหนัก `"—"`, ปี๊บ `"—"`, status chip,
  "เปิดใบงาน" link to `/orders/{id}`.
- **Today vs. closed**: compared via UTC-midnight date-key (`dbDayKey` vs. `todayKey`), never
  naive `new Date()` comparison — today = amber row + "กำลังกรอก" chip; past = "ปิดยอดแล้ว" chip.
  This mirrors the same UTC-midnight convention `get-sheet-for-print.ts` and `/summary`'s
  `parseDbDate` use.
- Current-month footer aggregates (วันทำการ / รวมหน่วย / เฉลี่ย) — omits the weight aggregate
  (not persisted, same known gap as `/summary`'s KPI strip).
- Empty state when no sheets exist.

**Reusable pattern for any future list-with-aggregates screen:** prefer `groupBy` + in-memory
reduce over per-row queries; union multiple `groupBy` calls in memory rather than one large raw
query when the aggregation sources are semantically different (ordered qty vs. note-only shops).

## Mobile responsive pattern (pguard-redesign Phase 04)

**Architecture: RESPONSIVE shared-component — NOT a separate `(mobile)` route group.** The mobile
build is a Tailwind `md` (768px) breakpoint swap over the SAME components/state, never a parallel
route tree or a second save path.

- **Shell breakpoint swap (`src/app/(main)/layout.tsx`):** now an `async` server component
  reading `auth()` for `role`. Sidebar (`<Nav/>`) was originally wrapped `hidden md:block` here —
  **superseded by `responsive-drawer-sidebar_11-07-26`**, which replaced that wrapper with
  `<SidebarShell><Nav/></SidebarShell>` (see § Responsive Drawer Sidebar Shell below); the phone
  tier (<768px) is still fully hidden, now via `sidebar-shell.tsx`'s own responsive classes rather
  than the old `md:block` div. `<BottomTabBar role/>` (`src/components/bottom-tab-bar.tsx`) still
  renders below `md`, unchanged; `<main>` still gets `pb-16 md:pb-0` so the fixed bottom bar never
  covers content.
- **Bottom tab bar** (`src/components/bottom-tab-bar.tsx`): 3 mobile-only tabs — ร้านค้า
  (`/orders`), สรุปยอด (`/summary`), ผู้ใช้ (`/admin/users`, **ADMIN-only** — hidden for STAFF via
  a `role` prop, mirrors the same server-side role boundary `nav-links.tsx` uses, not a separate
  gate). Active state `#15885B` via `usePathname` (same convention as `nav-links.tsx`). Tap
  targets `min-h-12` (48px) — see the `--tap: 44px` token below.
- **Order-matrix mobile branch is a VIEW over the SAME state, NOT a new surface**
  (`src/app/(main)/orders/order-matrix.tsx`): a breakpoint-gated `md:hidden` mobile branch reads
  and writes the SAME `cells`/`notes` state, the SAME `<form id="order-sheet-form">`, and the
  SAME `buildOrderPayload(cells, notes)` (`src/lib/order-payload.ts`) as the desktop matrix
  (`hidden md:flex`, unchanged). This is what makes payload byte-identity STRUCTURAL rather than
  something that needs a separate test. Presentational subcomponents `order-mobile-list.tsx` +
  `order-mobile-entry.tsx` live in `orders/` (not a `(mobile)` folder) and receive the SAME
  `setCell`/`setNote` setters. The mobile save button is `type="submit" form="order-sheet-form"`
  — never a separate save action; any future mobile-adjacent surface needing the same payload
  MUST follow this same pattern (shared state + shared form id + `buildOrderPayload`), not
  re-derive a save path.
- **Full-viewport entry overlay:** the per-shop stepper entry is a `fixed z-50` overlay that
  covers the bottom tab bar (no shared-state signal needed to hide it — it's simply on top).
- **Responsive stack pattern (reused for any future single-column-below-md screen):**
  `/summary` and `/admin/users` both use the same one-line responsive idiom —
  `grid-cols-[2fr_1fr] md:grid-cols-[2fr_1fr]` style breakpoint classes, or a `hidden md:block`
  (desktop) / `md:hidden` (mobile) pair for structurally different desktop-vs-mobile markup (used
  by `admin/users/*`'s desktop table vs. NEW `users-mobile.tsx` card list, both driving the SAME
  server actions — editRole/resetPassword/de-/activate — no new write path).
- **Touch target token:** `--tap: 44px` (defined in the pguard token reference above) is the
  mobile touch-target minimum; Phase 04 bumped steppers/prev-next/back buttons to `h-11 w-11`
  (44px) to satisfy it — the design handoff prototype used 40px, plan compliance wins.
- **Login responsive:** `src/app/(auth)/login/page.tsx` — md+ keeps the split-hero; below `md` a
  green gridded hero + white bottom-sheet (`radius 18px 18px 0 0`) holds the UNCHANGED
  `LoginForm` (`name=username`/`password` preserved — this is load-bearing for `auth.spec.ts`).

**Reusable pattern for any future mobile-adjacent screen:** breakpoint-gate the SAME
component/state at `md`; never fork a second route group, save path, or state store for mobile.

## Responsive Drawer Sidebar Shell (`responsive-drawer-sidebar_11-07-26`, CODE DONE)

Extends the Mobile responsive pattern above to a genuine 3-tier app shell (phone / tablet /
desktop), fixing an iPad-portrait (768px) crowding problem where the old fixed 216px sidebar and
the 20-col order-matrix competed for space.

- **Three tiers, ONE shared store:** phone (<768px) — unchanged, no sidebar, no hamburger,
  `BottomTabBar` only. Tablet (768–1023px) — sidebar becomes a hidden off-canvas drawer, opened by
  a new topbar ☰ hamburger, closed by backdrop click / Escape / route change. Desktop (≥1024px) —
  sidebar fixed and open by default, but the SAME ☰ hamburger can now genuinely collapse/reopen it
  (this is a LOCKED design decision — the desktop hamburger is functional, not decorative).
- **`src/lib/sidebar-drawer-store.ts`** (NEW) — a tri-state (`boolean | null`) external mutable
  store mirroring `theme-toggle.tsx`'s exact pattern: module-level state + a `window` CustomEvent +
  `useSyncExternalStore` (NOT React Context — this codebase's one established external-state
  idiom). `null` = auto (pure-CSS responsive default: closed `<lg`, open `≥lg`, zero
  SSR/hydration-mismatch risk since it's a static Tailwind class list, not a stored preference).
  `true`/`false` = explicit force, set by `toggleDrawer()`/`openDrawer()`/`closeDrawer()`.
  `toggleDrawer()` resolves "currently visible" via `window.matchMedia('(min-width: 1024px)')`
  (the SAME technique `theme-toggle.tsx` uses for `prefers-color-scheme`) only when the state is
  still `null`, then sets the explicit opposite. `closeDrawer()` always sets `false` explicitly
  (never back to `null`), so an Escape-close at tablet width doesn't silently reopen the sidebar if
  the viewport is later resized past 1024px. Two hooks exported: `useDrawerOpen()` (raw tri-state)
  and `useDrawerVisible()` (resolved boolean — dual-subscribed to the store event AND a
  `matchMedia` change listener, used for `aria-expanded` and any "is it ACTUALLY visible" branch).
- **`src/app/(main)/sidebar-shell.tsx`** (NEW) — client wrapper that owns everything `nav.tsx`
  itself does NOT: the width-reservation outer div (`lg:w-[216px]` open / `lg:w-0
  lg:overflow-hidden` explicitly closed — this is what makes the desktop collapse actually reclaim
  layout space, not just visually hide behind a blank gap), the backdrop (`fixed inset-0 z-40
  bg-black/40`, tablet-only via `md:block lg:hidden`, conditionally MOUNTED not just
  opacity-hidden so it never intercepts clicks when closed), and the transform/position wrapper
  around `<Nav/>`'s server output (passed through as `children` — a server component CAN be a
  client component's children without becoming client itself). `<aside>` gets `fixed inset-y-0
  left-0 z-50 ... transition-transform duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
  motion-reduce:transition-none lg:static lg:z-auto lg:transition-none` plus the state-dependent
  translate classes.
- **Focus + accessibility:** hamburger has `aria-expanded` (bound to `useDrawerVisible()`),
  `aria-controls="app-sidebar"` (matches the `id` added to `nav.tsx`'s `<aside>`), `aria-label`.
  On tablet-drawer open, focus moves into the drawer (gated `!isDesktopMatch` — no focus-steal on
  the non-modal desktop collapse). Escape closes + returns focus to the hamburger.
  `motion-reduce:transition-none` on both the drawer transform and backdrop opacity.
- **Playwright dual-project wiring** (mirrors the existing `mobile` project pattern): a NEW
  `tablet` project (820×1180, `playwright.config.ts`) runs ONLY `e2e/sidebar-drawer.spec.ts`
  (`testMatch`); `chromium`'s `testIgnore` was widened to also exclude that spec
  (`/mobile\.spec\.ts|sidebar-drawer\.spec\.ts/`) so it doesn't double-run at the wrong viewport.
  `e2e/sidebar-desktop-collapse.spec.ts` needs no new project — it runs under `chromium`'s existing
  default (~1280×720, already desktop-tier) viewport.
- **Known-gap residuals (Agent-Probe only, pending-manual as of 11-07-26 UPDATE PROCESS):** iPad
  768px/1024px real-viewport usability, dark-mode legibility with the drawer/backdrop open, and
  `prefers-reduced-motion` OS-level behavior were NOT re-verified in this closeout session (no
  browser/dev-server session available) — plan stays `CODE DONE`, not `VERIFIED`, until a short
  manual pass confirms these three rows.

**Reusable pattern for any future two-client-sibling-needs-shared-state case:** follow
`sidebar-drawer-store.ts`'s exact shape (module-level state + CustomEvent +
`useSyncExternalStore`, matching `theme-toggle.tsx`) rather than introducing React Context — this
is now the codebase's established external-client-state idiom, proven twice.

## Order-matrix location picker + variable-row roster (`shop-location-roster_13-07-26`, ✅ VERIFIED AT CODE LEVEL)

No new tokens or primitives — this is a data-driven behavior change layered on the existing
components. `orders/new-sheet-form.tsx`'s location field changed from free text to a `<select>`
populated by a server query of distinct, `active:true`-filtered shop locations. `order-matrix.tsx`
(desktop + mobile branches) and both print routes now render a VARIABLE row count (no more fixed
29-row roster) — the visible row-number label switched from `rosterOrder` to a new per-location
`displayNo` (1..N), while `data-testid`/React `key`/print `?slots=` filtering keep using the
unchanged, globally-unique `rosterOrder` — see `database/all-database.md` §Per-Location Shop Roster
for the full field-split rationale (`src/lib/roster.ts` `buildLocationRoster` is the single source
of truth both surfaces import). `print.css`'s page-height budget now flexes with row count (a
comment was added noting this; no rule change was required). Any future roster-adjacent screen
should import `buildLocationRoster` directly rather than re-deriving the filter/fallback/renumber
logic — same "one shared helper, no forked logic" discipline as `order-payload.ts` and `totals.ts`.

## Print one-page-fit footer pattern (`matrix-print-darkmode-fixes_13-07-26`)

The combined-daily print footer's note-tally list (`src/app/print/print-table.tsx` +
`src/styles/print.css` `.print-footer`/`.tally-col`) was overflowing to a 2nd A4-landscape page
once a day had more than a handful of หมายเหตุ notes. Fixed WITHOUT removing/truncating any note:

- `.tally-col` switched from a single vertical list to a 4-column CSS layout (`column-count: 4`)
  with the column widened (reallocated from `.weight-col`, which only needs two short lines) and
  font-size tightened to 7pt.
- The table/header/body/totals-row mm contract (`<colgroup>`, 29 rows, totals-row-as-last-tbody-row)
  is completely UNTOUCHED — only the footer block below the table changed.
- New e2e gate `G9` in `e2e/print.spec.ts` asserts the ACTUAL rendered `page.pdf()` page count is
  1 (by counting `/Type /Page` object occurrences in the PDF byte buffer) rather than a DOM-height
  heuristic — Chromium's on-screen flow layout and `@page` print pagination are separate layout
  passes, so a DOM-height proxy can diverge from the real printed page count. Any future
  print-layout fix needing a "does it fit" gate should follow this same PDF-page-count pattern.
- Real Chrome print-preview visual confirmation remains Agent-Probe only (not yet re-verified with
  a live browser) — see `process/general-plans/backlog/matrix-darkmode-print-agent-probe-residuals_NOTE_13-07-26.md`.

## Update triggers

Update this file when: a new token is added, a semantic alias changes value or a new one is
added, a new shared primitive is added to `src/components/ui/*`, the shell structure changes
(new nav group, new topbar control), the dark-mode mechanism changes, or a later phase's
print-font decision changes. Run `vc-audit-context` after structural edits.

## Routing

Read `all-context.md` first, then this file, then the specific source file for the task
(`globals.css` for tokens, `src/components/ui/{name}.tsx` for a primitive, `nav.tsx`/
`nav-links.tsx`/`topbar.tsx` for the shell). For test commands covering UI (Playwright routes/
e2e), see `tests/all-tests.md`.
