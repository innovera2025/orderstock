---
name: all-context
description: Root context router for orderstock — project description, phase-1 scope, real Next.js 16 + Prisma 7 + SQL Server stack (Phase 01 verified), order-form domain knowledge, and routing to context groups
keywords: orderstock, order form, ใบออเดอร์สินค้า, stock, orders, shops, products, sql server, prisma, nextjs, architecture, stack, routing
metadata:
  read_when: any substantial planning, research, review, or implementation task
---
# orderstock - All Context

Last updated: 2026-07-06 (Phase 03 closeout — auth context group added)

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

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `auth/` | `process/context/auth/all-auth.md` | Auth context entrypoint for orderstock — next-auth v5 split-config architecture, requireAuth server-side choke-point contract, session policy, lockout, admin user management, and E2E fixtures |
| `database/` | `process/context/database/all-database.md` | Database context entrypoint for orderstock — Prisma 7 + SQL Server schema, SQL Server-specific pitfalls (no enums, one-NULL-per-UNIQUE, NoAction cascades), historical-fidelity snapshot pattern, and seed/migration/export commands |
| `planning/` | `process/context/planning/all-planning.md` | Planning context entrypoint for orderstock — plan-shape calibration (SIMPLE vs COMPLEX), planning conventions, and example plan references |
| `tests/` | `process/context/tests/all-tests.md` | Testing entrypoint for orderstock — Vitest 3.2.6 (24 tests/7 files) and Playwright E2E (7 tests, installed Phase 03) both real and wired, sandbox SQL Server constraint |
<!-- /GENERATED:routing -->

## Task Routing Table

| Task type | Load first | Then load |
|---|---|---|
| general repo research | `all-context.md` | — (see Repository Structure below for the real Phase 01 tree) |
| implementation planning | `all-context.md`, `planning/all-planning.md` | the active plan in `process/general-plans/active/` |
| order-form domain questions | `all-context.md` | `process/features/order-system/active/phase1-order-system_06-07-26/form-canonical_REF_06-07-26.md` (canonical transcription; raw scan at repo root) |
| order-system implementation | `all-context.md` | the umbrella plan + current phase plan in `process/features/order-system/active/phase1-order-system_06-07-26/` |
| test planning or verification | `all-context.md`, `tests/all-tests.md` | — |
| database/schema/seed/migration work | `all-context.md`, `database/all-database.md` | `prisma/schema.prisma`, the relevant phase plan for decision rationale |
| auth/session/role/new server action work | `all-context.md`, `auth/all-auth.md` | `src/lib/auth-guard.ts`, `src/auth.ts`/`src/auth.config.ts` |
| context maintenance | `all-context.md` | run `vc-audit-context` after edits |

## Current Features

| Feature | Folder | Status |
|---|---|---|
| `order-system` | `process/features/order-system/` | Active — phase program `phase1-order-system_06-07-26` (umbrella + 6 phase plans); Phase 01 Foundation ✅ VERIFIED, Phase 02 Schema & Master Data ✅ VERIFIED, Phase 03 Auth ✅ VERIFIED, Phase 04 Order Entry is the current phase |

When routing feature-scoped work, pass `Feature: order-system` and the program folder path
`process/features/order-system/active/phase1-order-system_06-07-26/` in the subagent prompt.

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

**Expected future groups for this project** (create when code exists): `uxui/` (Thai UI, print layouts). `database/` was created at Phase 02 closeout — see `process/context/database/all-database.md`. `auth/` was created at Phase 03 closeout — see `process/context/auth/all-auth.md`.

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

**Current state: Phase 01 (Foundation), Phase 02 (Schema & Master Data), and Phase 03 (Auth) VERIFIED.** The app is a real, buildable Next.js project wired to a Docker SQL Server sandbox via Prisma 7, with the full 9-model schema migrated, seeded, master-data CRUD (shops/products) wired, and next-auth v5 credentials login + ADMIN/STAFF role-gating protecting every route. Phases 04-06 are still planned/not implemented.

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
  db/
    create-orderstock-schema.sql -- generated vendor DDL export (offline, DDL-only)
  e2e/                         -- Playwright specs (Phase 03) — see auth/all-auth.md E2E fixtures section
    auth.setup.ts               -- produces reusable ADMIN/STAFF storage-state fixtures (.auth/*.json, gitignored)
    auth.spec.ts                -- login/role-gate/redirect/enum hybrid gates
  src/
    auth.ts                    -- Node-runtime next-auth config: Credentials provider + Prisma + bcryptjs (Phase 03)
    auth.config.ts             -- edge-safe split config: JWT session, authorized route/role gate (Phase 03)
    proxy.ts                   -- Next 16 route protection (NOT middleware.ts — silently ignored) (Phase 03)
    next-auth.d.ts             -- module augmentation: role on Session/JWT (Phase 03)
    app/
      layout.tsx               -- Thai <html lang="th"> shell + auth-aware nav (Phase 03)
      page.tsx                 -- home page: Thai title + DB-status indicator
      db-status.tsx             -- client component calling /api/health
      fonts.css                -- explicit @font-face + unicode-range for Sarabun
      globals.css               -- imports fonts.css
      nav.tsx                  -- auth-aware nav (current user + logout) (Phase 03)
      auth-actions.ts          -- logout server action (Phase 03)
      api/health/route.ts       -- DB connectivity health check (SELECT 1)
      api/auth/[...nextauth]/route.ts -- Auth.js v5 route handler (Phase 03)
      shops/**                  -- shops master-data CRUD (Phase 02; requireAuth-guarded since Phase 03)
      products/**               -- products/variants master-data CRUD (Phase 02; requireAuth-guarded since Phase 03)
      (auth)/login/**           -- Thai login page + server action (Phase 03)
      admin/users/**            -- admin user management: list/create/edit-role/reset-password/deactivate (Phase 03)
    lib/
      db.ts                     -- PrismaClient singleton (driver-adapter pattern)
      fonts.ts                  -- Sarabun font-family stack constant
      product-order.ts          -- PACK_SIZES/PRODUCT_GROUPS/ROLES/ROLE_LABELS constants + 20-col printOrder contract
      variant-validation.ts     -- app-level printOrder-uniqueness validator
      correction-cascade.ts     -- historical-fidelity snapshot back-fill (CascadeDb adapter pattern)
      password.ts               -- bcryptjs hash/verify + timing-safe dummy compare (Phase 03)
      login-attempts.ts         -- LoginAttemptTracker: lockout after N failures (Phase 03)
      auth-guard.ts             -- requireAuth(role?) — the real server-side security boundary (Phase 03) — see auth/all-auth.md
      __tests__/                -- smoke, variant-validation, correction-cascade, password, login-attempts, auth-guard-coverage, secret-leak (24 tests total)
  public/fonts/                -- self-hosted Sarabun OFL woff2 (400/600/700, thai+latin)
  process/
    context/                   -- this context system (incl. database/, auth/ groups)
    general-plans/             -- plans, reports, references
    features/order-system/     -- phase1-order-system program (umbrella + 6 phase plans)
    development-protocols/     -- RIPER-5 methodology docs
```

### Application Structure (Phases 04-06, planned)

- `src/app/orders/**`, `src/app/print/**` — order entry + print layouts (Phases 04-05)
- `src/app/settings/db/**` — connection-string settings page (Phase 06)

## Technology Stack

**Status: Phase 01 stack is REAL and installed** (verified via `package.json` + `pnpm-lock.yaml`, not just chosen). Pinned versions:

- **Framework:** Next.js **16.2.10** (App Router, Turbopack ON), React 19.2.4
- **Language:** TypeScript throughout
- **Database:** Microsoft SQL Server via **Prisma 7** driver-adapter pattern:
  - `prisma@7.8.0`, `@prisma/client@7.8.0`, `@prisma/adapter-mssql@7.8.0`, `mssql@^12.2.0`
  - dev: sandbox SQL Server 2022 in Docker (`docker-compose.yml`, `mem_limit: 2g`, compat level 150); production: customer's SQL Server via runtime connection string (Phase 06, not yet built)
- **CSS:** Tailwind 4 (`@tailwindcss/postcss`) via create-next-app default; print CSS (Phase 05) stays separate plain CSS
- **Testing:** Vitest 3.2.6 (`pnpm test` → `vitest run`) — 24 tests across 7 files (smoke, variant-validation, correction-cascade, password, login-attempts, auth-guard-coverage, secret-leak) as of Phase 03. Playwright `@playwright/test@1.61.1` — installed Phase 03 (first-time E2E setup, not Phase 05 as originally planned); 7 E2E tests in `e2e/auth.spec.ts` + `e2e/auth.setup.ts` fixtures. See `tests/all-tests.md`.
- **Validation:** `zod@^4.4.3` — server-action input validation with Thai error messages (added Phase 02, decision 5); enforces `packSize`/`group`/`role` allowed values from `src/lib/product-order.ts` since SQL Server has no Prisma enums (see `database/all-database.md`)
- **Scripting runtime:** `tsx@^4.23.0` (devDep, added Phase 02) — runs `prisma/seed.ts` and `scripts/export-schema-sql.ts` directly
- **Package manager:** pnpm 11.5.0 (`pnpm-workspace.yaml` sets `allowBuilds` for native-script packages: `@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`, `sharp`, `unrs-resolver` — pnpm 11.5 blocks build scripts by default)
- **Auth:** NextAuth **next-auth@5.0.0-beta.31** (Credentials provider, JWT sessions) — installed and VERIFIED Phase 03. Also `bcryptjs@3.0.3` (password hashing, pure-JS, work factor 12). Route protection lives in `src/proxy.ts` (Next 16's replacement for the dead `middleware.ts`), not repo-root `middleware.ts`. See `auth/all-auth.md` for the full architecture and the `requireAuth(role?)` contract new server actions must follow.
- **UI:** Thai-language UI; self-hosted Sarabun (OFL 1.1) font; print via browser print layout (A4 landscape) matching the scanned form (Phase 05, not yet built)

## Key Patterns and Conventions

- **Prisma 7 driver-adapter singleton (`src/lib/db.ts`):** Prisma 7 REMOVED the `datasourceUrl` / `datasources` constructor options that older tutorials rely on. The runtime client MUST be built as `new PrismaClient({ adapter: new PrismaMssql(connectionString) })`, where `connectionString` is a JDBC-style `sqlserver://` string from `DATABASE_URL`. Keep ONE module-level singleton (via a `globalThis` cache in non-production) — never construct a `PrismaClient` per request (each instance owns an mssql connection pool). If the adapter cannot connect after correct config, the escape hatch is the node-mssql client directly (see `db-auth-feasibility_REF_06-07-26.md` §6) — do not silently retry with per-request clients.
- **CLI vs runtime connection config split:** `prisma.config.ts` holds the JDBC-style URL for the Prisma CLI (`migrate`, `introspect`); the datasource block in `prisma/schema.prisma` no longer carries a URL in Prisma 7 — it's `provider = "sqlserver"` only.
- **Sarabun font via explicit `@font-face` + `unicode-range` (`src/app/fonts.css`), NOT `next/font/local`.** Google ships Thai and Latin as SEPARATE subset woff2 files per weight; `next/font/local`'s `src` array cannot assign a per-subset `unicode-range`, so two same-weight faces would silently override each other and break either Thai or Latin rendering. `src/lib/fonts.ts` owns the canonical `sarabunFontFamily` stack constant (`'Sarabun', 'TH Sarabun New', sans-serif`) that layout/components import — self-hosted woff2 under `public/fonts/`, downloaded once at build time from the official OFL release; never depend on the Google CDN or a customer-installed font at runtime.
- Thai UI text; code, identifiers, and file names in English.
- Product package sizes are first-class: the same product is ordered in 1 กก. and ½ กก. units and appears as separate columns on the printed form (Phase 02+).
- Printed output must visually match `Scan2026-07-04_170934.pdf` — treat the scan as the layout spec (Phase 05).
- DB connection must be configurable at runtime (settings page with connection string), not hard-coded in env only (Phase 06).
- `prisma/schema.prisma` and `src/app/layout.tsx` are SHARED files extended (never rewritten) across phases — see the umbrella plan's Blast Radius + `phase-blast-radius-registry.md`.

## Environment and Configuration

- `DATABASE_URL` — JDBC-style `sqlserver://localhost:1433;database=orderstock;user=sa;password=...;encrypt=true;trustServerCertificate=true` — sandbox default; runtime override via the Phase 06 settings page (not yet built)
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
- **Reports/evidence files must NEVER quote real secret values** (passwords, tokens, connection strings) — write `[REDACTED-*]` placeholders instead. This recurred across Phase 02 and Phase 03 durable-capture sessions; git-manager blocks commits on literal secret matches, so a report containing a real value stalls the process commit. Always redact before writing a phase report, closeout packet, or evidence-pack JSON.

## Open Questions / Outstanding Work

- SQL Server version at the customer site — unconfirmed (assumed mid-range); confirm before finalizing the schema script
- Exact shop names and product list — transcribed from a handwritten scan; ~31 uncertain readings seeded with `needsConfirmation=true` (Phase 02). These are now partially resolvable **in-app**: a CRUD edit-save on the flagged shop/product clears `needsConfirmation` and fires `correction-cascade.ts` to back-fill any existing OrderLine/NoteLine snapshots — no longer strictly blocked on a separate confirmation round with the user.
- Sandbox compatibility level: defaulted to 150 (SQL Server 2019); customer's actual target (140 for 2017 vs 150 for 2019) is unconfirmed — accepted known-gap, re-run compat check once confirmed
- Conversion factors / any remaining uncertain readings in the canonical form transcription — see `form-canonical_REF_06-07-26.md`
- Thai collation — deferred to Phase 06 delivery (decision 3); integer ordering (`printOrder`/`rosterOrder`) used everywhere in Phase 1 instead

## Scan Metadata

- Generated: 2026-07-06 (Phase 03 closeout update)
- HEAD: c3a85fc (docs: phase-03 verified closeout artifacts)
- Mode: delta update (post-Phase-03 EXECUTE+EVL+UPDATE-PROCESS)
- Package manager: pnpm 11.5.0
