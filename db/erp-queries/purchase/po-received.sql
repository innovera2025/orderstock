-- erp-dashboards Phase 3 — Purchase: received quantity per PO line ("PO ค้างรับ").
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through `guardedQuery()`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- THIS IS THE ERP'S OWN LOGIC, REPRODUCED LITERALLY. It is the join from KRS's own `sp_Popending`
-- stored procedure (the "PO ค้างรับ" report on their menu): received qty against a PO line is
-- `SUM(InventoryFlowDtl.MainQuantity)` matched on `PoNo` + `ItemCode`, with the header filtered to
-- `Approved = 1 AND IsClosed <> 1` and the voucher series restricted to `IPC%` (purchase receipts).
--
-- THREE THINGS THAT LOOK LIKE BUGS AND ARE NOT — do not "fix" them:
--
--   1. `h.Approved` is NOT a typo for `h.IsApproved`. `InventoryFlowHdr` carries BOTH columns as
--      distinct, real columns, and `sp_Popending` uses `Approved`. Matching the ERP's own report
--      matters more than matching the naming convention of its sibling columns.
--
--   2. `h.IsClosed <> 1` is deliberately NOT wrapped in `ISNULL(...)`. `IsClosed` is NULL on some
--      headers, and `NULL <> 1` is UNKNOWN, so those rows are silently EXCLUDED from received_qty.
--      That is exactly what the customer's own report does today, and reproducing a report's real
--      behaviour — including where it is lossy — is the point. (Contrast: the PO *status* rule in
--      `purchase-calc.ts` DOES apply ISNULL semantics, because that rule is ours, authored from the
--      flag columns, not copied from a proc. The two are different on purpose.) The fixture carries
--      an `IsClosed IS NULL` receipt row and a unit gate asserts this exclusion.
--
--   3. `d.PoNo` is a DIRECT column on `InventoryFlowDtl`. An earlier research round believed the
--      only PO→receipt path was a 3-hop chain via `PurchaseInvoiceNo`; reading the actual
--      `sp_Popending` source corrected that. The direct column is the authoritative path.
--
-- DELIBERATE DIVERGENCE FROM `sp_Purchase` (documented 23-09-26, sales-invoice-basis plan Step P2 —
-- comment only, no logic change). `sp_Purchase` computes its own received quantity (`Recqty`) as an
-- UNFILTERED correlated subquery: `SELECT SUM(MainQuantity) FROM InventoryFlowDtl WHERE PoNo=...
-- AND ItemCode=...` — no header filter of any kind. This query instead uses the STRICTER
-- `sp_Popending`-derived filter above (`Approved = 1 AND IsClosed <> 1 AND VoucherNo LIKE 'IPC%'`).
-- Both agree on today's single live receipt row (PO-L2608-0001 / item 1010001 = 400), so there is
-- no observable discrepancy yet. The stricter filter is intentionally KEPT: a draft, closed, or
-- non-purchase voucher must not count as goods received against a PO.
--
-- `@poNumber` IS OPTIONAL: the PO list aggregates receipts for every PO in one round trip; the
-- detail page passes one PO number. One statement serves both.
--
-- Params:
--   @poNumber       PurchaseOrderHdr.PONumber (NULL = every PO)
SELECT
    d.PoNo,
    d.ItemCode,
    SUM(d.MainQuantity) AS ReceivedQty
FROM dbo.InventoryFlowHdr h
JOIN dbo.InventoryFlowDtl d
  ON d.TranSactionno = h.TranSactionno
 AND d.VoucherNo = h.VoucherNo
WHERE h.Approved = 1
  AND h.IsClosed <> 1
  AND h.VoucherNo LIKE 'IPC%'
  AND d.PoNo IS NOT NULL
  AND (@poNumber IS NULL OR d.PoNo = @poNumber)
GROUP BY d.PoNo, d.ItemCode
