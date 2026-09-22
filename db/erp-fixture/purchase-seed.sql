-- ============================================================================================
-- ERP-SHAPED FIXTURE — PURCHASE DOMAIN — LOCAL SANDBOX ONLY
-- erp-dashboards Phase 3 (Purchase dashboard). Phase 3's EXCLUSIVELY-owned per-domain fixture file
-- (registry: "Per-Domain Fixture Seed Split"). Phase 3 NEVER edits Phase 1's base
-- `00-schema.sql` / `01-seed.sql`, and never another domain phase's seed file.
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script CREATEs tables and WRITES rows. It is a disposable local dev/test fixture for the
-- `erp_fixture` database inside the local `orderstock-sql` Docker container only. Because it
-- writes, it is by design NOT executed through the application's read-only guard
-- (`guardedQuery`) — it is a human/CI setup step run directly with sqlcmd, never through app code.
--
-- Apply (after Phase 1's 00-schema.sql + 01-seed.sql, sandbox container running):
--   docker cp db/erp-fixture/purchase-seed.sql orderstock-sql:/tmp/ && \
--   docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
--     -P "$MSSQL_SA_PASSWORD" -C -i /tmp/purchase-seed.sql'
--
-- Idempotent: DDL is `IF NOT EXISTS`-guarded, missing columns are added individually, and rows are
-- inserted only when their key is absent — so re-running neither duplicates nor overwrites.
--
-- SHARED-TABLE NOTE: `InventoryFlowHdr`/`InventoryFlowDtl` are used by BOTH the Purchase dashboard
-- (goods receipts, `PoNo`) and the Production dashboard (material issues, `MONo`). Whichever domain
-- seed runs first creates the tables; the per-column `IF COL_LENGTH(...) IS NULL` blocks below then
-- top up anything the other seed's shape was missing. Neither seed drops or redefines the other's
-- table, so the two can be applied in either order.
--
-- FIXTURE DATA REQUIREMENTS this file deliberately satisfies:
--   1. 4 non-cancelled POs / 2 suppliers, PO-committed total EXACTLY 727,920            -> AC5
--   2. 4 counted purchase invoices, invoice-basis total EXACTLY 461,140                 -> AC5
--   3. 2 further invoices that the sp_PurchaseInvoiceMonth filter must EXCLUDE          -> AC5
--   4. IsClosed NULL on open POs (the live shape) + one IsClosed=1 PO                   -> AC6
--   5. one cancelled PO (in the status donut, out of the money totals)                  -> AC6
--   6. an over-received PO line (outstanding goes NEGATIVE, never clamped)              -> AC6
--   7. an InventoryFlowHdr receipt with IsClosed NULL (silently dropped by sp_Popending) -> AC6
--   8. receipts excluded for Approved=0 and for a non-IPC voucher series                -> AC6
--   9. >= 2 distinct MainUnits across PO lines (กก. / ถุง / กล่อง / ปี๊บ)                  -> never-sum-across-units
--  10. rows span 2 calendar months (2026-08, 2026-09)                                   -> period toggle
-- ============================================================================================

USE erp_fixture;
GO

-- -------------------------------------------------------------------------------------------
-- dbo.PurchaseOrderHdr — PO headers. Column shapes mirror the live db_TCL table documented in
-- erp-data-dictionary_REF_18-09-26.md (122 columns live; only the ones this dashboard reads are
-- reproduced). IsClosed is NULLABLE and NULL on every open PO — that is the live reality and the
-- whole reason `derivePoStatus()` applies ISNULL semantics.
-- -------------------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'PurchaseOrderHdr'
)
BEGIN
    CREATE TABLE dbo.PurchaseOrderHdr (
        TransactionNo INT            NOT NULL,
        PONumber      NVARCHAR(50)   NOT NULL,
        PODate        DATE           NULL,
        SupplierCode  NVARCHAR(50)   NULL,
        PurchaseType  NVARCHAR(50)   NULL,
        Status        NVARCHAR(50)   NULL,
        SubTotal      DECIMAL(18, 2) NULL,
        VATPercent    DECIMAL(9, 4)  NULL,
        VATAmount     DECIMAL(18, 2) NULL,
        TotalAmount   DECIMAL(18, 2) NULL,
        IsApproved    BIT            NULL,
        IsCheck       BIT            NULL,
        IsComplete    BIT            NULL,
        IsCancel      BIT            NULL,
        IsClosed      BIT            NULL,
        IsRecPo       BIT            NULL,
        CONSTRAINT PK_PurchaseOrderHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.PurchaseOrderDtl — PO line items. QtyReceive/InvoiceQty exist and stay NULL on every row,
-- exactly as in production: the ERP's workflow never writes them, which is why received quantity is
-- derived from InventoryFlow (sp_Popending) instead of read from here.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'PurchaseOrderDtl'
)
BEGIN
    CREATE TABLE dbo.PurchaseOrderDtl (
        TransactionNo INT            NOT NULL,
        Number        INT            NOT NULL,
        ItemCode      NVARCHAR(50)   NOT NULL,
        MainUnits     NVARCHAR(50)   NULL,
        MainQuantity  DECIMAL(18, 4) NULL,
        MainUnitPrice DECIMAL(18, 4) NULL,
        TotalPrice    DECIMAL(18, 2) NULL,
        QtyReceive    DECIMAL(18, 4) NULL,
        InvoiceQty    DECIMAL(18, 4) NULL,
        CONSTRAINT PK_PurchaseOrderDtl PRIMARY KEY (TransactionNo, Number)
    );
END
GO

-- dbo.PurchaseInvoiceHdr — purchase invoices. `CustOrSuppCode` (not `SupplierCode`) is the real
-- live column name on this table. DocuType/PurchaseType/VoucherNo together drive KRS's own
-- sp_PurchaseInvoiceMonth filter, so all three must be real columns here.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'PurchaseInvoiceHdr'
)
BEGIN
    CREATE TABLE dbo.PurchaseInvoiceHdr (
        TransactionNo  INT            NOT NULL,
        VoucherNo      NVARCHAR(50)   NOT NULL,
        VoucherDate    DATE           NULL,
        DocuType       NVARCHAR(10)   NULL,
        InvoiceType    NVARCHAR(50)   NULL,
        PurchaseType   NVARCHAR(50)   NULL,
        CustOrSuppCode NVARCHAR(50)   NULL,
        IsIncludeVAT   BIT            NULL,
        IsClosed       BIT            NULL,
        IsPaid         BIT            NULL,
        VATAmount      DECIMAL(18, 2) NULL,
        TotalAmount    DECIMAL(18, 2) NULL,
        CONSTRAINT PK_PurchaseInvoiceHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.InventoryFlowHdr / dbo.InventoryFlowDtl — stock-movement ledger, SHARED with the Production
-- domain (see the SHARED-TABLE NOTE at the top of this file).
--
-- IMPORTANT, and the reason this section is all additive: the Production seed creates these two
-- tables with a NARROWER, differently-named shape (`DocuNo`/`TransactionDate`/`Qty`) than the live
-- db_TCL columns this dashboard must use (`VoucherNo`/`InOutDate`/`MainQuantity` — the exact names
-- `sp_Popending` itself references, which is why they are not negotiable here). So: create the
-- tables only if absent, then ADD any column this domain needs that is missing. Nothing is ever
-- dropped, renamed or redefined, so either seed may be applied first and both domains end up with
-- the columns they need on one shared table.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryFlowHdr'
)
BEGIN
    CREATE TABLE dbo.InventoryFlowHdr (
        TransactionNo INT          NOT NULL,
        CONSTRAINT PK_InventoryFlowHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- `Approved` and `IsApproved` are BOTH real, distinct columns on the live table; sp_Popending uses
-- `Approved`. Both exist here so the difference is exercisable rather than theoretical.
IF COL_LENGTH('dbo.InventoryFlowHdr', 'VoucherNo')         IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD VoucherNo NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'InOut')             IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD InOut INT NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'InOutDate')         IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD InOutDate DATE NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'Approved')          IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD Approved BIT NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'IsApproved')        IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD IsApproved BIT NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'IsClosed')          IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD IsClosed BIT NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'PurchaseInvoiceNo') IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD PurchaseInvoiceNo NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'ReasonIndex')       IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD ReasonIndex INT NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowHdr', 'ReasonName')        IS NULL ALTER TABLE dbo.InventoryFlowHdr ADD ReasonName NVARCHAR(200) NULL;
GO

-- `PoNo` is a DIRECT column on the detail table: reading the real sp_Popending source corrected the
-- earlier belief that PO→receipt was only reachable via a 3-hop PurchaseInvoiceNo chain. `MONo` is
-- the Production domain's equivalent direct link.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryFlowDtl'
)
BEGIN
    CREATE TABLE dbo.InventoryFlowDtl (
        TransactionNo INT          NOT NULL,
        Roworder      INT          NOT NULL,
        ItemCode      NVARCHAR(50) NOT NULL,
        CONSTRAINT PK_InventoryFlowDtl PRIMARY KEY (TransactionNo, Roworder)
    );
END
GO

IF COL_LENGTH('dbo.InventoryFlowDtl', 'VoucherNo')    IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD VoucherNo NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowDtl', 'MainUnits')    IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD MainUnits NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowDtl', 'MainQuantity') IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD MainQuantity DECIMAL(18, 4) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowDtl', 'PoNo')         IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD PoNo NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.InventoryFlowDtl', 'MONo')         IS NULL ALTER TABLE dbo.InventoryFlowDtl ADD MONo NVARCHAR(50) NULL;
GO

-- ===========================================================================================
-- ROWS
-- ===========================================================================================

-- PO headers. 5 rows: 4 non-cancelled (money basis 727,920 = ช-001 635,000 + ว-001 92,920) and 1
-- cancelled (in the status donut, out of every money figure and out of the PO count).
-- IsClosed is NULL on the open ones — the live shape — and 1 on exactly one PO.
;WITH SeedPo AS (
    SELECT * FROM (VALUES
        --  TrNo, PONumber,          PODate,       Supplier, Total,   Appr, Chk, Cmpl, Cncl, Closed, RecPo
        (1, N'PO-L2608-0001', '2026-08-14', N'ช-001', 444000.00, 1, 1, 0, 0, NULL, 1),
        (2, N'PO-L2608-0002', '2026-08-17', N'ช-001', 191000.00, 1, 1, 0, 0,    1, 0),
        (3, N'PO-L2608-0003', '2026-08-28', N'ว-001',  62920.00, 1, 0, 0, 0, NULL, 0),
        (4, N'PO-L2609-0004', '2026-09-11', N'ว-001',  30000.00, 0, 0, 0, 0, NULL, 0),
        (5, N'PO-L2609-0005', '2026-09-05', N'ช-001',  15000.00, 1, 1, 0, 1, NULL, 0)
    ) AS v (TransactionNo, PONumber, PODate, SupplierCode, TotalAmount,
            IsApproved, IsCheck, IsComplete, IsCancel, IsClosed, IsRecPo)
)
INSERT INTO dbo.PurchaseOrderHdr (
    TransactionNo, PONumber, PODate, SupplierCode, PurchaseType, Status,
    SubTotal, VATPercent, VATAmount, TotalAmount,
    IsApproved, IsCheck, IsComplete, IsCancel, IsClosed, IsRecPo
)
SELECT s.TransactionNo, s.PONumber, s.PODate, s.SupplierCode, N'Local', N'Pending',
       s.TotalAmount, 0, 0, s.TotalAmount,
       s.IsApproved, s.IsCheck, s.IsComplete, s.IsCancel, s.IsClosed, s.IsRecPo
FROM SeedPo s
WHERE NOT EXISTS (SELECT 1 FROM dbo.PurchaseOrderHdr h WHERE h.TransactionNo = s.TransactionNo);
GO

-- PO lines. 10 rows across the 5 POs; each PO's TotalPrice sum equals its header TotalAmount
-- exactly. 4 distinct MainUnits (กก. / ถุง / กล่อง / ปี๊บ) so no screen can sum across them.
-- QtyReceive/InvoiceQty stay NULL everywhere, matching production.
;WITH SeedPoLine AS (
    SELECT * FROM (VALUES
        (1, 1, N'ITM-010', N'กก.',   400.0, 1110.00, 444000.00),
        (2, 1, N'ITM-011', N'ถุง',   100.0, 1200.00, 120000.00),
        (2, 2, N'ITM-010', N'กก.',    50.0, 1420.00,  71000.00),
        (3, 1, N'ITM-013', N'กล่อง',   4.0, 2500.00,  10000.00),
        (3, 2, N'ITM-011', N'ถุง',    40.0, 1000.00,  40000.00),
        (3, 3, N'ITM-008', N'ปี๊บ',     8.0, 1615.00,  12920.00),
        (4, 1, N'ITM-010', N'กก.',    20.0, 1000.00,  20000.00),
        (4, 2, N'ITM-012', N'กก.',    25.0,  400.00,  10000.00),
        (5, 1, N'ITM-013', N'กล่อง',   2.0, 5000.00,  10000.00),
        (5, 2, N'ITM-011', N'ถุง',     5.0, 1000.00,   5000.00)
    ) AS v (TransactionNo, Number, ItemCode, MainUnits, MainQuantity, MainUnitPrice, TotalPrice)
)
INSERT INTO dbo.PurchaseOrderDtl (
    TransactionNo, Number, ItemCode, MainUnits, MainQuantity, MainUnitPrice, TotalPrice,
    QtyReceive, InvoiceQty
)
SELECT s.TransactionNo, s.Number, s.ItemCode, s.MainUnits, s.MainQuantity, s.MainUnitPrice,
       s.TotalPrice, NULL, NULL
FROM SeedPoLine s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.PurchaseOrderDtl d
    WHERE d.TransactionNo = s.TransactionNo AND d.Number = s.Number
);
GO

-- Purchase invoices. The first 4 all PASS KRS's own sp_PurchaseInvoiceMonth filter and total
-- EXACTLY 461,140 — 2 via the DocuType='PC' branch, 2 via the PurchaseType='Invoice' branch with a
-- non-PC voucher prefix, mirroring the live 2+2 split. Rows 5 and 6 are the negative cases the
-- filter MUST exclude: row 5 has PurchaseType='Invoice' but a 'PC%' voucher number, row 6 is
-- IsClosed=1. If either ever leaked in, the KPI would jump by a very visible six-figure amount.
-- VATAmount is 0 everywhere, exactly as in production (hence VAT-exclusive display, no branching).
;WITH SeedInv AS (
    SELECT * FROM (VALUES
        (1, N'IM2608150001', '2026-08-15', N'PA', N'Invoice', N'ช-001', 0, 444000.00),
        (2, N'PC2608200001', '2026-08-20', N'PC', N'Petty',   N'ว-001', 0,   6500.00),
        (3, N'PC2609010001', '2026-09-01', N'PC', N'Petty',   N'ช-001', 0,   4640.00),
        (4, N'IM2609090001', '2026-09-09', N'PA', N'Invoice', N'ว-001', 0,   6000.00),
        (5, N'PC2609100002', '2026-09-10', N'PA', N'Invoice', N'ช-001', 0,  99999.00),
        (6, N'IM2609120001', '2026-09-12', N'PA', N'Invoice', N'ว-001', 1,  88888.00)
    ) AS v (TransactionNo, VoucherNo, VoucherDate, DocuType, PurchaseType, CustOrSuppCode,
            IsClosed, TotalAmount)
)
INSERT INTO dbo.PurchaseInvoiceHdr (
    TransactionNo, VoucherNo, VoucherDate, DocuType, InvoiceType, PurchaseType,
    CustOrSuppCode, IsIncludeVAT, IsClosed, IsPaid, VATAmount, TotalAmount
)
SELECT s.TransactionNo, s.VoucherNo, s.VoucherDate, s.DocuType, N'Purchase', s.PurchaseType,
       s.CustOrSuppCode, 0, s.IsClosed, 0, 0, s.TotalAmount
FROM SeedInv s
WHERE NOT EXISTS (SELECT 1 FROM dbo.PurchaseInvoiceHdr i WHERE i.TransactionNo = s.TransactionNo);
GO

-- Goods-receipt headers. TransactionNo values live in a reserved 7700-block so they can never
-- collide with the Production domain's own rows on this shared table (which occupy 9000+).
-- Four of the six rows below exist to prove sp_Popending's filter is
-- reproduced LITERALLY rather than "improved":
--   TrNo 3 — IsClosed IS NULL. `IsClosed <> 1` evaluates to UNKNOWN, so this receipt is SILENTLY
--            DROPPED from received_qty. That is what the customer's own report does today; the
--            unit suite asserts the SQL stays un-ISNULL-wrapped so nobody "fixes" it.
--   TrNo 4 — Approved = 0, so excluded (and note IsApproved = 1 on the same row: the two columns
--            are genuinely different, and sp_Popending reads `Approved`).
--   TrNo 5 — voucher series 'IAD%', not 'IPC%', so excluded: an inventory adjustment is not a
--            purchase receipt even when it names a PO.
-- TrNo 1/2/6 are the receipts that legitimately count.
;WITH SeedFlowHdr AS (
    SELECT * FROM (VALUES
        (7701, N'IPC-2608-0001', '2026-08-16',    1,    1,    0),
        (7702, N'IPC-2608-0002', '2026-08-25',    1,    1,    0),
        (7703, N'IPC-2608-0003', '2026-08-26',    1,    1, NULL),
        (7704, N'IPC-2609-0004', '2026-09-02',    0,    1,    0),
        (7705, N'IAD-2609-0001', '2026-09-03',    1,    1,    0),
        (7706, N'IPC-2609-0005', '2026-09-04',    1,    1,    0)
    ) AS v (TransactionNo, VoucherNo, InOutDate, Approved, IsApproved, IsClosed)
)
INSERT INTO dbo.InventoryFlowHdr (
    TransactionNo, VoucherNo, InOut, InOutDate, PurchaseInvoiceNo,
    Approved, IsApproved, IsClosed, ReasonIndex, ReasonName
)
SELECT s.TransactionNo, s.VoucherNo, 1, s.InOutDate, NULL,
       s.Approved, s.IsApproved, s.IsClosed, 1, N'รับเข้าจากการซื้อ'
FROM SeedFlowHdr s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryFlowHdr h WHERE h.TransactionNo = s.TransactionNo
);
GO

-- Goods-receipt lines, keyed to the PO by the DIRECT `PoNo` column (sp_Popending's own join).
-- Resulting received/outstanding picture once the header filter is applied:
--   PO-L2608-0001 / ITM-010 : ordered 400, received 400  -> outstanding 0     (fully received)
--   PO-L2608-0002 / ITM-010 : ordered  50, received  60  -> outstanding -10   (OVER-RECEIVED)
--   PO-L2608-0002 / ITM-011 : ordered 100, received   0  -> outstanding 100   (TrNo 3 dropped: IsClosed NULL)
--   PO-L2608-0003 / ITM-013 : ordered   4, received   2  -> outstanding 2     (partial)
--   PO-L2608-0003 / ITM-011 : ordered  40, received   0  -> outstanding 40    (TrNo 4 dropped: Approved=0)
--   PO-L2608-0003 / ITM-008 : ordered   8, received   0  -> outstanding 8     (TrNo 5 dropped: not IPC%)
;WITH SeedFlowDtl AS (
    SELECT * FROM (VALUES
        (7701, N'IPC-2608-0001', 1, N'ITM-010', N'กก.',   400.0, N'PO-L2608-0001'),
        (7702, N'IPC-2608-0002', 1, N'ITM-010', N'กก.',    60.0, N'PO-L2608-0002'),
        (7703, N'IPC-2608-0003', 1, N'ITM-011', N'ถุง',    30.0, N'PO-L2608-0002'),
        (7704, N'IPC-2609-0004', 1, N'ITM-011', N'ถุง',    10.0, N'PO-L2608-0003'),
        (7705, N'IAD-2609-0001', 1, N'ITM-008', N'ปี๊บ',     3.0, N'PO-L2608-0003'),
        (7706, N'IPC-2609-0005', 1, N'ITM-013', N'กล่อง',   2.0, N'PO-L2608-0003')
    ) AS v (TransactionNo, VoucherNo, Roworder, ItemCode, MainUnits, MainQuantity, PoNo)
)
INSERT INTO dbo.InventoryFlowDtl (
    TransactionNo, VoucherNo, Roworder, ItemCode, MainUnits, MainQuantity, PoNo, MONo
)
SELECT s.TransactionNo, s.VoucherNo, s.Roworder, s.ItemCode, s.MainUnits, s.MainQuantity,
       s.PoNo, NULL
FROM SeedFlowDtl s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryFlowDtl d
    WHERE d.TransactionNo = s.TransactionNo AND d.Roworder = s.Roworder
);
GO
