-- ============================================================================================
-- ERP-SHAPED FIXTURE — SALES DOMAIN — LOCAL SANDBOX ONLY
-- erp-dashboards Phase 2 (Sales dashboard). Phase 2's EXCLUSIVELY-owned per-domain fixture file
-- (registry: "Per-Domain Fixture Seed Split"). Phase 2 NEVER edits Phase 1's base
-- `00-schema.sql` / `01-seed.sql`, and never another domain phase's seed file.
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script CREATEs tables and WRITES rows. It is a disposable local dev/test fixture for the
-- `erp_fixture` database inside the local `orderstock-sql` Docker container only. Because it
-- writes, it is by design NOT executed through the application's read-only guard
-- (`guardedQuery`) — it is a human/CI setup step run directly with sqlcmd, never through app code.
--
-- Apply (after Phase 1's 00-schema.sql + 01-seed.sql, sandbox container running):
--   docker cp db/erp-fixture/sales-seed.sql orderstock-sql:/tmp/ && \
--   docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
--     -P "$MSSQL_SA_PASSWORD" -C -i /tmp/sales-seed.sql'
--
-- Idempotent: DDL is `IF NOT EXISTS`-guarded and rows are inserted only when their key is absent,
-- so re-running neither duplicates nor overwrites.
--
-- WHY THIS FILE CARRIES DDL: Phase 1's base fixture contains ONLY `dbo.InventoryItem`. None of
-- the Sales transactional tables exist there, so Phase 2 owns both their DDL and their rows.
--
-- FIXTURE DATA REQUIREMENTS this file deliberately satisfies (plan § Fixture Data Requirements):
--   1. header TotalAmount sum == detail Amount sum EXACTLY (10,111.00 both sides)  -> AC3
--   2. >= 2 distinct MainUnits across lines (KG / BAG / LITRE / PCS / NULL)        -> never-sum-across-units
--   3. mixed priced / unpriced lines (6 of 31 priced == 19.35%, never 0% or 100%)  -> AC4 coverage
--   4. >= 1 SalesInvoiceHdr row, DocuType='SI', nonzero (3 rows, 858,937.21 total) -> AC4 footnote
--   5. >= 2 distinct CustCode (4)                                                  -> customer breakdown
--   6. tbl_Dodtl.SoNo is NULL on 100% of rows (matches live reality)               -> never join on SoNo
--   7. 14 DO rows (> one page) so pagination is exercised                          -> AC12
--   8. rows span 2 calendar months (2026-08, 2026-09)                              -> AC8 period toggle
-- ============================================================================================

USE erp_fixture;
GO

-- dbo.tbl_DOhdr — delivery-order headers. Column shapes mirror the live db_TCL table documented
-- in erp-data-dictionary_REF_18-09-26.md. `SalesInvoiceNo` is nullable and mostly NULL live; it is
-- informational only and never part of this dashboard's totals.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_DOhdr'
)
BEGIN
    CREATE TABLE dbo.tbl_DOhdr (
        TransactionNo  INT            NOT NULL,
        DoNo           NVARCHAR(50)   NOT NULL,
        Dodate         DATE           NULL,
        CustCode       NVARCHAR(50)   NULL,
        CustName       NVARCHAR(200)  NULL,
        TotalAmount    DECIMAL(18, 2) NULL,
        IsApproved     BIT            NULL,
        IsCheck        BIT            NULL,
        IsClosed       BIT            NULL,
        IsCancel       BIT            NULL,
        IsComplete     BIT            NULL,
        SalesInvoiceNo NVARCHAR(50)   NULL,
        CONSTRAINT PK_tbl_DOhdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.tbl_Dodtl — delivery-order lines. `SoNo` stays NULL on every row on purpose: it is NULL on
-- 100% of live rows, so production code must never join on it.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_Dodtl'
)
BEGIN
    CREATE TABLE dbo.tbl_Dodtl (
        TransactionNo INT            NOT NULL,
        Roworder        INT            NOT NULL,
        ItemCode      NVARCHAR(50)   NOT NULL,
        Qty           DECIMAL(18, 4) NULL,
        Saleprice     DECIMAL(18, 4) NULL,
        Amount        DECIMAL(18, 2) NULL,
        SoNo          NVARCHAR(50)   NULL,
        CONSTRAINT PK_tbl_Dodtl PRIMARY KEY (TransactionNo, Roworder)
    );
END
GO

-- dbo.SalesInvoiceHdr — used ONLY by the reconciliation footnote query. These rows are the pool
-- the dashboard deliberately EXCLUDES from its own total and names out loud in the footnote.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'SalesInvoiceHdr'
)
BEGIN
    CREATE TABLE dbo.SalesInvoiceHdr (
        TransactionNo INT            NOT NULL,
        InvoiceNo     NVARCHAR(50)   NOT NULL,
        InvoiceDate   DATE           NULL,
        DocuType      NVARCHAR(10)   NULL,
        CustCode      NVARCHAR(50)   NULL,
        TotalAmount   DECIMAL(18, 2) NULL,
        CONSTRAINT PK_SalesInvoiceHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- -------------------------------------------------------------------------------------------
-- Rows. IsComplete mirrors IsClosed; SalesInvoiceNo is NULL everywhere (live: only 3/73 carry one).
-- -------------------------------------------------------------------------------------------
;WITH SeedHdr AS (
    SELECT * FROM (VALUES
        (1, N'DO-2569-0001', '2026-08-03', N'CUS-001', N'ร้านตัวอย่าง ก', 0.00, 1, 1, 0, 0),
        (2, N'DO-2569-0002', '2026-08-05', N'CUS-002', N'ร้านตัวอย่าง ข', 1004.00, 1, 0, 0, 0),
        (3, N'DO-2569-0003', '2026-08-08', N'CUS-001', N'ร้านตัวอย่าง ก', 0.00, 0, 0, 0, 0),
        (4, N'DO-2569-0004', '2026-08-12', N'CUS-003', N'ร้านตัวอย่าง ค', 0.00, 1, 1, 0, 0),
        (5, N'DO-2569-0005', '2026-08-17', N'CUS-002', N'ร้านตัวอย่าง ข', 1320.00, 1, 0, 0, 0),
        (6, N'DO-2569-0006', '2026-08-21', N'CUS-004', N'ร้านตัวอย่าง ง', 0.00, 1, 1, 1, 0),
        (7, N'DO-2569-0007', '2026-08-27', N'CUS-001', N'ร้านตัวอย่าง ก', 0.00, 1, 0, 0, 1),
        (8, N'DO-2569-0008', '2026-09-02', N'CUS-003', N'ร้านตัวอย่าง ค', 3500.00, 1, 1, 0, 0),
        (9, N'DO-2569-0009', '2026-09-05', N'CUS-002', N'ร้านตัวอย่าง ข', 0.00, 0, 0, 0, 0),
        (10, N'DO-2569-0010', '2026-09-09', N'CUS-004', N'ร้านตัวอย่าง ง', 769.50, 1, 1, 0, 0),
        (11, N'DO-2569-0011', '2026-09-11', N'CUS-001', N'ร้านตัวอย่าง ก', 0.00, 1, 0, 0, 0),
        (12, N'DO-2569-0012', '2026-09-15', N'CUS-003', N'ร้านตัวอย่าง ค', 2887.50, 1, 1, 0, 0),
        (13, N'DO-2569-0013', '2026-09-18', N'CUS-002', N'ร้านตัวอย่าง ข', 0.00, 1, 1, 1, 0),
        (14, N'DO-2569-0014', '2026-09-22', N'CUS-004', N'ร้านตัวอย่าง ง', 630.00, 0, 0, 0, 0)
    ) AS v (TransactionNo, DoNo, Dodate, CustCode, CustName, TotalAmount,
            IsApproved, IsCheck, IsClosed, IsCancel)
)
INSERT INTO dbo.tbl_DOhdr (TransactionNo, DoNo, Dodate, CustCode, CustName, TotalAmount,
                           IsApproved, IsCheck, IsClosed, IsCancel, IsComplete, SalesInvoiceNo)
SELECT s.TransactionNo, s.DoNo, s.Dodate, s.CustCode, s.CustName, s.TotalAmount,
       s.IsApproved, s.IsCheck, s.IsClosed, s.IsCancel, s.IsClosed, NULL
FROM SeedHdr s
WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_DOhdr h WHERE h.TransactionNo = s.TransactionNo);
GO

;WITH SeedDtl AS (
    SELECT * FROM (VALUES
        (1, 1, N'FG-1001', 10, 0.00, 0.00, NULL),
        (1, 2, N'FG-1002', 5, 0.00, 0.00, NULL),
        (1, 3, N'RM-2001', 4, 0.00, 0.00, NULL),
        (2, 1, N'FG-1003', 8, 125.50, 1004.00, NULL),
        (2, 2, N'FG-1005', 3, 0.00, 0.00, NULL),
        (3, 1, N'FG-1004', 12, 0.00, 0.00, NULL),
        (3, 2, N'PK-3001', 6, 0.00, 0.00, NULL),
        (4, 1, N'FG-1006', 7, 0.00, 0.00, NULL),
        (4, 2, N'RM-2002', 9, 0.00, 0.00, NULL),
        (4, 3, N'FG-1001', 4, 0.00, 0.00, NULL),
        (5, 1, N'FG-1002', 15, 88.00, 1320.00, NULL),
        (5, 2, N'RM-2003', 2, 0.00, 0.00, NULL),
        (6, 1, N'FG-1005', 20, 0.00, 0.00, NULL),
        (6, 2, N'FG-1003', 6, 0.00, 0.00, NULL),
        (7, 1, N'PK-3001', 11, 0.00, 0.00, NULL),
        (8, 1, N'FG-1001', 25, 140.00, 3500.00, NULL),
        (8, 2, N'FG-1004', 5, 0.00, 0.00, NULL),
        (8, 3, N'RM-2001', 3, 0.00, 0.00, NULL),
        (9, 1, N'FG-1002', 9, 0.00, 0.00, NULL),
        (9, 2, N'FG-1006', 4, 0.00, 0.00, NULL),
        (10, 1, N'RM-2002', 18, 42.75, 769.50, NULL),
        (10, 2, N'RM-2003', 6, 0.00, 0.00, NULL),
        (11, 1, N'FG-1003', 13, 0.00, 0.00, NULL),
        (11, 2, N'PK-3001', 8, 0.00, 0.00, NULL),
        (11, 3, N'FG-1005', 2, 0.00, 0.00, NULL),
        (12, 1, N'FG-1004', 30, 96.25, 2887.50, NULL),
        (12, 2, N'FG-1001', 7, 0.00, 0.00, NULL),
        (13, 1, N'FG-1002', 16, 0.00, 0.00, NULL),
        (13, 2, N'RM-2001', 5, 0.00, 0.00, NULL),
        (14, 1, N'FG-1006', 10, 0.00, 0.00, NULL),
        (14, 2, N'FG-1003', 3, 210.00, 630.00, NULL)
    ) AS v (TransactionNo, Roworder, ItemCode, Qty, Saleprice, Amount, SoNo)
)
INSERT INTO dbo.tbl_Dodtl (TransactionNo, Roworder, ItemCode, Qty, Saleprice, Amount, SoNo)
SELECT s.TransactionNo, s.Roworder, s.ItemCode, s.Qty, s.Saleprice, s.Amount, s.SoNo
FROM SeedDtl s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.tbl_Dodtl d
    WHERE d.TransactionNo = s.TransactionNo AND d.Roworder = s.Roworder
);
GO

-- The excluded pool: 3 'SI' rows totalling 858,937.21 — the SAME shape and total the live ERP
-- carries, so the footnote gate asserts the real figure rather than an invented one.
;WITH SeedInv AS (
    SELECT * FROM (VALUES
        (1, N'SI-2569-0001', '2026-08-31', N'SI', N'CUS-001', 512340.00),
        (2, N'SI-2569-0002', '2026-09-15', N'SI', N'CUS-003', 221597.21),
        (3, N'SI-2569-0003', '2026-09-20', N'SI', N'CUS-002', 125000.00)
    ) AS v (TransactionNo, InvoiceNo, InvoiceDate, DocuType, CustCode, TotalAmount)
)
INSERT INTO dbo.SalesInvoiceHdr (TransactionNo, InvoiceNo, InvoiceDate, DocuType, CustCode, TotalAmount)
SELECT s.TransactionNo, s.InvoiceNo, s.InvoiceDate, s.DocuType, s.CustCode, s.TotalAmount
FROM SeedInv s
WHERE NOT EXISTS (SELECT 1 FROM dbo.SalesInvoiceHdr i WHERE i.TransactionNo = s.TransactionNo);
GO
