-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: invoice totals PER CUSTOMER.
--
-- READ-ONLY single statement through `guardedQuery()`; all filters are named parameters.
-- Params identical to `invoice-headers.sql`.
--
-- THE CUSTOMER COMES FROM THE HEADER (`SalesInvoiceHdr.CustOrSuppCode`), NOT FROM THE LINE.
-- `SalesInvoiceDtl` does carry its own `CustOrSuppCode` column, but an invoice document has exactly
-- ONE customer, recorded on the header — the per-line copy is a derived duplicate with no
-- authority. Grouping by the line column would be reading a shadow of the real value.
--
-- The CODE is the group key and the identity; the NAME is display-only and may be missing, exactly
-- as in `do-by-customer.sql`.
--
-- Grouped by (customer, THE LINE'S OWN UNIT) so quantities are never summed across units.
WITH CanonicalItem AS (
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Qualified AS (
    SELECT h.TransactionNo, h.CustOrSuppCode, h.CustOrSuppName
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
    q.CustOrSuppCode AS CustCode,
    MAX(q.CustOrSuppName) AS CustName,
    COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-') AS Unit,
    COUNT(*) AS LineCount,
    COUNT(DISTINCT q.TransactionNo) AS InvoiceCount,
    SUM(COALESCE(d.MainQuantity, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.SalesInvoiceDtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY q.CustOrSuppCode, COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-')
ORDER BY q.CustOrSuppCode ASC, Unit ASC;
