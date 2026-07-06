---
name: context:all-database
description: "Database context entrypoint for orderstock — Prisma 7 + SQL Server schema, SQL Server-specific pitfalls (no enums, one-NULL-per-UNIQUE, NoAction cascades), historical-fidelity snapshot pattern, and seed/migration/export commands"
keywords: database, prisma, schema, sql server, mssql, migration, migrate, seed, enum, cascade, correction cascade, snapshot, printOrder, export, vendor sql, zod, tsx
related: [context:all-tests]
date: 06-07-26
---

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
- use `process/features/order-system/active/phase1-order-system_06-07-26/form-canonical_REF_06-07-26.md`
  for the 20-column printOrder contract's *source data* (the canonical form transcription); the
  in-code contract lives at `src/lib/product-order.ts` (`PRINT_VARIANTS`, C3–C22)
- use `process/features/order-system/active/phase1-order-system_06-07-26/phase-02-schema-master-data_PLAN_06-07-26.md`
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
| `Shop` | Customer shop (ร้านค้า) | `rosterOrder Int @unique` (append-only/immutable once referenced by any sheet), `active` soft-delete, `needsConfirmation` |
| `Product` | Base product | `group String` ("GOODS"/"SEASONING"), `isOffList`, `active` soft-delete |
| `ProductVariant` | Product × pack-size/flavor | `packSize String`, `printOrder Int?` (NOT `@unique`), `weightKg`/`pipConversion Decimal(10,3)?`, `name` (snapshot source) |
| `OrderSheet` | Daily order sheet | `date @db.Date` (CE; BE display is Phase 04+), `location` |
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

## Known Gaps

- **Thai collation** — deferred to Phase 06 delivery; integer ordering (`printOrder`/`rosterOrder`)
  is used everywhere in Phase 1 instead of relying on collation-based sort.
- **Customer SQL Server compatibility level unconfirmed** — sandbox defaults to compat 150 (SQL
  Server 2019); the customer's actual target (140 for 2017 vs 150 for 2019) is unconfirmed. Schema
  is written to stay compatible with the 2017+ floor Prisma requires.
- **CRUD automated DB-integration harness** — backlogged
  (`process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md`); the Phase
  02 CRUD round-trip was proven via agent-probe, not an automated regression test.
