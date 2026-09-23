-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: invoice quantity/amount PER PRODUCT.
--
-- READ-ONLY single statement through `guardedQuery()`; all filters are named parameters.
-- Params identical to `invoice-headers.sql` / `invoice-lines.sql`.
--
-- The canonical-item CTE below is the PROVEN pattern copied from `do-by-product.sql`, not
-- re-derived: `ItemCode` is NOT unique in `InventoryItem` (~85 duplicated codes live), so a
-- highest-`Roworder`-wins `ROW_NUMBER()` resolves exactly ONE row per code before joining. It is
-- used ONLY for the CATEGORY code.
--
-- GROUPED BY (ItemCode, THE LINE'S OWN UNIT). Two reasons, both hard rules of this program:
--   * the unit label must come from `SalesInvoiceDtl.MainUnits`, never the item master;
--   * quantities must NEVER be summed across different units, so the unit is part of the group key
--     rather than an aggregate picked with MAX(). If one product were ever sold in two units, this
--     query returns two rows instead of one arithmetically meaningless total.
--
-- NULL `Amount` lines are counted and contribute 0 — never dropped.
WITH CanonicalItem AS (
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Qualified AS (
    SELECT h.TransactionNo
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
    d.ItemCode,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(d.Description)), ''), d.ItemCode)) AS ItemName,
    COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-') AS Unit,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-')) AS CategoryKey,
    COUNT(*) AS LineCount,
    SUM(COALESCE(d.MainQuantity, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.SalesInvoiceDtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY d.ItemCode, COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-')
ORDER BY SUM(COALESCE(d.Amount, 0)) DESC, d.ItemCode ASC;
