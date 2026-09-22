// erp-dashboards Phase 5 — turning an export target into `{ headers, rows }`.
//
// REUSE, NEVER RE-DERIVE. Each branch below calls the EXACT data-fetch function the matching
// dashboard page already calls, with the filters parsed by that dashboard's OWN url parser, and —
// for Purchase — the same `buildPoViews()` assembler. There is no second query path and no second
// copy of the filter/sort rules, so an export can never disagree with the screen it came from.
// Every read therefore also passes Phase 1's `guardedQuery()` choke point by construction.
//
// MONEY (AC9/AC14): `canSeeMoney` is computed ONCE in `route.ts` from the server session and
// passed in here. A money column is OMITTED ENTIRELY for STAFF — neither its header nor its cell
// is emitted, so a Staff CSV has strictly fewer columns than an Admin CSV. Nothing is blanked in
// place: there is no "—" to un-redact.
//
// DATES: every date cell renders through `ceToBeDisplay()` (Buddhist Era, d/m/yy), the same helper
// every BE-displaying surface in the app uses. A raw CE/ISO date never reaches the file.
//
// UNITS: quantity columns always ship with their own unit column. Quantities are never summed
// across units anywhere in this program, and an export must not be the place that first does it.

import { ceToBeDisplay, parseDateInputValue } from "@/lib/be-date";
import type { CsvCell, CsvTable } from "@/lib/erp/csv-export";
import type { ExportTarget } from "@/lib/erp/dashboard-export-target";

import { fetchDoHeaders, fetchDoLines, isoDate as salesIsoDate } from "@/lib/sales-queries";
import type { SalesFilters } from "@/lib/sales-queries";
import { parseSalesUrl, sortRows as salesSortRows } from "@/app/(main)/dashboards/sales/sales-url";
import { DO_LIST_CSV_COLUMNS } from "@/app/(main)/dashboards/sales/do-list-table";
import { DO_LINES_CSV_COLUMNS } from "@/app/(main)/dashboards/sales/do-lines-table";

import {
  fetchPoLines,
  fetchPoList,
  fetchPoReceived,
  type PurchaseFilters,
} from "@/lib/purchase-data";
import {
  parsePurchaseUrl,
  sortRows as purchaseSortRows,
} from "@/app/(main)/dashboards/purchase/purchase-url";
import { buildPoViews, type PoView } from "@/app/(main)/dashboards/purchase/purchase-view";
import { PO_LIST_CSV_COLUMNS } from "@/app/(main)/dashboards/purchase/po-list-table";
import { poStatusLabel } from "@/lib/purchase-calc";

import { getMaterialIssuesForMo, getProductionMoList, isoDate as prodIsoDate } from "@/lib/production-data";
import {
  parseProductionUrl,
  sortRows as productionSortRows,
} from "@/app/(main)/dashboards/production/production-url";
import { ACTUAL_PRODUCED_EMPTY_TEXT, moStatusLabel } from "@/lib/production-status";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ExportDataset extends CsvTable {
  /** True when any underlying read served a stale last-known-good value (Phase 1 degrade path). */
  stale: boolean;
}

/** BE `d/m/yy` for a CE `yyyy-mm-dd`; empty string stays empty rather than becoming "1/1/13". */
function be(iso: string): string {
  return iso ? ceToBeDisplay(parseDateInputValue(iso)) : "";
}

function paramsFromSearch(search: URLSearchParams): RawSearchParams {
  const raw: RawSearchParams = {};
  for (const key of new Set(search.keys())) {
    const all = search.getAll(key);
    raw[key] = all.length > 1 ? all : all[0];
  }
  return raw;
}

// ---------------------------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------------------------

async function salesList(raw: RawSearchParams, canSeeMoney: boolean): Promise<ExportDataset> {
  const state = parseSalesUrl(raw);
  const filters: SalesFilters = {
    from: state.from,
    to: state.to,
    doNo: state.doNo,
    customer: state.customer,
    product: state.product,
    status: state.status,
    cat: state.cat,
  };
  const headers = await fetchDoHeaders(filters);

  // The SAME sort accessors and default the on-screen DO list uses, so the file's row order
  // matches the table the user was looking at.
  const sorted = salesSortRows(
    headers.value,
    state.sort,
    {
      doNo: (r) => r.DoNo,
      date: (r) => salesIsoDate(r.Dodate),
      cust: (r) => r.CustName ?? r.CustCode ?? "",
      lines: (r) => Number(r.LineCount),
      amount: (r) => Number(r.Amount),
      status: (r) => r.StatusKey,
    },
    { key: "date", desc: true },
  );

  const columns = DO_LIST_CSV_COLUMNS.filter((c) => canSeeMoney || c.money !== true);
  return {
    headers: columns.map((c) => c.csvLabel),
    rows: sorted.map((row) =>
      columns.map((c) => (c.key === "date" ? be(salesIsoDate(row.Dodate)) : c.csvValue(row))),
    ),
    stale: headers.stale,
  };
}

async function salesLines(raw: RawSearchParams, canSeeMoney: boolean): Promise<ExportDataset> {
  const state = parseSalesUrl(raw);
  const filters: SalesFilters = {
    from: state.from,
    to: state.to,
    doNo: state.doNo,
    customer: state.customer,
    product: state.product,
    status: state.status,
    cat: state.cat,
  };
  const lines = await fetchDoLines(filters);

  const sorted = salesSortRows(
    lines.value,
    state.sort,
    {
      item: (r) => r.ItemName,
      qty: (r) => Number(r.Qty),
      unit: (r) => r.Unit,
      price: (r) => Number(r.Saleprice),
      amount: (r) => Number(r.Amount),
    },
    { key: "item", desc: false },
  );

  const columns = DO_LINES_CSV_COLUMNS.filter((c) => canSeeMoney || c.money !== true);
  return {
    headers: columns.map((c) => c.csvLabel),
    rows: sorted.map((row) => columns.map((c) => c.csvValue(row))),
    stale: lines.stale,
  };
}

// ---------------------------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------------------------

/** The PO detail page's own wide range: a PO may sit outside the filter range the user came from. */
const PURCHASE_WIDE_RANGE = { from: "1900-01-01", to: "2999-12-31" };

async function purchaseList(raw: RawSearchParams, canSeeMoney: boolean): Promise<ExportDataset> {
  const state = parsePurchaseUrl(raw);
  const filters: PurchaseFilters = { from: state.from, to: state.to, supplier: state.supplier };

  const [headers, lines, received] = await Promise.all([
    fetchPoList(filters),
    fetchPoLines(filters),
    fetchPoReceived(),
  ]);

  const allViews = buildPoViews(headers.value, lines.value, received.value, canSeeMoney);
  // `?status=` is a TS filter on the page too (status is derived, never a SQL column).
  const filtered = state.status ? allViews.filter((v) => v.status === state.status) : allViews;

  const sorted = purchaseSortRows<PoView>(
    filtered,
    state.sort,
    {
      poNo: (r) => r.poNumber,
      date: (r) => r.date,
      supplier: (r) => r.supplierCode,
      status: (r) => poStatusLabel(r.status),
      amount: (r) => r.totalAmount ?? 0,
    },
    { key: "date", desc: true },
  );

  const columns = PO_LIST_CSV_COLUMNS.filter((c) => canSeeMoney || c.money !== true);
  return {
    headers: columns.map((c) => c.csvLabel),
    rows: sorted.map((row) =>
      columns.map((c) => (c.key === "date" ? be(row.date) : c.csvValue(row))),
    ),
    stale: headers.stale || lines.stale || received.stale,
  };
}

/**
 * PO line columns. `po-lines-table.tsx` renders quantity and unit fused into one cell
 * (`formatQtyWithUnit`); a spreadsheet needs them split, so the unit gets its own column here.
 * Every other header string is the on-screen label verbatim.
 */
const PO_LINES_CSV_COLUMNS: ReadonlyArray<{
  csvLabel: string;
  csvValue: (row: PoView["lines"][number]) => CsvCell;
  money?: boolean;
}> = [
  { csvLabel: "รหัสสินค้า", csvValue: (r) => r.itemCode },
  { csvLabel: "หน่วย", csvValue: (r) => r.unit },
  { csvLabel: "จำนวนสั่ง", csvValue: (r) => r.qty },
  { csvLabel: "จำนวนรับแล้ว", csvValue: (r) => r.received },
  { csvLabel: "จำนวนค้างรับ", csvValue: (r) => r.outstanding },
  { csvLabel: "ราคาต่อหน่วย", csvValue: (r) => r.unitPrice ?? 0, money: true },
  { csvLabel: "จำนวนเงิน", csvValue: (r) => r.amount ?? 0, money: true },
];

async function purchaseLines(
  raw: RawSearchParams,
  canSeeMoney: boolean,
  poNumber: string,
): Promise<ExportDataset> {
  const state = parsePurchaseUrl(raw);
  const headers = await fetchPoList({ ...PURCHASE_WIDE_RANGE, poNumber });
  const header = headers.value[0];
  const [lines, received] = await Promise.all([
    fetchPoLines(PURCHASE_WIDE_RANGE, header?.TransactionNo ?? null),
    fetchPoReceived(poNumber),
  ]);

  const view = buildPoViews(headers.value, lines.value, received.value, canSeeMoney)[0];
  const lineViews = view?.lines ?? [];

  const sorted = purchaseSortRows(
    lineViews,
    state.sort,
    {
      item: (r) => r.itemCode,
      qty: (r) => r.qty,
      received: (r) => r.received,
      outstanding: (r) => r.outstanding,
      price: (r) => r.unitPrice ?? 0,
      amount: (r) => r.amount ?? 0,
    },
    { key: "item", desc: false },
  );

  const columns = PO_LINES_CSV_COLUMNS.filter((c) => canSeeMoney || c.money !== true);
  return {
    headers: columns.map((c) => c.csvLabel),
    rows: sorted.map((row) => columns.map((c) => c.csvValue(row))),
    stale: headers.stale || lines.stale || received.stale,
  };
}

// ---------------------------------------------------------------------------------------------
// Production — PLAN-ONLY, and there is no money on this dashboard at all (SPEC AC7/AC8).
// ---------------------------------------------------------------------------------------------

async function productionList(raw: RawSearchParams): Promise<ExportDataset> {
  const state = parseProductionUrl(raw);
  const mos = await getProductionMoList({
    dateFrom: state.from,
    dateTo: state.to,
    status: state.status,
  });

  const sorted = productionSortRows(
    mos.value,
    state.sort,
    {
      moNo: (r) => r.MoNumBer,
      item: (r) => r.FgName,
      date: (r) => prodIsoDate(r.Modate),
      qty: (r) => Number(r.PlannedQty),
      status: (r) => r.StatusKey,
    },
    { key: "moNo", desc: true },
  );

  return {
    headers: [
      "เลขที่ใบสั่งผลิต",
      "สินค้า",
      "รหัสสินค้า",
      "วันที่ตามแผน",
      "ปริมาณตามแผน",
      "หน่วย",
      "สถานะ",
      "ผลิตจริง",
    ],
    rows: sorted.map((mo) => [
      mo.MoNumBer,
      mo.FgName,
      mo.FgCode ?? "",
      be(prodIsoDate(mo.Modate)),
      Number(mo.PlannedQty),
      mo.MainUnits,
      moStatusLabel(mo.StatusKey),
      // AC7: the "actual produced" column exists on screen and in the file, and is EMPTY-BY-TEXT
      // in both. It must never be back-filled with a planned quantity.
      ACTUAL_PRODUCED_EMPTY_TEXT,
    ]),
    stale: mos.stale,
  };
}

async function productionLines(moNumber: string): Promise<ExportDataset> {
  const issues = await getMaterialIssuesForMo(moNumber);
  return {
    headers: ["รหัสสินค้า", "ชื่อสินค้า", "จำนวน", "หน่วย", "วันที่เบิก"],
    rows: issues.value.map((line) => [
      line.ItemCode,
      line.ItemName,
      Number(line.Qty),
      line.MainUnits,
      be(prodIsoDate(line.TransactionDate)),
    ]),
    stale: issues.stale,
  };
}

// ---------------------------------------------------------------------------------------------

/** Resolve one export target to its serializable table. */
export function loadExportDataset(
  target: ExportTarget,
  search: URLSearchParams,
  canSeeMoney: boolean,
): Promise<ExportDataset> {
  const raw = paramsFromSearch(search);
  switch (`${target.dashboard}:${target.table}` as const) {
    case "sales:list":
      return salesList(raw, canSeeMoney);
    case "sales:lines":
      return salesLines(raw, canSeeMoney);
    case "purchase:list":
      return purchaseList(raw, canSeeMoney);
    case "purchase:lines":
      return purchaseLines(raw, canSeeMoney, target.key ?? "");
    case "production:list":
      return productionList(raw);
    default:
      return productionLines(target.key ?? "");
  }
}
