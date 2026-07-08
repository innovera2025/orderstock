# Phase Blast-Radius Registry — pguard-redesign

One registry for the whole program. Append-only. Each phase agent appends/updates its `## Phase NN` section with the exact files it will create or modify, so cross-phase shared-file conflicts stay visible. Program runs sequentially; shared files must be EXTENDED, never rewritten, by later phases.

**Program-wide immutable surfaces (NEVER modify — HARD STOP if a phase needs to):** `saveOrderSheet`/`actions.ts` payload (`cell:{shopId}:{variantId}`, `note:{shopId}`), `order-save.ts`, `totals.ts`, `get-sheet-for-print.ts`, `print-table.tsx`, `sheet-header.tsx`, `schema.prisma`, the 446 totals fixture result, the byte-faithful print sheet.

---

## Phase 01 — Foundation

status: DONE — EXECUTE complete 07-07-26; all gates green (see phase-01-foundation_REPORT_07-07-26.md). Actual files also created: `src/app/nav-links.tsx` (client active-link half, E-NAV-SPLIT) + `src/app/topbar.tsx` (topbar). Additive `eslint.config.mjs` ignore + comment-only `src/styles/print.css` edit (both within blast radius).

Claimed blast radius:
- `src/app/globals.css` (pguard tokens light/dark) — SHARED foundation for all phases
- Tailwind `@theme` mapping
- `src/lib/fonts.ts` (IBM Plex via next/font/google); remove `public/fonts/Sarabun-*.woff2` + @font-face
- `src/app/(main)/layout.tsx` (sidebar+topbar shell) — SHARED with 02, 03, 04 → EXTEND only
- `src/app/nav.tsx` (3 groups incl. /summary /history) — SHARED with 02, 03 → EXTEND only (PVL fix: file is at `src/app/nav.tsx`, not `src/components/nav.tsx`)
- `src/components/theme-toggle.tsx`
- `src/components/ui/*` (Button/Input/Card/Modal/Toast/Chip) — SHARED with 02, 03, 04, 05 (consume) → EXTEND only

---

## Phase 02 — Core Desktop

Claimed blast radius:
- `src/app/(auth)/login/**`
- `src/app/(main)/orders/**` — NEW `order-matrix.tsx`; DELETE `order-grid.tsx`/`shop-rail.tsx`/`shop-order-card.tsx`/`summary-bar.tsx`
- `src/app/(main)/shops/**`, `src/app/(main)/products/**`, `src/app/(main)/admin/users/**`, `src/app/(main)/settings/**`
- print toolbar component (reskin) — print sheet renderers UNCHANGED
- `e2e/orders.spec.ts` (rewritten for the matrix)
- Consumes Phase-01 primitives + shell (EXTEND only). REUSES immutable `saveOrderSheet` payload.

---

## Phase 03 — New Screens

**Cross-phase input (from Phase 02):** consumes the Phase-02 order data + the unchanged `computeColumnTotals`.

Claimed blast radius:
- `src/app/(main)/summary/**` (สรุปยอดผลิต — bars from `computeColumnTotals`)
- `src/app/(main)/history/**` (ประวัติออเดอร์ — real OrderSheet rows)
- Fills the `/summary` + `/history` nav routes stubbed in Phase 01 (EXTEND nav only). Read-only; no write path.

---

## Phase 04 — Mobile

status: DONE — EXECUTE complete 08-07-26; all gates green (unit 82, lint clean, build OK, e2e 25/25 incl 4 mobile, scope-fence EMPTY on 10 immutable, agent-probe 5 screens @390×844). See phase-04-mobile_REPORT_07-07-26.md.

**Cross-phase input (from Phase 02):** REUSES the immutable `saveOrderSheet` payload; the mobile stepper must produce a byte-identical payload to the desktop matrix.

Claimed blast radius:
- ~~`src/app/(mobile)/**`~~ → RESPONSIVE shared-component (no `(mobile)` route group). ACTUAL: `src/components/bottom-tab-bar.tsx` (NEW), `src/app/(main)/orders/order-mobile-list.tsx` + `order-mobile-entry.tsx` (NEW presentational), `src/app/(main)/admin/users/users-mobile.tsx` (NEW). MODIFIED: `order-matrix.tsx` (mobile branch), `(main)/layout.tsx`, `orders/[id]/page.tsx` (dateLabel prop), `login/page.tsx`, `summary/page.tsx`, `admin/users/page.tsx`. TEST infra: `e2e/util/clean-state.ts` (hoisted), `e2e/mobile.spec.ts`, `playwright.config.ts` (390×844 project).
- `src/components/bottom-tab-bar.tsx`
- Consumes Phase-01 primitives + Phase-02 data. Independent of Phase 03 (disjoint route folders) → 03/04 optionally parallel after 02.

---

## Phase 05 — Data Align + Verify

Claimed blast radius:
- `src/lib/product-order.ts` (ตีลานนิ่ม/ตีลาน DISPLAY renames; printOrder mapping UNCHANGED) — read by all phases, WRITTEN only here
- `prisma/seed.ts` (align 2 product names; role-label map; idempotent)
- role-label map (ADMIN/STAFF UI labels; 2 real roles)
- Display-only: schema / saveOrderSheet / totals.ts / 446 numeric result / print renderers UNCHANGED.

---

## Potential Blast Radius Conflicts

All cross-phase shared files are resolved by SEQUENCING (one phase at a time; later phases extend prior state, never rewrite):

- `src/app/(main)/layout.tsx` + `src/components/nav.tsx` — Phases 01 → 02 → 03 → 04 (extend; nav routes filled in 03)
- `src/components/ui/*` — Phase 01 creates; 02–05 consume (no rewrite)
- `src/lib/product-order.ts` — read by 02/03/04; WRITTEN only in Phase 05 (display renames)
- Phases 03 and 04 both depend on Phase 02 but touch DISJOINT route folders (`summary`/`history` vs `(mobile)`) → optionally parallel after Phase 02.

No package REASSIGNMENT required. Classification: parallel-safe under sequential execution; 03/04 optionally parallel post-02. The program-wide immutable surfaces above are OFF-LIMITS to every phase.
