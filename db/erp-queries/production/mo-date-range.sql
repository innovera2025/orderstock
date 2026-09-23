-- ช่วงข้อมูล — Production: what the ERP ACTUALLY holds, regardless of the page's date filter.
--
-- READ-ONLY: a single SELECT statement, executed ONLY through `guardedQuery()`. No parameters, on
-- purpose — the notice describes the ERP's real data range, not the current filter selection.
-- NO LOCKING HINT (execute-agent instruction E6), matching every other query file here.
--
-- `Modate` is the MO's PLAN date — the same column `mo-list.sql` filters on — so the reported
-- range is the range of the very rows this dashboard is able to show.
--
-- COUNTS EVERY MO, cancelled ones included: a cancelled manufacturing order is still a document
-- the ERP holds. The MO list hides them; that is a list rule, not a data-range rule.
SELECT
    COUNT(*) AS DocCount,
    MIN(h.Modate) AS FirstDate,
    MAX(h.Modate) AS LastDate
FROM dbo.tbl_MoHdr h;
