---
name: context:all-uxui
description: "UI/UX context entrypoint for orderstock — pguard Design System tokens, semantic-alias contract, shared src/components/ui/* primitives, sidebar+topbar shell, dark mode, and print-font behavior"
keywords: ui, ux, design, tokens, pguard, theme, dark mode, dark-mode, sidebar, topbar, nav, primitives, button, input, card, modal, toast, chip, switch, ibm plex, font, focus ring, radius, print font
related: [context:all-tests]
date: 07-07-26
metadata:
  read_when: any UI/token/component/shell/theme work, or any pguard-redesign phase after Phase 01
---

# orderstock — UI/UX (uxui) Context

Entrypoint for the pguard Design System introduced in `pguard-redesign` Phase 01 (07-07-26,
✅ VERIFIED). Read this before touching `src/app/globals.css`, `src/components/ui/*`, the
sidebar/topbar shell, or any dark-mode/theme logic. Consumed by Phases 02–05 of the
pguard-redesign program.

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
- Phase plan/report: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-01-foundation_PLAN_07-07-26.md`
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

Dark-mode values for every alias above live in the `[data-theme="dark"]` block in
`globals.css` — do not add a new alias without adding both light and dark values.

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

- `src/app/nav.tsx` — SERVER component, 216px fixed sidebar, `--bg-surface` + 1px `--border`
  right edge. Reads session/role via `await auth()`. Renders: green-gradient (`160deg
  #1FA971→#0E3B2E`) "ย" logo + product name at top; the client `NavLinks` component; a user card
  (avatar/name/role) + logout button at the bottom. The logout button's accessible name MUST stay
  exactly "ออกจากระบบ" (asserted by `e2e/auth.spec.ts`).
- `src/app/nav-links.tsx` — CLIENT component (`"use client"`, `usePathname`), owns ONLY
  active-link highlighting (active = `--green-50` bg + `--green-800` text). Receives `role` as a
  prop from the server shell — do NOT convert `nav.tsx` itself to a client component, or the
  server-side session read is lost. Three groups, Lucide icons (stroke 2):
  - **ปฏิบัติการ**: `/orders` (ออเดอร์รายวัน), `/summary` (สรุปยอดผลิต), `/history` (ประวัติออเดอร์)
  - **ข้อมูลหลัก**: `/shops` (จัดการร้านค้า), `/products` (จัดการสินค้า), `/admin/users` (ผู้ใช้, admin-only)
  - **ระบบ**: `/settings/db` (ตั้งค่าระบบ, admin-only)
  - `adminOnly` gating on nav items is COSMETIC ONLY — the real security boundary is server-side
    `requireAuth(role)`, unaffected by nav changes.
- `src/app/topbar.tsx` — 62px, `--bg-surface` + 1px `--border` bottom edge. Left: route-derived
  page title. Right: TH/EN toggle (EN not supported yet → toast "ยังไม่รองรับ EN"), dark-mode
  toggle (sun/moon Lucide icons), and an EMPTY `#topbar-actions` slot/portal placeholder for
  per-page controls. **Phase 02 fills this slot** with the order-matrix's print/save actions —
  do not move existing Order Pad controls into it before Phase 02.
- `src/app/(main)/layout.tsx` — composes sidebar (`nav.tsx`) + `topbar.tsx` + a scrollable
  `<main>`. This is the layout every authenticated app route renders under (route group, no URL
  segment — see root `all-context.md` for the route-group pattern rationale).

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
