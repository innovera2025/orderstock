// erp-dashboards Phase 2 — the Sales dashboard's URL state machine.
//
// DRILLDOWN ROUTING DECISION (plan, Option A): ONE page at `/dashboards/sales`; the URL search
// params ARE the state. Three views render from the same `page.tsx`:
//
//   summary   — no `view`/`customer`/`product`/`doNo`  → breakdown tables + charts
//   documents — `view=documents`, or a customer/product filter is active → DO list
//   lines     — `doNo=...` → that delivery order's line items
//
// This mirrors the existing `?location=` precedent (`shop-location-filter`) rather than inventing a
// nested route tree for a read-only report page.

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

export type SalesView = "summary" | "documents" | "lines";

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
  sort: string | null;
  page: number;
  /** Everything as given, for href preservation. */
  raw: RawSearchParams;
}

function one(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v == null || v === "" ? null : v;
}

export function parseSalesUrl(raw: RawSearchParams, today: Date = new Date()): SalesUrlState {
  const fallback = defaultDateRange(today);
  const from = resolveDateParam(raw.from, fallback.from);
  const to = resolveDateParam(raw.to, fallback.to);
  const customer = one(raw.customer);
  const product = one(raw.product);
  const doNo = one(raw.doNo);
  const rawView = one(raw.view);

  // A customer/product filter implies the documents view even without an explicit `view` param,
  // so clicking a breakdown row is a single href with no redundant state.
  const view: SalesView =
    doNo != null ? "lines" : rawView === "documents" || customer || product ? "documents" : "summary";

  const pageNumber = Number(one(raw.page) ?? "1");

  return {
    from,
    to,
    period: resolveSalesPeriod(raw.period),
    view,
    customer,
    product,
    status: one(raw.status),
    cat: one(raw.cat),
    doNo,
    sort: one(raw.sort),
    page: Number.isFinite(pageNumber) && pageNumber >= 1 ? Math.floor(pageNumber) : 1,
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
