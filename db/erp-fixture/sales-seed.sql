-- ============================================================================================
-- ERP-SHAPED FIXTURE — SALES DOMAIN ROWS — LOCAL SANDBOX ONLY
-- Rows for dbo.tbl_DOhdr / dbo.tbl_Dodtl / dbo.SalesInvoiceHdr.
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script WRITES rows. It is a disposable local dev/test fixture for the `erp_fixture`
-- database inside the local `orderstock-sql` Docker container only. Because it writes, it is by
-- design NOT executed through the application's read-only guard (`guardedQuery`) — it is a
-- human/CI setup step run directly with sqlcmd, never through app code.
--
-- NO DDL LIVES HERE ANY MORE (schema-conformance rebuild, 23-09-26). Every ERP table is created
-- ONCE, live-shaped, by `db/erp-fixture/00-schema.sql`, which is generated from
-- `db/erp-schema/live-manifest_23-09-26.json`. This file used to carry its own hand-written
-- CREATE TABLEs transcribed from a prose data dictionary, and they were wrong: `tbl_DOhdr`
-- gained an `IsCancel` column production does not have, `SalesInvoiceHdr` invented
-- `InvoiceNo`/`InvoiceDate`/`CustCode` (live: `VoucherNo`/`VoucherDate`/`CustOrSuppCode`), and
-- `tbl_Dodtl` omitted the live `Slno`/`RowOrder` keys entirely. Every gate passed locally and
-- the dashboards then failed on db_TCL. Column shapes are no longer this file's business.
--
-- Apply (AFTER 00-schema.sql + 01-seed.sql, sandbox container running):
--   docker cp db/erp-fixture/sales-seed.sql orderstock-sql:/tmp/ && \
--   docker exec orderstock-sql sh -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
--     -P "$MSSQL_SA_PASSWORD" -C -b -i /tmp/sales-seed.sql'
--
-- Idempotent AND order-independent: rows are inserted only when their primary key is absent, so
-- re-running neither duplicates nor overwrites, and this file may be applied before or after any
-- other domain seed.
--
-- FIXTURE DATA REQUIREMENTS this file deliberately satisfies (plan § Fixture Data Requirements):
--   1. header TotalAmount sum == detail Amount sum EXACTLY (10,111.00 both sides)  -> AC3
--   2. >= 2 distinct MainUnits across lines (KG / BAG / LITRE / PCS / NULL)        -> never-sum-across-units
--   3. mixed priced / unpriced lines (6 of 31 priced == 19.35%, never 0% or 100%)  -> AC4 coverage
--   4. >= 1 SalesInvoiceHdr row, DocuType='SI', nonzero (3 rows, 858,937.21 total) + their
--      SalesInvoiceDtl lines -> the invoice-basis (primary) figures
--   5. >= 2 distinct CustCode (4)                                                  -> customer breakdown
--   6. tbl_Dodtl.SoNo is NULL on 100% of rows (matches live reality)               -> never join on SoNo
--   7. 14 DO rows (> one page) so pagination is exercised                          -> AC12
--   8. rows span 2 calendar months (2026-08, 2026-09)                              -> AC8 period toggle
--   9. >= 11 distinct ItemCode across lines (14) so the ยอดตามสินค้า breakdown table
--      spans more than one 10-row page                                             -> breakdown paging
--
-- The four extra items (#9) were added by `sales-breakdown-pagination` (23-09-26): the breakdown
-- tables shipped rendering EVERY row, and with only 10 distinct products locally every gate passed
-- while the live ERP produced a 135-row, ~9,000px-tall table. The added lines are all UNPRICED
-- (Saleprice/Amount 0.00) ON PURPOSE, so requirement 1's 10,111.00 both-sides total and the priced
-- line count (6) are unchanged; only the total line count (31 -> 35) and therefore the coverage %
-- (19.4 -> 17.1) move, both tracked in `src/lib/__tests__/sales-fixture-expected.ts`.
-- ============================================================================================

USE erp_fixture;
GO

IF OBJECT_ID('dbo.tbl_DOhdr') IS NULL OR OBJECT_ID('dbo.tbl_Dodtl') IS NULL
   OR OBJECT_ID('dbo.SalesInvoiceHdr') IS NULL
   OR OBJECT_ID('dbo.SalesInvoiceDtl') IS NULL
    THROW 51000, 'Apply db/erp-fixture/00-schema.sql first — this seed creates no tables.', 1;
GO

-- -------------------------------------------------------------------------------------------
-- dbo.InventoryItem — FOUR EXTRA SALES-ONLY ITEMS (sales-breakdown-pagination, 23-09-26).
--
-- The shared base seed (`01-seed.sql`) carries 10 items and is used by the Purchase and Production
-- fixtures too, so it is deliberately NOT touched here: these four exist only to push the SALES
-- product breakdown past one 10-row page. `Roworder` continues 01-seed's sequence (11..14) so the
-- canonical-item rule ("highest Roworder per ItemCode wins") is unaffected, and the same
-- (Roworder, ItemCode) existence guard keeps re-runs idempotent.
-- -------------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.InventoryItem') IS NULL
    THROW 51000, 'Apply db/erp-fixture/00-schema.sql first — this seed creates no tables.', 1;
GO

;WITH SeedItems AS (
    SELECT * FROM (VALUES
        (11, N'FG-1007', N'ตีลาน 1 กก.',      N'KG',    'F'),
        (12, N'FG-1008', N'ตีดาว 1 กก.',      N'BAG',   'F'),
        (13, N'RM-2004', N'เกลือ',             N'KG',    'R'),
        (14, N'PK-3002', N'ถุงบรรจุ',          N'PCS',   'P')
    ) AS v (Roworder, ItemCode, Description, MainUnits, ItemGRP)
)
INSERT INTO dbo.InventoryItem (Roworder, ItemCode, Description, MainUnits, ItemGRP)
SELECT s.Roworder, s.ItemCode, s.Description, s.MainUnits, s.ItemGRP
FROM SeedItems AS s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryItem AS t
    WHERE t.Roworder = s.Roworder AND t.ItemCode = s.ItemCode
);
GO

-- -------------------------------------------------------------------------------------------
-- dbo.tbl_DOhdr — delivery-order headers.
--
-- THERE IS NO CANCEL FLAG, on purpose. The live table's flag set is
-- IsApproved / IsCheck / IsClosed / IsComplete / IsAcc / Revised (each with a paired *By/*Date);
-- none of them carries "cancelled" meaning. IsComplete mirrors IsClosed here, matching live
-- behaviour. `SalesInvoiceNo` stays NULL everywhere (live: only 3 of 73 headers carry one) — it
-- is informational and never part of this dashboard's totals.
--
-- `RowOrder` is a live NOT NULL surrogate on every ERP table; the dashboards never read it on
-- headers, so it simply mirrors TransactionNo.
-- -------------------------------------------------------------------------------------------
;WITH SeedHdr AS (
    SELECT * FROM (VALUES
        (1,  N'DO-2569-0001', '2026-08-03', N'CUS-001', N'ร้านตัวอย่าง ก',    0.00, 1, 1, 0),
        (2,  N'DO-2569-0002', '2026-08-05', N'CUS-002', N'ร้านตัวอย่าง ข', 1004.00, 1, 0, 0),
        (3,  N'DO-2569-0003', '2026-08-08', N'CUS-001', N'ร้านตัวอย่าง ก',    0.00, 0, 0, 0),
        (4,  N'DO-2569-0004', '2026-08-12', N'CUS-003', N'ร้านตัวอย่าง ค',    0.00, 1, 1, 0),
        (5,  N'DO-2569-0005', '2026-08-17', N'CUS-002', N'ร้านตัวอย่าง ข', 1320.00, 1, 0, 0),
        (6,  N'DO-2569-0006', '2026-08-21', N'CUS-004', N'ร้านตัวอย่าง ง',    0.00, 1, 1, 1),
        (7,  N'DO-2569-0007', '2026-08-27', N'CUS-001', N'ร้านตัวอย่าง ก',    0.00, 1, 0, 0),
        (8,  N'DO-2569-0008', '2026-09-02', N'CUS-003', N'ร้านตัวอย่าง ค', 3500.00, 1, 1, 0),
        (9,  N'DO-2569-0009', '2026-09-05', N'CUS-002', N'ร้านตัวอย่าง ข',    0.00, 0, 0, 0),
        (10, N'DO-2569-0010', '2026-09-09', N'CUS-004', N'ร้านตัวอย่าง ง',  769.50, 1, 1, 0),
        (11, N'DO-2569-0011', '2026-09-11', N'CUS-001', N'ร้านตัวอย่าง ก',    0.00, 1, 0, 0),
        (12, N'DO-2569-0012', '2026-09-15', N'CUS-003', N'ร้านตัวอย่าง ค', 2887.50, 1, 1, 0),
        (13, N'DO-2569-0013', '2026-09-18', N'CUS-002', N'ร้านตัวอย่าง ข',    0.00, 1, 1, 1),
        (14, N'DO-2569-0014', '2026-09-22', N'CUS-004', N'ร้านตัวอย่าง ง',  630.00, 0, 0, 0)
    ) AS v (TransactionNo, DoNo, Dodate, CustCode, CustName, TotalAmount,
            IsApproved, IsCheck, IsClosed)
)
INSERT INTO dbo.tbl_DOhdr (RowOrder, TransactionNo, DoNo, Dodate, CustCode, CustName, TotalAmount,
                           IsApproved, IsCheck, IsClosed, IsComplete, Revised, SalesInvoiceNo)
SELECT s.TransactionNo, s.TransactionNo, s.DoNo, s.Dodate, s.CustCode, s.CustName, s.TotalAmount,
       s.IsApproved, s.IsCheck, s.IsClosed, s.IsClosed, 0, NULL
FROM SeedHdr s
WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_DOhdr h WHERE h.TransactionNo = s.TransactionNo);
GO

-- -------------------------------------------------------------------------------------------
-- dbo.tbl_Dodtl — delivery-order lines.
--
-- LIVE KEY SHAPE: `Slno` is the within-DO line number and `RowOrder` is a table-wide sequence —
-- two separate live NOT NULL columns. The old fixture had neither and used a single invented
-- `Roworder` line number. `do-lines.sql` selects and orders by `d.Roworder`, so RowOrder is
-- generated strictly ascending in (TransactionNo, Slno) order and line ordering is preserved.
--
-- `Itemcode` is the live spelling (SQL Server identifiers are case-insensitive, so the queries'
-- `d.ItemCode` resolves to it). `SoNo` stays NULL on every row on purpose: it is NULL on 100% of
-- live rows, so production code must never join on it. `Units` exists live but is deliberately
-- left NULL — unit of measure is resolved from InventoryItem.MainUnits, never from the line.
-- -------------------------------------------------------------------------------------------
;WITH SeedDtl AS (
    SELECT * FROM (VALUES
        (1,  1, N'FG-1001', 10,   0.00,    0.00, NULL),
        (1,  2, N'FG-1002',  5,   0.00,    0.00, NULL),
        (1,  3, N'RM-2001',  4,   0.00,    0.00, NULL),
        (2,  1, N'FG-1003',  8, 125.50, 1004.00, NULL),
        (2,  2, N'FG-1005',  3,   0.00,    0.00, NULL),
        (3,  1, N'FG-1004', 12,   0.00,    0.00, NULL),
        (3,  2, N'PK-3001',  6,   0.00,    0.00, NULL),
        (4,  1, N'FG-1006',  7,   0.00,    0.00, NULL),
        (4,  2, N'RM-2002',  9,   0.00,    0.00, NULL),
        (4,  3, N'FG-1001',  4,   0.00,    0.00, NULL),
        (5,  1, N'FG-1002', 15,  88.00, 1320.00, NULL),
        (5,  2, N'RM-2003',  2,   0.00,    0.00, NULL),
        (6,  1, N'FG-1005', 20,   0.00,    0.00, NULL),
        (6,  2, N'FG-1003',  6,   0.00,    0.00, NULL),
        (7,  1, N'PK-3001', 11,   0.00,    0.00, NULL),
        (8,  1, N'FG-1001', 25, 140.00, 3500.00, NULL),
        (8,  2, N'FG-1004',  5,   0.00,    0.00, NULL),
        (8,  3, N'RM-2001',  3,   0.00,    0.00, NULL),
        (9,  1, N'FG-1002',  9,   0.00,    0.00, NULL),
        (9,  2, N'FG-1006',  4,   0.00,    0.00, NULL),
        (10, 1, N'RM-2002', 18,  42.75,  769.50, NULL),
        (10, 2, N'RM-2003',  6,   0.00,    0.00, NULL),
        (11, 1, N'FG-1003', 13,   0.00,    0.00, NULL),
        (11, 2, N'PK-3001',  8,   0.00,    0.00, NULL),
        (11, 3, N'FG-1005',  2,   0.00,    0.00, NULL),
        (12, 1, N'FG-1004', 30,  96.25, 2887.50, NULL),
        (12, 2, N'FG-1001',  7,   0.00,    0.00, NULL),
        (13, 1, N'FG-1002', 16,   0.00,    0.00, NULL),
        (13, 2, N'RM-2001',  5,   0.00,    0.00, NULL),
        (14, 1, N'FG-1006', 10,   0.00,    0.00, NULL),
        (14, 2, N'FG-1003',  3, 210.00,  630.00, NULL),
        -- sales-breakdown-pagination (23-09-26): four UNPRICED lines introducing four new
        -- ItemCodes, taking the product breakdown to 14 distinct products (> one 10-row page).
        -- Amount 0.00 on every one, so the reconciliation total stays exactly 10,111.00.
        (3,  3, N'FG-1007',  6,   0.00,    0.00, NULL),
        (7,  2, N'FG-1008',  4,   0.00,    0.00, NULL),
        (9,  3, N'RM-2004',  2,   0.00,    0.00, NULL),
        (13, 3, N'PK-3002',  7,   0.00,    0.00, NULL)
    ) AS v (TransactionNo, Slno, Itemcode, Qty, Saleprice, Amount, SoNo)
),
Missing AS (
    -- Only the rows this run actually has to insert, so re-running inserts nothing.
    SELECT s.* FROM SeedDtl s
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.tbl_Dodtl d
        WHERE d.TransactionNo = s.TransactionNo AND d.Slno = s.Slno
    )
),
Numbered AS (
    -- Table-wide RowOrder, ascending in line order so `ORDER BY d.Roworder` still yields the
    -- document's own line sequence.
    --
    -- The sequence CONTINUES from whatever is already in the table rather than restarting at 1
    -- (sales-breakdown-pagination, 23-09-26). On a fresh fixture that is identical to before —
    -- MAX is NULL, so the 35 rows number 1..35 in (TransactionNo, Slno) order. On a database
    -- already carrying the earlier 31 rows it is what keeps the four newly-added lines from
    -- colliding with existing RowOrder values; each is the last Slno of its own document, so the
    -- within-document ordering `do-lines.sql` relies on stays ascending either way.
    SELECT m.*,
           (SELECT ISNULL(MAX(d.RowOrder), 0) FROM dbo.tbl_Dodtl d)
             + ROW_NUMBER() OVER (ORDER BY m.TransactionNo, m.Slno) AS RowOrder
    FROM Missing m
)
INSERT INTO dbo.tbl_Dodtl (RowOrder, TransactionNo, Slno, Itemcode, Qty, Saleprice, Amount, SoNo, Units)
SELECT n.RowOrder, n.TransactionNo, n.Slno, n.Itemcode, n.Qty, n.Saleprice, n.Amount, n.SoNo, NULL
FROM Numbered n;
GO

-- -------------------------------------------------------------------------------------------
-- dbo.SalesInvoiceHdr — sales-invoice headers. 3 'SI' rows totalling 858,937.21 — the SAME shape
-- and total the live ERP carries, so the gates assert a real figure rather than an invented one.
--
-- FRAMING UPDATED (sales-invoice-basis, 23-09-26): these rows used to be described here as "the
-- EXCLUDED pool", read only by the reconciliation footnote. That is no longer true — this pool is
-- the dashboard's PRIMARY sales figure, and its lines live in the SalesInvoiceDtl block below.
--
-- LIVE COLUMN NAMES (the old fixture invented all three): the invoice number is `VoucherNo`, its
-- date is `VoucherDate`, and the customer code is `CustOrSuppCode`. `DocuType` is NOT NULL live.
-- -------------------------------------------------------------------------------------------
;WITH SeedInv AS (
    SELECT * FROM (VALUES
        (1, N'SI-2569-0001', '2026-08-31', N'SI', N'CUS-001', 512340.00),
        (2, N'SI-2569-0002', '2026-09-15', N'SI', N'CUS-003', 221597.21),
        (3, N'SI-2569-0003', '2026-09-20', N'SI', N'CUS-002', 125000.00)
    ) AS v (TransactionNo, VoucherNo, VoucherDate, DocuType, CustOrSuppCode, TotalAmount)
)
INSERT INTO dbo.SalesInvoiceHdr (RowOrder, TransactionNo, VoucherNo, VoucherDate, DocuType,
                                 CustOrSuppCode, TotalAmount)
SELECT s.TransactionNo, s.TransactionNo, s.VoucherNo, s.VoucherDate, s.DocuType,
       s.CustOrSuppCode, s.TotalAmount
FROM SeedInv s
WHERE NOT EXISTS (SELECT 1 FROM dbo.SalesInvoiceHdr i WHERE i.TransactionNo = s.TransactionNo);
GO

-- -------------------------------------------------------------------------------------------
-- dbo.SalesInvoiceDtl — the invoice LINES (sales-invoice-basis plan, Step S2b).
--
-- Synthetic values only. NOTHING here is copied from db_TCL; the customer's real invoice lines
-- are never reproduced in a fixture. What IS mirrored is the SHAPE of the live data, because the
-- dashboard's correctness depends on these three properties:
--
--   1. LINE SUM TIES TO THE HEADER for at least one invoice (live: all 4 tie exactly — the
--      invoice basis has no header/line reconciliation gap, unlike the DO basis). Invoices 1 and 3
--      tie here: 120000+300000+92340 = 512340.00 and 75000+50000 = 125000.00.
--   2. ONE LINE CARRIES `Amount = NULL` while its header TotalAmount is non-zero (live: the
--      DO-2608-0007 partial line). Invoice 2's FG-1006 line is that case. Every query must treat
--      it as 0 in a SUM WITHOUT dropping the line from a COUNT.
--   3. The UNIT LABEL LIVES ON THE LINE (`MainUnits`), never on the item master. FG-1006's master
--      row has a NULL MainUnits on purpose, and its invoice line still carries N'KG' — a query
--      that reaches for the item master instead of the line reads NULL here and is caught.
--
-- `CustOrSuppCode` is deliberately left NULL ON EVERY LINE. The column genuinely exists live, but
-- the authoritative customer of an invoice is the HEADER's `CustOrSuppCode` — one document, one
-- customer — and `invoice-by-customer.sql` groups by the header. Leaving the line copy NULL is a
-- structural proof: a query that grouped by the line column would collapse every row into one
-- NULL bucket and fail its gate immediately.
--
-- Spread across 3 distinct customers (via their headers), 3 category codes (F/R/P) and 4 units
-- (KG / LITRE / BAG / PCS) so the per-product, per-category and per-customer breakdowns all have
-- more than one row to aggregate.
--
-- ORDER-INDEPENDENCE (the bug `production-seed.sql`/`purchase-seed.sql` hit and fixed): `RowOrder`
-- is derived from `MAX(RowOrder)` at insert time rather than hardcoded, and the guard is the
-- (TransactionNo, ItemOrder) business key — so this block is safe to run before or after any other
-- seed file, and twice.
-- -------------------------------------------------------------------------------------------
;WITH SeedLine AS (
    SELECT * FROM (VALUES
        -- TransactionNo, ItemOrder, ItemCode, Description, MainQty, MainUnits, UnitPrice, Amount, OrderNo
        (1, 1, N'FG-1001', N'ตีนิ่ม A 1 กก.', 1000.00, N'KG',    120.0000, 120000.00, N'DO-2569-0001'),
        (1, 2, N'FG-1002', N'ตีนิ่ม 1 กก.',   2000.00, N'KG',    150.0000, 300000.00, N'DO-2569-0001'),
        (1, 3, N'RM-2001', N'น้ำปลา',           500.00, N'LITRE', 184.6800,  92340.00, N'DO-2569-0001'),
        (2, 1, N'FG-1003', N'ตีดาว 1/2 กก.',    300.00, N'KG',    200.0000,  60000.00, N'DO-2569-0004'),
        (2, 2, N'FG-1005', N'รอง 1 กก.',        100.00, N'BAG',   500.0000,  50000.00, N'DO-2569-0004'),
        -- The NULL-Amount line. Its quantity is real; only the money is absent.
        (2, 3, N'FG-1006', N'ตีลานนิ่ม 1 กก.',  250.00, N'KG',      0.0000,      NULL, N'DO-2569-0004'),
        (3, 1, N'FG-1004', N'กรวด 1 กก.',       500.00, N'KG',    150.0000,  75000.00, N'DO-2569-0002'),
        (3, 2, N'RM-2002', N'น้ำตาล',           250.00, N'KG',    200.0000,  50000.00, N'DO-2569-0002'),
        (3, 3, N'PK-3001', N'ปี๊บเปล่า',          800.00, N'PCS',     0.0000,      0.00, N'DO-2569-0002')
    ) AS v (TransactionNo, ItemOrder, ItemCode, Description, MainQuantity, MainUnits,
            UnitPrice, Amount, OrderNo)
),
Missing AS (
    SELECT l.* FROM SeedLine l
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.SalesInvoiceDtl d
        WHERE d.TransactionNo = l.TransactionNo AND d.ItemOrder = l.ItemOrder)
),
Numbered AS (
    SELECT m.*,
           (SELECT ISNULL(MAX(d.RowOrder), 0) FROM dbo.SalesInvoiceDtl d)
             + ROW_NUMBER() OVER (ORDER BY m.TransactionNo, m.ItemOrder) AS RowOrder
    FROM Missing m
)
INSERT INTO dbo.SalesInvoiceDtl (RowOrder, TransactionNo, ItemOrder, ItemCode, Description,
                                 MainQuantity, MainUnits, UnitPrice, Amount, OrderNo,
                                 CustOrSuppCode)
SELECT n.RowOrder, n.TransactionNo, n.ItemOrder, n.ItemCode, n.Description,
       n.MainQuantity, n.MainUnits, n.UnitPrice, n.Amount, n.OrderNo,
       NULL
FROM Numbered n;
GO

SELECT
    (SELECT COUNT(*) FROM dbo.tbl_DOhdr)        AS DoHdrRows,
    (SELECT COUNT(*) FROM dbo.tbl_Dodtl)        AS DoDtlRows,
    (SELECT COUNT(*) FROM dbo.SalesInvoiceHdr)  AS SalesInvoiceHdrRows,
    (SELECT COUNT(*) FROM dbo.SalesInvoiceDtl)  AS SalesInvoiceDtlRows;
GO
