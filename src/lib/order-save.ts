// Pure snapshot-merge helper (Phase 04, decision 2, PVL-added). The order-sheet save path
// delete-and-recreates OrderLine rows inside a transaction, but MUST preserve the historical name
// snapshot (`shopNameAtEntry` / `variantNameAtEntry`) for cells that already existed — otherwise a
// re-save after a shop/variant rename would silently rewrite history and break the Phase-02
// correction-cascade lock guarantee (a confirmed entity's snapshots are frozen).
//
// This module isolates the carry-forward-vs-fresh DECISION so it is unit-testable without a DB
// (mirrors the CascadeDb extract-pure-logic pattern). The server action supplies the existing
// rows (read FIRST, before the explicit child delete) and the current live names.

/** An existing OrderLine's identity + its already-persisted snapshot text. */
export interface ExistingLineSnapshot {
  shopId: number;
  variantId: number;
  shopNameAtEntry: string;
  variantNameAtEntry: string;
}

/** An incoming grid cell to (re)insert. */
export interface IncomingCell {
  shopId: number;
  variantId: number;
  qty: number;
}

/** Current live master-data names, keyed by id, used for FRESH snapshots on brand-new cells. */
export interface LiveNames {
  shopNames: Map<number, string>;
  variantNames: Map<number, string>;
}

/** A resolved line ready to insert, with snapshot text decided (carried-forward or fresh). */
export interface MergedLine {
  shopId: number;
  variantId: number;
  qty: number;
  shopNameAtEntry: string;
  variantNameAtEntry: string;
}

function key(shopId: number, variantId: number): string {
  return `${shopId}:${variantId}`;
}

/**
 * Decide the snapshot text for every incoming cell:
 * - if a matching existing line (same shopId + variantId) was present → CARRY FORWARD its snapshot
 *   text (protects the Phase-02 lock; a live rename must NOT rewrite an existing cell's history).
 * - otherwise → write a FRESH snapshot from the current live names (empty string if a live name is
 *   missing, never `undefined`).
 */
export function mergeSnapshots(
  existing: ExistingLineSnapshot[],
  incoming: IncomingCell[],
  live: LiveNames,
): MergedLine[] {
  const existingByKey = new Map<string, ExistingLineSnapshot>();
  for (const line of existing) {
    existingByKey.set(key(line.shopId, line.variantId), line);
  }

  return incoming.map((cell) => {
    const prior = existingByKey.get(key(cell.shopId, cell.variantId));
    if (prior) {
      return {
        shopId: cell.shopId,
        variantId: cell.variantId,
        qty: cell.qty,
        shopNameAtEntry: prior.shopNameAtEntry,
        variantNameAtEntry: prior.variantNameAtEntry,
      };
    }
    return {
      shopId: cell.shopId,
      variantId: cell.variantId,
      qty: cell.qty,
      shopNameAtEntry: live.shopNames.get(cell.shopId) ?? "",
      variantNameAtEntry: live.variantNames.get(cell.variantId) ?? "",
    };
  });
}
