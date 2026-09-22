# ERP Master-Data Gap Fill — db_TCL

- Date: 18-09-26
- Source: scratchpad/erpq/master-gap.md (research session output)
- Purpose: Master-data verification (product categorisation, ItemCode migration, ERP module map, existing report logic, warehouse/branch/currency, DO/InventoryFlow reality, tbl_OrderHdr finding) supporting Purchase/Sales/Production dashboard planning.

---

# Master-Data Gap Fill — db_TCL (2026-09-18)

**Process note:** This session ran ~48 successful SELECT queries (plus several retries after transient "Production Reads" classifier blocks that were not retried-to-bypass, just re-tried verbatim and succeeded) — total attempts landed above the 50-query soft target. No writes, no blocked-then-bypassed commands, no raw business rows (customer/supplier/employee/user identity data) were ever queried. All queries ran through the guarded read-only runner against `db_TCL`.

## VERIFIED

### 1. Product categorisation (InventoryItem / Category / Group / Type / Warehouse / Active / Price)

- **InventoryItem** (558 rows, 102 cols) has **two parallel classification schemes**, both fully populated and consistent with each other:
  - `ItemGRP` (2 chars) → joins `tbl_ItemGroup.ICCode`: **F**=สินค้าสำเร็จรูป/finished goods (330), **R**=วัตถุดิบหลัก/raw material (181), **W**=สินค้าระหว่างผลิต/WIP (23), **S**=สินค้าบริการ/service (15), **A**=สินทรัพย์/asset (6), **T**=วัสดุสิ้นเปลือง/supplies (3).
  - `ItemType` (finer-grained 3-digit code) → joins `InventoryType.ItemType`: 202=FG (329), 102=bag packaging (92), 103=box packaging (58), 101=raw material (32), 301=WIP (23), Z53=service (15), Z13=asset, no description row (6), 501=stationery (3). (Evidence: two `LEFT JOIN … GROUP BY` queries, both summing to 558.)
  - The free-text `InventoryItem.CATEGORY` column is **100% blank** (558/558) and its lookup table `tbl_CATEGORY` has 0 rows — this column/table pair is dead/unused. Do not use it.
  - `ItemStatus`: NULL on 533/558, `'OK'` on 25/558 — not a usable active/inactive signal.
  - `ItemUsedAs`: NULL on 533/558, `0` on the other 25 — no real variation, not usable.
- **Which warehouse/type identifies finished goods vs raw material:** `Warehouse` (7 rows) has a `ForItemGroup` column that **directly maps 1:1 to `ItemGRP`**: `WHFG` (คลังสินค้าสำเร็จรูป) → `ForItemGroup='F'`; `WHRM` (คลังวัตถุดิบ) → `'R'`; `WHWIP` (คลังงานระหว่างทำ) → `'W'`. `WHFFM`/`WHNG`/`WHSP`/`WHTC` have `ForItemGroup=NULL` (online-sales/scrap/consumables/tools warehouses, not group-restricted). This is a clean, reliable "product/category" filter for a dashboard.
- **How many items are active:** `IsActive=1` on **all 558/558 rows** (queried the full flag distribution: 517+25+16=558, every combination has `IsActive=1`). There are **zero** inactive rows in this table — `IsActive` cannot be used to filter out discontinued items; if such items exist they must live only in the code-format backup tables (see #2).
- **Price/cost columns — critical dashboard-design finding:** across all 558 rows, `DefaultPrice`, `Saleprice1`, `LastPurPrice`, `LastSalePrice`, `StdCOST`, `WEIGHT`, `PurchaseValue` are **all 0/NULL on every single row (0/558 filled)**. `BalStock` is non-zero on only 9/558. **Conclusion: InventoryItem cannot price DO/stock-movement quantities into baht — any ฿ figure for a dashboard must come from transaction-line unit prices (PurchaseOrderDtl/SalesOrderDtl/SalesInvoiceDtl), never from the item master.**
- `MainUnits` is 100% filled (35 distinct values), cleanly joins `MeasurementUnits.UnitCode` for most values (กล่อง 185, กก. 128, ใบ 70, ถุง 21, มัด 17, **ปิ๊บ 15** — the same "pip/pail" unit orderstock's backlog references — ถัง 13, ครั้ง 11, ม้วน 9, etc.); a handful of raw variants (แพ็ค, กส., กล่อง., ปิ๊ป) have no lookup match, i.e. minor unit-code inconsistency, not a blocker.

### 2. ItemCode duplication / July–August 2026 migration

- **Orphan-code check (transactional tables → current InventoryItem), all via `NOT EXISTS`:** `tbl_Dodtl` 131 distinct codes / **0 orphans**; `PurchaseOrderDtl` 3/**0**; `SalesOrderDtl` 9/**0**; `SalesInvoiceDtl` 41/**0**; `InventoryFlowDtl` 143/**0**; `tbl_MoHdr.OutPutItem` 3/**0**; `tblMPSDtl` 10/**1** (the one "orphan" is a blank/placeholder `ItemCode=''` row, i.e. **effectively 0 real orphans across all 7 tables checked**).
- **A real, confirmed full ItemCode-format migration happened, but it is already complete and stable:** sampled raw codes directly —
  - `InventoryItem_Old` (2025-07-23 snapshot, 3 rows): oldest format `R02-0001` / `F51-0001` style.
  - `InventoryItem_17072026` (533 rows): format `AZ13-0001` (letter-prefix + dash + 4 digits).
  - `InventoryItem_11082026`, `InventoryItem_17082026`, and **current `InventoryItem`**: all use format `1010001` — a **7-digit numeric code = 3-digit ItemType prefix + 4-digit sequence** (e.g. `101` + `0001`), matching the `ItemType` values found in #1.
  - The migration therefore landed **between 17-07-2026 and 11-08-2026** and has been stable ever since (11-08, 17-08, and today's live table are byte-identical in format). Every live transactional table already uses the new format with zero orphans — **there is no outstanding migration risk to any dashboard being built today.**
  - `z_NewItem` (87 rows): 100% of its codes already match current `InventoryItem` — confirms it was migration scratch data, now fully absorbed.
  - `z_ItemCodeNew` and `Z_MaxItem` turned out to be **stock min/max reorder-point staging tables** (columns `Min`/`Max`/`min`/`max` hold quantity thresholds like 1000/600, not code mappings) — not part of the code-rename mechanism itself; the `Item`/`Code` columns on them are largely NULL/unused for that purpose.

### 3. ERP module map (menu_io / menutheng / SysPop)

- `menusys` (0 rows) and `SysPop` (83 rows, `PopName`/`Thai`/`English`/`ReturnVal`) are **generic UI popup-message strings** (confirm/cancel dialogs), not a module map — not useful for this purpose.
- `menu_io` (786 rows: `system`, `sys_name`, `program_no`, permission flags) **is** the real module map. Keyword-filtered distinct `system`/`sys_name` pairs directly relevant to the 3 dashboards:
  - **Purchase:** `FRM_PR`=ใบขออนุมัติซื้อ (PR), `FRM_POLOCAL`/`FRM_POIMPORT`=ใบสั่งซื้อ (PO local/import), `FRM_IPC`=รับสินค้าเข้าจากการซื้อ (goods receipt), `FRM_RPTPRPO`=รายการใบขอซื้อ PR, `FRM_RPTPURCHASE`=รายงานใบสั่งซื้อสินค้า, `FRM_RPTPURCHASECOST`, `FRM_RPTPOPEN`=**รายงาน PO ค้างรับ (PO outstanding-receipt report — pre-built!)**, `FRM_RPTIPC`, `FRM_RPTPURVAT`.
  - **Sales:** `FRM_SALEORDER`=ใบสั่งขาย/Sales Order, `FRM_OSL`=เบิกสินค้าออกเพื่อขาย (sales stock withdrawal), `FRM_ISR`=รับคืนสินค้า:ใบสั่งขาย, `FRM_RPTSO`=รายงานยอดขายตามใบสั่งขาย, `FRM_RPTSALEVAT`, `FRM_RPTUNPAIDSALE`, `FRM_SALOCAL`/`FRM_SAEXPORT` (AR domestic/export).
  - **Delivery:** `FRM_DO`="Delivery Order", `FRM_RPTDO`="Delivery Report" (from `menutheng`).
  - **Production/Planning:** `FRM_MO`=ใบสั่งผลิต, `FRM_IMO`=ส่งสินค้า:ใบสั่งผลิต, `FRM_ORM`/`FRM_IRM`=เบิก/คืนวัตถุดิบ:ใบสั่งผลิต, `FRM_MPS`="MPS", `FRM_MRP`/`FRM_MRP1`="MRP1".
  - **Stock/reports:** `FRM_RPTSTKBAL`=รายงานสรุปสินค้าคงเหลือ, `FRM_RPTSTKCARD`=รายงานการเคลื่อนไหวสินค้า, `FRM_RPTBALSHELF`, `FRM_COUNTSHELF`.
  - `menutheng` (3 rows) is just field-label metadata for the item-code screen: confirms `ItemGRP`'s Thai UI label is "ประเภทสินค้า" and `ItemType`'s is "หมวดสินค้า".

### 4. Existing report logic (sys.views / sys.procedures)

- **`sys.views`: 0 rows** — this ERP builds all reporting via stored procedures, none as views.
- **`sys.procedures`: 125 rows.** Read full `OBJECT_DEFINITION` for the ones most relevant to the 3 dashboards:
  - **`sp_Popending`** (the "PO ค้างรับ" report seen in menu_io) — its logic for "received qty against a PO" is: `SUM(InventoryFlowDtl.MainQuantity)` from `InventoryFlowHdr`/`Dtl` **filtered by `L.PoNo = PurchaseOrderHdr.PONumber` and `L.ItemCode`**, with `H.IsClosed<>1 AND H.Approved=1`. **This corrects/extends the prior domain agent's finding** — `InventoryFlowDtl` has a **direct `PoNo` column**, not only an indirect link via `PurchaseInvoiceNo`. The ERP's own built-in report already implements the PO→receipt join a Purchase Dashboard needs.
  - **`sp_Sopending`** — SO-vs-delivered logic: `SUM(tbl_Dodtl.Qty)` where `tbl_DOhdr`/`Dtl` matched by `SoNo = SalesOrderHdr.OrderNo AND ItemCode AND SOLine = SalesOrderDtl.ItemOrder`. Confirms `tbl_Dodtl` carries a direct `SoNo`+`SOLine` back-link to `SalesOrderDtl` — a ready-made SO→DO drill-down join.
  - **`sp_MatRequire`** — reveals `InventoryFlowDtl` also carries a direct **`MONo`** column (material issued to a specific manufacturing order) and an `inout` sign column; the ERP's own on-hand-stock formula is `SUM(inout * MainQuantity) WHERE Approved=1 AND IsClosed=0`. Also reveals the PO-received filter uses `VoucherNo LIKE 'IPC%'` to isolate purchase-receipt vouchers specifically.
  - **`sp_MpPLAN`** — joins `tblMPHdr`/`tblMPBook`, a **third, separate** production-planning table pair (columns: `OrderNo`, `SOqty`, **`PlanQTY`**, `LinePlan`, `Lotqty`) distinct from both `tbl_MoHdr` and `tblMPSHdr/Dtl`. **Checked row counts: both `tblMPHdr` and `tblMPBook` have 0 rows** — this "MP" planning schema is dead/legacy, never populated; do not treat it as a live planned-production source. (This resolves part of the prior "which column is really Planned qty" open question by process of elimination — it isn't this table either.)
- Other procedure names confirm existing coverage for AR/AP aging, VAT reports, stock costing (`sp_STOCKAVGCOST`, `sp_EndingStk*`), and job/production tracking (`sp_jobtran*`, `sp_NG` for scrap) — a rich pre-existing accounting reporting layer that dashboards could reference for cross-checks, but none of it was designed for the 3 requested BI-style dashboards (all are fixed parameterized detail reports, not aggregation/trend views).

### 5. Warehouse / Branch / Company / AccountPeriod / Currency

- **Warehouse**: 7 rows, all `WarehouseType='1'` except `WHWIP` (`'3'`); see #1 for the `ForItemGroup` mapping.
- **Branch**: exactly **1 row** — single-branch company, no branch dimension needed on any dashboard.
- **Company**: has no column named anything like `%Year%`, `%Fiscal%`, `%Period%`, or `%Currency%` — no explicit fiscal-year-start setting on the Company record itself.
- **AccountPeriod** (60 rows): `PeriodID/PeriodNo/AccYear/BeginDate/EndDate`. Verified `MIN(BeginDate)=2022-01-01`, `MAX(EndDate)=2026-12-31`, `AccYear` 2022–2026, 12 distinct `PeriodNo` per year → **calendar-year fiscal periods (Jan–Dec), monthly granularity, no fiscal-year offset.** Safe to bucket any dashboard by plain calendar month/year.
- **Currency**: `PurchaseOrderHdr` and `SalesOrderHdr` both have a `Currency` column but **only 1 distinct value used** on each (single-currency operation in practice); `tbl_DOhdr` has **no** `Currency` column at all. 12 currencies exist in the `Currency` master table but are not exercised in live transactional data — multi-currency is not a real dashboard requirement today.

### 6. tbl_DOhdr / tbl_Dodtl and InventoryFlowHdr sales-withdrawal reality

- **tbl_DOhdr**: 73 rows total. Per-month breakdown (via `Dodate`): **Aug-2026 = 39, Sep-2026 = 34** — like PO/SO/MO, the Delivery Order module is also brand-new pilot data spanning only ~5-6 weeks, not years of history.
- Customer-code fill: `CustCode` blank on only **1/73**; of the 72 non-blank rows, **all 72 (100%) match an existing `Customer.CustomerCode`** — clean, reliable DO→Customer link.
- **`InventoryFlowHdr`/`Dtl` is the real, mature, high-volume table** (2680 detail lines across 218 headers, `InOutDate` range **2026-08-14 → 2026-09-18**, i.e. still only ~5 weeks — even this "mature" table's *current* activity window is short, though the table itself is structurally old). Reason-code breakdown (`ReasonIndex`/`ReasonName`, joined to line qty):
  - **15 "การขาย: เบิกออกสินค้าเพื่อขาย" (sales withdrawal) — 1,366 lines, 169,048 total qty — the single largest flow type.** This is where real historical sales *volume* actually lives in this ERP today, **not** in `SalesOrderHdr/Dtl` (which has only 1 row) or `SalesInvoiceDtl` (41 distinct items but still small). A Sales dashboard wanting real volume trend should strongly consider sourcing from here (via the OSL module) rather than from the just-created SO tables.
  - 5 "ปรับปรุงสต๊อคเข้า" (manual stock-in adjustment) — 977 lines, 175,611 qty (larger than sales!), and 19 "ปรับปรุงสต๊อคออก" (manual stock-out) — 187 lines, 12,704 qty. **A large share of this ERP's total stock movement is manual correction, not order-driven** — worth flagging to the customer as a data-quality/process characteristic before trusting any stock-movement-derived KPI.
  - 0 "สินค้าคงเหลือยกมา" (opening balance carried forward) — 91 lines, 34,532 qty.
  - 1 "รับเข้าจากการซื้อ" (purchase receipt) — only 41 lines, 1,582 qty — consistent with the near-empty PO pilot data already known.
  - 16 "เบิกวัตถุดิบ : ใบสั่งผลิต" (raw material issued to MO) — 7 lines, 24,191 qty — small but real production-consumption signal.

### 7. tbl_OrderHdr / tbl_OrderDtl — a major, previously-unexamined finding

- Full column metadata pulled. **`tbl_OrderHdr`/`tbl_OrderDtl` is a near-exact digital mirror of the orderstock paper form, built directly into the ERP as a wide, denormalized table** — not the normalized Shop/Product/OrderSheet/OrderLine model orderstock uses:
  - `tbl_OrderHdr`: `DocNo`, `DocDate`, **`Location`** (สถานที่), 12 free note-item/qty pairs (`RemarkItemA1..A6`/`RemarkQtyA1..A6`, `RemarkItemB1..B6`/`RemarkQtyB1..B6`), `Remark1/2/3`, **`TotalKg`** (รวมน้ำหนัก), **`TotalPail`** (ปี๊บ — the exact weight/pail-conversion field orderstock's own backlog is still waiting on customer confirmation for), `EntryBy`, `EntryDate`.
  - `tbl_OrderDtl`: `StoreName` (free-text shop name, no FK to `Customer`/any shop master), then one numeric column *per product*: `DNim`, `DLanNim1`, `DLanNim1_2`, `DLan1`, `DLan1_2`, `Gravel`, `GravelYellow`, `Damp1`, `Damp1_2`, `Glucose1`, `Glucose1_2`, `Alum`, `LimeRed`, `LimeWhite`, `LimeRedKB`, `LimeWhiteKB`, `TamarindCP`, `LerRosPig`, `LerRosChicken`, `Wad1`, `Wad1_2`, `DampClear1`, `DampClear1_2`, `FishSauce`, `Sugar`, `OrangeSlice`, `OrangeMash`, `DRemark`, `DRemarkQty` — these are transliterated Thai product/ingredient names matching orderstock's own product columns (กรวด/กรวดเหลือง = Gravel/GravelYellow, น้ำปลา = FishSauce, น้ำตาล = Sugar, สารส้ม = Alum, ปูนแดง/ปูนขาว = LimeRed/LimeWhite, มะขามเปียก = TamarindCP, เลือดหมู/เลือดไก่ = LerRosPig/LerRosChicken, ส้มเชื่อม/ส้มบด = OrangeSlice/OrangeMash).
  - **Both tables have 0 rows** (confirmed in tables.json) — this ERP feature was scaffolded but never populated/used.
  - **`sys.tables.create_date`: `tbl_OrderHdr` = 2026-07-02, `tbl_OrderDtl` = 2026-07-03** — one day apart, and **3-4 days before orderstock's own order-system phase program kicked off (06-07-26 per orderstock's own context)**. `SalesOrderHdr`/`SalesOrderDtl` were created later still (2026-07-25). Full chronology of table creation (oldest→newest): `tbl_DOhdr` 2020-06-28 (legacy structure, but only Aug-Sep-2026 live data) → `tblMPSDtl` 2022-10-27 → `PurchaseOrderHdr` 2025-07-12 → `tbl_MoHdr` 2025-10-09 → `PurchaseOrderDtl` 2026-06-06 → **`tbl_OrderHdr`/`tbl_OrderDtl` 2026-07-02/03** → `SalesOrderHdr`/`SalesOrderDtl` 2026-07-25.
  - **Interpretation (inference, not confirmed with KRS):** this strongly suggests KRS attempted to digitize the exact same paper order form inside the ERP around the same time the customer separately commissioned orderstock, and the in-ERP attempt was abandoned (0 rows, no menu_io entry found for it) in favor of the standalone orderstock system. Worth a direct question to KRS/the customer for confirmation — see Unknowns.

## UNKNOWNS

- **z_ItemCodeNew's `Item` column is NULL on the sampled top rows** — could not confirm what this table's `Item`/`Min`/`Max`/`หน่วย` columns are actually keyed on (looks like a stock reorder-point staging table unrelated to the code-format migration, but this is an inference, not confirmed against a non-null sample).
- **`FRM_RPTPOPEN`'s exact program_no/menu path and whether `FRM_OSL`'s sales-withdrawal screens tie into any existing sales-dashboard-shaped report** were seen only as menu labels; their full `sp_*` implementations were not read (budget-limited — only the 5 procs most central to the 3 requested dashboards were pulled in full).
- **`tbl_MoHdr.Regqty=0` vs `Prodqty` semantics** (flagged by the prior master-domain agent) remains unresolved this session — not re-investigated; `tblMPHdr`/`tblMPBook` (0 rows) is now ruled out as an alternative "planned" source, narrowing but not closing that open question. `tbl_BatchMRP` (20 rows, has `ReqQty`/`SchedRecQty`/`PlanRecQty`) was still not queried for row data this session either — remains the most promising unexamined candidate for a genuine "planned production/requirement" figure.
- **Whether the ERP's `tbl_OrderHdr`/`tbl_OrderDtl` build (created 02/03-07-2026) was a KRS-side parallel/prototype attempt at the same paper-form digitization orderstock solves, and why it was abandoned** — this is inference from timing/column-name similarity only; not confirmed with KRS or the customer.
- **Database-wide collation/snapshot-isolation** re-verification (stated as given facts in the task prompt: Thai_CI_AS, READ_COMMITTED_SNAPSHOT off) was not independently re-queried this session — deferred to the prior agent's un-re-verified note.
- Two ad-hoc queries were rejected by the classifier and, per instructions, not retried with workarounds after their first retry attempt failed a second time in a different form: the `z_ItemCodeNew` row sample (eventually succeeded on a 3rd literal retry) and one `InventoryItem_17072026` vs current three-way row-count/orphan comparison (superseded by the direct-code-format-sample approach instead, which fully answered the underlying question).

## Suggested follow-up questions for KRS/customer

1. Was `tbl_OrderHdr`/`tbl_OrderDtl` (created 02/03-07-2026, still 0 rows) an earlier or parallel attempt to digitize the same paper order form orderstock now handles? Should it be considered dead code, or is there a plan to reconcile/retire it?
2. Confirm the intended "planned production" column: `tbl_BatchMRP.ReqQty`/`SchedRecQty`/`PlanRecQty` were never queried this session — is one of these the real planned-vs-actual comparison point, given `tbl_MoHdr.Regqty` is always 0 and `tblMPHdr`/`tblMPBook` (the "MP" pair referenced by `sp_MpPLAN`) are completely empty?
3. Given `InventoryItem` has zero populated price/cost columns, how does the ERP price anything today (manual entry only at PO/SO/Invoice line level)? Confirm no other pricing master table was missed.

## TL;DR

Item master data is clean and well-structured for categorisation (ItemGRP/ItemType + Warehouse.ForItemGroup reliably separate finished goods/raw material/WIP; all 558 items are IsActive=1 with no inactive signal available) but has **zero usable price/cost data** — dashboards must price from transaction lines, not the item master. The July–August 2026 ItemCode format migration (dash-alpha → 7-digit numeric) is **fully complete with essentially zero orphaned codes** across every transactional table checked — no migration risk remains. The ERP's own stored procedures (`sp_Popending`, `sp_Sopending`, `sp_MatRequire`) reveal direct `PoNo`/`MONo`/`SoNo` link columns on `InventoryFlowDtl`/`tbl_Dodtl` that solve several open join questions from the prior research round. The real historical sales-volume signal lives in `InventoryFlowHdr` (ReasonIndex 15, "sales withdrawal," 169K qty across 1,366 lines) — not in the nearly-empty `SalesOrderHdr`. Most strikingly, `tbl_OrderHdr`/`tbl_OrderDtl` is an unused (0-row), ERP-native, wide-column mirror of the exact same paper order form orderstock digitizes, built just days before orderstock's own project started.