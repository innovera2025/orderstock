---
name: plan:pguard-redesign-phase-01-foundation
description: "pguard-redesign — Phase 01: pguard tokens + Tailwind @theme, IBM Plex via next/font/google, sidebar/topbar shell, shared UI primitives"
date: 07-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: pguard-redesign
  phase: phase-01
---

# Phase 01 — Foundation

**Program:** pguard-redesign
**Umbrella plan:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/pguard-redesign-umbrella_PLAN_07-07-26.md
**Phase status:** ✅ VERIFIED (07-07-26 — EVL independent re-run: all 10 gates green, scope fence empty, deviations benign; only accepted residual = no automated visual-regression baseline. UP/commit pending.)
**Report destination:** process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-01-foundation_REPORT_07-07-26.md (flat in the program task folder)

---

## Purpose

Lay the pguard visual + structural foundation the whole re-skin builds on: install the pguard design tokens (light + dark), switch the type system to IBM Plex via `next/font/google`, replace the app shell with a sidebar(216px)+topbar(62px) layout wired to the 3 menu groups (including the two new routes `/summary` and `/history`), and build the shared UI primitives (Button/Input/Card/Modal/Toast/Chip). No feature logic changes — this phase proves the theme, dark toggle, and route reachability without touching any data path.

---

## Objective

App renders in the pguard theme, the topbar dark toggle flips light↔dark, every route is reachable through the new shell, and the shared primitives exist — all while the existing test suite (vitest 446 fixture + existing e2e) stays green.

---

## Entry Gate

- Phase 0 complete (umbrella + all phase plans + registry created).
- Handoff assets present in `process/features/pguard-redesign/references/design_handoff_order_sheet_system/` (README + design_tokens/*.css + .dc.html prototypes).
- **Verified current state (RESEARCH):** NO icon lib installed; `globals.css` is Tailwind v4 `@import "tailwindcss"` + `@theme inline` with self-hosted Sarabun (`--font-sarabun`); `src/app/fonts.css` holds the Sarabun `@font-face`; `fonts.ts` exports the Sarabun stack; 6 `Sarabun-*.woff2` files under `public/fonts/`.

---

## Dependencies

- None upstream (first phase). Downstream: Phases 02–05 all consume the tokens, shell, and primitives created here.

---

## Blast Radius (exact file touch list)

- `src/app/globals.css` — copy `design_tokens/*.css` content into `:root` + `[data-theme=dark]`; token vars for colors, radii (11/8/99), green focus ring
- `tailwind.config.*` / CSS `@theme` (Tailwind v4) — map token vars to Tailwind tokens
- `src/lib/fonts.ts` — IBM Plex Sans Thai (subsets `thai`,`latin`) + IBM Plex Sans + IBM Plex Mono via `next/font/google`, exposed as CSS vars; REMOVE Sarabun `@font-face` + `public/fonts/Sarabun-*.woff2`
- `src/app/layout.tsx` (ROOT) — apply the three IBM Plex font-var classes to `<html>`; add the inline no-flash `data-theme` bootstrap script in `<head>`; remove `@import "./fonts.css"` dependency chain (PVL fix: `<html>` lives HERE, not in `(main)/layout.tsx`)
- `src/app/(main)/layout.tsx` — replace with sidebar(216px)+topbar(62px) shell; theme-toggle in topbar
- `src/app/nav.tsx` — 3 menu groups → routes incl. new `/summary` `/history` (PVL fix: nav is at `src/app/nav.tsx`, imported by `(main)/layout.tsx` as `../nav`; it is NOT under `src/components/`. It is currently a SERVER component using `await auth()` — adding `usePathname` active-state highlighting requires a server-shell + client-active-link split)
- `src/components/ui/*` — new shared primitives: `button.tsx`, `input.tsx`, `card.tsx`, `modal.tsx`, `toast.tsx`, `chip.tsx`
- `src/components/theme-toggle.tsx` — light/dark toggle writing `data-theme`

---

## Decisions (from INNOVATE — design is prescriptive, no alternatives)

| # | Decision | Chosen |
|---|---|---|
| 1 | Dark mode | Shipped; toggled in the topbar; persisted (cookie or localStorage) + inline no-flash script in `<head>`; `[data-theme]` on `<html>` drives it (optional `@media (prefers-color-scheme: dark)` fallback sets the same dark tokens when no explicit data-theme). |
| 2 | Fonts | `next/font/google` IBM Plex (Sans Thai subsets thai+latin / Sans / Mono), self-hosted at build; Sarabun fully removed. |
| 3 | Icons | `lucide-react` (stroke 2). |
| 4 | Sidebar groups/routes | ปฏิบัติการ (/orders, /summary, /history) · ข้อมูลหลัก (/shops, /products, /admin/users) · ระบบ (/settings/db); /summary + /history get stub pages NOW. |
| 5 | Tailwind v4 | `@theme` maps pguard tokens; components reference semantic aliases (not raw palette). |

**Scope fence (Phase 01 only):** re-skin via tokens/shell/primitives; DO NOT delete/replace the Order Pad (Phase 02) and DO NOT touch saveOrderSheet / totals / print / schema — so `e2e/orders.spec.ts` stays green.

---

## Inner Loop Refresh Note

- **Date:** 07-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after outer RESEARCH (technical approach + current-state inventory) + INNOVATE (prescriptive — decisions above).
- **Sections changed:** Entry Gate (verified current state: no icon lib, Tailwind v4 @theme inline + self-hosted Sarabun, fonts.css/fonts.ts/6 woff2), NEW Decisions section, Implementation Checklist rewritten into the concrete A–F build (tokens→globals.css, fonts+delete-Sarabun, shell+nav with exact groups/routes, primitives, /summary+/history stubs, DO-NOT list), Test Plan (add lucide-react dep + stub-route reachability), Blockers, Phase Loop 1–3 ticked, status → TESTING, Resume (next = PVL).
- **Key facts folded in:** exact token-copy targets (colors/typography/spacing/semantic + [data-theme=dark] block); next/font/google IBM Plex config (weights/subsets/variables); layout.tsx html lang=th + font vars + no-flash script; sidebar 216px + topbar 62px with the 3 named menu groups and Thai labels/routes; lucide-react; presentational token-driven primitives; /summary + /history stub pages with requireAuth + "กำลังพัฒนา (เฟส 03)"; DO-NOT-touch Order Pad / data paths this phase.
- **Validate-contract left untouched** (placeholder) — PVL writes it next.

---

## Implementation Checklist

### Step A — pguard tokens → `src/app/globals.css`

- [x] A1. Add ALL raw palette vars on `:root` from `design_tokens/colors.css` (green-50..950, amber-50..900, n-0..950, semantic success/warning/danger/info + bg, status-* + rings, `--on-amber`).
- [x] A2. Add typography scale / line-heights / tracking from `typography.css`; spacing / radius (`--r-xs..--r-full`) / elevation (`--sh-*`) / tap from `spacing.css`.
- [x] A3. Add semantic aliases from `semantic.css` on `:root` (light): surfaces (`--bg-app/-surface/-raised/-sunken/-inverse`), `--border/-strong`, `--text-strong/-/-muted/-faint/-on-brand`, `--brand/-int/-int-hover`, `--accent/-hover`, `--focus-ring` — AND the `[data-theme="dark"]` overrides block VERBATIM.
- [x] A4. Replace the current `@theme inline` + body rules: map token vars into Tailwind v4 (`--color-*` from palette+semantic; `--font-sans`, `--font-mono`); body uses `--bg-app` / `--text` / the Thai font. REMOVE the old `--background/--foreground/--font-sarabun` + the bare `prefers-color-scheme` block (dark now via `[data-theme]`, with an optional `@media (prefers-color-scheme: dark)` fallback that sets the same dark tokens when no explicit data-theme).

### Step B — Fonts (IBM Plex via next/font/google; delete Sarabun)

- [x] B0. `pnpm add lucide-react` (icon lib — none currently installed).
- [x] B1. Rewrite `src/lib/fonts.ts` with `next/font/google`: `IBM_Plex_Sans_Thai({subsets:['thai','latin'], weight:['300','400','500','600','700'], variable:'--font-thai', display:'swap'})`, `IBM_Plex_Sans({subsets:['latin'], weight:['400','500','600','700'], variable:'--font-latin'})`, `IBM_Plex_Mono({subsets:['latin'], weight:['400','500','600'], variable:'--font-mono'})`; export the three `.variable` class names.
- [x] B2. `layout.tsx`: apply the three font variables to `<html className>`; `<html lang="th">`; body font = `var(--font-thai)`. Remove `@import "./fonts.css"` from `globals.css`; DELETE the Sarabun `@font-face` in `src/app/fonts.css` (or the file) and the 6 `public/fonts/Sarabun-*.woff2` (grep first if deletion risks other refs).

### Step C — App shell → `src/app/(main)/layout.tsx` + `src/app/nav.tsx`

- [x] C1. Sidebar 216px (fixed, `--bg-surface`, 1px `--border` right): logo placeholder (green gradient `160deg #1FA971→#0E3B2E` square + "ย") + product name; user card (avatar+name+role) + logout (existing auth-actions) at the bottom.
- [x] C2. `nav.tsx` — 3 GROUPS with small muted labels, each item = Lucide icon (stroke 2) + Thai label; active = `--green-50` bg + `--green-800` text via `usePathname`:
  - **ปฏิบัติการ**: ออเดอร์รายวัน→`/orders`, สรุปยอดผลิต→`/summary`, ประวัติออเดอร์→`/history`
  - **ข้อมูลหลัก**: จัดการร้านค้า→`/shops`, จัดการสินค้า→`/products`, ผู้ใช้→`/admin/users` (ADMIN-only visibility if trivial; auth still guards server-side)
  - **ระบบ**: ตั้งค่าระบบ→`/settings/db`
- [x] C3. Topbar 62px (`--bg-surface`, 1px `--border` bottom): left = page title (derive from route); right = dark-mode toggle (sun/moon Lucide → flips `data-theme` on `<html>`, persists via cookie/localStorage + inline no-flash script in the layout `<head>`), a TH/EN toggle (TH only → toast "ยังไม่รองรับ EN" on EN), and a slot/portal placeholder for per-page actions (print/save).

### Step D — Shared primitives → `src/components/ui/*` (presentational, token-driven)

- [x] D1. `button.tsx` (primary green `--brand-int` hover `--brand-int-hover` + active translateY(1px) / secondary white +1.5px `--border-strong` / danger-ghost red); `input.tsx` (green focus ring `0 0 0 4px var(--focus-ring)`); `card.tsx` (radius `--r-lg`, 1px border, no shadow).
- [x] D2. `modal.tsx` (scrim `rgba(8,20,15,.5)` + backdrop-blur 3px, fade+scale .96→1 200ms, click-scrim-closes); `toast.tsx` (green-900 bg, bottom-center, ~2.2s); `chip.tsx`/pill; `status-dot.tsx`; `switch.tsx` (200ms slide).

### Step E — Stub routes (prevent 404 + keep e2e green)

- [x] E1. Create minimal `src/app/(main)/summary/page.tsx` + `src/app/(main)/history/page.tsx` with `requireAuth()` + a heading + "กำลังพัฒนา (เฟส 03)" placeholder (full build in Phase 03).

### Step F — DO NOT (this phase)

- [x] F1. Do NOT delete/replace the Order Pad (`order-grid.tsx` etc. — Phase 02). Do NOT touch saveOrderSheet / totals / print / schema. Confirm `e2e/orders.spec.ts` stays green (Order Pad intact, reachable through the new shell).

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load `process/context/tests/all-tests.md` routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: build/type + existing regression**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Build + typecheck after shell/token swap | `pnpm build` exits 0 | scaffold compiles | visual fidelity |
| Fully-automated | 446 fixture + existing unit suite still green | `pnpm test` | no data-path regression | new UI |
| Fully-automated | No Sarabun references remain | grep for `Sarabun` returns none in src/public | font swap complete | rendering |
| Fully-automated | `lucide-react` installed + build resolves icons | `pnpm build` after `pnpm add lucide-react` exits 0 | icon lib wired | visual |

**Area: shell + theme (agent-probe / hybrid)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | All routes reachable through the new shell incl. /summary /history stubs (no 404) | Playwright nav across routes + the 2 new stubs | route wiring | pixel fidelity |
| Hybrid | Existing auth/orders/print/settings e2e green (Order Pad intact) | `pnpm exec playwright test` | no data-path regression | new UI |
| Agent-probe | pguard theme renders; dark toggle flips light↔dark | open app, toggle, visually confirm tokens + IBM Plex | theme + font applied | print fidelity |

---

## Exit Gate

```bash
pnpm build            # Expected: exit 0
pnpm test             # Expected: 446 fixture + existing units green
pnpm lint             # Expected: exit 0
# Playwright: every route reachable via the new shell; Agent-probe: dark toggle flips, IBM Plex + pguard tokens render
```

- App renders in the pguard theme; dark toggle flips; all routes reachable; vitest + existing e2e green.
- Sarabun fully removed; IBM Plex active.
- Phase report written to the report destination above.

---

## Blockers That Would Justify BLOCKED Status

- Tailwind v4 `@theme` mapping cannot resolve the token vars → BLOCKED with the exact build error.
- IBM Plex Sans Thai `next/font/google` subset unavailable/broken for Thai glyphs → document; fallback to self-hosted IBM Plex before removing Sarabun.
- Existing test suite goes red from the shell swap (a data path was touched) → STOP; the shell change must not touch data.
- Deleting `public/fonts/Sarabun-*.woff2` breaks a remaining reference → grep first; keep the file if referenced and just drop the @font-face.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE (outer research) — current state inventoried: no icon lib, Tailwind v4 @theme inline + self-hosted Sarabun, fonts.css/fonts.ts/6 woff2 (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — design is prescriptive (no alternatives); Decisions recorded (dark mode + no-flash, next/font IBM Plex, lucide-react, sidebar groups/routes, Tailwind @theme)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated with the concrete A–F build; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: DONE — validate-contract written (CONDITIONAL net gate; 2 plan defects fixed inline, 4 concerns as execute instructions/agent-probes). EXECUTE pending user consent.
- [x] 5. EXECUTE — DONE (all A–F items; 5 automated + 2 hybrid + 3 agent-probe gates green; report written; see phase-01-foundation_REPORT_07-07-26.md)
- [x] 6. EVL — DONE (07-07-26): all 10 validate-contract gates independently re-run green; scope fence empty; deviations audited benign; EVL HANDOFF SUMMARY written to report. Status promoted ✅ VERIFIED.
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.**

---

## Touchpoints

- `src/app/globals.css`, Tailwind `@theme`, `src/lib/fonts.ts`, `src/app/layout.tsx`, `src/app/(main)/layout.tsx`, `src/app/nav.tsx`, `src/components/ui/*` (button/input/card/modal/toast/chip/status-dot/switch), `src/app/(main)/summary/page.tsx`, `src/app/(main)/history/page.tsx`
- Add `lucide-react`; remove `src/app/fonts.css` Sarabun `@font-face` + `public/fonts/Sarabun-*.woff2`

---

## Public Contracts

- Establishes the pguard token surface + shared `src/components/ui/*` primitives consumed by Phases 02–05.
- Establishes the sidebar+topbar shell + nav route map (incl. /summary /history) extended by later phases.
- Touches NO data path — saveOrderSheet, totals.ts, print sheet, schema all unchanged.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm build` exit 0 | Fully-Automated | DoD #1 (app boots in theme) — proven by: build gate |
| 446 fixture + units green | Fully-Automated | Program invariant (no data regression) — proven by: test gate |
| All routes reachable incl. /summary /history stubs | Hybrid | DoD #1 (every route reachable) — proven by: nav hybrid gate |
| Existing e2e green (Order Pad intact) | Hybrid | Program invariant (no data regression) — proven by: existing-e2e hybrid gate |
| Theme + dark toggle | Agent-Probe | DoD #1 (pguard theme + dark) — proven by: theme agent-probe |

---

## Test Infra Improvement Notes

- Add a Playwright light/dark screenshot baseline for the shell so later re-skin phases get a visual-regression anchor. Record baseline path in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/pguard-redesign/active/pguard-redesign_07-07-26/phase-01-foundation_PLAN_07-07-26.md`
- Last completed step: 3. PLAN-SUPPLEMENT (concrete A–F build folded in)
- Validate-contract status: pending — NEXT STEP is PVL (spawn vc-validate-agent). Do NOT execute yet.
- Next step: Spawn vc-validate-agent for PVL (Step 4). Scope fence: tokens/shell/primitives only — DO NOT touch the Order Pad or any data path this phase.

---

## Plan Metadata

**Date**: 07-07-26
**Complexity**: COMPLEX (one phase of the pguard-redesign program)
**Status**: ✅ VERIFIED (07-07-26)

## Overview

This is a phase plan within the pguard-redesign phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`pguard-redesign-umbrella_PLAN_07-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan enters the RIPER-5 VALIDATE (PVL) step before EXECUTE (ENTER EXECUTE MODE only after the contract is written).

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

Status: CONDITIONAL
Date: 07-07-26
date: 2026-07-07
generated-by: inner-pvl: phase-01

Parallel strategy: parallel-subagents
Rationale: 3/7 signals (S1 multi-surface CSS/fonts/layout/nav/primitives, S3 4 build-sections A–F, S7 12+ files in blast radius); no schema/API/auth/billing surface, so MEDIUM — Layer-1 dimension checks + Layer-2 A–F feasibility fan out cleanly with no mid-run cross-talk. EXECUTE itself is a single sequential vc-execute-agent leg (opus) — the A–F edits are ordered and interdependent (tokens → fonts → shell → primitives → stubs).

Net Gate: CONDITIONAL — 0 FAILs, 6 CONCERNs (2 fixed inline in plan, 4 carried as execute-agent instructions + agent-probe gates). No developed behavior rests on Known-Gap alone; visual theme/print fidelity is proven by Agent-Probe (a proving strategy), not a silent gap.

### Test gates (C3 5-column table)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| G-build | shell + tokens + IBM Plex + lucide-react all compile & typecheck | Fully-Automated | `pnpm build` exits 0 | A |
| G-units | 446 totals fixture + 70 vitest units stay green (no data-path regression) | Fully-Automated | `pnpm test` (→ `vitest run`) exits 0 | A |
| G-sarabun | zero dangling Sarabun references after font swap | Fully-Automated | `grep -rn "Sarabun\|font-sarabun\|Sarabun-.*woff2\|@import \"./fonts.css\"" src public` returns no code refs (comment-only allowed) | A |
| G-lint | lint clean after shell/nav rewrite | Fully-Automated | `pnpm lint` exits 0 | A |
| G-scopefence | immutable surfaces byte-unchanged | Fully-Automated | `git diff --stat` shows ZERO changes to: `src/app/(main)/orders/actions.ts` (saveOrderSheet), `src/lib/totals.ts`, `src/lib/order-save.ts`, `src/lib/get-sheet-for-print.ts`, `src/app/print/print-table.tsx`, `src/components/sheet-header.tsx`, `prisma/schema.prisma`, `test-fixtures/sheet-13-03-69.json`, and NO deletion of `src/app/(main)/orders/{order-grid,shop-rail,shop-order-card,summary-bar}.tsx` | A |
| G-routes | every route reachable through the new shell incl. `/summary` + `/history` stubs (no 404) | Hybrid | `pnpm exec playwright test` nav — precondition: sandbox up (`docker compose up -d`) + seeded admin (`SEED_ADMIN_PASSWORD` in `.env`) + `pnpm exec playwright install chromium` once; webServer auto-starts `pnpm start` | A |
| G-e2e-regress | existing auth/orders/print/settings e2e green (Order Pad DOM intact; logout button keeps accessible name "ออกจากระบบ") | Hybrid | `pnpm exec playwright test` (19/19) — same precondition as G-routes | A |
| G-theme | pguard theme renders; dark toggle flips light↔dark; BOTH themes legible; choice persists across reload | Agent-Probe | open app, screenshot light, toggle dark, screenshot dark, reload → assert theme persisted; judge token colors + contrast | A |
| G-ibmplex-thai | IBM Plex Sans Thai `subsets:['thai','latin']` resolves at build AND Thai glyphs render (tone marks shaped) | Agent-Probe (backed by G-build) | after `pnpm build`, load a Thai-heavy page, screenshot, judge Thai rendering in IBM Plex; if the `thai` subset fails to resolve at build → BLOCKED, apply the named fallback below | A |
| G-print-font | print sheet (`/print/daily/...`) still renders faithfully after the global font swaps Sarabun→IBM Plex Sans Thai (print.css inherits the global body font; it sets NO font-family of its own) | Agent-Probe | screenshot `/print/daily/<seeded-date>`, judge Thai tone-mark shaping + column fit vs the 13/3/69 form; structure already proven by print.spec G1–G8 | C |

Failing stub (G-units): `test("446 totals fixture + units stay green after shell/token/font swap", () => { throw new Error("NOT IMPLEMENTED — TDD stub: run pnpm test, assert grand total 446 + all 20 column totals unchanged") })`
Failing stub (G-sarabun): `test("no dangling Sarabun reference remains in src/public", () => { throw new Error("NOT IMPLEMENTED — TDD stub: grep Sarabun in src+public returns no code refs") })`
Failing stub (G-scopefence): `test("immutable order/totals/print/schema surfaces are byte-unchanged", () => { throw new Error("NOT IMPLEMENTED — TDD stub: git diff --stat shows zero changes to the immutable set and no Order Pad deletion") })`
(G-build and G-lint are command gates, not unit-test-shaped scenarios — no stub.)

Legacy line form (retained for existing consumers):
- build/type: Fully-automated: `pnpm build` exit 0
- regression: Fully-automated: `pnpm test`
- font-swap: Fully-automated: grep Sarabun returns none
- lint: Fully-automated: `pnpm lint`
- scope-fence: Fully-automated: `git diff --stat` scoped to the immutable set = empty
- route reachability: hybrid: `pnpm exec playwright test` + precondition sandbox up + seeded admin
- existing e2e: hybrid: `pnpm exec playwright test` (19/19)
- theme + dark toggle: agent-probe: both-theme screenshots + reload-persist
- IBM Plex Thai: agent-probe: Thai-glyph screenshot (build proves subset resolves)
- print re-typeface: agent-probe: /print screenshot faithful after font swap

### Dimension findings

- Infra fit: CONCERN — Tailwind v4 `@theme inline` + `next/font/google` + pnpm all confirmed on disk; two mechanical gaps fixed inline: (a) `<html>` for font vars + no-flash script lives in ROOT `src/app/layout.tsx`, now added to blast radius; (b) `usePathname` active-nav needs a server-shell/client-active-link split (nav is currently a server component). lucide-react is a safe add.
- Test coverage: PASS — mature infra: `pnpm test` (vitest, no sandbox), `pnpm build`/`pnpm lint` (no sandbox), `pnpm exec playwright test` (hybrid: sandbox + seeded admin + chromium install). Visual theme/print items are inherently Agent-Probe.
- Breaking changes: CONCERN — (1) print sheet inherits the global body font (print.css line 3 + no own font-family) → the Sarabun→IBM Plex swap re-typefaces the print sheet, an umbrella-immutable surface; no automated gate asserts font (print.spec:201 only awaits `document.fonts.ready`), so gates stay green, but confirm via G-print-font agent-probe. (2) auth.spec asserts the logout button accessible name "ออกจากระบบ" on `/` → the new sidebar logout MUST preserve it. (3) Sarabun woff2 deletion is safe: only `src/app/fonts.css` `url()`-references the 6 woff2; print.css mentions Sarabun in a comment only.
- Security surface: PASS — presentational re-skin; touches NO auth/billing/data/secret/trust-boundary logic. Server-side `requireAuth` (from `@/lib/auth-guard`) remains the real boundary; nav ADMIN-link visibility is cosmetic only. No risk-evidence pack required (not a high-risk class). Stub routes MUST call `requireAuth()` (E-STUB).
- Section A (tokens→globals.css): PASS — token values verified against `references/design_tokens/*.css` (green-500 #1FA971, green-900 #0E3B2E, `--focus-ring rgba(31,169,113,.45)`, `[data-theme="dark"]` block present verbatim); no drift. Mechanical: globals.css is 28 lines, clean replace. Highest-risk edit: the Tailwind v4 `@theme` mapping must resolve token vars — proven by G-build.
- Section B (fonts): CONCERN — IBM Plex Sans Thai `['thai','latin']` is a valid Google-Fonts subset set; real BLOCKED risk only if `next/font/google` cannot resolve the `thai` subset at build (proven by G-build + G-ibmplex-thai). Named fallback documented below. Ensure body still has a defined Thai font var so `/print` never falls back to serif.
- Section C (shell+nav): CONCERN — nav path corrected to `src/app/nav.tsx` (was wrongly `src/components/nav.tsx`); server/client split required for `usePathname`; preserve logout accessible name; do NOT relocate existing Order Pad save/print controls into the new topbar action slot this phase (that is Phase 02).
- Section D (primitives): PASS — `src/components/ui/*` is a new dir (only `sheet-header.tsx` exists in `src/components/`); presentational, token-driven, additive. Plan lists 8 primitives (button/input/card/modal/toast/chip/status-dot/switch) vs the 6 in the Objective — extra two are additive, fine.
- Section E (stub routes): PASS — create `src/app/(main)/{summary,history}/page.tsx`; import `requireAuth` from `@/lib/auth-guard`; heading + "กำลังพัฒนา (เฟส 03)". Reachable + auth-guarded; prevents 404 from the new sidebar.
- Section F (DO NOT / scope fence): PASS — enforced mechanically by G-scopefence git-diff assertion.

### Execute-agent instructions (carried CONCERN mitigations)

- E-ROOT-LAYOUT: Apply the three IBM Plex font-var classNames + the inline no-flash `data-theme` bootstrap script to `<html>`/`<head>` in ROOT `src/app/layout.tsx` (NOT `(main)/layout.tsx`). Remove `@import "./fonts.css"` from `globals.css`.
- E-NAV-SPLIT: `src/app/nav.tsx` is a SERVER component (`await auth()`). For `usePathname` active-nav highlighting, split into a server shell (fetches session/role) + a client child (`"use client"` + `usePathname`) — do NOT convert the whole file to client and lose the server-side auth read.
- E-LOGOUT-NAME: The new sidebar user-card logout MUST render a `<button>` with accessible name exactly "ออกจากระบบ" (auth.spec `getByRole("button",{name:"ออกจากระบบ"})` on `/`). Reuse existing `./auth-actions` `logout`.
- E-STUB-AUTH: `/summary` + `/history` stub pages MUST call `requireAuth()` from `@/lib/auth-guard` (task requirement + auth-guard coverage convention).
- E-PRINT-FONT: The global font swap re-typefaces the `/print` sheet (it inherits the body font). Run G-print-font agent-probe; if Thai tone marks or column fit regress, pin `.print-canvas` (in `src/styles/print.css`) to a Thai font stack with IBM Plex Sans Thai first — do NOT touch print-table.tsx / sheet-header.tsx / get-sheet-for-print.ts structure. Record the judgment in the phase report.
- E-CONTROLS: Add the topbar per-page action slot as an EMPTY placeholder/portal only; do NOT move the existing orders save/print controls into it this phase (Phase 02).
- E-SARABUN-DELETE: grep-first before deleting the 6 `public/fonts/Sarabun-*.woff2` + the `@font-face` in `src/app/fonts.css`; only `src/app/fonts.css` `url()`-references them, so deletion is safe once `globals.css` drops `@import "./fonts.css"`.

### Named fallback (IBM Plex Sans Thai BLOCKED risk)

If `next/font/google` `IBM_Plex_Sans_Thai({subsets:['thai','latin']})` fails to resolve the `thai` subset at build: (1) first fallback — self-host IBM Plex Sans Thai via `next/font/local` with the OFL woff2 (same self-host pattern Sarabun used); (2) safety fallback — KEEP Sarabun as the last family in the Thai font stack (do NOT delete the woff2 until IBM Plex Thai renders in the G-ibmplex-thai probe). This gives EXECUTE a non-blocking path.

Open gaps: none blocking. Residual (accepted): print-sheet visual fidelity after the font swap is proven by Agent-Probe only (G-print-font), consistent with the existing program residual that print visual fidelity is agent-probe (no automated visual-regression baseline yet) — the Test Infra note already recommends adding a light/dark + print screenshot baseline.

What this coverage does NOT prove:
- G-build / G-lint: do NOT prove visual fidelity, theme correctness, or Thai rendering (compile-only).
- G-units: does NOT prove any new UI; only that the 446 fixture + existing logic are unregressed.
- G-sarabun: proves reference removal, NOT that IBM Plex actually renders.
- G-scopefence: proves the immutable files are byte-unchanged, NOT that the new UI is correct.
- G-routes / G-e2e-regress: prove reachability + no data-path/DOM regression, NOT pixel fidelity or dark-mode correctness.
- G-theme / G-ibmplex-thai / G-print-font: judgment-based; do NOT provide an automated regression baseline (a future Playwright light/dark + print screenshot baseline would close this).

Auto-selected menu choices (user away — conservative defaults recorded for override):
- Cost guard: not triggered (parallel-subagents fan-out ~8–12 agents, < 30).
- Net gate: CONDITIONAL accepted autonomously; 2 plan defects fixed inline, 4 concerns carried as execute-agent instructions + agent-probe gates.
- EXECUTE launch: NOT auto-started — held pending user consent per the invocation instruction ("umbrella → EXECUTE pending user consent").

Gate: CONDITIONAL (concerns noted; 2 fixed in plan inline, 4 recorded as execute-agent instructions/agent-probe gates)
Accepted by: session (autonomous, /goal execution) — accepted concerns: print-sheet re-typeface (E-PRINT-FONT / G-print-font), IBM-Plex-Thai subset build risk (Section B / G-ibmplex-thai, named fallback), logout accessible-name preservation (E-LOGOUT-NAME), nav server/client split (E-NAV-SPLIT). Plan defects fixed inline: nav path corrected to src/app/nav.tsx; root src/app/layout.tsx added to blast radius.
