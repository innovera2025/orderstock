// erp-dashboards Phase 4 — the Production SQL, embedded as string constants.
//
// SOURCE OF TRUTH: the versioned, reviewable files in `db/erp-queries/production/`. Each constant
// below is a byte-identical copy of its named file, and
// `src/lib/__tests__/production-status-derivation.test.ts` asserts that identity on every run. To
// change a query: edit the `.sql` file, then paste the new text into the matching constant here.
// An out-of-sync copy FAILS the unit suite, so the two can never silently diverge.
//
// WHY EMBED AT ALL: `next.config.ts` sets `output: "standalone"`, and the standalone bundle (plus
// the production Dockerfile's COPY list) does not include `db/`. Reading these files at runtime via
// `process.cwd()` would work in dev and `pnpm start` and then fail ONLY in the production container.
// Embedding keeps the files authoritative and reviewable while making the runtime path
// environment-independent. Same pattern as Phase 2's `sales-sql.ts`.
//
// GENERATED — do not hand-edit the template literals below.

/** Verbatim copy of `db/erp-queries/production/mo-list.sql`. */
export const MO_LIST_SQL = `-- erp-dashboards Phase 4 — Production: the planned manufacturing-order (MO) list.
--
-- SOURCE: erp-data-dictionary_REF_18-09-26.md § "Production Dashboard" (tested filters) and
-- erp-domain-discovery_REF_18-09-26.md:452 (tbl_MoHdr column list).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter compared inside static SQL — no value is
-- ever concatenated into this text. Optional filters use the \`(@p IS NULL OR col = @p)\` form so
-- ONE static statement serves every filter combination.
-- NO LOCKING HINT (execute-agent instruction E6): \`guardedQuery\`'s read-only enforcement, not a
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
        -- tbl_MoHdr row may follow the same convention. A bare \`= 0\` would silently drop open MOs.
        ISNULL(h.IsClosed, 0) AS IsClosedNorm,
        ISNULL(h.IsCancel, 0) AS IsCancelNorm,
        CASE
            WHEN ISNULL(h.IsCancel, 0) = 1 THEN 'cancelled'
            WHEN ISNULL(h.IsClosed, 0) = 1 THEN 'closed'
            WHEN ISNULL(h.Approved, 0) = 1 THEN 'approved'
            ELSE 'pending'
        END AS StatusKey
    FROM dbo.tbl_MoHdr h
    -- Cancelled MOs are excluded from the default view (data dictionary: \`IsCancel = 0\`).
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
`;

/** Verbatim copy of `db/erp-queries/production/material-issues.sql`. */
export const MATERIAL_ISSUES_SQL = `-- erp-dashboards Phase 4 — Production: raw-material issues linked to ONE manufacturing order.
--
-- SOURCE: erp-data-dictionary_REF_18-09-26.md §64 ("MO ↔ raw-material issue").
--
-- READ-ONLY: a single SELECT statement, executed ONLY through \`guardedQuery()\`.
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
--   * \`d.Qty\` DOES NOT EXIST on \`InventoryFlowDtl\`. The real quantity column is \`MainQuantity\`
--     (decimal(18,2)) — the same column \`po-received.sql\` already sums on this table. Aliased back
--     to \`Qty\` so the \`MaterialIssueRow\` shape is unchanged. Populated on all 7 live issue rows.
--   * \`h.TransactionDate\` DOES NOT EXIST on \`InventoryFlowHdr\`. The flow date is \`InOutDate\`
--     (datetime) — when stock actually moved, which is the business meaning wanted here; \`EntryDate\`
--     (when the record was typed) was NOT used. Live check: \`h.InOutDate = d.InOutDate\` on all 7
--     rows, and both fall on the same day as EntryDate, so the choice is unambiguous. Aliased back
--     to \`TransactionDate\` to keep the row shape.
--   * THE UNIT NOW COMES FROM THE LINE, not the item master. \`MainQuantity\` is expressed in the
--     line's OWN \`MainUnits\`; live check found \`d.MainUnits\` DISAGREES with the canonical
--     \`InventoryItem.MainUnits\` on 6 of the 7 rows (4 distinct line units). Labelling a line
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
`;

/** Every embedded query paired with its on-disk source, for the drift gate. */
export const PRODUCTION_SQL_SOURCES: ReadonlyArray<{ name: string; file: string; sql: string }> = [
  { name: "MO_LIST_SQL", file: "db/erp-queries/production/mo-list.sql", sql: MO_LIST_SQL },
  { name: "MATERIAL_ISSUES_SQL", file: "db/erp-queries/production/material-issues.sql", sql: MATERIAL_ISSUES_SQL },
];
