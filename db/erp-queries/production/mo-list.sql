-- erp-dashboards Phase 4 — Production: the planned manufacturing-order (MO) list.
--
-- SOURCE: erp-data-dictionary_REF_18-09-26.md § "Production Dashboard" (tested filters) and
-- erp-domain-discovery_REF_18-09-26.md:452 (tbl_MoHdr column list).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter compared inside static SQL — no value is
-- ever concatenated into this text. Optional filters use the `(@p IS NULL OR col = @p)` form so
-- ONE static statement serves every filter combination.
-- NO LOCKING HINT (execute-agent instruction E6): `guardedQuery`'s read-only enforcement, not a
-- WITH (NOLOCK) hint, is the security/correctness boundary. Matches Phase 2's VERIFIED SQL files.
--
-- Params:
--   @from, @to    date range over tbl_MoHdr.Modate (required)
--   @status       derived status key (see the CASE below); NULL = every status
--   @skipStatus   1 = ignore @status (the status donut must keep showing every status)
--
-- PLAN-ONLY (SPEC AC7): LotQty is the planned quantity. MO-1 in the real data has LotQty = NULL
-- and only Prodqty populated (17), so PlannedQty falls back to Prodqty FOR DISPLAY ONLY. Prodqty
-- is proven (data dictionary §C-4) to be a copy of the plan, never a measured output — it is NEVER
-- surfaced as "actual produced". No achievement percentage is computed anywhere.
WITH CanonicalItem AS (
    -- InventoryItem's real PK is composite (Roworder, ItemCode); ItemCode alone is NOT unique
    -- (~85 duplicated codes live). Highest-Roworder-wins is the agreed tie-break (registry
    -- Cross-Phase Precondition) — resolve to exactly ONE row per ItemCode before joining.
    SELECT ItemCode, Description, MainUnits,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, Description, MainUnits FROM CanonicalItem WHERE RowRank = 1
),
Mo AS (
    SELECT
        h.TransactionNo,
        h.MoNumBer,
        h.Modate,
        h.FgCode,
        h.LotQty,
        h.Prodqty,
        h.Approved,
        -- Defensive ISNULL: tbl_PurchaseOrderHdr.IsClosed is proven NULL-when-open, and a future
        -- tbl_MoHdr row may follow the same convention. A bare `= 0` would silently drop open MOs.
        ISNULL(h.IsClosed, 0) AS IsClosedNorm,
        ISNULL(h.IsCancel, 0) AS IsCancelNorm,
        CASE
            WHEN ISNULL(h.IsCancel, 0) = 1 THEN 'cancelled'
            WHEN ISNULL(h.IsClosed, 0) = 1 THEN 'closed'
            WHEN ISNULL(h.Approved, 0) = 1 THEN 'approved'
            ELSE 'pending'
        END AS StatusKey
    FROM dbo.tbl_MoHdr h
    -- Cancelled MOs are excluded from the default view (data dictionary: `IsCancel = 0`).
    -- A future "show cancelled" toggle is out of scope for this phase (backlog).
    WHERE ISNULL(h.IsCancel, 0) = 0
)
SELECT
    m.TransactionNo,
    m.MoNumBer,
    m.Modate,
    m.FgCode,
    COALESCE(i.Description, m.FgCode) AS FgName,
    COALESCE(i.MainUnits, N'-') AS MainUnits,
    -- Planned quantity, with the documented MO-1 NULL-LotQty fallback. Still the PLAN.
    COALESCE(m.LotQty, m.Prodqty, 0) AS PlannedQty,
    CASE WHEN m.LotQty IS NULL THEN 1 ELSE 0 END AS PlannedQtyFromProdqty,
    m.StatusKey,
    -- Count of linked raw-material issue lines. LEFT JOIN by design: the string-only MONo linkage
    -- has no FK and zero matches is the common case (7 detail rows across 218 headers live).
    ISNULL(mi.IssueLineCount, 0) AS IssueLineCount
FROM Mo m
LEFT JOIN Item i ON i.ItemCode = m.FgCode
LEFT JOIN (
    SELECT LTRIM(RTRIM(d.MONo)) AS MoKey, COUNT(*) AS IssueLineCount
    FROM dbo.InventoryFlowDtl d
    WHERE d.ReasonName = N'เบิกวัตถุดิบ : ใบสั่งผลิต'
      AND d.MONo IS NOT NULL
    GROUP BY LTRIM(RTRIM(d.MONo))
) mi ON mi.MoKey = LTRIM(RTRIM(m.MoNumBer))
WHERE m.Modate >= @from
  AND m.Modate <= @to
  AND (@skipStatus = 1 OR @status IS NULL OR m.StatusKey = @status)
ORDER BY m.MoNumBer DESC
