// erp-dashboards Phase 2 — the Sales dashboard's URL state machine.
//
// DRILLDOWN ROUTING DECISION (plan, Option A): ONE page at `/dashboards/sales`; the URL search
// params ARE the state. This mirrors the existing `?location=` precedent (`shop-location-filter`)
// rather than inventing a nested route tree for a read-only report page.
//
// TWO SECTIONS (sales-invoice-basis, 23-09-26). The page now carries an INVOICE section (primary —
// the money) and a DELIVERY section (secondary — the goods), so `view` names the section as well
// as the depth:
//
//   summary             — both sections' breakdown tables + charts render together
//   invoice-documents   — the invoice list
//   invoice-lines       — one invoice's line items (`invoiceNo=...`)
//   delivery-documents  — the delivery-order list
//   delivery-lines      — one delivery order's line items (`doNo=...`)
//
// The two document-list views are MUTUALLY EXCLUSIVE by construction: `view` is a single string,
// so only one list table is ever the page's active table. That invariant is what lets
// `deriveExportTarget()` resolve an export from ambient URL state alone — see `resolveSalesSection`
// below. A future third section must preserve it.
//
// BACKWARD COMPATIBILITY. `?view=documents` and `?view=lines` are the pre-plan spellings and are
// kept as EXPLICIT ALIASES of the delivery views — a bare legacy `?view=documents` has always
// meant "show me the delivery orders", and a stale bookmark must not silently land somewhere else.
// A genuinely unrecognised value (`?view=bogus`) falls back to `summary`. Drilldown params win over
// `view` in every case: `invoiceNo` first, then `doNo`.

import {
  DEFAULT_SALES_PERIOD,
  defaultDateRange,
  resolveDateParam,
  resolveSalesPeriod,
  type SalesPeriod,
} from "@/lib/sales-basis-core";

export const SALES_BASE_PATH = "/dashboards/sales";

/** Next 16 hands `searchParams` to a page as a Promise of this shape. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export type SalesView =
  | "summary"
  | "invoice-documents"
  | "invoice-lines"
  | "delivery-documents"
  | "delivery-lines";

/** Which of the page's two sections a view belongs to. `summary` renders both. */
export type SalesSection = "invoice" | "delivery";

export interface SalesUrlState {
  from: string;
  to: string;
  period: SalesPeriod;
  view: SalesView;
  customer: string | null;
  product: string | null;
  status: string | null;
  cat: string | null;
  doNo: string | null;
  /** The invoice section's drilldown, mirroring `doNo` exactly. */
  invoiceNo: string | null;
  sort: string | null;
  page: number;
  /** 1-based page of the ยอดตามสินค้า breakdown table (independent of `page`). */
  productPage: number;
  /** 1-based page of the ยอดตามลูกค้า breakdown table (independent of `page`). */
  customerPage: number;
  /** 1-based page of the INVOICE section's ยอดตามสินค้า table. */
  invoiceProductPage: number;
  /** 1-based page of the INVOICE section's ยอดตามลูกค้า table. */
  invoiceCustomerPage: number;
  /** Everything as given, for href preservation. */
  raw: RawSearchParams;
}

function one(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v == null || v === "" ? null : v;
}

// sales-breakdown-pagination (23-09-26) — the two summary breakdown tables page INDEPENDENTLY, so
// each owns its own query key. `page` stays the DO-list/DO-lines key it always was, untouched.
export const PRODUCT_PAGE_PARAM = "productPage";
export const CUSTOMER_PAGE_PARAM = "customerPage";

// sales-invoice-basis (23-09-26) — the INVOICE section's own breakdown page keys.
//
// The two sections' breakdown tables render SIMULTANEOUSLY on the summary view, so they genuinely
// cannot share a page key: turning one page would move the other. The delivery section keeps the
// original `productPage`/`customerPage` spellings rather than being renamed to
// `deliveryProductPage`/`deliveryCustomerPage` — renaming would break every existing bookmark and
// the shipped e2e pagination gate to say exactly the same thing.
//
// `page` and `sort` are NOT split: they belong to the document LIST views, and those two views are
// mutually exclusive (one `view` string), so they can never be live at the same moment.
export const INVOICE_PRODUCT_PAGE_PARAM = "invoiceProductPage";
export const INVOICE_CUSTOMER_PAGE_PARAM = "invoiceCustomerPage";

/** Every page key this dashboard understands — cleared as a set when the view changes. */
export const SALES_PAGE_PARAMS = [
  "page",
  PRODUCT_PAGE_PARAM,
  CUSTOMER_PAGE_PARAM,
  INVOICE_PRODUCT_PAGE_PARAM,
  INVOICE_CUSTOMER_PAGE_PARAM,
] as const;

/**
 * Read a 1-based page number out of a search-param bag. Anything absent, non-numeric, zero,
 * negative, or fractional collapses to page 1 — a bad URL must never blank a table.
 */
export function pageFromParam(raw: RawSearchParams, key: string): number {
  const n = Number(one(raw[key]) ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** `{ page: null, productPage: null, customerPage: null }` — for `salesHref` overrides. */
export function clearPageParams(): Record<string, null> {
  return Object.fromEntries(SALES_PAGE_PARAMS.map((k) => [k, null]));
}

/**
 * Resolve the `view` a raw search-param bag means — THE one place the section/depth precedence
 * rules live.
 *
 * `deriveExportTarget()` in `src/lib/erp/dashboard-export-target.ts` calls this rather than
 * re-deriving the same precedence a second time: with neither `invoiceNo` nor `doNo` present, the
 * ONLY signal telling the invoice list apart from the delivery list is `view` itself, and two
 * copies of that rule would drift with no test binding them together. One source of truth, the
 * same discipline `SALES_SQL_SOURCES` applies to SQL text.
 */
export function resolveSalesView(raw: RawSearchParams): SalesView {
  // Drilldown params beat the `view` value, and the invoice (primary) section beats delivery.
  if (one(raw.invoiceNo) != null) return "invoice-lines";
  if (one(raw.doNo) != null) return "delivery-lines";

  switch (one(raw.view)) {
    case "invoice-documents":
      return "invoice-documents";
    case "invoice-lines":
      return "invoice-lines";
    case "delivery-documents":
      return "delivery-documents";
    case "delivery-lines":
      return "delivery-lines";
    // Pre-plan spellings, kept as explicit delivery aliases so stale links stay meaningful.
    case "documents":
      return "delivery-documents";
    case "lines":
      return "delivery-lines";
    default:
      // Unrecognised (or absent) — including a bare `customer`/`product` filter, which used to
      // force the documents view. It no longer does: on `summary` BOTH sections render, and both
      // honour those filters, so there is nothing left to force.
      return "summary";
  }
}

/** Which section a view belongs to. `summary` reports `invoice` — the primary section. */
export function sectionOfView(view: SalesView): SalesSection {
  return view === "delivery-documents" || view === "delivery-lines" ? "delivery" : "invoice";
}

/** The section a raw param bag resolves to. Convenience wrapper over the two functions above. */
export function resolveSalesSection(raw: RawSearchParams): SalesSection {
  return sectionOfView(resolveSalesView(raw));
}

export function parseSalesUrl(raw: RawSearchParams, today: Date = new Date()): SalesUrlState {
  const fallback = defaultDateRange(today);

  return {
    from: resolveDateParam(raw.from, fallback.from),
    to: resolveDateParam(raw.to, fallback.to),
    period: resolveSalesPeriod(raw.period),
    view: resolveSalesView(raw),
    customer: one(raw.customer),
    product: one(raw.product),
    status: one(raw.status),
    cat: one(raw.cat),
    doNo: one(raw.doNo),
    invoiceNo: one(raw.invoiceNo),
    sort: one(raw.sort),
    page: pageFromParam(raw, "page"),
    productPage: pageFromParam(raw, PRODUCT_PAGE_PARAM),
    customerPage: pageFromParam(raw, CUSTOMER_PAGE_PARAM),
    invoiceProductPage: pageFromParam(raw, INVOICE_PRODUCT_PAGE_PARAM),
    invoiceCustomerPage: pageFromParam(raw, INVOICE_CUSTOMER_PAGE_PARAM),
    raw,
  };
}

/**
 * Build a `/dashboards/sales` href preserving every current param, overriding only the given keys.
 * A `null` override REMOVES the key (how filter chips clear themselves).
 */
export function salesHref(
  raw: RawSearchParams,
  overrides: Record<string, string | number | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, String(value));
  }
  // `period` only ever needs to appear when it is not the default — keeps hrefs readable.
  if (params.get("period") === DEFAULT_SALES_PERIOD) params.delete("period");
  const qs = params.toString();
  return qs.length > 0 ? `${SALES_BASE_PATH}?${qs}` : SALES_BASE_PATH;
}

export const SALES_PAGE_SIZE = 10;

/**
 * Sort rows for the shared data table. `sort` is a column key, optionally prefixed `-` for
 * descending — the exact contract `DashboardDataTable` emits in its header links.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: string | null,
  accessors: Record<string, (row: T) => string | number>,
  fallback: { key: string; desc: boolean },
): T[] {
  const desc = sort?.startsWith("-") ?? fallback.desc;
  const key = (sort?.replace(/^-/, "") ?? fallback.key) as string;
  const accessor = accessors[key] ?? accessors[fallback.key];
  if (!accessor) return [...rows];
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv), "th");
    return desc ? -cmp : cmp;
  });
}

/** Clamp a 1-based page to the data and return that page's slice. */
export function paginate<T>(rows: readonly T[], page: number, pageSize = SALES_PAGE_SIZE): T[] {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return rows.slice((safePage - 1) * pageSize, safePage * pageSize);
}
