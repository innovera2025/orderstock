// erp-dashboards Phase 4 — the Production dashboard's URL state machine.
//
// The URL search params ARE the state (AC10): reloading a filtered/sorted/paged URL reproduces
// exactly the same view. Same `?param=` precedent as `shop-location-filter` and Phase 2's Sales
// dashboard — no client-side filter state anywhere.
//
// The MO drilldown is a NESTED ROUTE (`/dashboards/production/[moNumber]`), the INNOVATE decision
// recorded in the plan: a bookmarkable URL, consistent with the existing `/orders/[id]` precedent.

export const PRODUCTION_BASE_PATH = "/dashboards/production";

/** Next 16 hands `searchParams` to a page as a Promise of this shape. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ProductionUrlState {
  /** CE `yyyy-mm-dd`, inclusive. */
  from: string;
  to: string;
  status: string | null;
  sort: string | null;
  page: number;
  /** Everything as given, for href preservation. */
  raw: RawSearchParams;
}

export const PRODUCTION_PAGE_SIZE = 10;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function one(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v == null || v === "" ? null : v;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Default window: the last 90 days ending today. Production volume is tiny (3 MOs in the pilot
 * data, all on one day), so a narrow default would routinely show an empty page.
 */
export function defaultProductionRange(today: Date = new Date()): { from: string; to: string } {
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 89);
  return { from: iso(from), to: iso(to) };
}

/** Accept only a well-formed `yyyy-mm-dd`; anything else falls back rather than throwing. */
export function resolveDateParam(raw: string | string[] | undefined, fallback: string): string {
  const value = one(raw);
  return value != null && ISO_DATE.test(value) ? value : fallback;
}

export function parseProductionUrl(
  raw: RawSearchParams,
  today: Date = new Date(),
): ProductionUrlState {
  const fallback = defaultProductionRange(today);
  const pageNumber = Number(one(raw.page) ?? "1");
  return {
    from: resolveDateParam(raw.from, fallback.from),
    to: resolveDateParam(raw.to, fallback.to),
    status: one(raw.status),
    sort: one(raw.sort),
    page: Number.isFinite(pageNumber) && pageNumber >= 1 ? Math.floor(pageNumber) : 1,
    raw,
  };
}

/**
 * Build a `/dashboards/production` href preserving every current param, overriding only the given
 * keys. A `null` override REMOVES the key (how a filter chip clears itself).
 */
export function productionHref(
  raw: RawSearchParams,
  overrides: Record<string, string | number | null> = {},
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
  const qs = params.toString();
  return qs.length > 0 ? `${PRODUCTION_BASE_PATH}?${qs}` : PRODUCTION_BASE_PATH;
}

/** Drilldown href for one MO, preserving the current filters so "back" returns to the same view. */
export function moDetailHref(moNumber: string, raw: RawSearchParams): string {
  const params = new URLSearchParams();
  for (const key of ["from", "to", "status"] as const) {
    const value = raw[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) params.set(key, single);
  }
  const qs = params.toString();
  const base = `${PRODUCTION_BASE_PATH}/${encodeURIComponent(moNumber)}`;
  return qs.length > 0 ? `${base}?${qs}` : base;
}

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
export function paginate<T>(
  rows: readonly T[],
  page: number,
  pageSize = PRODUCTION_PAGE_SIZE,
): T[] {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return rows.slice((safePage - 1) * pageSize, safePage * pageSize);
}
