-- erp-dashboards Phase 2 — Sales: filtered delivery-order (DO) headers.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter below is a named parameter compared inside static SQL — no
-- value is ever concatenated into this text (execute-agent instruction E2). Optional filters use
-- the `(@p IS NULL OR col = @p)` form so ONE static statement serves every filter combination.
--
-- Params:
--   @from, @to        date range over tbl_DOhdr.Dodate (required)
--   @doNo             single DO drilldown (NULL = no restriction)
--   @customer         CustCode — NEVER CustName (codes are the stable identity)
--   @product          ItemCode; a header matches when ANY of its lines carries it
--   @status           derived delivery-status key (see the CASE below)
--   @cat              InventoryItem.ItemGRP category key ('-' = no group)
--   @skipStatus       1 = ignore @status (the status donut must keep showing every status)
--   @skipCat          1 = ignore @cat (the category pie must keep showing every category)
--
-- STATUS is derived from the REAL flags (IsClosed/IsApproved/IsCheck) and labelled
-- "สถานะการส่งมอบ" in the UI — never "SO status": the SalesOrder module is unused in this ERP.
--
-- THERE IS NO 'cancelled' STATUS, on purpose (schema-conformance fix 23-09-26). An earlier draft
-- branched on `h.IsCancel`, but that column DOES NOT EXIST on the live `dbo.tbl_DOhdr` — the whole
-- query failed at runtime, which is why every dashboard page rendered the ERP-unavailable message.
-- The real flag set is IsApproved / IsClosed / IsComplete / IsCheck / IsAcc / Revised (each Is* with
-- a paired *By/*Date). NONE of them carries "cancelled" meaning: `Revised` means revised, and it is
-- 0 on all 83 live headers, so it was NOT repurposed as a stand-in. The branch is therefore DROPPED
-- rather than re-pointed at an invented substitute, and the UI's ยกเลิก legend entry is removed with it.
-- Live evidence (metadata + aggregate only, 23-09-26): 83 headers; IsApproved=1 on 73, IsCheck=1 on 2,
-- IsClosed/IsComplete/IsAcc/Revised = 1 on 0; no column is NULL. If the customer later confirms a
-- cancellation convention, re-add the branch against the column they name — not by guessing.
WITH CanonicalItem AS (
    -- InventoryItem's real PK is composite (Roworder, ItemCode); ItemCode alone is NOT unique
    -- (~85 duplicated codes live). Highest-Roworder-wins is the agreed tie-break (registry
    -- Cross-Phase Precondition) — resolve to exactly ONE row per ItemCode before joining.
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
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
)
SELECT
    hh.TransactionNo,
    hh.DoNo,
    hh.Dodate,
    hh.CustCode,
    hh.CustName,
    hh.StatusKey,
    (SELECT COUNT(*) FROM dbo.tbl_Dodtl d WHERE d.TransactionNo = hh.TransactionNo) AS LineCount,
    (SELECT COUNT(*) FROM dbo.tbl_Dodtl d
      WHERE d.TransactionNo = hh.TransactionNo AND d.Saleprice <> 0) AS PricedLineCount,
    (SELECT COALESCE(SUM(d.Amount), 0) FROM dbo.tbl_Dodtl d
      WHERE d.TransactionNo = hh.TransactionNo) AS Amount
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
ORDER BY hh.Dodate DESC, hh.DoNo DESC;
