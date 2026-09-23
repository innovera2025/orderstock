-- erp-dashboards Phase 3 — Purchase: PO-committed totals grouped by supplier.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- `SupplierCode` IS THE GROUP KEY AND THE DISPLAY LABEL — never `SupplierName`. The data dictionary
-- is explicit that the code, not the name, is the reliable identity: the Supplier master holds 477
-- bulk-imported rows (all IsActive=1, all Type=1) of which only 2 codes ever appear in real
-- transactions. No supplier-name column has been read or verified by research, so this phase
-- deliberately does NOT join one in; showing an unverified name would be worse than showing the
-- code the ERP's own PO screen shows. (Backlog polish item, not a defect.)
--
-- Cancelled POs are excluded here for the same reason as the committed-basis total: this chart is
-- a money/commitment view, and a cancelled order commits nothing.
--
-- DELIBERATE DIVERGENCE FROM `sp_Purchase` (documented 23-09-26, sales-invoice-basis plan Step P1 —
-- comment only, no logic change): `sp_Purchase` applies no `IsCancel` filter. The `IsCancel = 0`
-- here is defensive intent, currently a no-op (zero cancelled POs live today), and is KEPT.
--
-- Params:
--   @from, @to      inclusive CE date range over PODate (required)
--   @supplier       SupplierCode; NULL = every supplier. The bar chart passes NULL even when a
--                   supplier filter is active, so a selected bar never collapses the chart to one.
SELECT
    h.SupplierCode,
    SUM(h.TotalAmount) AS TotalPoCommitted,
    COUNT(*)           AS PoCount
FROM dbo.PurchaseOrderHdr h
WHERE h.IsCancel = 0
  AND h.PODate >= @from
  AND h.PODate <= @to
  AND (@supplier IS NULL OR h.SupplierCode = @supplier)
GROUP BY h.SupplierCode
ORDER BY SUM(h.TotalAmount) DESC, h.SupplierCode
