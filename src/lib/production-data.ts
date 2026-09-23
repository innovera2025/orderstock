// erp-dashboards Phase 4 — the Production dashboard's ERP read layer.
//
// EVERY read here goes through Phase 1's `guardedQuery()` choke point. There is no other path:
// no Prisma, no `$queryRaw`, no ERP model in `prisma/schema.prisma`, no direct pool request.
// The SQL text comes from the versioned files in `db/erp-queries/production/` (embedded via
// `production-sql.ts`, which a unit gate keeps byte-identical to those files).
//
// PARAMETERIZATION: every filter is a NAMED parameter bound by `guardedQuery` via
// `request.input(...)`. No filter value is ever concatenated into SQL text.
//
// PLAN-ONLY (SPEC AC7): nothing in this module returns, derives, or exposes an "actual produced"
// quantity or an achievement percentage. `Prodqty` is read ONLY as the documented fallback for a
// NULL `LotQty` (still the PLAN) and is never re-labelled.
//
// Imports are RELATIVE (not `@/`) so this module stays loadable by vitest for the Hybrid gates.

import { guardedQuery, type ErpQueryParams } from "./erp/erp-adapter";
import { getErpPool } from "./erp/pool";
import { getCached, ERP_CACHE_TTL_MS, type CachedResult } from "./erp/cache";
import type { ErpDateRangeRow } from "./erp-date-range";
import { MATERIAL_ISSUES_SQL, MO_DATE_RANGE_SQL, MO_LIST_SQL } from "./production-sql";

export interface ProductionFilters {
  /** CE `yyyy-mm-dd`, inclusive. */
  dateFrom: string;
  dateTo: string;
  status?: string | null;
}

export interface ProductionQueryOptions {
  /** `true` = ignore `status` (the status donut must keep showing every status). */
  skipStatus?: boolean;
}

/** One planned manufacturing order, exactly as `mo-list.sql` returns it. */
export interface MoListRow {
  TransactionNo: number;
  MoNumBer: string;
  Modate: Date | null;
  FgCode: string | null;
  FgName: string;
  MainUnits: string;
  /** The PLANNED quantity (LotQty, or Prodqty when LotQty is NULL). Never an actual. */
  PlannedQty: number;
  /** 1 when `PlannedQty` came from the `Prodqty` fallback. */
  PlannedQtyFromProdqty: number;
  StatusKey: string;
  IssueLineCount: number;
}

/** One raw-material issue line linked to an MO by string-matched `MONo`. */
export interface MaterialIssueRow {
  ItemCode: string;
  ItemName: string;
  Qty: number;
  MainUnits: string;
  TransactionDate: Date | null;
  MONo: string | null;
}

function toParams(
  filters: ProductionFilters,
  options: ProductionQueryOptions = {},
): ErpQueryParams {
  const status = filters.status == null || filters.status === "" ? null : filters.status;
  return {
    from: filters.dateFrom,
    to: filters.dateTo,
    status,
    skipStatus: options.skipStatus === true,
  };
}

/** Stable cache key — the query name plus every bound parameter value. */
function cacheKey(name: string, params: ErpQueryParams): string {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k] ?? "")}`);
  return `production:${name}:${parts.join("&")}`;
}

/**
 * Run one Production query through the guard. Exported so the fixture gates can exercise the REAL
 * SQL against `erp_fixture` rather than re-deriving the logic in memory.
 */
export async function runProductionQuery<T>(sql: string, params: ErpQueryParams): Promise<T[]> {
  const pool = await getErpPool();
  return guardedQuery<T>(pool, sql, params);
}

/**
 * The planned MO list. Returns plain objects (no React/Next types) so Phase 5's CSV export route
 * can import this function unchanged.
 */
export function getProductionMoList(
  filters: ProductionFilters,
  options: ProductionQueryOptions = {},
): Promise<CachedResult<MoListRow[]>> {
  const params = toParams(filters, options);
  return getCached<MoListRow[]>(cacheKey("mo-list", params), ERP_CACHE_TTL_MS, () =>
    runProductionQuery<MoListRow>(MO_LIST_SQL, params),
  );
}

/**
 * Raw-material issues for ONE MO. The `MONo` linkage is a whitespace-tolerant STRING match with no
 * FK — zero matches is the normal case and returns an empty array, never an error.
 */
export function getMaterialIssuesForMo(
  moNumBer: string,
): Promise<CachedResult<MaterialIssueRow[]>> {
  const params: ErpQueryParams = { moNumBer };
  return getCached<MaterialIssueRow[]>(cacheKey("material-issues", params), ERP_CACHE_TTL_MS, () =>
    runProductionQuery<MaterialIssueRow>(MATERIAL_ISSUES_SQL, params),
  );
}

/**
 * The ช่วงข้อมูล read: the FULL manufacturing-order plan-date span and MO count the ERP holds.
 *
 * Deliberately UNFILTERED — the notice states what data exists, so the page's own date and status
 * filters must not narrow it.
 */
export function getProductionDateRange(): Promise<CachedResult<ErpDateRangeRow[]>> {
  return getCached<ErpDateRangeRow[]>(cacheKey("mo-date-range", {}), ERP_CACHE_TTL_MS, () =>
    runProductionQuery<ErpDateRangeRow>(MO_DATE_RANGE_SQL, {}),
  );
}

/** Normalise a SQL Server DATE column to a CE `yyyy-mm-dd` string (UTC-safe, no TZ drift). */
export function isoDate(value: Date | string | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
