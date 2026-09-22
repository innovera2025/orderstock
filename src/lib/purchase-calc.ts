// erp-dashboards Phase 3 — PURE Purchase-dashboard transforms. ZERO DB access, zero ERP access,
// zero Prisma import — every function here is a plain input→output transform over in-memory data.
//
// This is the `locations-core.ts` / `sales-basis-core.ts` half of the split: the DB-touching
// wrappers live in `purchase-data.ts`, and everything provable without a database lives here,
// unit-tested with zero preconditions.
//
// Imports are RELATIVE, not `@/` — vitest does not resolve the TS path alias (see
// `process/context/tests/all-tests.md` § Component testing WITHOUT jsdom).
//
// SELF-CONTAINED BY DESIGN: the period-bin and formatting helpers below duplicate a little of
// Phase 2's `sales-basis-core.ts` on purpose. The blast-radius registry keeps Phase 2, 3 and 4
// disjoint so they can run in parallel; importing a Phase-2-owned module here would couple this
// dashboard to another phase's in-flight file. `be-date.ts` IS shared (repo-level, phase-neutral)
// and is imported rather than re-derived.

import { ceToBeParts, parseDateInputValue } from "./be-date";

// ---------------------------------------------------------------------------------------------
// PO status derivation — a PURE function, deliberately NOT a SQL `CASE`.
// ---------------------------------------------------------------------------------------------

export type PoStatus =
  | "Cancelled"
  | "Closed"
  | "Completed"
  | "Received"
  | "Checked"
  | "Approved"
  | "Pending";

export type PoStatusTone = "neutral" | "accent" | "brand" | "success" | "danger";

/** Display order for the status donut and the `?status=` filter. Lifecycle order, cancelled last. */
export const PO_STATUSES: ReadonlyArray<{
  key: PoStatus;
  label: string;
  tone: PoStatusTone;
}> = [
  { key: "Pending", label: "รออนุมัติ", tone: "neutral" },
  { key: "Approved", label: "อนุมัติแล้ว", tone: "accent" },
  { key: "Checked", label: "ตรวจสอบแล้ว", tone: "brand" },
  { key: "Received", label: "รับสินค้าแล้ว", tone: "brand" },
  { key: "Completed", label: "เสร็จสมบูรณ์", tone: "success" },
  { key: "Closed", label: "ปิดแล้ว", tone: "success" },
  { key: "Cancelled", label: "ยกเลิก", tone: "danger" },
];

/**
 * The caveat that must accompany EVERY rendered PO status.
 *
 * WHY (research, confidence LOW): the live ERP has only 4 PO rows, all in the same early lifecycle
 * state, and `PurchaseOrderHdr.Status` is free text ('Pending' on every row). The precedence order
 * below is therefore AUTHORED from the flag columns, not read off a validated enum, and has never
 * been checked against a real status distribution. The badge is not decoration and not optional —
 * removing it requires a fresh confidence check, which is why it lives in its own constant and its
 * own `Chip`, never merged into the status chip itself.
 */
export const PO_STATUS_UNVALIDATED_TEXT = "ยังไม่ผ่านการยืนยัน";

export interface PoStatusFlags {
  isCancel: boolean;
  /** NULL when the PO is open — NEVER treat NULL as falsy without explicit ISNULL semantics. */
  isClosed: boolean | null;
  isComplete: boolean;
  isRecPo: boolean;
  isApproved: boolean;
  isCheck: boolean;
}

/**
 * Derive a single display status from the ERP's flag columns.
 *
 * `isClosed` is `boolean | null` because `PurchaseOrderHdr.IsClosed` is NULL on every open PO in
 * the live data. `ISNULL(IsClosed, 0) = 1` is the ERP's own semantic: a NULL means OPEN and must
 * fall THROUGH to the next check, never short-circuit to "Closed".
 */
export function derivePoStatus(flags: PoStatusFlags): PoStatus {
  if (flags.isCancel) return "Cancelled";
  if ((flags.isClosed ?? false) === true) return "Closed"; // ISNULL(IsClosed,0) = 1
  if (flags.isComplete) return "Completed";
  if (flags.isRecPo) return "Received";
  if (flags.isApproved && flags.isCheck) return "Checked";
  if (flags.isApproved) return "Approved";
  return "Pending";
}

/** Narrow an arbitrary `?status=` value to a real `PoStatus`, or `null` for "all statuses". */
export function resolvePoStatusParam(raw: string | string[] | undefined): PoStatus | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = PO_STATUSES.find((s) => s.key === value);
  return match ? match.key : null;
}

export function poStatusLabel(key: string): string {
  return PO_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function poStatusTone(key: string): PoStatusTone {
  return PO_STATUSES.find((s) => s.key === key)?.tone ?? "neutral";
}

// ---------------------------------------------------------------------------------------------
// Received / outstanding quantities.
// ---------------------------------------------------------------------------------------------

/**
 * Outstanding = ordered − received, returned RAW.
 *
 * A negative value means an over-receipt, which is real data worth surfacing. It is deliberately
 * NOT clamped to 0: hiding it would make a genuine warehouse discrepancy invisible. The UI leads
 * with a "รับเกิน N" label and keeps the raw negative number visible after it.
 */
export function computeOutstanding(orderedQty: number, receivedQty: number): number {
  const ordered = Number.isFinite(orderedQty) ? orderedQty : 0;
  const received = Number.isFinite(receivedQty) ? receivedQty : 0;
  return ordered - received;
}

export interface PoQuantityLine {
  unit: string;
  orderedQty: number;
  receivedQty: number;
}

export interface UnitQuantityTotal {
  unit: string;
  ordered: number;
  received: number;
  outstanding: number;
}

/**
 * Received/outstanding totals PER UNIT.
 *
 * HARD SAFETY CONSTRAINT (umbrella Program Goal Charter): quantities are NEVER summed across
 * different `MainUnits` values. The return type is a per-unit list, not a number, so this function
 * structurally cannot produce a cross-unit total. Units sort by first-seen order, then name, so the
 * output is deterministic.
 */
export function quantitiesByUnit(lines: readonly PoQuantityLine[]): UnitQuantityTotal[] {
  const totals = new Map<string, UnitQuantityTotal>();
  for (const line of lines) {
    const unit = (line.unit ?? "").trim() === "" ? "-" : line.unit.trim();
    const entry = totals.get(unit) ?? { unit, ordered: 0, received: 0, outstanding: 0 };
    entry.ordered += Number.isFinite(line.orderedQty) ? line.orderedQty : 0;
    entry.received += Number.isFinite(line.receivedQty) ? line.receivedQty : 0;
    entry.outstanding = computeOutstanding(entry.ordered, entry.received);
    totals.set(unit, entry);
  }
  return [...totals.values()].sort((a, b) => a.unit.localeCompare(b.unit, "th"));
}

// ---------------------------------------------------------------------------------------------
// Supplier breakdown (dual basis).
// ---------------------------------------------------------------------------------------------

export interface SupplierAggregateInput {
  supplierCode: string | null;
  /** PO-committed amount for this row; omit/0 for an invoice-only supplier. */
  poAmount?: number;
  /** Invoice-basis amount for this row; omit/0 for a PO-only supplier. */
  invoiceAmount?: number;
  /** 1 when this row is a non-cancelled PO, 0 otherwise. */
  poCount?: number;
  /** 1 when this row is a counted purchase invoice, 0 otherwise. */
  invoiceCount?: number;
}

export interface SupplierBreakdownRow {
  supplierCode: string;
  poAmount: number;
  invoiceAmount: number;
  poCount: number;
  invoiceCount: number;
}

/** Label for a row whose `SupplierCode` is NULL/blank in the ERP. */
export const NO_SUPPLIER_CODE = "-";

/**
 * Aggregate both money bases per `SupplierCode`.
 *
 * `SupplierCode` — never `SupplierName` — is the group key: the data dictionary warns the code is
 * the only reliable identity (477 bulk-imported supplier master rows, only 2 codes ever used in
 * real transactions), so the dashboard labels every bar with the code verbatim.
 *
 * DETERMINISM: sorted by PO amount desc, then invoice amount desc, then `SupplierCode` ASCENDING
 * as the final tie-break — so two suppliers with identical totals always render in the same order
 * regardless of input order.
 */
export function aggregateSupplierBreakdown(
  rows: readonly SupplierAggregateInput[],
): SupplierBreakdownRow[] {
  const totals = new Map<string, SupplierBreakdownRow>();
  for (const row of rows) {
    const code = (row.supplierCode ?? "").trim() === "" ? NO_SUPPLIER_CODE : row.supplierCode!.trim();
    const entry =
      totals.get(code) ??
      ({ supplierCode: code, poAmount: 0, invoiceAmount: 0, poCount: 0, invoiceCount: 0 } as const);
    totals.set(code, {
      supplierCode: code,
      poAmount: entry.poAmount + num(row.poAmount),
      invoiceAmount: entry.invoiceAmount + num(row.invoiceAmount),
      poCount: entry.poCount + num(row.poCount),
      invoiceCount: entry.invoiceCount + num(row.invoiceCount),
    });
  }
  return [...totals.values()].sort(
    (a, b) =>
      b.poAmount - a.poAmount ||
      b.invoiceAmount - a.invoiceAmount ||
      a.supplierCode.localeCompare(b.supplierCode, "th"),
  );
}

function num(value: number | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

// ---------------------------------------------------------------------------------------------
// Period granularity (สัปดาห์ / เดือน / ปี).
// ---------------------------------------------------------------------------------------------

export type PurchasePeriod = "week" | "month" | "year";

/** เดือน is the default: the ERP reports purchases monthly (`sp_PurchaseInvoiceMonth`). */
export const DEFAULT_PURCHASE_PERIOD: PurchasePeriod = "month";

export const PURCHASE_PERIODS: ReadonlyArray<{
  key: PurchasePeriod;
  label: string;
  column: string;
}> = [
  { key: "week", label: "สัปดาห์", column: "สัปดาห์" },
  { key: "month", label: "เดือน", column: "เดือน" },
  { key: "year", label: "ปี", column: "ปี" },
];

export function resolvePurchasePeriod(raw: string | string[] | undefined): PurchasePeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "week" || value === "month" || value === "year") return value;
  return DEFAULT_PURCHASE_PERIOD;
}

export interface PurchaseTimeBin {
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

/** BE year for a CE `yyyy-mm-dd`, via the shared `be-date` Intl helper (never a hand-rolled +543). */
export function beYearOf(iso: string): number {
  return ceToBeParts(parseDateInputValue(iso)).yearBE;
}

/** Thai short BE date, e.g. `3/8/69`. */
export function beShort(iso: string): string {
  if (!iso) return "";
  const { day, month, yearBE2 } = ceToBeParts(parseDateInputValue(iso));
  return `${day}/${month}/${yearBE2}`;
}

/** Thai BE month label, e.g. `ส.ค. 2569`. */
export function beMonthLabel(iso: string): string {
  const d = parseDateInputValue(iso);
  return `${THAI_MONTHS_SHORT[d.getMonth()]} ${beYearOf(iso)}`;
}

/**
 * Tile `[from, to]` into bins at the requested granularity. Weeks align to the START of the
 * selected range (hence the axis caption "สัปดาห์ที่เริ่มวันที่"), and every bin is clipped to the
 * range so the first and last bins never claim days outside the user's selection.
 */
export function purchaseTimeBins(from: string, to: string, kind: PurchasePeriod): PurchaseTimeBin[] {
  if (!from || !to || from > to) return [];
  const clip = (a: string, b: string) => ({ from: a < from ? from : a, to: b > to ? to : b });

  if (kind === "year") {
    const out: PurchaseTimeBin[] = [];
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
      const bounds = clip(`${y}-01-01`, `${y}-12-31`);
      const be = beYearOf(bounds.from);
      out.push({ key: String(y), ...bounds, label: String(be), full: `ปี พ.ศ. ${be}` });
    }
    return out;
  }

  if (kind === "month") {
    const out: PurchaseTimeBin[] = [];
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

  const out: PurchaseTimeBin[] = [];
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
export function inPurchaseBin(bin: { from: string; to: string }, iso: string): boolean {
  return iso !== "" && iso >= bin.from && iso <= bin.to;
}

/**
 * A whole range collapsed into ONE bucket looks like a complete period's total — a six-week extract
 * on a year axis is a single bar that reads as "the year". Say out loud that it is not.
 */
export function binScopeNote(
  bins: readonly PurchaseTimeBin[],
  kind: PurchasePeriod,
  from: string,
  to: string,
): string {
  if (bins.length !== 1) return "";
  const label = PURCHASE_PERIODS.find((p) => p.key === kind)?.label ?? "";
  return ` · ช่วงข้อมูลที่เลือกครอบคลุมเพียง ${beShort(from)} – ${beShort(to)} แท่งเดียวนี้จึงยังไม่ใช่ยอดเต็ม${label}`;
}

// ---------------------------------------------------------------------------------------------
// Date range + formatting.
// ---------------------------------------------------------------------------------------------

/** Default range when the URL carries none: the last 90 days ending today (CE, local calendar). */
export function defaultPurchaseDateRange(today: Date = new Date()): { from: string; to: string } {
  const to = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  return { from: addDays(to, -90), to };
}

/** Accept only a well-formed CE `yyyy-mm-dd`; anything else falls back. */
export function resolveDateParam(raw: string | string[] | undefined, fallback: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

const intFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const qtyFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInt(n: number): string {
  return intFormatter.format(n);
}

export function formatQty(n: number): string {
  return qtyFormatter.format(n);
}

/**
 * THB with a trailing บาท — the dashboard never prints a bare number as money.
 *
 * VAT (research finding, erp-data-dictionary §C-2): `PurchaseInvoiceHdr.VATAmount` is 0 on EVERY
 * live row, so these figures are VAT-exclusive and there is deliberately NO inclusive/exclusive
 * branching anywhere in this dashboard. That absence is correct, not an omission to "fix" later.
 */
export function formatMoney(n: number): string {
  return `${moneyFormatter.format(n)} บาท`;
}

/** Quantity plus its unit — never a bare cross-unit number. */
export function formatQtyWithUnit(n: number, unit: string): string {
  const u = (unit ?? "").trim();
  return u === "" || u === "-" ? formatQty(n) : `${formatQty(n)} ${u}`;
}
