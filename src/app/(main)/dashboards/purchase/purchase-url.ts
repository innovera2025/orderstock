// erp-dashboards Phase 3 — the Purchase dashboard's URL state machine.
//
// The URL search params ARE the state: `?from=&to=&period=&supplier=&status=&sort=&page=`. Every
// filter, every chart click, every sort and every page turn round-trips through the URL, so a
// reload reproduces exactly what the user was looking at and a link can be shared (AC10/AC12).
//
// DRILLDOWN uses a real nested route — `/dashboards/purchase/[poNo]` — rather than a `?drill=`
// param, matching this phase's plan. Every current search param is preserved across the hop in
// both directions, so going back to the list restores the filters that led there.

import {
  DEFAULT_PURCHASE_PERIOD,
  defaultPurchaseDateRange,
  resolveDateParam,
  resolvePoStatusParam,
  resolvePurchasePeriod,
  type PoStatus,
  type PurchasePeriod,
} from "@/lib/purchase-calc";

export const PURCHASE_BASE_PATH = "/dashboards/purchase";

/** Next 16 hands `searchParams` to a page as a Promise of this shape. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface PurchaseUrlState {
  from: string;
  to: string;
  period: PurchasePeriod;
  supplier: string | null;
  status: PoStatus | null;
  sort: string | null;
  page: number;
  /** Everything as given, for href preservation. */
  raw: RawSearchParams;
}

function one(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v == null || v === "" ? null : v;
}

export function parsePurchaseUrl(raw: RawSearchParams, today: Date = new Date()): PurchaseUrlState {
  const fallback = defaultPurchaseDateRange(today);
  const pageNumber = Number(one(raw.page) ?? "1");

  return {
    from: resolveDateParam(raw.from, fallback.from),
    to: resolveDateParam(raw.to, fallback.to),
    period: resolvePurchasePeriod(raw.period),
    supplier: one(raw.supplier),
    status: resolvePoStatusParam(raw.status),
    sort: one(raw.sort),
    page: Number.isFinite(pageNumber) && pageNumber >= 1 ? Math.floor(pageNumber) : 1,
    raw,
  };
}

/**
 * Build a `/dashboards/purchase` href preserving every current param, overriding only the given
 * keys. A `null` override REMOVES the key (how filter chips clear themselves).
 */
export function purchaseHref(
  raw: RawSearchParams,
  overrides: Record<string, string | number | null> = {},
  basePath: string = PURCHASE_BASE_PATH,
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
  // `period` only needs to appear when it is not the default — keeps hrefs readable.
  if (params.get("period") === DEFAULT_PURCHASE_PERIOD) params.delete("period");
  const qs = params.toString();
  return qs.length > 0 ? `${basePath}?${qs}` : basePath;
}

/** Href for one PO's detail page, carrying the current filters along. */
export function poDetailHref(raw: RawSearchParams, poNumber: string): string {
  return purchaseHref(
    raw,
    { page: null, sort: null },
    `${PURCHASE_BASE_PATH}/${encodeURIComponent(poNumber)}`,
  );
}

export const PURCHASE_PAGE_SIZE = 10;

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
  const key = sort?.replace(/^-/, "") ?? fallback.key;
  const accessor = accessors[key] ?? accessors[fallback.key];
  if (!accessor) return [...rows];
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "th");
    return desc ? -cmp : cmp;
  });
}

/** Clamp a 1-based page to the data and return that page's slice. */
export function paginate<T>(rows: readonly T[], page: number, pageSize = PURCHASE_PAGE_SIZE): T[] {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return rows.slice((safePage - 1) * pageSize, safePage * pageSize);
}
