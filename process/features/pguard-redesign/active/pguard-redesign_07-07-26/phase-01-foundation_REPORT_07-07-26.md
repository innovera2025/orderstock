---
phase: phase-01-foundation
date: 2026-07-07
status: COMPLETE
feature: pguard-redesign
plan: process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-01-foundation_PLAN_07-07-26.md
metadata:
  node_type: memory
  type: report
  feature: pguard-redesign
  phase: phase-01
---

# Phase 01 — Foundation — EXECUTE Report (DRAFT)

DRAFT for EVL confirmation. All A–F checklist items implemented; all validate-contract gates
run and green (5 automated + 2 hybrid + 3 agent-probe). No HARD STOP hit; no data path touched.

## What Was Done

### A — pguard tokens → `src/app/globals.css`
- A1–A3: Copied the full pguard token layer VERBATIM from `references/design_tokens/*.css` onto
  `:root` (light): raw palette (green/amber/neutrals 50..950), semantic success/warning/danger/info
  + bg, status-* + rings, `--on-amber`; typography scale + Thai-tuned line-heights + `--ls-thai`;
  spacing (`--sp-*`), radius (`--r-xs..--r-full`), elevation (`--sh-*`), `--tap`; semantic aliases
  (`--bg-*`, `--border(-strong)`, `--text-*`, `--brand(-int/-int-hover)`, `--accent(-hover)`,
  `--focus-ring`). Added the `[data-theme="dark"]` override block verbatim.
- A4: Replaced old `@theme inline` + body rules. New `@theme inline` maps palette + semantic tokens
  to Tailwind color utilities and `--font-sans`=Thai / `--font-mono`. Body uses `--bg-app` / `--text`
  / the IBM Plex Thai stack. Removed `--background/--foreground/--font-sarabun` and the bare
  `prefers-color-scheme` block; added a `@media (prefers-color-scheme: dark) :root:not([data-theme])`
  first-paint fallback that sets the same dark tokens. Removed `@import "./fonts.css"`.

### B — Fonts (IBM Plex via next/font/google; Sarabun removed)
- B0: `pnpm add lucide-react` (exit 0).
- B1: `src/lib/fonts.ts` rewritten with `next/font/google` — IBM_Plex_Sans_Thai (subsets thai+latin,
  300–700, `--font-thai`, swap), IBM_Plex_Sans (latin, 400–700, `--font-latin`), IBM_Plex_Mono
  (latin, 400–600, `--font-mono`); exports a combined `fontVariables` class string.
- B2: grep-first confirmed only `src/app/fonts.css` `url()`-referenced the woff2. Deleted
  `src/app/fonts.css` + all 6 `public/fonts/Sarabun-*.woff2`. Font vars applied to `<html>` in the
  root layout.

### C — App shell
- Root `src/app/layout.tsx` (E-ROOT-LAYOUT): applies the 3 IBM Plex font-var classes to
  `<html lang="th">` + an inline no-flash `<script>` in `<head>` that reads persisted theme from
  localStorage and sets `data-theme` before paint.
- `src/app/nav.tsx` (E-NAV-SPLIT): SERVER sidebar (216px) — keeps `await auth()`; green-gradient
  "ย" logo + product name; user card (avatar/name/role) + logout. Client active-link half split into
  `src/app/nav-links.tsx` (`usePathname`; active = green-50 bg / green-800 text) with the exact 3
  groups + routes + Lucide icons (ปฏิบัติการ /orders /summary /history · ข้อมูลหลัก /shops /products
  /admin/users · ระบบ /settings/db; admin-only items gated cosmetically, server auth still enforces).
- `src/app/topbar.tsx` (C3): 62px topbar — route-derived title, TH/EN toggle (EN → "ยังไม่รองรับ EN"
  toast), dark-mode toggle, and an EMPTY `#topbar-actions` per-page slot (E-CONTROLS — orders
  save/print controls NOT moved this phase).
- `src/components/theme-toggle.tsx`: flips `data-theme` on `<html>`, persists to localStorage; reads
  current theme via `useSyncExternalStore` (hydration-safe, no setState-in-effect).
- `src/app/(main)/layout.tsx`: composes sidebar + topbar + scrollable `<main>`.

### D — Shared primitives → `src/components/ui/*`
- `button.tsx` (primary/secondary/danger-ghost, active translateY(1px), green focus ring),
  `input.tsx` (green focus ring `0 0 0 4px var(--focus-ring)`), `card.tsx` (r-lg, 1px border, no
  shadow), `modal.tsx` (scrim rgba(8,20,15,.5)+blur3px, fade+scale .96→1 200ms, scrim/Esc close),
  `toast.tsx` (green-900, bottom-center, ~2.2s), `chip.tsx` (tone pill), `status-dot.tsx`
  (active/working/offline + ring), `switch.tsx` (200ms slide). All token-driven, presentational.

### E — Stub routes
- `src/app/(main)/summary/page.tsx` + `src/app/(main)/history/page.tsx`: `requireAuth()` + heading +
  "กำลังพัฒนา (เฟส 03)".

### F — Scope fence
- Immutable set byte-unchanged; Order Pad files intact (see Test Gate Outcomes G-scopefence).

## What Was Skipped or Deferred
- Nothing in Phase-01 scope skipped. Full Order Pad matrix replacement, per-page topbar action
  wiring, /summary + /history real builds, mobile, and product renames remain in Phases 02–05 as
  planned.

## Test Gate Outcomes

| Gate | Tier | Result | Evidence |
|---|---|---|---|
| G-build | Fully-Automated | PASS | `pnpm build` exit 0; all routes incl. `/summary` + `/history`; @theme resolved; IBM Plex Thai subset resolved at build; lucide-react icons resolved |
| G-units | Fully-Automated | PASS | `pnpm test` → 13 files / 69 tests pass (totals 446 fixture green). Count 70→69 only because the obsolete Sarabun-assertion unit was removed with the font swap |
| G-sarabun | Fully-Automated | PASS | grep returns only a comment reference in smoke.test.ts (comment-only allowed) |
| G-lint | Fully-Automated | PASS | `pnpm lint` exit 0 |
| G-scopefence | Fully-Automated | PASS | `git diff --stat` on the immutable set = EMPTY; 446 fixture untouched; all 4 Order Pad files present |
| G-routes | Hybrid | PASS | `pnpm exec playwright test` 19/19 — routes reachable through the new shell |
| G-e2e-regress | Hybrid | PASS | 19/19 incl. orders D1 (446 persists), print G1–G8, auth logout accessible name "ออกจากระบบ" (auth.spec:47) |
| G-theme | Agent-Probe | PASS | Probe: light bg #F6F8F7, dark toggle → bg #0A0F0D, reload persists `data-theme=dark`; both themes legible (screenshots probe-orders-light/dark.png) |
| G-ibmplex-thai | Agent-Probe | PASS | Build resolved the `thai` subset; computed body font = `"IBM Plex Sans Thai", ...`; Thai tone marks shape correctly in screenshots. Named fallback NOT needed |
| G-print-font | Agent-Probe | PASS | `/print/daily/2026-03-13` renders in IBM Plex Sans Thai; Thai tone marks shaped, column fit preserved, grand total 446 intact. No print.css font-pin needed (no regression) |

## Plan Deviations
All within-blast-radius (no hard-stop class); documented per /goal deviation rule:
1. **eslint.config.mjs** — added `design_handoff_order_sheet_system/**` to `globalIgnores`. Rationale:
   a stray untracked design-reference dir at repo root (pre-existing, not app source) tripped
   `react/jsx-no-undef` on a `.jsx` prototype; the existing config already ignores the `process/**`
   copy with the same "lint app code only" intent. Needed for G-lint green.
2. **src/lib/__tests__/smoke.test.ts** — removed the `sarabunFontFamily` assertion (export deleted
   with the font swap; `fonts.ts` now imports `next/font` which cannot evaluate in plain vitest).
   Kept the pure baseline test. Unit count 70→69.
3. **src/styles/print.css** — updated one stale comment (Sarabun→IBM Plex). Comment-only; print.css is
   NOT in the immutable set; no structural/style change.
4. **Component split naming** — created `src/app/nav-links.tsx` (client active-link half) and
   `src/app/topbar.tsx` in addition to the plan-named `theme-toggle.tsx`. Additive, required by
   E-NAV-SPLIT + the topbar; within blast radius.

## Test Infra Gaps Found
- No automated visual-regression baseline for theme/print (light/dark + print screenshot). Residual
  accepted (matches program residual): theme + print fidelity proven by Agent-Probe only. Recommend a
  Playwright light/dark + print screenshot baseline in a later phase (Test Infra Improvement Note).

## Closeout Packet
- Selected plan: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-01-foundation_PLAN_07-07-26.md`
- Finished: all A–F checklist items + all 6 execute-agent CONCERN mitigations (E-ROOT-LAYOUT,
  E-NAV-SPLIT, E-LOGOUT-NAME, E-STUB-AUTH, E-PRINT-FONT, E-CONTROLS, E-SARABUN-DELETE).
- Verified: 5 automated gates green, 2 hybrid gates green (19/19 e2e), 3 agent-probe gates green
  (screenshots captured). No data path touched; 446 fixture + print sheet unchanged.
- Unverified / residual: automated visual-regression baseline (deferred, agent-probe only).
- Classification: **Keep in active/testing** — code-complete + self-verified; awaiting orchestrator
  EVL (vc-tester independent re-run) before VERIFIED promotion.
- Next valid state: EVL (Step 6) — spawn vc-tester to re-run the validate-contract gates.
- How to see the new theme: `pnpm start` → log in → any /(main) route (e.g. `/orders`); topbar
  moon/sun toggles light↔dark and persists; sidebar is the new 216px pguard nav.

## Forward Preview
### Test Infra Found
- Mature: `pnpm test` (vitest, no sandbox), `pnpm build`/`pnpm lint` (no sandbox),
  `pnpm exec playwright test` (hybrid — sandbox `orderstock-sql` up + seeded admin + chromium).
- Gap: no visual-regression baseline for theme/print (agent-probe only).
### Blast Radius Changes
- New durable surface consumed by Phases 02–05: pguard token layer in `globals.css` + `@theme`;
  `src/components/ui/*` primitives (button/input/card/modal/toast/chip/status-dot/switch);
  sidebar+topbar shell (`nav.tsx` server + `nav-links.tsx` client + `topbar.tsx` + `theme-toggle.tsx`);
  the `#topbar-actions` per-page slot (Phase 02 fills it); `/summary` + `/history` route slots.
- `src/lib/fonts.ts` now exports `ibmPlexSansThai/ibmPlexSans/ibmPlexMono` + `fontVariables`
  (no more `sarabunFontFamily`).
### Commands to Stay Green
- `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm exec playwright test` (sandbox up + seeded admin).
### Dependency Changes
- Added `lucide-react` (icon lib). Removed 6 self-hosted Sarabun woff2 + `src/app/fonts.css`.

---

## EVL HANDOFF SUMMARY

**EVL Step 3 — independent re-verification (vc-tester, 07-07-26).** All 10 validate-contract
gates re-run from scratch (NOT trusting execute-agent evidence). Result: every gate green;
scope fence empty; deviations audited and benign.

### Gate table (independent re-run vs claimed)
| Gate | Claimed | Independent | Evidence |
|---|---|---|---|
| G-build | exit 0 | exit 0 ✓ | compiled 9.0s; routes incl `/summary` `/history` |
| G-units | 69/69 | 69/69 ✓ | 13 files; `totals.test.ts` grand-total==446 present + green |
| G-sarabun | none | none ✓ | only a comment in `smoke.test.ts`; 6 woff2 deleted on disk; `fonts.ts` uses `next/font/google` |
| G-lint | exit 0 | exit 0 ✓ | eslint clean |
| G-scopefence | empty | empty ✓ | `git diff --stat` of the 8 immutable paths = 0; 4 Order Pad files exist |
| G-routes | reachable | ✓ | playwright nav green incl. stubs |
| G-e2e-regress | 19/19 | 19/19 ✓ | orders D1 446 persists; print G1–G8; auth logout name asserted green |
| G-theme | flips | ✓ | orchestrator live-confirmed light/dark legible + persists |
| G-ibmplex-thai | renders | ✓ | build resolves `thai` subset; live-confirmed IBM Plex Thai |
| G-print-font | faithful | ✓ | body font = `var(--font-thai)` = IBM Plex Sans Thai; print.css sets NO font-family (comment-only diff); print structural files byte-unchanged; print.spec G2 asserts 446 in print DOM |

### Deviation audit
- `eslint.config.mjs` — added `design_handoff_order_sheet_system/**` to globalIgnores. Additive, benign.
- `smoke.test.ts` — removed ONLY the dead `sarabunFontFamily` import + its assertion (count 70→69);
  baseline "runs the test runner green" test retained. Not a real test drop.
- `print.css` — comment-only (Sarabun→IBM Plex wording); no functional/renderer change.

### Fields
```yaml
gates_green: [G-build, G-units, G-sarabun, G-lint, G-scopefence, G-routes, G-e2e-regress, G-theme, G-ibmplex-thai, G-print-font]
known_gaps: ["no automated visual-regression baseline for theme/print — agent-probe only (accepted program residual)"]
follow_up_stubs: ["/summary stub (Phase 03)", "/history stub (Phase 03)", "#topbar-actions per-page slot (Phase 02 fills)"]
context_partial: []
preliminary_packet_path: process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-01-foundation_REPORT_07-07-26.md
closeout_classification: CLEAN
```
