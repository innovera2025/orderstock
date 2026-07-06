# Phase Blast-Radius Registry — phase1-order-system

One registry for the whole program. Append-only. Each phase agent appends/updates its `## Phase NN` section with the exact files it will create or modify, so cross-phase shared-file conflicts stay visible. Program runs sequentially; shared files must be EXTENDED, never rewritten, by later phases.

---

## Phase 01 — Foundation

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

Claimed blast radius:
- `src/app/orders/**`
- `src/lib/totals.ts`, `src/lib/be-date.ts`
- `src/app/layout.tsx` (nav link) — SHARED with 01, 03 → EXTEND only

---

## Phase 05 — Printing

Claimed blast radius:
- `src/app/print/daily/[date]/**`, `src/app/print/shops/[date]/**`
- `src/styles/print.css`
- `src/app/api/print/**` (optional PDF fallback)
- `next.config.ts` (serverExternalPackages, if fallback adopted) — SHARED with 01 → EXTEND only

---

## Phase 06 — DB Settings & Delivery

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
