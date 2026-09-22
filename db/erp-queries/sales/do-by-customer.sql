-- erp-dashboards Phase 2 — Sales: quantity/amount rolled up PER CUSTOMER, PER UNIT.
--
-- READ-ONLY single statement through `guardedQuery()`; all filters are named parameters (E2).
-- Params identical to do-headers.sql / do-lines.sql.
--
-- GROUPED BY CustCode (the stable identity), never CustName — the data dictionary's explicit
-- drilldown caution. CustName is carried along for display only.
--
-- The `Unit` column is part of the GROUP BY on purpose: quantities must never be summed across
-- different MainUnits values (umbrella charter hard safety constraint), so one customer yields one
-- row per unit rather than a single collapsed cross-unit total.
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
    q.CustCode,
    MAX(q.CustName) AS CustName,
    COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-') AS Unit,
    COUNT(*) AS LineCount,
    COUNT(DISTINCT q.DoNo) AS DoCount,
    SUM(COALESCE(d.Qty, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.tbl_Dodtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY q.CustCode, COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-')
ORDER BY q.CustCode ASC, Unit ASC;
