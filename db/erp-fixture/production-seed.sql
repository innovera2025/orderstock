-- ============================================================================================
-- ERP-SHAPED FIXTURE — PRODUCTION DOMAIN ROWS — LOCAL SANDBOX ONLY
-- Rows for dbo.tbl_MoHdr / dbo.tbl_BatchOrder and the production-side rows of the SHARED
-- dbo.InventoryFlowHdr / dbo.InventoryFlowDtl ledger.
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script WRITES rows. It is a disposable local dev/test fixture for the `erp_fixture`
-- database inside the local `orderstock-sql` Docker container only. Because it writes, it is by
-- design NOT executed through the application's read-only guard (`guardedQuery`) — it is a
-- human/CI setup step run directly with sqlcmd, never through app code.
--
-- NO DDL LIVES HERE ANY MORE (schema-conformance rebuild, 23-09-26). Every ERP table is created
-- ONCE, live-shaped, by `db/erp-fixture/00-schema.sql`, generated from
-- `db/erp-schema/live-manifest_23-09-26.json`.
--
-- WHAT THAT FIXED HERE: this file used to create the SHARED `dbo.InventoryFlowHdr` with
-- `DocuNo`/`WarehouseCode` columns that DO NOT EXIST on the live db_TCL table (and, earlier
-- still, `TransactionDate`/`Qty` — which `material-issues.sql` actually read, so the drilldown
-- compiled locally and failed in production). Those columns are gone. The production receipt
-- rows below now carry the REAL live `VoucherNo`/`InOutDate` columns, the same ones the purchase
-- domain reads, on one single shared table shape.
--
-- SHARED-TABLE ROW CONVENTION (still this file's business): production rows occupy the reserved
-- TransactionNo 9000-block so they can never collide with the Purchase domain's 7700-block. Their
-- VoucherNo series is 'IF%', never 'IPC%', so they can never leak into the purchase
-- goods-receipt query either.
--
-- This file reuses Phase 1's existing InventoryItem codes rather than inserting new ones.
--
-- Apply (AFTER 00-schema.sql + 01-seed.sql, sandbox container running):
--   docker cp db/erp-fixture/production-seed.sql orderstock-sql:/tmp/ && \
--   docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
--     -P "$MSSQL_SA_PASSWORD" -C -b -i /tmp/production-seed.sql'
--
-- Idempotent AND order-independent: rows are inserted only when their primary key is absent, so
-- re-running neither duplicates nor overwrites, and this file may be applied before or after any
-- other domain seed.
--
-- FIXTURE DATA REQUIREMENTS this file deliberately satisfies (plan § Dependencies / Risks):
--   1. MO-2609-0001 has LotQty = NULL and only Prodqty (17)   -> documented NULL-LotQty fallback
--   2. two MOs have IsClosed = NULL (open)                    -> ISNULL(IsClosed,0) edge case
--   3. one MO has IsCancel = 1                                -> proven excluded from the list
--   4. >= 2 distinct MainUnits + one NULL-unit FG item        -> never-sum-across-units
--   5. 11 non-cancelled MOs (> one 10-row page)               -> AC12 pagination
--   6. rows span 2 calendar months (2026-08, 2026-09)         -> date-filter round-trip
--   7. MO-2609-0001 has 7 linked material-issue lines          -> AC8 drilldown (real-data shape)
--   8. MO-2608-0007's issue rows carry a WHITESPACE-PADDED MONo -> TRIM-guard regression case
--   9. most MOs have ZERO linked issues                        -> AC8 empty state (the common case)
--  10. one issue row carries a DIFFERENT ReasonName            -> proves the reason filter bites
--  11. three issue rows use ItemCodes absent from InventoryItem -> proves the defensive LEFT JOIN
-- ============================================================================================

USE erp_fixture;
GO

IF OBJECT_ID('dbo.tbl_MoHdr') IS NULL OR OBJECT_ID('dbo.tbl_BatchOrder') IS NULL
   OR OBJECT_ID('dbo.InventoryFlowHdr') IS NULL OR OBJECT_ID('dbo.InventoryFlowDtl') IS NULL
    THROW 51000, 'Apply db/erp-fixture/00-schema.sql first — this seed creates no tables.', 1;
GO

-- -------------------------------------------------------------------------------------------
-- dbo.tbl_MoHdr — manufacturing-order headers. Regqty exists live but is 0/unused in live data.
-- Unlike tbl_DOhdr, tbl_MoHdr DOES carry a real live `IsCancel` column.
-- Rows: 12 MOs (11 live + 1 cancelled). Planned quantities per unit:
--   KG 4,761.00 · BAG 180.00 · (no unit) 80.00   — never summed together.
-- -------------------------------------------------------------------------------------------
;WITH SeedMo AS (
    SELECT * FROM (VALUES
        -- The 3 real-data-shaped MOs (all 2026-09-08, mirroring live db_TCL).
        (1,  N'MO-2609-0001', '2026-09-08', N'FG-1004', CAST(NULL AS DECIMAL(18,2)), CAST(17    AS DECIMAL(18,2)), 1,    0,          0),
        (2,  N'MO-2609-0002', '2026-09-08', N'FG-1002', CAST(2207 AS DECIMAL(18,2)), CAST(2207  AS DECIMAL(18,2)), 0,    NULL,       0),
        (3,  N'MO-2609-0003', '2026-09-08', N'FG-1003', CAST(1352 AS DECIMAL(18,2)), CAST(1352  AS DECIMAL(18,2)), 0,    0,          0),
        -- August volume, so pagination and the date filter are both real.
        (4,  N'MO-2608-0004', '2026-08-20', N'FG-1001', CAST(500  AS DECIMAL(18,2)), CAST(500   AS DECIMAL(18,2)), 1,    1,          0),
        (5,  N'MO-2608-0005', '2026-08-20', N'FG-1005', CAST(120  AS DECIMAL(18,2)), CAST(120   AS DECIMAL(18,2)), 1,    0,          0),
        (6,  N'MO-2608-0006', '2026-08-21', N'FG-1006', CAST(80   AS DECIMAL(18,2)), CAST(80    AS DECIMAL(18,2)), 0,    0,          0),
        (7,  N'MO-2608-0007', '2026-08-21', N'FG-1001', CAST(300  AS DECIMAL(18,2)), CAST(300   AS DECIMAL(18,2)), 1,    0,          0),
        (8,  N'MO-2608-0008', '2026-08-24', N'FG-1002', CAST(250  AS DECIMAL(18,2)), CAST(250   AS DECIMAL(18,2)), 0,    NULL,       0),
        (9,  N'MO-2608-0009', '2026-08-24', N'FG-1005', CAST(60   AS DECIMAL(18,2)), CAST(60    AS DECIMAL(18,2)), 1,    1,          0),
        (10, N'MO-2608-0010', '2026-08-27', N'FG-1003', CAST(90   AS DECIMAL(18,2)), CAST(90    AS DECIMAL(18,2)), 1,    0,          0),
        (11, N'MO-2608-0011', '2026-08-28', N'FG-1004', CAST(45   AS DECIMAL(18,2)), CAST(45    AS DECIMAL(18,2)), 0,    0,          0),
        -- Cancelled: must never appear in the dashboard's MO list.
        (12, N'MO-2608-0012', '2026-08-28', N'FG-1001', CAST(10   AS DECIMAL(18,2)), CAST(10    AS DECIMAL(18,2)), 1,    0,          1)
    ) AS v (TransactionNo, MoNumBer, Modate, FgCode, LotQty, Prodqty, Approved, IsClosed, IsCancel)
)
INSERT INTO dbo.tbl_MoHdr
    (RowOrder, TransactionNo, MoNumBer, Modate, MoDuedate, FgCode, LotQty, Regqty, Prodqty,
     Approved, IsClosed, IsCancel, SoNo)
SELECT s.TransactionNo, s.TransactionNo, s.MoNumBer, s.Modate, s.Modate, s.FgCode, s.LotQty, 0,
       s.Prodqty, s.Approved, s.IsClosed, s.IsCancel, NULL
FROM SeedMo AS s
WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_MoHdr AS t WHERE t.TransactionNo = s.TransactionNo);
GO

-- dbo.tbl_BatchOrder — the parallel batch view of the same plan. PlanQty == Prodqty on every live
-- row. No shipped dashboard query reads this table today; it is seeded so the shape stays
-- exercised and a future batch view has real rows to read.
;WITH SeedBatch AS (
    SELECT * FROM (VALUES
        (N'B-0001', N'MO-2609-0001', N'FG-1004', CAST(17   AS DECIMAL(18,2)), CAST(17   AS DECIMAL(18,2))),
        (N'B-0002', N'MO-2609-0002', N'FG-1002', CAST(2207 AS DECIMAL(18,2)), CAST(2207 AS DECIMAL(18,2))),
        (N'B-0003', N'MO-2609-0003', N'FG-1003', CAST(1352 AS DECIMAL(18,2)), CAST(1352 AS DECIMAL(18,2)))
    ) AS v (BatchNo, Monum, ItemCode, PlanQty, Prodqty)
)
INSERT INTO dbo.tbl_BatchOrder (BatchNo, Monum, ItemCode, PlanQty, Prodqty)
SELECT s.BatchNo, s.Monum, s.ItemCode, s.PlanQty, s.Prodqty
FROM SeedBatch AS s
WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_BatchOrder AS t WHERE t.BatchNo = s.BatchNo);
GO

-- Material-issue headers on the SHARED ledger, in the reserved 9000-block. `IsStock` is NOT NULL
-- live. The 'IF%' voucher series keeps these rows out of the purchase goods-receipt query, which
-- filters `VoucherNo LIKE 'IPC%'`; `Approved` is left NULL, which also fails its `Approved = 1`.
;WITH SeedFlowHdr AS (
    SELECT * FROM (VALUES
        (9001, N'IF-2609-0001', '2026-09-08'),
        (9002, N'IF-2608-0007', '2026-08-21'),
        (9003, N'IF-2609-0009', '2026-09-09')
    ) AS v (TransactionNo, VoucherNo, InOutDate)
)
INSERT INTO dbo.InventoryFlowHdr (Roworder, TransactionNo, IsStock, VoucherNo, InOut, InOutDate)
SELECT s.TransactionNo, s.TransactionNo, 1, s.VoucherNo, -1, s.InOutDate
FROM SeedFlowHdr AS s
WHERE NOT EXISTS (SELECT 1 FROM dbo.InventoryFlowHdr AS t WHERE t.TransactionNo = s.TransactionNo);
GO

-- 7 raw-material-issue lines for MO-2609-0001 (matching the real-data row count), 2 more for
-- MO-2608-0007 with a DELIBERATELY WHITESPACE-PADDED MONo, plus one same-MONo row carrying a
-- DIFFERENT ReasonName that the reason filter must exclude.
-- `Number` is NOT NULL live and mirrors the line's RowOrder here.
;WITH SeedFlowDtl AS (
    SELECT * FROM (VALUES
        (9001, 1, N'RM-2001', CAST(8500   AS DECIMAL(18,2)), N'KG',  N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 2, N'RM-2002', CAST(1224   AS DECIMAL(18,2)), N'KG',  N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 3, N'RM-2003', CAST(10200  AS DECIMAL(18,2)), N'KG',  N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 4, N'PK-3001', CAST(2550   AS DECIMAL(18,2)), N'PCS', N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        -- Three ItemCodes deliberately ABSENT from InventoryItem: the LEFT JOIN must fall back to
        -- the raw code instead of dropping the row. RM-9003 additionally carries NO MainUnits, so
        -- it is the only row that walks `material-issues.sql`'s unit COALESCE all the way to its
        -- terminal N'-' — line unit, then item-master unit, then '-'. Keep one such row.
        (9001, 5, N'RM-9001', CAST(17     AS DECIMAL(18,2)), N'BAG', N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 6, N'RM-9002', CAST(0.03   AS DECIMAL(18,2)), N'TON', N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 7, N'RM-9003', CAST(1700   AS DECIMAL(18,2)), NULL,   N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        -- Same MO, a NON-production reason: must NOT appear in the drilldown.
        (9003, 1, N'RM-2001', CAST(999    AS DECIMAL(18,2)), N'KG',  N'MO-2609-0001',    N'ปรับปรุงสต๊อคออก'),
        -- Whitespace-padded MONo — the TRIM-guard regression case.
        (9002, 1, N'RM-2002', CAST(140    AS DECIMAL(18,2)), N'KG',  N'  MO-2608-0007 ', N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9002, 2, N'PK-3001', CAST(300    AS DECIMAL(18,2)), N'PCS', N' MO-2608-0007  ', N'เบิกวัตถุดิบ : ใบสั่งผลิต')
    ) AS v (TransactionNo, RowOrder, ItemCode, MainQuantity, MainUnits, MONo, ReasonName)
)
INSERT INTO dbo.InventoryFlowDtl
    (RowOrder, TransactionNo, Number, ItemCode, MainQuantity, MainUnits, MONo, SONo, ReasonName)
SELECT s.RowOrder, s.TransactionNo, s.RowOrder, s.ItemCode, s.MainQuantity, s.MainUnits, s.MONo,
       NULL, s.ReasonName
FROM SeedFlowDtl AS s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryFlowDtl AS t
    WHERE t.TransactionNo = s.TransactionNo AND t.RowOrder = s.RowOrder
);
GO

SELECT
    (SELECT COUNT(*) FROM dbo.tbl_MoHdr)                            AS MoHdrRows,
    (SELECT COUNT(*) FROM dbo.tbl_MoHdr WHERE ISNULL(IsCancel,0)=0) AS MoHdrLiveRows,
    (SELECT COUNT(*) FROM dbo.tbl_BatchOrder)                       AS BatchOrderRows,
    (SELECT COUNT(*) FROM dbo.InventoryFlowHdr)                     AS FlowHdrRows,
    (SELECT COUNT(*) FROM dbo.InventoryFlowDtl)                     AS FlowDtlRows;
GO
