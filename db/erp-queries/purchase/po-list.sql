-- erp-dashboards Phase 3 — Purchase: the PO header list (the main table, and the status donut).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- CANCELLED POs ARE RETURNED, not filtered out: the status donut counts every order including the
-- cancelled ones ("a cancelled order is a real thing that happened"), while the money KPIs and the
-- supplier chart exclude them. One query serves both; the page layer decides which set it wants.
--
-- STATUS IS NOT DERIVED HERE. The flag columns come back raw and `derivePoStatus()` in
-- `src/lib/purchase-calc.ts` turns them into one status, so the precedence rule lives in exactly
-- one testable place rather than being duplicated as a CASE in every query that needs it.
-- `IsClosed` is NULL on every open PO in the live data — it must reach TS as NULL, not as 0.
--
-- COLUMN NAMES (PVL-corrected 18-09-26): `PurchaseOrderHdr`'s own date column is `PODate`;
-- `VoucherDate` exists but belongs to `PurchaseInvoiceHdr`. The SELECT aliases PODate back to
-- VoucherDate so the row shape used elsewhere is unchanged, while the filter/sort use the real column.
--
-- Params:
--   @from, @to      inclusive CE date range over PODate (required)
--   @supplier       SupplierCode — NEVER a supplier NAME
--   @poNumber       single-PO drilldown (NULL = no restriction)
SELECT
    h.TransactionNo,
    h.PONumber,
    h.PODate AS VoucherDate,
    h.SupplierCode,
    h.TotalAmount,
    h.IsCancel,
    h.IsClosed,
    h.IsComplete,
    h.IsRecPo,
    h.IsApproved,
    h.IsCheck
FROM dbo.PurchaseOrderHdr h
WHERE h.PODate >= @from
  AND h.PODate <= @to
  AND (@supplier IS NULL OR h.SupplierCode = @supplier)
  AND (@poNumber IS NULL OR h.PONumber = @poNumber)
ORDER BY h.PODate DESC, h.PONumber DESC
