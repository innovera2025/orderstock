-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: filtered SALES-INVOICE headers.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter compared inside static SQL — no value is
-- ever concatenated into this text. Optional filters use the `(@p IS NULL OR col = @p)` form so ONE
-- static statement serves every filter combination.
--
-- WHY THIS EXISTS: the customer's own ERP team named `sp_SalesInvoice` as the source of truth for
-- sales ("PO : sp_Purchase — SO : sp_SalesInvoice — ที่นี่ไม่ทำ SO ไปดึงที่ Invoice"). Delivery orders
-- carry the GOODS; invoices carry the MONEY. This query backs the dashboard's PRIMARY money figure;
-- the delivery-order queries (`do-*.sql`) still back the secondary "การส่งมอบ" section, unchanged.
--
-- LIVE COLUMN NAMES — read them off the manifest, not off a data dictionary. The invoice number is
-- `VoucherNo`, its date is `VoucherDate`, and the customer is `CustOrSuppCode`/`CustOrSuppName`.
-- There is NO `InvoiceNo`, `InvoiceDate`, `InvDate` or `CustCode` column on `dbo.SalesInvoiceHdr`;
-- inventing one is the exact defect class that took every dashboard page down on 23-09-26.
--
-- DELIBERATE DIVERGENCE FROM `sp_SalesInvoice`: on live data that proc degenerates to every
-- header/line pair WHERE `IsClosed = 0`. This query filters on `DocuType = 'SI'` instead. Both are
-- no-ops on today's data (all 4 live invoices carry DocuType='SI' AND IsClosed=0), and `DocuType`
-- is the better filter for two reasons: it is NOT NULL live, whereas `IsClosed` is nullable and
-- `IsClosed = 0` would silently drop any future NULL row; and it is the SAME pool
-- `sales-invoice-excluded-total.sql` already reports, so that query stays the exact unfiltered
-- variant of this one rather than describing a different set of documents.
--
-- Params:
--   @from, @to        date range over SalesInvoiceHdr.VoucherDate (required)
--   @invoiceNo        single invoice drilldown (NULL = no restriction)
--   @customer         CustOrSuppCode — NEVER a customer NAME (codes are the stable identity)
--   @product          ItemCode; a header matches when ANY of its lines carries it
--   @cat              InventoryItem.ItemGRP category key ('-' = no group)
--   @skipCat          1 = ignore @cat
--
-- NO @status PARAMETER, on purpose: all four live invoices share identical flag values
-- (IsClosed=0, IsApproved=NULL, IVStatus=NULL), so an invoice status filter would have exactly one
-- possible value. The dashboard gives the invoice section no status filter and no status donut.
--
-- `LineAmount` is the NULL-SAFE line total (`SUM(ISNULL(Amount,0))`) and `LineCount` counts EVERY
-- line including the ones whose Amount is NULL: live invoice lines DO exist with a NULL Amount
-- (the partial DO-2608-0007 case), and such a line is still a real line that was shipped.
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Qualified AS (
    SELECT h.TransactionNo, h.VoucherNo, h.VoucherDate, h.CustOrSuppCode, h.CustOrSuppName,
           h.TotalAmount
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
    q.TransactionNo,
    q.VoucherNo                       AS InvoiceNo,
    q.VoucherDate                     AS InvDate,
    q.CustOrSuppCode                  AS CustCode,
    q.CustOrSuppName                  AS CustName,
    COALESCE(q.TotalAmount, 0)        AS Amount,
    (SELECT COUNT(*) FROM dbo.SalesInvoiceDtl d
      WHERE d.TransactionNo = q.TransactionNo) AS LineCount,
    (SELECT COALESCE(SUM(COALESCE(d.Amount, 0)), 0) FROM dbo.SalesInvoiceDtl d
      WHERE d.TransactionNo = q.TransactionNo) AS LineAmount
FROM Qualified q
ORDER BY q.VoucherDate DESC, q.VoucherNo DESC;
