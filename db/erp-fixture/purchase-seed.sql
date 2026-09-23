-- ============================================================================================
-- ERP-SHAPED FIXTURE — PURCHASE DOMAIN ROWS — LOCAL SANDBOX ONLY
-- Rows for dbo.PurchaseOrderHdr / dbo.PurchaseOrderDtl / dbo.PurchaseInvoiceHdr and the
-- purchase-side rows of the SHARED dbo.InventoryFlowHdr / dbo.InventoryFlowDtl ledger.
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
-- THE BUG THIS DELETION KILLS: this file and `production-seed.sql` BOTH used to CREATE the shared
-- `dbo.InventoryFlowHdr`/`dbo.InventoryFlowDtl` tables, each with its own narrower shape, then
-- patch the other domain's columns back on with `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD`.
-- Whichever seed ran first decided the schema, and the patch-up columns (`DocuNo`,
-- `WarehouseCode`) did not exist in production at all. One generated, live-shaped DDL file
-- removes both the ordering hazard and the invented columns; the ALTER top-ups are gone.
--
-- SHARED-TABLE ROW CONVENTION (still this file's business): purchase rows occupy the reserved
-- TransactionNo 7700-block so they can never collide with the Production domain's 9000-block on
-- the shared ledger tables.
--
-- Apply (AFTER 00-schema.sql + 01-seed.sql, sandbox container running):
--   docker cp db/erp-fixture/purchase-seed.sql orderstock-sql:/tmp/ && \
--   docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
--     -P "$MSSQL_SA_PASSWORD" -C -b -i /tmp/purchase-seed.sql'
--
-- Idempotent AND order-independent: rows are inserted only when their primary key is absent, so
-- re-running neither duplicates nor overwrites, and this file may be applied before or after any
-- other domain seed.
-- ============================================================================================

USE erp_fixture;
GO

IF OBJECT_ID('dbo.PurchaseOrderHdr') IS NULL OR OBJECT_ID('dbo.PurchaseOrderDtl') IS NULL
   OR OBJECT_ID('dbo.PurchaseInvoiceHdr') IS NULL OR OBJECT_ID('dbo.InventoryFlowHdr') IS NULL
   OR OBJECT_ID('dbo.InventoryFlowDtl') IS NULL
    THROW 51000, 'Apply db/erp-fixture/00-schema.sql first — this seed creates no tables.', 1;
GO

-- -------------------------------------------------------------------------------------------
-- PO headers. 5 rows: 4 non-cancelled (money basis 727,920 = ช-001 635,000 + ว-001 92,920) and 1
-- cancelled (in the status donut, out of every money figure and out of the PO count).
-- IsClosed is NULL on the open ones — the live shape — and 1 on exactly one PO.
-- Unlike tbl_DOhdr, PurchaseOrderHdr DOES carry a real live `IsCancel` column.
-- -------------------------------------------------------------------------------------------
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
    RowOrder, TransactionNo, PONumber, PODate, SupplierCode, PurchaseType, Status,
    SubTotal, VATPercent, VATAmount, TotalAmount,
    IsApproved, IsCheck, IsComplete, IsCancel, IsClosed, IsRecPo
)
SELECT s.TransactionNo, s.TransactionNo, s.PONumber, s.PODate, s.SupplierCode, N'Local', N'Pending',
       s.TotalAmount, 0, 0, s.TotalAmount,
       s.IsApproved, s.IsCheck, s.IsComplete, s.IsCancel, s.IsClosed, s.IsRecPo
FROM SeedPo s
WHERE NOT EXISTS (SELECT 1 FROM dbo.PurchaseOrderHdr h WHERE h.TransactionNo = s.TransactionNo);
GO

-- PO lines. 10 rows across the 5 POs; each PO's TotalPrice sum equals its header TotalAmount
-- exactly. 4 distinct MainUnits (กก. / ถุง / กล่อง / ปี๊บ) so no screen can sum across them.
-- QtyReceive/InvoiceQty stay NULL everywhere, matching production.
-- `Number` is the live within-PO line number; `RowOrder` is the live table-wide sequence.
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
),
Numbered AS (
    SELECT s.*, ROW_NUMBER() OVER (ORDER BY s.TransactionNo, s.Number) AS RowOrder FROM SeedPoLine s
)
INSERT INTO dbo.PurchaseOrderDtl (
    RowOrder, TransactionNo, Number, ItemCode, MainUnits, MainQuantity, MainUnitPrice, TotalPrice,
    QtyReceive, InvoiceQty
)
SELECT n.RowOrder, n.TransactionNo, n.Number, n.ItemCode, n.MainUnits, n.MainQuantity,
       n.MainUnitPrice, n.TotalPrice, NULL, NULL
FROM Numbered n
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.PurchaseOrderDtl d
    WHERE d.TransactionNo = n.TransactionNo AND d.Number = n.Number
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
    Roworder, TransactionNo, VoucherNo, VoucherDate, DocuType, InvoiceType, PurchaseType,
    CustOrSuppCode, IsIncludeVAT, IsClosed, IsPaid, VATAmount, TotalAmount
)
SELECT s.TransactionNo, s.TransactionNo, s.VoucherNo, s.VoucherDate, s.DocuType, N'Purchase',
       s.PurchaseType, s.CustOrSuppCode, 0, s.IsClosed, 0, 0, s.TotalAmount
FROM SeedInv s
WHERE NOT EXISTS (SELECT 1 FROM dbo.PurchaseInvoiceHdr i WHERE i.TransactionNo = s.TransactionNo);
GO

-- Goods-receipt headers on the SHARED ledger. TransactionNo values live in the reserved
-- 7700-block so they can never collide with the Production domain's own rows (9000+).
--
-- `Approved` and `IsApproved` are BOTH real, distinct live columns; sp_Popending reads `Approved`,
-- and rows below exercise the difference rather than assuming it away.
--
-- Four of the six rows exist to prove sp_Popending's filter is reproduced LITERALLY rather than
-- "improved":
--   TrNo 3 — IsClosed IS NULL. `IsClosed <> 1` evaluates to UNKNOWN, so this receipt is SILENTLY
--            DROPPED from received_qty. That is what the customer's own report does today; the
--            unit suite asserts the SQL stays un-ISNULL-wrapped so nobody "fixes" it.
--   TrNo 4 — Approved = 0, so excluded (and note IsApproved = 1 on the same row).
--   TrNo 5 — voucher series 'IAD%', not 'IPC%', so excluded: an inventory adjustment is not a
--            purchase receipt even when it names a PO.
-- TrNo 1/2/6 are the receipts that legitimately count.
--
-- `IsStock` is NOT NULL live and is set to 1 (a stock-bearing movement) on every row.
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
    Roworder, TransactionNo, IsStock, VoucherNo, InOut, InOutDate, PurchaseInvoiceNo,
    Approved, IsApproved, IsClosed, ReasonIndex, ReasonName
)
SELECT s.TransactionNo, s.TransactionNo, 1, s.VoucherNo, 1, s.InOutDate, NULL,
       s.Approved, s.IsApproved, s.IsClosed, 1, N'รับเข้าจากการซื้อ'
FROM SeedFlowHdr s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryFlowHdr h WHERE h.TransactionNo = s.TransactionNo
);
GO

-- Goods-receipt lines, keyed to the PO by the DIRECT live `PONo` column (sp_Popending's own join).
-- `Number` is NOT NULL live and mirrors the line's RowOrder here.
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
    ) AS v (TransactionNo, VoucherNo, RowOrder, ItemCode, MainUnits, MainQuantity, PONo)
)
INSERT INTO dbo.InventoryFlowDtl (
    RowOrder, TransactionNo, Number, VoucherNo, ItemCode, MainUnits, MainQuantity, PONo, MONo
)
SELECT s.RowOrder, s.TransactionNo, s.RowOrder, s.VoucherNo, s.ItemCode, s.MainUnits,
       s.MainQuantity, s.PONo, NULL
FROM SeedFlowDtl s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryFlowDtl d
    WHERE d.TransactionNo = s.TransactionNo AND d.RowOrder = s.RowOrder
);
GO

SELECT
    (SELECT COUNT(*) FROM dbo.PurchaseOrderHdr)                       AS PoHdrRows,
    (SELECT COUNT(*) FROM dbo.PurchaseOrderDtl)                       AS PoDtlRows,
    (SELECT COUNT(*) FROM dbo.PurchaseInvoiceHdr)                     AS PurInvHdrRows,
    (SELECT COUNT(*) FROM dbo.InventoryFlowDtl WHERE PONo IS NOT NULL) AS PurchaseFlowDtlRows;
GO
