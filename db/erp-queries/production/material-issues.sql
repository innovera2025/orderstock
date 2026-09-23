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
--
-- COLUMN NAMES (schema-conformance fix 23-09-26, verified against db/erp-schema/live-manifest):
--   * `d.Qty` DOES NOT EXIST on `InventoryFlowDtl`. The real quantity column is `MainQuantity`
--     (decimal(18,2)) — the same column `po-received.sql` already sums on this table. Aliased back
--     to `Qty` so the `MaterialIssueRow` shape is unchanged. Populated on all 7 live issue rows.
--   * `h.TransactionDate` DOES NOT EXIST on `InventoryFlowHdr`. The flow date is `InOutDate`
--     (datetime) — when stock actually moved, which is the business meaning wanted here; `EntryDate`
--     (when the record was typed) was NOT used. Live check: `h.InOutDate = d.InOutDate` on all 7
--     rows, and both fall on the same day as EntryDate, so the choice is unambiguous. Aliased back
--     to `TransactionDate` to keep the row shape.
--   * THE UNIT NOW COMES FROM THE LINE, not the item master. `MainQuantity` is expressed in the
--     line's OWN `MainUnits`; live check found `d.MainUnits` DISAGREES with the canonical
--     `InventoryItem.MainUnits` on 6 of the 7 rows (4 distinct line units). Labelling a line
--     quantity with the item-master unit was therefore mislabelling it across units — exactly what
--     the charter's never-sum-across-units rule exists to prevent. The item-master unit is kept
--     only as a fallback for a line whose own unit is blank.
SELECT
    d.ItemCode,
    COALESCE(i.Description, d.ItemCode) AS ItemName,
    d.MainQuantity AS Qty,
    COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), N'-') AS MainUnits,
    h.InOutDate AS TransactionDate,
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
ORDER BY h.InOutDate ASC, d.ItemCode ASC
