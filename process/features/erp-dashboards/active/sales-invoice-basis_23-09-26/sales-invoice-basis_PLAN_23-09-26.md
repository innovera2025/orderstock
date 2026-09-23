---
name: plan:sales-invoice-basis
description: "Add invoice-basis sales figures (sp_SalesInvoice pattern) as the primary Sales dashboard number; keep DO basis as a secondary delivery section"
date: 23-09-26
feature: erp-dashboards
---

# Sales Invoice Basis — Plan

**Date**: 23-09-26
**Status**: PLAN — cycle-6 VALIDATE complete, Gate: CONDITIONAL, authorized for EXECUTE (see `## Validate Contract` for the one accepted execute-agent instruction on Step S11)
**Complexity**: COMPLEX (single plan, not a phase program — one execute pass with 14 dependency-ordered steps)
**Feature:** erp-dashboards
**Prior program:** `process/features/erp-dashboards/completed/erp-dashboards_18-09-26/` (COMPLETE, archived — read-only reference for conventions; do not reopen)

## Overview

This is a single COMPLEX plan (not a phase program) adding invoice-basis sales figures to the
existing `erp-dashboards` feature's Sales dashboard, per an explicit customer instruction naming
`sp_SalesInvoice` as the ERP's source-of-truth sales procedure. Context: `process/context/all-context.md`
(erp-dashboards program history) and `process/context/database/all-database.md` (live ERP schema
manifest + conformance gates). Test context: `process/context/tests/all-tests.md`.

## Why (customer instruction, verbatim)

> "PO : sp_Purchase — SO : sp_SalesInvoice — ที่นี่ไม่ทำ SO ไปดึงที่ Invoice"

Translation: this site does not use the ERP's Sales Order module. The customer's own ERP team
named `sp_SalesInvoice` as the source-of-truth procedure for sales figures — not
`sp_SOsales`/`sp_SalesInvoiceMonth`/`sp_SalesAmount` (all structurally dead on live data — see
Research Findings). Today's Sales dashboard is 100% delivery-order (DO) basis, which is real and
correctly reconciled, but represents a different business question ("what left the warehouse")
than the one the customer's finance team asks ("what did we invoice"). This plan adds the invoice
answer as the dashboard's primary number while preserving the DO answer as a secondary section —
neither view is removed.

## Headline numbers (so nobody mistakes this change for a bug)

| Basis | Before this plan | After this plan |
|---|---|---|
| Primary dashboard total | ฿234,403 (DO priced-lines only, 13 of 1,623 lines = 0.8% coverage) | ฿1,515,401.86 (4 invoices, full amount, 100% coverage) |
| Primary dashboard document count | 84 delivery orders | 4 sales invoices |
| Primary dashboard quantity | 192,925 units (all DO lines, priced + unpriced) | 6,887 units (84 distinct item codes, from `SalesInvoiceDtl`) |
| Delivery section (kept, secondary) | — | Same 84 DOs / 192,925 units, now labeled "การส่งมอบ" |
| Status donut | Lived in the (only) sales section | Moves to the delivery section unchanged |

This is a ~6.5x increase in the headline money figure and a ~95% drop in the headline document
count — both are correct and expected, driven by the fact that invoices carry the money and
deliveries carry the goods, and today only 4 of 84 DOs have ever been invoiced.

## Research Findings (locked — do not re-derive, do not re-query the live ERP)

Verified 23-09-26 against `db_TCL` (read-only, via `guardedQuery`). This section is the
authoritative record of what was checked; EXECUTE must not repeat these live-ERP queries.

### `sp_Purchase` — confirms existing PO-committed basis needs NO query rewrite
- Reads `PurchaseOrderHdr` ⋈ `PurchaseOrderDtl` only, never touches `PurchaseInvoiceHdr`.
- No `IsCancel`/`IsClosed`/`IsApproved` filter applied.
- Amount columns: `PurchaseOrderDtl.TotalPrice` (line), `PurchaseOrderHdr.TotalAmount` (header).
- `Recqty` (received quantity) is an UNFILTERED correlated subquery: `SELECT SUM(MainQuantity)
  FROM InventoryFlowDtl WHERE PoNo=... AND ItemCode=...`.
- Maps 1:1 onto the dashboard's EXISTING `db/erp-queries/purchase/total-po-committed-basis.sql`
  (727,920 THB / 4 POs). No rewrite needed — comment-only work (Steps P1–P2).
- Two deliberate divergences we KEEP (customer-approved), to be documented in comments, not undone:
  - `total-po-committed-basis.sql` / `supplier-breakdown.sql` add `IsCancel = 0` (currently a
    no-op — zero cancelled POs exist in live data today, but the filter is correct defensive
    intent and must stay).
  - `po-received.sql` uses the stricter `sp_Popending`-derived filter (`Approved=1 AND
    IsClosed<>1 AND VoucherNo LIKE 'IPC%'`) instead of `sp_Purchase`'s unfiltered `Recqty`. Both
    agree on today's single live receipt row (PO-L2608-0001 / item 1010001 = 400), so there is no
    observable discrepancy yet, but the stricter filter is the one we keep.

### `sp_SalesInvoice` — the new basis
- NOT an aggregate procedure — a document+line print query gated by required `SaleType`/
  `ItemType` params, no `DocuType` filter of its own.
- On live data it degenerates to: all `SalesInvoiceHdr` ⋈ `SalesInvoiceDtl` WHERE `IsClosed = 0`.
- Contrast procs `sp_SalesInvoiceMonth` / `sp_SalesAmount` filter `DocuType IN ('SC','SA',...)`
  and are STRUCTURALLY DEAD on this site (100% of live rows are `DocuType='SI'`). `sp_SOsales` is
  dead too (`SalesOrderHdr` has exactly 1 row in the whole database). None of these three procs
  are used as a model for this plan's queries.

### Live sales data facts (from direct read-only aggregate queries against db_TCL)
- `SalesInvoiceHdr`: 4 documents. ALL four share identical flag values: `DocuType='SI'`,
  `SaleType='Invoice'`, `ItemType='Item'`, `IsClosed=0`, `IsPaid=1`, `IsApproved=NULL`,
  `IVStatus=NULL`, `IsVAT=3`. Date range 2026-08-14 .. 2026-09-18.
  `SUM(TotalAmount) = 1,515,401.86`. `SubTotalAmnt = 1,515,401.86`, `DiscountAmount = 0`,
  `VATAmount = 0`, `AmountDue = 1,515,401.86` (full amount, despite `IsPaid=1` — the AR fields
  are not really in use on this site; do not build an "unpaid balance" widget on top of them).
  `ReceiptPaymentAmt = NULL` on all 4 rows.
- `SalesInvoiceDtl`: 84 lines, 55 distinct `ItemCode`s, 4 distinct customers (read from
  `SalesInvoiceHdr.CustOrSuppCode`, the header's customer field, NOT from a per-line grouping).
  **Correction (cycle-3 supplement):** `SalesInvoiceDtl` DOES have its own `CustOrSuppCode` column
  (confirmed in the verified 58-column list below) — but it is deliberately UNUSED by this plan's
  design. The header (`SalesInvoiceHdr.CustOrSuppCode`) is the authoritative customer of the whole
  document, and `invoice-by-customer.sql` groups by the header column per the locked design, not
  the per-line one — a header owns exactly one customer per invoice, so there is no reason to read
  a duplicate/derived value off each line. `SUM(Amount) = 1,515,401.86` (ties exactly to header
  total — no header/line reconciliation gap, unlike the DO basis). `SUM(MainQuantity) = 6,887`.
  100% of lines carry a non-empty `FlowNo` (prefix `OSL-`) and `OrderNo` (prefix `DO-2`) — every
  invoice line traces back to a delivery order line.
- Monthly split: 2026-08 = 2 invoices / ฿851,487.21; 2026-09 = 2 invoices / ฿663,914.65.
- Current DO basis for comparison: `tbl_Dodtl` has 1,623 lines, of which only 13 (0.8%) carry
  `Saleprice <> 0`; `SUM(Amount) = 234,403`; `SUM(Qty) = 192,925`; `tbl_DOhdr` = 84 headers.
- Linkage proof: invoice `SalesInvoiceDtl.OrderNo` = `tbl_DOhdr.DoNo`. Only 4 of the 84 DOs have
  ever been invoiced. Quantities tie exactly per DO except one partial split:
  - DO-2608-0007: 403 → 403 (invoice `Amount` is NULL on this one line — a priced-zero invoice
    line; the fetch layer must not crash on a NULL `Amount`, must treat it as 0)
  - DO-2608-0008: 3,907 → 3,907 = ฿851,487.21
  - DO-2609-0034: 25 → 25 = ฿7,450.00
  - DO-2609-0036: 3,933 → 2,552 (only 30 of 49 lines invoiced so far) = ฿656,464.65
- **Conclusion to encode in UI copy and code comments:** delivery orders carry the goods,
  invoices carry the money. The two views are complementary, not competing, and both stay on the
  dashboard.

### `SalesInvoiceDtl` real column list (from `sys.columns` — NOT yet in the manifest; Step S1 adds it)
`RowOrder, TransactionNo, ItemOrder, ItemCode, ItemSubCode, Description, MainQuantity, MainUnits,
ConvertRate, SecondQuantity, SecondUnits, SourceType, OrderNo, OrderTrNo, CustPONo, ItemType,
Material, ItemRefCode, AccountCode, AccountName, CustOrSuppCode, OEMNo, OTNNo, Model, Year,
Currency, UnitPrice, DiscountPercent, DiscountAmount, Amount, AmountBaht, QtyCnt, Carton, NW, GW,
Cum, CumTTL, TotalNw, TotalGw, InventoryJnl, RevenueJnl, CostOfSaleJnl, ForItemCode, ReturnQty,
IsPrintActual, IsPrintBank, IsPrintCustom, Notes, SecondUnitPrice, OurCode, FlowNo, FlowTrNo,
JobNo, JobTrNo, MAI_REPORT, PackingNo, PackingTrNo, NoRatePrice` (58 columns total)

**Hard reminder (a mistake already made and fixed once in the prior program):** the unit label on
every line MUST come from that line's own `MainUnits` column, never from the item master
(`InventoryItem`). Every new query in this plan must select `MainUnits` per line, not join a
"canonical unit" from the item table.

## Customer Decisions Already Locked (do not re-open as open questions)

1. **Sales page layout:** invoice basis becomes primary (headline money, main total, monthly
   trend, product/category/customer breakdowns). The existing DO view is KEPT as a secondary
   "การส่งมอบ" (Delivery) section (84 DOs / 192,925 units / delivery-status donut). Neither view is
   deleted.
2. **Status donut:** moves into the delivery (DO) section exactly as it exists today — no visual
   change to the donut itself, only its section placement. The invoice section gets NO status
   donut (all 4 invoices share `IsClosed=0`; a one-slice donut would be misleading, not informative).
3. **Purchase page:** unchanged layout, both totals (invoice-basis + PO-committed) stay at equal
   weight. The only purchase-side work in this plan is the two code-comment additions (Steps
   P1–P2) documenting the deliberate divergences from `sp_Purchase` found in research.

## Hard Constraints (non-negotiable — apply to every step below)

- **Read-only ERP, always.** Every ERP query goes through `guardedQuery()` in
  `src/lib/erp/erp-adapter.ts`. No INSERT/UPDATE/DELETE/DDL of any kind, ever, anywhere in this
  plan. No ERP table may ever enter `prisma/schema.prisma`.
- **Parameterized only.** Never concatenate a value into SQL text — same convention as every
  existing `db/erp-queries/**/*.sql` file.
- **Zero schema change** to the app's own 9 Prisma-modeled tables.
- **Money is server-gated by `canSeeMoney`.** STAFF must never see money anywhere, including CSV
  exports — money columns must be omitted entirely from STAFF exports, never blanked/masked.
- **Never 500 on ERP down.** Every new fetch must go through the same cache/degrade wrapper
  pattern as the existing `fetchDoHeaders`/`fetchDoLines`/etc. in `src/lib/sales-queries.ts`.
- **`db_TCL` is the customer's LIVE shared ERP database.** No automated test (unit or e2e) may
  contact it. All automated tests use the local `erp_fixture` sandbox DB or pure in-memory data.
- **Unit label rule:** always the line's own `MainUnits`, never inferred from the item master.
- **Never invent a column that doesn't exist.** A prior draft in this program invented
  `tbl_DOhdr.IsCancel` and took the dashboard down in production — every column referenced in new
  SQL must appear in the live manifest (Step S1 gates this for the new table) or in a verified
  `sys.columns` read (as done above for `SalesInvoiceDtl`).
- **Every `.sql` file on disk must have a matching `ERP_QUERY_COLUMNS` contract entry** in
  `src/lib/erp-query-columns.ts` — `erp-query-schema-conformance.test.ts` enforces this in
  both directions (a query file with no contract entry fails; a contract entry with no matching
  file fails). See Step S3/S6 below.

## Touchpoints

| Path | Change |
|---|---|
| `db/erp-schema/live-manifest_23-09-26.json` | ADD `dbo.SalesInvoiceDtl` (58 columns, from verified `sys.columns` read above). `dbo.SalesInvoiceHdr` is ALREADY present (151 columns, confirmed by direct read at supplement time) — no re-verification needed, see Step S1. |
| `db/erp-fixture/00-schema.sql` | ADD a `CREATE TABLE dbo.SalesInvoiceDtl (...)` block (58 columns, same name/order/type/nullability as the new manifest entry), generated per the procedure `db/erp-schema/README.md` documents ("after refreshing this manifest: regenerate the CREATE TABLE blocks in 00-schema.sql"). The manifest edit and this DDL edit are ONE atomic change — `erp-fixture-schema-conformance.test.ts`'s table-set-equality assertion fails the instant only one side lands. See Step S1. |
| `src/lib/sales-basis-core.ts` | `SalesBasis` type gains `"invoice"`; `resolveSalesBasisFromValue` gains a real branch (currently narrows everything to `"do"`). Pure, DB-free — unit-testable with zero preconditions. |
| `db/erp-fixture/sales-seed.sql` | EXTEND with synthetic `SalesInvoiceDtl` rows (currently zero rows exist against the 3 already-seeded `SalesInvoiceHdr` headers). New Step S2b, must run before Step S3. |
| `db/erp-queries/sales/invoice-headers.sql` (NEW) | `SalesInvoiceHdr` list/aggregate for a date range: doc count, `SUM(TotalAmount)`, monthly split shape. Mirrors `do-headers.sql`. |
| `db/erp-queries/sales/invoice-lines.sql` (NEW) | `SalesInvoiceDtl` line-level rows for a given invoice/date range: `ItemCode`, `Description`, `MainQuantity`, `MainUnits`, `UnitPrice`, `Amount` (NULL-safe), `CustOrSuppCode` (via header join), `OrderNo`. Mirrors `do-lines.sql`. |
| `db/erp-queries/sales/invoice-by-product.sql` (NEW) | Per-product breakdown reusing the PROVEN canonical-item CTE + category join pattern from `db/erp-queries/sales/do-by-product.sql` (`InventoryItem.ItemGRP → tbl_ItemGroup.ICCode/Description`; `ItemCode` is NOT unique in `InventoryItem` — ~85 duplicate rows exist — highest `Roworder` wins). |
| `db/erp-queries/sales/invoice-by-customer.sql` (NEW) | Per-customer breakdown, `GROUP BY SalesInvoiceHdr.CustOrSuppCode`. Mirrors `do-by-customer.sql`. |
| `db/erp-queries/sales/invoice-date-range.sql` (NEW) | `MIN(InvDate)`/`MAX(InvDate)` across `SalesInvoiceHdr`, mirrors `do-date-range.sql`. Feeds the page's date-range picker bounds. |
| `db/erp-queries/sales/sales-invoice-excluded-total.sql` (EXISTING — KEEP, comment rewritten) | **Decision locked (Step S4, resolved — no longer an open judgment call):** KEEP the query file as-is; it takes no date-filter parameters by design (an unconditional full-pool total), whereas the new `invoice-headers.sql` is date-range-filtered — genuinely different shapes, not a duplicate. Rewrite ONLY the header comment and any Thai/English label text that calls this money "excluded" — it is no longer excluded, it is the same pool now surfaced as the primary figure (unfiltered variant). |
| `src/lib/erp-query-columns.ts` | ADD one `ERP_QUERY_COLUMNS` entry per new `.sql` file (5 new invoice queries). Required by `erp-query-schema-conformance.test.ts` in both directions — a query file with no entry, or an entry with no file, both fail. See Step S3/S6. |
| `src/lib/erp/live-reconcile-script.ts` | One of 4 importers of `SALES_INVOICE_EXCLUDED_TOTAL_SQL` (confirmed via grep). Since Step S4 KEEPS this query, the import stays valid with no code change required here — but its Thai/English comments and any "excluded" framing in its own output text must be updated to match the new primary-figure framing (Step S4 scope, not a separate step). |
| `src/lib/erp/dashboard-export-target.ts` | **Type AND runtime call sites, not type-only (cycle-5 fix).** `ExportTable` type widened ADDITIVELY from `"list" | "lines"` to `"list" | "lines" | "invoice-list" | "invoice-lines"` (see Public Contracts). `"list"`/`"lines"` KEEP their current meaning (the DO/delivery tables, and the purchase/production dashboards' existing usage) unchanged — only the two new invoice shapes are added, so nothing outside this plan's blast radius changes. **`deriveExportTarget()`'s sales branch (currently line 51-54: `return { dashboard: "sales", table: one(searchParams.doNo) ? "lines" : "list" };`) must be rewritten to derive the table from the section (`invoice` vs `delivery`) using the same `view`/`invoiceNo`/`doNo` state `sales-url.ts`'s own parser resolves — NOT from `doNo` presence alone.** Concretely: when the resolved section is `invoice`, return `table: "invoice-lines"` if `invoiceNo` is present else `"invoice-list"`; when the resolved section is `delivery`, keep the existing `doNo`-presence check unchanged (`"lines"` if `doNo` present else `"list"`). **`parseExportTarget()` (currently line 97-105: `if (table !== "list" && table !== "lines") return null;`) must accept all four `ExportTable` values** — widen the allow-list to include `"invoice-list"`/`"invoice-lines"`, and re-read the `key`-required check (`table === "lines" && dashboard !== "sales" && (key == null || key === "")`) against the new sales shapes: sales already carries its drilldown in the query string rather than `key` for `"lines"`, so `"invoice-lines"` follows the identical "sales never requires `key`" rule — no `key` requirement is added for either new sales value. Existing consumers (purchase/production) are re-checked with `tsc --noEmit` as a regression confirmation, not a rescue. |
| `src/app/api/dashboards/export/export-datasets.ts` (NEW touchpoint, cycle-5 fix) | `loadExportDataset()`'s switch on `` `${target.dashboard}:${target.table}` `` (currently: `sales:list`, `sales:lines`, `purchase:list`, `purchase:lines`, `production:list`, with a catch-all `default: return productionLines(target.key ?? "");`) gains two new explicit cases, `sales:invoice-list` and `sales:invoice-lines`, dispatching to new `salesInvoiceList`/`salesInvoiceLines` functions mirroring the existing `salesList`/`salesLines` pattern at lines 76-147 (parse via `sales-url.ts`, fetch via the Step S7 wrappers, sort via `salesSortRows`, filter columns by `canSeeMoney`). **The silent catch-all is also fixed as part of this touchpoint (not optional hardening — required by this plan since it directly enables the wrong-data-served risk the new invoice shapes would otherwise hit):** add an explicit `case "production:lines":` for the one shape the `default` branch currently stands in for, and change `default:` to throw/return an explicit rejection (400-equivalent) for any unrecognized `dashboard:table` pair, so an unwired or future-typo'd pair can never silently serve another dashboard's rows under a different dashboard's filename. |
| `src/app/(main)/dashboards/sales/sales-url.ts` | `view` enum extended to carry the section identity directly: `"summary" | "invoice-documents" | "invoice-lines" | "delivery-documents" | "delivery-lines"` (exact final member names decided at EXECUTE to match the file's existing naming style — see Step S10/S8). New `invoiceNo` param added, mirroring the existing `doNo` param's null/empty handling and href-preservation behavior exactly. Product/customer breakdown pagination/sort keys are namespaced per section (extending the file's existing `productPage`/`customerPage` precedent) so the summary view's two simultaneous sections never collide. |
| `db/erp-queries/purchase/total-po-committed-basis.sql`, `supplier-breakdown.sql` | Comment-only: document the `IsCancel=0` divergence from `sp_Purchase` (Step P1). |
| `db/erp-queries/purchase/po-received.sql` | Comment-only: document the stricter-filter divergence from `sp_Purchase`'s unfiltered `Recqty` (Step P2). |
| `src/lib/sales-sql.ts` | Mirror EVERY new/changed `.sql` file above BYTE-IDENTICALLY (existing drift test enforces this — see `process/context/tests/all-tests.md` for the exact test file). |
| `src/lib/purchase-sql.ts` | Mirror the two comment-only purchase SQL changes byte-identically (same drift test). |
| `src/lib/sales-queries.ts` | Add `fetchInvoiceHeaders`, `fetchInvoiceLines`, `fetchInvoiceByProduct`, `fetchInvoiceByCustomer`, `fetchInvoiceDateRange` wrappers, reusing the EXACT existing cache/degrade/`CachedResult<T>` pattern (see `runSalesQuery<T>` at line 143 and the `fetchDo*`/`fetchExcludedInvoiceTotal` wrappers at lines 162–210). `fetchExcludedInvoiceTotal` stays (Step S4 KEEP decision) — no removal. |
| `src/app/(main)/dashboards/sales/page.tsx` | HIGHEST RISK touchpoint (300 lines today). Currently calls `resolveSalesBasis()` and discards the result — restructure into invoice-primary layout + delivery-secondary section, driven by the extended `view` param (not a nested route). Each of the two sections resolves and renders its own data/degraded-state independently (see Step S8 Gap 7 decision) — an invoice-only ERP failure must not blank the already-working delivery section. Every widget on this page currently reads from the DO fetch functions; each one needs an explicit decision (moves to delivery section unchanged, OR is duplicated/adapted for the invoice section). |
| `src/app/(main)/dashboards/sales/*` (siblings of page.tsx — status donut, product/customer breakdown components, CSV export buttons) | `sales-status-donut.tsx` moves into the new delivery section, otherwise unchanged. Any shared breakdown-table component used for DO product/customer views is reused (not forked) for the invoice section — confirm column-shape compatibility at Step S8. |
| Invoice drilldown (search-param based, on the SAME `/dashboards/sales` page — NOT a nested route; mirrors the existing `doNo` param precedent) | New per-invoice detail view rendered via `?invoiceNo=` on the existing page, per the `sales-url.ts` change above. |
| CSV export call sites touching sales tables | Must keep working for every table including new invoice tables, with the STAFF money-omission rule intact, using the widened `ExportTable` shape (Step S11). |
| Test files: `src/lib/__tests__/sales-basis-reconciliation.test.ts` (existing file — extend the existing `describe("resolveSalesBasisFromValue — the sales-basis switch decision", ...)` block; do NOT create a new `sales-basis-core.test.ts` file, cycle-5 fix), a new invoice-fetch unit test file, a new unit test file (or extension) covering `dashboard-export-target.ts`'s round-trip and `export-datasets.ts`'s dispatch (cycle-5 addition), `e2e/dashboards-sales.spec.ts` | Extend to cover the invoice basis; re-run full existing DO-path suite as a regression gate (Step S12). DO-path test ASSERTIONS may need updating for the new section layout (donut relocation) even though DO-path DATA/LOGIC is unchanged — see reworded Acceptance Criterion 5. |
| `src/app/(main)/dashboards/sales/sales-unavailable-fragment.tsx` (NEW, cycle-5 fix) | Extracted from `sales-unavailable.tsx`'s inner notice block (the red banner `data-testid="sales-erp-unavailable"` + "ยังไม่มีข้อมูลที่จะแสดง" card) into a small, section-scoped component with its own `data-testid` per instance (e.g. `sales-invoice-unavailable` / `sales-delivery-unavailable`), so it can render once per section without duplicating the page shell (`<main data-testid="sales-dashboard">`, the `<h1>ยอดขาย</h1>` header, `<PilotBanner/>`, `<SalesFilterBar/>`). `sales-unavailable.tsx` itself is KEPT UNCHANGED as the whole-page fallback for the case where BOTH sections have no data and nothing is cached anywhere — its existing e2e gates (`data-testid="sales-dashboard"`, `data-testid="sales-erp-unavailable"`) keep passing unmodified. |
| `src/lib/sales-basis-core.ts`'s `reconciliationNote()` (cycle-5 addition to S13 scope) | Thai template string (`"มียอดใบแจ้งหนี้ขาย (SalesInvoiceHdr) อีก ... ที่ไม่ถูกนับรวมในยอดนี้ เนื่องจากยังไม่ใช่ฐานข้อมูลที่ใช้ในแดชบอร์ดนี้"`) is the ACTUAL "excluded" framing referenced by Step S13 — rewritten per the Step S13 decision below. |
| `src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx` (cycle-5 addition to S13 scope) | The render site calling `reconciliationNote(excludedInvoiceCount, excludedInvoiceTotal)` (line 143) — updated per the Step S13 decision below: either kept as a reworded reciprocal cross-reference footnote in the Delivery section, or retired from this render path entirely (decided explicitly in Step S13, not left implicit). |
| `db/erp-fixture/sales-seed.sql` comment (cycle-5 addition to S13 scope) | The stale `-- dbo.SalesInvoiceHdr — the EXCLUDED pool...`-style comment (or equivalent framing) is rewritten to match the new primary-figure framing, same rule as Step S4/S13. |
| `src/app/(main)/dashboards/sales/sales-unavailable.tsx` subtitle (cycle-5 addition to S13 scope) | The subtitle `"ข้อมูลจากใบส่งสินค้าในระบบ ERP (อ่านอย่างเดียว)"` (line 35) is DO/delivery-basis framing that becomes misleading once invoice is primary — added to Step S13's copy checklist. |

## Public Contracts

- `SalesBasis` type: adding `"invoice"` is an additive union member — any exhaustive switch over
  `SalesBasis` elsewhere in the codebase (grep for `SalesBasis` usages beyond
  `sales-basis-core.ts` before Step S2) must be updated to handle the new member, or TypeScript
  will fail to compile (a `never`-exhaustiveness check would catch this; a plain `if`/`else`
  chain silently falls through — grep first to know which shape exists). Confirmed at supplement
  time: only two call sites exist repo-wide (`sales-basis.ts`/`sales-basis-core.ts`), so this is
  low-risk in practice.
- **`sales-url.ts` full param contract (final list — must match this exactly, or state and justify
  any deviation in the EXECUTE report):**
  - `view`: `"summary" | "invoice-documents" | "invoice-lines" | "delivery-documents" |
    "delivery-lines"` (exact member names may be adjusted at EXECUTE to match the file's existing
    naming conventions, but the 5-value shape — one summary view plus 2 sections × 2 depths — is
    locked). Default: `"summary"`. On `"summary"`, BOTH the invoice section and the delivery
    section render simultaneously.
  - `invoiceNo`: NEW. Applies to the invoice section only. Selects one invoice for the drilldown
    view. Null/empty clears it and returns to the section's list view — same handling as the
    existing `doNo` param.
  - `doNo`: EXISTING, unchanged. Applies to the delivery section only. Same null/empty/href
    behavior as today.
  - `customer`, `product`, `cat`, `status`: EXISTING, unchanged in name. On the `summary` view,
    `customer`/`product` filter BOTH sections' breakdown tables. `cat` behaves DIFFERENTLY per
    section (decided here, not left to EXECUTE):
    - **Delivery section:** unchanged — `cat` narrows `do-headers.sql`'s breakdown table, and the
      existing `skipCat` semantics are preserved so the category pie keeps showing every slice even
      when one is selected (there IS a chart to protect here).
    - **Invoice section:** `cat` is a NARROWING FILTER ONLY on the invoice product-breakdown
      table — there is no `skipCat`-equivalent and no category chart/pie to protect, because
      Customer Decision #2 gives the invoice section no donut/pie at all. Selecting a category
      simply filters the invoice breakdown rows shown; no other invoice widget needs to keep
      showing "every slice."
    `status` applies to the delivery section only. The invoice section has NO status filter at
    all (not just no donut) — decided here because all 4 live invoices share the identical status
    values (`IsClosed=0`, `IsApproved=NULL`, etc., per Research Findings), so an invoice status
    filter would have exactly one possible value and would be meaningless UI, not a useful gap.
  - `productPage` / `customerPage`: EXISTING, but now split into per-section pairs — e.g.
    `invoiceProductPage`/`invoiceCustomerPage` and `deliveryProductPage`/`deliveryCustomerPage` (or
    equivalent naming EXECUTE finalizes to match the file's existing style) — so the two
    simultaneously-rendered summary-view breakdown tables never share a pagination/sort key.
  - **Backward compatibility — precedence rule (explicit, decided here, not left to EXECUTE):**
    `doNo`/`invoiceNo` presence is checked FIRST and drives the drilldown regardless of the `view`
    value; only if NEITHER is present does an unrecognized `view` value fall back to `"summary"`
    (mirroring the existing pre-plan `sales-url.ts` check order — presence-of-drilldown-param
    beats view-value validity). Concretely: a stale inbound link with the OLD `?view=documents` (or
    any other pre-this-plan `view` value), a bare `?doNo=` with no `view`, and the COMBINED case
    `?view=documents&doNo=DO-2608-0008` (unrecognized `view` value AND a `doNo` present at the same
    time) must all still resolve to a sane page. In every one of these cases, `doNo` alone
    continues to drive the DELIVERY section's drilldown (a bare legacy `doNo` with no `view` has
    always meant "show me this delivery order," and that meaning is preserved) — `invoiceNo`
    follows the identical precedence rule for the invoice section. This exact precedence, including
    the combined stale-view+doNo case, must be covered by a unit test on `sales-url.ts`'s parsing
    function (see Step S8's Fully-Automated test list).
- No public HTTP/API route contract changes — this dashboard has no external API surface, only
  server components reading via `guardedQuery`.
- `ExportTable` type (in `dashboard-export-target.ts`) widens ADDITIVELY from `"list" | "lines"` to
  `"list" | "lines" | "invoice-list" | "invoice-lines"`. `"list"`/`"lines"` keep meaning the
  DO/delivery tables and the purchase/production dashboards' existing usage — unchanged, no
  consumer outside this plan's blast radius is touched. Only the two new invoice-only shapes are
  added. This is a genuinely additive contract change (not a rename), so no existing consumer can
  hit a compile break; `tsc --noEmit` across every existing consumer (purchase and production
  dashboards also import this module) is still run as a regression check, not a rescue — document
  the check result in the phase report equivalent (this plan's Resume section).
- CSV export column contract for the sales tables changes (new invoice columns) — this is an
  additive contract change to an internal-only export, not a versioned public API; document the
  new column set in the plan's Verification Evidence, not as a breaking-change concern.

## Blast Radius

Files touched (all within `erp-dashboards` feature scope, zero touch on `order-system` /
`pguard-redesign` surfaces):

1. `db/erp-schema/live-manifest_23-09-26.json`
2. `db/erp-fixture/00-schema.sql` (new `CREATE TABLE dbo.SalesInvoiceDtl` block — one atomic change with item 1, Step S1)
3. `src/lib/sales-basis-core.ts`
4. `db/erp-fixture/sales-seed.sql` (extended with `SalesInvoiceDtl` rows — new, Step S2b)
5. `db/erp-queries/sales/invoice-headers.sql` (new)
6. `db/erp-queries/sales/invoice-lines.sql` (new)
7. `db/erp-queries/sales/invoice-by-product.sql` (new)
8. `db/erp-queries/sales/invoice-by-customer.sql` (new)
9. `db/erp-queries/sales/invoice-date-range.sql` (new)
10. `db/erp-queries/sales/sales-invoice-excluded-total.sql` (comment rewritten only — KEPT, not deleted)
11. `src/lib/erp-query-columns.ts` (new entries for the 5 new query files)
12. `src/lib/erp/live-reconcile-script.ts` (comment/label text only — its SQL import stays valid)
13. `src/lib/erp/dashboard-export-target.ts` (`ExportTable` type widened ADDITIVELY — `"list"`/`"lines"` unchanged, `"invoice-list"`/`"invoice-lines"` added; `deriveExportTarget()` and `parseExportTarget()` FUNCTION BODIES also rewritten, cycle-5 fix — not type-only)
13a. `src/app/api/dashboards/export/export-datasets.ts` (NEW to blast radius, cycle-5 fix — `loadExportDataset()` gains `sales:invoice-list`/`sales:invoice-lines` cases, an explicit `production:lines` case, and a rejecting `default:`)
14. `src/app/(main)/dashboards/sales/sales-url.ts` (`view` enum extended, `invoiceNo` param added, per-section pagination keys)
14a. `src/app/(main)/dashboards/sales/sales-unavailable-fragment.tsx` (NEW, cycle-5 fix — scoped per-section fragment extracted from `sales-unavailable.tsx`'s inner notice block)
14b. `src/lib/sales-basis-core.ts`'s `reconciliationNote()` (cycle-5 addition — the real "excluded"-framing Thai template, S13 scope)
14c. `src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx` (cycle-5 addition — the render site calling `reconciliationNote()`, S13 scope)
14d. `db/erp-fixture/sales-seed.sql` comment (cycle-5 addition — stale "excluded" framing comment, S13 scope)
15. `db/erp-queries/purchase/total-po-committed-basis.sql` (comment only)
16. `db/erp-queries/purchase/supplier-breakdown.sql` (comment only)
17. `db/erp-queries/purchase/po-received.sql` (comment only)
18. `src/lib/sales-sql.ts`
19. `src/lib/purchase-sql.ts`
20. `src/lib/sales-queries.ts`
21. `src/app/(main)/dashboards/sales/page.tsx`
22. `src/app/(main)/dashboards/sales/sales-status-donut.tsx` (moved, likely not content-changed)
23. CSV export helper(s) feeding the sales page tables (additively widened `ExportTable` consumers)
24. Unit test files (new + extended existing, incl. `sales-url.ts` parsing/back-compat tests)
25. `e2e/dashboards-sales.spec.ts` (extended)

**No schema migration, no auth changes, no changes outside `src/`, `db/`, and test files.**
STAFF-visible surface changes (money omission on new tables) are covered by hard constraints
above, not new logic to invent — reuse the existing `canSeeMoney` gate exactly as it already
gates the DO tables.

## Implementation Checklist (Dependency-Ordered)

Steps must run in this order — each step's Verification gates the next.

### Step P1 — Purchase: document `IsCancel=0` divergence
Add a code comment (not a logic change) to `db/erp-queries/purchase/total-po-committed-basis.sql`
and `db/erp-queries/purchase/supplier-breakdown.sql` explaining: `sp_Purchase` applies no
`IsCancel` filter; this dashboard adds `IsCancel = 0` as defensive intent (currently a no-op —
zero cancelled POs exist today) and this filter is intentionally KEPT, not removed.
**Verification:** `git diff` shows comment-only change, no WHERE-clause text altered. Mirror into
`src/lib/purchase-sql.ts` in the same step (Step P1 and the mirror are one atomic change).

### Step P2 — Purchase: document `po-received.sql` divergence
Add a code comment to `db/erp-queries/purchase/po-received.sql` explaining: `sp_Purchase`'s
`Recqty` is an unfiltered correlated subquery over `InventoryFlowDtl`; this dashboard instead uses
the stricter `sp_Popending`-derived filter (`Approved=1 AND IsClosed<>1 AND VoucherNo LIKE
'IPC%'`); both agree on today's single live receipt row but the stricter filter is intentionally
KEPT. Mirror into `src/lib/purchase-sql.ts`.
**Verification:** comment-only diff; `node .claude/skills/vc-audit-context/scripts/...` not
needed — this is covered by the existing purchase-sql drift test (Fully-Automated, see Test Plan).

### Step S1 — Manifest: add `SalesInvoiceDtl`
1. Add `dbo.SalesInvoiceDtl` to `db/erp-schema/live-manifest_23-09-26.json` using the exact
   58-column list verified above. `dbo.SalesInvoiceHdr` is ALREADY present in the manifest (151
   columns, confirmed by a direct read at supplement time — the prior program's Phase 2 captured
   it while building `sales-invoice-excluded-total.sql`) — no re-verification or conditional
   branch is needed, add only the `SalesInvoiceDtl` entry.
2. **In the SAME step (this is one atomic change, not two sequential ones):** add a matching
   `CREATE TABLE dbo.SalesInvoiceDtl (...)` block to `db/erp-fixture/00-schema.sql` — same 58
   columns, same name/order/type/nullability as the manifest entry, generated per the procedure
   `db/erp-schema/README.md` documents ("after refreshing this manifest: regenerate the CREATE
   TABLE blocks in 00-schema.sql, then re-run the conformance gate"). The manifest and the fixture
   DDL must land together: `erp-fixture-schema-conformance.test.ts` asserts the fixture's table set
   equals the manifest's table set, so adding only one side hard-fails immediately.
**Verification (Fully-Automated, gates S3):** run BOTH conformance tests — the manifest
conformance test (`process/context/database/all-database.md` names the exact file) AND
`erp-fixture-schema-conformance.test.ts` (table-set-equality) — both must pass with the new table
entry recognized as a valid reference target on both the manifest and the fixture.

### Step S2 — `sales-basis-core.ts`: real `"invoice"` branch
1. Add `"invoice"` to the `SalesBasis` union.
2. Change `resolveSalesBasisFromValue` to return `"invoice"` when the stored setting value is
   `"invoice"`, keep `"do"` as the explicit default and the fallback for unrecognized values
   (never throw on typos — same existing convention).
3. Update the doc-comment above the type (the "EXTENSION POINT... not implemented here" comment)
   to say invoice basis IS now implemented, and note that the Sales dashboard's PRIMARY basis
   changed from DO to invoice as of this plan (so a future reader doesn't think DO is still
   primary).
4. Grep the whole repo for other `SalesBasis`-typed switches/if-chains (`grep -rn "SalesBasis"
   src/`) and update any that assumed only `"do"` exists. (Confirmed at supplement time: only 2
   call sites exist — low-risk, but still grep to catch drift between now and EXECUTE.)
**Verification (Fully-Automated):** existing + new unit tests for `resolveSalesBasisFromValue`
green; `tsc --noEmit` green (catches any missed exhaustive-switch site).

### Step S2b — Extend `erp_fixture` with `SalesInvoiceDtl` rows (NEW — gates S3)
`db/erp-fixture/sales-seed.sql` currently seeds 3 `SalesInvoiceHdr` rows but ZERO
`SalesInvoiceDtl` rows. Add synthetic `SalesInvoiceDtl` line rows against those existing headers:
- Synthetic values only — never copy real customer data out of `db_TCL`.
- Enough rows to exercise per-product, per-category, and per-customer breakdowns (multiple
  distinct `ItemCode`s across at least 2 `SalesInvoiceHdr.CustOrSuppCode` values) and the
  line→header total reconciliation (line `SUM(Amount)` must tie to the header `TotalAmount` for at
  least one seeded invoice, mirroring the live 100%-reconciliation fact).
- At least one invoice line with `Amount = NULL` while its header `TotalAmount` is non-zero,
  mirroring the real DO-2608-0007 case, so the Step S3 NULL-handling unit test can actually run
  against fixture data.
- Seed order-independence: the prior program hit and fixed an order-dependence bug in
  `production-seed.sql`/`purchase-seed.sql` (see `process/context/database/all-database.md`) — the
  new `SalesInvoiceDtl` rows must not reintroduce that shape (no row may depend on insertion order
  relative to other seed files).
**Verification (Fully-Automated):** re-run the existing fixture seed idempotency regression test
(added by the prior program for the order-dependence bug) against the extended seed file — must
stay green.

### Step S3 — New invoice SQL files + manifest conformance + column contract
Write the five new `.sql` files (`invoice-headers.sql`, `invoice-lines.sql`,
`invoice-by-product.sql`, `invoice-by-customer.sql`, `invoice-date-range.sql`). Every column
referenced must exist in the Step S1 manifest entries. Reuse the canonical-item CTE from
`do-by-product.sql` verbatim for the category join (do not re-derive the highest-`Roworder`-wins
dedup logic — copy the proven pattern). Handle the NULL `Amount` case (DO-2608-0007's partial
invoice line) explicitly with `ISNULL(Amount, 0)` or equivalent — do not let a NULL propagate into
a SUM silently dropping a row's presence from a count. **For each of the 5 new files, add a
matching entry to `src/lib/erp-query-columns.ts`'s `ERP_QUERY_COLUMNS` contract in the SAME
sub-step as writing the file** — do not batch this to the end; `erp-query-schema-conformance.test.ts`
checks both directions (file without entry fails; entry without file fails), so add both together
per file. Depends on Step S2b (fixture rows must exist before the NULL-handling unit test can run).
**Verification (Fully-Automated, gates S6):** manifest conformance test AND
`erp-query-schema-conformance.test.ts` pass against all 5 new files (with their new column-contract
entries); a syntax/parse dry-run (however the existing SQL files are validated — check
`db/erp-queries/` for an existing lint/parse script and reuse it) passes.

### Step S4 — Fate of `sales-invoice-excluded-total.sql` (RESOLVED — no longer an open judgment call)
**Decision: KEEP the file, rewrite its comment.** Confirmed at supplement time: this query is
unconditional (no date-range parameter) by design — a full-pool total — while the new
`invoice-headers.sql` is date-filtered for the dashboard's selected range. These are genuinely
different shapes serving different callers (`live-reconcile-script.ts` needs the unconditional
pool; the dashboard's date-range summary needs the filtered aggregate), so this is not a duplicate
to delete. Rewrite the header comment (and any Thai/English label surfaced by
`live-reconcile-script.ts`) to remove "excluded"/ไม่รวม framing — this money is no longer excluded
from the dashboard, it is the unfiltered variant of the now-primary invoice total. No caller
repointing is needed since the file is kept; `fetchExcludedInvoiceTotal` in `sales-queries.ts`
stays as-is (rename optional, not required — do not let a cosmetic rename expand this step's
scope).
**Verification (Agent-Probe):** manual read confirming the comment no longer says "excluded" and
that `live-reconcile-script.ts`'s import still resolves cleanly (also covered by the Fully-Automated
`tsc --noEmit` gate in the Test Gates table).

### Step S5 — DO-side summary query check (delivery section coverage)
Confirm the existing `do-headers.sql`/`do-lines.sql`/`do-by-product.sql`/`do-by-customer.sql`/
`do-date-range.sql` already provide everything the "secondary delivery section" needs (84 DOs,
192,925 units, status donut inputs). If a summary total is currently computed inline in
`page.tsx` rather than in a query file, no new SQL is needed — just confirm the existing fetch
functions are still called for the delivery section after the S8 restructure.
**Verification (Agent-Probe):** read-through confirming no new DO query is required; if one is,
treat as a plan gap and add it here before proceeding (do not discover this mid-S8).

### Step S6 — Mirror into `sales-sql.ts` / `purchase-sql.ts` / `erp-query-columns.ts`
Copy every new/changed `.sql` file byte-identically into the corresponding TypeScript mirror
constant in `src/lib/sales-sql.ts` (and the two purchase comment-only changes into
`src/lib/purchase-sql.ts`). This step must run immediately after each SQL file is finalized — do
not batch all mirrors to the end, since the existing drift test will fail loudly and specifically
per file, and doing it per-file keeps the fix localized. **The same per-file discipline applies to
`erp-query-columns.ts` entries** (added in Step S3) — confirm each entry stays in sync with its
`.sql` file's actual column references as the files are finalized, not only once at the end.
**Also add a `{ name, file, sql }` entry to `sales-sql.ts`'s `SALES_SQL_SOURCES` array for each new
mirror constant, in the same edit that adds the constant** — `SALES_SQL_SOURCES` is the array the
byte-identity drift test (`sales-basis-reconciliation.test.ts`) actually iterates over; a new
constant that is mirrored but never registered in this array passes the drift test vacuously
because nothing iterates it.
**Verification (Fully-Automated, hard gate):** the existing SQL/TS drift test — locate via
`process/context/tests/all-tests.md` (search for "drift" or "sales-sql") and run it; must be
green with zero diffs across all touched files. Also re-run `erp-query-schema-conformance.test.ts`.

### Step S7 — `sales-queries.ts` fetch wrappers
Add `fetchInvoiceHeaders`, `fetchInvoiceLines`, `fetchInvoiceByProduct`, `fetchInvoiceByCustomer`,
`fetchInvoiceDateRange`, each calling `runSalesQuery<T>` exactly as the existing `fetchDo*`
wrappers do (same `CachedResult<T>` return shape, same degrade-on-ERP-down behavior — do not
write a new degrade path). `fetchExcludedInvoiceTotal` is unchanged (Step S4 KEEP decision).
**Verification (Fully-Automated):** new unit tests mocking `guardedQuery`/`runSalesQuery` to
assert (a) success path returns typed rows, (b) ERP-down path returns the same
`CachedResult`-degraded shape as the existing DO wrappers (copy the existing degrade test pattern
verbatim, do not invent a new assertion style).

### Step S8 — Restructure `page.tsx` (highest-risk step)
1. Read the current 300-line file in full before editing (it is the single highest-risk
   touchpoint in this plan).
2. Split into two visually-distinct sections driven by the extended `view` param from
   `sales-url.ts` (Public Contracts above) — NOT a nested route: an "ยอดขาย" (Sales — invoice
   basis, primary, headline position) section using the new S7 fetch wrappers, and a
   "การส่งมอบ" (Delivery) section using the EXISTING DO fetch wrappers, unchanged in data logic.
   On the `"summary"` view both sections render simultaneously; `invoiceNo`/`doNo` drive each
   section's own drilldown independently.
3. **Independent per-section degrade (resolves Supplement Gap 7; degrade-component split is a
   cycle-5 fix):** each section resolves and renders its own data in its own try/catch — the
   invoice section's fetches and the delivery section's fetches are NOT combined into one
   `Promise.all`/`try/catch` as today. An invoice-only ERP failure renders the delivery section
   normally plus a clear Thai degraded notice on the invoice section only, and vice versa.
   **`sales-unavailable.tsx` renders the WHOLE page shell (`<main data-testid="sales-dashboard">`
   containing the `<h1>ยอดขาย</h1>` header, `<PilotBanner/>`, the notice block, `<SalesFilterBar/>`,
   and a `Card`) — it cannot literally be rendered twice, once per section, without duplicating the
   page root and the `data-testid="sales-dashboard"` id every existing e2e selector keys on.**
   Instead: extract the inner notice block (the red banner + "ยังไม่มีข้อมูลที่จะแสดง" card, currently
   lines ~41-59 of `sales-unavailable.tsx`) into a NEW small component,
   `sales-unavailable-fragment.tsx`, parameterized by a `data-testid` (e.g.
   `sales-invoice-unavailable` / `sales-delivery-unavailable`) so each section renders its OWN
   scoped instance on a cold-cache failure. KEEP `sales-unavailable.tsx` UNCHANGED as the
   whole-page fallback for the case where BOTH sections have no data and nothing cached anywhere —
   its existing e2e gates (`data-testid="sales-dashboard"`, `data-testid="sales-erp-unavailable"`)
   keep passing unmodified. Three distinct states exist and must each render correctly: (a) both
   sections down with nothing cached → whole-page `SalesUnavailable` fallback (unchanged); (b) one
   section down, the other has data → that section renders the new scoped fragment, the other
   section renders normally; (c) stale-but-cached → the existing `DegradeBanner` path (unchanged,
   not this fragment). Cover the cold-cache case explicitly (first request, nothing cached yet) for
   BOTH sections independently.
4. Reuse the existing breakdown-table component(s) for both sections if their column shape is
   compatible (invoice rows: ItemCode/Description/MainQuantity/MainUnits/Amount vs DO rows —
   confirm shape match or add a thin adapter, do not fork the component).
5. `sales-status-donut.tsx` moves into the Delivery section render position; its own logic and
   props are unchanged.
6. `canSeeMoney` gates the invoice section's money figures exactly as it already gates DO money
   figures today — reuse the same gate check, do not write a second one.
7. Update the coverage-%/reconciliation footnote copy (see Step S13) — this is the one place
   where old Thai copy becomes actively WRONG (it currently says the SI/invoice pool is EXCLUDED
   footnote money) and must be corrected before this step is considered done.
**Verification (Hybrid — requires the local dev server or the `erp_fixture` sandbox running,
extended per Step S2b):** manual render check against `erp_fixture` data confirms both sections
render, money is gated per role, each section degrades independently on a simulated ERP failure,
and no console error/500 occurs. This is the step most likely to reveal a plan gap — if the
component-shape mismatch in bullet 4 is worse than expected, stop and note it in Resume Handoff
rather than forcing an ad-hoc fork.

### Step S9 — Confirm donut placement
Re-render both roles (ADMIN/STAFF) and confirm the status donut appears once, in the Delivery
section, and not duplicated or orphaned in the invoice section.
**Verification (Agent-Probe):** visual confirmation, both roles.

### Step S10 — Invoice drilldown as a search param (redesigned — NOT a nested route)
Add invoice drilldown as a NEW `invoiceNo` search param on the SAME `/dashboards/sales` page,
mirroring the existing `doNo` param's precedent exactly (same null/empty handling, same
href-preservation behavior) — per `sales-url.ts`'s locked "ONE page, params are state" design
(its own leading comment explicitly rejects a nested route tree; the prior nested-route proposal
in this step is dropped). Selecting an invoice sets `view` to the invoice-lines shape and
`invoiceNo` to the chosen document, rendering `SalesInvoiceHdr` + its `SalesInvoiceDtl` lines for
that one invoice, money-gated the same way as the list view.
**Verification (Fully-Automated + Hybrid):** unit test for `sales-url.ts`'s `invoiceNo`
parsing/back-compat behavior; unit test for any pure formatting helper used by the drilldown view;
hybrid render check against `erp_fixture` for the drilldown state on the existing page.

### Step S11 — CSV export
Widen `ExportTable` (in `dashboard-export-target.ts`) ADDITIVELY from `"list" | "lines"` to
`"list" | "lines" | "invoice-list" | "invoice-lines"` (see Public Contracts) so the export
mechanism can express both new invoice exports (invoice list, invoice lines) alongside the
EXISTING, UNCHANGED `"list"`/`"lines"` values already used by the delivery section and by the
purchase/production dashboards that also import this module — this is additive, not a rename, so
no existing consumer's exhaustive switch can silently fall through or fail to compile.

**Runtime wiring (cycle-5 fix — the type widening above is necessary but NOT sufficient):**
1. Rewrite `deriveExportTarget()`'s sales branch to derive `table` from the resolved section
   (`invoice` vs `delivery`, using the same `view`/`invoiceNo`/`doNo` state `sales-url.ts`
   resolves) instead of `doNo` presence alone: `invoice` section → `"invoice-lines"` when
   `invoiceNo` is present else `"invoice-list"`; `delivery` section → unchanged existing
   `doNo`-presence logic (`"lines"`/`"list"`).
2. Widen `parseExportTarget()`'s allow-list to accept all four `ExportTable` values, and confirm
   the `key`-required-for-lines check still exempts `sales` for both new values (sales carries its
   drilldown in the query string, not `key`, for every sales shape — this exemption already exists
   for `"lines"` and extends unchanged to `"invoice-lines"`).
3. Add explicit `case "sales:invoice-list":` and `case "sales:invoice-lines":` to
   `export-datasets.ts`'s `loadExportDataset()` switch, dispatching to new
   `salesInvoiceList`/`salesInvoiceLines` functions that mirror the existing `salesList`/`salesLines`
   pattern (lines 76-147: parse via `sales-url.ts`, fetch via the Step S7 wrappers, sort via
   `salesSortRows`, filter columns by `canSeeMoney`).
4. **Required, not optional hardening:** add an explicit `case "production:lines":` for the shape
   the current `default:` branch silently stands in for, and change `default:` to reject
   (throw/return an explicit error) any unrecognized `dashboard:table` pair. This is required by
   this plan because the moment two new union members exist, an unwired or mistyped pair must not
   silently serve a different dashboard's data under the requesting dashboard's filename — add a
   unit test asserting an unrecognized pair is REJECTED and never returns `production` rows.

Extend the existing CSV export mechanism to cover every new invoice table exactly like the
existing DO tables: UTF-8 BOM, CRLF, Thai headers, BE dates, the established row-cap/truncation
notice, ASCII filename (distinguishing invoice from delivery export filenames via `exportSlug()`),
and STAFF money-column omission (columns removed entirely from the export schema for STAFF, not
blanked). Reuse the existing export helper — do not write a second export code path.
**Verification (Fully-Automated + Hybrid):** new unit tests directly on `dashboard-export-target.ts`
(`deriveExportTarget()` returns the correct table for both invoice-section param shapes;
`parseExportTarget()` round-trips both new values from a query string) and `export-datasets.ts`
(`loadExportDataset()` dispatches `sales:invoice-list`/`sales:invoice-lines` to the new invoice
functions, never `productionLines`; an unrecognized pair is rejected, not silently served as
production data) — **this end-to-end wiring check is required in addition to, not instead of,** a
unit test asserting STAFF export omits money columns entirely (byte-level column-count check, same
style as the prior program's AC9 money audit) for all 4 export shapes (invoice-list, invoice-lines,
and the existing delivery list/lines shapes); regression unit test confirming every existing
`ExportTable` consumer (purchase, production, and the delivery section) still compiles clean
against the widened type (`tsc --noEmit`); hybrid manual download-and-open check — including an
actual invoice CSV export request returning HTTP 200 with real invoice rows, not just a type-level
check — for encoding/format correctness.

### Step S12 — Test suite extension + full regression
Add unit tests for: `resolveSalesBasisFromValue` invoice branch, `sales-url.ts`'s `invoiceNo`
parsing + back-compat fallback, the five new fetch wrappers (success + degrade paths), and any new
pure formatting helpers. Extend `e2e/dashboards-sales.spec.ts` with invoice-section gates (headline
number, drilldown navigation via `invoiceNo`, CSV export across all 4 shapes, STAFF
money-omission, independent per-section degrade). Then re-run the FULL existing test suite (unit +
e2e) as a regression gate — the DO-path underlying DATA and QUERY LOGIC must stay unchanged, though
DO-path TEST ASSERTIONS may need updating to match the new page layout (donut relocation changes
DOM order) — see reworded Acceptance Criterion 5.
**Verification (Fully-Automated):** full `pnpm test` and Playwright suite green; report before/after
counts in the Verification Evidence table below once real numbers are known.

### Step S13 — Coverage/reconciliation footnote copy rewrite
The existing footnote text asserts the SI/invoice pool is EXCLUDED from the dashboard's money
figure. That framing is now false — invoice IS the primary figure. **Complete list of locations
needing this rewrite (cycle-5 fix — the prior wording named only 3 of 6 real locations):**
1. `src/lib/sales-basis-core.ts`'s `reconciliationNote(excludedCount, excludedTotal)` function —
   the ACTUAL Thai template string (`"มียอดใบแจ้งหนี้ขาย (SalesInvoiceHdr) อีก ... ที่ไม่ถูกนับรวมในยอดนี้
   เนื่องจากยังไม่ใช่ฐานข้อมูลที่ใช้ในแดชบอร์ดนี้"`).
2. `src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx` — the render site calling
   `reconciliationNote(excludedInvoiceCount, excludedInvoiceTotal)` (line 143).
3. `db/erp-fixture/sales-seed.sql` — the stale comment framing the `SalesInvoiceHdr` pool as
   excluded.
4. `db/erp-queries/sales/sales-invoice-excluded-total.sql` — header comment (Step S4).
5. `src/lib/erp/live-reconcile-script.ts` — comment/label text (Step S4).
6. `src/app/(main)/dashboards/sales/sales-unavailable.tsx` — the subtitle
   `"ข้อมูลจากใบส่งสินค้าในระบบ ERP (อ่านอย่างเดียว)"` (line 35), which is DO/delivery-basis framing
   that becomes misleading once invoice is primary.

Rewrite (exact Thai wording to be finalized during EXECUTE, reviewed against existing Thai copy
conventions in this file):
- New framing (invoice section): state the invoice total as the confirmed/billed figure, and add a
  short cross-reference note pointing to the Delivery section for the goods-shipped view.
- **Delivery section's own footnote — decided here, not left implicit (cycle-5 fix):** the
  Delivery section KEEPS a real caveat worth stating on its own terms — only 13 of 1,623 DO lines
  carry a price (0.8% coverage), a fact that has nothing to do with the invoice total and remains
  true regardless of this plan. Retire `reconciliationNote()`/`fetchExcludedInvoiceTotal()` from
  the KPI-tile render path entirely (Step S4 already keeps the underlying SQL/fetch function for
  `live-reconcile-script.ts`'s sake — this decision is only about whether the delivery section's
  own tile still calls it). The delivery section's caveat is instead a plain existing-coverage-%
  statement (e.g. "priced coverage: 13 of 1,623 lines, 0.8%"), not a reciprocal "invoice money is
  tracked elsewhere" cross-reference — the invoice section's own new footnote already carries that
  cross-reference, so the delivery section does not need to restate it in the other direction.
- Do NOT reuse the word "excluded" (คำว่า "ไม่รวม"/"ยกเว้น") anywhere near the invoice total —
  it is no longer excluded, it is primary. This rule applies to all 6 locations listed above.
**Verification (Agent-Probe):** Thai native-reader-equivalent review confirming the new copy does
not contradict itself and does not use excluded-framing language near the invoice total, across all
6 locations listed above, and that the delivery section's own footnote is a standalone
coverage-% caveat, not orphaned `reconciliationNote()` output.

## Phase Completion Rules

This plan has no sub-phases — it is a single COMPLEX plan executed as one dependency-ordered
checklist (Steps P1–P2, S1–S2b, S3–S13 above serve as the Implementation Checklist). The plan is
considered CODE DONE when all steps' Verification gates pass. It is considered VERIFIED only
after explicit user confirmation of the live-rendered dashboard (see Acceptance Criteria).

## Acceptance Criteria

1. `/dashboards/sales` shows the invoice-basis total (~฿1,515,401.86 / 4 invoices) as the primary
   headline figure, with 100% line-to-header reconciliation (no coverage-% caveat needed on the
   invoice figure, unlike the old DO-priced-lines figure).
2. The delivery section ("การส่งมอบ") still shows all 84 DOs / 192,925 units with its existing
   0.8%-priced-coverage caveat, unchanged, with the status donut relocated there.
3. STAFF role sees zero money figures anywhere on the page or in CSV exports, including the new
   invoice tables.
4. No ERP write of any kind occurs; `db_TCL` is never contacted by an automated test.
5. **DO-path data and query logic remain unmodified** — no DO SQL file's WHERE-clause text or
   result semantics changes, and every DO document number (`DO-2608-0007`, etc.) produces the exact
   same figures before and after this plan. DO-path **test assertions** may be updated where the
   new two-section page layout changes DOM structure or ordering (e.g. the status donut relocating
   to the Delivery section) — this is expected and does not violate this criterion, provided the
   underlying data/logic assertions (totals, counts, reconciliation) are unchanged.
6. Purchase dashboard is visually and numerically unchanged (comment-only SQL edits).

## Validate Contract

Status: CONDITIONAL
Date: 23-09-26
date: 2026-09-23
generated-by: inner-pvl: sales-invoice-basis
supersedes: 2026-09-23 (inner-pvl: sales-invoice-basis) — this is PVL cycle 6, re-validating from
V1 after the cycle-5 supplement closed cycle 4's 2 FAIL + 2 CONCERN (CSV export runtime wiring
never named as Touchpoints; `sales-unavailable.tsx` cannot be reused per-section as a whole-page
shell; a test-file hedge; an incomplete copy-rewrite checklist — see
`sales-invoice-basis-pvl-iteration-005_REPORT_23-09-26.md`). The cycle-4 gate value (BLOCKED,
pre-cycle-5-supplement) is preserved as history; this cycle's fresh V1–V7 pass supersedes it with a
new, independent finding set. None of cycles 1, 3, or 5's fixes are being second-guessed — all are
independently re-confirmed correct this cycle against the real files on disk (see "Prior fixes
re-confirmed" below). This cycle found 0 new FAILs and 1 new CONCERN, one layer deeper than cycle
4's runtime-wiring findings: not "is the dispatch wired" (cycle 4's question, now resolved in plan
text) but "does the wiring's own resolution mechanism actually work once two tables share one URL
state" (this cycle's question).

Parallel strategy: parallel-subagents
Rationale: 4 Layer 1 dimension agents (infra/test/breaking/security) + 15 Layer 2 per-step
feasibility re-checks (P1/P2 combined, S1–S13), each re-verified against the REAL files on disk
this cycle, including tracing the actual render call graph in `page.tsx`, `do-list-table.tsx`,
`sales-breakdown-tables.tsx`, and `dashboard-data-table.tsx` — not just the two files cycle 4
traced. Signal score 2/7 (single-plan, single-feature scope; no phase-program, no container/infra
surface) → MEDIUM, parallel subagents remains the fit strategy.

### Prior fixes re-confirmed (not re-litigated)

Independently re-verified this cycle by reading the real files, not re-reading the plan's prose:
- **Cycles 1/3** (paths, additive `ExportTable` union, `00-schema.sql`, `SALES_SQL_SOURCES`,
  `CustOrSuppCode`/`cat`/`status` semantics, `doNo`/`invoiceNo` precedence): zero occurrences of
  either historical wrong path (`src/lib/erp/erp-query-columns.ts`, `src/lib/sales-url.ts`) remain
  outside the one line that names them as *no longer present*; all 27+ previously-verified source
  paths still resolve; `dbo.SalesInvoiceHdr` confirmed present in both
  `live-manifest_23-09-26.json` (151 columns) and `00-schema.sql`, `dbo.SalesInvoiceDtl` confirmed
  correctly absent from both (Step S1's job); `SALES_SQL_SOURCES` confirmed as the real array
  structure in `sales-sql.ts`; `SalesBasis` confirmed to have exactly 2 real call sites repo-wide
  (`src/lib/sales-basis.ts`, `src/lib/sales-basis-core.ts`), matching the plan's claim; current
  `resolveSalesBasisFromValue` confirmed to return only `"do"` today, as described.
- **Cycle 5** (all 4 gaps): `dashboard-export-target.ts` read in full — `deriveExportTarget()`
  line 51-54 and `parseExportTarget()` line 97-105 match the cited defect exactly.
  `export-datasets.ts` read in full — the `default: return productionLines(...)` catch-all at
  line 337-338 matches exactly, no `sales:invoice-*` cases exist yet (correct, not built).
  `sales-unavailable.tsx` read in full (62 lines) — confirmed it IS the whole-page shell; the
  fragment split scopes exactly the right lines (the red banner + "ยังไม่มีข้อมูลที่จะแสดง" card, no
  more, no less). All 6 S13 copy-rewrite locations re-read and confirmed real:
  `sales-basis-core.ts:375` (`reconciliationNote`), `sales-kpi-tiles.tsx:143` (its render site),
  `sales-seed.sql:210` ("EXCLUDED pool" comment), `sales-unavailable.tsx:35` (subtitle), plus the
  two already-named `sales-invoice-excluded-total.sql`/`live-reconcile-script.ts`. The test-file
  reference (`sales-basis-reconciliation.test.ts`) confirmed byte-exact against the real describe
  block name.

### Net Gate Derivation

**Layer 1 dimensions**

| Layer 1 dimensions | Status |
|---|---|
| Infra fit | CONCERN |
| Test coverage | CONCERN |
| Breaking changes | PASS |
| Security surface | PASS |

**Layer 2 sections**

| Layer 2 sections | Status |
|---|---|
| Step P1/P2 — Purchase comment-only divergence docs | PASS |
| Step S1 — Manifest: add `SalesInvoiceDtl` | PASS |
| Step S2 — `sales-basis-core.ts` real `"invoice"` branch | PASS |
| Step S2b — Extend `erp_fixture` with `SalesInvoiceDtl` rows | PASS |
| Step S3 — New invoice SQL files + manifest conformance + column contract | PASS |
| Step S4 — Fate of `sales-invoice-excluded-total.sql` | PASS |
| Step S5 — DO-side summary query check | PASS |
| Step S6 — Mirror into `sales-sql.ts`/`purchase-sql.ts`/column contract | PASS |
| Step S7 — `sales-queries.ts` fetch wrappers | PASS |
| Step S8 — Restructure `page.tsx` (highest-risk step) | PASS (mutual-exclusivity of the two sections' document-list views, structurally enforced by the single `view` string, is what keeps this step's design sound — re-confirmed by reading `page.tsx`'s current view-branch structure) |
| Step S9 — Confirm donut placement | PASS (contingent on S8) |
| Step S10 — Invoice drilldown as a search param | PASS |
| Step S11 — CSV export (`ExportTable` widening + runtime wiring) | CONCERN (new, this cycle — see below) |
| Step S12 — Test suite extension + full regression | PASS |
| Step S13 — Coverage/reconciliation footnote copy | PASS |

**Totals: 0 FAILs / 3 CONCERNs (2 Layer 1 + 1 Layer 2, same underlying finding counted once
substantively) / 12 PASSes**

**→ Net Gate: CONDITIONAL**

### Dimension findings

- **Infra fit: CONCERN** (was FAIL at cycle 4, now resolved to CONCERN) — Cycle 4's 3-part runtime
  defect (unwired `deriveExportTarget`, hard-allowlisted `parseExportTarget`, missing
  `export-datasets.ts` cases) is fully addressed in plan text by the cycle-5 supplement, confirmed
  this cycle against every real file/line cycle 4 named. One layer deeper, a new gap: the shared
  `DashboardDataTable` component (`src/components/dashboard-data-table.tsx`) calls
  `deriveExportTarget(basePath, searchParams)` — a function with NO knowledge of *which table
  instance* is calling it, only the page's ambient URL state. Today this works because at most one
  auto-deriving table (`DoListTable`, mounted only when `view === "documents"`) is ever active at a
  time; the breakdown tables explicitly opt out via `exportHref={false}` for exactly this reason
  (confirmed: `sales-breakdown-tables.tsx`'s own comment names this exact failure mode — "an
  inherited button here would silently download the wrong file"). The plan's new 5-value `view`
  enum does keep the invoice section's and delivery section's *document-list* views mutually
  exclusive (only one of `invoice-documents`/`delivery-documents` is ever the active `view` at
  once), so the two list tables are never BOTH auto-deriving at the same instant — the worst-case
  "both mounted, one wins arbitrarily" collision does not occur, provided EXECUTE preserves that
  mutual exclusivity (which the single `view` string structurally enforces, this is not a new risk
  EXECUTE must invent a safeguard for). What the plan does NOT say: once neither `doNo` nor
  `invoiceNo` is present — i.e. exactly the plain-list case for whichever section is active — the
  ONLY remaining signal distinguishing "invoice section's list" from "delivery section's list" is
  `searchParams.view` itself, and the plan doesn't name the mechanism `dashboard-export-target.ts`
  (deliberately dependency-free, no React/Next/DB, generic across all 3 dashboards today) should
  use to read that signal: hand-duplicate `sales-url.ts`'s view/precedence resolution (a drift risk
  with no drift-test named, unlike the byte-identical SQL/TS mirror this codebase gates elsewhere),
  or import a resolver from `sales-url.ts` directly (couples a currently dashboard-agnostic file to
  one dashboard's page module). Either choice works; the plan just doesn't pick one or test it.
- **Test coverage: CONCERN** — Step S11's C3 test-gate row ("`deriveExportTarget()` returns
  `"invoice-list"`/`"invoice-lines"` for the invoice section's real param shapes") does not
  explicitly enumerate the view-only case (`view=invoice-documents`, no `invoiceNo` →
  `"invoice-list"`; `view=delivery-documents`, no `doNo` → unchanged `"list"`) alongside the
  drilldown-param-present cases it clearly does cover. A test suite that only exercises the
  invoiceNo/doNo-present branches could pass green while the view-only branch — the plain "show me
  the list" case, arguably the MORE common one — silently resolves both sections to the same table.
- **Breaking changes: PASS** — unchanged from cycle 4: the additive `ExportTable` widening still
  does not touch Purchase or Production's existing branches in either `deriveExportTarget` or
  `loadExportDataset`; this cycle's finding is scoped entirely to code this plan itself must still
  add, not a break to an existing consumer.
- **Security surface: PASS** — unchanged from cycles 1–5: read-only ERP access pattern reused
  (`guardedQuery`), `canSeeMoney` computed once server-side from `requireAuth()` in both `page.tsx`
  and `route.ts` (re-confirmed by reading `export-datasets.ts` in full — `canSeeMoney` is a plain
  parameter threaded through every dataset function, never re-derived), no new auth surface.

### Layer 2 findings detail — cycle 6 (only the row whose status changed or gained a new finding)

| Finding | Severity | Proposed fix |
|---|---|---|
| S11: once neither `doNo` nor `invoiceNo` is present, `deriveExportTarget()`'s only remaining signal to tell the invoice section's list apart from the delivery section's list is `searchParams.view` — the plan requires reading "the resolved section" but never names the mechanism by which a dependency-free, multi-dashboard-generic utility obtains the same view/precedence resolution `sales-url.ts`'s `parseSalesUrl` already owns | CONCERN | Add one explicit sentence to Step S11: `dashboard-export-target.ts`'s sales branch must resolve section identity by importing a small, pure resolver exported from `sales-url.ts` (e.g. a `resolveSalesSection(raw: RawSearchParams): "invoice" \| "delivery"` helper factored out of `parseSalesUrl`'s own view/doNo/invoiceNo precedence logic) rather than re-deriving the precedence rules a second time — this keeps exactly one source of truth for "which section is this" the same way `SALES_SQL_SOURCES` keeps one source of truth for SQL text. Add this resolver export to Touchpoints for `sales-url.ts`. Add two explicit test scenarios to Step S11's C3 row: (a) `view=invoice-documents`, no `invoiceNo` → `deriveExportTarget` returns `"invoice-list"`; (b) `view=delivery-documents`, no `doNo` → returns unchanged `"list"`. |
| P1/P2, S1, S2, S2b, S3, S4, S5, S6, S7, S8, S9, S10, S12, S13 | ✅ PASS (re-confirmed against real files this cycle) | — |

### What was checked and found clean this cycle

- **Two-section simultaneous render, the collision I first suspected does NOT occur:** read
  `page.tsx`'s current view-branch structure (`state.view === "summary"` renders breakdown tables
  only, with `exportHref={false}`; `state.view === "documents"` renders `DoListTable`, mutually
  exclusive from `"summary"`; `state.view === "lines"` renders `DoLinesTable`). The plan's 5-value
  `view` enum is structurally the same shape doubled per section — as long as EXECUTE preserves
  that a single `view` string can only ever be one value, the two sections' list tables can never
  both be "the active auto-deriving table" at once. No plan change needed for this half of the
  concern; it is confirmed sound as designed.
- **Pagination/sort on invoice tables:** the plan's per-section pagination keys
  (`invoiceProductPage`/`invoiceCustomerPage` vs `deliveryProductPage`/`deliveryCustomerPage`,
  Public Contracts) mirror the already-shipped `sales-breakdown-pagination` server-side pattern
  (`sales-url.ts`'s `pageFromParam`/`clearPageParams`) — no client-side-only sort/paginate risk.
- **Invoice drilldown auth/money path:** re-confirmed via `export-datasets.ts` — `canSeeMoney` is a
  single boolean threaded from `route.ts`'s server-side session resolution into every dataset
  function, never re-derived or client-supplied. No gap.
- **Money reconciliation, gate vacuousness:** no gate in this plan can pass for a trivially-true
  reason — every Fully-Automated row asserts a specific value or a specific rejection, not merely
  "did not throw."

### Test gates (C3 5-column table)

Carried forward from cycle 5 unchanged, except the S11 row below (cycle-6 fix — the prior wording
would not catch this cycle's CONCERN).

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| S1 | `SalesInvoiceDtl` added to live manifest AND to `00-schema.sql`; conformance test recognizes it, no invented columns | Fully-Automated | `pnpm test` (runs `erp-fixture-schema-conformance.test.ts` + `erp-query-schema-conformance.test.ts`) | A |
| S2 | `resolveSalesBasisFromValue("invoice")` → `"invoice"`; unknown values still fall back to `"do"` | Fully-Automated | extend the EXISTING `describe("resolveSalesBasisFromValue — the sales-basis switch decision", ...)` block in `src/lib/__tests__/sales-basis-reconciliation.test.ts` — do NOT create a new file | A |
| S2 | `tsc --noEmit` clean after `SalesBasis` union change | Fully-Automated | `npx tsc --noEmit` | A |
| S2b | `erp_fixture`'s `SalesInvoiceDtl` seed extension stays order-independent | Fully-Automated | existing fixture-seed idempotency regression test (`erp-fixture-seed-idempotency.test.ts`), re-run against extended seed | A |
| S3 | NULL `Amount` (DO-2608-0007-style line) does not crash a SUM / silently drop row presence, per-LINE display | Fully-Automated | new unit test against `erp_fixture` | A |
| S3 | Every new `.sql` file has a matching `ERP_QUERY_COLUMNS` entry | Fully-Automated | `erp-query-schema-conformance.test.ts` (both-directions check) | A |
| S6 | SQL/TS drift: every new/changed `.sql` file byte-identical to its mirror, registered in `SALES_SQL_SOURCES` | Fully-Automated | `pnpm test` (`sales-basis-reconciliation.test.ts`'s `SALES_SQL_SOURCES` sweep) | A |
| S7 | New fetch wrappers: success path + ERP-down degrade path, distinct cache-key `name`s | Fully-Automated | new unit tests mocking `guardedQuery`/`runSalesQuery` | A |
| S8 | `sales-unavailable.tsx` split into a reusable per-section fragment + whole-page variant; each section renders its OWN fragment on cold-cache failure; exactly one `data-testid="sales-dashboard"` root | Fully-Automated (DOM-shape unit test) + Hybrid (full render) | new unit test asserting exactly one `data-testid="sales-dashboard"` root exists regardless of which section(s) are degraded | A |
| S8 | `sales-url.ts` `view` parsing falls back to `"summary"` on stale/unrecognized value; `invoiceNo`/`doNo` null/empty handling; combined stale-view+doNo case; `customer`/`product` alone no longer forces a documents/lines view away from `summary` | Fully-Automated | new unit test on `sales-url.ts` parsing function | A |
| S8 | `/dashboards/sales` renders both sections, money gated per role, no console error, no 500, each section degrades independently | Hybrid — precondition: `orderstock-sql` container up, `erp_fixture` seeded (extended per S2b), server up, `ERP_DATABASE_URL` + `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` set | manual render check + extended `e2e/dashboards-sales.spec.ts` | A |
| S9 | Status donut renders exactly once, in the Delivery section, both roles | Agent-Probe | manual visual confirmation, ADMIN + STAFF | A |
| S10 | Invoice drilldown (`invoiceNo` param, same page) renders one invoice + lines, money-gated | Hybrid | new `e2e/dashboards-sales.spec.ts` gate | A |
| S11 (cycle-6 fix) | `deriveExportTarget()` resolves section identity via ONE shared resolver (exported from `sales-url.ts`, not re-derived) and returns the correct value for all four real param shapes, INCLUDING the view-only case with neither `invoiceNo` nor `doNo` present (`view=invoice-documents` alone → `"invoice-list"`; `view=delivery-documents` alone → unchanged `"list"`); `parseExportTarget()` accepts and round-trips both new values; `loadExportDataset()` dispatches to `salesInvoiceList`/`salesInvoiceLines`, never `productionLines` | Fully-Automated | new unit tests directly on `dashboard-export-target.ts` (round-trip, all four param-shape combinations) and `export-datasets.ts` (dispatch) | A |
| S11 | `ExportTable`'s additive union compiles clean against every existing consumer | Fully-Automated | `npx tsc --noEmit` | A |
| S11 | CSV export: STAFF exports omit money columns entirely, across all 4 export shapes | Fully-Automated | extend `dashboards-money-audit.test.ts`'s AC9 role-diffed byte-comparison pattern — after the S11 dispatch fix, not instead of it | A |
| S12 | Full existing unit + e2e regression green; DO-path underlying figures unchanged; DO-path test assertions updated where layout changed | Fully-Automated | `pnpm test && pnpm lint && pnpm build && pnpm exec playwright test`, run with the ERP env block from `process/context/tests/all-tests.md` — **must be run by the orchestrator or user directly, never a `vc-tester` subagent** (see Known Gaps) | A |
| S13 | Footnote copy no longer uses "excluded" framing near the invoice total, in all 6 real locations; delivery section's post-plan footnote fate explicitly decided | Agent-Probe | Thai-reader review of the rewritten copy across all 6 locations | A |
| Hard constraint | `db_TCL` never contacted by any automated test | Fully-Automated | static grep: every `ERP_DATABASE_URL` reference in `e2e/**` and `src/**/__tests__/**` points at `erp_fixture`, never a production host | A |
| Blast radius | `live-reconcile-script.ts` still imports a valid SQL constant after the S4 KEEP decision, comment/label text updated | Fully-Automated | `npx tsc --noEmit` + manual read confirming reconcile semantics/labels match | A |

Failing stubs: unchanged from cycle 5 (7 stubs — S2, S3, S7, S8×2, S11×2 — reproduced in the
plan's history, not re-pasted here since no new stub is warranted: this cycle's CONCERN extends an
EXISTING Fully-Automated row's test scope rather than introducing a wholly new behavior to stub).

What this coverage does NOT prove:
- Unchanged from cycles 1–5: none of these gates prove real ERP behavior against the live `db_TCL`
  server beyond the one-time research queries already recorded; Hybrid gates prove correctness only
  against `erp_fixture`; Agent-Probe gates are one-time visual/reading checks.
- NEW this cycle: even after the S11 fix above, these gates cannot prove that a FUTURE fourth
  simultaneous-render surface (were one ever added to this page) would automatically respect the
  same `view`-based mutual exclusivity — that structural invariant lives in `page.tsx`'s render
  branches, not in `dashboard-export-target.ts` itself, and no test in this plan asserts the
  invariant directly (only its current two-section consequence). Acceptable as a named residual:
  this plan does not add a third section, so the invariant's current scope is fully covered by the
  S8/S11 gates above; a future plan adding a third section must re-verify this invariant explicitly.

### Known Gaps carried forward (not new, already documented correctly in the plan)

- ERP-env-dependent gates (every Hybrid row above) must be confirmed by the orchestrator or the
  user running the suite directly with the env inline — a `vc-tester`/EVL subagent sandbox cannot
  materialize `ERP_DATABASE_URL`/`ERP_ALLOW_WRITE_CAPABLE_LOGIN` (recurring, durable finding across
  Phases 2/3/5 of the prior program and every PVL cycle of this plan, re-confirmed accurate).

### Open gaps

0 FAIL + 1 CONCERN remains (see Layer 2 findings detail table above): the `deriveExportTarget()`
section-resolution mechanism for the view-only (no drilldown param) case is not named, and its test
scenarios are not explicit. This is a plan-text gap, not a customer-input gap, and is safe to carry
as an execute-agent instruction rather than requiring a seventh plan-supplement cycle: the
underlying signal (`searchParams.view`) is genuinely sufficient, any reasonable implementation
choice (shared resolver export vs. hand-duplicated precedence) compiles and functions correctly for
both sections, and the concrete test scenarios needed to catch a wrong choice are now named above.
Detection if wrong: the two new S11 test scenarios (view-only, no invoiceNo/doNo) would fail
immediately and specifically if EXECUTE's chosen mechanism resolves the wrong section.

Gate: CONDITIONAL — 0 FAILs, 1 CONCERN accepted as an execute-agent instruction (not requiring a
plan-supplement cycle). Cycles 1, 3, and 5's fixes are re-confirmed correct and are not reopened.

Accepted by: session (autonomous PVL cycle 6, per this session's explicit instruction to prefer
CONDITIONAL over BLOCKED for CONCERN-level findings at this depth) — the accepted concern is: S11's
`deriveExportTarget()` section-resolution mechanism for the view-only case must be implemented via
a single shared resolver (not hand-duplicated), with the two named test scenarios added, before
Step S11 is considered done; EXECUTE must record its resolver-mechanism choice explicitly in the
EXECUTE report per the same discipline already required for Step S8 bullet 4 and the `view` enum
member naming.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Purchase SQL comment-only diff (P1, P2) | Fully-Automated (`git diff` + existing purchase-sql drift test) | Divergences documented without behavior change |
| Manifest conformance test incl. `SalesInvoiceDtl` | Fully-Automated | S1 — new table columns match live schema, no invented columns |
| `resolveSalesBasisFromValue("invoice")` returns `"invoice"`; unknown values still fall back to `"do"` | Fully-Automated (unit test) | S2 — invoice basis is selectable, safe default preserved |
| `tsc --noEmit` clean after `SalesBasis` union change | Fully-Automated | S2 — no unhandled exhaustive-switch site |
| Fixture-seed idempotency regression test green with extended `SalesInvoiceDtl` rows | Fully-Automated | S2b — fixture extension stays order-independent |
| Manifest conformance test incl. all 5 new invoice `.sql` files; `erp-query-schema-conformance.test.ts` incl. their `ERP_QUERY_COLUMNS` entries | Fully-Automated | S3 — no invented columns in new queries; every file has a column contract |
| `SUM(ISNULL(Amount,0))` in `invoice-headers.sql`/`invoice-lines.sql` doesn't crash on the DO-2608-0007 NULL-amount case | Fully-Automated (unit test against extended `erp_fixture` fixture row) | S3 — NULL-amount edge case handled |
| SQL/TS drift test across all touched `.sql` files | Fully-Automated (hard gate) | S6 — mirrors stay byte-identical |
| Fetch wrapper unit tests: success path + ERP-down degrade path, both invoice and existing DO wrappers unchanged | Fully-Automated | S7 — new wrappers match established never-500 contract |
| `sales-url.ts` `view`/`invoiceNo`/`doNo` parsing unit test incl. stale-value fallback to `"summary"`, precedence (`doNo`/`invoiceNo` beats an unrecognized `view`), and the combined case `?view=documents&doNo=DO-2608-0008` (resolves to the delivery section's drilldown) | Fully-Automated | S8/S10 — URL contract shape and backward compatibility |
| `/dashboards/sales` renders both sections, money gated per role, no console error, each section degrades independently on simulated ERP failure | Hybrid (`erp_fixture` local sandbox) | S8 — page restructure correctness |
| Status donut appears exactly once, in Delivery section, both roles | Agent-Probe | S9 |
| Invoice drilldown (`invoiceNo` param, same page) renders one invoice + lines, money-gated | Hybrid | S10 |
| `ExportTable` widened union compiles clean against every existing consumer | Fully-Automated | S11 — export-target contract change is safe |
| CSV export: STAFF invoice/delivery exports omit money columns entirely (column-count assertion), all 4 export shapes | Fully-Automated | S11 — money-omission rule holds on new tables |
| CSV export: manual download/open, encoding/format correct | Hybrid | S11 |
| Full unit + e2e regression suite green, before/after counts recorded; DO-path data/logic unchanged, DO-path test assertions may be updated | Fully-Automated | S12 — DO path unaffected |
| Footnote copy no longer says "excluded" near invoice total, in `page.tsx`, `sales-invoice-excluded-total.sql`, and `live-reconcile-script.ts` | Agent-Probe | S13 |
| `db_TCL` never contacted by any automated test (static grep of test files for direct `ERP_DATABASE_URL` usage outside `erp_fixture`) | Fully-Automated | Hard constraint — read-only ERP safety |
| `live-reconcile-script.ts` import of `SALES_INVOICE_EXCLUDED_TOTAL_SQL` still resolves; comment/label text updated | Fully-Automated (`tsc --noEmit`) + Agent-Probe (label read) | Step S4 KEEP decision is safe |

## Test Infra Improvement Notes

The existing SQL/TS drift test and manifest conformance test are reused as-is — no new test
infrastructure is required for this plan beyond the standard `erp_fixture` sandbox already
established by the prior program, plus the Step S2b fixture-seed extension (using the existing
seed-file mechanism, not a new one). One infra gap carried forward from the prior program remains
unresolved and is NOT this plan's responsibility to fix: `vc-tester`/EVL subagent sandboxes
cannot materialize `ERP_DATABASE_URL`/`ERP_ALLOW_WRITE_CAPABLE_LOGIN` — ERP-env-dependent gates in
this plan (the Hybrid rows above) must be confirmed by the orchestrator or user running the suite
directly with the env inline, per `process/context/tests/all-tests.md`, not by a spawned
`vc-tester` subagent.

## Known Gaps / Explicitly Out of Scope

- No change to the Purchase dashboard's query logic — comment-only.
- No change to the Production dashboard.
- No retroactive re-labeling of historical DO records for the 4 already-invoiced DOs — the
  Delivery section keeps showing all 84 DOs as before; there is no "invoiced" badge added to the
  DO list in this plan (a reasonable future enhancement, not required by the customer instruction
  driving this plan).
- `AccountName`/`ItemRefCode`/other rarely-used `SalesInvoiceDtl` columns beyond what the 5 new
  queries need are not exposed anywhere — the full 58-column list is recorded in the manifest for
  conformance-checking purposes only, not because every column is surfaced in the UI.
- The AR/payment fields (`AmountDue`, `ReceiptPaymentAmt`, `IsPaid`) are NOT built into any
  "outstanding balance" widget — research found them unreliable on this site (all 4 invoices show
  `IsPaid=1` yet full `AmountDue`). If the customer later wants AR tracking, that is new-plan
  scope, not silently added here.
- The synthetic `SalesInvoiceDtl` fixture rows added in Step S2b are for test-logic coverage only
  — they are not, and are never claimed to be, a match for live `db_TCL` invoice-line data.

## Autonomous Goal Block

This is a single COMPLEX plan, not a phase program — there is no standing `/goal` umbrella for
this task. This section exists only to record the EXECUTE authorization boundary:

- **EXECUTE is authorized as of cycle 6's `Gate: CONDITIONAL`** (0 FAIL, 1 accepted CONCERN — see
  `## Validate Contract`). The plan's own hard rule holds: only a fresh VALIDATE run moves the
  gate, and this cycle 6 pass is that fresh run, from V1, against real files.
- The one accepted CONCERN is an execute-agent instruction, not a blocker: Step S11's
  `deriveExportTarget()` must resolve section identity via a single shared resolver exported from
  `sales-url.ts` (not hand-duplicated precedence logic), with the two named view-only test
  scenarios added. EXECUTE must record which resolver-mechanism it used in the EXECUTE report.
- Hard stop conditions carried from Hard Constraints above apply unchanged: no ERP write of any
  kind; `db_TCL` never contacted by an automated test; no invented columns; STAFF money omission
  intact on every new surface.

## Resume and Execution Handoff

- **Exact plan file to pass to `vc-execute-agent`:** this file —
  `process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md`.
- **No supporting legacy phase files** — this is a single COMPLEX plan, not a phase program.
- **Step order is a hard dependency chain:** P1/P2 (independent, can run anytime) → S1 → S2 →
  S2b → S3+S6 (interleaved per-file, incl. `erp-query-columns.ts` entries) → S4 → S5 → S7 → S8 →
  S9/S10/S11 (can proceed in any order once S8 lands, since each depends only on S7's wrappers and
  S8's section split) → S12 → S13 (must be last since it depends on the final section layout from
  S8 being settled).
- **If EXECUTE is resumed after compaction:** check `git diff` against this plan's Blast Radius
  file list to determine which steps already landed; re-run the Step S6 drift test first — it is
  the cheapest signal of exactly how far execution progressed, since any unmirrored `.sql` file
  fails it immediately and by name.
- **Judgment calls already recorded by the cycle-3 supplement (no longer open for EXECUTE to decide):**
  the Step S4 fate of `sales-invoice-excluded-total.sql` is LOCKED as KEEP-and-rewrite-comment. The
  Step S8 degrade-behavior design is LOCKED as independent-per-section.
- **Judgment call EXECUTE must still record explicitly (not silently decide):** the Step S8
  bullet-4 breakdown-table reuse-vs-adapt decision, and the exact final `view` enum member names
  (must match the 5-value shape locked in Public Contracts, naming is EXECUTE's to finalize against
  the file's existing style). Both must appear in the EXECUTE report.
- **Validate-contract:** cycle 6's fresh V1 pass (see `## Validate Contract` above) confirms
  `Gate: CONDITIONAL` — 0 FAIL, 1 accepted CONCERN on Step S11 (deriveExportTarget's section-
  resolution mechanism for the view-only case). Cycles 1, 3, and 5's prior supplements (19 total
  gaps across all three) remain correctly resolved and are NOT reopened. EXECUTE is authorized to
  proceed; Step S11 must additionally satisfy the one accepted CONCERN's fix (shared resolver +
  two new test scenarios) as part of doing that step, not as a precondition to starting the plan.

## Next Step

Cycle 6 VALIDATE ran fresh from V1 against the real files on disk (not a re-read of prior plan
text) and confirms: all 4 of cycle 4's findings, and all of cycles 1/3/5's fixes, hold correctly.
One new CONCERN surfaced one layer deeper in the same CSV-export area — see
`sales-invoice-basis-pvl-iteration-006_REPORT_23-09-26.md` and `## Validate Contract` above.

**Gate: CONDITIONAL. EXECUTE is authorized.** 6 of 10 permitted PVL cycles used (0 baseline,
1 supplement, 2 re-validate, 3 supplement, 4 re-validate, 5 supplement, 6 this re-validate) — no
plateau, and the loop has reached a natural floor: 4 → 4 → 2 → 0 FAILs across the re-validate
passes, with each pass finding something strictly narrower than the last. The one remaining
CONCERN is carried into EXECUTE as an explicit Step S11 instruction rather than spent on a seventh
plan-supplement cycle.
