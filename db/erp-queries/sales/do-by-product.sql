-- erp-dashboards Phase 2 — Sales: quantity/amount rolled up PER PRODUCT (ItemCode).
--
-- READ-ONLY single statement through `guardedQuery()`; all filters are named parameters (E2).
-- Params identical to do-headers.sql / do-lines.sql.
--
-- HARD REQUIREMENT (registry Cross-Phase Precondition, execute-agent instruction E5): the join to
-- InventoryItem resolves exactly ONE canonical row per ItemCode via highest-Roworder-wins
-- (`ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC)` in `CanonicalItem` below).
-- ItemCode is NOT unique in InventoryItem (~85 duplicated codes live) — a lower-Roworder row must
-- never silently win the name/unit/category lookup.
--
-- Grouping is per ItemCode, and each product carries its OWN unit — quantities are therefore never
-- summed across different MainUnits values (umbrella charter hard safety constraint).
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, Description, MainUnits, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, Description, MainUnits, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Hdr AS (
    SELECT h.TransactionNo, h.DoNo, h.Dodate, h.CustCode, h.CustName,
           CASE
               WHEN h.IsCancel = 1 THEN 'cancelled'
               WHEN h.IsClosed = 1 THEN 'closed'
               WHEN h.IsApproved = 1 AND h.IsCheck = 1 THEN 'checked'
               WHEN h.IsApproved = 1 THEN 'approved'
               ELSE 'pending'
           END AS StatusKey
    FROM dbo.tbl_DOhdr h
),
Qualified AS (
    SELECT hh.TransactionNo, hh.DoNo, hh.Dodate, hh.CustCode, hh.CustName, hh.StatusKey
    FROM Hdr hh
    WHERE hh.Dodate >= @from
      AND hh.Dodate <= @to
      AND (@doNo IS NULL OR hh.DoNo = @doNo)
      AND (@customer IS NULL OR hh.CustCode = @customer)
      AND (@status IS NULL OR @skipStatus = 1 OR hh.StatusKey = @status)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            WHERE d.TransactionNo = hh.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = hh.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    d.ItemCode,
    MAX(COALESCE(i.Description, d.ItemCode)) AS ItemName,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-')) AS Unit,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-')) AS CategoryKey,
    COUNT(*) AS LineCount,
    SUM(COALESCE(d.Qty, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.tbl_Dodtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY d.ItemCode
ORDER BY SUM(COALESCE(d.Qty, 0)) DESC, d.ItemCode ASC;
