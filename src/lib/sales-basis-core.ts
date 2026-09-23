// erp-dashboards Phase 2 — PURE Sales-dashboard transforms. ZERO DB access, zero ERP access,
// zero Prisma import — every function here is a plain input→output transform over in-memory data.
//
// This is the `locations-core.ts` half of the `locations.ts` / `locations-core.ts` split the plan
// explicitly asks Phase 2 to mirror (PVL fix P5): the DB-touching wrappers live in
// `sales-basis.ts` (Prisma) and `sales-queries.ts` (ERP), and everything that can be proven
// without a database lives here, unit-tested with zero preconditions.
//
// Imports are RELATIVE, not `@/` — vitest does not resolve the TS path alias (see
// `process/context/tests/all-tests.md` § Component testing WITHOUT jsdom).

import { ceToBeParts, parseDateInputValue } from "./be-date";

// ---------------------------------------------------------------------------------------------
// Sales basis — which ERP table set backs "sales" for this dashboard.
// ---------------------------------------------------------------------------------------------

/**
 * The implemented sales bases.
 *
 * `"do"` = delivery orders (`tbl_DOhdr` / `tbl_Dodtl`) — the ONLY branch implemented in this
 * phase, and the only basis with real, arithmetically-reconciled volume in the live ERP today.
 *
 * EXTENSION POINT (deliberately NOT implemented here — SPEC "Out Of Scope": migrating the Sales
 * dashboard's underlying basis): a later, out-of-program change may add `"so"` (sales orders) or
 * `"invoice"` (`SalesInvoiceHdr`). The switch mechanism below already reads its value from an
 * `AppSetting` row, so that migration needs a settings change rather than a redeploy — but the
 * resolver intentionally still narrows every value to `"do"` until that branch actually exists.
 * Returning a basis the query layer cannot serve would be worse than ignoring the setting.
 */
export type SalesBasis = "do";

/** The `AppSetting` key holding the sales basis. Sales-scoped; independent of `APP_SETTING_KEYS`. */
export const SALES_BASIS_SETTING_KEY = "salesBasis";

/**
 * Decide the sales basis from a raw stored setting value. PURE — this is the half that is
 * unit-tested; the thin Prisma read that feeds it is deliberately untested with a live
 * connection, matching `app-settings.ts`'s established convention (execute-agent instruction E6).
 *
 * Unset / unknown / not-yet-implemented values all fall back to `"do"` rather than throwing: a
 * typo in a settings row must never take the dashboard down.
 */
export function resolveSalesBasisFromValue(raw: string | null | undefined): SalesBasis {
  const value = (raw ?? "").trim().toLowerCase();
  // `"so"` / `"invoice"` are recognised names with no implemented query branch yet — they
  // deliberately resolve to `"do"` until that branch lands.
  if (value === "do") return "do";
  return "do";
}

// ---------------------------------------------------------------------------------------------
// Quantities — NEVER summed across units.
// ---------------------------------------------------------------------------------------------

/** The minimum shape `sumQuantityByUnit` needs from a DO line. */
export interface QuantityLine {
  unit: string;
  qty: number;
}

/**
 * Total quantities PER UNIT.
 *
 * HARD SAFETY CONSTRAINT (umbrella Program Goal Charter): quantities must NEVER be summed across
 * different `MainUnits` values — the live ERP has 13+ distinct units on delivery lines, so a
 * single combined number would be arithmetic nonsense presented as a fact. This function is the
 * ONLY sanctioned quantity aggregation on the Sales dashboard, and it structurally cannot produce
 * a cross-unit total: its return type is a per-unit map, not a number.
 *
 * Insertion order is preserved, so callers get units in first-seen order.
 */
export function sumQuantityByUnit(lines: readonly QuantityLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const unit = (line.unit ?? "").trim() === "" ? "-" : line.unit.trim();
    const qty = Number.isFinite(line.qty) ? line.qty : 0;
    totals.set(unit, (totals.get(unit) ?? 0) + qty);
  }
  return totals;
}

/** `sumQuantityByUnit` as a display-ordered array (largest quantity first, unit name as tiebreak). */
export function quantityByUnitList(
  lines: readonly QuantityLine[],
): Array<{ unit: string; qty: number }> {
  return [...sumQuantityByUnit(lines).entries()]
    .map(([unit, qty]) => ({ unit, qty }))
    .sort((a, b) => b.qty - a.qty || a.unit.localeCompare(b.unit, "th"));
}

// ---------------------------------------------------------------------------------------------
// Money coverage.
// ---------------------------------------------------------------------------------------------

/**
 * Percentage of lines that actually carry a price, 0–100.
 *
 * Most live delivery lines are unpriced, so the money figure covers a small slice of reality. The
 * dashboard must always show this number next to the money figure — never the money alone.
 */
export function coveragePercent(pricedLineCount: number, totalLineCount: number): number {
  if (totalLineCount <= 0) return 0;
  return (pricedLineCount / totalLineCount) * 100;
}

// ---------------------------------------------------------------------------------------------
// Period granularity (สัปดาห์ / เดือน / ปี) — ONE shared bin builder for BOTH sales charts.
// ---------------------------------------------------------------------------------------------

export type SalesPeriod = "week" | "month" | "year";

/** เดือน is the default: the ERP's own sales reporting is monthly. */
export const DEFAULT_SALES_PERIOD: SalesPeriod = "month";

export const SALES_PERIODS: ReadonlyArray<{ key: SalesPeriod; label: string; column: string }> = [
  { key: "week", label: "สัปดาห์", column: "สัปดาห์" },
  { key: "month", label: "เดือน", column: "เดือน" },
  { key: "year", label: "ปี", column: "ปี" },
];

/** Narrow an arbitrary `?period=` value; anything unrecognised falls back to the default. */
export function resolveSalesPeriod(raw: string | string[] | undefined): SalesPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "week" || value === "month" || value === "year") return value;
  return DEFAULT_SALES_PERIOD;
}

export interface TimeBin {
  key: string;
  /** Inclusive CE `yyyy-mm-dd` bounds, clipped to the selected range. */
  from: string;
  to: string;
  /** Short axis tick label (BE). */
  label: string;
  /** Full label for table cells and tooltips (BE). */
  full: string;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function addDays(iso: string, days: number): string {
  const d = parseDateInputValue(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** BE year for a CE `yyyy-mm-dd` (via the shared `be-date` Intl helper, not a hand-rolled +543). */
export function beYearOf(iso: string): number {
  return ceToBeParts(parseDateInputValue(iso)).yearBE;
}

/** Thai short BE date, e.g. `3/8/69`. */
export function beShort(iso: string): string {
  const { day, month, yearBE2 } = ceToBeParts(parseDateInputValue(iso));
  return `${day}/${month}/${yearBE2}`;
}

/** Thai BE month label, e.g. `ส.ค. 2569`. */
export function beMonthLabel(iso: string): string {
  const d = parseDateInputValue(iso);
  return `${THAI_MONTHS_SHORT[d.getMonth()]} ${beYearOf(iso)}`;
}

/**
 * Tile `[from, to]` into bins at the requested granularity.
 *
 * Weeks are aligned to the START OF THE SELECTED RANGE, not to Monday — hence the UI's
 * "สัปดาห์ที่เริ่มวันที่" axis caption. Every bin is clipped to the range so the first and last
 * bins never claim days outside the user's selection.
 *
 * BOTH sales charts (document count, and the Admin-only money chart) read the SAME bins from this
 * one function, so their bars can never be cut on different period boundaries.
 */
export function timeBins(from: string, to: string, kind: SalesPeriod): TimeBin[] {
  if (!from || !to || from > to) return [];
  const clip = (a: string, b: string) => ({ from: a < from ? from : a, to: b > to ? to : b });

  if (kind === "year") {
    const out: TimeBin[] = [];
    const firstYear = Number(from.slice(0, 4));
    const lastYear = Number(to.slice(0, 4));
    for (let y = firstYear; y <= lastYear; y++) {
      const bounds = clip(`${y}-01-01`, `${y}-12-31`);
      const be = beYearOf(bounds.from);
      out.push({ key: String(y), ...bounds, label: String(be), full: `ปี พ.ศ. ${be}` });
    }
    return out;
  }

  if (kind === "month") {
    const out: TimeBin[] = [];
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    const endKey = to.slice(0, 7);
    // Guard bounds the loop even if inputs are pathological; 600 months = 50 years.
    for (let guard = 0; guard < 600; guard++) {
      const key = `${y}-${pad2(m)}`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const bounds = clip(`${key}-01`, `${key}-${pad2(lastDay)}`);
      const label = beMonthLabel(bounds.from);
      out.push({ key, ...bounds, label, full: label });
      if (key >= endKey) break;
      if (++m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }

  const out: TimeBin[] = [];
  for (let start = from; start <= to; start = addDays(start, 7)) {
    const rawEnd = addDays(start, 6);
    const end = rawEnd > to ? to : rawEnd;
    out.push({
      key: start,
      from: start,
      to: end,
      label: beShort(start),
      full: `${beShort(start)} – ${beShort(end)}`,
    });
  }
  return out;
}

/** Is a CE `yyyy-mm-dd` inside this bin? (Inclusive on both ends.) */
export function inBin(bin: { from: string; to: string }, iso: string): boolean {
  return iso >= bin.from && iso <= bin.to;
}

/**
 * A whole range collapsed into ONE bucket looks like a complete period's total — a six-week
 * extract on a year axis is a single bar that reads as "the year". Say out loud that it is not.
 */
export function binScopeNote(bins: readonly TimeBin[], kind: SalesPeriod, from: string, to: string): string {
  if (bins.length !== 1) return "";
  const label = SALES_PERIODS.find((p) => p.key === kind)?.label ?? "";
  return ` · ช่วงข้อมูลที่เลือกครอบคลุมเพียง ${beShort(from)} – ${beShort(to)} แท่งเดียวนี้จึงยังไม่ใช่ยอดเต็ม${label}`;
}

// ---------------------------------------------------------------------------------------------
// Delivery status — "สถานะการส่งมอบ", NEVER "สถานะ SO" (the SalesOrder module is unused).
//
// NO "cancelled"/ยกเลิก ENTRY, on purpose (schema-conformance fix 23-09-26): `dbo.tbl_DOhdr` has no
// cancel column on the live ERP, so the SQL CASE can never emit that key. The real flags are
// IsApproved / IsClosed / IsComplete / IsCheck / IsAcc / Revised, and none of them means cancelled
// (`Revised` is 0 on all 83 live headers and was not repurposed). See do-headers.sql for the full
// decision + evidence. `salesStatusLabel()` still renders an unknown key as itself, so if the ERP
// ever starts emitting one it surfaces rather than being silently swallowed.
// ---------------------------------------------------------------------------------------------

export type SalesStatusTone = "neutral" | "accent" | "brand" | "success" | "danger";

export const SALES_STATUSES: ReadonlyArray<{
  key: string;
  label: string;
  tone: SalesStatusTone;
}> = [
  { key: "pending", label: "ยังไม่อนุมัติ", tone: "neutral" },
  { key: "approved", label: "อนุมัติแล้ว", tone: "accent" },
  { key: "checked", label: "อนุมัติและตรวจแล้ว", tone: "brand" },
  { key: "closed", label: "ปิดแล้ว", tone: "success" },
];

/** Unknown keys render as themselves rather than throwing — an unseen ERP flag combination shows up. */
export function salesStatusLabel(key: string): string {
  return SALES_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function salesStatusTone(key: string): SalesStatusTone {
  return SALES_STATUSES.find((s) => s.key === key)?.tone ?? "neutral";
}

// ---------------------------------------------------------------------------------------------
// Product categories — CODE from `InventoryItem.ItemGRP`, LABEL from the ERP's own
// `dbo.tbl_ItemGroup` (ICCode -> Description).
// ---------------------------------------------------------------------------------------------

/**
 * The category label lookup, keyed by the raw ItemGRP CODE.
 *
 * NOT HARDCODED ANY MORE (defect fix, 23-09-26). The previous app-side map only knew F/R/P, so the
 * live code `W` rendered on the customer's pie as the raw fallback "หมวด W" — and `P` was not even
 * a real live code (the live "ระหว่างผลิต" group is `W`). Labels now come from `tbl_ItemGroup` via
 * the LEFT JOIN in `do-lines.sql`, so a group the customer renames or adds in the ERP shows up
 * without a code change here.
 *
 * The CODE remains the identity everywhere else: `?cat=` URL state, the SQL filter, and the slice
 * key all use the code, never the label. A label is display-only and may be missing.
 */
export type CategoryLabels = ReadonlyMap<string, string>;

/** Blank/missing ItemGRP collapses to this key in the SQL (`COALESCE(NULLIF(...), '-')`). */
export const CATEGORY_UNSPECIFIED_KEY = "-";
const CATEGORY_UNSPECIFIED_LABEL = "ไม่ระบุหมวด";

/** The minimum shape `buildCategoryLabels` needs from a DO line row. */
export interface CategoryLabelSource {
  CategoryKey: string;
  CategoryLabel?: string | null;
}

/**
 * Collect the ERP's own labels out of the rows a query returned. PURE — no DB access.
 *
 * Rows for the same code always carry the same label (both come from the one group master), so
 * first-wins is enough; blank labels are skipped so they cannot shadow a good one.
 */
export function buildCategoryLabels(rows: readonly CategoryLabelSource[]): CategoryLabels {
  const labels = new Map<string, string>();
  for (const row of rows) {
    const key = (row.CategoryKey ?? "").trim();
    const label = (row.CategoryLabel ?? "").trim();
    if (!key || !label || labels.has(key)) continue;
    labels.set(key, label);
  }
  return labels;
}

/**
 * Display label for a category code.
 *
 * Order: the ERP's own label -> "ไม่ระบุหมวด" for the blank-group key -> "หมวด {code}". The last
 * fallback is deliberate: an unresolvable code stays VISIBLE as itself rather than being dropped
 * or silently merged into another slice.
 */
export function categoryLabel(key: string, labels?: CategoryLabels): string {
  const fromErp = labels?.get(key);
  if (fromErp) return fromErp;
  if (key === CATEGORY_UNSPECIFIED_KEY) return CATEGORY_UNSPECIFIED_LABEL;
  return `หมวด ${key}`;
}

// ---------------------------------------------------------------------------------------------
// Formatting.
// ---------------------------------------------------------------------------------------------

const intFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const qtyFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatInt(n: number): string {
  return intFormatter.format(n);
}

export function formatQty(n: number): string {
  return qtyFormatter.format(n);
}

/** THB with a trailing บาท — the dashboard never prints a bare number as money. */
export function formatMoney(n: number): string {
  return `${moneyFormatter.format(n)} บาท`;
}

export function formatPercent(n: number): string {
  return pctFormatter.format(n);
}

/**
 * The reconciliation footnote. It must NAME the excluded amount — "some data is excluded" would
 * bury it, which the umbrella charter forbids.
 */
export function reconciliationNote(excludedCount: number, excludedTotal: number): string {
  return (
    `มียอดใบแจ้งหนี้ขาย (SalesInvoiceHdr) อีก ${formatInt(excludedCount)} ใบ ` +
    `รวม ${formatMoney(excludedTotal)} ที่ไม่ถูกนับรวมในยอดนี้ ` +
    `เนื่องจากยังไม่ใช่ฐานข้อมูลที่ใช้ในแดชบอร์ดนี้`
  );
}

// ---------------------------------------------------------------------------------------------
// Date range.
// ---------------------------------------------------------------------------------------------

/** Default range when the URL carries none: the last 90 days ending today (CE, local calendar). */
export function defaultDateRange(today: Date = new Date()): { from: string; to: string } {
  const to = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  return { from: addDays(to, -90), to };
}

/** Accept only a well-formed CE `yyyy-mm-dd`; anything else falls back. */
export function resolveDateParam(raw: string | string[] | undefined, fallback: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}
