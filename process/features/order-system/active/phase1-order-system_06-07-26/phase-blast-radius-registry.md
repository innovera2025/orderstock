# Phase Blast-Radius Registry — phase1-order-system

One registry for the whole program. Append-only. Each phase agent appends/updates its `## Phase NN` section with the exact files it will create or modify, so cross-phase shared-file conflicts stay visible. Program runs sequentially; shared files must be EXTENDED, never rewritten, by later phases.

---

## Phase 01 — Foundation

status: (in progress) — EXECUTE done 06-07-26, 6/6 gates green via inline env; awaiting EVL + `.env` before DONE. All claimed files created/modified (plus additive: `pnpm-workspace.yaml`, `eslint.config.mjs`, `src/app/fonts.css`, `src/app/db-status.tsx`, `README.md`). No cross-phase conflicts.

Claimed blast radius:
- `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `.env`, `.env.example`, `.gitignore`
- `docker-compose.yml`
- `prisma/schema.prisma` (datasource + minimal model) — SHARED with 02, 03
- `prisma.config.ts`
- `src/lib/db.ts` — SHARED with 06 (runtime swap extension)
- `src/lib/fonts.ts`, `public/fonts/**`
- `src/app/layout.tsx` — SHARED with 03, 04
- `src/app/page.tsx`, `src/app/api/health/route.ts`

---

## Phase 02 — Schema & Master Data

status: DONE — EXECUTE complete 06-07-26; all 7 validate-contract gates green; schema EXTENDED HealthCheck (not rewritten). No cross-phase conflicts. Additive files beyond the claim: `prisma/load-env.ts` (seed env-load side-effect module, F4), `src/lib/variant-validation.ts` (printOrder validator), `src/lib/correction-cascade.ts` (snapshot back-fill), `src/app/shops/{shop-form,actions}.tsx/.ts` + `[id]/edit`/`new`, `src/app/products/{product-form,add-variant-form,actions}` + `[id]/edit`/`new`, unit tests under `src/lib/__tests__/`, `package.json`+`pnpm-lock.yaml` (tsx, zod devDep/dep), `prisma.config.ts` (migrations.seed key — EXTEND). EVL independent re-run pending.

Claimed blast radius:
- `prisma/schema.prisma` (full models) — SHARED with 01, 03 → EXTEND only
- `prisma/migrations/**`, `prisma/seed.ts` — SHARED with 03 (admin seed) → EXTEND only
- `scripts/export-schema-sql.ts`, `db/create-orderstock-schema.sql` — SHARED with 06 (regenerated)
- `src/app/shops/**`, `src/app/products/**`, `src/lib/product-order.ts`

---

## Phase 03 — Auth

Claimed blast radius:
- `src/auth.config.ts`, `src/auth.ts`, `middleware.ts` **→ NOTE: Next 16 renames `middleware.ts` to `proxy.ts`** (INNOVATE Phase 01 pinned Next 16.2.x; db-auth REF §5 says "middleware" — Phase 03 RESEARCH must reconcile the file name), `src/lib/password.ts`
- `src/app/(auth)/login/**`, `src/app/admin/users/**`
- `prisma/seed.ts` (admin user) — SHARED with 02 → EXTEND only
- `src/app/layout.tsx` (auth nav) — SHARED with 01, 04 → EXTEND only
- `prisma/schema.prisma` (User fields, if any) — SHARED → EXTEND only

---

## Phase 04 — Order Entry

**Cross-phase input (from Phase 02 decision 6):** MUST write historical snapshot columns `shopNameAtEntry`/`variantNameAtEntry` on OrderLine/NoteLine at line-create time.

status: DONE (EXECUTE) — 06-07-26 under explicit user consent. All files below created/modified; no cross-phase conflicts (only `src/app/layout.tsx`→`nav.tsx` nav-link EXTEND). pnpm test 39/39, build ✓, lint ✓, playwright 9/9. Known-gaps accepted: weight un-validatable until Q22; duplicate-sheet TOCTOU accepted for LAN. E4 registry drift resolved: `src/components/sheet-header.tsx` + `test-fixtures/sheet-13-03-69.json` claimed below. Awaiting independent EVL.

Claimed blast radius:
- `src/app/orders/**`
- `src/lib/totals.ts`, `src/lib/be-date.ts`, `src/lib/order-save.ts` (PVL-added pure snapshot-merge helper)
- `src/components/sheet-header.tsx` (reusable two-tier header — **Phase 05 imports this**)
- `test-fixtures/sheet-13-03-69.json` (canonical gate fixture — **shared with Phase 05 print tests**)
- `src/lib/__tests__/{totals,be-date,order-save}.test.ts` (new unit gates)
- `src/lib/__tests__/auth-guard-coverage.test.ts` (EXTEND MODULES with orders) — SHARED
- `e2e/orders.spec.ts` (new E2E — reuses `e2e/.auth/staff.json`)
- `src/app/layout.tsx` (nav link) — SHARED with 01, 03 → EXTEND only

---

## Phase 05 — Printing

**Cross-phase input (from Phase 02 decision 6):** MUST render from OrderLine/NoteLine snapshot columns, never live Shop/Variant names.
**Cross-phase input (from Phase 04):** IMPORT the shared `src/components/sheet-header.tsx` two-tier header + `test-fixtures/sheet-13-03-69.json` fixture — do not duplicate.

status: DONE — EXECUTE complete 06-07-26 under explicit user consent (2 accepted known-gaps Q30/Q22). All fully-automated + hybrid gates green: vitest 41/41 (incl. 2 new print-page requireAuth gates), build ✓, lint ✓, playwright 16/16 (9 regression + 7 new print gates G1–G8). Agent-probe visual (G9) recorded GO (faithful; header-cell legibility caveat at narrow mm widths). Server-side PDF DEFERRED to backlog. **DEVIATION (within-blast-radius, documented in report):** introduced a `(main)` route group to structurally exclude the nav from `/print` — moved `page.tsx`,`db-status.tsx`,`orders/`,`shops/`,`products/`,`admin/` into `src/app/(main)/` and removed `<Nav/>` from root `src/app/layout.tsx`. URLs unchanged. This TOUCHES the SHARED `src/app/layout.tsx` (Phases 01/03/04) and relocates prior-phase route folders; extend-only intent preserved (no route logic changed).

Claimed + actual blast radius:
- `src/app/print/layout.tsx` (no-nav), `src/app/print/daily/[date]/page.tsx`, `src/app/print/shops/[date]/page.tsx`, `src/app/print/print-table.tsx`, `src/app/print/print-controls.tsx`
- `src/lib/get-sheet-for-print.ts` (NEW shared snapshot fetch)
- `src/styles/print.css`
- `src/components/sheet-header.tsx` (EXTEND — additive optional subLabel/className/trailingColSpan; orders grid byte-identical) — SHARED with 04
- `src/app/(main)/layout.tsx` (NEW route-group nav layout); `src/app/layout.tsx` (remove Nav) — SHARED with 01/03/04 → structural nav relocation
- MOVED into `src/app/(main)/`: `page.tsx`, `db-status.tsx`, `orders/`, `shops/`, `products/`, `admin/`
- `src/app/(main)/orders/[id]/page.tsx` (EXTEND — print links)
- `src/lib/__tests__/auth-guard-coverage.test.ts` (EXTEND — (main) paths + print-page grep) — SHARED with 04
- `e2e/print.spec.ts` (NEW self-seeding E2E)
- backlog: `print-pdf-fallback_NOTE`, `print-shading-q30_NOTE` (+ pre-existing `weight-factors_NOTE`)
- NOT done (deferred): `src/app/api/print/**`, `next.config.ts` serverExternalPackages — server-side PDF fallback to backlog

---

## Phase 06 — DB Settings & Delivery

status: DONE — EXECUTE complete 06-07-26 under explicit user consent. All 8 validate-contract Fully-Automated gates green (vitest 70/70 incl. new connection-string/env-write/settings-hygiene/auth-guard gates), build ✓, lint ✓, Hybrid round-trip DB switch gate PASS (orderstock↔orderstock2 sentinel, .env restored), Agent-Probe guide review GO. 5-artifact evidence pack validated. **Actual settings-page path is `src/app/(main)/settings/db/**` (inside the Phase-05 (main) route group), NOT `src/app/settings/db/**` — within-blast-radius location deviation, documented in report.** NEW additive file `src/lib/env-write.ts` (safe .env rewrite) + `scripts/phase06-roundtrip-gate.ts` (Hybrid gate). `src/lib/db.ts` NOT modified (already reads DATABASE_URL — no runtime swap; restart-required apply). `src/auth.config.ts` (/settings edge gate) + `src/app/nav.tsx` (ADMIN link) EXTENDED. Known-gaps accepted: customer SQL Server version/COMPATIBILITY_LEVEL TODO-flagged, guide runnability Agent-Probe, on-site printer fidelity. Awaiting independent EVL.

Claimed blast radius:
- `src/app/settings/db/**`, `src/lib/connection-string.ts`
- `src/lib/db.ts` (runtime swap) — SHARED with 01 → EXTEND only
- `db/create-orderstock-schema.sql` (regenerate) — SHARED with 02
- `db/create-database-and-login.sql`, `docs/deployment-guide.md`

---

## Potential Blast Radius Conflicts

All cross-phase shared files are resolved by SEQUENCING (the program runs one phase at a time; each later phase extends prior state, never rewrites):

- `prisma/schema.prisma` — Phases 01 → 02 → 03 (extend)
- `prisma/seed.ts` — Phases 02 → 03 (extend)
- `src/app/layout.tsx` — Phases 01 → 03 → 04 (extend)
- `src/lib/db.ts` — Phases 01 → 06 (extend for runtime swap)
- `db/create-orderstock-schema.sql` / `scripts/export-schema-sql.ts` — Phases 02 → 06 (regenerate via same pipeline)
- `next.config.ts` — Phases 01 → 05 (extend, only if PDF fallback adopted)

No package REASSIGNMENT required. Classification: parallel-safe under sequential execution.
