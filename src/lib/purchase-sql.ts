// erp-dashboards Phase 3 — the Purchase SQL, embedded as string constants.
//
// SOURCE OF TRUTH: the versioned, reviewable files in `db/erp-queries/purchase/`. Each constant
// below is a byte-identical copy of its named file, and
// `src/lib/__tests__/purchase-dual-basis.test.ts` asserts that identity on every run. To change a
// query: edit the `.sql` file, then re-copy the new text into the matching constant here. An
// out-of-sync copy FAILS the unit suite, so the two can never silently diverge.
//
// WHY EMBED AT ALL: `next.config.ts` sets `output: "standalone"`, and the standalone bundle (plus
// the production Dockerfile COPY list) does not include `db/`. Reading these files at runtime via
// `process.cwd()` would work in dev and `pnpm start` and then fail ONLY in the production
// container — a break no gate in this repo would catch. Embedding keeps the files authoritative and
// reviewable while making the runtime path environment-independent. Same decision, same reason, as
// Phase 2's `src/lib/sales-sql.ts`.
//
// GENERATED — do not hand-edit the template literals below.

/** Verbatim copy of `db/erp-queries/purchase/total-invoice-basis.sql`. */
export const TOTAL_INVOICE_BASIS_SQL = `-- erp-dashboards Phase 3 — Purchase: the INVOICE-BASIS purchase rows (KRS's own billed-purchase rule).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter compared inside static SQL — no value is
-- ever concatenated into this text. Optional filters use the \`(@p IS NULL OR col = @p)\` form so ONE
-- static statement serves every filter combination.
--
-- THE RULE IS KRS'S, NOT OURS. The WHERE clause below is the literal filter from the ERP's own
-- \`sp_PurchaseInvoiceMonth\` stored procedure:
--     (DocuType = 'PC' OR (PurchaseType = 'Invoice' AND VoucherNo NOT LIKE 'PC%')) AND IsClosed = 0
-- Do not "improve" it. All 4 live purchase invoices pass it (2x DocuType='PC' with a PC voucher
-- prefix, 2x DocuType='PA'/PurchaseType='Invoice' with an IM prefix), reconciling to 461,140 —
-- the same figure the customer's own monthly purchase report produces.
--
-- VAT: \`VATAmount\` is 0 on EVERY live row, so these amounts are VAT-exclusive and this dashboard
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
`;

/** Verbatim copy of `db/erp-queries/purchase/total-po-committed-basis.sql`. */
export const TOTAL_PO_COMMITTED_BASIS_SQL = `-- erp-dashboards Phase 3 — Purchase: the PO-COMMITTED-BASIS total (the second, equal-weight basis).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- WHY TWO BASES, NEITHER SUBORDINATE: the invoice basis answers "how much have we been BILLED",
-- this one answers "how much have we COMMITTED to spend". Both are fully counted and correct; they
-- diverge (461,140 vs 727,920 on the live pilot data) because 2 of the 4 live POs have no matching
-- invoice at all. Which one the customer wants as their headline figure is an open question
-- deferred to backlog, so the dashboard ships both at equal visual weight rather than guessing.
--
-- \`IsCancel = 0\` excludes cancelled orders from the money and the count. Cancelled POs still appear
-- in the status donut (a cancelled order is a real thing that happened) — that difference is
-- deliberate and lives in the page layer, not here.
--
-- DELIBERATE DIVERGENCE FROM \`sp_Purchase\` (documented 23-09-26, sales-invoice-basis plan Step P1 —
-- comment only, no logic change). The ERP's own \`sp_Purchase\` reads \`PurchaseOrderHdr\` ⋈
-- \`PurchaseOrderDtl\` with NO \`IsCancel\` filter at all. This dashboard adds \`IsCancel = 0\` as
-- DEFENSIVE INTENT. On today's live data the filter is a NO-OP — zero cancelled POs exist — so the
-- two agree exactly (727,920 THB / 4 POs). The filter is intentionally KEPT, not removed to match
-- the proc: the day a PO is cancelled, a committed-spend total that still counts it would be wrong.
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
`;

/** Verbatim copy of `db/erp-queries/purchase/supplier-breakdown.sql`. */
export const SUPPLIER_BREAKDOWN_SQL = `-- erp-dashboards Phase 3 — Purchase: PO-committed totals grouped by supplier.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- \`SupplierCode\` IS THE GROUP KEY AND THE DISPLAY LABEL — never \`SupplierName\`. The data dictionary
-- is explicit that the code, not the name, is the reliable identity: the Supplier master holds 477
-- bulk-imported rows (all IsActive=1, all Type=1) of which only 2 codes ever appear in real
-- transactions. No supplier-name column has been read or verified by research, so this phase
-- deliberately does NOT join one in; showing an unverified name would be worse than showing the
-- code the ERP's own PO screen shows. (Backlog polish item, not a defect.)
--
-- Cancelled POs are excluded here for the same reason as the committed-basis total: this chart is
-- a money/commitment view, and a cancelled order commits nothing.
--
-- DELIBERATE DIVERGENCE FROM \`sp_Purchase\` (documented 23-09-26, sales-invoice-basis plan Step P1 —
-- comment only, no logic change): \`sp_Purchase\` applies no \`IsCancel\` filter. The \`IsCancel = 0\`
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
`;

/** Verbatim copy of `db/erp-queries/purchase/po-list.sql`. */
export const PO_LIST_SQL = `-- erp-dashboards Phase 3 — Purchase: the PO header list (the main table, and the status donut).
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- CANCELLED POs ARE RETURNED, not filtered out: the status donut counts every order including the
-- cancelled ones ("a cancelled order is a real thing that happened"), while the money KPIs and the
-- supplier chart exclude them. One query serves both; the page layer decides which set it wants.
--
-- STATUS IS NOT DERIVED HERE. The flag columns come back raw and \`derivePoStatus()\` in
-- \`src/lib/purchase-calc.ts\` turns them into one status, so the precedence rule lives in exactly
-- one testable place rather than being duplicated as a CASE in every query that needs it.
-- \`IsClosed\` is NULL on every open PO in the live data — it must reach TS as NULL, not as 0.
--
-- COLUMN NAMES (PVL-corrected 18-09-26): \`PurchaseOrderHdr\`'s own date column is \`PODate\`;
-- \`VoucherDate\` exists but belongs to \`PurchaseInvoiceHdr\`. The SELECT aliases PODate back to
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
`;

/** Verbatim copy of `db/erp-queries/purchase/po-lines.sql`. */
export const PO_LINES_SQL = `-- erp-dashboards Phase 3 — Purchase: PO line items.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- JOINED TO THE HEADER so each line carries its own \`PONumber\` — \`po-received.sql\` keys receipts on
-- the PO NUMBER (\`InventoryFlowDtl.PoNo\`) while the lines key on \`TransactionNo\`, and pairing them
-- in TS needs both. The join is the verified 1:N \`d.TransactionNo = h.TransactionNo\`.
--
-- \`@transactionNo\` IS OPTIONAL: the PO LIST needs every line in range at once (to show an aggregated
-- รับแล้ว/ค้างรับ per PO without N+1 queries), and the PO DETAIL page passes a single TransactionNo.
-- One statement serves both.
--
-- COLUMN NAMES (PVL-corrected 18-09-26): the real \`PurchaseOrderDtl\` columns are \`MainQuantity\` /
-- \`MainUnitPrice\` / \`TotalPrice\`, ordered by \`Number\`. The earlier draft's \`Qty\`/\`UnitPrice\`/
-- \`Amount\`/\`Slno\` do not exist on this table (\`Slno\` belongs to \`tbl_PoAmend\`). They are aliased
-- back to the short names here so the row shape used elsewhere is unchanged.
--
-- \`MainUnits\` is selected because quantities are NEVER summed across different units anywhere in
-- this dashboard — the unit has to travel with the number.
--
-- NOT SELECTED ON PURPOSE: \`QtyReceive\` / \`InvoiceQty\`. Those are the ERP's own per-line receipt
-- columns and they are NULL on every one of the 10 live rows — the ERP's workflow never writes
-- them. Received quantity is derived from \`po-received.sql\` (the \`sp_Popending\` logic) instead.
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
`;

/** Verbatim copy of `db/erp-queries/purchase/po-received.sql`. */
export const PO_RECEIVED_SQL = `-- erp-dashboards Phase 3 — Purchase: received quantity per PO line ("PO ค้างรับ").
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter; no value is concatenated into this text.
--
-- THIS IS THE ERP'S OWN LOGIC, REPRODUCED LITERALLY. It is the join from KRS's own \`sp_Popending\`
-- stored procedure (the "PO ค้างรับ" report on their menu): received qty against a PO line is
-- \`SUM(InventoryFlowDtl.MainQuantity)\` matched on \`PoNo\` + \`ItemCode\`, with the header filtered to
-- \`Approved = 1 AND IsClosed <> 1\` and the voucher series restricted to \`IPC%\` (purchase receipts).
--
-- THREE THINGS THAT LOOK LIKE BUGS AND ARE NOT — do not "fix" them:
--
--   1. \`h.Approved\` is NOT a typo for \`h.IsApproved\`. \`InventoryFlowHdr\` carries BOTH columns as
--      distinct, real columns, and \`sp_Popending\` uses \`Approved\`. Matching the ERP's own report
--      matters more than matching the naming convention of its sibling columns.
--
--   2. \`h.IsClosed <> 1\` is deliberately NOT wrapped in \`ISNULL(...)\`. \`IsClosed\` is NULL on some
--      headers, and \`NULL <> 1\` is UNKNOWN, so those rows are silently EXCLUDED from received_qty.
--      That is exactly what the customer's own report does today, and reproducing a report's real
--      behaviour — including where it is lossy — is the point. (Contrast: the PO *status* rule in
--      \`purchase-calc.ts\` DOES apply ISNULL semantics, because that rule is ours, authored from the
--      flag columns, not copied from a proc. The two are different on purpose.) The fixture carries
--      an \`IsClosed IS NULL\` receipt row and a unit gate asserts this exclusion.
--
--   3. \`d.PoNo\` is a DIRECT column on \`InventoryFlowDtl\`. An earlier research round believed the
--      only PO→receipt path was a 3-hop chain via \`PurchaseInvoiceNo\`; reading the actual
--      \`sp_Popending\` source corrected that. The direct column is the authoritative path.
--
-- DELIBERATE DIVERGENCE FROM \`sp_Purchase\` (documented 23-09-26, sales-invoice-basis plan Step P2 —
-- comment only, no logic change). \`sp_Purchase\` computes its own received quantity (\`Recqty\`) as an
-- UNFILTERED correlated subquery: \`SELECT SUM(MainQuantity) FROM InventoryFlowDtl WHERE PoNo=...
-- AND ItemCode=...\` — no header filter of any kind. This query instead uses the STRICTER
-- \`sp_Popending\`-derived filter above (\`Approved = 1 AND IsClosed <> 1 AND VoucherNo LIKE 'IPC%'\`).
-- Both agree on today's single live receipt row (PO-L2608-0001 / item 1010001 = 400), so there is
-- no observable discrepancy yet. The stricter filter is intentionally KEPT: a draft, closed, or
-- non-purchase voucher must not count as goods received against a PO.
--
-- \`@poNumber\` IS OPTIONAL: the PO list aggregates receipts for every PO in one round trip; the
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
`;

/** Every embedded Purchase query, for the drift / read-only assertions in the unit suite. */
/** Verbatim copy of `db/erp-queries/purchase/po-date-range.sql`. */
export const PO_DATE_RANGE_SQL = `-- ช่วงข้อมูล — Purchase: what the ERP ACTUALLY holds, regardless of the page's date filter.
--
-- READ-ONLY: a single SELECT statement, executed ONLY through \`guardedQuery()\`. No parameters, on
-- purpose — the notice describes the ERP's real data range, not the current filter selection.
--
-- WHICH DATE, AND WHY. This dashboard reads two bases: purchase orders (PurchaseOrderHdr.PODate)
-- and purchase invoices (PurchaseInvoiceHdr.VoucherDate). The notice reports the PURCHASE-ORDER
-- range and the purchase-order count, and says so out loud in the UI text ("ใบสั่งซื้อ N ใบ") —
-- the PO is the document this page lists, the document the drilldown route opens, and the document
-- whose number the user recognises. Reporting one unlabelled range spanning two different document
-- types would be the dishonest option; naming the document type we report is the honest one.
--
-- COUNTS EVERY PO, cancelled ones included: a cancelled order is still a document the ERP holds.
-- The money KPIs exclude cancelled orders — that is a KPI rule, not a data-range rule.
SELECT
    COUNT(*) AS DocCount,
    MIN(h.PODate) AS FirstDate,
    MAX(h.PODate) AS LastDate
FROM dbo.PurchaseOrderHdr h;
`;

export const PURCHASE_SQL_SOURCES: ReadonlyArray<{ name: string; file: string; sql: string }> = [
  { name: "TOTAL_INVOICE_BASIS_SQL", file: "db/erp-queries/purchase/total-invoice-basis.sql", sql: TOTAL_INVOICE_BASIS_SQL },
  { name: "TOTAL_PO_COMMITTED_BASIS_SQL", file: "db/erp-queries/purchase/total-po-committed-basis.sql", sql: TOTAL_PO_COMMITTED_BASIS_SQL },
  { name: "SUPPLIER_BREAKDOWN_SQL", file: "db/erp-queries/purchase/supplier-breakdown.sql", sql: SUPPLIER_BREAKDOWN_SQL },
  { name: "PO_LIST_SQL", file: "db/erp-queries/purchase/po-list.sql", sql: PO_LIST_SQL },
  { name: "PO_LINES_SQL", file: "db/erp-queries/purchase/po-lines.sql", sql: PO_LINES_SQL },
  { name: "PO_RECEIVED_SQL", file: "db/erp-queries/purchase/po-received.sql", sql: PO_RECEIVED_SQL },
  { name: "PO_DATE_RANGE_SQL", file: "db/erp-queries/purchase/po-date-range.sql", sql: PO_DATE_RANGE_SQL },
];
