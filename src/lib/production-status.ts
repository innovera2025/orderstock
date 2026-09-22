// erp-dashboards Phase 4 — Production: pure, DB-free logic for the MO status badge, the
// plan-only "actual produced" cell, and the per-unit quantity grouping.
//
// NOTHING HERE TOUCHES A DATABASE. Every function is a pure transform so the status precedence,
// the never-sum-across-units rule and the plan-only honesty guarantee are unit-testable without
// a SQL Server, exactly as `sales-basis-core.ts` does for Phase 2.

/** The one string the "ผลิตจริง" column is allowed to render — SPEC AC7. */
export const ACTUAL_PRODUCED_EMPTY_TEXT = "ยังไม่มีข้อมูลผลิตจริง";

export type MoStatusKey = "pending" | "approved" | "closed" | "cancelled";
export type MoStatusTone = "neutral" | "brand" | "success" | "danger";

/**
 * Display order + labels + chip tones for every derivable MO status.
 *
 * CONFIDENCE CAVEAT (data dictionary § Production, Risks table): only 2 of these 4 branches have
 * ever been exercised by real data (n=3 MOs: 2 รออนุมัติ, 1 อนุมัติแล้ว, all IsClosed=0, none
 * cancelled). This is the best-available derivation, NOT a validated enum.
 */
export const MO_STATUSES: ReadonlyArray<{
  key: MoStatusKey;
  label: string;
  tone: MoStatusTone;
}> = [
  { key: "pending", label: "รออนุมัติ", tone: "neutral" },
  { key: "approved", label: "อนุมัติแล้ว", tone: "brand" },
  { key: "closed", label: "ปิดแล้ว", tone: "success" },
  { key: "cancelled", label: "ยกเลิก", tone: "danger" },
];

/** Raw MO flags as they arrive from `tbl_MoHdr` (BIT columns; NULL is possible). */
export interface MoStatusFlags {
  approved?: boolean | number | null;
  isClosed?: boolean | number | null;
  isCancel?: boolean | number | null;
}

/** `ISNULL(flag, 0)` in TypeScript: NULL/undefined means "not set", i.e. false. */
function flag(value: boolean | number | null | undefined): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  return false;
}

/**
 * Derive one MO's status.
 *
 * Precedence (cancel first, then closed, then approved, else pending) mirrors the SQL CASE in
 * `db/erp-queries/production/mo-list.sql` — the two must never disagree.
 */
export function deriveMoStatus(mo: MoStatusFlags): {
  key: MoStatusKey;
  label: string;
  tone: MoStatusTone;
} {
  const key: MoStatusKey = flag(mo.isCancel)
    ? "cancelled"
    : flag(mo.isClosed)
      ? "closed"
      : flag(mo.approved)
        ? "approved"
        : "pending";
  return MO_STATUSES.find((s) => s.key === key)!;
}

/** Thai label for a status key; an unknown key renders as itself rather than vanishing. */
export function moStatusLabel(key: string): string {
  return MO_STATUSES.find((s) => s.key === key)?.label ?? key;
}

/** Chip tone for a status key; unknown keys fall back to neutral. */
export function moStatusTone(key: string): MoStatusTone {
  return MO_STATUSES.find((s) => s.key === key)?.tone ?? "neutral";
}

/**
 * Planned quantity for display. `LotQty` is the plan; MO-1 in the real data has LotQty = NULL and
 * only `Prodqty` populated (17), so `Prodqty` is the documented fallback — FOR DISPLAY ONLY.
 * `Prodqty` is proven to be a copy of the plan, never a measured output (data dictionary §C-4).
 */
export function plannedQuantity(mo: {
  lotQty?: number | null;
  prodQty?: number | null;
}): { qty: number; fromProdqty: boolean } {
  if (mo.lotQty != null) return { qty: Number(mo.lotQty), fromProdqty: false };
  if (mo.prodQty != null) return { qty: Number(mo.prodQty), fromProdqty: true };
  return { qty: 0, fromProdqty: false };
}

export interface UnitQuantity {
  unit: string;
  qty: number;
}

/**
 * Group planned quantities PER UNIT. Quantities are NEVER summed across different MainUnits —
 * a single combined number would be meaningless (kg + litre + bag).
 */
export function plannedQtyByUnit(
  rows: ReadonlyArray<{ unit: string | null | undefined; qty: number }>,
): UnitQuantity[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const unit = (row.unit ?? "").trim() === "" ? "-" : String(row.unit).trim();
    totals.set(unit, (totals.get(unit) ?? 0) + Number(row.qty ?? 0));
  }
  return [...totals.entries()]
    .map(([unit, qty]) => ({ unit, qty }))
    .sort((a, b) => b.qty - a.qty || a.unit.localeCompare(b.unit, "th"));
}

/** Thousands-separated integer. */
export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/** Quantity with up to 2 decimals (never rounded to a misleading whole number). */
export function formatQty(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

/** `1,352 กก.` — quantity always travels with its unit. */
export function formatQtyWithUnit(n: number, unit: string): string {
  return `${formatQty(n)} ${unit}`;
}
