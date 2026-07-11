---
name: note:soft-delete-audit-trail
description: "Backlog (cross-cutting, low priority) — no deletedBy/deletedAt audit-trail columns on any soft-deletable model (Shop, Product, User, now OrderSheet); who-deleted-what-when is unreconstructable from the app"
date: 11-07-26
metadata:
  node_type: memory
  type: note
  feature: order-system
  phase: ordersheet-soft-delete
---

# Soft-Delete Audit Trail (cross-cutting)

## Priority

Low — accepted residual, consistent across every soft-deletable model today.

## Problem

None of the app's soft-deletable models (`Shop`, `Product`, `User`, and now `OrderSheet` as of the
`ordersheet-soft-delete_11-07-26` plan) record who performed the soft-delete or when. `active =
false` is set, but "who deleted this and when" cannot be reconstructed from the app — only a raw DB
timestamp comparison (`updatedAt`) gives an approximate "when," and never a "who."

## Root Cause

Each soft-delete feature (Shop/Product/User in earlier phases, OrderSheet in this plan) followed the
established `active: Boolean @default(true)` pattern without adding audit columns, since none of the
prior features needed it and adding one per-feature would create inconsistent schemas. This is not a
new regression introduced by the OrderSheet soft-delete plan — it inherits an existing, consistent
gap across all four models.

## Fix Options

1. **(Preferred if ever prioritized) Cross-cutting migration** — add `deletedBy String? @db.NVarChar(100)`
   (or a `User` FK) + `deletedAt DateTime?` to all four models (`Shop`, `Product`, `User`,
   `OrderSheet`) in one migration, not incrementally per-model, to avoid schema drift between them.
2. Update each soft-delete server action (`softDeleteOrderSheet` and the equivalent
   Shop/Product/User actions) to set both new fields alongside `active = false`.
3. Regenerate the vendor SQL export (`pnpm tsx scripts/export-schema-sql.ts`) and the db_TCL delivery
   ALTER script after, following the same split-delivery pattern established by
   `db/alter-ordersheet-add-active.sql`.

## Notes

- No functional bug — this is a proactive hardening item, not a correctness gap.
- Raised during the `ordersheet-soft-delete_11-07-26` plan's VALIDATE pass (Layer 1 Security surface
  dimension) as a documented, non-blocking Open Gap — explicitly NOT counted as a new regression
  since it matches the pre-existing pattern verbatim.
- If ever prioritized, scope it to ALL four models at once rather than adding audit columns
  piecemeal per future soft-delete feature.
