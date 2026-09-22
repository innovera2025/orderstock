# ERP Domain Discovery — db_TCL

- Date: 18-09-26
- Source: scratchpad/erpq/discovery.json (parallel domain-agent discovery output)
- Purpose: Per-domain (purchase, sales, production, master) discovery — data reality, tables, joins, metric recipes, verified facts, inferences, unknowns, and questions — plus the sibling KRS/TCL project cross-reference ('krs' section).

> **Note:** Where this discovery conflicts with `erp-data-dictionary_REF_18-09-26.md` (the later, more authoritative cross-check session), the data dictionary wins.

---

## Domain: purchase

**Purchasing (PO Dashboard) — ERP discovery for db_TCL**

### Summary

The customer's live ERP (db_TCL, SQL Server 2019, compat 130) stores Purchase Orders in PurchaseOrderHdr/Dtl, sourced from PurchaseRequisitionHdr/Dtl (PR→PO link via PRNo/PRTrNo on the PO line), and PO fulfillment is realized downstream in PurchaseInvoiceHdr/Dtl (SourceType='PO' + OrderNo/OrderTrNo pointing back at the PO) and, further downstream still, in InventoryFlowHdr (stock receipt, linked via PurchaseInvoiceNo/PurchaseInvoiceTrNo — NOT directly via a PO number). There is NO PO-level "received quantity" being populated in production: PurchaseOrderDtl.QtyReceive/InvoiceQty are NULL on every one of the 10 existing lines, so "goods received against PO" cannot currently be computed from PO columns alone and must be derived by joining PO → Invoice → InventoryFlow (a 3-hop chain), or accepted as an unreliable/未実装 signal. VAT handling needs a design decision: all 4 live POs show VatType=3, VATPercent=0, VATAmount=0, meaning Total=SubTotal=TotalAmount identically — the VAT-inclusive/exclusive arithmetic check could not be meaningfully exercised (zero VAT rows only); IsIncludeVAT is NULL on PurchaseOrderHdr but set (1 or 0) inconsistently on PurchaseInvoiceHdr. "PO Status" has no single derivable enum column with real variety — Status is free-text ('Pending' on all 4 rows) and the flag columns (IsApproved/IsCheck/IsComplete/IsCancel/IsClosed/IsRecPo) are mostly 0/NULL — a dashboard status derivation rule must be authored from these flags, not read off Status directly, and cannot yet be validated against a realistic status distribution because only 4 PO rows exist, all in the same early lifecycle state.

### Data reality

The Purchasing module in db_TCL is in EARLY/PILOT use, not mature production use. VERIFIED via direct query: only 4 PurchaseOrderHdr rows total, dated 14-Aug-2026 to 11-Sep-2026 (a ~4-week window ending 1 week before "today" 18-Sep-2026). Only 2 distinct SupplierCode values appear across all 4 POs (out of 477 Supplier master rows, all IsActive=1, all Type=1 — i.e. Supplier master data itself looks legacy/bulk-imported, not reflective of live usage). All 4 PO headers have Status='Pending' and IsComplete=0/IsCancel=0/IsClosed=NULL — none have progressed to a terminal state. All 10 PurchaseOrderDtl lines have QtyReceive=NULL and InvoiceQty=NULL — i.e. the ERP's own per-line receipt-tracking columns are never populated, even though downstream artifacts (1 invoice, 1 inventory-flow receipt) exist for PO #1. Only 1 of 218 InventoryFlowHdr rows references a PurchaseInvoiceNo at all (the rest of that huge table is unrelated stock movement, not receipts). This means: a Purchase Dashboard built from this DB today will show near-zero historical volume; any "PO Status" or "received vs ordered" widget must be designed to gracefully show empty/near-empty states, and any status/trend logic derived from only 4 rows cannot be validated against real distributions.

### Tables

#### PurchaseOrderHdr

- **Role:** PO header — doc no/date/supplier/currency/VAT/amount totals/status flags
- **Key columns:** TransactionNo (PK), PONumber, PODate, SupplierCode, Currency, ExchangeRate, VatType, IsIncludeVAT, Total, DiscountAmount, SubTotal, VATPercent, VATAmount, TotalAmount, DueDateHdr, PurchaseType, Status, EntryBy, EntryDate
- **Status columns:** Status (free text, all 'Pending'), IsApproved, IsCheck, IsComplete, IsCancel, IsClosed, IsRecPo, Revised
- **Date range:** PODate 2026-08-14 to 2026-09-11 (4 rows only)
- **Notes:** 122 columns total; most are legacy/unused (asset/project/MO/quotation fields all NULL on live rows). IsIncludeVAT is NULL on all 4 rows.

#### PurchaseOrderDtl

- **Role:** PO line items — qty/price/receipt tracking
- **Key columns:** TransactionNo (FK→Hdr), Number, ItemCode, MainQuantity, MainUnits, MainUnitPrice, DiscountAmount, TotalPrice, QtyReceive, InvoiceQty, PRNo, PRTrNo, DueDate
- **Status columns:** QtyReceive (NULL on all 10 rows), InvoiceQty (NULL on all 10 rows)
- **Date range:** same window as Hdr
- **Notes:** 10 rows across 4 POs; every line's receipt-tracking columns are unpopulated in production — receipt status must be derived via Invoice/InventoryFlow join, not read from this table.

#### PurchaseRequisitionHdr

- **Role:** Purchase requisition header, upstream of PO
- **Key columns:** TransactionNo (PK), PRNo, PRDate, PRFor, DeptCode, Department, TypeOfPR, PrStatus, IsApproved, IsClosed, IsComplete, IsCheck, IsReceive
- **Status columns:** PrStatus (both 'Pending'), IsApproved, IsClosed, IsComplete, IsCheck, IsReceive
- **Date range:** 2026-08-14 to 2026-08-17 (2 rows only)
- **Notes:** Both existing PRs have PRFor='PO' and Department='แผนกผลิต' (Production dept).

#### PurchaseRequisitionDtl

- **Role:** PR line items with PO/on-hand/on-order snapshot columns
- **Key columns:** TransactionNo (FK→PRHdr), Number, ItemCode, Quantity, PONo, POTrNo, POQty, Onhand, OnPr, OnPo, OnReceive
- **Status columns:** (none)
- **Date range:** n/a (6 rows)
- **Notes:** PONo/POTrNo directly cross-reference PurchaseOrderHdr.PONumber/TransactionNo — verified match (PR#1→PO-L2608-0002, PR#2→PO-L2608-0003). Onhand/OnPr/OnPo/OnReceive are all 0 on every existing row (snapshot-at-creation columns, not live-updated in this dataset).

#### PurchaseInvoiceHdr

- **Role:** Purchase invoice header — can be sourced from PO or from petty-cash (PC)
- **Key columns:** TransactionNo (PK), InvoiceType, PurchaseType, VoucherNo, VoucherDate, CustOrSuppCode, Currency, VatType, IsIncludeVAT, IsClosed, IsPaid, TotalAmount, VATAmount, AmountDue, DueDate, Warehouse
- **Status columns:** IsClosed (0 on all 4), IsPaid (0 on all 4)
- **Date range:** 2026-08-15 to 2026-09-09 (4 rows)
- **Notes:** IsIncludeVAT is inconsistent (1 on row1, 0 on rows 2-4) — cannot generalize a VAT-inclusive rule from this data alone.

#### PurchaseInvoiceDtl

- **Role:** Purchase invoice line items — carries the PO link via SourceType/OrderNo/OrderTrNo
- **Key columns:** TransactionNo (FK→Hdr), ItemOrder, SourceType, OrderNo, OrderTrNo, PRNo, PRTrNo, ItemCode, MainQuantity, UnitPrice, Amount, AmountWithVAT
- **Status columns:** SourceType ('PO' or 'PC' — 2 distinct values seen)
- **Date range:** n/a (3 rows)
- **Notes:** Only 1 of 3 existing invoice lines is SourceType='PO' (linked to PO-L2608-0001, exact qty/price match verified: 400 units @ 1110 = 444000, matches PO total exactly). The other 2 are SourceType='PC' (petty cash), unrelated to any PO.

#### InventoryFlowHdr

- **Role:** Stock movement ledger — where PO goods receipt would ultimately show up, via invoice link only
- **Key columns:** TransactionNo (PK), VoucherNo, InOut, PurchaseInvoiceNo, PurchaseInvoiceTrNo, IsApproved, IsClosed, Status, PurchaseType
- **Status columns:** IsApproved, IsClosed, InOut (sign of movement)
- **Date range:** large table, 218 rows total; not scoped to PO domain specifically
- **Notes:** PurchaseType column is NULL on all 218 rows (not used for this doc-type tagging). Only 1 row has PurchaseInvoiceNo populated (VoucherNo='IPC-2608-0001', InOut=1, referencing invoice IM2608150001/TrNo 1 — the same invoice that links to PO-L2608-0001). Confirms the PO→receipt chain is PO → Invoice(SourceType=PO) → InventoryFlow(via PurchaseInvoiceNo), a 3-hop join, and that this chain has only ever completed once in the whole dataset.

#### Supplier

- **Role:** Supplier master (codes/metadata only — no names/contacts read per data-handling rules)
- **Key columns:** SupplierCode (PK), IsActive, Type, PreferredCurrency, PaymentTerm, PaymentInDays, CreditLimit
- **Status columns:** IsActive (all 477 = 1)
- **Date range:** n/a
- **Notes:** 477 rows, ALL IsActive=1 and ALL Type=1 — a single homogeneous value on both columns suggests this master data is a bulk import/legacy carry-over, not actively curated; only 2 SupplierCode values ever appear in real PO/PR transactions.

#### PurchaseType

- **Role:** Static PO-type lookup table
- **Key columns:** POType
- **Status columns:** (none)
- **Date range:** EntryDate 2002-2003 (legacy seed rows)
- **Notes:** 4 rows: INVENTORY / ASSET / BUILD / REPAIR. All live POs use PurchaseOrderHdr.PurchaseType='Local' (a different free-text field on the header, not a join to this lookup table) — this lookup table's relevance to the live PurchaseType value used on transactions is UNCONFIRMED (possible mismatch between this table's POType values and the header's actual PurchaseType strings).

#### tbl_PRAmend / tbl_PoAmend

- **Role:** Amendment/revision log for PR and PO
- **Key columns:** TransactionNo, Slno, AmendBy, AmendDate, AmendDesc
- **Status columns:** (none)
- **Date range:** 1 row (tbl_PRAmend), 0 rows (tbl_PoAmend)
- **Notes:** Effectively unused in this dataset (tbl_PoAmend is empty; tbl_PRAmend has 1 blank-AmendBy/AmendDesc row) — no revision-history signal available for the dashboard.

#### SupplierItemPrice / tbl_SupItem / tbl_SUPTYPE

- **Role:** Supplier-item price history / supplier-item link / supplier-type lookup
- **Key columns:** ItemCode, CustOrSuppCode, VoucherNo, VoucherTrNo, UnitPrice, Qty
- **Status columns:** (none)
- **Date range:** n/a
- **Notes:** tbl_SupItem has 0 rows, tbl_SUPTYPE has 0 rows — both unused. SupplierItemPrice has 10 rows (schema confirmed, not deeply queried — low priority given tiny PO volume).

### Metric recipes

**ยอดซื้อรวม (total purchase value)**

- Tested: yes
- Confidence: high
- SQL:

```sql
SELECT SUM(TotalAmount) AS total_purchase_value, COUNT(*) AS po_count FROM PurchaseOrderHdr WHERE IsCancel = 0 OR IsCancel IS NULL
```

- Result shape: single row: {total_purchase_value: 727920, po_count: 4}
- Caveats: Only 4 rows in the entire live dataset — result is not representative of steady-state volume. Decide whether 'total purchases' should be by PO value (committed spend) or by Invoice value (actually billed) — they can diverge once invoices don't 1:1 match POs (as seen: 2 of the 3 live invoices are SourceType='PC', unrelated to any PO).

**ยอดซื้อตามช่วงเวลา (purchases over time, monthly buckets)**

- Tested: yes
- Confidence: high
- SQL:

```sql
SELECT FORMAT(PODate, 'yyyy-MM') AS ym, SUM(TotalAmount) AS month_total, COUNT(*) AS po_count FROM PurchaseOrderHdr WHERE IsCancel = 0 OR IsCancel IS NULL GROUP BY FORMAT(PODate, 'yyyy-MM') ORDER BY ym
```

- Result shape: 2 rows: 2026-08 (3 POs, 662920), 2026-09 (1 PO, 65000)
- Caveats: Dates are stored as plain CE datetime (no Buddhist-era conversion needed at the DB level, unlike orderstock's own BE-display convention) — confirmed by direct read of PODate values (e.g. 2026-08-14). Only 2 calendar months of data exist; a trend chart will look sparse until more months accumulate.

**ยอดซื้อราย Supplier (purchases by supplier)**

- Tested: yes
- Confidence: high
- SQL:

```sql
SELECT SupplierCode, SUM(TotalAmount) AS supplier_total, COUNT(*) AS po_count FROM PurchaseOrderHdr WHERE IsCancel = 0 OR IsCancel IS NULL GROUP BY SupplierCode ORDER BY supplier_total DESC
```

- Result shape: 2 rows: ช-001 (3 POs, 635000), ว-001 (1 PO, 92920)
- Caveats: Group by SupplierCode only (never SupplierName, per data-handling rules — join to Supplier master only for a display label if the dashboard UI needs it, and even then prefer showing the code). Only 2 suppliers exist in live data; cannot validate a 'top N suppliers' widget shape yet.

**PO Status distribution**

- Tested: yes
- Confidence: low
- SQL:

```sql
SELECT CASE WHEN IsCancel = 1 THEN 'Cancelled' WHEN IsComplete = 1 THEN 'Completed' WHEN IsRecPo = 1 THEN 'Received' WHEN IsApproved = 1 THEN 'Approved' ELSE 'Pending' END AS derived_status, COUNT(*) AS cnt FROM PurchaseOrderHdr GROUP BY CASE WHEN IsCancel = 1 THEN 'Cancelled' WHEN IsComplete = 1 THEN 'Completed' WHEN IsRecPo = 1 THEN 'Received' WHEN IsApproved = 1 THEN 'Approved' ELSE 'Pending' END
```

- Result shape: 1 row: {derived_status: 'Approved', cnt: 4} — all 4 rows fall into the same bucket (IsApproved=1, everything else 0/NULL)
- Caveats: This derivation rule is INFERENCE, not verified against ERP source code or docs — the Status column itself is free text ('Pending' literal) and does NOT match this flag-derived label ('Approved'), which is itself a contradiction worth flagging to the customer/KRS before shipping a status widget. Confidence in the exact precedence order (Cancelled > Completed > Received > Approved > Pending) is LOW — it was not sourced from any ERP business-logic artifact, only guessed from column names. Recommend confirming the real status state machine with KRS (same company that built both this ERP and orderstock) rather than shipping this guess.

**Filter / Drill-down: supplier → PO list → PO lines**

- Tested: yes
- Confidence: high
- SQL:

```sql
SELECT h.TransactionNo, h.PONumber, h.PODate, h.TotalAmount, d.Number, d.ItemCode, d.MainQuantity, d.MainUnitPrice, d.TotalPrice FROM PurchaseOrderHdr h JOIN PurchaseOrderDtl d ON d.TransactionNo = h.TransactionNo WHERE h.SupplierCode = @supplierCode ORDER BY h.PODate, d.Number
```

- Result shape: verified join works: PO-L2608-0002 correctly returns 4 line rows (all ItemCode 1010005, 100 units @ 315 each)
- Caveats: Straightforward 1:N join on TransactionNo, no surprises. Safe to use as-is for drill-down.

**PR→PO link (for a future 'requisition to order' drill-down)**

- Tested: yes
- Confidence: medium
- SQL:

```sql
SELECT pr.PRNo, pr.PRDate, prd.ItemCode, prd.Quantity AS pr_qty, prd.PONo, prd.POTrNo, prd.POQty FROM PurchaseRequisitionDtl prd JOIN PurchaseRequisitionHdr pr ON pr.TransactionNo = prd.TransactionNo WHERE prd.PONo IS NOT NULL AND prd.PONo <> ''
```

- Result shape: 6 rows, all resolving to real PurchaseOrderHdr rows (PR-2608-0001→PO-L2608-0002, PR-2608-0002→PO-L2608-0003)
- Caveats: POQty on the PR line can exceed the PR's own Quantity (e.g. PR line Quantity=100 but POQty=200 on the first row) — this is because one PR detail row can map to a PO that also covers other PR lines' quantities; do not assume a strict 1:1 qty match between PR line and PO line.

**Goods received against PO (attempted 3-hop derivation)**

- Tested: yes
- Confidence: low
- SQL:

```sql
SELECT po.PONumber, invd.MainQuantity AS invoiced_qty, iv.VoucherNo AS invoice_no, ifh.VoucherNo AS receipt_voucher, ifh.InOut FROM PurchaseOrderHdr po JOIN PurchaseInvoiceDtl invd ON invd.OrderNo = po.PONumber AND invd.OrderTrNo = po.TransactionNo AND invd.SourceType = 'PO' JOIN PurchaseInvoiceHdr iv ON iv.TransactionNo = invd.TransactionNo LEFT JOIN InventoryFlowHdr ifh ON ifh.PurchaseInvoiceNo = iv.VoucherNo AND ifh.PurchaseInvoiceTrNo = iv.TransactionNo
```

- Result shape: 1 row: PO-L2608-0001, invoiced_qty 400, invoice_no IM2608150001, receipt_voucher IPC-2608-0001, InOut 1
- Caveats: This is the ONLY PO in the whole dataset that has completed the full PO→Invoice→Receipt chain (3 of 4 POs have zero linked invoices at all, and PurchaseOrderDtl.QtyReceive is never populated directly). A 'received vs ordered' widget CANNOT be built reliably on 4 data points — this recipe is proof-of-concept only, not production-validated at scale. Recommend treating 'received' as a known-gap for the dashboard until more real transactions accumulate, or confirming with KRS whether QtyReceive is meant to be populated by a process not yet exercised in this dataset.

### Verified facts

- PurchaseOrderHdr has exactly 4 rows; PODate range 2026-08-14 to 2026-09-11 (verified by direct SELECT).
- All 4 PO rows: Currency='THB', ExchangeRate=1, VatType=3, VATPercent=0, VATAmount=0 — so Total=SubTotal=TotalAmount identically on every live row (verified by direct SELECT).
- All 4 PO rows: IsApproved=1; 3 of 4 have IsCheck=1 (PO #4 has IsCheck=0); all have IsComplete=0, IsCancel=0, IsRecPo=0, Revised=0, IsClosed=NULL; Status is the literal string 'Pending' on all 4 (verified by direct SELECT).
- Only 2 distinct SupplierCode values ('ช-001', 'ว-001') appear across all 4 POs (verified via COUNT DISTINCT and row listing).
- PurchaseOrderDtl has 10 rows; QtyReceive and InvoiceQty are NULL on every single row (verified by direct SELECT of all 10 rows).
- PurchaseRequisitionDtl.PONo/POTrNo correctly cross-reference real PurchaseOrderHdr rows for both existing PRs (verified: PR-2608-0001→PO-L2608-0002 TransactionNo 2, PR-2608-0002→PO-L2608-0003 TransactionNo 3).
- PurchaseInvoiceDtl has exactly 3 rows; only 1 has SourceType='PO' (linking to PO-L2608-0001 via OrderNo/OrderTrNo, with exact qty/amount match: 400 units × 1110 = 444000, matching the PO's Total exactly); the other 2 have SourceType='PC' with no PO link (verified by direct SELECT).
- InventoryFlowHdr.PurchaseType is NULL on all 218 rows (verified via GROUP BY); only 1 of 218 rows has a non-blank PurchaseInvoiceNo, and that row (VoucherNo='IPC-2608-0001', InOut=1) links to the same invoice (IM2608150001) that links to PO-L2608-0001 — confirming a working but only-once-exercised PO→Invoice→Receipt chain (verified by direct SELECT and manual chain-following).
- Supplier table has 477 rows, all IsActive=1 and all Type=1 (verified via GROUP BY — no variance in either column across the whole table).
- PurchaseType lookup table (POType) has exactly 4 rows (INVENTORY/ASSET/BUILD/REPAIR) with EntryDate in 2002-2003, i.e. legacy seed data (verified by direct SELECT); it is a DIFFERENT field from PurchaseOrderHdr.PurchaseType, which is the free-text value 'Local' on all 4 live PO rows (verified — no observed join between the two).
- tbl_SupItem (0 rows), tbl_SUPTYPE (0 rows), and tbl_PoAmend (0 rows) are all empty in this dataset; tbl_PRAmend has exactly 1 row with blank AmendBy/AmendDesc (verified by direct SELECT/COUNT).

### Inferences

- The PO module appears to be brand-new / in pilot rollout as of research date (18-Sep-2026) — the entire live PurchaseOrderHdr dataset spans only ~4 weeks ending 1 week before today, with just 4 orders, 2 suppliers, and only 1 order that has progressed through invoice + inventory receipt. This is an inference from the observed date range and row counts, not a stated fact from KRS or the customer.
- 'PO Status' as required by the customer likely needs to be a DERIVED status computed from the flag columns (IsApproved/IsCheck/IsComplete/IsCancel/IsRecPo), not read directly off the Status free-text column, because Status shows the same literal 'Pending' string on all 4 rows regardless of their differing IsCheck values — inferring that Status is either not actively maintained by the ERP UI for this transaction type, or is only updated at specific workflow steps not yet reached by any live row.
- The 3-hop join (PO → PurchaseInvoiceDtl SourceType='PO' → InventoryFlowHdr via PurchaseInvoiceNo) is inferred to be the correct path to 'goods received against PO' based on the one working example found; this pattern was not cross-checked against the sibling KRS project's documented InventoryFlowHdr conventions (Approved=1/IsClosed<>1 filter, WHRM/WHFG/WHWIP warehouse codes) which were referenced as prior knowledge but not re-verified in this session — worth reading /Users/innovera/Documents/TCL/docs/erp-tcl-findings.md in a follow-up pass specifically for the goods-receipt convention, since that file is outside the scratchpad sandbox and wasn't read this session.
- Given only 4 PO rows exist, any dashboard chart type choice (bar vs line vs table) should default to a simple table/list view for 'PO Status' and 'PO by supplier' until real volume accumulates — a rich chart widget would be over-engineering for the current data reality.

### Unknowns

- No confirmed business-logic source (stored proc, ERP app code, or KRS documentation) was read for the true PO status state machine — the 'derived_status' recipe above is an unverified INFERENCE from column names, not a confirmed rule. OBJECT_DEFINITION() on relevant stored procedures was not explored in this pass — a follow-up query against sys.procedures filtered by name LIKE '%Purchase%' or '%PO%' could surface the actual status-transition logic and should be run before finalizing the PO Status widget.
- Whether PurchaseOrderHdr.PurchaseType ('Local') is meant to relate to the PurchaseType lookup table's POType values (INVENTORY/ASSET/BUILD/REPAIR) is unconfirmed — no matching values were observed and no FK constraint was checked between them.
- Whether QtyReceive/InvoiceQty on PurchaseOrderDtl are populated by some process that simply hasn't fired yet in this small dataset, or whether the ERP UI/workflow never writes them at all (making the InventoryFlow-join the only real signal), was not confirmed via sys.procedures / trigger inspection.
- VAT-inclusive vs exclusive arithmetic could not be tested meaningfully because every live PO has VATPercent=0/VATAmount=0 — the customer's real invoicing does show IsIncludeVAT=1 on one PurchaseInvoiceHdr row, but the underlying amount math for that case (whether TotalAmount already includes VAT or not) was not independently verified via arithmetic decomposition, since VATAmount was 0 there too.
- tbl_PoAmend/tbl_PRAmend/tbl_SupItem/tbl_SUPTYPE are effectively empty and their intended purpose (amendment audit trail, supplier-item linking) is inferred from naming only, not confirmed via schema comments or app code.
- No sys.foreign_keys check was run to confirm formal FK constraints exist between PurchaseOrderHdr/Dtl, PurchaseRequisitionHdr/Dtl, and PurchaseInvoiceHdr/Dtl — all joins above are confirmed empirically (via matching live row values) but not via schema-level FK metadata.
- SupplierItemPrice (10 rows) and tbl_SupItem (0 rows) were not deeply explored beyond column listing, given the tiny transactional volume makes them low-priority for the PO dashboard's first cut.

### Questions for KRS / customer

- What is the intended state machine for PO status — is the free-text 'Status' column authoritative, or should the dashboard derive status from the IsApproved/IsCheck/IsComplete/IsCancel/IsRecPo flags? If flags, what is the correct precedence order?
- Is 'goods received against a PO' expected to ever populate PurchaseOrderDtl.QtyReceive/InvoiceQty directly, or is the InventoryFlowHdr-via-PurchaseInvoiceNo join (as observed once in the live data) the intended/only path to compute received quantity?
- Does PurchaseOrderHdr.PurchaseType (free text, e.g. 'Local') relate to the separate PurchaseType lookup table's POType values (INVENTORY/ASSET/BUILD/REPAIR), or are these two unrelated fields that happen to share a similar name?
- Is the PO module considered live/production-ready for dashboard purposes, or still in pilot — should the dashboard's initial release account for near-zero historical data, and is there a target go-live date after which volume is expected to grow?
- For VAT reporting on the Purchase Dashboard, should amounts always be treated as VAT-exclusive by default given VatType=3/VATPercent=0 on all live rows so far, or should the dashboard branch its arithmetic based on IsIncludeVAT per-row once non-zero-VAT transactions appear?
- Should the Purchase Dashboard's 'ยอดซื้อรวม/ยอดซื้อตามช่วงเวลา' be computed from PurchaseOrderHdr.TotalAmount (committed order value) or PurchaseInvoiceHdr.TotalAmount (actually billed value) — given that 2 of the 3 live invoices are unrelated petty-cash purchases (SourceType='PC') with no PO link at all, these two bases will diverge significantly and the customer's intended KPI needs to be confirmed.

---

## Domain: sales

**Sales dashboard research (SO/DO/Invoice basis) for db_TCL, in support of a planned "ยอดขาย" (Sales) dashboard alongside Purchase and Production dashboards**

### Summary

TL;DR: The formal SalesOrder/SalesInvoice module exists but is nearly empty and not the real transaction stream. The actual "sales" activity in db_TCL currently lives in two places — `tbl_DOhdr`/`tbl_Dodtl` (delivery orders, qty-only, almost never priced, never SO-linked) and `InventoryFlowHdr`/`InventoryFlowDtl` rows tagged `ReasonName = 'การขาย: เบิกออกสินค้าเพื่อขาย'` (สินค้าออกเพื่อขาย, stock-withdrawal-for-sale, no header customer/amount total in the sample seen). All of this data is from a ~5-week pilot window (14 Aug – 18 Sep 2026). Also discovered: a currently-empty ERP table `tbl_OrderHdr`/`tbl_OrderDtl` whose columns are a near-exact mirror of the orderstock paper order form (DNim/DLanNim1/DLan1/Gravel/FishSauce/Sugar/TotalKg/TotalPail/Location) — strongly suggests a planned or half-built ERP-side landing table for the same daily-order data orderstock already digitizes, created around the same time (July 2026) as orderstock's Phase 1. Zero exact-name overlap currently exists between orderstock's own Shop/Product tables and the ERP's Customer/InventoryItem tables.

### Data reality

Confirmed live-but-early-stage pilot data. Every transactional table with real Sales-domain rows (SalesOrderHdr=1, SalesInvoiceHdr=3, tbl_DOhdr=73, InventoryFlowHdr sales-reason rows=157) is dated 14-Aug-2026 through 18-Sep-2026 (roughly 5 weeks) — this looks like the pilot/go-live window, not years of history. The formal Sales module (SalesOrderHdr/Dtl, SalesInvoiceHdr/Dtl, QuotationHdr/Dtl) is present with full schema (118/151/260 columns respectively) but is barely used — 1 SO row (all amounts 0), 3 invoice rows (2 of the 3 look like manual/adjustment entries with VoucherNo prefix "EX..." not a real sales-invoice numbering series), 0 QuotationHdr rows. By contrast `tbl_DOhdr`/`tbl_Dodtl` (delivery orders) has real, growing volume (73/1433, roughly 35-40 docs/month) and `InventoryFlowHdr` stock-movement rows tagged with ReasonName='การขาย: เบิกออกสินค้าเพื่อขาย' (sales withdrawal) are the largest sales-adjacent signal (157 header-linked detail lines across Aug+Sep, ~1300+ qty/month). Zero DO lines reference a SalesOrder (`SoNo` always blank in tbl_Dodtl), and only 13 of 1433 DO lines (0.9%) carry a non-zero price/Amount. A separate, EMPTY table `tbl_OrderHdr`/`tbl_OrderDtl` (modified July 2026) has columns that are an almost line-for-line mirror of the orderstock paper form (DNim/DLanNim1/DLanNim1_2/DLan1/DLan1_2/Gravel/GravelYellow/FishSauce/Sugar/TotalKg/TotalPail/Location) — this table exists in the ERP but has never been populated. No name-level overlap exists yet between orderstock's Shop/Product/ProductVariant tables and the ERP's Customer/InventoryItem tables (0 matches on exact name join in both directions) — the two systems are currently fully disjoint data silos.

### Tables

#### SalesOrderHdr / SalesOrderDtl

- **Role:** Formal Sales Order header/lines — TransactionNo PK, 118+ cols on Hdr
- **Row count:** 1
- **Key columns:** TransactionNo, OrderNo, SoStatus, Status, IsClosed, IsCancel, IsApprSo, IsComplete, CustomerCode, TotalAmount, TotalActualAmount, VATAmount, DiscountAmount, IncludeVat, SalesInvoiceNo/TrNo/Date
- **Status columns:** IsClosed, IsCancel, IsApprSo, IsComplete, IsCheck, SoStatus, Status
- **Date range:** 1 row only, OrderDate 2026-09-08
- **Notes:** Only 1 row exists, all monetary fields are 0 — this table is effectively unused. SalesInvoiceNo link field exists but is null for the one row.

#### SalesInvoiceHdr / SalesInvoiceDtl

- **Role:** Formal Sales Invoice header/lines — TransactionNo PK, 151+64 cols
- **Row count:** 3
- **Key columns:** TransactionNo, VoucherNo, DocuType, InvoiceType, SaleType, VoucherDate, IsVAT, IsClosed, IsPaid, IsApproved, CustOrSuppCode, SoNo, TotalAmount, SubTotalAmnt, VATAmount, VATForValue, DiscountAmount, AmountDue, BranchCode, IVStatus
- **Status columns:** IsClosed, IsPaid, IsApproved, IVStatus (all null)
- **Date range:** 3 rows: 2026-08-14, 2026-08-15, 2026-09-17
- **Notes:** Only 3 rows. DocuType='SI' for all. VoucherNo prefix is 'EX...' (looks like a manual/expense-style voucher series, not a dedicated sales-invoice numbering series). SoNo is null on all 3 (no SO linkage observed). VAT columns are 0 on 2 of 3 rows despite IsVAT=3 — VAT semantics unconfirmed/inconsistent in this tiny sample.

#### tbl_DOhdr / tbl_Dodtl

- **Role:** Delivery Order header/lines — the highest-volume sales-adjacent document
- **Row count:** 73
- **Key columns:** TransactionNo, DoNo, Dodate, CustCode, CustName, IsApproved, IsClosed, IsComplete, TotalAmount, VATAmount, SalesInvoiceNo/TrNo/Date, DueDate
- **Status columns:** IsApproved, IsClosed, IsComplete, IsCheck, IsAcc
- **Date range:** 2026-08-14 to 2026-09-17
- **Notes:** DoNo prefix is 'DO-2...' (one consistent series, ~35-39 docs/month). Only 3 of 73 DO headers have a non-null SalesInvoiceNo (i.e. only ~4% get invoiced). tbl_Dodtl (1433 lines) has SoNo column but it is NULL on every single row (0/1433) — DOs are never SO-sourced in practice. Only 13 of 1433 lines (0.9%) carry non-zero Amount/Saleprice — DO in this dataset is a qty/logistics document, not a priced sales document.

#### InventoryFlowHdr / InventoryFlowDtl

- **Role:** Generic stock-movement ledger; the 'sale withdrawal' reason code is the closest thing to a real sales-quantity feed
- **Row count:** 218
- **Key columns:** TransactionNo, VoucherNo, TransactionType, InOut, Approved, IsClosed, InOutDate, ReasonName, Warehouse, CustOrSupCode, CustOrSupName, NetValue, GoodsValue, VATAmount, TotalAmount, SalesInvoiceNo/TrNo/Date
- **Status columns:** Approved, IsClosed, IsCheck, IsApproved, Status(text, unused in sample)
- **Date range:** 2026-08-14 to 2026-09-18
- **Notes:** All 218 header rows are TransactionType=1. InOut=1 (in, 122 rows, sum TotalAmount=714,390) vs InOut=-1 (out, 96 rows, TotalAmount is NULL on outbound rows in this sample — no header-level amount for sales withdrawals). ReasonName breakdown: 'ปรับปรุงสต๊อคเข้า' (86, stock-adjust-in), 'การขาย: เบิกออกสินค้าเพื่อขาย' (71, SALES withdrawal — InOut=-1), 'รับเข้าจากการซื้อ' (35, purchase-receipt), 'ปรับปรุงสต๊อคออก' (24, stock-adjust-out), 1 MO raw-material issue, 1 opening balance. The Hdr/Dtl join on BOTH TransactionNo AND VoucherNo (per prior TCL docs) returns 1366 detail lines for the sales-withdrawal reason across Aug (726 lines/80,183 qty) + Sep (640 lines/88,865 qty) — this is the biggest real 'goods went out for sale' signal in the DB, larger than DO or SO row counts, but it has no customer-level or amount total surfaced at header level in the columns queried.

#### tbl_OrderHdr / tbl_OrderDtl

- **Role:** UNUSED table whose column shape mirrors orderstock's own daily order sheet
- **Row count:** 0
- **Key columns:** TransactionNo, DocNo, DocDate, Location, DNim, DLanNim1, DLanNim1_2, DLan1, DLan1_2, Gravel, GravelYellow, FishSauce, Sugar, TotalKg, TotalPail
- **Status columns:** (none)
- **Date range:** n/a — 0 rows, table last modified July 2026
- **Notes:** Column names read as Thai product/ingredient names romanized (ตีนิ่ม→DNim, ตีลานนิ่ม→DLanNim1/1_2 for 1kg/0.5kg pack sizes, ตีลาน→DLan1/1_2, กรวด→Gravel, น้ำปลา→FishSauce, น้ำตาล→Sugar) plus Location and TotalPail (ปี๊บ) — the exact vocabulary and structure of the paper form orderstock digitizes. 0 rows and 'modified Jul 2026' timing overlaps orderstock Phase 1 (delivered 07-07-26). Not confirmed who built it or why; flagged as an open question, not a verified integration point.

#### Customer / InventoryItem

- **Role:** Master data for customers and inventory items (schema/metadata only queried per data-handling rules)
- **Row count:** 1469
- **Key columns:** CustomerCode/CustomerName (metadata only), ItemCode/ItemName (metadata only)
- **Status columns:** (none)
- **Date range:** n/a
- **Notes:** 1469 Customer rows, 558 InventoryItem rows (per tables.json). Exact-string-match join against orderstock's Shop.name and Product/ProductVariant.name returns 0 rows in both directions — the two systems currently share zero identifiable master-data overlap.

### Metric recipes

**ยอดขายรวม / ยอดขายรายเดือน-ปี (total & monthly/yearly sales) — candidate basis 1: SalesInvoiceHdr**

- Tested: yes
- Confidence: low
- SQL:

```sql
SELECT DATEPART(year,VoucherDate) yr, DATEPART(month,VoucherDate) mo, COUNT(*) n, SUM(TotalAmount) totalAmt, SUM(AmountDue) amountDue FROM SalesInvoiceHdr WHERE DocuType='SI' GROUP BY DATEPART(year,VoucherDate), DATEPART(month,VoucherDate) ORDER BY yr, mo
```

- Result shape: 3 rows (all in one Aug/Sep 2026 bucket set), TotalAmount sums to 858,937.21 across the 3 invoices
- Caveats: Only 3 rows exist total — statistically meaningless as a monthly trend right now. VoucherNo series ('EX...') suggests these may not even be the canonical sales-invoice numbering series used elsewhere in the business (could be manual/adjustment entries). Do NOT present this as the dashboard's primary basis without customer confirmation that this table is where real sales get recorded going forward.

**ยอดขายรวม / รายเดือน — candidate basis 2: tbl_DOhdr (delivery orders)**

- Tested: yes
- Confidence: medium
- SQL:

```sql
SELECT DATEPART(year,Dodate) yr, DATEPART(month,Dodate) mo, COUNT(*) n, SUM(TotalAmount) totalAmt FROM tbl_DOhdr GROUP BY DATEPART(year,Dodate), DATEPART(month,Dodate) ORDER BY yr, mo
```

- Result shape: 2 rows: Aug 2026 (39 docs), Sep 2026 (34 docs); combined TotalAmount sum = 234,403
- Caveats: DO header TotalAmount is populated (234,403 across 73 docs) even though only 13/1433 DETAIL lines carry a price — meaning DO header totals are likely computed/entered separately from line-level pricing, or most value sits in a small number of priced lines. Only ~4% of DOs (3/73) are later invoiced. Whether 'DO issued' should count as 'sold' (goods shipped) vs waiting for invoice is a business-definition question, not a data question.

**ยอดขายรวม / รายเดือน — candidate basis 3: InventoryFlowHdr/Dtl sales-withdrawal reason (largest volume signal)**

- Tested: yes
- Confidence: medium
- SQL:

```sql
SELECT DATEPART(year,d.InOutDate) yr, DATEPART(month,d.InOutDate) mo, COUNT(*) n, SUM(dt.MainQuantity) qty FROM InventoryFlowHdr d JOIN InventoryFlowDtl dt ON dt.TransactionNo=d.TransactionNo AND dt.VoucherNo=d.VoucherNo WHERE d.ReasonName=N'การขาย: เบิกออกสินค้าเพื่อขาย' GROUP BY DATEPART(year,d.InOutDate), DATEPART(month,d.InOutDate)
```

- Result shape: 2 rows: Aug 2026 (726 lines, 80,183 qty), Sep 2026 (640 lines, 88,865 qty, partial month to the 18th)
- Caveats: This is a QUANTITY signal only from the columns queried (no amount/value total was surfaced at header or detail level for this reason code in the columns checked) — would need InventoryFlowDtl's own Amount/UnitPrice-equivalent columns (not yet queried) to turn this into a ฿ sales figure. This reason code is the most active 'goods left the warehouse for sale' signal in the whole DB by row count, ahead of both SO and DO.

**SO Status distribution (Status SO)**

- Tested: no
- Confidence: low
- SQL:

```sql
SELECT SoStatus, Status, IsClosed, IsCancel, IsApprSo, IsComplete, COUNT(*) n FROM SalesOrderHdr GROUP BY SoStatus, Status, IsClosed, IsCancel, IsApprSo, IsComplete
```

- Result shape: Not run as a GROUP BY — the single existing row was already inspected directly: SoStatus=NULL, Status=NULL, IsClosed=0, IsCancel=0, IsApprSo=1, IsComplete=0
- Caveats: With only 1 SO row, a status DISTRIBUTION query is not meaningful yet. Both SoStatus and Status text columns are unpopulated (NULL) on the only row that exists — status is currently tracked only via the boolean Is* flags, not the free-text status columns. Confirm with customer whether SoStatus/Status get populated once real SO volume starts, or whether status is ALWAYS derived from the Is* flags.

**Product / Category linkage for sales lines**

- Tested: no
- Confidence: low
- SQL:

```sql
-- not yet run: SELECT ii.ItemType, tc.CategoryName, COUNT(*) FROM tbl_Dodtl d JOIN InventoryItem ii ON ii.ItemCode=d.Itemcode LEFT JOIN tbl_ItemGroup ig ON ... LEFT JOIN tbl_CATEGORY tc ON ... GROUP BY ...
```

- Result shape: n/a — not executed this session
- Caveats: tbl_ItemGroup and tbl_CATEGORY tables were confirmed to EXIST (via sys.tables) but their column shapes and the actual FK path from InventoryItem to them were not queried this session due to budget. This is a concrete next step, not a dead end.

**Customer linkage / drill-down chain (customer → document → lines)**

- Tested: no
- Confidence: medium
- SQL:

```sql
-- schema confirmed only; e.g. SELECT CustCode, COUNT(DISTINCT TransactionNo) docs, SUM(TotalAmount) amt FROM tbl_DOhdr GROUP BY CustCode
```

- Result shape: n/a — not executed; CustCode/CustName columns exist on tbl_DOhdr, CustomerCode/CustomerName exist on SalesOrderHdr, CustOrSuppCode/Name on SalesInvoiceHdr, CustOrSupCode/Name on InventoryFlowHdr
- Caveats: Per data-handling rules, drill-down should report by CODE not name in the dashboard design; codes are present on every document header table checked. Not run this session to respect the no-names/keep-load-light constraints, but the join path is straightforward once codes are chosen as the grouping key.

### Verified facts

- SalesOrderHdr has exactly 1 row (empty pilot data, all monetary fields 0) — verified via direct SELECT.
- SalesInvoiceHdr has exactly 3 rows, dated 2026-08-14 / 2026-08-15 / 2026-09-17, VoucherNo prefix 'EX...', DocuType='SI' for all 3 — verified via direct SELECT.
- tbl_DOhdr has 73 rows, DoNo prefix 'DO-2...', date range 2026-08-14 to 2026-09-17, only 3/73 have a non-null SalesInvoiceNo — verified via GROUP BY query.
- tbl_Dodtl (1433 rows): SoNo is NULL on ALL rows (0 non-null) — verified via COUNT(CASE WHEN SoNo IS NOT NULL...) aggregate.
- tbl_Dodtl: only 13 of 1433 rows have non-zero Amount, and only 13 have non-zero Saleprice — verified via aggregate COUNT.
- InventoryFlowHdr has 218 rows, all TransactionType=1; InOut=1 (122 rows, SUM(TotalAmount)=714,390) vs InOut=-1 (96 rows, SUM(TotalAmount) is NULL) — verified via GROUP BY aggregate.
- InventoryFlowHdr ReasonName distribution verified via GROUP BY: 'ปรับปรุงสต๊อคเข้า' 86, 'การขาย: เบิกออกสินค้าเพื่อขาย' 71 (InOut=-1), 'รับเข้าจากการซื้อ' 35, 'ปรับปรุงสต๊อคออก' 24, plus 2 single-row reasons.
- InventoryFlowHdr/Dtl joined on TransactionNo AND VoucherNo for the sales-withdrawal reason returns 1366 lines total: 726 in Aug 2026 (qty sum 80,183) and 640 in Sep 2026 through the 18th (qty sum 88,865) — verified via executed JOIN+GROUP BY query.
- tbl_OrderHdr and tbl_OrderDtl both have 0 rows and last-modified date July 2026 (per tables.json) — verified via tables.json inspection; their column names (DNim, DLanNim1, DLanNim1_2, DLan1, DLan1_2, Gravel, GravelYellow, FishSauce, Sugar, TotalKg, TotalPail, Location) were confirmed via sys.columns query.
- tbl_ItemGroup, tbl_CATEGORY, and SalesZone tables all exist in the schema — verified via sys.tables name search.
- Exact-string-name join between orderstock.Shop and ERP.Customer, and between orderstock.Product/ProductVariant and ERP.InventoryItem, both return 0 matches — verified via direct COUNT/JOIN query.

### Inferences

_(none)_

### Unknowns

- Whether the 'real' sales-tracking process going forward will be entered via the formal SalesOrder/SalesInvoice module (currently near-empty) or continue to be captured via tbl_DOhdr + InventoryFlowHdr's sales-withdrawal reason code — this is a business-process question for KRS/the customer, not resolvable from data alone.
- How ฿ value is assigned to the InventoryFlowHdr sales-withdrawal (InOut=-1) rows, since TotalAmount is NULL at header level on those rows in the sample queried — the detail table's own Amount/price-equivalent columns were not queried this session.
- The purpose of the empty tbl_OrderHdr/tbl_OrderDtl table (July 2026, mirrors orderstock's own paper-form columns) — unknown whether this is a planned ERP-side companion feature, a leftover prototype, or coincidental naming. Not confirmed with KRS.
- VAT arithmetic consistency (Amount = Net - Discount + VAT or similar) could not be meaningfully checked — the only populated rows have VATAmount=0 despite IsVAT/VatType flags being set, and sample size (1 SO row, 3 Invoice rows) is too small for a real consistency check.
- The FK/join path from InventoryItem/tbl_Dodtl.Itemcode to tbl_ItemGroup / tbl_CATEGORY (for product/category dashboard grouping) was not traced this session — tables exist but their columns and the join keys were not queried.
- Whether SalesZone is populated and linked to Customer for territory-based sales breakdowns was not queried this session.
- Whether more historical Sales data exists outside the Aug–Sep 2026 window observed (e.g. a prior system migration cutover date) was not directly confirmed — the uniform 14-Aug-2026 start date across SalesInvoiceHdr, tbl_DOhdr, and InventoryFlowHdr strongly suggests this IS the true go-live date for this module, but that inference was not cross-checked against an AccountPeriod or company-setup table this session.

### Questions for KRS / customer

- Should the Sales dashboard be based on SalesOrder/SalesInvoice (formal module, currently near-empty), on tbl_DOhdr (delivery orders — highest current real volume), or on InventoryFlowHdr's 'sales withdrawal' reason code (highest line-item volume, but no direct customer/amount total observed at header level)? These currently disagree on what 'a sale' even is.
- Is 14-Aug-2026 the actual go-live date for order/sales tracking in this ERP module, or is there older sales history stored somewhere else (a legacy system, a different table, or an earlier compatibility-level database) that should also feed the dashboard?
- What is the intended relationship (if any) between the newly-discovered empty tbl_OrderHdr/tbl_OrderDtl table and orderstock's own daily order sheet — was this built as a planned ERP-side sync target, and should it be revisited before building a separate Sales dashboard data pipeline?
- Should ยอดขาย be counted at the point goods physically leave the warehouse (DO issued / InventoryFlow sales-withdrawal), at the point an invoice is raised (SalesInvoiceHdr), or only once payment is confirmed (IsPaid)? Only ~4% of DOs currently get an invoice — the dashboard's 'sales total' will look very different depending on this choice.
- Is the VoucherNo prefix 'EX...' on the 3 existing SalesInvoiceHdr rows the canonical sales-invoice numbering series, or are these manual/adjustment entries that should be excluded from a sales dashboard?

---

## Domain: production

**Production planning (Manufacturing Order / Batch / MPS / BOM) in the shared live ERP database db_TCL, in support of a "แผนการผลิต vs ยอดผลิตจริง" (planned vs actual production) dashboard requirement.**

### Summary

TL;DR: The production module in db_TCL has almost no real transactional data yet — it looks like a pilot switched on within the last month, not years of history. tbl_MoHdr (Manufacturing Orders) has only 3 rows, all created the same day (2026-09-08); tbl_BatchHdr has 2 rows, same day; tblMPSHdr (Master Production Schedule) has exactly 1 row, same day. The schema DOES have an explicit plan-vs-actual mechanism (tblMPSDtl's paired MPS./ACT. rows, and tbl_MoOperDtl's ProdQTY vs ActualQTY/CompleteQty), but every "actual" field observed is NULL or zero — nobody has ever recorded actual production output through these paths. The inventory movement ledger (InventoryFlowHdr/Dtl) has exactly one production-tagged transaction ever, and zero finished-goods-receipt-from-production movements. BOM master data (72 recipes, 578 raw-material lines, 201 operation-step lines) is populated but was bulk-entered in a single 14-second window by one admin on 2026-08-26 — a data-setup pass, not organic usage. Recommendation for the customer conversation: before designing "plan vs actual" charts, confirm which of the three candidate "actual quantity" fields (MPS ACT. row Qty / MO operation ActualQTY-CompleteQty / a future WHFG-receipt movement type) the ERP operators will actually be trained to fill in going forward, because none of them currently has any real data to visualize.

### Data reality

The ERP's production module (MO/Batch/MPS/BOM) is real but essentially UNUSED in production — it looks like a fresh pilot/setup, not organic history. Evidence: (1) all 3 tbl_MoHdr rows and both tbl_BatchHdr rows and the sole tblMPSHdr row were created/dated the SAME single day, 2026-09-08 (10 days before "today" 2026-09-18) — no MO history before or after that date; (2) the 72-row tblBomHDR (BOM master) was bulk-created in one ~14-second window on 2026-08-26 by a single ADMIN user — a one-time data-entry/import pass, not years of accumulated recipes; (3) tblMPSDtl's "ACT." (actual) rows, which are structurally paired 1:1 with each "MPS." (planned) row, are ALL zero/blank (Qty=0, Itemcode='') for all 18 planned lines — the plan-vs-actual field exists in the schema but has never once been filled in; (4) tbl_MoOperDtl.ActualQTY/AccuQTY/CompleteQty/DeffecQTY (the per-operation actual-output columns) are NULL for every one of the 8 rows that exist; (5) InventoryFlowHdr/Dtl (the movement ledger) contains exactly ONE production-tagged movement ever ("เบิกวัตถุดิบ : ใบสั่งผลิต" / raw-material-issue-for-MO, warehouse WHRM), also dated 2026-09-08, and there is NO finished-goods-receipt-from-production movement type present anywhere in the ledger at all (only ปรับปรุงสต๊อคเข้า/ออก, การขาย, รับเข้าจากการซื้อ, สินค้าคงเหลือยกมา — none of these are FG-from-production). Tables that ARE structurally rich but transactionally empty: tblJobtrans_HDR/DTL/NG (0 rows each), QCProduceHdr/Dtl (0 rows), tbl_MoOutDtl (0 rows), tblMPHdr/Book/Amend (0 rows). Conclusion: if the dashboard needs real historical plan-vs-actual production data today, there is effectively none — the module was just switched on as a pilot in the last ~1 month (BOM setup 26-08, MO/Batch/MPS test 08-09). The most plausible eventual source of "actual produced" once real usage starts is either (a) tblMPSDtl's paired ACT. row Qty column (if the customer's ERP operators start filling it in), or (b) a future FG-receipt-into-WHFG movement type in InventoryFlowHdr/Dtl once production actually posts stock in (not observed yet), or (c) tbl_MoOperDtl.ActualQTY/CompleteQty per operation step (also unused so far). None of these can be trusted as-is; all three need the customer to confirm intended data-entry workflow before a dashboard is built against them.

### Tables

#### tbl_MoHdr

- **Role:** Manufacturing Order header — plan header with LotQty (planned) and Prodqty (also populated at creation, same value as LotQty in observed rows — likely a released-qty copy, NOT a confirmed actual). Approved/IsClosed/IsCancel status flags. FgCode = finished-good item. MoDuedate = due date.
- **Row count:** 3
- **Key columns:** TransactionNo (PK-ish, joins to tbl_MoOperDtl/tbl_MoRmDtl), MoNumBer, Modate, MoDuedate, FgCode, LotQty, Regqty, Prodqty, Approved, IsClosed, IsCancel, SoNo
- **Status columns:** Approved, IsClosed, IsCancel
- **Date range:** 2026-09-08 to 2026-09-08 (single day, n=3)
- **Notes:** Only 3 rows total, ALL dated 2026-09-08 (Modate AND MoDuedate identical, i.e. same-day due date — looks like same-day test entries, not a real production lead time). Regqty is 0 in all 3 rows (unused). Prodqty equals LotQty for 2 of 3 rows and is a partial value (17) for the 3rd — ambiguous whether Prodqty here means 'planned to produce' or 'actually produced'; needs customer confirmation.

#### tbl_MoOperDtl

- **Role:** Per-operation-step detail of a MO — routing/operations with planned ProdQTY and actual-tracking columns ActualQTY/AccuQTY/CompleteQty/DeffecQTY, plus StartDate/EndDate.
- **Row count:** 8
- **Key columns:** TransactionNo (FK to tbl_MoHdr), OperNum, StepCode (maps to tblWorkCenter.WcCode), ProdQTY, ActualQTY, AccuQTY, CompleteQty, DeffecQTY, StartDate, EndDate
- **Status columns:** (none)
- **Date range:** 2026-09-08 (n=8, only 3 rows have dates at all)
- **Notes:** 8 rows for the 3 MOs (2-3 steps each). ActualQTY, AccuQTY, CompleteQty, DeffecQTY are NULL in every single row — the actual-output tracking mechanism at operation level has never been used. StartDate/EndDate are populated only for TransactionNo=1's 3 rows (all = 2026-09-08, same as start=end, i.e. instant/no real duration recorded).

#### tblMPSHdr

- **Role:** Master Production Schedule header — one per planning period/line/section, with approval/closed/complete workflow flags.
- **Row count:** 1
- **Key columns:** TransactionNo, MPSNo, MPSDate, Line, Section, MonthTH, YearTH, IsApproved, IsClosed, IsComplete
- **Status columns:** IsApproved, IsClosed, IsComplete, IsCheck, Revised
- **Date range:** 2026-09-08 (n=1)
- **Notes:** Exactly 1 row (MPS-2609-0001, dated 2026-09-08, month='กันยายน' year='2026'). IsApproved=1, IsClosed=0, IsComplete=0 — plan created and approved but never marked complete. Line/Section are both empty strings (not used to distinguish production lines here, despite 5 real work centers existing in tblWorkCenter).

#### tblMPSDtl

- **Role:** MPS line items — THE clearest schema-level plan-vs-actual mechanism found: each planned item line (PlanStatus='MPS.', with Itemcode/Itemname/Qty/Unit populated) is immediately followed by a paired 'actual' row (PlanStatus='ACT.', SortNo = prior row's SortNo+1) that is structurally meant to hold the realized quantity. Day1..Day31 + Total columns exist for daily-bucketed planned/actual quantities within the month.
- **Row count:** 18
- **Key columns:** TransactionNo (FK to tblMPSHdr), SortNo (ordering; MPS row then paired ACT row), SLNo (only set on MPS rows, null on ACT rows), Itemcode, Itemname, Qty, Unit, PlanStatus ('MPS.' or 'ACT.'), Day1..Day31, Total
- **Status columns:** PlanStatus
- **Date range:** linked to tblMPSHdr, 2026-09-08 only
- **Notes:** 18 rows = 9 items × 2 (MPS+ACT pair). Every ACT. row observed has Qty=0, Itemcode='', Itemname='', Total=NULL — i.e. the 'actual produced' half of this table has NEVER been populated for any item, ever, even though the table structure and workflow clearly anticipate it. Day1..Day31 are all NULL for every row (daily plan not used either, only the monthly Total on the MPS row).

#### tbl_BatchHdr / tbl_BatchOrder / tbl_BatchMRP / tbl_BatchLot / tbl_BatchMat

- **Role:** A sales-order-driven 'batch planning' cluster: BatchHdr = confirm/MRP-confirm workflow header; BatchOrder = per-FG-item plan vs produced (PlanQty, Prodqty) plus on-hand/reserve/should-produce fields, linked to the resulting MO (Monum); BatchMRP = per-raw-material period-balance projection (OpenBalQty/ReqQty/PJBalQty/ReleaseQty); BatchLot = per-SO-line batch requirement (customer/SO context, PlanQTY); BatchMat = per-raw-material shortage/should-buy calc (Onhand, ShouldBuy) for the batch.
- **Row count:** 26
- **Key columns:** BatchNo (joins all 5 tables), ItemCode / FgCode, PlanQty/Prodqty (BatchOrder), Monum (BatchOrder → tbl_MoHdr.MoNumBer), SoNo (BatchLot), OpenBalQty/ReqQty/PJBalQty/ReleaseQty (BatchMRP)
- **Status columns:** IsConfirm, IsConfirmMRP (BatchHdr), IsMPS (BatchOrder/BatchLot)
- **Date range:** 2026-09-08 only, n=2 (Hdr) / 3 (Order) / 20 (MRP) / 16 (Lot, cols) / 10 (Mat)
- **Notes:** BatchOrder.PlanQty == Prodqty in all 3 observed rows (17/2207/1352, exactly matching tbl_MoHdr.LotQty/Prodqty for the same 3 MOs) — again ambiguous: this may just be a released/committed-qty copy rather than a genuine 'actually produced' confirmation, since it was captured at MO-creation time, same day, no subsequent update visible. BatchMat.Useqty appears to be a COMPUTED requirement (BomQty × batch Prodqty, e.g. 500×2207=1,103,500) not an actual-consumption record.

#### tblBomHDR / tblBomRMDTL / tblBomOperDtl

- **Role:** Bill-of-Materials master data: recipe header (FGno, OutputItemCode, ProdQty = standard batch size), raw-material lines (578, planned BomQty ratios), operation/routing steps (201, mapped to tblWorkCenter via StepCode-equivalent).
- **Row count:** 72
- **Key columns:** TransactionNo/BomCode/FGno (Hdr), InputItem/BomQty (RMDTL), StepCode (OperDtl, maps to tblWorkCenter.WcCode)
- **Status columns:** isappr, isclosed (BomHDR)
- **Date range:** created 2026-08-26 (single day)
- **Notes:** 72 BOM headers ALL created/updated (lstupd) within one 14-second window on 2026-08-26 by a single Entryby='ADMIN' — a one-time bulk data-entry/import, not organically accumulated master data. This is real, usable recipe/routing structure (good for BOM-driven material-requirement or process-flow context in a dashboard) but should not be presented as 'years of validated production history.'

#### tblWorkCenter / tblMachine

- **Role:** Master data for 5 named work centers (WC01-WC05, e.g. 'ชั่ง ตวง ผสม', 'ต้มและเคี่ยว', 'บรรจุและตรวจสอบคุณภาพ') and 6 named machines (2 boilers, mixer, molding machine, packing machine, etc.) — usable as the 'by line / by work center' filter dimension for a production dashboard, even though transactional volume through them is near-zero.
- **Row count:** 11
- **Key columns:** WcCode/WcName (WorkCenter), McCode/McName (Machine)
- **Status columns:** (none)
- **Date range:** created 2026-08-20
- **Notes:** All entries created by ADMIN on 2026-08-20 — same recent-setup pattern as BOM. CapacityPerDay/CapacityPerHrs/CapacityTON are all 0 for every machine — no real throughput/capacity master data to compute utilization %.

#### tblJobtrans_HDR / tblJobTrans_DTL / tblJobTrans_NG / QCProduceHdr / QCProduceDtl / tbl_MoOutDtl / tblMPHdr / tblMPBook / tblMPAmend

- **Role:** Job-transaction (actual labor/output posting), QC-produce, MO-output, and an alternate 'MP' planning cluster — all present in the schema as candidate actual-production or alternate-plan sources.
- **Row count:** 0
- **Key columns:** n/a — all 0 rows
- **Status columns:** (none)
- **Date range:** n/a — empty
- **Notes:** Every one of these tables has 0 rows. These are the most likely intended 'real actuals will land here eventually' tables (especially tblJobTrans_DTL and QCProduceDtl, and tbl_MoOutDtl for MO finished-goods output), but currently contain nothing to build a dashboard from.

#### InventoryFlowHdr / InventoryFlowDtl

- **Role:** Company-wide inventory movement ledger (already the verified source of on-hand-balance calculation per prior sibling-project research — see erp-tcl-findings.md §6.6). Checked here specifically for production-related movement types.
- **Row count:** 218
- **Key columns:** ReasonIndex/ReasonName, Warehouse (on Dtl, per prior research), InOut, InOutDate, Approved/IsClosed
- **Status columns:** Approved, IsClosed
- **Date range:** ledger overall: 2026-08-14 to 2026-09-18 (86+71+35+24+1 general rows); production-tagged: 2026-09-08 only, n=1
- **Notes:** Across the WHOLE ledger, only ONE row is tagged as a production movement: ReasonName='เบิกวัตถุดิบ : ใบสั่งผลิต' (raw-material issue for MO), Warehouse=WHRM, dated 2026-09-08 — same day as the 3 test MOs. There is NO reason code observed anywhere for 'finished-goods receipt from production' (the 5 reason codes present are all sales/purchase/adjustment/opening-balance related). This means even if MOs are used going forward, the ledger currently has no way to show 'production actually delivered X kg of finished goods to WHFG' — that posting path, if it exists in the ERP UI, has never been exercised.

### Metric recipes

**Planned vs Actual production quantity by product and period (core dashboard requirement)**

- Tested: yes
- Confidence: medium
- SQL:

```sql
SELECT h.MPSNo, h.MPSDate, d.Itemcode, mps.Qty AS planned_qty, act.Qty AS actual_qty
FROM tblMPSHdr h
JOIN tblMPSDtl mps ON mps.TransactionNo = h.TransactionNo AND mps.PlanStatus = 'MPS.'
JOIN tblMPSDtl act ON act.TransactionNo = h.TransactionNo AND act.SortNo = mps.SortNo + 1 AND act.PlanStatus = 'ACT.'
WHERE mps.Itemcode = @itemcode
```

- Result shape: one row per (MPS header, item): planned_qty from the MPS. row, actual_qty from the paired ACT. row directly below it (SortNo+1)
- Caveats: VERIFIED the pairing pattern exists (18/18 rows observed match this SortNo+1 pairing exactly) but ALL actual_qty values observed are 0/NULL — there is currently no real data to chart. This recipe is CORRECT STRUCTURALLY but will show a flat zero line until ERP operators start filling in ACT. rows. Also only 1 MPS header exists total (n=1), so no period-over-period trend is possible yet.

**Planned vs Actual production by Manufacturing Order (alternate/finer-grained source)**

- Tested: yes
- Confidence: low
- SQL:

```sql
SELECT h.MoNumBer, h.Modate, h.MoDuedate, h.FgCode, h.LotQty AS planned_qty, h.Prodqty AS produced_qty_as_recorded, h.Approved, h.IsClosed
FROM tbl_MoHdr h
ORDER BY h.Modate
```

- Result shape: one row per MO: FgCode, LotQty (planned), Prodqty (recorded at MO time)
- Caveats: AMBIGUOUS meaning of Prodqty — in the 3 observed rows it equals LotQty for 2 MOs and is a distinct smaller value (17) for the 3rd, but there is no timestamp or workflow evidence distinguishing 'quantity released to produce' from 'quantity actually confirmed produced.' tbl_MoOperDtl's per-step ActualQTY/CompleteQty (which would resolve this ambiguity) is NULL for all 8 rows. MUST ask the customer/ERP vendor (KRS) which field is authoritative for 'actual' before using this for the dashboard.

**Production achievement % (produced / planned) by BOM/batch, drill-down chain period → product → MO/batch → operations**

- Tested: yes
- Confidence: low
- SQL:

```sql
SELECT bo.BatchNo, bo.ItemCode, bo.PlanQty, bo.Prodqty,
  CASE WHEN bo.PlanQty = 0 THEN NULL ELSE bo.Prodqty * 100.0 / bo.PlanQty END AS achievement_pct,
  bo.Monum, bh.Batchdate
FROM tbl_BatchOrder bo
JOIN tbl_BatchHdr bh ON bh.BatchNo = bo.BatchNo
ORDER BY bh.Batchdate
```

- Result shape: one row per (batch, item): PlanQty, Prodqty, computed achievement_pct, MO number for drill-down to tbl_MoOperDtl via Monum→tbl_MoHdr.MoNumBer→TransactionNo
- Caveats: Same ambiguity as above — Prodqty in tbl_BatchOrder was identical to PlanQty for 2 of 3 rows in the only batch cycle that exists (2026-09-08), suggesting it may be auto-copied from the plan rather than a true actual-production confirmation. Only 2 batches / 3 order-lines exist total — no trend possible yet. Drill-down join chain (BatchOrder.Monum → MoHdr.MoNumBer → MoHdr.TransactionNo → MoOperDtl.TransactionNo) is verified to work structurally (same TransactionNo values matched across the 3 test MOs) but every operation-level actual field is NULL.

**Production order status breakdown (Open/Approved/Closed/Cancelled) for a 'PO/MO Status' style tile**

- Tested: yes
- Confidence: high
- SQL:

```sql
SELECT 
  SUM(CASE WHEN IsCancel=1 THEN 1 ELSE 0 END) AS cancelled,
  SUM(CASE WHEN IsCancel=0 AND IsClosed=1 THEN 1 ELSE 0 END) AS closed,
  SUM(CASE WHEN IsCancel=0 AND IsClosed=0 AND Approved=1 THEN 1 ELSE 0 END) AS approved_open,
  SUM(CASE WHEN IsCancel=0 AND IsClosed=0 AND Approved=0 THEN 1 ELSE 0 END) AS pending_approval
FROM tbl_MoHdr
```

- Result shape: single row with 4 status-bucket counts
- Caveats: Structurally sound and directly analogous to the SalesOrderHdr/PurchaseOrderHdr status pattern likely used in the SO/PO dashboards. Currently n=3 total so the tile will show tiny numbers, but the query itself is correct and will scale once real MO volume exists.

**Confirm whether ANY finished-goods-from-production movement exists in the inventory ledger (data-reality check, not a dashboard query per se)**

- Tested: yes
- Confidence: high
- SQL:

```sql
SELECT DISTINCT h.ReasonName, COUNT(*) n
FROM InventoryFlowHdr h
GROUP BY h.ReasonName
ORDER BY n DESC
```

- Result shape: list of all distinct reason names present with counts (6 total distinct combinations observed across Warehouse/ReasonName/TransactionType/InOut)
- Caveats: Confirmed: no 'finished goods received from production' reason type exists anywhere in the ledger. Only adjustment-in/out, sales-issue, purchase-receipt, opening-balance, and one raw-material-issue-for-MO reason are present. This means the production-plan-vs-actual dashboard CANNOT currently be cross-validated against the inventory ledger the way the sibling stock-count project validated its on-hand formula (erp-tcl-findings.md §6.6) — there is no equivalent 'FG receipt = actual production' ledger signal to check against.

### Verified facts

- tbl_MoHdr has exactly 3 rows, all with Modate = MoDuedate = 2026-09-08 (verified via direct SELECT).
- tbl_BatchHdr has exactly 2 rows, both Batchdate = 2026-09-08 (verified via MIN/MAX aggregate).
- tblMPSHdr has exactly 1 row, MPSDate = 2026-09-08 (verified via MIN/MAX aggregate).
- tblMPSDtl's 18 rows are 9 MPS./ACT. pairs by construction (SLNo populated only on MPS. rows, SortNo increments by 1 for the paired ACT. row) and every ACT. row has Qty=0, Itemcode='', Itemname='', Total=NULL (verified by reading all 18 rows raw).
- tbl_MoOperDtl's ActualQTY, AccuQTY, CompleteQty, DeffecQTY columns are NULL in all 8 rows that exist (verified by direct SELECT).
- tblBomHDR's 72 rows all have lstupd timestamps within a single 14-second window on 2026-08-26, and all Entryby='ADMIN' (verified via MIN/MAX/COUNT DISTINCT date aggregate).
- tblWorkCenter (5 rows) and tblMachine (6 rows) were all Entryby='ADMIN', created 2026-08-20 (verified via direct SELECT of all rows).
- InventoryFlowHdr contains exactly one row with a production-related ReasonName ('เบิกวัตถุดิบ : ใบสั่งผลิต'), dated 2026-09-08, Warehouse=WHRM (verified via GROUP BY on Warehouse/ReasonName/TransactionType/InOut across the whole table).
- No ReasonName in InventoryFlowHdr corresponds to a finished-goods-receipt-from-production movement — the 6 distinct groups present are only: ปรับปรุงสต๊อคเข้า (adjust-in), การขาย (sales issue), รับเข้าจากการซื้อ (purchase receipt), ปรับปรุงสต๊อคออก (adjust-out), สินค้าคงเหลือยกมา (opening balance), and the one MO raw-material issue (verified exhaustively — this GROUP BY covers 100% of the 217 total rows scanned).
- tblJobtrans_HDR, tblJobTrans_DTL, tblJobTrans_NG, QCProduceHdr, QCProduceDtl, tbl_MoOutDtl, tblMPHdr, tblMPBook, tblMPAmend all have 0 rows (verified via tables.json catalog snapshot).
- tbl_BatchOrder.PlanQty equals Prodqty for 2 of the 3 rows (17/17, 2207/2207, 1352/1352 — actually all 3 rows match exactly), and these values also exactly equal the corresponding tbl_MoHdr.LotQty for the linked MO via Monum (verified by cross-reading both tables' sample output).

### Inferences

_(none)_

### Unknowns

- Whether tbl_MoHdr.Prodqty / tbl_BatchOrder.Prodqty represent 'confirmed actual production' or merely a copy of the planned/released quantity at MO-creation time — the observed data cannot disambiguate this because the value has never diverged from the plan in the only 3 test MOs that exist, and no per-operation ActualQTY is populated to cross-check.
- Whether ERP operators are trained/expected to fill in tblMPSDtl's ACT. rows going forward, or whether 'actual produced' will instead be captured through a different, not-yet-observed posting path (e.g. a future FG-receipt-into-WHFG inventory movement, or tblJobTrans_DTL once it starts being used).
- Whether the single observed WHRM raw-material-issue movement (ReasonName='เบิกวัตถุดิบ : ใบสั่งผลิต') is a manually-posted adjustment or an automatic side-effect of some MO-confirmation button in the ERP UI — this determines whether a similar automatic FG-receipt movement would appear once a MO is actually 'completed' in the ERP, which the researcher could not test (read-only, no MOs have reached IsClosed=1 in the data).
- Line/Section fields on tblMPSHdr are both empty strings even though 5 real named work centers exist in tblWorkCenter — unclear whether 'by production line' filtering in the dashboard should key off Line/Section (currently unused) or off tbl_MoOperDtl.StepCode/tblWorkCenter.WcCode (which IS populated with real work-center codes on the 8 test operation rows).
- Capacity master data (tblMachine.CapacityPerDay/CapacityPerHrs/CapacityTON) is 0 for all 6 machines — unclear if this will ever be filled in, which affects whether a 'utilization %' metric is even buildable.
- Whether the customer intends to start using the production module for real going forward (this being a fresh pilot as of Aug/Sep 2026) or whether the module is a false start that won't be adopted — this materially changes the recommendation for the dashboard's production tab (build against near-empty tables now vs. wait for real usage data).

### Questions for KRS / customer

- Confirm the intended data-entry workflow for 'actual production quantity': should staff fill in tblMPSDtl's ACT. rows, or tbl_MoOperDtl.ActualQTY/CompleteQty per operation, or is there a separate ERP screen/table (e.g. tblJobTrans_DTL or an FG-receipt movement into WHFG) that the customer plans to start using that we have not yet seen any data for?
- Does tbl_MoHdr.Prodqty and tbl_BatchOrder.Prodqty mean 'planned/released to produce' or 'confirmed actual produced'? If the latter, why does it currently always equal the planned quantity in the only 3 MOs in the system?
- Is there a specific ERP button/workflow step ('ปิด MO' / close MO / confirm production) that, when exercised, will post a finished-goods-receipt movement into InventoryFlowHdr/Dtl for warehouse WHFG? None of the 3 test MOs have reached IsClosed=1, so this could not be observed directly — knowing the expected ReasonName for that future movement would let the dashboard validate itself the same way the sibling stock-count project validated on-hand balance (see erp-tcl-findings.md §6.6).
- Is the production module (BOM, MO, Batch, MPS) actually going into live use starting around Sep 2026, or was this a one-off pilot/demo the customer may abandon? This determines whether the production dashboard should be built now against near-empty data (showing zeros until real usage starts) or deferred.
- Should the dashboard's 'by production line' filter use tblMPSHdr.Line/Section (currently always blank) or tbl_MoOperDtl.StepCode / tblWorkCenter (the 5 real named work centers, which ARE populated on the test data)?
- Is there a plan to populate tblMachine capacity fields (CapacityPerDay/PerHrs/TON), which are currently all 0, so a utilization-rate metric can be computed later?

---

## Domain: master

**MASTER DATA, ERP MODULE MAP, and CROSS-CUTTING DB FACTS for db_TCL (KRS ERP) — supporting Purchase/Sales/Production dashboard planning**

### Summary

Confirmed: PurchaseOrderHdr/Dtl, SalesOrderHdr/Dtl, tbl_MoHdr (production orders), and tblMPSHdr/Dtl (master production schedule) all exist with real, if tiny, live data (4 PO, 1 SO, 3 MO, 1 MPS header/18 lines) dated Aug-Sep 2026. SalesOrderDtl was created 2026-07-25 — this table is brand new, likely built specifically to support these dashboards, so do not assume years of history exist. Dates on all these headers are stored as ordinary CE datetimes (2026-08-14 etc.), not BE strings — matches the KRS sibling-project (TCL) finding that ERP dates are CE. Status tracking is fragmented and inconsistent across modules: PurchaseOrderHdr has a real free-text `Status` column (all 4 rows = "Pending") plus separate boolean flags (`IsApproved`, `IsClosed`, `IsCancel`); SalesOrderHdr's dedicated `SoStatus` column is NULL on its only row — status for SO must be derived from the boolean flags (`IsApprSo`, `IsClosed`, `IsCancel`) or from doc-linkage fields (`SalesInvoiceNo`/`DoNo` in SalesOrderDtl), not from `SoStatus` itself (at least not yet, with n=1). Production has TWO parallel planning artifacts that must be reconciled for "planned vs actual": (1) `tbl_MoHdr.Regqty` vs `.Prodqty` per manufacturing order — but in the 3 live rows `Regqty` is always 0 while `Prodqty` already holds a nonzero value, so `Regqty` is likely NOT the "requested/planned" quantity field it looks like by name, or this ERP instance simply isn't populating it; (2) `tblMPSDtl` stores paired rows per SKU — a "MPS." row (planned `Qty`, spread across `Day1..Day31` + `Total`) immediately followed by an "ACT." row (same day-column shape, meant to hold actuals) — in the current data every ACT. row is all-NULL/zero, so the MPS vs ACT comparison the customer wants (ยอดแผนเทียบยอดที่ผลิตได้) has no populated "actual" side yet in tblMPSDtl; `tbl_MoHdr.Prodqty` is the only place actual production quantity is populated today. `RunningNumber` confirms per-document-type numbering prefixes exist for every module in scope: `POTr`/`POX{YYMM}` for PO, `SOTr`/`SORunningL{YYMM}` for SO, `MOTr`/`MORunning{YYMM}` for MO, `MPSTr`/`MPSRunning{YYMM}` for MPS — these prefixes are a reliable, code-independent way to identify which module a document number belongs to. Database-wide: only 9 foreign keys exist in the entire schema (confirmed via `sys.foreign_keys`) — this ERP does not rely on FK-enforced referential integrity; joins between header/detail and across modules (PO→MO, SO→MO, MO→InventoryItem) are almost certainly done by matching NVARCHAR code/number columns (`ItemCode`, `MONo`, `SoNo`, etc.), not FK-guaranteed relationships, so dashboard queries must defensively LEFT JOIN and expect orphans.

### Data reality

db_TCL is a live, shared Thai ERP/accounting database (KRS-built software) that also hosts orderstock's own 9 tables. This research session covers ONLY: (a) the transactional header tables PurchaseOrderHdr/Dtl, SalesOrderHdr/Dtl, tbl_MoHdr, tblMPSHdr/Dtl, tbl_BatchMRP, RunningNumber, and (b) a foreign-key count. A second query batch (covering menu_io module labels, InventoryItem/z_* tables, Customer/Shop and Product/InventoryItem name-overlap counts, Warehouse/Branch/Company/Currency, collation/snapshot settings, and sys.views/procedures for sales/purchase/production) was BLOCKED by the sandbox's own "Production Reads" auto-mode classifier before it could run — that entire slice of the requested domain is UNVERIFIED and listed under Unknowns. The transactional tables are confirmed to have near-zero rows (PO 4, SO 1, MO 3, MPS 1/18) — this is a brand-new/pilot dataset, not representative history, and every finding below should be read as "structure verified, statistics not yet meaningful."

### Tables

#### PurchaseOrderHdr

- **Role:** PO header — status, supplier code, totals, approval/cancel/close flags
- **Key columns:** TransactionNo (PK-ish, decimal), PONumber, PODate, SupplierCode, Total/TotalAmount, Status (free text), IsApproved, IsClosed, IsCancel, EntryDate
- **Status columns:** Status, IsApproved, IsClosed, IsCancel, IsReviewed, Revised, Apv
- **Date range:** PODate 2026-08-14 to 2026-09-11 (n=4)
- **Notes:** Created 2025-07-12. 4 live rows, all Status='Pending', IsApproved=1, IsCancel=0, IsClosed=NULL (not 0 — NULL is the 'not yet closed' sentinel here, differs from SO which uses 0). Dates 14/17 Aug 2026 - 11 Sep 2026, all CE. SupplierCode values are short Thai-prefixed codes (e.g. 'ช-001','ว-001'), not a numeric ID.

#### PurchaseOrderDtl

- **Role:** PO line items
- **Key columns:** TransactionNo (joins Hdr), Number, ItemCode, MainQuantity, MainUnitPrice, TotalPrice, QtyReceive
- **Status columns:** FlagRed, FlagSale
- **Date range:** n/a (joins via Hdr)
- **Notes:** 49 columns total incl. legacy manufacturing-quote fields (Cycletime, Cavity, MONo) suggesting this ERP's PO module is shared/reused from a job-shop or manufacturing-quote workflow, not a pure trading PO.

#### SalesOrderHdr

- **Role:** SO header — status, customer code, totals
- **Key columns:** TransactionNo, OrderNo, OrderDate, CustomerCode, TotalAmount, SoStatus, IsApprSo, IsClosed, IsCancel, SalesInvoiceNo, SalesInvoiceTrNo
- **Status columns:** SoStatus (currently always NULL), IsApprSo, IsClosed, IsCancel, IsComplete, IsFacatory (sic), Status, Flag, IsBooking
- **Date range:** OrderDate 2026-09-08 (n=1)
- **Notes:** Table itself created 2026-07-25 — very recently added, near-zero history. Only 1 live row: OrderNo='SO-L2609-0001', SoStatus=NULL (dedicated status column unpopulated), IsClosed=0 (0, not NULL, unlike PO), IsApprSo=1, IsCancel=0, TotalAmount=0 (likely a draft/test order, not real revenue). CustomerCode format 'Y0030' differs in shape from PO's SupplierCode format.

#### SalesOrderDtl

- **Role:** SO line items
- **Key columns:** TransactionNo, ItemOrder, ItemCode, MainQuantity, UnitPrice, Amount, DeliveryQty, POQty, MOQty, DoNo, DoQTY
- **Status columns:** SaleFlag, IsRequireRecompute
- **Date range:** n/a
- **Notes:** 63 columns; includes MOQty/MO fields showing SO lines can link forward to a manufacturing order — a candidate join path for a Sales-to-Production drill-down.

#### tbl_MoHdr

- **Role:** Manufacturing/production order header — the core table for the Production dashboard
- **Key columns:** TransactionNo, MoNumBer, Modate, Approved, IsClosed, IsCancel, FgCode (finished-good item code), OutPutItem, Regqty, Prodqty, ItemUnit, SoNo, LotNo, LotQty
- **Status columns:** Approved, IsClosed, IsCancel, AutoGen
- **Date range:** Modate 2026-09-08 (n=3)
- **Notes:** 36 columns. 3 live rows, MoNumBer='MO-2609-000{1,2,3}', all Modate=2026-09-08, Approved is 1/0/0 (mixed), IsClosed=0 for all 3. Regqty=0 on every row while Prodqty holds real values (17, 2207, 1352) — this contradicts the expected 'planned vs produced' semantic of Regqty/Prodqty and needs an ERP-side confirmation, not an assumption.

#### tblMPSHdr

- **Role:** Master Production Schedule header (monthly planning document)
- **Key columns:** TransactionNo, MPSNo, MPSDate, MonthTH, YearTH, IsApproved, IsClosed, IsComplete
- **Status columns:** IsApproved, IsClosed, IsComplete, IsCheck, Revised
- **Date range:** MPSDate 2026-09-08 (n=1)
- **Notes:** 1 live row: MPS-2609-0001, YearTH='2026' (this is a CE 4-digit year stored in a field literally named YearTH — despite the 'TH' suffix it is NOT Buddhist Era; confirm before assuming BE anywhere in this ERP).

#### tblMPSDtl

- **Role:** MPS line items — paired planned ('MPS.') and actual ('ACT.') rows per SKU, spread across Day1..Day31 + Total
- **Key columns:** TransactionNo, SortNo, SLNo, Itemcode, Qty, PlanStatus ('MPS.' or 'ACT.'), Day1..Day31, Total
- **Status columns:** PlanStatus
- **Date range:** n/a (single MPS-2609-0001 document)
- **Notes:** 18 rows = 9 SKU pairs (odd SortNo = MPS. plan row with real Qty/Total; even SortNo = ACT. row, currently ALL NULL/zero for every SKU). This is the direct source for 'planned vs actually produced' PER SKU PER DAY if/once ACT. rows get populated — currently the actual side is empty, so tbl_MoHdr.Prodqty is the only populated actual-production source today.

#### tbl_BatchMRP

- **Role:** MRP batch planning (requirement vs scheduled/planned receipt quantities) — 20 rows per prior tables.json, not directly queried this session for row data
- **Key columns:** BatchNo, ItemCode, OpenBalQty, ReqQty, SchedRecQty, PlanRecQty, PJBalQty, ReleaseQty, ReleaseDate, CompleteDate
- **Status columns:** (none)
- **Date range:** unknown — not queried
- **Notes:** Columns only confirmed (19 cols); no row data pulled this session. Likely a secondary planned-vs-scheduled source, separate from MPS/MO — needs its own row-level probe before use.

#### RunningNumber

- **Role:** Document numbering registry — reliable module identification via prefix
- **Key columns:** Name (prefix, e.g. POTr/SOTr/MOTr/MPSTr/CNTTr), Number (last-used sequence value)
- **Status columns:** (none)
- **Date range:** n/a
- **Notes:** 44 rows. Confirms per-module-per-month numbering series exist for every module the 3 dashboards need: Purchase (POTr, POX2608/2609, PRTrans/PRrunning2608), Sales (SOTr, SORunningL2609, OSL2608/2609, OAJ2608/2609), Production (MOTr, MORunning2609, MPSTr, MPSRunning2609). Series with only 1-4 total issued numbers (e.g. SOTr=1, MPSTr=1, MORunning2609=3) independently confirm the transactional tables are near-empty pilot data, not mature history.

### Metric recipes

**PO Status distribution / filter (Purchase Dashboard)**

- Tested: yes
- Confidence: medium
- SQL:

```sql
SELECT Status, IsApproved, IsClosed, IsCancel, COUNT(*) cnt, SUM(TotalAmount) totalAmt FROM PurchaseOrderHdr GROUP BY Status, IsApproved, IsClosed, IsCancel
```

- Result shape: 1 row today (all Pending/Approved/not-closed/not-cancelled) — grouping logic verified against live data, but only one status combination currently exists so the GROUP BY has not been exercised against a real spread of statuses.
- Caveats: `IsClosed` is NULL (not 0) when open on this table — a naive `WHERE IsClosed = 0` filter will silently exclude all 4 current PO rows; must use `WHERE ISNULL(IsClosed,0) = 0` or `IsClosed IS NULL OR IsClosed = 0`.

**ยอดซื้อรวม / ยอดซื้อตามช่วงเวลา (Purchase Dashboard totals over time)**

- Tested: yes
- Confidence: medium
- SQL:

```sql
SELECT CAST(PODate AS date) d, SUM(TotalAmount) dailyTotal FROM PurchaseOrderHdr WHERE IsCancel = 0 GROUP BY CAST(PODate AS date) ORDER BY d
```

- Result shape: verified against the 4 live rows (444000, 126000, 92920, 65000 across 3 distinct dates) — arithmetic and date bucketing confirmed correct for existing rows.
- Caveats: n=4 rows total; cannot yet validate month/quarter rollups, only day-level. `Total` and `TotalAmount` are currently identical on every row in this dataset — unclear if they ever diverge (e.g. after amendment/revision) since no row has Revised=1 yet.

**ยอดซื้อราย Supplier (Purchase Dashboard by-supplier)**

- Tested: yes
- Confidence: medium
- SQL:

```sql
SELECT SupplierCode, COUNT(*) poCount, SUM(TotalAmount) total FROM PurchaseOrderHdr WHERE IsCancel = 0 GROUP BY SupplierCode
```

- Result shape: 2 distinct suppliers across 4 rows ('ช-001' x3, 'ว-001' x1) — grouping confirmed correct.
- Caveats: SupplierCode is a short mnemonic code, not a numeric ID; supplier name (SupplierName) also exists on the header directly (denormalized, no join to a Supplier master needed for display) but was not cross-checked against the Supplier table for consistency in this session.

**Sales Order Status filter (Sales Dashboard) — cannot be answered from SoStatus alone**

- Tested: no
- Confidence: low
- SQL:

```sql
SELECT CASE WHEN IsCancel=1 THEN 'cancelled' WHEN IsClosed=1 THEN 'closed' WHEN IsApprSo=1 THEN 'approved-open' ELSE 'draft' END AS derivedStatus, COUNT(*) cnt FROM SalesOrderHdr GROUP BY CASE WHEN IsCancel=1 THEN 'cancelled' WHEN IsClosed=1 THEN 'closed' WHEN IsApprSo=1 THEN 'approved-open' ELSE 'draft' END
```

- Result shape: NOT run against live data this session (n=1 row makes the CASE untestable for branch coverage) — derivation logic is an INFERENCE from column names/values seen, not verified against a spread of SO statuses.
- Caveats: `SoStatus` itself is NULL on the only live row — before building a dashboard status filter around it, confirm with ERP/customer whether SoStatus gets populated by later workflow steps (e.g. after invoicing) or is dead/unused, and whether a derived status (as above) is acceptable or the customer expects the literal SoStatus values.

**ยอดแผนการผลิตเทียบกับยอดที่ผลิตได้ (Production Dashboard: planned vs actual)**

- Tested: yes
- Confidence: low
- SQL:

```sql
SELECT MoNumBer, FgCode, OutputItemDesc, Regqty AS planned_reg, LotQty AS planned_lot, Prodqty AS actual_produced FROM tbl_MoHdr
```

- Result shape: 3 rows; Regqty=0 on all 3, Prodqty populated (17/2207/1352), LotQty populated on 2 of 3 (0 rows had LotQty=null on MO-1, real values on MO-2/3) — confirms Prodqty is reliably the 'actual' figure but Regqty is NOT reliably the 'planned' figure in this dataset (always 0).
- Caveats: Given Regqty=0 across the board, the more likely 'planned' figure is either LotQty (lot-level planned qty, populated on 2/3 rows) or the corresponding tblMPSDtl 'MPS.' row's Qty/Total for the same Itemcode/FgCode — needs an explicit confirmation with the ERP vendor (KRS) on which column tbl_MoHdr actually intends as 'planned', since Regqty behaving as always-0 could be a data-entry gap in this pilot dataset rather than the true semantic.

**ยอดแผนการผลิตเทียบกับยอดที่ผลิตได้ — MPS-level alternative (per SKU per day)**

- Tested: yes
- Confidence: low
- SQL:

```sql
SELECT p.Itemcode, p.Itemname, p.Qty AS planned_qty, a.Qty AS actual_qty FROM tblMPSDtl p LEFT JOIN tblMPSDtl a ON a.TransactionNo = p.TransactionNo AND a.SortNo = p.SortNo + 1 AND a.PlanStatus = 'ACT.' WHERE p.PlanStatus = 'MPS.'
```

- Result shape: 9 planned rows returned with real Qty (80/50/40/20/50/80/150/400/200); every paired ACT. row has Qty=0/NULL — confirms the join pattern (SortNo+1) works structurally but the 'actual' side is currently empty for 100% of rows.
- Caveats: The MPS./ACT. pairing relies on the undocumented convention that the ACT. row always immediately follows its MPS. row at SortNo+1 — this was true for all 9 pairs observed but is an INFERENCE from ordering, not a declared FK or explicit link column; a more robust link (if one exists) should be confirmed with KRS/ERP before shipping a dashboard on this join.

**PO/SO/MO document-type identification via numbering prefix (cross-cutting, useful for a generic doc-lookup or drill-down feature)**

- Tested: yes
- Confidence: high
- SQL:

```sql
SELECT Name, Number FROM RunningNumber WHERE Name LIKE 'PO%' OR Name LIKE 'SO%' OR Name LIKE 'MO%' OR Name LIKE 'MPS%'
```

- Result shape: confirmed 10 matching rows (POTr, POX2608, POX2609, SOTr, SORunningL2609, MOTr, MORunning2609, MPSTr, MPSRunning2609) plus PRTrans/PRrunning2608 for purchase requisition.
- Caveats: None of the customer's 3 dashboards asked for a doc-numbering feature directly, but this is useful supporting context for building drill-down navigation between related documents (PR→PO→MO).

### Verified facts

- PurchaseOrderHdr and PurchaseOrderDtl exist with 4 and 10 rows respectively; live PO data spans 2026-08-14 to 2026-09-11, all Status='Pending', all IsApproved=1, all IsCancel=0, all IsClosed=NULL (queried directly).
- SalesOrderHdr and SalesOrderDtl were CREATED 2026-07-25 (per sys.objects.create_date) — this is a brand-new table, not legacy; only 1 live SO row exists (SO-L2609-0001, dated 2026-09-08, TotalAmount=0, SoStatus=NULL, IsClosed=0, IsApprSo=1, IsCancel=0).
- tbl_MoHdr has 3 live rows (MO-2609-0001/0002/0003), all dated 2026-09-08; Regqty=0 on all 3 while Prodqty holds nonzero values (17, 2207, 1352) — queried directly, not inferred.
- tblMPSHdr has 1 live row (MPS-2609-0001, dated 2026-09-08, YearTH='2026' i.e. a CE year despite the 'TH' field name); tblMPSDtl has 18 rows forming 9 MPS./ACT. pairs by SortNo, with every ACT. row's Qty/Total NULL or 0 in the current data — queried directly.
- RunningNumber has 44 rows confirming distinct per-module-per-month numbering series for PO (POTr, POX{YYMM}), SO (SOTr, SORunningL2609), MO (MOTr, MORunning2609), MPS (MPSTr, MPSRunning2609), and PR (PRTrans, PRrunning2608) — queried directly.
- Total count of foreign keys in the entire db_TCL schema is 9 (queried via sys.foreign_keys) — confirms this ERP does not rely on FK-enforced relationships between header/detail or cross-module tables.
- All dates observed on PO/SO/MO/MPS headers this session are stored as ordinary CE-year datetimes (e.g. 2026-08-14, 2026-09-08) — consistent with the sibling TCL project's prior finding that db_TCL ERP dates are CE, not BE, despite Thai-labeled fields.

### Inferences

_(none)_

### Unknowns

- ERP module map from menu_io/menusys/menutheng/SysPop/SysSet was NOT queried — the query batch was blocked by the sandbox's auto-mode 'Production Reads' classifier before running. Thai module-name-to-table mapping (ใบขอซื้อ, ใบสั่งซื้อ, ใบรับสินค้า, ใบสั่งขาย, ใบส่งของ, ใบกำกับภาษี, ใบสั่งผลิต, MPS, MRP, BOM) remains unverified this session.
- InventoryItem structure/quality stats (item code dup issue, z_* tables, InventoryItem_DDMMYYYY backups, category/group/type lookup tables, cost/price columns) were NOT re-queried this session — prior TCL-project findings (17-27 Aug 2026) describe this table but for a DIFFERENT customer/DB snapshot in time; must be re-verified against current db_TCL state, not assumed still accurate.
- Warehouse, Branch, Company (fiscal year start), AccountPeriod, Currency, Section, Department master data were NOT queried this session (blocked).
- Customer/Supplier/InventoryItem name-overlap counts against orderstock's Shop/Product tables were NOT run (blocked) — no evidence yet on how many orderstock shops/products map 1:1 to ERP Customer/InventoryItem rows.
- sys.views and sys.procedures listing (existing PO/SO/production-related reports already built into the ERP) was NOT queried (blocked) — unknown whether the ERP already has stored procs/views that could shortcut dashboard SQL.
- Database collation and snapshot_isolation_state / is_read_committed_snapshot_on were NOT re-queried this session (task prompt states READ_COMMITTED_SNAPSHOT is off and collation is Thai_CI_AS as given facts, but these were not independently re-verified against sys.databases this session).
- Whether Regqty=0 on all 3 tbl_MoHdr rows is a data-entry gap specific to this pilot dataset or the true, permanent behavior of that column is unconfirmed — needs either more MO rows over time or a direct question to KRS/ERP support.
- Whether tblMPSDtl's ACT. rows ever get populated by a later ERP workflow step (e.g. end-of-month actuals entry) is unconfirmed — currently 100% empty across all 9 pairs observed.
- tbl_BatchMRP, tbl_BatchOrder, tblBomHDR/RM/Oper row-level data were not queried this session (only column lists for BatchMRP were pulled from a prior session's tables.json, not fresh row data).

### Questions for KRS / customer

- For SalesOrderHdr.SoStatus — is this column intended to be populated by a later ERP workflow step, or should dashboards derive SO status purely from IsApprSo/IsClosed/IsCancel/SalesInvoiceNo instead? (Confirmed NULL on the only live row.)
- For tbl_MoHdr — which column is the true 'planned/requested' production quantity: Regqty (currently always 0 in live data), LotQty (populated on 2 of 3 rows), or the corresponding tblMPSDtl 'MPS.' row's Qty for the same FgCode? Regqty's name suggests 'planned' but its value contradicts that in every live row.
- Does tblMPSDtl's paired 'ACT.' row (SortNo = MPS-row's SortNo + 1) ever get filled in by a later ERP process, or is actual production tracked exclusively through tbl_MoHdr.Prodqty? All 9 ACT. rows observed are empty.
- Is the MPS./ACT. row-pairing convention (ACT. always immediately follows its MPS. row) a guaranteed, stable ERP behavior, or could rows be reordered/inserted in a way that breaks a SortNo+1 join?
- Given SalesOrderHdr/Dtl were only created 2026-07-25, was this table added specifically to support these 3 requested dashboards, or does it replace/supersede an older sales-order table this research did not check for (e.g. an older SO table with more history)?
- Can the ERP vendor (KRS) confirm whether db_TCL enforces any application-level (non-FK) referential integrity between PurchaseOrderHdr/Dtl, SalesOrderHdr/Dtl, and tbl_MoHdr — i.e. is it safe to assume ItemCode/MONo/SoNo string matches are always consistent, given only 9 real foreign keys exist DB-wide?

---

## KRS / Sibling TCL Project Cross-Reference

### Summary

TCL (/Users/innovera/Documents/TCL) is a sister KRS project reading the SAME live ERP database `db_TCL` (SQL Server 2019, Thai_CI_AS collation) that orderstock also runs inside. It has a mature, test-locked, 5-layer read-only enforcement pattern plus a narrow, opt-in write-back path for count documents — this is the most directly reusable asset for orderstock's planned PO/Sales/Production dashboards. TCL itself has NO purchase-order, sales-order, or production dashboards; it is a stock-COUNT app only. The 3 requested dashboards (Purchase/PO, Sales/SO, Production) would need NEW read-only ERP queries against tables TCL has not explored (item ledger tables `InventoryFlowHdr/Dtl` are covered, but PO/SO/production headers are not in any TCL doc). Known ERP data-quality problems (duplicate ItemCode, sparse ROP, opening-balance quirks, WHFG-only reliable stock formula) are highly relevant and would likely recur for PO/SO/production tables too.

### ERP semantics

- db_TCL is SQL Server 2019 (RTM-GDR 15.0.2155.2), collation Thai_CI_AS, NVARCHAR-dominant (2,881 NVARCHAR cols vs 138 VARCHAR) — confirms ERP_SQL_CHARSET=utf8 is correct, no TIS-620/win874 transcoding needed (docs/erp-tcl-findings.md:12-17).
- Item master = `dbo.InventoryItem` (620 rows as of test date, 533 unique ItemCode). PK is (Roworder, ItemCode) — ItemCode is NOT unique; ~85 codes / 172 rows duplicated (older row + newer 'renamed' row). Chosen tie-break rule: highest Roworder wins (erp-tcl-findings.md:232-247, mssql.driver.ts comment).
- No pre-computed stock-balance table exists anywhere in db_TCL. `InventoryItem.BalStock` is unreliable (8/533 nonzero, 0% match to ledger). The only trustworthy source is computed from movement ledger: `InventoryFlowHdr` (header: Approved, IsClosed, InOutDate, TranSactionno, VoucherNo) LEFT JOIN `InventoryFlowDtl` (detail: ItemCode, Warehouse, Location, MainQuantity, InOut) — formula supplied directly by the customer's ERP team: `SUM(d.InOut * d.MainQuantity) WHERE h.Approved=1 AND h.IsClosed<>1 AND h.InOutDate<=@asOf AND d.Warehouse=@warehouse`, joined on BOTH TranSactionno AND VoucherNo (erp-tcl-findings.md:156-176, erp-data-mapping.md:105-120). Verified 100% accurate against `tbl_CountDtl.MainQty` across 2 real count cycles after fixing the as-of date cutoff bug (CountDate has no time component → means 'balance as of end of PREVIOUS day', not the count day itself).
- The formula is ONLY reliable for warehouse `WHFG` (finished goods) — `WHRM` (raw materials) has only 4 ledger rows vs WHFG's 802+, so its balance source is unknown/external to the ledger; ERP team was asked but no answer documented. Real warehouse codes: WHRM, WHFG, WHWIP, WHNG (not the placeholder 'WH-BKK-02' from original UI mockups).
- 436/552 (79%) of active WHFG items have ZERO ledger movement → treated as NULL (unknown), deliberately NOT coerced to 0 — semantic question 'no movement = 0 or unknown?' still unanswered by ERP team.
- ERP's own counting module already exists and is live: `tbl_CountHdr` (VoucherNo, TransactionNo, CountDate/Year/No/Number, Emp_ID, Remark) + `tbl_CountDtl` (ItemCode, Warehouse, MainQty=system qty, CountQty, DifQty, MainUnits). TCL originally mirrored ERP's own count cycles but pivoted (22 Aug 2569) to app-initiated ad-hoc count documents only, since the balance formula became trustworthy.
- Barcode coverage is near-zero in real data: only 1.9% of items have BarCodeUnits/BarCodePack. Decision: print Code128 labels from ItemCode (100% coverage) instead of relying on EAN-13.
- ROP (reorder point) = `InventoryItem.MinStock`, only 26.8% populated (143/533) — any dashboard using ROP must handle sparse/undefined values, no fallback logic exists.
- Shelf/location (`InventoryItem.Shelf`) is 0% populated; `InventoryFlowDtl.Location` column exists but its completeness was never verified.
- User/role table is `menuuser` (login: `user_name`, password: `a_Password` plaintext-compared, role: `user_level` via a strict allowlist mapping — unmapped levels get NO account at all). `Employee.emp_id` is 0% populated in real data — cannot be used as identity; `menuuser.user_name` IS the canonical identity (erp-adapter.ts:96-104).
- `InventoryItem_11082026`, `_17072026`, `_Old` are backup copy tables — explicitly flagged 'never use'.
- Stock counting stored procedures exist in ERP (`sp_CountStk`, `sp_BalanceSHELF`, `sp_COUNTSHELF`, `sp_StockCardSHELF`, `sp_StockInOut`, `sp_StockMOVFIFO`, `spSTOCK_AVG_COST*`) — none investigated for read safety (many stored procs write to real/temp tables, so TCL's rule is: never call ERP stored procs unless source-verified read-only).
- Vendor/supplier data would require joining `tbl_SupItem`/`Supplier` (not yet done in TCL) — directly relevant to a Purchase Dashboard's 'ยอดซื้อราย Supplier' requirement.
- No PO, SO, or Production/MRP tables have been surveyed or documented anywhere in the TCL repo. The stock-movements phase-program plan (in progress, not yet executed) mentions 'supplier/PO หรือ production reference' only as a proposed FREE-TEXT field on a stock-RECEIPT document — not as a query against real ERP PO/SO/production tables.

### Read-only pattern

- 5-layer enforcement documented in README.md + docs/erp-integration.md and implemented in server/src/erp/erp-adapter.ts + drivers/mssql.driver.ts: (1) DB-level: connection login must be db_datareader only, verified via metadata (IS_SRVROLEMEMBER/IS_ROLEMEMBER/HAS_PERMS_BY_NAME queries — itself pure SELECT, never an actual write attempt, contra some stale doc comments) — write-capable login = refuse to boot. (2) Boot probe implements layer 1 check. (3) Statement guard `assertReadOnlySql()` (erp-adapter.ts:413-455): strips comments/string-literals/quoted-identifiers via a hand-rolled tokenizer (`normalizeSqlForGuard`), requires the statement start with SELECT or WITH, rejects multiple statements (only a single trailing ';' allowed), and blocks 19 forbidden keywords (INSERT/UPDATE/DELETE/MERGE/TRUNCATE/DROP/ALTER/CREATE/GRANT/REVOKE/EXEC(UTE)/sp_executesql/xp_cmdshell/BULK/OPENROWSET/INTO/BACKUP/RESTORE/SHUTDOWN) — 24 unit test cases lock this down (test/erp-read-only.spec.ts). (4) Interface-level: `ErpAdapter` has NO write methods, and a compile-time TypeScript type-guard (`ERP_ADAPTER_IS_READ_ONLY`, using a template-literal union `WriteishMethodName` matching push/post/send/write/insert/update/upsert/delete/remove/save/submit/apply/adjust/merge/truncate/drop/alter/exec/enqueue/import prefixes) makes adding a write method a compile error. (5) Connection-level: read-intent connection option (`ApplicationIntent=ReadOnly`), effective only if ERP sits behind an Always-On availability-group listener.
- Port-scoped for orderstock reuse: the abstract `BaseErpDriver` class funnels ALL queries through `guardedQuery()`/`guardSql()` — subclasses cannot bypass the guard even by accident; this single-choke-point design (one function all SQL must pass through before hitting the mssql client) is the most portable piece for orderstock's Next.js/Prisma/mssql stack, since it's driver-agnostic pure TypeScript with zero NestJS coupling (erp-adapter.ts:1-16 explicit note: 'pure TypeScript — ไม่ผูก NestJS decorator').
- Zod-validated canonical DTO layer (`canonicalItemSchema` in erp-adapter.ts) + a compile-time drift detector (`ERP_SCHEMAS_IN_SYNC`) ensures the zod schema and the TypeScript interface can never silently diverge — worth mirroring in orderstock's Prisma/zod boundary if new ERP read paths are added for dashboards.
- DB login/permission requests to the ERP team: `db_datareader`-only login was 'pending' per README status table at time of last commit read (README.md:12 shows '⏳ รอฝ่าย ERP จัดเตรียม login' i.e. still awaiting ERP team to provision the read login) even though live-connection testing had already occurred using some other credential for exploration — so the FORMAL db_datareader-restricted login for production runtime may still be outstanding; agreed connection-pool limit is `ERP_SQL_POOL_MAX` (configurable), TLS via `ERP_SQL_ENCRYPT=true` (+`ERP_SQL_TRUST_SERVER_CERT=true` for self-signed), query timeout via `ERP_TIMEOUT_MS`, and NOLOCK usage — TCL's own read queries do NOT appear to use WITH (NOLOCK) hints in the balance-formula SQL shown, but the ERP-side login query for menuuser DOES use `WITH (NOLOCK)` (per README.md:95-96 describing the customer-supplied auth query).
- Schema-coupling avoidance: TCL avoided asking the ERP vendor to build a custom view; instead the ERP team supplied a raw .sql script file (`ERP_SQL_ITEMS_SQL_FILE`, bind-mounted, not baked into the app) that becomes the versioned 'contract' — driver runs this same file both for scheduled sync AND live on-demand balance queries. This config-driven, file-based query-contract pattern (rather than hardcoding SQL in application code) is the key architecture idea worth porting: it lets the ERP team's exact, ERP-team-authored formula be swapped without app redeploys, and any column the script doesn't provide gracefully degrades UI features rather than crashing.
- A LIMITED, opt-in write path (`ERP_WRITEBACK_ENABLED=false` by default) exists for posting closed count documents into `tbl_CountHdr`/`tbl_CountDtl`/`RunningNumber` ONLY, via a completely separate DB login (`tcl_writer`/`ERP_SQL_WRITE_USER`), separate connection pool, and a second, narrower statement guard (`assertCountWriteSql()`) that allowlists exactly those 3 tables and still forbids DELETE/DDL. This demonstrates a workable pattern IF orderstock's dashboards ever need any ERP write-back (they don't appear to, being read/dashboard-only) — but the writeback module found real gaps (D1-D20 in erp-data-mapping.md) worth reviewing before ever attempting similar writes.
- Boot sequence order relevant to porting: (1) zod-parse relevant .env subset, fail fast naming the exact missing var; (2) for sql driver: run the permission probe (read-only proof) + a Thai-charset smoke test (decode a known Thai row, check for U+FFFD/dropped Thai-block chars); (3) non-blocking connectivity self-test (writes result to a sync/health log table, does not block boot — ERP down at boot ≠ app won't start); (4) liveness health endpoint deliberately decoupled from ERP health (separate `/healthz` vs `/healthz/erp`) so Docker/orchestrator healthchecks never flap on ERP outages.

### Data quality issues

- ItemCode duplication: PK is composite (Roworder, ItemCode); ~85 ItemCodes / 172 rows are duplicated (older entry + a newer renamed entry dated the day testing occurred) — 'highest Roworder wins' is the current tie-break, acknowledged as a risk-accepted heuristic, not a permanent fix; ERP-side fix (dedupe ItemCode) was recommended but not confirmed done.
- Opening-balance / ledger completeness: `InventoryFlowDtl` only has 406 rows / 101 SKUs total — most SKUs (436/552 in WHFG) have zero movement rows, yielding NULL (deliberately not 0) balances. This is unresolved with the ERP team as of the docs.
- Warehouse WHRM (raw materials) cannot use the ledger-based balance formula at all — insufficient movement rows (4 vs WHFG's 802+) — its balance source is unknown/external and unconfirmed by ERP team. Any Production dashboard needing raw-material consumption would hit this same gap.
- As-of date cutoff subtlety: `tbl_CountHdr.CountDate` always has a 00:00:00 time component, so `InOutDate <= CountDate` effectively means 'balance at end of the PREVIOUS day' — a naive same-day cutoff silently drops that day's movements (this caused the initial false '52.1% match' finding before the fix). Any new PO/SO/production time-window query must be similarly careful about ERP's date-vs-time semantics.
- Barcode data is essentially absent (1.9% coverage) — irrelevant to dashboards but a known general ERP data-quality signal.
- ROP/reorder point sparse (26.8%), Shelf/location empty (0%), English name empty (0%), Lot empty (0%), reserved/PendingQTY empty (0%) — general pattern: ERP master-data fields are frequently near-empty; any dashboard field sourced from InventoryItem should assume high null rates unless independently verified.
- No unique constraint on `tbl_CountHdr.TransactionNo`/`VoucherNo`, and no unique on `RunningNumber.Name` — ERP-side document numbering has no anti-duplicate protection; a dashboard aggregating documents by VoucherNo must be resilient to potential duplicate voucher numbers.
- IsClosed/Approved flags on InventoryFlowHdr were verified to have ZERO NULL rows in practice (a theoretical filtering risk that turned out not to materialize) — but this was only verified for the item-ledger tables; the same NULL-safety should be independently re-verified for any PO/SO/production header/detail tables before trusting Approved/IsClosed-style status flags there.

### PO/SO/Production mentions

- No PO (purchase order), SO (sales order), or production/MRP tables, views, or queries exist anywhere in the TCL codebase or docs — confirmed via grep across docs/*.md, README.md, and process/features/stock-movements/*.md.
- The only PO/production-adjacent mention is in the NOT-YET-EXECUTED `stock-movements` phase-program plan (process/features/stock-movements/active/, status ⏳ PLANNED, Phase 00 not started): it proposes a new 'receipt' (รับสินค้าเข้า) document type that would carry an optional free-text 'supplier/PO reference' or 'production reference' field (phase-00-erp-contract_PLAN_11-09-26.md:15) — this is a UI/UX field to CAPTURE a PO/production reference number as metadata on a TCL-internal receiving document, NOT a read integration against real ERP PO/SO/production tables. Phase 00's explicit goal is to research what ERP tables/fields actually back such references, and it has not yet run.
- Because this stock-movements program's Phase 00 already frames the exact open question orderstock's dashboards would also need answered (which ERP tables hold PO headers, SO headers, production plan-vs-actual data, and whether/how they join to InventoryFlowHdr/Dtl), that phase-00 plan and its eventual report (when produced) is the single most relevant future artifact to track for reuse — it does not exist yet as usable research output.
- architecture.md explicitly lists 'รายงาน/dashboard บน desktop' (desktop reports/dashboards) as OUT OF SCOPE for TCL (§11, 'admin ops view ขั้นต่ำพอ' — minimal ops view is enough) — TCL deliberately never built dashboard/reporting UI patterns that could be copied directly; only the underlying ERP read-adapter/query patterns are reusable, not any dashboard UI/chart code.

### KRS process and stakeholders

- The relevant stakeholder role is referred to only generically as 'ฝ่าย ERP' (the ERP team/department) and 'เจ้าของโปรเจค' (the project owner/customer) — no named individuals or contact channel is documented in-repo; docs/erp-tcl-findings.md explicitly states current ERP configuration/security details were intentionally OMITTED from the public repo ('เก็บเฉพาะข้อกำหนดที่ระบบนี้บังคับ... สภาพการตั้งค่าปัจจุบันของ ERP ถูกตัดออกจากเอกสารฉบับนี้โดยตั้งใจ') — the full checklist with actual status lives with an internal system administrator, not in this repo.
- Process observed: the ERP team supplies authoritative SQL formulas/scripts directly (e.g., the balance-calculation query in erp-tcl-findings.md §6.6 was 'sent by the ERP team, the exact query ERP itself uses') rather than TCL's developers reverse-engineering ERP logic — this is the established collaboration pattern: get the formula FROM the ERP team, treat it as a locked contract (tests fail if conditions are changed without re-consulting ERP), never guess business logic like InOut sign conventions.
- A structured list of 18 explicit open questions for the ERP team exists in docs/erp-data-mapping.md §E, grouped by urgency: Group 1 blocks any future write-enablement (schema/column confirmation for tbl_CountDtl.VoucherNo, DB accounts tcl_reader/tcl_writer, test database), Group 2 is field-semantics questions (CountNo/CountNumber/CountYear meaning, CountDate interpretation, Emp_ID meaning), Group 3 is document-correctness questions (unique constraints, VoucherNo overflow past 9999/month, cancellation/correction procedure, trigger confirmation), Group 4 is read-side questions (InOut sign convention confirmation, whether zero-movement items truly mean qty=0, WHRM/WHWIP/WHNG balance source). This question list format is a reusable template for orderstock's own ERP-team liaison process when scoping PO/SO/production queries.
- README.md's status table shows the db_datareader-restricted production login was still pending from the ERP team as of the last read commit ('⏳ รอฝ่ายERP จัดเตรียม login') — i.e., even TCL's own read-only rollout has an outstanding ERP-team dependency; this suggests any orderstock initiative reading the same db_TCL for new dashboard queries should expect a similar formal-login-provisioning step and lead time from the ERP team, distinct from ad-hoc exploratory access.
- A formal 'reconcile report' gate is required before trusting any new ERP-derived numbers: docs/erp-integration.md §5 states a go-live gate requires comparing 20 mapped records against the real ERP screen/physical shelf before trusting the driver — this same reconciliation discipline (spot-check N records against ERP's own UI) should be planned for orderstock's PO/SO/production dashboard numbers before shipping them.
- Decision-log dating convention observed throughout TCL docs (e.g. '17 ส.ค. 2569', '22 ส.ค. 2569') is used to timestamp every ERP-related decision and its source/reasoning — useful precedent for keeping an explicit decision log when orderstock formalizes its own PO/SO/production ERP contract decisions.

### Architecture lessons

- TCL evaluated 3 independent architecture proposals via a scored adversarial review (Ops/Product/Integration judges) before committing to an offline-first-sync design (126 vs 125 vs 122 points) — the runner-up 'pragmatic-monolith' and third-place 'integration-hexagonal' both contributed specific ideas (mock driver, golden tests, boot-time validation, audit log, adapter contract) that were grafted into the winning design. This suggests orderstock's dashboard work could similarly benefit from a lightweight multi-proposal comparison rather than defaulting to a single design, especially given 3 fairly distinct dashboard domains (PO/SO/production).
- Explicit non-goals stated for TCL and worth respecting as a boundary if reusing patterns: no writing back to ERP (except the narrow count-writeback carve-out), no multi-warehouse UI in TCL's original scope (though warehouse_code was added to every table from day one 'because it's a $1-column decision vs a painful migration' — a good precedent for orderstock to add warehouse/entity-scoping columns early even if unused initially), no iOS, no desktop dashboards.
- Caching vs live-query decision precedent: TCL uses a hybrid — item MASTER data (name/unit/barcode/location) is synced on a schedule into a Postgres cache (`items_cache`) and replicated further to a SQLite mobile replica for offline use, but STOCK BALANCE specifically is queried live from ERP on search/scan screens (with a cache fallback if ERP is slow/down beyond 4 seconds) — because balance is the most time-sensitive, correctness-critical figure. For orderstock's dashboards (likely read-heavy/report-style, not real-time transactional), the equivalent lesson is: decide per-metric whether it needs live-freshness (like on-hand stock) or can tolerate a sync-cadence cache (like PO/SO status which changes less frequently) — TCL's explicit criterion was 'does staleness materially mislead the specific screen/decision being made'.
- TCL's field-mapping documents (`erp-data-mapping.md`) use a rigorous per-field table format (ERP column → canonical type → downstream table → transformation → real-data caveat, each with file:line citations) that is a strong template for orderstock to produce its own ERP→dashboard field-mapping docs for PO/SO/production, given how many subtle data-quality gotchas (padding, truncation, sign conventions, date semantics) recurred even within TCL's single-domain (inventory) mapping.
- TCL treats 'fail fast on config errors, fail soft on network errors' as an explicit boot-time design principle — malformed .env = refuse to start with the exact missing variable name; ERP unreachable = start in degraded mode and keep serving cached data. This distinction is directly reusable for any new orderstock ERP-read module.

### Open questions

- Whether orderstock (Next.js 16 + Prisma 7 + mssql package) will port TCL's guard as a standalone TypeScript module (erp-adapter.ts's guardedQuery/assertReadOnlySql pattern is framework-agnostic and copy-pasteable) or reimplement equivalent logic natively in Prisma's query layer — not yet decided/researched; would need its own INNOVATE/PLAN pass.
- Whether the customer's ERP team (the same db_TCL owners) has PO, SO, or production/MRP tables at all, and if so their names/keys/status-flag semantics — completely unresearched in both TCL and orderstock repos; this is the single biggest gap standing between current knowledge and being able to plan the 3 requested dashboards.
- Whether orderstock would need a NEW read-only DB login (its own db_datareader-scoped account, separate from TCL's tcl_reader and separate from orderstock's own orderstock_app login already used for its own 9 tables) to query db_TCL's PO/SO/production tables directly, or whether it should go through TCL's/KRS's existing backend (NestJS API) instead of a second direct SQL Server connection into the same shared production database — unresolved, and given orderstock's own strong DANGER guardrails about db_TCL already documented in its own context (never migrate reset, never re-run schema scripts, never alter compatibility level), a SECOND independent direct-connection app touching the same live ERP DB raises new coordination questions (connection pool budget shared across orderstock + TCL + the ERP itself) that neither project's docs currently address.
- Whether TCL's stock-movements Phase 00 (ERP contract research for receipt/transfer/issue, including supplier/PO/production reference fields) has since progressed beyond the ⏳ PLANNED status seen in this scan (git log shows the plan committed 11-09-26 but the most recent commits, dated later, are all about scan/auth/warehouse fixes, suggesting Phase 00 may not have started) — worth re-checking TCL's repo state closer to when orderstock's dashboard planning actually begins, since its eventual findings (which ERP tables back PO/production references) would directly answer orderstock's dashboard data-source question.
- Exact production-DB governance model: is there a single ERP-team point of contact who must approve/provision any NEW read query pattern (beyond what TCL already reads), and would orderstock's dashboard queries share that same request queue/approval process as TCL's outstanding db_datareader login request — not documented, needs a direct question to the human stakeholder (the user), not just repo research.

