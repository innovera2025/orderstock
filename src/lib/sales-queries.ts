// erp-dashboards Phase 2 — the Sales dashboard's ERP read layer.
//
// EVERY read here goes through Phase 1's `guardedQuery()` choke point. There is no other path:
// no Prisma, no `$queryRaw`, no ERP model in `prisma/schema.prisma`, no direct pool request.
// The SQL text comes from the versioned files in `db/erp-queries/sales/` (embedded via
// `sales-sql.ts`, which a unit gate keeps byte-identical to those files).
//
// PARAMETERIZATION (execute-agent instruction E2): every filter is a NAMED parameter bound by
// `guardedQuery` via `request.input(...)`. No filter value is ever concatenated into SQL text —
// the statements are fully static and use the `(@p IS NULL OR col = @p)` form so one statement
// serves every filter combination.
//
// Imports are RELATIVE (not `@/`) so this module stays loadable by vitest for the Hybrid gates.

import { guardedQuery, type ErpQueryParams } from "./erp/erp-adapter";
import { getErpPool } from "./erp/pool";
import { getCached, ERP_CACHE_TTL_MS, type CachedResult } from "./erp/cache";
import {
  DO_BY_CUSTOMER_SQL,
  DO_BY_PRODUCT_SQL,
  DO_HEADERS_SQL,
  DO_LINES_SQL,
  SALES_INVOICE_EXCLUDED_TOTAL_SQL,
} from "./sales-sql";

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export interface SalesFilters {
  /** CE `yyyy-mm-dd`, inclusive. */
  from: string;
  to: string;
  doNo?: string | null;
  customer?: string | null;
  product?: string | null;
  status?: string | null;
  cat?: string | null;
}

/**
 * Cross-filter semantics (approved mockup): the status donut and the category pie are each
 * filtered by every OTHER active filter but NOT by their own dimension, so a user can always click
 * a different slice instead of the chart collapsing to 100% of the current selection.
 */
export interface SalesQueryOptions {
  skipStatus?: boolean;
  skipCat?: boolean;
}

function toParams(filters: SalesFilters, options: SalesQueryOptions = {}): ErpQueryParams {
  const blank = (v: string | null | undefined) => (v == null || v === "" ? null : v);
  return {
    from: filters.from,
    to: filters.to,
    doNo: blank(filters.doNo),
    customer: blank(filters.customer),
    product: blank(filters.product),
    status: blank(filters.status),
    cat: blank(filters.cat),
    skipStatus: options.skipStatus === true,
    skipCat: options.skipCat === true,
  };
}

/** Stable cache key — the query name plus every bound parameter value. */
function cacheKey(name: string, params: ErpQueryParams): string {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k] ?? "")}`);
  return `sales:${name}:${parts.join("&")}`;
}

// ---------------------------------------------------------------------------------------------
// Row shapes (mssql returns DECIMAL as JS number for these column widths)
// ---------------------------------------------------------------------------------------------

export interface DoHeaderRow {
  TransactionNo: number;
  DoNo: string;
  Dodate: Date | null;
  CustCode: string | null;
  CustName: string | null;
  StatusKey: string;
  LineCount: number;
  PricedLineCount: number;
  Amount: number;
}

export interface DoLineRow {
  DoNo: string;
  Dodate: Date | null;
  CustCode: string | null;
  CustName: string | null;
  StatusKey: string;
  Roworder: number;
  ItemCode: string;
  ItemName: string;
  Unit: string;
  CategoryKey: string;
  Qty: number;
  Saleprice: number;
  Amount: number;
}

export interface DoProductRow {
  ItemCode: string;
  ItemName: string;
  Unit: string;
  CategoryKey: string;
  LineCount: number;
  Qty: number;
  Amount: number;
}

export interface DoCustomerRow {
  CustCode: string | null;
  CustName: string | null;
  Unit: string;
  LineCount: number;
  DoCount: number;
  Qty: number;
  Amount: number;
}

export interface ExcludedInvoiceRow {
  InvoiceCount: number;
  ExcludedTotal: number;
}

// ---------------------------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------------------------

/**
 * Run one Sales query through the guard. Exported so the Hybrid unit gates can exercise the REAL
 * SQL against `erp_fixture` rather than re-deriving the arithmetic in memory.
 */
export async function runSalesQuery<T>(sql: string, params: ErpQueryParams): Promise<T[]> {
  const pool = await getErpPool();
  return guardedQuery<T>(pool, sql, params);
}

/**
 * Cached read. On an ERP failure `getCached` serves the last known good value with `stale: true`
 * so the page still renders behind the degrade banner instead of erroring (Phase 1 contract).
 */
function cachedSalesQuery<T>(
  name: string,
  sql: string,
  params: ErpQueryParams,
): Promise<CachedResult<T[]>> {
  return getCached<T[]>(cacheKey(name, params), ERP_CACHE_TTL_MS, () =>
    runSalesQuery<T>(sql, params),
  );
}

export function fetchDoHeaders(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<DoHeaderRow[]>> {
  return cachedSalesQuery<DoHeaderRow>("headers", DO_HEADERS_SQL, toParams(filters, options));
}

export function fetchDoLines(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<DoLineRow[]>> {
  return cachedSalesQuery<DoLineRow>("lines", DO_LINES_SQL, toParams(filters, options));
}

export function fetchDoByProduct(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<DoProductRow[]>> {
  return cachedSalesQuery<DoProductRow>("by-product", DO_BY_PRODUCT_SQL, toParams(filters, options));
}

export function fetchDoByCustomer(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<DoCustomerRow[]>> {
  return cachedSalesQuery<DoCustomerRow>(
    "by-customer",
    DO_BY_CUSTOMER_SQL,
    toParams(filters, options),
  );
}

/**
 * The reconciliation-footnote read. Deliberately UNFILTERED: the footnote discloses the whole
 * excluded pool, so a narrow date filter can never shrink the number the user is warned about.
 */
export function fetchExcludedInvoiceTotal(): Promise<CachedResult<ExcludedInvoiceRow[]>> {
  return getCached<ExcludedInvoiceRow[]>("sales:excluded-invoice-total", ERP_CACHE_TTL_MS, () =>
    runSalesQuery<ExcludedInvoiceRow>(SALES_INVOICE_EXCLUDED_TOTAL_SQL, {}),
  );
}

/** Normalise a SQL Server DATE column to a CE `yyyy-mm-dd` string (UTC-safe, no TZ drift). */
export function isoDate(value: Date | string | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
