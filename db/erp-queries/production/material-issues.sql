-- erp-dashboards Phase 4 — Production: raw-material issues linked to ONE manufacturing order.
--
-- SOURCE: erp-data-dictionary_REF_18-09-26.md §64 ("MO ↔ raw-material issue").
--
-- READ-ONLY: a single SELECT statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: @moNumBer is a bound named parameter, never concatenated.
-- NO LOCKING HINT (execute-agent instruction E6).
--
-- LINKAGE: InventoryFlowDtl.MONo (nvarchar) matched by STRING EQUALITY against
-- tbl_MoHdr.MoNumBer. There is NO foreign key — this is a plain string comparison with no
-- cardinality guarantee. LTRIM/RTRIM on BOTH sides guards against whitespace-padded MONo values
-- (SQL Server 2019 also has single-argument TRIM(), but LTRIM(RTRIM(x)) works on every version
-- this project targets and is the same normalisation used in mo-list.sql).
--
-- EMPTY CASE IS NORMAL: most MOs have zero linked issues (7 detail rows across 218 header rows in
-- the real data). The caller renders a Thai empty state, never an error.
SELECT
    d.ItemCode,
    COALESCE(i.Description, d.ItemCode) AS ItemName,
    d.Qty,
    COALESCE(i.MainUnits, N'-') AS MainUnits,
    h.TransactionDate,
    d.MONo
FROM dbo.InventoryFlowDtl d
JOIN dbo.InventoryFlowHdr h ON h.TransactionNo = d.TransactionNo
LEFT JOIN (
    SELECT ItemCode, Description, MainUnits
    FROM (
        SELECT ItemCode, Description, MainUnits,
               ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
        FROM dbo.InventoryItem
    ) CanonicalItem
    WHERE RowRank = 1
) i ON i.ItemCode = d.ItemCode
WHERE LTRIM(RTRIM(d.MONo)) = LTRIM(RTRIM(@moNumBer))
  AND d.ReasonName = N'เบิกวัตถุดิบ : ใบสั่งผลิต'
ORDER BY h.TransactionDate ASC, d.ItemCode ASC
