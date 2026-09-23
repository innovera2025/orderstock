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
import type { ErpDateRangeRow } from "./erp-date-range";
import {
  DO_BY_CUSTOMER_SQL,
  DO_BY_PRODUCT_SQL,
  DO_DATE_RANGE_SQL,
  DO_HEADERS_SQL,
  DO_LINES_SQL,
  SALES_INVOICE_EXCLUDED_TOTAL_SQL,
  INVOICE_HEADERS_SQL,
  INVOICE_LINES_SQL,
  INVOICE_BY_PRODUCT_SQL,
  INVOICE_BY_CUSTOMER_SQL,
  INVOICE_DATE_RANGE_SQL,
} from "./sales-sql";

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export interface SalesFilters {
  /** CE `yyyy-mm-dd`, inclusive. */
  from: string;
  to: string;
  doNo?: string | null;
  /** sales-invoice-basis: the invoice-section drilldown. Applies to the `invoice*` queries only. */
  invoiceNo?: string | null;
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

/**
 * The INVOICE queries' parameter set (sales-invoice-basis, 23-09-26).
 *
 * Deliberately NOT `toParams()`: the invoice section has no `doNo`, no `status` and no
 * `skipStatus`. All four live invoices share identical status flags, so a status filter there
 * would have exactly one possible value — the dashboard gives the invoice section no status
 * filter and no status donut at all. Binding parameters a statement never references would be
 * harmless but misleading; a separate, exact set keeps the SQL and its bindings in step.
 */
function toInvoiceParams(filters: SalesFilters, options: SalesQueryOptions = {}): ErpQueryParams {
  const blank = (v: string | null | undefined) => (v == null || v === "" ? null : v);
  return {
    from: filters.from,
    to: filters.to,
    invoiceNo: blank(filters.invoiceNo),
    customer: blank(filters.customer),
    product: blank(filters.product),
    cat: blank(filters.cat),
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
  /** The ERP's own `tbl_ItemGroup.Description`; NULL when the code has no group row. */
  CategoryLabel: string | null;
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

// --- invoice basis (sales-invoice-basis, 23-09-26) --------------------------------------------
// `Unit` on every shape below is the LINE's own `MainUnits`, never the item master's.

export interface InvoiceHeaderRow {
  TransactionNo: number;
  InvoiceNo: string;
  InvDate: Date | null;
  CustCode: string | null;
  CustName: string | null;
  /** The header's own `TotalAmount`. */
  Amount: number;
  LineCount: number;
  /** NULL-safe sum of the invoice's line amounts; ties to `Amount` on every live invoice. */
  LineAmount: number;
}

export interface InvoiceLineRow {
  InvoiceNo: string;
  InvDate: Date | null;
  CustCode: string | null;
  CustName: string | null;
  RowOrder: number;
  ItemOrder: number;
  ItemCode: string;
  ItemName: string;
  Unit: string;
  CategoryKey: string;
  /** The ERP's own `tbl_ItemGroup.Description`; NULL when the code has no group row. */
  CategoryLabel: string | null;
  Qty: number;
  UnitPrice: number;
  Amount: number;
  /** The delivery order this invoice line came from — the link back to the delivery section. */
  OrderNo: string | null;
}

export interface InvoiceProductRow {
  ItemCode: string;
  ItemName: string;
  Unit: string;
  CategoryKey: string;
  LineCount: number;
  Qty: number;
  Amount: number;
}

export interface InvoiceCustomerRow {
  CustCode: string | null;
  CustName: string | null;
  Unit: string;
  LineCount: number;
  InvoiceCount: number;
  Qty: number;
  Amount: number;
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

// ---------------------------------------------------------------------------------------------
// Invoice basis (sales-invoice-basis, 23-09-26) — the dashboard's PRIMARY money figures.
//
// Same `cachedSalesQuery` runner, same `CachedResult<T>` shape, same degrade-on-ERP-down
// behaviour as the `fetchDo*` wrappers above. There is deliberately NO second cache or degrade
// path: an invoice read that fails must serve last-known-good exactly like a delivery read does.
// Each wrapper uses a DISTINCT cache-key name so an invoice result can never be served from a
// delivery query's cache entry.
// ---------------------------------------------------------------------------------------------

export function fetchInvoiceHeaders(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<InvoiceHeaderRow[]>> {
  return cachedSalesQuery<InvoiceHeaderRow>(
    "invoice-headers",
    INVOICE_HEADERS_SQL,
    toInvoiceParams(filters, options),
  );
}

export function fetchInvoiceLines(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<InvoiceLineRow[]>> {
  return cachedSalesQuery<InvoiceLineRow>(
    "invoice-lines",
    INVOICE_LINES_SQL,
    toInvoiceParams(filters, options),
  );
}

export function fetchInvoiceByProduct(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<InvoiceProductRow[]>> {
  return cachedSalesQuery<InvoiceProductRow>(
    "invoice-by-product",
    INVOICE_BY_PRODUCT_SQL,
    toInvoiceParams(filters, options),
  );
}

export function fetchInvoiceByCustomer(
  filters: SalesFilters,
  options?: SalesQueryOptions,
): Promise<CachedResult<InvoiceCustomerRow[]>> {
  return cachedSalesQuery<InvoiceCustomerRow>(
    "invoice-by-customer",
    INVOICE_BY_CUSTOMER_SQL,
    toInvoiceParams(filters, options),
  );
}

/**
 * The invoice-basis ช่วงข้อมูล read. UNFILTERED, exactly like `fetchDoDateRange()`: the notice
 * reports what the ERP holds, not what the current filter selected.
 */
export function fetchInvoiceDateRange(): Promise<CachedResult<ErpDateRangeRow[]>> {
  return getCached<ErpDateRangeRow[]>("sales:invoice-date-range", ERP_CACHE_TTL_MS, () =>
    runSalesQuery<ErpDateRangeRow>(INVOICE_DATE_RANGE_SQL, {}),
  );
}

/**
 * The ช่วงข้อมูล read: the FULL delivery-order date span and document count the ERP holds.
 *
 * Deliberately UNFILTERED, exactly like `fetchExcludedInvoiceTotal()` above: the notice tells the
 * user what data exists, so the page's own date filter must not narrow it.
 */
export function fetchDoDateRange(): Promise<CachedResult<ErpDateRangeRow[]>> {
  return getCached<ErpDateRangeRow[]>("sales:do-date-range", ERP_CACHE_TTL_MS, () =>
    runSalesQuery<ErpDateRangeRow>(DO_DATE_RANGE_SQL, {}),
  );
}

/** Normalise a SQL Server DATE column to a CE `yyyy-mm-dd` string (UTC-safe, no TZ drift). */
export function isoDate(value: Date | string | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
