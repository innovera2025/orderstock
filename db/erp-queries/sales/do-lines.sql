-- erp-dashboards Phase 2 — Sales: filtered DO line items, joined to the canonical item master.
--
-- READ-ONLY single statement, run ONLY through `guardedQuery()`; every filter is a named
-- parameter (E2) — nothing is concatenated into this text.
--
-- Semantics mirror the approved mockup exactly: a HEADER qualifies on the date/customer/status
-- filters (and on "has at least one line matching the product/category filter"); the returned
-- LINES are then narrowed to the lines that themselves match the product/category filter.
--
-- Params: identical to do-headers.sql.
--
-- CATEGORY LABELS COME FROM THE ERP ITSELF (defect fix, 23-09-26): `CategoryKey` is still the raw
-- `InventoryItem.ItemGRP` CODE — the stable identity that every filter and URL uses — but the
-- human-readable `CategoryLabel` is now LEFT JOINed from `dbo.tbl_ItemGroup` (ICCode -> Description,
-- 23 rows live) instead of being hardcoded in the app. The app only ever knew F/R/P, so the live
-- code `W` rendered as the raw fallback "หมวด W" on the category pie, and `P` was not even a real
-- code (the live "งานระหว่างผลิต"-ish group is `W` = สินค้าระหว่างผลิต). The label stays NULLable: a
-- code with no matching group row falls back to "หมวด {code}" in the app, never to nothing.
--
-- MainUnits comes from InventoryItem (the line table carries no unit of its own). Quantities are
-- returned PER LINE with their unit attached and are NEVER pre-summed here — cross-unit summing
-- is forbidden (umbrella charter hard safety constraint); aggregation happens per-unit in
-- `sumQuantityByUnit()`.
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, Description, MainUnits, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, Description, MainUnits, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
ItemGroup AS (
    -- The ERP's own category master. ICCode is unique across the 23 live rows today, but this
    -- collapses by code anyway so a future duplicate can never fan a line out into two rows and
    -- inflate the pie's line counts.
    SELECT LTRIM(RTRIM(ICCode)) AS GroupCode, MAX(LTRIM(RTRIM(Description))) AS GroupName
    FROM dbo.tbl_ItemGroup
    WHERE NULLIF(LTRIM(RTRIM(ICCode)), '') IS NOT NULL
    GROUP BY LTRIM(RTRIM(ICCode))
),
Hdr AS (
    SELECT h.TransactionNo, h.DoNo, h.Dodate, h.CustCode, h.CustName,
           CASE
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
    q.DoNo,
    q.Dodate,
    q.CustCode,
    q.CustName,
    q.StatusKey,
    d.Roworder,
    d.ItemCode,
    COALESCE(i.Description, d.ItemCode) AS ItemName,
    COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-') AS Unit,
    COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') AS CategoryKey,
    g.GroupName AS CategoryLabel,
    COALESCE(d.Qty, 0) AS Qty,
    COALESCE(d.Saleprice, 0) AS Saleprice,
    COALESCE(d.Amount, 0) AS Amount
FROM Qualified q
JOIN dbo.tbl_Dodtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
LEFT JOIN ItemGroup g ON g.GroupCode = LTRIM(RTRIM(i.ItemGRP))
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
ORDER BY q.Dodate DESC, q.DoNo DESC, d.Roworder ASC;
