// สรุปยอดผลิต (/summary) aggregation layer (pguard-redesign Phase 03). PURE, imports the
// UNCHANGED totals.ts for the OrderLineCell shape — it does NOT re-implement column/grand totals
// (the /summary bars ARE the 20 computeColumnTotals columns; this module only adds the per-SHOP
// axis for the "ร้านที่สั่งมากที่สุด" list). The 446 gate stays owned by totals.ts.

import type { OrderLineCell } from "./totals";

/**
 * Sum quantities per shop roster slot. Returns a sparse record (only shops that ordered appear),
 * keyed by `rosterOrder`. Σ of the values equals `computeGrandTotal` for the same cells — the two
 * aggregation axes (per-column vs per-shop) reconcile to the same grand total.
 */
export function computeShopTotals(cells: OrderLineCell[]): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const cell of cells) {
    totals[cell.rosterOrder] = (totals[cell.rosterOrder] ?? 0) + cell.qty;
  }
  return totals;
}

export interface ShopTotal {
  rosterOrder: number;
  qty: number;
}

/**
 * Top `n` shops by ordered quantity (default 8), sorted qty-descending. Ties broken by
 * `rosterOrder` ascending so the ordering is deterministic (stable for tests + render).
 */
export function topShops(cells: OrderLineCell[], n = 8): ShopTotal[] {
  const totals = computeShopTotals(cells);
  return Object.entries(totals)
    .map(([rosterOrder, qty]) => ({ rosterOrder: Number(rosterOrder), qty }))
    .sort((a, b) => b.qty - a.qty || a.rosterOrder - b.rosterOrder)
    .slice(0, n);
}
