// ช่วงข้อมูล — the shared shape behind every dashboard's "what the ERP actually holds" notice.
//
// One row type and one pure converter, used by all three domains (`sales-queries.ts`,
// `purchase-data.ts`, `production-data.ts`) so the three `*-date-range.sql` reads can never drift
// into three slightly different shapes.
//
// Pure: no DB, no React, no Next — safe to unit-test directly and safe to import from a server
// component.

/** One row as any `db/erp-queries` `*-date-range.sql` file returns it. */
export interface ErpDateRangeRow {
  DocCount: number;
  /** `NULL` when the table is empty (MIN/MAX over no rows). */
  FirstDate: Date | string | null;
  LastDate: Date | string | null;
}

/** What the banner renders: CE ISO dates plus a document count, all optional and never invented. */
export interface ErpDataRange {
  /** Thai document noun for the count, e.g. `"ใบส่งสินค้า"`. */
  docLabel: string;
  /** CE `yyyy-mm-dd`, or `null` when the ERP holds no dated document. */
  from: string | null;
  to: string | null;
  count: number;
}

/** Normalise a SQL Server DATE column to a CE `yyyy-mm-dd` string (UTC-safe, no TZ drift). */
function isoDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const iso = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return iso === "" ? null : iso;
}

/**
 * Turn the single row a `*-date-range.sql` read returns into the banner's props.
 *
 * A missing row, a NULL date or a non-finite count all collapse to "not known" — the notice then
 * omits the range instead of inventing one. That honesty is the whole point of the change.
 */
export function toErpDataRange(
  rows: readonly ErpDateRangeRow[] | null | undefined,
  docLabel: string,
): ErpDataRange {
  const row = rows?.[0];
  const rawCount = Number(row?.DocCount ?? 0);
  return {
    docLabel,
    from: isoDate(row?.FirstDate),
    to: isoDate(row?.LastDate),
    count: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0,
  };
}
