---
name: all-context
description: Root context router for orderstock — project description, phase-1 scope, real Next.js 16 + Prisma 7 + SQL Server stack (Phase 01 verified), order-form domain knowledge, and routing to context groups
keywords: orderstock, order form, ใบออเดอร์สินค้า, stock, orders, shops, products, sql server, prisma, nextjs, architecture, stack, routing
metadata:
  read_when: any substantial planning, research, review, or implementation task
---
# orderstock - All Context

Last updated: 2026-07-07 (pguard-redesign Phase 02 closeout — Core Desktop ✅ VERIFIED, program continues to Phase 03; phase1-order-system remains PROGRAM COMPLETE, all 6 phases VERIFIED, archived to `completed/`)

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## Project Description

**orderstock** is a stock-and-order management system (ระบบจัดการสต็อกและออเดอร์สินค้า) for a Thai food-products distribution business. In the user's own words: staff currently record daily customer orders on a paper form ("ใบออเดอร์สินค้า"); this system digitizes that workflow — data is entered into the system following the paper form, and the system must print output that matches the same form layout.

**Users:** business staff, 2 roles — **Admin** and **Staff (พนักงาน)** — with username/password login.

**UI language:** Thai.

### Phase 1 Scope (confirmed with user)

1. **Daily order sheet entry** following the reference document `Scan2026-07-04_170934.pdf` (repo root):
   - Header: date (วันที่), location/branch (สถานที่)
   - Rows = customer shops (ร้านค้า), ~29 per sheet
   - Columns = products split by package size (1 กก. / ½ กก.), e.g. ตีนิ่ม A, ตีนิ่ม, ตีดาว, กรวด, รอง — plus a seasonings column group (เครื่องปรุง: น้ำปลา, น้ำตาล, น้ำมัน, ...)
   - Cell = ordered quantity; per-row free-text notes (หมายเหตุ)
   - Footer: per-column totals + total weight (รวมน้ำหนัก) + aggregated notes
2. **Printing** in two forms, matching the scanned form layout (A4 landscape):
   - combined daily sheet (all shops in one table)
   - per-shop sheet
3. **Master data management** — add/edit shops and products (product list is fairly stable but must be editable).
4. **User login** — Admin / Staff roles.
5. **DB connection settings page** — enter a Connection String at runtime to point the app at the target SQL Server.

### Explicitly Out of Scope (Phase 1)

- **No stock deduction / inventory balance yet** — record orders and print forms only. Stock features come later (the project name anticipates them).

### Database Strategy

- Final target: **customer's SQL Server** (version unconfirmed, assumed mid-range, e.g. 2016–2019). We design the schema **from scratch**; at delivery we hand a SQL creation script to the customer's vendor to run.
- During development: **Sandbox database** first (SQL Server in Docker preferred), switched to the customer DB later via the connection-string settings page.
- Keep the schema compatible with mid-range SQL Server versions (avoid features newer than SQL Server 2016 unless confirmed).

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

**What each `all-{group}.md` must contain:**

- Scope (what the group covers and does NOT cover)
- Read-when rules (when an agent should load this group)
- Quick procedures or decision rules
- Source paths (list of deeper docs in the group)
- Update triggers (when to refresh this group's content)
- Routing to deeper docs within the group

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

<!-- GENERATED:routing -->
| File | Read when |
|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |
| `process/context/auth/all-auth.md` | implementing or reviewing any authenticated route, server action, session/role logic, or auth-related test |
| `process/context/database/all-database.md` | Database context entrypoint for orderstock — Prisma 7 + SQL Server schema, SQL Server-specific pitfalls (no enums, one-NULL-per-UNIQUE, NoAction cascades), historical-fidelity snapshot pattern, and seed/migration/export commands |
| `process/context/planning/all-planning.md` | creating or calibrating an implementation plan |
| `process/context/tests/all-tests.md` | the task involves testing, verification, or test debugging |
| `process/context/uxui/all-uxui.md` | any UI/token/component/shell/theme work, or any pguard-redesign phase after Phase 01 |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `auth/` | `process/context/auth/all-auth.md` | Auth context entrypoint for orderstock — next-auth v5 split-config architecture, requireAuth server-side choke-point contract, session policy, lockout, admin user management, and E2E fixtures |
| `database/` | `process/context/database/all-database.md` | Database context entrypoint for orderstock — Prisma 7 + SQL Server schema, SQL Server-specific pitfalls (no enums, one-NULL-per-UNIQUE, NoAction cascades), historical-fidelity snapshot pattern, and seed/migration/export commands |
| `planning/` | `process/context/planning/all-planning.md` | Planning context entrypoint for orderstock — plan-shape calibration (SIMPLE vs COMPLEX), planning conventions, and example plan references |
| `tests/` | `process/context/tests/all-tests.md` | Testing entrypoint for orderstock — Vitest 3.2.6 (75 tests/14 files) and Playwright E2E (19 tests) both real and wired, sandbox SQL Server constraint |
| `uxui/` | `process/context/uxui/all-uxui.md` | UI/UX context entrypoint for orderstock — pguard Design System tokens, semantic-alias contract, shared src/components/ui/* primitives, sidebar+topbar shell, dark mode, and print-font behavior |
<!-- /GENERATED:routing -->

## Task Routing Table

| Task type | Load first | Then load |
|---|---|---|
| general repo research | `all-context.md` | — (see Repository Structure below for the real Phase 01 tree) |
| implementation planning | `all-context.md`, `planning/all-planning.md` | the active plan in `process/general-plans/active/` |
| order-form domain questions | `all-context.md` | `process/features/order-system/completed/phase1-order-system_06-07-26/form-canonical_REF_06-07-26.md` (canonical transcription; raw scan at repo root) |
| order-system implementation (program complete — reference only) | `all-context.md` | the umbrella plan + phase plans in `process/features/order-system/completed/phase1-order-system_06-07-26/`; check `process/features/order-system/backlog/` first for any new order-system request |
| test planning or verification | `all-context.md`, `tests/all-tests.md` | — |
| database/schema/seed/migration work | `all-context.md`, `database/all-database.md` | `prisma/schema.prisma`, the relevant phase plan for decision rationale |
| auth/session/role/new server action work | `all-context.md`, `auth/all-auth.md` | `src/lib/auth-guard.ts`, `src/auth.ts`/`src/auth.config.ts` |
| UI/design/token/primitive/shell work (pguard-redesign) | `all-context.md`, `uxui/all-uxui.md` | `src/app/globals.css`, `src/components/ui/*`, the active pguard-redesign phase plan |
| context maintenance | `all-context.md` | run `vc-audit-context` after edits |

## Current Features

| Feature | Folder | Status |
|---|---|---|
| `order-system` | `process/features/order-system/` | **COMPLETE (07-07-26)** — phase program `phase1-order-system_06-07-26` (umbrella + 6 phase plans), all 6 phases ✅ VERIFIED (Foundation, Schema & Master Data, Auth, Order Entry, Printing, DB Settings & Delivery); folder archived to `completed/`. 6 backlog items remain, pending customer answers or optional hardening — see `process/features/order-system/backlog/` |
| `pguard-redesign` | `process/features/pguard-redesign/` | **ACTIVE (07-07-26)** — 5-phase program (`pguard-redesign_07-07-26`) re-skinning the frontend to the pguard Design System (no schema/backend rewrite). Phase 01 (Foundation: tokens, IBM Plex fonts, sidebar+topbar shell, `src/components/ui/*` primitives, dark mode) and Phase 02 (Core desktop: 20-col order-matrix replaces Order Pad, login/shops/products/users/settings reskin, print toolbar) are ✅ VERIFIED. Current phase: Phase 03 (New screens — สรุปยอดผลิต + ประวัติออเดอร์), loop step RESEARCH. See the umbrella `## Current Execution State` for carry-forward notes. |

When routing any new order-system-related work, pass `Feature: order-system`; check
`process/features/order-system/backlog/` for deferred items first, and reference the archived
program folder `process/features/order-system/completed/phase1-order-system_06-07-26/` for prior
decisions/patterns. Any new substantial order-system work (e.g. stock deduction, a future phase)
should get its own new task folder rather than reopening this completed one.

When routing any pguard-redesign-related work, pass `Feature: pguard-redesign` and read the
umbrella plan's `## Current Execution State` first — it names the current phase and loop step.
UI/token/primitive/shell questions route through `uxui/all-uxui.md` (see Current Context Groups
below).

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:

- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:

- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `vc-audit-context` skill after every context organization change.

`database/` was created at Phase 02 closeout — see `process/context/database/all-database.md`. `auth/` was created at Phase 03 closeout — see `process/context/auth/all-auth.md`. `uxui/` was created at pguard-redesign Phase 01 closeout — see `process/context/uxui/all-uxui.md`.

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:

- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

## Context Update Protocol

When durable project knowledge changes:

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `vc-audit-context`

---

## Repository Structure

**Current state: phase1-order-system PROGRAM COMPLETE (all 6 phases VERIFIED); pguard-redesign program ACTIVE (Phase 01 + Phase 02 VERIFIED, Phase 03 next).** The app is a real, buildable Next.js project wired to a Docker SQL Server sandbox via Prisma 7, with the full 9-model schema migrated, seeded, master-data CRUD (shops/products) wired, next-auth v5 credentials login + ADMIN/STAFF role-gating protecting every route, a daily order-sheet entry surface (create/edit/list by date+location) that recreates the 13/3/69 scan day with matching per-column totals and grand total (446), print routes (combined daily + per-shop) that render an A4-landscape mm-faithful form from a snapshot-only fetch, and an ADMIN-only runtime DB-connection settings page (fields → safe `.env` rewrite → restart-to-apply) plus the customer delivery package (vendor T-SQL schema script, hand-authored DB-creation/login script, Thai deployment guide). Authenticated app routes live under a `src/app/(main)/` route group so `/print` can render chrome-free. As of pguard-redesign Phase 01 (07-07-26), the app renders in the pguard Design System (IBM Plex fonts, token layer, dark mode, sidebar+topbar shell, `src/components/ui/*` primitives). **As of Phase 02 (07-07-26, VERIFIED), the daily order-sheet entry surface is the 20-column `order-matrix.tsx`** — it REPLACED the 4-file "Order Pad" (order-grid/shop-rail/shop-order-card/summary-bar, all deleted) and saves via the UNCHANGED `saveOrderSheet` payload; login/shops/products/admin-users/print-toolbar are reskinned and a new `/settings` establishment+display panel (backed by `src/lib/app-settings.ts`, an additive `AppSetting` read/write helper, no schema change) sits alongside the untouched `/settings/db` route — see `uxui/all-uxui.md`. The completed order-system program folder is archived at `process/features/order-system/completed/phase1-order-system_06-07-26/`.

```
orderstock/
  Scan2026-07-04_170934.pdf   -- reference: the paper order form to digitize and print
  CLAUDE.md / AGENTS.md        -- managed protocol files (do not edit per-project)
  .claude/ .codex/ .agents/    -- agent harness (kit v3.2.5)
  package.json / pnpm-lock.yaml / pnpm-workspace.yaml
  next.config.ts / tsconfig.json / eslint.config.mjs / postcss.config.mjs
  vitest.config.ts
  docker-compose.yml          -- disposable SQL Server 2022 sandbox (dev only)
  prisma.config.ts            -- JDBC-style URL for the Prisma CLI (migrate/introspect)
  .env / .env.example         -- DATABASE_URL + MSSQL_SA_PASSWORD + AUTH_SECRET/AUTH_TRUST_HOST/SEED_ADMIN_PASSWORD (.env is gitignored)
  playwright.config.ts        -- Playwright E2E config (Phase 03) — setup+chromium projects, webServer=pnpm start
  prisma/
    schema.prisma             -- full 9-model domain schema (Phase 02) — see database/all-database.md
    migrations/                -- 3 migrations (init_healthcheck, phase02_full_schema, shop_rosterorder_unique)
    seed.ts                    -- idempotent master-data + admin-user seed (shops, products/variants, ADMIN)
    load-env.ts                -- side-effect env-load import (seed.ts env-loading quirk)
  scripts/
    export-schema-sql.ts       -- vendor T-SQL DDL export -> db/create-orderstock-schema.sql
    phase06-roundtrip-gate.ts  -- Phase 06: Hybrid gate driving the save pipeline (validate→test-connection→env-write) against the orderstock2 same-container sandbox DB with a data-distinguishing sentinel round-trip
  db/
    create-orderstock-schema.sql -- generated vendor DDL export (offline, DDL-only)
    create-database-and-login.sql -- Phase 06: hand-authored CREATE DATABASE/LOGIN/USER/grants + COMPATIBILITY_LEVEL 140/150 TODO (customer version unconfirmed)
  docs/
    deployment-guide.md         -- Phase 06: Thai customer deployment guide (prereqs, .env/AUTH_SECRET setup, SQL run order, NSSM/IIS hosting, print instructions, backup, lockout recovery)
  e2e/                         -- Playwright specs (Phase 03) — see auth/all-auth.md E2E fixtures section
    auth.setup.ts               -- produces reusable ADMIN/STAFF storage-state fixtures (.auth/*.json, gitignored)
    auth.spec.ts                -- login/role-gate/redirect/enum hybrid gates
    orders.spec.ts              -- Phase 04: D1/D2 order-sheet round-trip + snapshot-preserve hybrid gates
    print.spec.ts               -- Phase 05: 7 print gates (colgroup 24/20, 29 rows + 446 totals, @page A4 landscape, snapshot-render + restore-in-finally, per-shop .sheet/break, test-side page.pdf, unauth redirect)
    settings.spec.ts            -- Phase 06: 3 runtime auth probes for /settings/db (unauth→/login, STAFF denied, ADMIN served)
  src/
    auth.ts                    -- Node-runtime next-auth config: Credentials provider + Prisma + bcryptjs (Phase 03)
    auth.config.ts             -- edge-safe split config: JWT session, authorized route/role gate (Phase 03)
    proxy.ts                   -- Next 16 route protection (NOT middleware.ts — silently ignored) (Phase 03)
    next-auth.d.ts             -- module augmentation: role on Session/JWT (Phase 03)
    styles/
      print.css                -- Phase 05: @page A4 landscape mm layout, dotted/solid borders, heavy สินค้า/เครื่องปรุง seam, additive (OFF) semantic-fill layer for Q30
    app/
      layout.tsx               -- Thai <html lang="th"> shell, root layout; pguard-redesign Phase 01: applies 3 IBM Plex font-var classes + inline no-flash `data-theme` bootstrap script in <head>
      globals.css               -- pguard-redesign Phase 01: pguard token layer (raw palette + semantic aliases + [data-theme=dark]) + Tailwind v4 @theme mapping — see uxui/all-uxui.md (fonts.css/Sarabun @font-face DELETED)
      nav.tsx                  -- pguard-redesign Phase 01: SERVER sidebar shell (216px, session/role, logout) — imports client NavLinks
      nav-links.tsx             -- pguard-redesign Phase 01: CLIENT active-link half (usePathname) — 3 menu groups incl. /summary /history
      topbar.tsx                -- pguard-redesign Phase 01: 62px topbar (title, TH/EN toggle, dark-mode toggle, empty #topbar-actions per-page slot)
      api/health/route.ts       -- DB connectivity health check (SELECT 1)
      api/auth/[...nextauth]/route.ts -- Auth.js v5 route handler (Phase 03)
      (auth)/login/**           -- Thai login page + server action (Phase 03)
      (main)/                   -- Phase 05: route GROUP (adds no URL segment) holding every authenticated app route; layout.tsx composes sidebar (nav.tsx) + topbar.tsx + scrollable <main> (pguard-redesign Phase 01)
        layout.tsx              -- renders sidebar+topbar shell; every route below is unchanged at the URL level
        page.tsx                -- home page: Thai title + DB-status indicator
        db-status.tsx           -- client component calling /api/health
        auth-actions.ts         -- logout server action (Phase 03)
        shops/**                -- shops master-data CRUD (Phase 02; requireAuth-guarded since Phase 03)
        products/**             -- products/variants master-data CRUD (Phase 02; requireAuth-guarded since Phase 03)
        admin/users/**          -- admin user management: list/create/edit-role/reset-password/deactivate (Phase 03)
        orders/**               -- daily order-sheet entry: list/create/edit by date+location (Phase 04); [id]/page.tsx extended Phase 05 with พิมพ์รวมทั้งวัน/พิมพ์แยกร้าน print links; pguard-redesign Phase 02 REPLACED order-grid.tsx (+ shop-rail/shop-order-card/summary-bar, all 4 deleted) with order-matrix.tsx
          order-matrix.tsx       -- pguard-redesign Phase 02: 20-col daily-order MATRIX (3-tier data-driven header, KPI strip, totals row via totals.ts) — desktop order-entry surface; hidden-input payload built EXCLUSIVELY via src/lib/order-payload.ts (byte-identical to the retired Order Pad); save/print portaled into #topbar-actions (see uxui/all-uxui.md)
          new-sheet-form.tsx     -- native date input (CE) + read-only BE label + "วันนี้" shortcut
          actions.ts             -- createOrderSheet (app-level dup check) / saveOrderSheet (snapshot-preserving) — IMMUTABLE since pguard-redesign Phase 02 (scope-fenced)
          page.tsx / [id]/page.tsx -- sheet list / editor
        settings/                -- Phase 06 ADMIN-only runtime DB-connection settings (db/**, untouched by pguard-redesign) PLUS pguard-redesign Phase 02 NEW establishment+display panels (page.tsx/settings-panels.tsx/actions.ts, backed by src/lib/app-settings.ts, additive AppSetting read/write, no schema change)
        summary/page.tsx         -- STUB through Phase 02 (requireAuth + "กำลังพัฒนา") — real build is pguard-redesign Phase 03 (bars from computeColumnTotals)
        history/page.tsx         -- STUB through Phase 02 (requireAuth + "กำลังพัฒนา") — real build is pguard-redesign Phase 03 (real OrderSheet rows)
      print/                    -- Phase 05: dedicated NO-NAV route group (chrome-free /print), sibling of (main)/, NOT nested inside it
        layout.tsx              -- no-nav layout (imports print.css); requireAuth() called explicitly per print page
        daily/[date]/page.tsx   -- combined-day sheet: all 29 roster slots incl. blank gaps
        shops/[date]/page.tsx   -- per-shop sheets, one `.sheet{break-after:page}` per shop, `?slots=` filter
        print-table.tsx         -- pure server render: 24-physical/20-semantic-col table, mm <colgroup>, totals row = LAST tbody row (never tfoot)
        print-controls.tsx      -- on-screen พิมพ์ button + Thai print-settings hint (hidden in @media print)
    components/
      sheet-header.tsx          -- reusable two-tier สินค้า/เครื่องปรุง header (Phase 04); EXTENDED additively in Phase 05 (subLabel 3rd tier, per-column className, trailingColSpan — all default-OFF, Phase-04 grid renders byte-identically)
      theme-toggle.tsx          -- pguard-redesign Phase 01: flips `data-theme` on <html>, persists to localStorage, hydration-safe via useSyncExternalStore
      ui/                       -- pguard-redesign Phase 01: shared presentational primitives — button/input/card/modal/toast/chip/status-dot/switch, all token-driven (see uxui/all-uxui.md)
    lib/
      db.ts                     -- PrismaClient singleton (driver-adapter pattern)
      fonts.ts                  -- pguard-redesign Phase 01: IBM Plex Sans Thai/Sans/Mono via next/font/google, exports fontVariables (Sarabun stack removed)
      product-order.ts          -- PACK_SIZES/PRODUCT_GROUPS/ROLES/ROLE_LABELS constants + 20-col printOrder contract
      variant-validation.ts     -- app-level printOrder-uniqueness validator
      correction-cascade.ts     -- historical-fidelity snapshot back-fill (CascadeDb adapter pattern)
      password.ts               -- bcryptjs hash/verify + timing-safe dummy compare (Phase 03)
      login-attempts.ts         -- LoginAttemptTracker: lockout after N failures (Phase 03)
      auth-guard.ts             -- requireAuth(role?) — the real server-side security boundary (Phase 03) — see auth/all-auth.md
      totals.ts                 -- computeColumnTotals / computeGrandTotal(orderLines) / computeTotalWeight — single source of truth, client+server both import this (Phase 04); also imported by Phase 05 print footer
      be-date.ts                -- CE<->BE conversion (Intl en-US-u-ca-buddhist) + Thai d/m/yy display helpers (Phase 04); reused for Phase 05 printed date headers
      order-save.ts             -- pure mergeSnapshots() snapshot-carry-forward helper, unit-testable without a DB (Phase 04)
      get-sheet-for-print.ts    -- Phase 05: NEW snapshot-only fetch (shopNameAtEntry/variantNameAtEntry, NEVER live Shop/ProductVariant names) — shared by both print routes; daily returns all 29 slots, per-shop filters in memory
      connection-string.ts      -- Phase 06: fields → JDBC sqlserver:// DATABASE_URL builder + validateDbFields + best-effort non-load-bearing parseConnectionString + maskPassword
      env-write.ts              -- Phase 06: safe .env DATABASE_URL rewrite — .env.bak backup-before-write, injection-safe (truncates at first CR/LF), never logs the value
      __tests__/                -- smoke, variant-validation, correction-cascade, password, login-attempts, auth-guard-coverage (now covers (main)/ + print pages + settings), secret-leak, totals, be-date, order-save, connection-string, env-write (70 tests total, Phase 06)
  test-fixtures/
    sheet-13-03-69.json         -- canonical 13/3/69 gate fixture (51 cells, 20 column totals, grand 446, 13 NoteLines) — shared by Phase 04 unit gate + Phase 05 print e2e tests
  public/fonts/                -- pguard-redesign Phase 01: Sarabun woff2 DELETED (fonts now self-hosted at build via next/font/google IBM Plex)
  process/
    context/                   -- this context system (incl. database/, auth/, planning/, tests/, uxui/ groups)
    general-plans/             -- plans, reports, references
    features/order-system/     -- phase1-order-system program (umbrella + 6 phase plans), COMPLETE, archived to completed/
    features/pguard-redesign/  -- pguard-redesign program (umbrella + 5 phase plans), ACTIVE — Phase 01 VERIFIED, current phase 02
    development-protocols/     -- RIPER-5 methodology docs
```

## Technology Stack

**Status: Phase 01 stack is REAL and installed** (verified via `package.json` + `pnpm-lock.yaml`, not just chosen). Pinned versions:

- **Framework:** Next.js **16.2.10** (App Router, Turbopack ON), React 19.2.4
- **Language:** TypeScript throughout
- **Database:** Microsoft SQL Server via **Prisma 7** driver-adapter pattern:
  - `prisma@7.8.0`, `@prisma/client@7.8.0`, `@prisma/adapter-mssql@7.8.0`, `mssql@^12.2.0`
  - dev: sandbox SQL Server 2022 in Docker (`docker-compose.yml`, `mem_limit: 2g`, compat level 150); production: customer's SQL Server via runtime connection string (Phase 06, not yet built)
- **CSS:** Tailwind 4 (`@tailwindcss/postcss`) via create-next-app default; print CSS (Phase 05) stays separate plain CSS
- **Testing:** Vitest 3.2.6 (`pnpm test` → `vitest run`) — 75 tests across 14 files (smoke, variant-validation, correction-cascade, password, login-attempts, auth-guard-coverage, secret-leak, totals, be-date, order-save, connection-string, env-write, settings-secret-hygiene, order-payload) as of pguard-redesign Phase 02 (order-payload added; phase1-order-system's own baseline was 70/12 at Phase 06). Playwright `@playwright/test@1.61.1` — installed Phase 03; 19 E2E tests across `e2e/auth.spec.ts` + `e2e/orders.spec.ts` (rewritten Phase 02 to drive the order-matrix) + `e2e/print.spec.ts` + `e2e/settings.spec.ts` + `e2e/auth.setup.ts` fixtures. See `tests/all-tests.md`.
- **Validation:** `zod@^4.4.3` — server-action input validation with Thai error messages (added Phase 02, decision 5); enforces `packSize`/`group`/`role` allowed values from `src/lib/product-order.ts` since SQL Server has no Prisma enums (see `database/all-database.md`)
- **Scripting runtime:** `tsx@^4.23.0` (devDep, added Phase 02) — runs `prisma/seed.ts` and `scripts/export-schema-sql.ts` directly
- **Package manager:** pnpm 11.5.0 (`pnpm-workspace.yaml` sets `allowBuilds` for native-script packages: `@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`, `sharp`, `unrs-resolver` — pnpm 11.5 blocks build scripts by default)
- **Auth:** NextAuth **next-auth@5.0.0-beta.31** (Credentials provider, JWT sessions) — installed and VERIFIED Phase 03. Also `bcryptjs@3.0.3` (password hashing, pure-JS, work factor 12). Route protection lives in `src/proxy.ts` (Next 16's replacement for the dead `middleware.ts`), not repo-root `middleware.ts`. See `auth/all-auth.md` for the full architecture and the `requireAuth(role?)` contract new server actions must follow.
- **UI:** Thai-language UI; print via browser print layout (A4 landscape) matching the scanned form (Phase 05). **pguard-redesign Phase 01 (07-07-26, VERIFIED) replaced Sarabun with IBM Plex Sans Thai / Sans / Mono via `next/font/google`** and introduced the pguard Design System (tokens, dark mode, sidebar+topbar shell, `src/components/ui/*` primitives) — see `uxui/all-uxui.md`.

## Key Patterns and Conventions

- **Prisma 7 driver-adapter singleton (`src/lib/db.ts`):** Prisma 7 REMOVED the `datasourceUrl` / `datasources` constructor options that older tutorials rely on. The runtime client MUST be built as `new PrismaClient({ adapter: new PrismaMssql(connectionString) })`, where `connectionString` is a JDBC-style `sqlserver://` string from `DATABASE_URL`. Keep ONE module-level singleton (via a `globalThis` cache in non-production) — never construct a `PrismaClient` per request (each instance owns an mssql connection pool). If the adapter cannot connect after correct config, the escape hatch is the node-mssql client directly (see `db-auth-feasibility_REF_06-07-26.md` §6) — do not silently retry with per-request clients.
- **CLI vs runtime connection config split:** `prisma.config.ts` holds the JDBC-style URL for the Prisma CLI (`migrate`, `introspect`); the datasource block in `prisma/schema.prisma` no longer carries a URL in Prisma 7 — it's `provider = "sqlserver"` only.
- **pguard Design System (added Phase 01 of pguard-redesign, 07-07-26, VERIFIED):** the app now runs on the pguard token layer + IBM Plex fonts + sidebar/topbar shell + shared UI primitives. Full detail lives in `uxui/all-uxui.md` — read it before any UI/token/component work. Summary: token layer in `src/app/globals.css` (raw palette + SEMANTIC aliases + `[data-theme="dark"]` overrides — components reference semantic aliases, never raw palette vars); fonts via `next/font/google` in `src/lib/fonts.ts` (IBM Plex Sans Thai/Sans/Mono — Sarabun fully removed, `src/app/fonts.css` deleted); shared primitives in `src/components/ui/*` (button/input/card/modal/toast/chip/status-dot/switch — reuse, don't reinvent); shell = `src/app/nav.tsx` (server) + `src/app/nav-links.tsx` (client active-link) + `src/app/topbar.tsx` (has an empty `#topbar-actions` per-page slot). Print pages inherit the body font (no explicit font-family in `print.css`), so the font swap re-typefaces `/print` too — verified faithful in Phase 01 (G-print-font).
- **order-matrix + AppSetting persistence (added Phase 02 of pguard-redesign, 07-07-26, VERIFIED):** the 20-column daily-order MATRIX (`src/app/(main)/orders/order-matrix.tsx`) replaced the Order Pad and is the desktop order-entry surface; it saves via the UNCHANGED `saveOrderSheet` action, with its hidden-input payload built EXCLUSIVELY through the pure `buildOrderPayload` helper (`src/lib/order-payload.ts`) — any future surface needing the same payload (Phase 04 mobile) should import this helper, not re-derive the emission rules. `src/lib/app-settings.ts` is the new small-key-value settings-persistence pattern (`prisma.appSetting` get/set, additive, no schema change) — reuse it for future small app-wide settings rather than adding schema columns. Full detail (including the `#topbar-actions` portal pattern) lives in `uxui/all-uxui.md`.
- Thai UI text; code, identifiers, and file names in English.
- Product package sizes are first-class: the same product is ordered in 1 กก. and ½ กก. units and appears as separate columns on the printed form (Phase 02+).
- Printed output must visually match `Scan2026-07-04_170934.pdf` — treat the scan as the layout spec (Phase 05).
- DB connection must be configurable at runtime (settings page with connection string), not hard-coded in env only (Phase 06).
- `prisma/schema.prisma` and `src/app/layout.tsx` are SHARED files extended (never rewritten) across phases — see the umbrella plan's Blast Radius + `phase-blast-radius-registry.md`.
- **Single-source totals module, imported by both client and server (`src/lib/totals.ts`, Phase 04):** the live on-screen footer in `order-grid.tsx` AND the server-side save-time verification in `actions.ts` import the SAME `computeColumnTotals`/`computeGrandTotal` functions — never reimplement the arithmetic in a second place. `computeGrandTotal(orderLines: OrderLineCell[])` type-excludes `NoteLine` quantities (no `includeNotes` flag) — note quantities are never part of the printed grand total.
- **BE date helper (`src/lib/be-date.ts`, Phase 04):** CE↔BE conversion via Intl `en-US-u-ca-buddhist` (not `th-TH-u-ca-buddhist` — `en-US` returns ASCII digits directly, matching the paper form's display convention; `th-TH` would return Thai digits requiring extra transliteration). Store CE in the DB always; display BE via this helper, never compute BE year arithmetic ad hoc elsewhere.
- **`(main)` route group is structural, not CSS-based nav exclusion (Phase 05):** every authenticated app route (orders, products, shops, admin, db-status, root page) lives under `src/app/(main)/`, whose `layout.tsx` renders `<Nav/>`; `src/app/print/**` is a SIBLING route group with its own no-nav `layout.tsx`. A Next.js route group adds NO URL segment — `/orders`, `/admin/users`, etc. are unchanged; only the file location and which layout wraps the page changed. Use this pattern (a route group), not `@media print` CSS hiding, whenever a route segment needs a genuinely different layout shell. `proxy.ts` and `requireAuth()` are untouched by route-group moves — they are not layout-dependent.
- **Print architecture (Phase 05):** print pages fetch through one NEW shared helper, `src/lib/get-sheet-for-print.ts` — snapshot-only (`shopNameAtEntry`/`variantNameAtEntry`), never the live `/orders/[id]` fetch, so a renamed shop still prints under its original name (historical-fidelity contract, `database/all-database.md`). The mm print CSS contract lives in `src/styles/print.css`: `@page { size: A4 landscape; margin: 8mm }`, `<colgroup>` mm widths emitted by the route (not the CSS file), totals row = LAST `tbody` row (never `tfoot`, which Chromium repeats per page). Shading is border-first: solid/dotted borders + a heavy สินค้า/เครื่องปรุง column-group seam are the shipped default; semantic fill colors are a pure-CSS ADDITIVE layer, present in `print.css` but commented out/OFF until the customer confirms Q30.

## Environment and Configuration

- `DATABASE_URL` — JDBC-style `sqlserver://localhost:1433;database=orderstock;user=sa;password=...;encrypt=true;trustServerCertificate=true` — sandbox default; runtime override via the ADMIN-only `/settings/db` page (Phase 06, built — validates + test-connects, then rewrites this line in `.env` with a `.env.bak` backup, applied on restart)
- `MSSQL_SA_PASSWORD` — SA password for the Docker sandbox container (also referenced by `docker-compose.yml`)
- `.env` holds real secrets and is gitignored (`.gitignore` covers `.env*`); `.env.example` holds placeholder values and is committed-safe
- `AUTH_SECRET` — signs the JWT session (v5 name — NOT `NEXTAUTH_SECRET`). Generate with `openssl rand -base64 32`. Real value only in `.env`.
- `AUTH_TRUST_HOST=true` — required so Auth.js trusts the host in self-hosted (non-Vercel) deployments.
- `SEED_ADMIN_PASSWORD` — initial ADMIN password consumed once by `prisma/seed.ts`; if unset, the seed generates one and prints it to stdout for out-of-band delivery. Never commit a real value.

## Dev Machine Facts (this repo's dev host)

- Dev host is an **Intel x86_64 Mac** (Core i5-1038NG7) — the `mcr.microsoft.com/mssql/server:2022-latest` (`linux/amd64`) image runs **natively**, no Rosetta involved. `platform: linux/amd64` is kept in `docker-compose.yml` for portability only (Apple-Silicon hosts would run it under Rosetta).
- The shared Docker Desktop VM (7.75 GiB) runs **9 unrelated containers** for other projects (quotation-system-app/api/postgres, krs-pos-db, wat-smoke-web/api/db/redis, claw-empire) using only ~773 MiB combined — plenty of headroom for the sandbox's `mem_limit: 2g`. **Never stop/restart any of these 9 containers.** Always run `docker stats --no-stream` before bringing the sandbox up, and check `docker logs orderstock-sql` after — SQL Server exits silently under memory pressure or on a weak SA password, with no other symptom.

## Gotchas and Cautions for Agents

- **`.env` privacy-hook approval quirk:** the repo's privacy hook blocks any agent read/write of `.env` and requires interactive user approval. For **Bash** commands, retry with an `APPROVED:.env` token in the command (e.g. `APPROVED:.env cat .env`) once the user approves. The **Write-tool path-prefix variant does NOT work** for this hook — it breaks due to path resolution — so `.env` creation must go through the Bash `APPROVED:` mechanism, not a direct Write call. This blocked Phase 01 EXECUTE from creating `.env` directly; the file was created only after an explicit interactive approval round.
- The reference PDF is a **handwritten scan** — product/shop names transcribed from it may contain OCR errors. Confirm exact master-data names with the user before seeding data (Phase 02).
- Thai Buddhist-era dates appear on the form (e.g. 13/3/69 = 2569 BE = 2026 CE). Store CE in the DB, display BE (decision applies from Phase 04 onward).
- SQL Server version at the customer is unconfirmed — keep schema/script compatible with mid-range versions (2017+ floor for Prisma; 2016 would be below it).
- No stock deduction in Phase 1 — do not design inventory-balance features prematurely.
- Next 16 renames `middleware.ts` → `proxy.ts` — a `middleware.ts` file is silently ignored (no build error). Resolved Phase 03: the app uses `src/proxy.ts` (sibling of `src/app/`, matching the `src/` layout). See `auth/all-auth.md`.
- **SQL Server has no Prisma enums** — `packSize`/`group`/`role` are `String` columns, not Prisma `enum`s (P1012 connector error otherwise). See `database/all-database.md` for the full pattern; the constants live in `src/lib/product-order.ts`.
- **`correction-cascade.ts` requires the `CascadeDb` adapter, not a raw `PrismaClient`.** Passing `prisma` directly where a `CascadeDb` is expected silently no-ops (no error, back-fill never runs) — EVL-proven gotcha. Full detail in `database/all-database.md`.
- **Reports/evidence files must NEVER quote real secret values, and must not even describe scans by naming the pattern searched for** (passwords, tokens, connection strings). This recurred across Phase 02, Phase 03, AND Phase 06 durable-capture sessions — it is a durable, recurring risk, not a one-off mistake. git-manager blocks commits on literal secret matches, so a report containing a real value stalls the process commit. Two rules, both required: (1) redact any real value found — write `[REDACTED-*]` placeholders, never the literal string; (2) when describing a secret-scan step itself, describe it WITHOUT quoting the scanned-for pattern — e.g. write "scanned for known credential prefixes (see `.env`)" rather than spelling out the actual prefix/pattern being searched, since even the search pattern can leak structural secret info. Apply this to every phase report, closeout packet, and evidence-pack JSON, going forward on any future project work.

## Open Questions / Outstanding Work

**phase1-order-system is program-complete; the items below are the remaining customer-input items, all backlogged (see `process/features/order-system/backlog/`) and none blocking delivery:**

- SQL Server version/compatibility level at the customer site — unconfirmed (sandbox defaults to compat 150 / SQL Server 2019; TODO-flagged in `db/create-database-and-login.sql`); confirm before the customer's DBA runs the delivery scripts
- Weight-factor conversion (Q22) — per-variant `weightKg`/`pipConversion` are null; print footer ships with blank values until the customer confirms (`weight-factors_NOTE_06-07-26.md`)
- Print semantic-fill shading (Q30) — CSS layer ready, OFF by default; flip on if the customer confirms colors (`print-shading-q30_NOTE_06-07-26.md`)
- Exact shop/product names transcribed from the handwritten scan — remaining `needsConfirmation=true` rows resolvable in-app via a CRUD edit-save (fires `correction-cascade.ts`); no longer strictly blocked on a separate confirmation round
- Thai collation — deferred past delivery; integer ordering (`printOrder`/`rosterOrder`) used everywhere instead
- On-site real-printer mm fidelity — agent-probe only so far; `docs/deployment-guide.md` instructs an on-site test print (Chrome/Edge, Scale 100%) before the customer relies on the layout
- Hosting confirmation — NSSM Windows service recommended (auto-restart on `.env` apply), pending customer IT confirmation; IIS reverse-proxy is the documented alternative

## Scan Metadata

- Generated: 2026-07-07 (pguard-redesign Phase 02 / UPDATE-PROCESS closeout)
- HEAD: 9a3e10b (docs(pguard-redesign): phase-02 core-desktop report + weight/peep backlog note)
- Mode: delta update (post-Phase-02 EXECUTE+EVL+UPDATE-PROCESS — Phase 02 VERIFIED, program continues to Phase 03)
- Package manager: pnpm 11.5.0
