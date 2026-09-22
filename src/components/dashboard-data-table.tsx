import * as React from "react";
import Link from "next/link";
import { Card } from "./ui/card";

// THE shared dashboard data table (erp-dashboards Phase 1).
//
// Server-rendered, URL-driven sort + pagination, with a mobile card list below the `md`
// breakpoint — the same `md:hidden` / `hidden md:block` pairing `admin/users/users-mobile.tsx`
// established. Deliberately data-shape AGNOSTIC: it knows nothing about Sales, Purchase, or
// Production. Phases 2/3/4 IMPORT this component and pass their own `columns`/`rows`; its prop
// contract is binding for them once this phase closes.
//
// URL contract (the part every consumer depends on): toggling a sort or turning a page REWRITES
// ONLY the `sort`/`page` keys and PRESERVES every other search param, so active filters survive.

export interface DataTableColumn {
  /** Stable key used to look the cell up in each row, and as the `?sort=` value. */
  key: string;
  label: string;
  sortable?: boolean;
  /** Right-align numeric columns. */
  align?: "left" | "right";
}

export type DataTableRow = Record<string, React.ReactNode>;

export interface DashboardDataTableProps {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  /** Base path the sort/page links point at, e.g. `/dashboards/sales`. */
  basePath: string;
  /** All current search params (the page's own `searchParams`), preserved across links. */
  searchParams?: Record<string, string | string[] | undefined>;
  /** Name of the sort query key. Default `sort`. */
  sortParam?: string;
  /** Name of the page query key. Default `page`. */
  pageParam?: string;
  /** Current sort value, e.g. `total` or `-total` (leading `-` = descending). */
  currentSort?: string;
  /** 1-based current page. */
  currentPage?: number;
  pageSize: number;
  totalRows: number;
  /** Key whose value titles each mobile card. Defaults to the first column's key. */
  mobileTitleKey?: string;
  /** Shown when `rows` is empty. */
  emptyText?: string;
}

/**
 * Build an href preserving every existing search param, overriding only the given keys.
 * A `null` override removes the key.
 */
function buildHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs.length > 0 ? `${basePath}?${qs}` : basePath;
}

/** Toggle asc -> desc -> asc for a column, given the current sort value. */
function nextSortValue(columnKey: string, currentSort: string | undefined): string {
  return currentSort === columnKey ? `-${columnKey}` : columnKey;
}

/** Arrow suffix reflecting the active sort direction on this column. */
function sortIndicator(columnKey: string, currentSort: string | undefined): string {
  if (currentSort === columnKey) return " ↑";
  if (currentSort === `-${columnKey}`) return " ↓";
  return "";
}

export function DashboardDataTable({
  columns,
  rows,
  basePath,
  searchParams = {},
  sortParam = "sort",
  pageParam = "page",
  currentSort,
  currentPage = 1,
  pageSize,
  totalRows,
  mobileTitleKey,
  emptyText = "ไม่มีข้อมูล",
}: DashboardDataTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize)));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const titleKey = mobileTitleKey ?? columns[0]?.key;

  // Turning a page resets nothing else; sorting returns to page 1 so the user sees the new top.
  const prevHref = buildHref(basePath, searchParams, {
    [pageParam]: String(page - 1),
  });
  const nextHref = buildHref(basePath, searchParams, {
    [pageParam]: String(page + 1),
  });

  if (rows.length === 0) {
    return (
      <Card className="p-6 text-center text-[var(--t-sm)] text-[var(--text-muted)]">
        <span className="th">{emptyText}</span>
      </Card>
    );
  }

  return (
    <div data-testid="dashboard-data-table">
      {/* ---------- Desktop: real table (md and up) ---------- */}
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-[var(--t-sm)]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={
                    "px-3 py-2 font-medium text-[var(--text-muted)] " +
                    (col.align === "right" ? "text-right" : "text-left")
                  }
                >
                  {col.sortable ? (
                    <Link
                      href={buildHref(basePath, searchParams, {
                        [sortParam]: nextSortValue(col.key, currentSort),
                        [pageParam]: "1",
                      })}
                      data-testid={`sort-${col.key}`}
                      className="th hover:text-[var(--text)]"
                    >
                      {col.label}
                      {sortIndicator(col.key, currentSort)}
                    </Link>
                  ) : (
                    <span className="th">{col.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={String(row[titleKey ?? ""] ?? i)}
                className="border-b border-[var(--border)] last:border-b-0"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={
                      "px-3 py-2 text-[var(--text)] " +
                      (col.align === "right" ? "text-right tabular-nums" : "text-left")
                    }
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ---------- Mobile: card list (below md) ---------- */}
      <div className="flex flex-col gap-2 md:hidden" data-testid="dashboard-data-cards">
        {rows.map((row, i) => (
          <Card key={String(row[titleKey ?? ""] ?? i)} className="flex flex-col gap-1.5 p-3">
            {titleKey && (
              <span className="th text-[13.5px] font-semibold text-[var(--text)]">
                {row[titleKey]}
              </span>
            )}
            {columns
              .filter((col) => col.key !== titleKey)
              .map((col) => (
                <div key={col.key} className="flex items-baseline justify-between gap-3">
                  <span className="th text-[11px] text-[var(--text-faint)]">{col.label}</span>
                  <span className="text-[12.5px] tabular-nums text-[var(--text)]">
                    {row[col.key]}
                  </span>
                </div>
              ))}
          </Card>
        ))}
      </div>

      {/* ---------- Pagination (shared) ---------- */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[var(--t-xs)] text-[var(--text-muted)]">
        <span className="th" data-testid="data-table-page-label">
          หน้า {page} จาก {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={prevHref}
              data-testid="data-table-prev"
              className="th rounded-[var(--r-md)] border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--bg-sunken)]"
            >
              ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={nextHref}
              data-testid="data-table-next"
              className="th rounded-[var(--r-md)] border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--bg-sunken)]"
            >
              ถัดไป
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
