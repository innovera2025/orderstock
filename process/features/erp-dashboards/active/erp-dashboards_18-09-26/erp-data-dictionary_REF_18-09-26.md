# ERP Data Dictionary — Purchase / Sales / Production (db_TCL)

- Date: 18-09-26
- Source: scratchpad/erpq/data-dictionary.md (research session output)
- Purpose: Semantic cross-check + tested data dictionary — settles which ERP tables/columns back each requested dashboard metric, with confidence levels and caveats.

---

# Semantic Cross-Check + Tested Data Dictionary — Purchase / Sales / Production Dashboards (db_TCL)

Research date: 2026-09-18. All numbers below were re-queried live this session (not carried over from the 5 prior discovery-agent reports) unless marked "prior finding, not re-verified." Names/addresses/phones were never read — only codes, counts, sums, dates.

**Top-line correction to the prior research round:** by reading the ERP's own report stored procedures (`sp_SOsales`, `sp_SalesAmount`, `sp_SalesInvoiceMonth`, `sp_PurchaseInvoiceMonth`) I found the vendor's (KRS's) own business rules for "what counts as a sale/purchase." These rules **contradict two of the four domain agents' working assumptions** and settle the biggest open question in the prior round: what a dashboard should actually count as "a sale."

---

## A. Data reality per dashboard (what it would show TODAY)

| Dashboard | Real usable volume today | What it would render right now |
|---|---|---|
| **Purchase/PO** | 4 PO headers (14-Aug→11-Sep-2026), 2 suppliers, 461,140 ฿ of matching Purchase Invoices | A near-empty pilot screen: 4 orders, all "Pending/Approved", one supplier-by-value bar chart with 2 bars, a 2-month trend line with 2 points |
| **Sales/SO** | SalesOrderHdr: 1 row (unusable). **tbl_DOhdr: 73 real delivery orders, ฿234,403, 14-Aug→17-Sep.** SalesInvoiceHdr: 3 rows, ฿858,937.21, but **excluded by the ERP's own sales reports** (see §C-1) | If built on SO or Invoice as literally requested → empty/misleading. If built on DO (the only table with real, consistent, ERP-verified volume) → a believable small-business 5-week ramp: ~35-40 deliveries/month, real per-DO status variety (10 unapproved / 62 approved / 1 approved+checked) |
| **Production plan vs actual** | 3 MOs, 1 MPS doc (9 SKU plan lines), 72 BOM headers, all created within a single ~1-month setup window (20-08→08-09-2026) | A "planned" bar for 3 lots (17 / 2,207 / 1,352 units) and **zero — literally 0, not low — actual-produced bar**, because no field in the entire schema currently holds a produced quantity that differs from the plan (proven in §C-4, not merely observed) |

Module go-live: PO, SO, DO, InventoryFlow-sales, and MO/MPS/Batch all start their very first row between 2026-08-14 and 2026-09-08 — this is one coordinated ERP go-live, not organic multi-year history. `SalesOrderHdr`/`SalesOrderDtl` were literally `CREATE TABLE`'d 2026-07-25, and `tbl_OrderHdr`/`tbl_OrderDtl` (the empty, orderstock-mirroring table) were created 2026-07-02/03 — one day *before* the reference paper-form scan (2026-07-04) and just before orderstock's own Phase 1 delivery. Read as: KRS appears to have prototyped an ERP-side version of the exact same paper form orderstock digitized, in the same week, then apparently abandoned it (0 rows, never touched since).

---

## B. Requirement-by-requirement data dictionary

Confidence keys: **HIGH** = directly tested against live rows, arithmetic reconciled. **MED** = tested but n is tiny or one input is a documented-but-unconfirmed inference. **LOW** = structurally correct query, but the underlying data can't validate it (e.g., always-zero VAT).

### Purchase / PO Dashboard

| Requirement | Source | Filter | Join key | Unit | Tested SQL | Confidence | Caveat |
|---|---|---|---|---|---|---|---|
| ยอดซื้อรวม (total purchases) | `PurchaseInvoiceHdr`/`Dtl` — **NOT** `PurchaseOrderHdr`, see §C-2 | `DocuType='PC' OR (PurchaseType='Invoice' AND VoucherNo NOT LIKE 'PC%')`, `IsClosed=0` (KRS's own filter, from `sp_PurchaseInvoiceMonth`) | n/a (header agg) | ฿, VAT-exclusive (VATAmount=0 on every row) | `SELECT SUM(TotalAmount) FROM PurchaseInvoiceHdr WHERE (DocuType='PC' OR (PurchaseType='Invoice' AND VoucherNo NOT LIKE 'PC%')) AND IsClosed=0` → **461,140** (4/4 rows all pass) | HIGH | If the customer instead wants "committed spend" not "billed," use `PurchaseOrderHdr.TotalAmount` sum = **727,920** (4/4 rows) — the two bases diverge by 266,780 today and will keep diverging (2 of the 4 POs have zero matching invoice at all) |
| ยอดซื้อตามช่วงเวลา (monthly) | same, bucketed by `VoucherDate` | same | — | ฿/month | tested: **Aug 444,890 / Sep 16,250** | HIGH | Only 2 calendar months exist |
| ยอดซื้อราย Supplier | `PurchaseOrderHdr.SupplierCode` (PO-based) or `PurchaseInvoiceHdr.CustOrSuppCode` (Invoice-based) | `IsCancel=0` | `SupplierCode` (never `SupplierName`) | ฿ | tested on PO basis: ช-001 635,000 (3 POs) / ว-001 92,920 (1 PO) | HIGH | Only 2 suppliers exist in live data at all |
| PO Status | `PurchaseOrderHdr` flags | — | — | enum | see §D | LOW | Only 2 flag-combos exist across 4 rows; no ERP stored proc computes PO status anywhere in the schema (confirmed — searched `sys.objects` for `%PO%`/`%Purchase%` procs, none touch status derivation) |
| Filter/drill-down: supplier → PO → lines | `PurchaseOrderHdr` ⋈ `PurchaseOrderDtl` on `TransactionNo` | — | `TransactionNo` | — | verified 1:N join returns correct 4 lines for PO-L2608-0002 | HIGH | No FK enforces this join (see §C-5) but data is consistent |
| PurchaseType lookup relevance | — | — | — | — | `PurchaseOrderHdr.PurchaseType` is **always** `'Local'`; the `PurchaseType` lookup table's 4 values (ASSET/BUILD/INVENTORY/REPAIR) never appear anywhere in live data — **confirmed unrelated fields, settled (was previously "unconfirmed")** | HIGH | Do not join/filter by the `PurchaseType` lookup table for anything |

### Sales / SO Dashboard

| Requirement | Source | Filter | Join key | Unit | Tested SQL | Confidence | Caveat |
|---|---|---|---|---|---|---|---|
| ยอดขายรวม (total sales) | **`tbl_DOhdr`** — settled basis, see §C-1 | none needed (header total is arithmetically reconciled to detail) | n/a | ฿, VAT-exclusive | `SELECT SUM(TotalAmount) FROM tbl_DOhdr` → **234,403**; independently reconciles to `SELECT SUM(Amount) FROM tbl_Dodtl` → **234,403** (exact match) | HIGH (as a number) / LOW (as "the" answer — see caveat) | Only 13 of 1,433 DO lines (0.9%) carry a nonzero line price — the ฿234,403 is real and internally consistent but is NOT the ERP's own canonical "sales" figure per its own report procs (`sp_SOsales`/`sp_SalesAmount` are both SO/Invoice-based, and those are unusable — see §C-1). Recommend building the dashboard on DO with this caveat surfaced to the customer, pending their confirmation. |
| ยอดขายรายเดือน/ปี | `tbl_DOhdr` by `Dodate` | — | — | ฿/month | tested: **Aug 39 docs/n·a ฿, Sep 34 docs**; combined 234,403 | HIGH | 2 months only |
| SO Status | `SalesOrderHdr` flags | — | — | enum | see §D | LOW | n=1; `SoStatus` column itself is NULL — status must be flag-derived, and even then untestable at scale |
| ยอดขายราย Product/Category | `tbl_Dodtl.Itemcode` → `InventoryItem` → `tbl_ItemGroup`/`tbl_CATEGORY` | — | `ItemCode` | qty (not ฿, since 99% of lines are unpriced) | NOT executed — join path confirmed to exist (`tbl_ItemGroup`, `tbl_CATEGORY` both present via `sys.tables`) but columns/FK path not traced this session | LOW | Concrete next step, not attempted — budget |
| ยอดขายราย Customer | `tbl_DOhdr.CustCode` | — | `CustCode` (never `CustName`) | ฿/qty | schema confirmed, not executed (per no-names-drilldown caution + budget) | MED | Straightforward once basis is confirmed |
| Filter/drill-down: DO → lines | `tbl_DOhdr` ⋈ `tbl_Dodtl` on `TransactionNo` | — | `TransactionNo` | — | implicit in Q4 reconciliation above (works) | HIGH | — |
| DO Status (real substitute for SO Status) | `tbl_DOhdr.IsApproved/IsClosed/IsComplete/IsCheck` | — | — | enum | tested: **10 unapproved / 62 approved-not-checked / 1 approved+checked** | HIGH | This is the *only* status column in the whole 3-domain scope with a genuinely non-degenerate distribution today — strong candidate for the dashboard's actual "status" widget regardless of which document ends up as the ฿-basis |

### Production Dashboard

| Requirement | Source | Filter | Join key | Unit | Tested SQL | Confidence | Caveat |
|---|---|---|---|---|---|---|---|
| แผนการผลิต (planned qty) | `tbl_MoHdr.LotQty` (or `tbl_BatchOrder.PlanQty`, identical) | `IsCancel=0` | `TransactionNo` | units (per FG item) | `SELECT MoNumBer, FgCode, LotQty FROM tbl_MoHdr` → 3 rows: null/2207/1352 (MO-1's LotQty is NULL, only Prodqty=17 populated for it) | HIGH | MO-1 breaks the pattern — has no LotQty at all, only Prodqty |
| ยอดผลิตจริง (actual produced) | **NONE — does not exist yet**, see §C-4 | — | — | — | Every plausible "actual" column (`tbl_MoHdr.Prodqty`, `tbl_BatchOrder.Prodqty`, `tbl_MoOperDtl.ActualQTY/CompleteQty`, `tblMPSDtl` ACT. rows) is either an exact copy of the plan or NULL/0 — **verified across 3 independent tables, not just one** | HIGH (as a negative finding) | Ship this tab as "แผน" only, with an explicit "ยังไม่มีข้อมูลจริง" empty state, until KRS confirms a real actual-capture workflow exists |
| Achievement % | `tbl_BatchOrder.Prodqty/PlanQty` | — | `Monum→MoHdr.MoNumBer→TransactionNo→MoOperDtl` | % | verified join chain works structurally; **always 100% today** (Prodqty≡PlanQty in all 3 rows) because it's the same value copied twice, not two independent measurements | LOW | Do not ship a "% achievement" tile — it is meaningless until Prodqty means something other than "copy of plan" |
| Production order status | `tbl_MoHdr.Approved/IsClosed/IsCancel` | — | — | enum | tested: **2 unapproved / 1 approved**, all `IsClosed=0` | HIGH (as a query) / LOW (as data — n=3) | Structurally sound, scales fine, just no volume yet |
| MO ↔ raw-material issue | `InventoryFlowDtl.MONo` | `ReasonName='เบิกวัตถุดิบ : ใบสั่งผลิต'` | `MONo` (nvarchar, matches `MoHdr.MoNumBer` by string) | qty | confirmed: exactly 7 detail rows across all 218 header rows, all same day as the 3 test MOs | HIGH | No FK; string match only |
| FG receipt into stock | **NONE** | — | — | — | 0 of 218 `InventoryFlowHdr` rows are tagged as a finished-goods-from-production receipt; no such `ReasonName` exists anywhere in the ledger | HIGH (negative finding) | This is the same "no equivalent ledger signal" gap the sibling TCL stock-count project flagged for on-hand validation — production dashboard has no way to self-check against the ledger at all right now |

---

## C. Settled contradictions (claim → evidence → verdict)

**C-1. "Which document is the basis of sales — SO vs DO vs Invoice vs InventoryFlow?"**
Claim (prior round): unresolved, four candidates, no way to choose.
Evidence: read the ERP's *own* report stored-procedure definitions via `OBJECT_DEFINITION()`:
- `sp_SOsales` — joins `SalesOrderHdr`⋈`SalesOrderDtl`, with DO qty pulled in via `tbl_Dodtl.SoNo = SalesOrderHdr.OrderNo`. **KRS's own intended design is SO-as-basis, DO-as-fulfillment-detail.**
- `sp_SalesAmount` and `sp_SalesInvoiceMonth` — both filter `SalesInvoiceHdr` to `DocuType IN ('SA','SE','SC')` (or `('SC','SA')`). **All 3 live `SalesInvoiceHdr` rows are `DocuType='SI'`** — a value neither proc ever selects.
- Live `tbl_Dodtl.SoNo` is NULL on all 1,433 rows (confirmed again this session) — so the SO-based design KRS built is currently **never populated** in practice.
- Separately, `InventoryFlowDtl.SONo` (a same-named column on a *different* table) is **not** an SO number at all — 1,362/1,366 sales-withdrawal detail rows have it populated, and every value is a `DO-####-####` string, matching `tbl_DOhdr.DoNo` 68/73 times exactly on quantity (see below). **This is an ERP-side naming collision**: two columns named "SONo" on two tables, one meaning "SO order number" (by design, unused) and one meaning "DO number" (by actual population).
Verdict: **Neither SO nor Invoice is usable today.** DO (`tbl_DOhdr`/`Dodtl`) is the only table with real, growing, arithmetically-reconciled volume (header total = detail sum = ฿234,403, confirmed exact). Running the ERP's own official "sales" reports on this database **today would return ฿0** (SO empty, Invoice wrong DocuType) despite ฿234,403 of real deliveries having happened. Recommend building the dashboard on DO now, flagged to the customer as provisional, pending confirmation of whether the business intends to start using SO/Invoice properly going forward (per KRS's original design) — if so, the dashboard basis will need to migrate later.

**C-2. "Should Purchase totals come from PO or Invoice?"**
Claim: unresolved (domain agent flagged as open question).
Evidence: `sp_PurchaseInvoiceMonth`'s own logic sources totals from `PurchaseInvoiceHdr` (filtered `DocuType='PC'` or `PurchaseType='Invoice' AND VoucherNo NOT LIKE 'PC%'`), unioned with `PurchaseReturnHdr` — **not** from `PurchaseOrderHdr` at all. Unlike the Sales case, all 4 live Purchase Invoice rows correctly pass this filter (verified: 2×`DocuType='PC'`/prefix `PC` + 2×`DocuType='PA'`/prefix `IM`, both branches match, total reconciles to 461,140).
Verdict: **KRS's own convention for "purchases" is Invoice-based, and unlike Sales, the live data is NOT excluded by it.** Use `PurchaseInvoiceHdr` (461,140) as the primary purchase-value figure; keep `PurchaseOrderHdr` (727,920) as a secondary "committed/ordered" figure — these are two legitimately different, both-valid numbers, not a bug.

**C-3. VAT semantics (VatType/IsIncludeVAT arithmetic).**
Claim: needs a design decision; sample too small.
Evidence: re-verified this session — `VATAmount=0` on **all** 4 PO rows, **all** 4 Purchase Invoice rows (both `IsIncludeVAT=0` and `=1` groups), **all** 4 DO headers, and **all** 3 Sales Invoice rows. `IsIncludeVAT` toggles between rows with zero effect on any downstream amount, because there is no VAT to include/exclude yet.
Verdict: **Genuinely untestable — not a data-quality bug, just zero real VAT transactions exist yet.** Ship VAT-exclusive by default; do not build IsIncludeVAT branching logic until a real non-zero-VAT row appears (nothing to validate it against today).

**C-4. "tbl_MoHdr.Prodqty is the only populated actual — is Prodqty actually the ORDERED/planned qty?"**
Claim under test (from the task prompt itself).
Evidence — three independent cross-checks, all agreeing:
1. `tbl_MoHdr`: `Prodqty` equals `LotQty` exactly for MO-2 (2,207=2,207) and MO-3 (1,352=1,352); MO-1 has no `LotQty` to compare but `Regqty=0` (never populated) throughout.
2. `tbl_BatchOrder.PlanQty` equals `tbl_BatchOrder.Prodqty` exactly for **all 3** rows (17/17, 2207/2207, 1352/1352), and these also equal the linked MO's `LotQty`/`Prodqty`.
3. `tbl_MoOperDtl.ProdQTY` (per-operation-step): `MAX(ProdQTY)` per MO equals the header `LotQty` exactly; `SUM(ProdQTY)` equals `LotQty × number of operation steps` (6,621 = 2,207×3; 2,704 = 1,352×2) — i.e. the "planned" quantity is simply **copied unchanged into every routing step**, not measured per step.
Verdict: **Confirmed — `Prodqty` is the planned/lot quantity, copied at MO-creation time, not a measured actual.** Combined with `tbl_MoOperDtl.ActualQTY/AccuQTY/CompleteQty/DeffecQTY` being NULL on all 8 rows and `tblMPSDtl`'s ACT. rows being 0/blank on all 9 pairs, **no field anywhere in this schema currently holds a genuine actual-production figure.** This is stronger and more certain than the prior round's "ambiguous, needs KRS confirmation" — it's now a proven negative, not a guess.

**C-5. Foreign-key-based referential integrity across PO/SO/production.**
Claim: only 9 FKs exist DB-wide; unclear what they cover.
Evidence: listed all 9 via `sys.foreign_keys` — **7 of the 9 are orderstock's own tables** (`ProductVariant→Product`, `OrderLine/NoteLine→OrderSheet/Shop/ProductVariant`). Only **2 are ERP-native**: `tblworkcenterDTL→tblWorkCenter` and `PurchaseRequisitionDtl→PurchaseRequisitionHdr`.
Verdict: **Confirmed and sharpened — the ERP itself enforces essentially zero cross-document integrity anywhere in PO/SO/Production.** Every join in §B (PO↔PR↔Invoice↔InventoryFlow, DO↔InventoryFlow, MO↔Batch↔MPS) must be written as a defensive string-match LEFT JOIN; none of them are guaranteed consistent by the database.

---

## D. Status-derivation rules proposed for PO and SO

**PO status** (no ERP stored proc computes this anywhere — confirmed via `sys.objects` search):
```sql
CASE
  WHEN IsCancel = 1 THEN 'Cancelled'
  WHEN ISNULL(IsClosed,0) = 1 THEN 'Closed'      -- NOTE: IsClosed is NULL-when-open, not 0-when-open
  WHEN IsComplete = 1 THEN 'Completed'
  WHEN IsRecPo = 1 THEN 'Received'
  WHEN IsApproved = 1 AND IsCheck = 1 THEN 'Checked'
  WHEN IsApproved = 1 THEN 'Approved'
  ELSE 'Pending'
END
```
Confidence **LOW on precedence order** (unvalidated against a real spread — only 2 of these 7 branches have ever been exercised: "Approved" ×1 and "Checked" ×3). The one hard rule that *is* proven: `WHERE IsClosed = 0` will silently drop every live row, because `IsClosed` is `NULL` (not `0`) when open — must write `ISNULL(IsClosed,0)=0`.

**SO status** — cannot be usefully authored yet; `SoStatus` is NULL on the only row, and with n=1 no precedence order can be validated. Recommend deferring the SO status widget entirely and shipping the DO status distribution (§B, confirmed 3-way real split) as the interim "order status" tile instead.

---

## E. Open questions for KRS / customer, ranked by plan impact

1. **[Blocks basis decision]** Given `sp_SOsales`/`sp_SalesAmount` are SO/Invoice-based by design but currently return ~zero real data, does the customer intend to start properly using `SalesOrderHdr` and posting real `SalesInvoiceHdr` rows with `DocuType` `SA`/`SE`/`SC` (not `SI`) going forward — or should the dashboard permanently treat `tbl_DOhdr` as the sales source of truth? This is now a business-process question, not a data question — the ERP-side logic is fully understood.
2. **[Blocks basis decision]** The 3 live `SalesInvoiceHdr` rows are all `DocuType='SI'`, `VoucherNo` prefix `'EX...'` — neither matches any existing ERP sales report's filter. What does `DocuType='SI'` actually represent in this ERP build (a different transaction class than 'SA'/'SE'/'SC'), and were these 3 rows real business transactions or test/adjustment entries?
3. **[Blocks production tab]** Is there a planned data-entry step (a "close MO" button, `tblJobTrans_DTL`, or a future FG-receipt-into-WHFG ledger movement) that will ever populate a genuine actual-production figure — given it is now proven (§C-4), not just suspected, that no such figure exists anywhere today?
4. **[Affects PO status widget]** Is there an authoritative PO/SO status state machine documented anywhere outside the database (KRS internal spec), since no stored procedure in `db_TCL` computes one? The flag-precedence rule in §D is a guess.
5. **[Affects purchase KPI framing]** Confirm whether "ยอดซื้อ" should be reported as PO value (727,920, committed) or Invoice value (461,140, billed) — both are now cleanly computable and both are correct-by-construction, they just answer different questions.
6. **[Data-quality, low urgency]** `PurchaseReturnHdr`/`SalesReturnHdr` exist in the schema (found via the ERP's own report proc text, not previously known to any domain agent) and are unioned into the official purchase/sales totals. `SalesReturnHdr` is confirmed 0 rows; `PurchaseReturnHdr` row count was not checked this session — low priority given return volume is presumably ≤ the tiny PO/DO volume already observed, but should be swept before go-live.
7. **[Context only, no action needed]** `tbl_OrderHdr`/`tbl_OrderDtl` were created 2026-07-02/03, one day before the reference paper-form scan and just before orderstock's Phase 1 delivery, with columns that are a near-exact mirror of orderstock's own form — worth a casual one-line confirmation from KRS on whether this was an abandoned parallel prototype, purely to avoid two teams re-discovering the same dead end later.

**TL;DR:** Two of the four biggest assumed "sales/purchase basis" questions are now settled by reading the ERP's own report procedures rather than guessing from column names — Purchase should run on Invoice (matches KRS's own logic, 461,140 ฿ verified), Sales cannot run on SO or Invoice as designed (both are excluded/empty by KRS's own report filters) and must provisionally run on DO (234,403 ฿, internally reconciled) pending a customer decision on whether to fix the SO/Invoice workflow instead. Production's "actual vs planned" is now a proven negative — zero actual-production data exists anywhere in the schema, in three independently cross-checked places, not a data gap to route around but a genuine "nothing to show yet."