// erp-dashboards Phase 3 — the Purchase dashboard's ERP read layer.
//
// EVERY read here goes through Phase 1's `guardedQuery()` choke point. There is no other path: no
// Prisma, no `$queryRaw`, no ERP model in `prisma/schema.prisma`, no direct pool request. The SQL
// text comes from the versioned files in `db/erp-queries/purchase/` (embedded via `purchase-sql.ts`,
// which a unit gate keeps byte-identical to those files).
//
// PARAMETERIZATION: every filter is a NAMED parameter bound by `guardedQuery` via
// `request.input(...)`. No filter value is ever concatenated into SQL text — the statements are
// fully static and use the `(@p IS NULL OR col = @p)` form so one statement serves every filter
// combination.
//
// STATUS IS NOT A SQL FILTER. `derivePoStatus()` owns the status rule (one testable place), so the
// `?status=` filter is applied in TS over the rows this module returns — see `page.tsx`.
//
// Imports are RELATIVE (not `@/`) so this module stays loadable by vitest for Hybrid gates.

import { guardedQuery, type ErpQueryParams } from "./erp/erp-adapter";
import { getErpPool } from "./erp/pool";
import { getCached, ERP_CACHE_TTL_MS, type CachedResult } from "./erp/cache";
import {
  PO_LINES_SQL,
  PO_LIST_SQL,
  PO_RECEIVED_SQL,
  SUPPLIER_BREAKDOWN_SQL,
  TOTAL_INVOICE_BASIS_SQL,
  TOTAL_PO_COMMITTED_BASIS_SQL,
} from "./purchase-sql";

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export interface PurchaseFilters {
  /** CE `yyyy-mm-dd`, inclusive. */
  from: string;
  to: string;
  /** SupplierCode — never a supplier name. */
  supplier?: string | null;
  /** Single-PO drilldown. */
  poNumber?: string | null;
}

/**
 * Cross-filter semantics (approved mockup): the supplier chart/donut is filtered by every OTHER
 * active filter but NOT by its own dimension, so a user can always click a different supplier
 * instead of the chart collapsing to 100% of the current selection.
 */
export interface PurchaseQueryOptions {
  skipSupplier?: boolean;
}

function blank(value: string | null | undefined): string | null {
  return value == null || value === "" ? null : value;
}

function rangeParams(
  filters: PurchaseFilters,
  options: PurchaseQueryOptions = {},
): ErpQueryParams {
  return {
    from: filters.from,
    to: filters.to,
    supplier: options.skipSupplier === true ? null : blank(filters.supplier),
  };
}

/** Stable cache key — the query name plus every bound parameter value. */
function cacheKey(name: string, params: ErpQueryParams): string {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k] ?? "")}`);
  return `purchase:${name}:${parts.join("&")}`;
}

// ---------------------------------------------------------------------------------------------
// Row shapes (mssql returns BIT as boolean and DECIMAL as a JS number at these column widths)
// ---------------------------------------------------------------------------------------------

/** One purchase invoice that PASSES KRS's own `sp_PurchaseInvoiceMonth` filter. */
export interface PurchaseInvoiceRow {
  TransactionNo: number;
  VoucherNo: string;
  VoucherDate: Date | string | null;
  DocuType: string | null;
  PurchaseType: string | null;
  SupplierCode: string | null;
  TotalAmount: number;
}

export interface PoCommittedTotalsRow {
  TotalPoCommitted: number | null;
  PoCount: number;
  SupplierCount: number;
}

export interface SupplierPoRow {
  SupplierCode: string | null;
  TotalPoCommitted: number;
  PoCount: number;
}

/** A PO header with its RAW status flags — `IsClosed` arrives as `null` on every open PO. */
export interface PoHeaderRow {
  TransactionNo: number;
  PONumber: string;
  /** `PurchaseOrderHdr.PODate`, aliased in SQL so the row-shape name matches the rest of the app. */
  VoucherDate: Date | string | null;
  SupplierCode: string | null;
  TotalAmount: number;
  IsCancel: boolean | null;
  IsClosed: boolean | null;
  IsComplete: boolean | null;
  IsRecPo: boolean | null;
  IsApproved: boolean | null;
  IsCheck: boolean | null;
}

export interface PoLineRow {
  TransactionNo: number;
  PONumber: string;
  Number: number;
  ItemCode: string;
  Unit: string | null;
  Qty: number;
  UnitPrice: number;
  Amount: number;
}

export interface PoReceivedRow {
  PoNo: string;
  ItemCode: string;
  ReceivedQty: number;
}

// ---------------------------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------------------------

/**
 * Run one Purchase query through the guard. Exported so a Hybrid gate can exercise the REAL SQL
 * against `erp_fixture` rather than re-deriving the arithmetic in memory.
 */
export async function runPurchaseQuery<T>(sql: string, params: ErpQueryParams): Promise<T[]> {
  const pool = await getErpPool();
  return guardedQuery<T>(pool, sql, params);
}

/**
 * Cached read. On an ERP failure `getCached` serves the last known good value with `stale: true` so
 * the page still renders behind the degrade banner instead of erroring (Phase 1 contract). When
 * nothing has ever been cached it re-throws — the page turns that into an explicit Thai
 * "ERP unavailable" view rather than Next's generic 500.
 */
function cachedPurchaseQuery<T>(
  name: string,
  sql: string,
  params: ErpQueryParams,
): Promise<CachedResult<T[]>> {
  return getCached<T[]>(cacheKey(name, params), ERP_CACHE_TTL_MS, () =>
    runPurchaseQuery<T>(sql, params),
  );
}

/**
 * The INVOICE-BASIS rows (KRS's billed-purchase rule). Rows, not a SUM: the KPI tile, the period
 * chart and the supplier donut all aggregate this same set at different groupings, which keeps the
 * three figures arithmetically identical by construction.
 */
export function fetchPurchaseInvoices(
  filters: PurchaseFilters,
  options?: PurchaseQueryOptions,
): Promise<CachedResult<PurchaseInvoiceRow[]>> {
  return cachedPurchaseQuery<PurchaseInvoiceRow>(
    "invoices",
    TOTAL_INVOICE_BASIS_SQL,
    rangeParams(filters, options),
  );
}

/** The PO-COMMITTED-BASIS total plus the PO and supplier counts (cancelled orders excluded). */
export function fetchPoCommittedTotals(
  filters: PurchaseFilters,
  options?: PurchaseQueryOptions,
): Promise<CachedResult<PoCommittedTotalsRow[]>> {
  return cachedPurchaseQuery<PoCommittedTotalsRow>(
    "po-totals",
    TOTAL_PO_COMMITTED_BASIS_SQL,
    rangeParams(filters, options),
  );
}

export function fetchSupplierBreakdown(
  filters: PurchaseFilters,
  options?: PurchaseQueryOptions,
): Promise<CachedResult<SupplierPoRow[]>> {
  return cachedPurchaseQuery<SupplierPoRow>(
    "supplier-breakdown",
    SUPPLIER_BREAKDOWN_SQL,
    rangeParams(filters, options),
  );
}

/**
 * PO headers — INCLUDING cancelled ones. The status donut counts every order (a cancelled order is
 * a real thing that happened) while the money KPIs exclude them; the page decides which set it
 * wants from this one read.
 */
export function fetchPoList(
  filters: PurchaseFilters,
  options?: PurchaseQueryOptions,
): Promise<CachedResult<PoHeaderRow[]>> {
  return cachedPurchaseQuery<PoHeaderRow>("po-list", PO_LIST_SQL, {
    ...rangeParams(filters, options),
    poNumber: blank(filters.poNumber),
  });
}

/**
 * PO lines. `transactionNo` omitted = every line in range, which is how the PO list shows an
 * aggregated รับแล้ว/ค้างรับ per PO in ONE round trip instead of N+1 queries.
 */
export function fetchPoLines(
  filters: PurchaseFilters,
  transactionNo?: number | null,
): Promise<CachedResult<PoLineRow[]>> {
  return cachedPurchaseQuery<PoLineRow>("po-lines", PO_LINES_SQL, {
    from: filters.from,
    to: filters.to,
    transactionNo: transactionNo ?? null,
  });
}

/**
 * Received quantity per PO line, via the ERP's own `sp_Popending` logic. `poNumber` omitted =
 * every PO, matching `fetchPoLines`' one-round-trip shape.
 */
export function fetchPoReceived(
  poNumber?: string | null,
): Promise<CachedResult<PoReceivedRow[]>> {
  return cachedPurchaseQuery<PoReceivedRow>("po-received", PO_RECEIVED_SQL, {
    poNumber: blank(poNumber),
  });
}

/** Normalise a SQL Server DATE column to a CE `yyyy-mm-dd` string (UTC-safe, no TZ drift). */
export function isoDate(value: Date | string | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** `mssql` can hand DECIMAL back as a string on some drivers/widths — normalise once, here. */
export function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Key a received-quantity lookup the same way `sp_Popending` groups it: PO number + item code. */
export function receivedKey(poNumber: string, itemCode: string): string {
  return `${poNumber} ${itemCode}`;
}

export function receivedMap(rows: readonly PoReceivedRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(receivedKey(row.PoNo, row.ItemCode), toNumber(row.ReceivedQty));
  }
  return map;
}
