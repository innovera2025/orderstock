---
name: note:order-sheet-dup-index
description: "Backlog (optional hardening) — filtered unique index on OrderSheet(date, location) to close the app-level duplicate-check TOCTOU race; regenerate the vendor SQL export after"
date: 06-07-26
metadata:
  node_type: memory
  type: note
  feature: order-system
  phase: phase-04
---

# OrderSheet Duplicate-Prevention Hardening (TOCTOU)

## Priority

Low — accepted residual, LAN-internal low-concurrency app. Not required before Phase 05 or Phase 06.

## Problem

`OrderSheet` has no DB-level unique constraint on `(date, location)`. Phase 04's
`createOrderSheet` server action does an app-level check-then-create inside a single `$transaction`
(read committed isolation), which is safe against normal sequential usage but not against two truly
concurrent saves: both requests can pass the existence check before either commits, producing two
`OrderSheet` rows for the same date+location.

## Root Cause

Decision 3 (Phase 04 INNOVATE) deliberately chose app-level check-then-create with NO schema
migration, to avoid schema churn mid-program. This was an accepted trade-off, not an oversight — the
LAN-internal usage pattern (a handful of staff, unlikely simultaneous saves for the same date+branch)
makes the residual low-risk.

## Fix Options

1. **(Preferred, deferred) Filtered unique index** — add a raw SQL Server filtered unique index on
   `OrderSheet(date, location)` (e.g. `WHERE location IS NOT NULL` plus a separate handling for NULL
   location, since SQL Server allows only one NULL per plain unique index — see the "one NULL per
   UNIQUE" pitfall in `database/all-database.md`). This must be added via a raw migration
   (`prisma migrate dev --create-only` + hand-edited SQL), not a plain Prisma `@@unique`, because of
   the nullable `location` column.
2. Regenerate the vendor SQL export (`pnpm tsx scripts/export-schema-sql.ts`) after adding the index,
   since `db/create-orderstock-schema.sql` is the delivery artifact handed to the customer's DBA.
3. Add a Vitest/Playwright regression asserting a second concurrent `createOrderSheet` call for the
   same date+location is rejected (constraint violation) rather than silently creating a duplicate.
4. Alternative (no schema change): move the existence check to `SERIALIZABLE` isolation for that one
   transaction — reduces but does not eliminate the race, and has a performance cost. Lower
   confidence than option 1.

## Notes

- No functional bug has been observed in practice — this is a proactive hardening item.
- Coordinate with Phase 06 (DB Settings & Delivery) since `db/create-orderstock-schema.sql` is
  regenerated there for the delivery package — the filtered index should land before that
  regeneration if implemented.
- Raised during Phase 04 PVL as an accepted known-gap residual (gap-resolution D).
