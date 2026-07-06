// Single totals engine (Phase 04, decision 7, LOAD-BEARING). The client live footer AND the
// server save-time verify import the SAME functions — one source of truth for the piece-count
// arithmetic. `computeGrandTotal` accepts `OrderLineCell[]` only: NoteLine qty is EXCLUDED at the
// TYPE level (no `includeNotes` flag), so the 446 gate can never be polluted by note quantities.

/** One (shop × in-order variant) grid cell. qty is a positive INTEGER piece count. */
export interface OrderLineCell {
  /** The shop's roster slot (1..29). */
  rosterOrder: number;
  /** Fixed print-order column position 1..20 (form columns C3–C22). */
  printOrder: number;
  qty: number;
}

/**
 * Sum quantities per print-order column. Returns a dense record for columns 1..20 so callers can
 * render every column footer (including zero columns) without a presence check.
 */
export function computeColumnTotals(orderLines: OrderLineCell[]): Record<number, number> {
  const totals: Record<number, number> = {};
  for (let printOrder = 1; printOrder <= 20; printOrder++) {
    totals[printOrder] = 0;
  }
  for (const cell of orderLines) {
    if (cell.printOrder >= 1 && cell.printOrder <= 20) {
      totals[cell.printOrder] += cell.qty;
    }
  }
  return totals;
}

/**
 * Grand piece-count total across all grid cells. NoteLine qty is EXCLUDED by type — this function
 * only accepts `OrderLineCell[]`. This is the 446 definitional gate for the 13/3/69 scan day.
 */
export function computeGrandTotal(orderLines: OrderLineCell[]): number {
  return orderLines.reduce((sum, cell) => sum + cell.qty, 0);
}

/**
 * Total weight = Σ(qty × weightKg) using an injected per-print-order factor map. The real
 * per-variant `weightKg` factors are unknown until customer Q22 (known-gap) — this ships the
 * math shape; missing factors contribute zero weight (never throws).
 */
export function computeTotalWeight(
  orderLines: OrderLineCell[],
  weightByPrintOrder: Record<number, number>,
): number {
  return orderLines.reduce(
    (sum, cell) => sum + cell.qty * (weightByPrintOrder[cell.printOrder] ?? 0),
    0,
  );
}
