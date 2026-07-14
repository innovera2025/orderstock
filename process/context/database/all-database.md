---
name: context:all-database
description: "Database context entrypoint for orderstock — Prisma 7 + SQL Server schema, SQL Server-specific pitfalls (no enums, one-NULL-per-UNIQUE, NoAction cascades), historical-fidelity snapshot pattern, seed/migration/export commands, and production-DB shared-ERP-database danger guardrails"
keywords: database, prisma, schema, sql server, mssql, migration, migrate, seed, enum, cascade, correction cascade, snapshot, printOrder, export, vendor sql, zod, tsx, dotenv-expand, resolveDatabaseUrl, connection string, db_TCL, production database, shared ERP, migrate reset, danger, guardrails, location, shop location, roster, buildLocationRoster, displayNo, rosterOrder, locations, managed location list, appsetting, location management, rename cascade, transaction
related: [context:all-tests]
date: 15-07-26
---

Last updated: 15-07-26 (`location-management` plan ✅ VERIFIED AT CODE LEVEL — pending commit:
managed `/locations` list stored as ONE JSON `AppSetting` row (`key: "locations"`, ZERO schema
change), atomic rename cascade to `Shop.location`, delete guard extended to soft-deleted shops;
prior: `shop-location-roster` plan ✅ VERIFIED AT CODE LEVEL and archived: `Shop`
gains `location`, per-location roster via `src/lib/roster.ts` `buildLocationRoster`, new db_TCL
delivery ALTER script; prior: `ordersheet-soft-delete` plan VERIFIED — `OrderSheet` gains `active`
soft-delete column)

# Database Context

This file is the canonical database context entrypoint for orderstock.

Use it after `process/context/all-context.md` when the task touches `prisma/schema.prisma`,
migrations, seeding, master-data CRUD, or the vendor SQL export.

---

## Scope

This group covers:

- Prisma 7 schema conventions and the 9-model domain (Shop, Product, ProductVariant, OrderSheet,
  OrderLine, NoteLine, User, AppSetting, HealthCheck)
- SQL Server connector constraints baked into the schema (no enums, one-NULL-per-UNIQUE, cascade
  rules, Decimal precision)
- The historical-fidelity snapshot pattern (`shopNameAtEntry`/`variantNameAtEntry` +
  `correction-cascade.ts`)
- Migration, seed, and vendor SQL export commands and their prerequisites
- Known DB-layer gaps (Thai collation, customer SQL Server compatibility level)

It does not cover:

- Test runner selection/commands in general — see `tests/all-tests.md` (this group only owns the
  DB-specific test gotchas: the `CascadeDb` adapter pattern and sandbox prerequisites, cross-linked
  from there)
- Auth/session schema decisions beyond the bare `User` model fields — Phase 03 owns an `auth/` group
  when it lands
- Print-layout/UI rendering of order data — belongs in a future `uxui/` group

## Read When

Read this entrypoint when:

- adding, extending, or migrating a Prisma model
- writing or debugging seed logic (`prisma/seed.ts`)
- working with `packSize` / `group` / `role` values (these are NOT Prisma enums)
- implementing a feature that must respect the correction-cascade / snapshot pattern
  (any Phase 04/05 code that writes or renders `OrderLine`/`NoteLine`)
- running or modifying the vendor SQL export (`scripts/export-schema-sql.ts`)
- debugging a SQL Server migration failure (multi-NULL unique, cascade path rejection, invalid enum
  literal)

## Quick Routing

- use this file for schema overview, SQL Server pitfalls, the snapshot/cascade pattern, and commands
- use `process/features/order-system/completed/phase1-order-system_06-07-26/form-canonical_REF_06-07-26.md`
  for the 20-column printOrder contract's *source data* (the canonical form transcription); the
  in-code contract lives at `src/lib/product-order.ts` (`PRINT_VARIANTS`, C3–C22)
- use `process/features/order-system/completed/phase1-order-system_06-07-26/phase-02-schema-master-data_PLAN_06-07-26.md`
  for the full PVL fix rationale (F1–F7) behind each schema decision below

## Source Paths

- `prisma/schema.prisma` — the 9-model schema (176 lines)
- `prisma/seed.ts` — idempotent seed script
- `prisma/load-env.ts` — side-effect env-load import (see Gotchas)
- `src/lib/product-order.ts` — `PACK_SIZES`/`PRODUCT_GROUPS`/`ROLES` constants + Thai label maps +
  `PRINT_VARIANTS` (the 20-column printOrder contract) + `variantDisplayName()`
- `src/lib/variant-validation.ts` — `isPrintOrderAvailable()` app-level printOrder-uniqueness check
- `src/lib/correction-cascade.ts` — `cascadeShopNameCorrection()` / `cascadeVariantNameCorrection()`
  + the `CascadeDb` adapter interface
- `src/lib/db.ts` — the `PrismaClient` driver-adapter singleton (do not construct a second client)
- `src/lib/resolve-database-url.ts` — `resolveDatabaseUrl(envPath?)`, the shared raw-read
  `DATABASE_URL` resolver used by both `db.ts` and `prisma.config.ts` (dotenv-expand-proof; see
  "Runtime Connection Settings & Safe Env Write" below)
- `scripts/export-schema-sql.ts` — vendor T-SQL DDL export → `db/create-orderstock-schema.sql`
- `src/app/shops/**`, `src/app/products/**` — master-data CRUD (server actions + RSC forms)

## Update Triggers

Update this group when:

- the schema gains new models, or `packSize`/`group`/`role` gains new allowed values
- the correction-cascade pattern changes (e.g. gains a third snapshot type)
- the vendor export command or its flags change (Prisma CLI renames flags across versions —
  already happened once, see Gotchas)
- Thai collation is decided (currently deferred to Phase 06)
- the customer's actual SQL Server compatibility level is confirmed

---

## Schema Overview (9 models, Phase 02)

`prisma/schema.prisma` extends the Phase 01 `HealthCheck` model — **never rewrite it, only extend**.

| Model | Purpose | Notable fields |
|---|---|---|
| `HealthCheck` | Phase 01 migration-pipeline probe | `id`, `checkedAt` |
| `Shop` | Customer shop (ร้านค้า) | `rosterOrder Int @unique` (append-only/immutable once referenced by any sheet), `location String? @db.NVarChar(200)` (added 13-07-26, `shop-location-roster` plan — nullable, optional in the shop form), `active` soft-delete, `needsConfirmation` |
| `Product` | Base product | `group String` ("GOODS"/"SEASONING"), `isOffList`, `active` soft-delete |
| `ProductVariant` | Product × pack-size/flavor | `packSize String`, `printOrder Int?` (NOT `@unique`), `weightKg`/`pipConversion Decimal(10,3)?`, `name` (snapshot source) |
| `OrderSheet` | Daily order sheet | `date @db.Date` (CE; BE display is Phase 04+), `location`, `active Boolean @default(true)` soft-delete (added 11-07-26, `ordersheet-soft-delete` plan — mirrors `Shop`/`Product`/`User`) |
| `OrderLine` | One shop×variant order cell | `qty Int`, `shopNameAtEntry`/`variantNameAtEntry` snapshots |
| `NoteLine` | Free-text remark row | nullable `shopId`/`productVariantId`, `text @db.NVarChar(Max)`, `qty Int?`, snapshots |
| `User` | App user (Phase 03 owns auth logic + admin seed) | `role String` default `"STAFF"` — no rows seeded in Phase 02 |
| `AppSetting` | Runtime key/value settings (Phase 06 connection string) | `key @unique`, `value @db.NVarChar(Max)` |

**Print-order contract:** the 20 in-print-order `ProductVariant` rows (printOrder 1–20, form columns
C3–C22) are LOAD-BEARING for Phases 04 (order entry) and 05 (printing) — see
`src/lib/product-order.ts` `PRINT_VARIANTS` for the canonical in-code contract, and the phase-02 plan
for the full column↔product mapping table.

---

## SQL Server Connector Pitfalls (encoded in the schema — read before touching it)

- **LOAD-BEARING: the Prisma `sqlserver` connector does NOT support Prisma `enum` types at all**
  (`prisma validate` errors with P1012). `packSize`, `group`, and `role` are therefore plain
  `String` columns (`@db.NVarChar(20)`), NOT Prisma enums. The single source of truth for allowed
  values is `src/lib/product-order.ts` (`PACK_SIZES`, `PRODUCT_GROUPS`, `ROLES` — typed unions +
  Thai label maps), enforced at the app layer via `zod`. **Phases 03–05 must reuse these constants,
  never invent a new enum type or a parallel set of string literals.**
- **One NULL per UNIQUE constraint.** SQL Server rejects a `@unique`/`@@unique` on a nullable column
  that needs more than one NULL row. `ProductVariant.printOrder` is `Int?` (off-list variants carry
  `printOrder = NULL`) and is deliberately **NOT** `@unique` — uniqueness is enforced app-side by
  `isPrintOrderAvailable()` over the active, non-null variant set. If a DB-level guarantee is ever
  wanted, it must be a raw filtered index (`WHERE printOrder IS NOT NULL`), never a Prisma `@unique`.
- **`onDelete`/`onUpdate: NoAction` on every `OrderLine`/`NoteLine` relation.** SQL Server rejects
  schemas with multiple or cyclic cascade paths reachable from one table. All FKs on `OrderLine` and
  `NoteLine` (to `OrderSheet`, `Shop`, `ProductVariant`) use `NoAction` for this reason.
- **`weightKg`/`pipConversion` use explicit `@db.Decimal(10,3)`** so the generated T-SQL is
  deterministic for the DBA (both nullable — values unknown until user confirms conversion factors).
- **`Shop.rosterOrder @unique`** — a natural key for the idempotent seed upsert; append-only/immutable
  once referenced by any sheet (never renumber).

---

## Historical-Fidelity Snapshot Pattern (LOAD-BEARING for Phases 04/05)

`OrderLine` and `NoteLine` carry denormalized name snapshots (`shopNameAtEntry`,
`variantNameAtEntry`) written at line-create time, so a later shop/product rename never rewrites
already-printed history.

**Correction cascade (`src/lib/correction-cascade.ts`):**

- `cascadeShopNameCorrection(db, shopId, newName, wasNeedsConfirmation)` and
  `cascadeVariantNameCorrection(db, variantId, newName, wasNeedsConfirmation)` back-fill the
  snapshot columns **only while `wasNeedsConfirmation === true`** (typo fixes on an unconfirmed
  entity propagate to existing lines). Once an entity is confirmed
  (`needsConfirmation === false`), the snapshots are **LOCKED** — later renames do NOT rewrite
  history.
- **EVL-proven gotcha:** the cascade functions take a `CascadeDb` adapter interface
  (`backfillShopNameSnapshots` / `backfillVariantNameSnapshots`), NOT a raw `PrismaClient`. Passing
  a raw Prisma client where a `CascadeDb` is expected **silently no-ops** — there is no compile or
  runtime error, the back-fill just never runs. Any caller (CRUD edit actions now, Phase 04/05 code
  later) MUST wire a real `CascadeDb` adapter (e.g. a thin wrapper calling
  `prisma.orderLine.updateMany` / `prisma.noteLine.updateMany`), never pass `prisma` directly.
- Phase 05 prints from the snapshot columns, never from live `Shop`/`ProductVariant` names.

---

## Commands

| Purpose | Command | Notes |
|---|---|---|
| Apply migrations (sandbox) | `pnpm prisma migrate dev` | Needs `.env` + sandbox `orderstock-sql` up |
| Check migration status | `npx prisma migrate status` | Expect "up to date", 3 migrations |
| Seed (idempotent) | `pnpm tsx prisma/seed.ts` | Safe to re-run; run twice to prove idempotency (counts stable) |
| Vendor SQL export | `pnpm tsx scripts/export-schema-sql.ts` | Offline, no DB needed; writes `db/create-orderstock-schema.sql` |
| Verify export | `grep -c "CREATE TABLE" db/create-orderstock-schema.sql` | Expect `9` |

**Sandbox prerequisites:** `.env` must exist (`DATABASE_URL` + `MSSQL_SA_PASSWORD`, privacy-hook
guarded — see `all-context.md` Gotchas), sandbox up via `docker compose up -d`, `docker stats
--no-stream` confirming ≥2 GiB headroom, and `docker logs orderstock-sql` checked (SQL Server exits
silently under memory pressure or a weak SA password).

**Seed script quirk (`prisma/load-env.ts`):** `pnpm tsx prisma/seed.ts` does NOT pass through
`prisma.config.ts`'s env loading, so `.env` is not auto-loaded and `src/lib/db.ts` throws on missing
`DATABASE_URL`. `prisma/seed.ts` imports `prisma/load-env.ts` FIRST (a side-effect module calling
`process.loadEnvFile()`) specifically so import-hoisting order does not break env loading — do not
move that import or inline `process.loadEnvFile()` directly in `seed.ts` after other imports.

**Vendor export flag:** Prisma 7 renamed `--to-schema-datamodel` to `--to-schema` — if a script or
doc references the old flag name, it is stale.

---

## Order-Entry Write Path (Phase 04, LOAD-BEARING for Phase 05)

`src/app/orders/actions.ts` `saveOrderSheet` is the reference implementation for writing
`OrderLine`/`NoteLine` under SQL Server's `NoAction` cascade constraint. Any future write path
touching these two tables must follow the same pattern.

**Snapshot-preserving save pattern (read-before-delete):**

1. **Inside the `$transaction`, READ existing `OrderLine`/`NoteLine` rows for the sheet FIRST** and
   capture their `shopNameAtEntry`/`variantNameAtEntry` snapshot text.
2. **Explicitly `deleteMany` the child `OrderLine`/`NoteLine` rows** — never rely on cascade. Every FK
   on these tables is `onDelete: NoAction` (see SQL Server Connector Pitfalls above), so deleting the
   parent `OrderSheet` while children exist would be rejected outright; children must be deleted
   first, explicitly, every time.
3. **Re-insert, carrying forward captured snapshot text** for cells that already existed (matched by
   `shopId`+`variantId`); write a FRESH snapshot only for genuinely new cells. A naive re-derive from
   current live `Shop`/`ProductVariant` names would silently break the historical-fidelity guarantee
   (see the snapshot pattern above) — this is why carry-forward is load-bearing, not cosmetic.
4. **Keep the SAME `OrderSheet` row** (update `updatedAt`/`lastUpdated`) — do not delete+recreate the
   sheet itself, only its child lines.

The carry-forward-vs-fresh decision is extracted into a pure, DB-free helper —
`src/lib/order-save.ts` `mergeSnapshots(existingLines, incomingCells, liveNames)` — so it is
unit-testable without a live database (mirrors the Phase 02 `CascadeDb` extract-pure-logic pattern).
`order-save.test.ts` proves the naive re-derive-from-live-names behavior FAILS this gate while the
carry-forward implementation passes it.

**Duplicate-check-in-transaction pattern:** `OrderSheet` has no DB-level unique constraint on
`(date, location)` (see decision 3, Phase 04 INNOVATE — deliberate, no schema migration). Instead,
`createOrderSheet` does an app-level check-then-create for an existing sheet on the same
date+location **inside the same `$transaction`**; on conflict it redirects to the existing sheet
rather than creating a duplicate. This is safe under normal sequential usage but not against truly
concurrent saves (accepted residual — see
`process/features/order-system/backlog/order-sheet-dup-index_NOTE_06-07-26.md` for the deferred
filtered-unique-index hardening).

**Note auto-resolve (both FK and raw text always stored):** free-text `NoteLine` entries are matched
against off-list product-variant names by exact text match. On a match, `productVariantId` is set
**AND** the raw text is always kept (never nulled out on match) — so a note is never FK-only or
lossy. On no match, the note remains text-only (unlinked). This mirrors the same carry-forward
principle: never discard information the paper form actually captured.

**qty>0 invariant (blank = no line):** every `OrderLine`/`NoteLine` `qty` is a positive `Int`; a
blank grid cell means the line is OMITTED entirely, never persisted as `qty = 0`. Any code reading
or writing these tables must preserve this invariant — a `qty` of `0` should never appear in the DB
for either table.

## Runtime DB Connection Config — now manual (Phase 06 page REMOVED 11-07-26)

The `DATABASE_URL` used by BOTH `src/lib/db.ts` (app runtime) and `prisma.config.ts` (CLI) has a
single source of truth: the `.env` file. Phase 06 originally built an ADMIN-only runtime settings
page (`/settings/db`) that let an admin repoint the app at a different SQL Server without editing
`.env` by hand — **this page was removed 11-07-26** (`remove-settings-db` plan) because it 500'd
in the production Docker deploy: the app container runs as a non-root user and the bind-mounted
`.env` file is root-owned, so the page's write step could never succeed there. Its two supporting
libraries (`src/lib/connection-string.ts` — fields→JDBC URL builder — and `src/lib/env-write.ts` —
the injection-safe `.env` rewrite helper) and their test files were deleted along with it.

**Changing the DB connection is now a manual ops procedure**, for any environment: edit the
`DATABASE_URL` line directly in `.env` on the host, then restart the app process/container
(`docker restart` in the Docker deploy, or the NSSM/Windows-service restart in the non-Docker
path) — the same "apply = restart, not a hot swap" behavior as before, just triggered manually
instead of by an in-app save button. `src/lib/resolve-database-url.ts` (below) is completely
independent of the removed page and is unaffected by its removal.

- **Apply = restart, NOT a hot singleton swap.** `src/lib/db.ts` reads the connection string once
  at module init (via `resolveDatabaseUrl()` — see below), so a process restart genuinely picks up
  the new connection. Prisma 7 has no live-URL-swap API on an existing `PrismaClient`; do not
  attempt one.
- **`$`-in-password dotenv-expand gotcha (fixed 11-07-26, `db-url-dollar-roundtrip` plan — still
  live, unaffected by the settings-page removal):** the Next app loads `.env` via `@next/env`,
  which runs `dotenv-expand` internally — a literal `$` in `DATABASE_URL` (e.g. in the password)
  gets silently mangled, breaking the connection ("Login failed for user 'sa'") after any
  restart-apply of a manually edited `.env`. `process.loadEnvFile()` (Node 22+, used by
  `prisma/load-env.ts`→seed and `prisma.config.ts`→CLI) does **not** expand, so those paths were
  never affected — only the `@next/env`-loaded app runtime (`src/lib/db.ts`) was broken. Fixed by
  **`src/lib/resolve-database-url.ts`** (`resolveDatabaseUrl(envPath?)`): raw-reads the first
  `DATABASE_URL=` line straight from `.env` (string ops, not dotenv), strips one matching quote
  pair, returns it verbatim — no expansion, no `$`-substitution — falling back to
  `process.env.DATABASE_URL` when the file is absent (Docker BUILD stage placeholder / CI). Both
  `db.ts` and `prisma.config.ts` import this ONE shared resolver instead of two independent
  env-reads. **Why raw-read instead of escaping `$` on write or preloading `process.env`:**
  escaping is fragile (named-instance `\INST` edge cases, less human-readable `.env` for a manual
  edit); preloading `process.env` before Next boots does NOT help — `@next/env` overrides any
  pre-set var with its own expanded file value.
- **Lockout recovery is a documented MANUAL step, not an in-app authless bypass.** Because
  `requireAuth()` re-reads the DB on every call, a bad `.env` connection string locks EVERY admin
  out (auth itself can't reach the DB to authenticate). The only recovery path is a manual `.env`
  edit or restore-from-backup — documented in `docs/deployment-guide.md`. An authless in-app
  bootstrap to "fix" this was explicitly considered and REJECTED during Phase 06 RESEARCH as a
  trust-boundary hole; the removed page's `.env.bak` backup-before-write behavior no longer exists
  — take a manual backup of `.env` before editing it in production.
- **Delivery artifacts:** `docs/deployment-guide.md` (Thai) and `docs/deployment-guide-docker.md`
  document the manual `.env`-edit + restart procedure (updated 11-07-26, replacing the in-app-flow
  description), prereqs, `AUTH_SECRET` setup, SQL script run order, NSSM/IIS/Docker hosting, print
  instructions, backup guidance, and lockout-recovery. `db/create-database-and-login.sql` is the
  hand-authored companion to `db/create-orderstock-schema.sql` (CREATE DATABASE/LOGIN/USER/grants +
  a TODO-flagged `COMPATIBILITY_LEVEL 140/150` pending the customer's actual SQL Server version).

## ⚠ Production DB: shared ERP database `db_TCL` — DANGER guardrails (verified 11-07-26)

**Read this before touching anything on the production server.** A read-only audit of the live
production database (external SQL Server `43.229.134.162`, SQL Server 2019 Enterprise,
`COMPATIBILITY_LEVEL 130`, collation `Thai_CI_AS`) confirmed `db_TCL` is **NOT a dedicated
orderstock database** — it is the customer's **LIVE ERP / accounting database**, containing
hundreds of unrelated tables (`Customer`, `Supplier`, `Employee`, `SalesInvoiceHdr/Dtl`,
`PurchaseOrderHdr/Dtl`, `InventoryItem`, `AccountChart`, `GeneralJournal`, `PettyCash*`, `tblBom*`,
`WithholdingTax*`, `Warehouse`, etc.). orderstock's own 9 tables (`HealthCheck`, `Shop`, `Product`,
`ProductVariant`, `OrderSheet`, `OrderLine`, `NoteLine`, `User`, `AppSetting`) **COEXIST** inside
this shared database. **The customer has decided to keep orderstock in `db_TCL` and only ever
touch orderstock's own 9 tables — never the ERP tables.** orderstock's own data was verified
complete and correct (admin user, 25 shops, 20 in-print-order variants + 8 off-list, ตีลานนิ่ม/ตีลาน
rename applied, value domains valid). The app currently connects as `user=sa` (full sysadmin on a
shared ERP DB — a flagged security concern; recommended future hardening is a limited login scoped
to only the 9 orderstock tables, not yet done per the customer's "don't touch anything else"
instruction).

**Hard guardrails — these exist to prevent catastrophic ERP data loss:**

1. **NEVER run `prisma migrate reset`, `prisma migrate dev`, or `prisma db push --force-reset`
   against `db_TCL`.** These DROP ALL TABLES in the target database — against `db_TCL` this would
   wipe the customer's entire live ERP, not just orderstock's 9 tables.
2. **NEVER re-run `db/create-database-and-login.sql` against the live production server.** Its
   `IF DB_ID('db_TCL') IS NULL` guard skips database creation (since `db_TCL` already exists), but
   it would still execute `CREATE LOGIN orderstock_app` + `GRANT db_owner` against the live ERP
   database — see the leading warning comment added to the script itself.
3. **Schema changes to orderstock's own tables on `db_TCL` must go through hand-written SQL scoped
   to only the 9 orderstock tables, or `prisma migrate resolve`** — never an auto-migrate command
   against the live server.
4. **SAFE operations** (these touch only the 9 orderstock tables and are fine): the runtime app
   itself (the Prisma driver-adapter client only knows the 9 orderstock models), `prisma/seed.ts`
   (idempotent, only upserts orderstock master data), and normal in-app use (shops/products/orders
   CRUD via the UI).
5. **`COMPATIBILITY_LEVEL` is 130 on the live server and MUST NOT be altered.** All Prisma queries
   already succeed at level 130 (verified this session) — altering it would change query plans for
   the customer's *entire* ERP system, not just orderstock. **This supersedes the
   `COMPATIBILITY_LEVEL >= 140` TODO in `db/create-database-and-login.sql` for THIS deployment** —
   that TODO applies only to the fresh-dedicated-DB scenario, not this shared-ERP production target.

## OrderSheet Soft-Delete (added 11-07-26, `ordersheet-soft-delete` plan — VERIFIED)

`OrderSheet` now carries `active Boolean @default(true)`, the same soft-delete pattern already used
by `Shop`/`Product`/`User`. ADMIN-only server action `softDeleteOrderSheet(id)`
(`src/app/(main)/orders/actions.ts`) sets `active = false`; no cascade, `OrderLine`/`NoteLine` rows
are never touched or deleted.

**Every read/write path touching `OrderSheet` must exclude inactive rows** (or reject writes to
them) — this is now the reference pattern any future `OrderSheet`-adjacent feature must follow:

| Site | Rule |
|---|---|
| `orders/page.tsx` list | `where: { active: true }` |
| `orders/[id]/page.tsx` editor | `!sheet.active` → `notFound()` |
| `src/lib/get-sheet-for-print.ts` (both print routes) | `where: { active: true }` in the shared `findFirst` |
| `history/page.tsx` | `where: { active: true }` on the primary `orderSheet.findMany` only — the two `groupBy` calls are unfiltered but harmless (their aggregate map is only ever looked up for sheets already present in the filtered list) |
| `summary/page.tsx` | `active: true` on BOTH `orderSheet.findFirst` branches (`?date=` lookup and "most recent") |
| `orders/actions.ts` `createOrderSheet` dup-check | `active: true` — otherwise a soft-deleted sheet at the same date+location traps a new save in a redirect-to-404 loop |
| `orders/actions.ts` `saveOrderSheet` | `if (!sheet || !sheet.active)` — rejects a direct write to a soft-deleted sheet id |

**db_TCL delivery:** `db/alter-ordersheet-add-active.sql` is the hand-authored, idempotency-guarded
(`IF NOT EXISTS ... sys.columns`) ALTER script for the shared live production DB — never executed by
any agent, delivery artifact only for the customer's DBA, exactly like `db/create-database-and-login.sql`
in Phase 06. **Deploy-ordering constraint: this ALTER must be applied to db_TCL BEFORE or
ATOMICALLY WITH deploying the app code** — every `OrderSheet` query in the app assumes the `active`
column exists; deploying code first breaks every one of the 7 sites above.

Known non-blocking gap: no `deletedBy`/`deletedAt` audit trail on this or any soft-deletable model —
see `process/features/order-system/backlog/soft-delete-audit-trail_NOTE_11-07-26.md`.

## Per-Location Shop Roster (added 13-07-26, `shop-location-roster` plan — ✅ VERIFIED AT CODE LEVEL)

`Shop.location` (nullable `NVARCHAR(200)`) replaces the old fixed `ROSTER_SLOTS = 29` roster with a
per-location, variable-row roster. The single source of truth is the pure helper
**`src/lib/roster.ts`** — `buildLocationRoster(activeShops, sheetLocation)` — imported by BOTH
`orders/[id]/page.tsx` (editor) and `src/lib/get-sheet-for-print.ts` (both print routes), replacing
the two former `ROSTER_SLOTS=29` hardcodes. Callers do exactly ONE query each
(`prisma.shop.findMany({ where: { active: true }, orderBy: { rosterOrder: "asc" } })`) and pass the
full result + `sheet.location` into the helper, which internally:

1. filters `activeShops` down to `sheetLocation`'s shops;
2. falls back to the FULL `activeShops` list when `sheetLocation` is null/empty OR the filter yields
   0 matches (backward-compat for legacy/no-match sheets — no code branch needed at call sites);
3. sorts by `rosterOrder asc` and assigns a NEW `displayNo` field, 1..N.

**`displayNo` vs. `rosterOrder` — never conflate these two fields:**

| Field | Scope | Used for |
|---|---|---|
| `rosterOrder` | Global, `@unique`, stable, immutable once referenced | `data-testid`, React `key`, the print `?slots=` filter (`selected.has(row.rosterOrder)`) — identity |
| `displayNo` | Per-location, recomputed at render time, 1..N | The VISIBLE row number only (matrix row-label, mobile `entryNo`, printed row `<td>`) |

`rosterOrder`'s global `@unique` constraint is UNCHANGED by this feature — no composite unique, no
schema break. `saveOrderSheet`/`buildOrderPayload` key writes by `shopId`+`variantId`, never by
`displayNo` — the renumbered display position never reaches the save payload.

**Seed backfill pattern:** `prisma/seed.ts` runs an idempotent
`updateMany({ where: { location: null }, data: { location: "ยิ่งเจริญ" } })` block (placed alongside
the existing product-rename backfill, before the `PRINT_VARIANTS` loop) — re-running it is a no-op
once every shop has a location. Any future "backfill a new nullable column" need should follow this
same `updateMany({ where: { field: null } })` idempotent-block pattern, not a one-off script.

**db_TCL delivery (`db/alter-shop-add-location.sql`, NEW):** hand-authored, idempotent
(`IF COL_LENGTH('dbo.Shop', 'location') IS NULL ... ADD`) delivery script for the shared production
ERP database — never executed by any agent, delivery artifact only for the customer's DBA, same
pattern as `db/alter-ordersheet-add-active.sql`. **Deploy-ordering:** (1) DBA runs the ALTER script
on `db_TCL` BEFORE or atomically with deploying the app code, (2) deploy app code, (3) run the
backfill (either `pnpm tsx prisma/seed.ts`, which is idempotent, or the narrower one-off
`UPDATE dbo.Shop SET location = N'ยิ่งเจริญ' WHERE location IS NULL;`). Between steps (1) and (3) the
app runs safely because `location` is null on every row → every query hits the documented fallback
path (full active-shop list) — there is no window where the app errors. As of this UPDATE PROCESS
session, this delivery script has **NOT yet been run against `db_TCL`** — it is a pending customer
deploy step (see Known Gaps below).

Sandbox migration note: `prisma/migrations/20260713000000_shop_location/migration.sql` is a
hand-authored `ALTER TABLE [dbo].[Shop] ADD [location] NVARCHAR(200)` (the sandbox `orderstock` DB
is an ERP-shaped clone with unrelated ERP tables like `krs_log`, so `prisma migrate dev`'s
shadow-diff is unusable there — see `tests/all-tests.md` Test Infra Gaps for the same finding);
applied via an idempotent `IF COL_LENGTH(...) IS NULL` sqlcmd ALTER + `prisma generate`, not
`migrate dev` directly. Any future schema change against THIS sandbox should use the same hand-SQL
+ `prisma generate` path rather than `migrate dev`.

## Managed Location List (added 15-07-26, `location-management` plan — ✅ VERIFIED AT CODE LEVEL)

The list of valid สถานที่ (location) values is stored as a single JSON array under ONE
`AppSetting` row (`key: "locations"`, existing `AppSetting.value @db.NVarChar(Max)` column) —
**ZERO schema change**, same "no new table on `db_TCL`" pattern as the establishment/display
settings (`app-settings.ts`, pguard-redesign Phase 02). `src/lib/locations.ts` owns the DB
read/write side: `getManagedLocations()` lazy-seeds the row on first read (queries `distinct`
active, non-null `Shop.location` values if the key is absent — idempotent, checked by row
EXISTENCE not array contents, so an empty-but-present `"[]"` never re-triggers seeding);
`setManagedLocations()` normalizes + upserts; `getEffectiveLocationOptions()` returns the managed
list unioned with any distinct active-shop `location` values not already in it (legacy stragglers,
appended `asc` after the managed list). `src/lib/locations-core.ts` holds the pure list transforms
(`normalizeLocations`/`addLocation`/`renameLocation`/`removeLocation` — case-sensitive exact match
only, matching `roster.ts`'s `s.location === loc` contract exactly).

**Rename cascade is atomic:** `renameLocationAction` wraps the managed-list update and the
`prisma.shop.updateMany({ where: { location: oldName }, data: { location: newName } })` cascade in
ONE `prisma.$transaction`, with a graceful error path — a page reload never shows a transient
mismatch between the list and `Shop.location` values. **Delete guard:** blocked (Thai error naming
the shop count) while any shop — active OR soft-deleted — still references the location; this was
tightened from an active-shops-only count during EVL adversarial review (a soft-deleted shop
retains its historical `location` value and re-referencing a deleted location name would
re-fragment the roster). This cross-references §Per-Location Shop Roster above — `roster.ts`'s
`buildLocationRoster` and its exact-match filter are completely untouched; this feature only
changes WHERE the `location` string values staff pick from come from.

Accepted known-gap: concurrent read-modify-write race on the single `AppSetting` "locations" row
(two staff editing locations simultaneously) — mirrors the already-accepted `OrderSheet`
date+location TOCTOU pattern (see Known Gaps below); low-probability, single-admin-typical usage.

## Known Gaps

- **Thai collation** — deferred past delivery; integer ordering (`printOrder`/`rosterOrder`)
  is used everywhere in Phase 1 instead of relying on collation-based sort.
- **Customer SQL Server compatibility level unconfirmed** — sandbox defaults to compat 150 (SQL
  Server 2019); the customer's actual target (140 for 2017 vs 150 for 2019) is unconfirmed and
  TODO-flagged in `db/create-database-and-login.sql`. Schema is written to stay compatible with the
  2017+ floor Prisma requires.
- **CRUD automated DB-integration harness** — backlogged
  (`process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md`); the Phase
  02 CRUD round-trip was proven via agent-probe, not an automated regression test. Phase 04's
  OrderSheet round-trip is now proven via Playwright (D1/D2 hybrid gates), partially closing this
  gap for order sheets specifically.
- **Total-weight validation** — backlogged
  (`process/features/order-system/backlog/weight-factors_NOTE_06-07-26.md`); `weightKg`/
  `pipConversion` are `null` on all seeded variants until the customer confirms conversion factors
  (Q22).
- **OrderSheet duplicate-sheet TOCTOU** — backlogged
  (`process/features/order-system/backlog/order-sheet-dup-index_NOTE_06-07-26.md`); accepted
  residual, no DB unique constraint on `(date, location)`.
- **`db/alter-shop-add-location.sql` not yet run against `db_TCL`** — pending customer/DBA deploy
  step (13-07-26); until it runs, `db_TCL`'s `Shop` table has no `location` column and the app must
  stay on the pre-deploy code, or every roster query hits the documented null-location fallback.
- **User confirmation of live per-location roster behavior on a real sheet** — the
  `shop-location-roster` plan's own Phase Completion Rules call for explicit user sign-off beyond
  the green Fully-Automated + Hybrid gates before calling the feature fully verified; pending-manual
  as of 13-07-26 archival (see the archived plan's Archival note). On-site >29-shop-location print
  fidelity is the same pre-existing agent-probe-only residual pattern as the rest of this project's
  print surface.
