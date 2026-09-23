---
name: context:all-database
description: "Database context entrypoint for orderstock — Prisma 7 + SQL Server schema, SQL Server-specific pitfalls (no enums, one-NULL-per-UNIQUE, NoAction cascades), historical-fidelity snapshot pattern, seed/migration/export commands, production-DB shared-ERP-database danger guardrails, and the live ERP schema manifest + conformance gates that keep dashboard SQL honest"
keywords: database, prisma, schema, sql server, mssql, migration, migrate, seed, enum, cascade, correction cascade, snapshot, printOrder, export, vendor sql, zod, tsx, dotenv-expand, resolveDatabaseUrl, connection string, db_TCL, production database, shared ERP, migrate reset, danger, guardrails, location, shop location, roster, buildLocationRoster, displayNo, rosterOrder, locations, managed location list, appsetting, location management, rename cascade, transaction, live manifest, live-manifest, sys.columns, schema conformance, schema drift, invalid column name, IsCancel, tinyint flag, erp-flags, erp-sql-columns, erp-query-columns, erp_fixture DDL, generated DDL
related: [context:all-tests]
date: 23-09-26
---

Last updated: 23-09-26 (live ERP schema manifest + conformance gates added — see
"## Live ERP Schema Manifest and Conformance Gates" at the bottom of this file. `db/erp-fixture/00-schema.sql`
is now GENERATED from `db/erp-schema/live-manifest_23-09-26.json` and holds ALL the DDL; the seed
files carry rows only. Prior: 15-07-26 (`location-management` plan ✅ VERIFIED AT CODE LEVEL — pending commit:
managed `/locations` list stored as ONE JSON `AppSetting` row (`key: "locations"`, ZERO schema
change), atomic rename cascade to `Shop.location`, delete guard extended to soft-deleted shops;
prior: `shop-location-roster` plan ✅ VERIFIED AT CODE LEVEL and archived: `Shop`
gains `location`, per-location roster via `src/lib/roster.ts` `buildLocationRoster`, new db_TCL
delivery ALTER script; prior: `ordersheet-soft-delete` plan VERIFIED — `OrderSheet` gains `active`
soft-delete column))

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
was bootstrapped via hand-authored SQL rather than a full linear migration history, so `prisma
migrate dev`'s shadow-diff is unusable there — see `tests/all-tests.md` Test Infra Gaps for the
same finding; **correction, 18-09-26 (erp-dashboards Phase 0):** earlier context wording described
this sandbox DB as "an ERP-shaped clone with unrelated ERP tables like `krs_log`" — that is
inaccurate; the `orderstock` sandbox DB has never contained ERP tables. A genuinely ERP-shaped
fixture database (`erp_fixture`), separate from this sandbox, is introduced in the
`erp-dashboards` program's Phase 1 — see that phase's report for the fixture-DB pattern);
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

---

## ERP Read Layer (erp-dashboards Phase 1)

Added 22-09-26 by `phase-01-erp-read-foundation`. This section documents the SECOND, strictly
read-only database connection the ERP dashboards use. It is independent of Prisma in every respect.

### Hard safety constraints (non-negotiable)

- The customer's ERP database `db_TCL` is **READ-ONLY to this application**. Only `SELECT`/`WITH`
  statements may ever be sent. No INSERT/UPDATE/DELETE/MERGE/TRUNCATE, no DDL, no `EXEC`, no
  stored-procedure call, no migration, no login/permission change from app code.
- **No ERP table is ever added to `prisma/schema.prisma`**, and **no ERP read ever goes through
  Prisma** (`prisma.$queryRaw` included) or the `orderstock_app` login. ERP reads use only the
  separate `mssql` pool below.
- ERP login provisioning is a DBA delivery step (`db/create-erp-readonly-login.sql`), never run by
  application code or by an agent.

### Files

| File | Role |
|---|---|
| `src/lib/erp/erp-adapter.ts` | The guard + `guardedQuery` single choke point, `ErpAdapter` marker type + compile-time no-write-method guard, `verifyReadOnlyBoot` permission probe |
| `src/lib/erp/pool.ts` | The separate `mssql.ConnectionPool` singleton (lazy, `globalThis`-cached), JDBC-URL to mssql-config parser, `shouldVerifyBootProbe` gating |
| `src/lib/erp/resolve-erp-database-url.ts` | Raw-read `ERP_DATABASE_URL` resolver (same `$`-in-password fix as `resolve-database-url.ts`) |
| `src/lib/erp/cache.ts` | 5-minute TTL cache with last-known-good fallback (`getCached`, `clearErpCache`) |
| `src/lib/erp/degrade.ts` | `erpDegradeState()` produces the "ข้อมูลอาจไม่ล่าสุด" banner decision |
| `src/components/dashboard-data-table.tsx` | THE shared dashboard table (URL-driven sort/paginate, mobile card list) — Phases 2/3/4 import it |
| `src/components/pilot-banner.tsx` / `degrade-banner.tsx` | Shared "ข้อมูลนำร่อง" / "ข้อมูลอาจไม่ล่าสุด" banners |
| `src/app/api/health/erp/route.ts` | ERP connectivity probe; **public by design** (see below); never returns 500 |

### 5-layer read-only enforcement (defense in depth — none is load-bearing alone)

1. **Normalizer** (`normalizeSqlForGuard`) — strips comments and masks string-literal and
   bracketed-identifier CONTENT, so neither keyword nor `;` scanning can be fooled by literal text,
   and a legitimate column like `[Update Date]` or `update_flag` does not false-positive.
2. **Denylist** (`assertReadOnlySql`) — single statement only, must start with `SELECT`/`WITH`, and
   must contain none of **19** forbidden keyword rules (INSERT, UPDATE, DELETE, MERGE, TRUNCATE,
   DROP, ALTER, CREATE, GRANT, REVOKE, EXEC/EXECUTE, sp_executesql, xp_cmdshell, BULK, OPENROWSET,
   INTO, BACKUP, RESTORE, SHUTDOWN). Ported from the sibling KRS TCL project's shipping guard.
3. **Parameterized requests only** — `guardedQuery` binds every value via `request.input(...)`;
   values are never concatenated into SQL. The guard runs BEFORE `pool.request()` is called, so a
   forbidden statement never reaches the connection at all (proven by test, not by convention).
4. **Boot permission probe** (`verifyReadOnlyBoot`) — runs `HAS_PERMS_BY_NAME(...)` and REFUSES to
   serve ERP reads if the connected login holds INSERT/UPDATE/DELETE/ALTER/CREATE TABLE. An
   inconclusive probe is also treated as unsafe. Never silently downgrades.
5. **`ApplicationIntent=ReadOnly`** — set via `options.readOnlyIntent` on the pool config. A no-op
   on a non-AlwaysOn server; additive hardening only.

Plus a **compile-time guard**: `ErpAdapter` fails typecheck if a write-shaped method name
(`insert`/`update`/`delete`/`write`/`save`/`upsert`/`merge`/`exec`/`execute`) is ever added.

### Env vars

- `ERP_DATABASE_URL` — JDBC-style, resolved by raw file read (dotenv-expand bypass, same `$`-in-
  password gotcha as `DATABASE_URL`). Dev points at the LOCAL sandbox `erp_fixture` database;
  production at `db_TCL` with the DBA-provisioned scoped read-only login (never `sa`, never
  `orderstock_app`). Placeholder documented in the committed env template only, never a real value.
- `ERP_VERIFY_BOOT_PROBE=1` — optional; forces layer 4 to run outside production. Left UNSET
  locally because the sandbox `sa` login legitimately has write permission and the probe would
  (correctly) refuse to start. Layer 4 always runs in production regardless of this flag.

The pool is built **lazily on first ERP read**, never at module load — a missing `ERP_DATABASE_URL`
must never crash non-ERP pages.

### Accepted known-gap — `ERP_ALLOW_WRITE_CAPABLE_LOGIN` (charter exception, 22-09-26)

- **Who approved:** the repo owner (user), in-session, 22-09-26 — an explicit decision to proceed
  on the existing write-capable login rather than wait for the DBA-provisioned scoped read-only
  login. The standing rule "ดึงมาเท่านั้น ห้ามเขียนกลับ" (read only, never write back) is unchanged.
- **What it is:** `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` (the exact string `"1"` only) makes layer 4 warn
  instead of throw when the probe finds write permissions. Absent, empty, `"0"`, `"true"` — any
  other value — keeps today's fail-closed refusal in EVERY environment, production included. The
  probe STILL RUNS and still reports what it found; with the switch on it logs exactly ONE
  credential-free warning per pool creation (never per query) naming the granted permissions and
  pointing at `db/create-erp-readonly-login.sql`. `/api/health/erp` surfaces the same state as
  `readOnlyLogin: false` / `loginCheck: "write-capable"` + a short `warning`, so ops can see it
  without reading logs.
- **What it costs:** the DATABASE-LEVEL enforcement layer (a login that physically cannot write) is
  gone while the switch is on. Layers 1, 2, 3 and 5 — normalizer, SELECT-only denylist, single
  `guardedQuery` choke point with parameterized requests, no-write-method compile guard,
  `ApplicationIntent=ReadOnly` — are UNCHANGED and become the only protection. A real, named
  reduction in defense-in-depth, not a cosmetic one.
- **Exit condition (hard Phase 5 rollout gate):** production go-live requires EITHER the scoped
  read-only login provisioned and in use, OR a dated, named re-confirmation of this exception.
  "The switch works" is never sufficient for production sign-off.
- **Code:** `allowsWriteCapableLogin` / `runBootProbeWithOptIn` / `erpReadOnlyLoginState` in
  `src/lib/erp/pool.ts`; proven by `src/lib/__tests__/erp-pool-write-capable-switch.test.ts`
  (fail-closed by default, warn-once + `loginCheck:"write-capable"`, silent +
  `loginCheck:"read-only"` on a read-only login, and a negative assertion that the warning leaks no
  credential).
- **Three-state login check (fixed 2026-09-23):** the probe state is `readOnlyLogin: boolean | null`
  plus `loginCheck: "not-probed" | "read-only" | "write-capable"`. The initial/reset state is
  `not-probed`, NOT "read-only" — an unprobed login is UNKNOWN, and reporting the safe answer for an
  unknown truth is the wrong direction for a security signal. `/api/health/erp` now awaits
  `getErpPool()` (where the probe runs) BEFORE reading the state; previously it read first, so the
  FIRST request after a container start reported `readOnlyLogin: true` on a write-capable login and
  only the second request told the truth. Regression gate:
  `src/lib/__tests__/erp-health-login-state.test.ts`.

### `erp_fixture` — the local ERP-shaped fixture database

`db/erp-fixture/00-schema.sql` + `01-seed.sql` create the `erp_fixture` database. **As of
23-09-26 the DDL split changed:** `00-schema.sql` now holds the `CREATE TABLE` for ALL 11 ERP tables,
each one GENERATED from `db/erp-schema/live-manifest_23-09-26.json` (same columns, same order, same
types, same nullability as the live server), and every seed file carries ROWS ONLY — no DDL at all.
Previously each domain seed created its own tables from a prose data dictionary, which is what let
the fixture drift into a shape production does not have (see "## Live ERP Schema Manifest and
Conformance Gates" below). `01-seed.sql` seeds `dbo.InventoryItem` with 10 rows (mixed `ItemGRP`,
several units, one NULL `MainUnits` row on purpose). Both scripts are
**LOCAL SANDBOX ONLY** — they run against the `orderstock-sql` container and must NEVER be run
against `db_TCL`. They live outside `prisma/migrations` on purpose: `erp_fixture` is a separate
database from the Prisma-managed `orderstock` sandbox DB, and SQL Server hosts both in the same
instance with no `docker-compose.yml` change (confirmed 22-09-26).

Apply with (container running):

```bash
docker cp db/erp-fixture/00-schema.sql orderstock-sql:/tmp/ && \
docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
  -P "$MSSQL_SA_PASSWORD" -C -i /tmp/00-schema.sql'
# then repeat for 01-seed.sql
```

Both are idempotent (re-running the seed affects 0 rows and leaves the count at 10). Drop and
recreate freely — local only.

**Forward note for Phases 2/3/4:** in the REAL ERP, `InventoryItem`'s primary key is composite
(`Roworder`, `ItemCode`) — `ItemCode` alone is NOT unique. Confirm the `Roworder` tie-break rule
before writing domain queries. Per-domain fixture tables go in each phase's own seed file; Phase 1
owns only the shared/base file.

### `/api/health/erp` is intentionally public

Like the existing `/api/health`, it applies no auth guard. It is an operator/uptime probe returning
only `{ ok, latencyMs, stale, rows }` or `{ ok: false, error: "ERP connection failed" }` — no ERP
business data, no money field, no connection detail (the real error is logged server-side only). It
always returns HTTP 200, never 500, matching the degrade contract. `auth-guard-coverage.test.ts`
records this exemption explicitly rather than omitting the route silently; a future ERP route that
returns business data MUST be auth-guarded and gets its own coverage entry.

### Known gaps (as of 22-09-26)

- **Live boot-probe against the real `db_TCL` scoped read-only login** — the DBA-provisioned login
  does not exist yet (`db/create-erp-readonly-login.sql` is written and NOT run). Deferred to
  Phase 5. Phase 1 proved the refusal logic both by mocked unit tests AND live against a real
  write-capable connection (the sandbox `sa` login with `ERP_VERIFY_BOOT_PROBE=1`): the probe
  refused, naming INSERT/UPDATE/DELETE/ALTER/CREATE TABLE, and the route degraded to
  `{ ok: false }` at HTTP 200. What remains unproven is only the positive case — that the real
  scoped login returns all-zero write permissions.
- **Denylist residual risk** — any denylist can in principle miss a novel bypass shape. Mitigated,
  not eliminated, by layers 1, 3, 4, and 5.
- TLS / connection-string edge cases against the customer's actual SQL Server version are untested
  (no customer-representative server available in dev).

### Sales dashboard query contract (erp-dashboards Phase 2)

Added 22-09-26 by `phase-02-sales-dashboard`. Establishes the pattern every later domain dashboard
(Purchase, Production) should follow when adding its own `db/erp-queries/{domain}/*.sql` set.

- **Basis**: `tbl_DOhdr`/`tbl_Dodtl` (delivery orders), selected via an `AppSetting`-backed
  `resolveSalesBasis()` switch (Sales-only key, additive — does not change any existing
  `AppSetting` meaning). Only the `"do"` branch is implemented; `"so"`/`"invoice"` are recorded as
  `it.todo` extension points, explicitly out of SPEC scope.
- **Query files**: `db/erp-queries/sales/{do-headers,do-lines,do-by-product,do-by-customer,
  sales-invoice-excluded-total}.sql` — each a single `WITH … SELECT` statement. Optional filters
  use `(@p IS NULL OR col = @p)` so ONE static statement serves every filter combination; no string
  concatenation anywhere (enforced by a unit sweep, not just convention).
- **Runtime embedding gotcha**: `next.config.ts` sets `output: "standalone"`, and neither the
  standalone bundle nor the production `Dockerfile`'s COPY list includes `db/`. Reading the `.sql`
  files from disk at runtime (`readFileSync`) would work in dev/`pnpm start` and then fail **only
  inside the production container** — a break no other gate in this repo would catch. The fix:
  the SQL is embedded as string constants (`src/lib/sales-sql.ts`), with a Fully-Automated unit
  test asserting each constant is **byte-identical** to its source `.sql` file (plus
  single-statement / read-only-keyword / no-concatenation sweeps), so the two cannot silently
  diverge. **Any future domain adding its own `db/erp-queries/{domain}/*.sql` should follow this
  same embed-plus-byte-identity-gate pattern**, not read from disk at runtime.
- **`InventoryItem` tie-break applied**: every query joining a transactional table to
  `InventoryItem` by `ItemCode` uses `ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder
  DESC)` and takes the highest-`Roworder` row (see the Cross-Phase Precondition in the program's
  blast-radius registry). Proven so far only by a SQL-pattern grep — proving it against a REAL
  duplicate `ItemCode` row needs a fixture change Phase 2 may not make unilaterally (it would edit
  Phase 1's shared base fixture file); routed as a PLAN-SUPPLEMENT to Phase 1.
- **Money-gate contract**: money figures are ALWAYS accompanied by a coverage % and a reconciliation
  footnote naming the excluded total, never presented as if they were the whole picture. This
  reconciliation-footnote pattern (not just role-based hiding) is the durable convention for any
  ERP-sourced money figure that only covers a subset of underlying documents.
- **Quantity aggregation**: quantities are summed strictly PER `MainUnits` value, never across
  different units — the same rule Phase 1 established structurally now has a proven Phase-2 example
  (`sumQuantityByUnit()`).

### Purchase dashboard query contract (erp-dashboards Phase 3)

Added 22-09-26 by `phase-03-purchase-dashboard`. Follows Phase 2's embed-plus-byte-identity-gate
pattern exactly, with its own domain twist:

- **Dual basis, both fully counted**: `total-invoice-basis.sql` (`PurchaseInvoiceHdr`/`Dtl`) and
  `total-po-committed-basis.sql` (`PurchaseOrderHdr`/`Dtl`) are two DIFFERENT, non-overlapping ways
  of asking "how much have we bought" — unlike Sales's single-total-plus-coverage-footnote pattern,
  neither Purchase basis excludes real data, so both render as equal-weight KPI tiles rather than
  one "primary" and one "footnoted secondary."
- **`total-invoice-basis.sql` returns ROWS, not a bare `SUM`** — the KPI tile, the period chart, and
  the supplier donut all need the SAME filtered invoice set at three different groupings, so
  aggregating once in TS (not three separately-parameterized SQL sums) keeps all three figures
  arithmetically identical by construction.
- **`po-received.sql` mirrors the ERP's own `sp_Popending` report literally** — bare `h.IsClosed <>
  1` with NO `ISNULL(...)` wrapper, matching the stored procedure's actual source verbatim (quoted
  in `erp-master-data_REF_18-09-26.md`). An `IsClosed IS NULL` row is therefore silently EXCLUDED
  from `received_qty` — this is real ERP report behavior, not a bug to "fix." `derivePoStatus()`
  (the pure TS status function, NOT this SQL file) is the one place that DOES use
  `ISNULL(IsClosed,0)=1` semantics — the two functions deliberately disagree on NULL handling
  because they answer different questions (this SQL: "is this receipt excluded from ค้างรับ";
  `derivePoStatus`: "is this PO Closed").
- **`po-lines.sql`/`po-received.sql` take OPTIONAL id parameters** so the PO list page can aggregate
  รับแล้ว/ค้างรับ per PO in ONE round trip instead of N+1 queries — the same static statement serves
  both the list page and the detail page.
- **Outstanding quantity is never clamped** — `computeOutstanding()` returns the raw
  `ordered - received` value even when negative (an over-receipt is real data worth surfacing, not
  a bug to floor at 0); the UI renders a distinct warning tone for a negative value instead of
  hiding it.
- **`derivePoStatus()` is an UNVALIDATED field-precedence guess** (7-branch CASE: cancel → closed →
  completed → received → checked → approved → pending) — every render site pairs the status chip
  with a separate "ยังไม่ผ่านการยืนยัน" caveat chip (see `uxui/all-uxui.md`'s Unvalidated-derivation
  caveat badge pattern). Do not upgrade this confidence without new evidence from real db_TCL data.
- **Shared-fixture-table collision with Phase 4 (resolved additively)**: `InventoryFlowHdr`/
  `InventoryFlowDtl` are used by both Purchase (`po-received.sql`) and Production
  (`material-issues.sql`). Phase 4's seed had already created these tables with a narrower,
  differently-named shape (`DocuNo`/`TransactionDate`/`Qty`) before Phase 3's seed ran; Phase 3's
  seed resolves this via `IF OBJECT_ID(...) IS NULL CREATE TABLE` (create-if-absent) plus
  `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD` (add-missing-column) so BOTH domains' expected
  column spellings coexist on the same fixture tables, and reserves its own rows in a
  `TransactionNo` 7700-block (Phase 4 uses the 9000-block) so neither domain's rows collide. **The
  fixture therefore carries both column spellings, which the live ERP does not.**
  **Resolved by Phase 5 (22-09-26): the union is PERMANENT, not provisional.** Both column families
  are genuinely live in `db_TCL` and both back a shipped query —
  `VoucherNo`/`InOutDate`/`MainQuantity`/`Approved` by `db/erp-queries/purchase/po-received.sql`
  (mirrors the ERP's own `sp_Popending`) and `DocuNo`/`TransactionDate`/`Qty`/`MONo` by
  `db/erp-queries/production/material-issues.sql`. Dropping either spelling would break a shipped
  query, so "converge on one spelling" was the wrong framing — `production-seed.sql` gained the
  same symmetric `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD` guards `purchase-seed.sql`
  already had, proven order-independent by
  `src/lib/__tests__/erp-fixture-seed-idempotency.test.ts` (both run orders, twice each).
- Money-gate contract: identical mechanism to Sales (`canSeeMoney` computed once server-side,
  markup conditionally omitted, never CSS-hidden) — see `uxui/all-uxui.md`.

### Production dashboard query contract (erp-dashboards Phase 4)

Added 22-09-26 by `phase-04-production-dashboard`. No money data in scope at all (see
`uxui/all-uxui.md`'s No-money-dashboards pattern) — this domain's contract is entirely about
honest absence-of-data, not money gating.

- **`mo-list.sql`**: single `SELECT` over `tbl_MoHdr` (+ optional `tbl_BatchOrder` join for
  `IsCheck`/`IsRecPo` flags per the data dictionary), the same `InventoryItem` highest-`Roworder`
  tie-break join Phase 2 established, date/status filters via `(@p IS NULL OR col = @p)`, and an
  issue-line-count sub-select (feeds the "MOs with material issues" KPI). `PlannedQty` is
  `COALESCE(m.LotQty, m.Prodqty, 0)` — **this column name is a coincidence, not a signal**: it is
  never surfaced as an "actual produced" figure anywhere (see AC7 honesty guarantees below).
- **`material-issues.sql`**: reads the line-item unit from `InventoryItem.MainUnits`, NOT a
  per-line `InventoryFlowDtl.Unit` column — the real-data extract hints at a detail-level unit
  column existing, but no reference document confirms it in `db_TCL`; querying an unverified
  column risks a live break, so the plan's own (verified) SQL shape was followed instead.
- **AC7 "no achievement %" is enforced at FOUR independent levels**, not just "the SQL doesn't
  return it" — see `uxui/all-uxui.md`'s Plan-only honesty pattern for the full structural /
  data-shape / module-surface / rendered-page breakdown. `mo-list.sql` never returns any field
  matching `/actual|percent|pct|achiev/`, enforced by a unit gate reading the raw query text.
  **There is no "received into stock" ledger signal anywhere in the ERP for a completed MO** (the
  data dictionary confirms 0 of 218 `InventoryFlowHdr` rows qualify as an FG-from-production
  receipt) — this is a real absence, not a query gap.
- **No locking hint** (`WITH (NOLOCK)` or similar) is added on any query in this domain — matches
  Phase 2's own delivered, VERIFIED SQL, which likewise carries no locking hint; `guardedQuery`'s
  read-only enforcement, not a locking hint, is the actual security/correctness boundary (a plan
  claim about an "RCSI-off convention" was found inaccurate and corrected during this phase's inner
  PVL — no such convention exists anywhere in the umbrella plan's text).
- **Shared-fixture-table collision with Phase 3**: see Phase 3's entry above — resolved on Phase
  3's side, additively, with Phase 4's original rows (`TransactionNo` 9000-block) untouched.

### Hardening, export & the manual live-reconcile script (erp-dashboards Phase 5 — PROGRAM FINAL)

Added 22-09-26 by `phase-05-hardening-export-rollout`. This is the program's LAST database-adjacent
work — the `erp-dashboards` program is now **PROGRAM COMPLETE**, all 6 phases ✅ VERIFIED at agent
level.

- **CSV export reuses the exact same query/fetch path as the screen it exports** — the export route
  (`src/app/api/dashboards/export/route.ts` + `export-datasets.ts`) calls the SAME data function
  each dashboard page calls, so an export can never disagree with the screen it came from, and every
  read still passes through `guardedQuery` by construction. There is no second query path for
  exports — do not add one for any future export target.
- **`src/lib/erp/live-reconcile-script.ts`** (+ thin `scripts/erp-reconcile.ts` entrypoint) is the
  USER-RUN manual reconciliation tool against real `db_TCL`. It deliberately does NOT use
  `resolveErpDatabaseUrl()` — it takes `ERP_DATABASE_URL` and `ERP_RECONCILE_CONFIRM=1` as required,
  explicit inputs so nobody can accidentally run it against a database they did not name on the
  command line. Every statement goes through `guardedQuery` (so `EXEC` — needed to invoke
  `sp_PurchaseInvoiceMonth`/`sp_Popending` directly — is denylisted; the script reproduces their SQL
  rule in `SELECT` form instead and prints a diff against `--expect-*` flags the operator reads off
  the ERP's own report). **This script has been run against `erp_fixture` only, never `db_TCL`.**
  It reproduced every known fixture truth exactly (14 DOs, 10,111 priced amount, 858,937.21 excluded
  pool, 461,140 invoice basis, 727,920 PO committed, 11 MOs).
- **`ERP_ALLOW_WRITE_CAPABLE_LOGIN` exit condition (unchanged, now the program's single remaining
  production blocker):** the temporary opt-in documented above under "Accepted known-gap" remains
  exactly as specified — it is safe ONLY because the local sandbox `sa` login is the only login ever
  used with it. Go-live requires: (1) the DBA runs `db/create-erp-readonly-login.sql` on `db_TCL`,
  (2) `ERP_DATABASE_URL` on the production host repoints to that scoped login, (3)
  `ERP_ALLOW_WRITE_CAPABLE_LOGIN` is REMOVED from the production `.env` entirely, (4) restart, (5)
  confirm `/api/health/erp` reports `loginCheck: "read-only"`. Procedure documented in
  `docs/deployment-guide-docker.md` §12.3. **`ERP_TEST_FORCE_DOWN` must also never be set on a
  production host** — it is test-only (see `tests/all-tests.md`).
- **Fixture seed order-independence — see the Phase 3/4 union note above.** Phase 5's own
  `src/lib/__tests__/erp-fixture-seed-idempotency.test.ts` is the permanent regression gate for this
  contract; any future edit to `purchase-seed.sql` or `production-seed.sql` must keep both run
  orders green.
- **Money-gate contract, program-final statement:** across all three dashboards, `canSeeMoney` is
  computed server-side ONLY, in exactly the pattern Sales established (Phase 2) — proven at 3
  independent levels by Phase 5's cross-dashboard audit (98 tests): static source sweep (no
  CSS-hiding, no client-derivable flag), a role-diffed byte comparison of the real CSV export
  output, and a rendered-HTML STAFF/ADMIN check across every dashboard + drilldown. Production
  correctly has NO `canSeeMoney` gate at all (no money data in scope, by design — not a gap).

---

## Live ERP Schema Manifest and Conformance Gates (added 23-09-26)

**Read this before writing or editing ANY ERP query.** It exists because of a production outage.

### The defect

On 23-09-26 every ERP dashboard page rendered "ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้" against the live
`db_TCL`, while `/api/health/erp` reported healthy and the whole local suite was green. The queries
referenced columns that DO NOT EXIST in production, so SQL Server rejected them outright:

| Referenced | Reality on `db_TCL` |
|---|---|
| `dbo.tbl_DOhdr.IsCancel` | **no such column.** The real flags are `IsApproved`, `IsClosed`, `IsComplete`, `IsCheck`, `IsAcc` (each with a paired `*By`/`*Date`) plus `Revised`. None of them means "cancelled" — `Revised` is 0 on all 83 live headers, so the cancelled branch was DROPPED rather than re-pointed at a guess. |
| `dbo.InventoryFlowDtl.Qty` | the quantity column is `MainQuantity` |
| `dbo.InventoryFlowHdr.TransactionDate` | the flow date is `InOutDate` (when stock moved), not `EntryDate` (when it was typed) |
| `dbo.tbl_Dodtl.MainUnits` | the line table's unit column is `Units`; its item code is `Itemcode` (lowercase `c`) |
| flag columns assumed to be `BIT` | **every ERP flag is `TINYINT`**, so the `mssql` driver returns a NUMBER — see the TINYINT trap below |

### Root cause (the important part)

The local `erp_fixture` sandbox was hand-built from a PROSE data dictionary, not from the live column
list. It therefore contained the same invented columns and the same wrong types. Query and fixture
agreed with each other and both disagreed with production. **Comparing code against a fixture can
never reveal that the fixture itself is the fiction.** Every future ERP schema decision must be
grounded in a capture from the live server, never in a document describing it.

### The anchor: `db/erp-schema/live-manifest_23-09-26.json`

A metadata-only capture read from `sys.columns` + `sys.types` on the live `db_TCL` — 809 columns
across the 11 tables the dashboards touch. Each entry is `{name, type, nullable}`.

- **No row data, no counts, no customer-identifying content** was read or stored. The capture queries
  hit only system catalog views, never a business table, through the read-only probe.
- Not a full DDL dump — no keys, indexes, defaults, or foreign keys. Capture those the same way
  (system catalog views, metadata only) if ever needed rather than widening this file's scope.
- `db/erp-schema/README.md` holds the exact refresh queries and the guardrails.
- **Refreshing:** write a NEW dated file (`live-manifest_<dd-mm-yy>.json`), never overwrite, so drift
  stays visible in git history. Then REGENERATE the `CREATE TABLE` blocks in
  `db/erp-fixture/00-schema.sql` from it instead of hand-editing them, and re-run both gates.

### The gates (all DB-free; see `tests/all-tests.md` for the full mechanism)

| Gate | Holds |
|---|---|
| `src/lib/__tests__/erp-fixture-schema-conformance.test.ts` (16 tests) | `00-schema.sql` matches the manifest column-for-column; no seed file contains `CREATE TABLE`/`ALTER TABLE` |
| `src/lib/__tests__/erp-query-schema-conformance.test.ts` (106 tests) | every column every `db/erp-queries/**/*.sql` reads exists live; each query's declared contract in `src/lib/erp-query-columns.ts` can neither invent, omit, nor pad |
| `src/lib/__tests__/erp-flags.test.ts` (13 tests) | TINYINT `1`/`0` derive PO and MO status correctly |

A fixture may hold FEWER ROWS than production. It may not hold a DIFFERENT SHAPE.

### The TINYINT flag trap

Not one flag column in this ERP is a SQL `BIT`. `IsCancel`, `IsClosed`, `IsApproved`, `IsCheck`,
`IsComplete`, `IsRecPo`, `Approved` — all `TINYINT`. The `mssql` driver maps TINYINT to a JavaScript
**number**, so `header.IsRecPo === true` is silently false for every live row, with no error
anywhere. The purchase dashboard did exactly that: no PO could derive Received, Closed, Completed,
Checked or Cancelled. It passed locally only because the old fixture declared those columns `BIT`.

**Rule:** read every ERP flag through `erpFlag()` / `erpFlagOrNull()` in `src/lib/erp-flags.ts`.
`erpFlag` implements `ISNULL(flag,0) = 1` (matching the SQL comparison, so a stray TINYINT 2 is not
promoted); `erpFlagOrNull` preserves NULL for `PurchaseOrderHdr.IsClosed`, where NULL means OPEN and
must fall through rather than short-circuit to "Closed". Never compare a flag with `=== true`.

### Known gap

The manifest is a point-in-time snapshot. If the customer's vendor alters `db_TCL`, the gates keep
passing against the stale capture — there is no automated drift alarm, and adding one would mean
querying the live production server on a schedule, which the charter forbids. Re-capturing is a
deliberate, USER-RUN action.
