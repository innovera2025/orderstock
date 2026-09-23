# ERP Live Schema Manifest

## What this is

`live-manifest_23-09-26.json` is a **machine-readable capture of the actual columns** that exist,
today, on the live customer ERP database (`db_TCL`), for every `dbo.*` table our dashboard SQL
references. It was captured directly from `sys.columns` + `sys.types` on the live server via the
read-only ERP probe — not transcribed from a data dictionary, a customer-supplied document, or
any prose description.

**Why it exists:** the local `erp_fixture` sandbox database (`db/erp-fixture/*.sql`) was built by
hand from a prose data dictionary, not from the live column list. That let every dashboard query
pass its own test suite against a schema that does not match production — for example the sandbox
never modeled `tbl_DOhdr` at all in `00-schema.sql` (`tbl_DOhdr`/`tbl_Dodtl` are defined in
`sales-seed.sql` instead, independently re-typed from the dictionary), and our sales-status SQL
referenced a `dbo.tbl_DOhdr.IsCancel` column that does not exist on the live table — the real flags
are `IsApproved`, `IsClosed`, `IsComplete`, `IsCheck`, `IsAcc` (each with a paired `*By`/`*Date`
column). This file is the fix for that class of defect: a single source of live truth, kept next to
the code instead of trusted-by-assumption.

## What it is NOT

- **Metadata only.** Every entry is `{name, type, nullable}` — column name, SQL type (with
  length/precision/scale folded in, e.g. `nvarchar(40)`, `numeric(18,2)`), and nullability.
- **No row data, no counts, no customer-identifying content of any kind** was read or stored. The
  capture queries hit only `sys.columns`/`sys.types` (SQL Server system catalog views) — never a
  business table — and the read-only probe scanner also outright forbids querying any column named
  like a password.
- Not a full DDL/constraints dump — no primary keys, indexes, defaults, or foreign keys. If those
  are ever needed, capture them the same way (system catalog views, metadata only) rather than
  widening this file's scope.

## Tables covered

Every `dbo.<table>` referenced by `db/erp-queries/**/*.sql` or `src/lib/{sales,purchase,production}-sql.ts`:

| Table | Columns | Referenced by domain |
|---|---|---|
| `dbo.tbl_DOhdr` | 51 | sales |
| `dbo.tbl_Dodtl` | 25 | sales |
| `dbo.SalesInvoiceHdr` | 151 | sales |
| `dbo.SalesInvoiceDtl` | 58 | sales (invoice-basis lines — see `partialCaptureNotes`) |
| `dbo.InventoryItem` | 102 | sales, production |
| `dbo.PurchaseOrderHdr` | 122 | purchase |
| `dbo.PurchaseOrderDtl` | 49 | purchase |
| `dbo.PurchaseInvoiceHdr` | 101 | purchase |
| `dbo.InventoryFlowHdr` | 75 | purchase, production |
| `dbo.InventoryFlowDtl` | 71 | purchase, production |
| `dbo.tbl_MoHdr` | 36 | production |
| `dbo.tbl_BatchOrder` | 26 | production (fixture-seeded; no shipped query reads it yet) |
| `dbo.tbl_ItemGroup` | 12 | sales (category labels: `ICCode` -> `Description`) |

879 columns total across 13 tables.

`dbo.tbl_BatchOrder` was captured on the same date, by the same `sys.columns` query, when the
fixture rebuild found it seeded locally but absent from this manifest. No shipped dashboard query
reads it today; it is covered here so the fixture's copy cannot drift unnoticed the way the others did.

`dbo.tbl_ItemGroup` was captured on 23-09-26 the same way, when the Sales category pie was changed
to read its labels from the ERP instead of an app-side hardcode (the hardcode only knew F/R/P, so
the live code `W` reached the customer as the raw fallback "หมวด W").

`dbo.SalesInvoiceDtl` was added on 23-09-26 by the `sales-invoice-basis` plan, when the Sales
dashboard's primary money figure moved from the delivery-order basis to the invoice basis. It is
the ONE PARTIAL entry in this file: its column NAMES and ORDER come from a verified live
`sys.columns` read, but its TYPES and NULLABILITY were not captured in that read and are inferred
from the same-named columns on sibling live tables. The top-level `partialCaptureNotes` key in the
manifest records this. The column-name guarantee is intact; re-capture the types on the next live
probe and drop the note.

## How to refresh it

Re-run the read-only ERP probe (see `process/context/database/all-database.md` §ERP Read Layer for
the probe's guardrails — one `SELECT`/`WITH` statement, no writes, always-rolled-back
`READ UNCOMMITTED` transaction, 300-row cap per call) with, for each table:

```sql
SELECT c.column_id, c.name AS column_name, t.name AS type_name, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.<table>')
ORDER BY c.column_id
```

All 12 tables currently fit in a single call each (largest is `SalesInvoiceHdr` at 151 rows, under
the 300-row cap) — no pagination needed today, but a table that grows past 300 columns must be
paginated with `ORDER BY c.column_id OFFSET n ROWS FETCH NEXT 300 ROWS ONLY`, same as any other
probe query.

To find the current table list to refresh (in case dashboard SQL adds a new table), collect every
`dbo.<table>` referenced by:
```
db/erp-queries/**/*.sql
src/lib/sales-sql.ts
src/lib/purchase-sql.ts
src/lib/production-sql.ts
```

Write a new dated file (`live-manifest_<dd-mm-yy>.json`) rather than overwriting this one in place,
so drift over time stays visible in git history.

## How this is used

This file is the SOURCE the local fixture's DDL is generated from. As of 23-09-26,
`db/erp-fixture/00-schema.sql` contains one generated `CREATE TABLE` per table below — same column
names, same order, same types, same nullability — and the fixture seed files
(`01-seed.sql`, `sales-seed.sql`, `purchase-seed.sql`, `production-seed.sql`) carry rows ONLY, no
DDL at all. A fixture may hold FEWER ROWS than production; it may not hold a DIFFERENT SHAPE.

Two mechanical guardrails enforce that, both in
`src/lib/__tests__/erp-fixture-schema-conformance.test.ts` (pure JSON/text comparison — no database,
no Docker, so it can never be skipped):

1. every `CREATE TABLE` in `00-schema.sql` is diffed column-for-column against this manifest;
2. no seed file may contain `CREATE TABLE` or `ALTER TABLE`.

Because the sandbox now mirrors the live shape exactly, a query that runs green against
`erp_fixture` can no longer fail on `db_TCL` with "Invalid column name" — which is precisely the
defect this file was created in response to.

AFTER REFRESHING THIS MANIFEST: regenerate the `CREATE TABLE` blocks in `00-schema.sql` from the new
file rather than hand-editing them, then re-run the conformance gate.
