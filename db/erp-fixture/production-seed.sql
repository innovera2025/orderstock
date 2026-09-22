-- ============================================================================================
-- ERP-SHAPED FIXTURE — PRODUCTION DOMAIN — LOCAL SANDBOX ONLY
-- erp-dashboards Phase 4 (Production dashboard). Phase 4's EXCLUSIVELY-owned per-domain fixture
-- file (registry: "Per-Domain Fixture Seed Split"). Phase 4 NEVER edits Phase 1's base
-- `00-schema.sql` / `01-seed.sql`, and never another domain phase's seed file.
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script CREATEs tables and WRITES rows. It is a disposable local dev/test fixture for the
-- `erp_fixture` database inside the local `orderstock-sql` Docker container only. Because it
-- writes, it is by design NOT executed through the application's read-only guard
-- (`guardedQuery`) — it is a human/CI setup step run directly with sqlcmd, never through app code.
--
-- Apply (after Phase 1's 00-schema.sql + 01-seed.sql, sandbox container running):
--   docker cp db/erp-fixture/production-seed.sql orderstock-sql:/tmp/ && \
--   docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
--     -P "$MSSQL_SA_PASSWORD" -C -i /tmp/production-seed.sql'
--
-- Idempotent: DDL is `IF NOT EXISTS`-guarded and rows are inserted only when their key is absent.
--
-- WHY THIS FILE CARRIES DDL: Phase 1's base fixture contains ONLY `dbo.InventoryItem`. None of the
-- Production tables exist there, so Phase 4 owns both their DDL and their rows. This file reuses
-- Phase 1's existing InventoryItem codes rather than inserting new ones.
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

-- dbo.tbl_MoHdr — manufacturing-order headers. Column shapes mirror the live db_TCL table
-- (erp-domain-discovery_REF_18-09-26.md:452). Regqty exists but is 0/unused in live data.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_MoHdr'
)
BEGIN
    CREATE TABLE dbo.tbl_MoHdr (
        TransactionNo INT            NOT NULL,
        MoNumBer      NVARCHAR(50)   NOT NULL,
        Modate        DATE           NULL,
        MoDuedate     DATE           NULL,
        FgCode        NVARCHAR(50)   NULL,
        LotQty        DECIMAL(18, 2) NULL,
        Regqty        DECIMAL(18, 2) NULL,
        Prodqty       DECIMAL(18, 2) NULL,
        Approved      BIT            NULL,
        IsClosed      BIT            NULL,
        IsCancel      BIT            NULL,
        SoNo          NVARCHAR(50)   NULL,
        CONSTRAINT PK_tbl_MoHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.tbl_BatchOrder — the parallel batch view of the same plan. PlanQty == Prodqty on every live
-- row (the proven "copy of the plan, not a measurement" finding). Seeded for completeness /
-- future reference; the Production dashboard deliberately does NOT read it.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_BatchOrder'
)
BEGIN
    CREATE TABLE dbo.tbl_BatchOrder (
        BatchNo  NVARCHAR(50)   NOT NULL,
        Monum    NVARCHAR(50)   NULL,
        ItemCode NVARCHAR(50)   NULL,
        PlanQty  DECIMAL(18, 2) NULL,
        Prodqty  DECIMAL(18, 2) NULL,
        CONSTRAINT PK_tbl_BatchOrder PRIMARY KEY (BatchNo)
    );
END
GO

-- dbo.InventoryFlowHdr / dbo.InventoryFlowDtl — the stock-movement ledger. The MO linkage lives on
-- the DETAIL row (`MONo`, nvarchar, no FK) together with its `ReasonName`.
--
-- SHARED TABLE, TWO LIVE COLUMN FAMILIES (Phase 5, residual (a) fix). These two tables are also
-- seeded by `purchase-seed.sql`. Both column families are REAL on the live db_TCL table and both
-- are used by shipped queries — `sp_Popending`'s `VoucherNo`/`InOutDate`/`MainQuantity`/`Approved`
-- (see `db/erp-queries/purchase/po-received.sql`) and this domain's `DocuNo`/`TransactionDate`/
-- `Qty`/`MONo` (see `db/erp-queries/production/material-issues.sql`). So the fixture converges on
-- the live table's full column UNION rather than picking one spelling and breaking the other.
--
-- ORDER-INDEPENDENCE: `purchase-seed.sql` already tops its own columns up with
-- `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD`; this file previously did not, so
-- purchase-then-production failed with "Invalid column name 'DocuNo'". The symmetric guards below
-- fix that: whichever seed runs first creates the table, the other adds what it is missing, and
-- both orders end at the same union. Nothing is ever dropped, renamed, or redefined.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryFlowHdr'
)
BEGIN
    CREATE TABLE dbo.InventoryFlowHdr (
        TransactionNo   INT            NOT NULL,
        DocuNo          NVARCHAR(50)   NULL,
        TransactionDate DATE           NULL,
        WarehouseCode   NVARCHAR(50)   NULL,
        CONSTRAINT PK_InventoryFlowHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- Top-up guards: needed when `purchase-seed.sql` created the table first with only its own columns.
IF COL_LENGTH('dbo.InventoryFlowHdr', 'DocuNo')          IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD DocuNo NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'TransactionDate') IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD TransactionDate DATE NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'WarehouseCode')   IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD WarehouseCode NVARCHAR(50) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryFlowDtl'
)
BEGIN
    CREATE TABLE dbo.InventoryFlowDtl (
        TransactionNo INT            NOT NULL,
        Roworder      INT            NOT NULL,
        ItemCode      NVARCHAR(50)   NOT NULL,
        Qty           DECIMAL(18, 2) NULL,
        MONo          NVARCHAR(50)   NULL,
        SONo          NVARCHAR(50)   NULL,
        ReasonName    NVARCHAR(200)  NULL,
        CONSTRAINT PK_InventoryFlowDtl PRIMARY KEY (TransactionNo, Roworder)
    );
END
GO

-- Same top-up guards for the detail table's own column family.
IF COL_LENGTH('dbo.InventoryFlowDtl', 'Qty')        IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD Qty DECIMAL(18, 2) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowDtl', 'MONo')       IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD MONo NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowDtl', 'SONo')       IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD SONo NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowDtl', 'ReasonName') IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD ReasonName NVARCHAR(200) NULL;
GO

-- -------------------------------------------------------------------------------------------
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
    (TransactionNo, MoNumBer, Modate, MoDuedate, FgCode, LotQty, Regqty, Prodqty, Approved, IsClosed, IsCancel, SoNo)
SELECT s.TransactionNo, s.MoNumBer, s.Modate, s.Modate, s.FgCode, s.LotQty, 0, s.Prodqty,
       s.Approved, s.IsClosed, s.IsCancel, NULL
FROM SeedMo AS s
WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_MoHdr AS t WHERE t.TransactionNo = s.TransactionNo);
GO

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

;WITH SeedFlowHdr AS (
    SELECT * FROM (VALUES
        (9001, N'IF-2609-0001', '2026-09-08', N'WHRM'),
        (9002, N'IF-2608-0007', '2026-08-21', N'WHRM'),
        (9003, N'IF-2609-0009', '2026-09-09', N'WHFG')
    ) AS v (TransactionNo, DocuNo, TransactionDate, WarehouseCode)
)
INSERT INTO dbo.InventoryFlowHdr (TransactionNo, DocuNo, TransactionDate, WarehouseCode)
SELECT s.TransactionNo, s.DocuNo, s.TransactionDate, s.WarehouseCode
FROM SeedFlowHdr AS s
WHERE NOT EXISTS (SELECT 1 FROM dbo.InventoryFlowHdr AS t WHERE t.TransactionNo = s.TransactionNo);
GO

-- 7 raw-material-issue lines for MO-2609-0001 (matching the real-data row count), 2 more for
-- MO-2608-0007 with a DELIBERATELY WHITESPACE-PADDED MONo, plus one same-MONo row carrying a
-- DIFFERENT ReasonName that the reason filter must exclude.
;WITH SeedFlowDtl AS (
    SELECT * FROM (VALUES
        (9001, 1, N'RM-2001', CAST(8500   AS DECIMAL(18,2)), N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 2, N'RM-2002', CAST(1224   AS DECIMAL(18,2)), N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 3, N'RM-2003', CAST(10200  AS DECIMAL(18,2)), N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 4, N'PK-3001', CAST(2550   AS DECIMAL(18,2)), N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        -- Three ItemCodes deliberately ABSENT from InventoryItem: the LEFT JOIN must fall back to
        -- the raw code instead of dropping the row.
        (9001, 5, N'RM-9001', CAST(17     AS DECIMAL(18,2)), N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 6, N'RM-9002', CAST(0.03   AS DECIMAL(18,2)), N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9001, 7, N'RM-9003', CAST(1700   AS DECIMAL(18,2)), N'MO-2609-0001',    N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        -- Same MO, a NON-production reason: must NOT appear in the drilldown.
        (9003, 1, N'RM-2001', CAST(999    AS DECIMAL(18,2)), N'MO-2609-0001',    N'ปรับปรุงสต๊อคออก'),
        -- Whitespace-padded MONo — the TRIM-guard regression case.
        (9002, 1, N'RM-2002', CAST(140    AS DECIMAL(18,2)), N'  MO-2608-0007 ', N'เบิกวัตถุดิบ : ใบสั่งผลิต'),
        (9002, 2, N'PK-3001', CAST(300    AS DECIMAL(18,2)), N' MO-2608-0007  ', N'เบิกวัตถุดิบ : ใบสั่งผลิต')
    ) AS v (TransactionNo, Roworder, ItemCode, Qty, MONo, ReasonName)
)
INSERT INTO dbo.InventoryFlowDtl (TransactionNo, Roworder, ItemCode, Qty, MONo, SONo, ReasonName)
SELECT s.TransactionNo, s.Roworder, s.ItemCode, s.Qty, s.MONo, NULL, s.ReasonName
FROM SeedFlowDtl AS s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryFlowDtl AS t
    WHERE t.TransactionNo = s.TransactionNo AND t.Roworder = s.Roworder
);
GO

SELECT
    (SELECT COUNT(*) FROM dbo.tbl_MoHdr)                          AS MoHdrRows,
    (SELECT COUNT(*) FROM dbo.tbl_MoHdr WHERE ISNULL(IsCancel,0)=0) AS MoHdrLiveRows,
    (SELECT COUNT(*) FROM dbo.tbl_BatchOrder)                     AS BatchOrderRows,
    (SELECT COUNT(*) FROM dbo.InventoryFlowHdr)                   AS FlowHdrRows,
    (SELECT COUNT(*) FROM dbo.InventoryFlowDtl)                   AS FlowDtlRows;
GO
