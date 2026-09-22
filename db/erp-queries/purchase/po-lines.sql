-- erp-dashboards Phase 3 — Purchase: PO line items.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- JOINED TO THE HEADER so each line carries its own `PONumber` — `po-received.sql` keys receipts on
-- the PO NUMBER (`InventoryFlowDtl.PoNo`) while the lines key on `TransactionNo`, and pairing them
-- in TS needs both. The join is the verified 1:N `d.TransactionNo = h.TransactionNo`.
--
-- `@transactionNo` IS OPTIONAL: the PO LIST needs every line in range at once (to show an aggregated
-- รับแล้ว/ค้างรับ per PO without N+1 queries), and the PO DETAIL page passes a single TransactionNo.
-- One statement serves both.
--
-- COLUMN NAMES (PVL-corrected 18-09-26): the real `PurchaseOrderDtl` columns are `MainQuantity` /
-- `MainUnitPrice` / `TotalPrice`, ordered by `Number`. The earlier draft's `Qty`/`UnitPrice`/
-- `Amount`/`Slno` do not exist on this table (`Slno` belongs to `tbl_PoAmend`). They are aliased
-- back to the short names here so the row shape used elsewhere is unchanged.
--
-- `MainUnits` is selected because quantities are NEVER summed across different units anywhere in
-- this dashboard — the unit has to travel with the number.
--
-- NOT SELECTED ON PURPOSE: `QtyReceive` / `InvoiceQty`. Those are the ERP's own per-line receipt
-- columns and they are NULL on every one of the 10 live rows — the ERP's workflow never writes
-- them. Received quantity is derived from `po-received.sql` (the `sp_Popending` logic) instead.
--
-- Params:
--   @from, @to        inclusive CE date range over the HEADER's PODate (required)
--   @transactionNo    single-PO drilldown (NULL = every PO in range)
SELECT
    h.TransactionNo,
    h.PONumber,
    d.Number,
    d.ItemCode,
    d.MainUnits         AS Unit,
    d.MainQuantity      AS Qty,
    d.MainUnitPrice     AS UnitPrice,
    d.TotalPrice        AS Amount
FROM dbo.PurchaseOrderDtl d
JOIN dbo.PurchaseOrderHdr h ON h.TransactionNo = d.TransactionNo
WHERE h.PODate >= @from
  AND h.PODate <= @to
  AND (@transactionNo IS NULL OR d.TransactionNo = @transactionNo)
ORDER BY h.PONumber, d.Number
