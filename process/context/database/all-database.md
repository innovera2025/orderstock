---
name: context:all-database
description: "Database context entrypoint for orderstock — Prisma 7 + SQL Server schema, SQL Server-specific pitfalls (no enums, one-NULL-per-UNIQUE, NoAction cascades), historical-fidelity snapshot pattern, and seed/migration/export commands"
keywords: database, prisma, schema, sql server, mssql, migration, migrate, seed, enum, cascade, correction cascade, snapshot, printOrder, export, vendor sql, zod, tsx
related: [context:all-tests]
date: 06-07-26
---

Last updated: 06-07-26 (Phase 04 closeout — order-entry write-path pattern added)

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

## Known Gaps

- **Thai collation** — deferred to Phase 06 delivery; integer ordering (`printOrder`/`rosterOrder`)
  is used everywhere in Phase 1 instead of relying on collation-based sort.
- **Customer SQL Server compatibility level unconfirmed** — sandbox defaults to compat 150 (SQL
  Server 2019); the customer's actual target (140 for 2017 vs 150 for 2019) is unconfirmed. Schema
  is written to stay compatible with the 2017+ floor Prisma requires.
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
