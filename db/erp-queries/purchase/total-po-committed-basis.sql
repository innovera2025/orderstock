-- erp-dashboards Phase 3 — Purchase: the PO-COMMITTED-BASIS total (the second, equal-weight basis).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- WHY TWO BASES, NEITHER SUBORDINATE: the invoice basis answers "how much have we been BILLED",
-- this one answers "how much have we COMMITTED to spend". Both are fully counted and correct; they
-- diverge (461,140 vs 727,920 on the live pilot data) because 2 of the 4 live POs have no matching
-- invoice at all. Which one the customer wants as their headline figure is an open question
-- deferred to backlog, so the dashboard ships both at equal visual weight rather than guessing.
--
-- `IsCancel = 0` excludes cancelled orders from the money and the count. Cancelled POs still appear
-- in the status donut (a cancelled order is a real thing that happened) — that difference is
-- deliberate and lives in the page layer, not here.
--
-- Params:
--   @from, @to      inclusive CE date range over PODate (required)
--   @supplier       SupplierCode — NEVER a supplier NAME
SELECT
    SUM(h.TotalAmount)                AS TotalPoCommitted,
    COUNT(*)                          AS PoCount,
    COUNT(DISTINCT h.SupplierCode)    AS SupplierCount
FROM dbo.PurchaseOrderHdr h
WHERE h.IsCancel = 0
  AND h.PODate >= @from
  AND h.PODate <= @to
  AND (@supplier IS NULL OR h.SupplierCode = @supplier)
