-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: SALES-INVOICE lines.
--
-- READ-ONLY single statement through `guardedQuery()`; every filter is a named parameter (no value
-- is concatenated into this text). Params identical to `invoice-headers.sql`.
--
-- THE UNIT LABEL COMES FROM THE LINE (`d.MainUnits`), NEVER FROM THE ITEM MASTER. This is a hard
-- rule of this program, and a mistake already made and fixed once: an invoice line records the unit
-- it was actually sold in, which may differ from `InventoryItem.MainUnits`. The item master is
-- joined here ONLY for the category code, never for the unit and never for the quantity.
--
-- `Amount` IS NULL ON REAL LIVE LINES (the partial DO-2608-0007 invoice line). It is COALESCEd to 0
-- for display and arithmetic, but the line itself is never filtered out — a priced-zero line is
-- still a line that shipped goods, and dropping it would understate both the quantity and the
-- line count.
--
-- `OrderNo` is the delivery order this invoice line came from (live: 100% of invoice lines carry
-- one, prefix `DO-2`), which is how the invoice section and the delivery section relate.
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
ItemGroup AS (
    -- The ERP's own category master; collapsed by code so a duplicate can never fan a line out.
    SELECT LTRIM(RTRIM(ICCode)) AS GroupCode, MAX(LTRIM(RTRIM(Description))) AS GroupName
    FROM dbo.tbl_ItemGroup
    WHERE NULLIF(LTRIM(RTRIM(ICCode)), '') IS NOT NULL
    GROUP BY LTRIM(RTRIM(ICCode))
),
Qualified AS (
    SELECT h.TransactionNo, h.VoucherNo, h.VoucherDate, h.CustOrSuppCode, h.CustOrSuppName
    FROM dbo.SalesInvoiceHdr h
    WHERE h.DocuType = 'SI'
      AND h.VoucherDate >= @from
      AND h.VoucherDate <= @to
      AND (@invoiceNo IS NULL OR h.VoucherNo = @invoiceNo)
      AND (@customer IS NULL OR h.CustOrSuppCode = @customer)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            WHERE d.TransactionNo = h.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = h.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    q.VoucherNo                                            AS InvoiceNo,
    q.VoucherDate                                          AS InvDate,
    q.CustOrSuppCode                                       AS CustCode,
    q.CustOrSuppName                                       AS CustName,
    d.RowOrder,
    d.ItemOrder,
    d.ItemCode,
    COALESCE(NULLIF(LTRIM(RTRIM(d.Description)), ''), d.ItemCode) AS ItemName,
    -- THE LINE'S OWN UNIT. Never `i.MainUnits`.
    COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-')   AS Unit,
    COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-')     AS CategoryKey,
    g.GroupName                                            AS CategoryLabel,
    COALESCE(d.MainQuantity, 0)                            AS Qty,
    COALESCE(d.UnitPrice, 0)                               AS UnitPrice,
    COALESCE(d.Amount, 0)                                  AS Amount,
    d.OrderNo
FROM Qualified q
JOIN dbo.SalesInvoiceDtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
LEFT JOIN ItemGroup g ON g.GroupCode = LTRIM(RTRIM(i.ItemGRP))
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
ORDER BY q.VoucherDate DESC, q.VoucherNo DESC, d.ItemOrder ASC;
