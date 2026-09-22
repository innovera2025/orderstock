-- erp-dashboards Phase 3 — Purchase: the INVOICE-BASIS purchase rows (KRS's own billed-purchase rule).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter compared inside static SQL — no value is
-- ever concatenated into this text. Optional filters use the `(@p IS NULL OR col = @p)` form so ONE
-- static statement serves every filter combination.
--
-- THE RULE IS KRS'S, NOT OURS. The WHERE clause below is the literal filter from the ERP's own
-- `sp_PurchaseInvoiceMonth` stored procedure:
--     (DocuType = 'PC' OR (PurchaseType = 'Invoice' AND VoucherNo NOT LIKE 'PC%')) AND IsClosed = 0
-- Do not "improve" it. All 4 live purchase invoices pass it (2x DocuType='PC' with a PC voucher
-- prefix, 2x DocuType='PA'/PurchaseType='Invoice' with an IM prefix), reconciling to 461,140 —
-- the same figure the customer's own monthly purchase report produces.
--
-- VAT: `VATAmount` is 0 on EVERY live row, so these amounts are VAT-exclusive and this dashboard
-- deliberately has no inclusive/exclusive branching. That absence is correct, not an omission.
--
-- ROWS, NOT A SUM: the KPI tile, the period chart and the supplier breakdown all need the SAME
-- filtered invoice set at different groupings. Returning rows once and aggregating in TS keeps
-- those three figures arithmetically identical by construction instead of by three similar queries.
--
-- Params:
--   @from, @to      inclusive CE date range over VoucherDate (required)
--   @supplier       CustOrSuppCode — NEVER a supplier NAME (codes are the stable identity)
SELECT
    h.TransactionNo,
    h.VoucherNo,
    h.VoucherDate,
    h.DocuType,
    h.PurchaseType,
    h.CustOrSuppCode AS SupplierCode,
    h.TotalAmount
FROM dbo.PurchaseInvoiceHdr h
WHERE (h.DocuType = 'PC' OR (h.PurchaseType = 'Invoice' AND h.VoucherNo NOT LIKE 'PC%'))
  AND h.IsClosed = 0
  AND h.VoucherDate >= @from
  AND h.VoucherDate <= @to
  AND (@supplier IS NULL OR h.CustOrSuppCode = @supplier)
ORDER BY h.VoucherDate, h.VoucherNo
