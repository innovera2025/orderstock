// Shared correction-cascade (Phase 02, decision 6, C4) — LOAD-BEARING for Phases 04/05.
//
// Historical fidelity: OrderLine/NoteLine carry denormalized name snapshots
// (shopNameAtEntry / variantNameAtEntry) written at line-create time. When a master-data
// name is corrected, this cascade back-fills those snapshots ONLY WHILE the referenced
// entity is still `needsConfirmation === true` (typo fixes propagate). Once the entity is
// confirmed (needsConfirmation === false), the snapshots are LOCKED — later renames do NOT
// rewrite history. Phase 05 prints from snapshots, never live names.
//
// The DB is injected via the `CascadeDb` interface so the propagate-then-lock logic is
// unit-testable in isolation (G-cascade) without a live database.

export interface CascadeDb {
  /** Set shopNameAtEntry = newName on every OrderLine + NoteLine referencing shopId. Returns rows updated. */
  backfillShopNameSnapshots(shopId: number, newName: string): Promise<number>;
  /** Set variantNameAtEntry = newName on every OrderLine + NoteLine referencing variantId. Returns rows updated. */
  backfillVariantNameSnapshots(variantId: number, newName: string): Promise<number>;
}

export interface CascadeResult {
  /** True when the correction was propagated to snapshots; false when locked (already confirmed). */
  propagated: boolean;
  /** Number of snapshot rows back-filled. */
  updatedRows: number;
}

/**
 * Back-fill shop-name snapshots after a shop-name correction.
 *
 * @param wasNeedsConfirmation the shop's `needsConfirmation` state BEFORE this edit.
 *   If it was already confirmed (false), snapshots are locked and nothing propagates.
 */
export async function cascadeShopNameCorrection(
  db: CascadeDb,
  shopId: number,
  newName: string,
  wasNeedsConfirmation: boolean,
): Promise<CascadeResult> {
  if (!wasNeedsConfirmation) {
    return { propagated: false, updatedRows: 0 };
  }
  const updatedRows = await db.backfillShopNameSnapshots(shopId, newName);
  return { propagated: true, updatedRows };
}

/**
 * Back-fill variant-name snapshots after a variant-name correction. Same lock semantics as
 * {@link cascadeShopNameCorrection}.
 */
export async function cascadeVariantNameCorrection(
  db: CascadeDb,
  variantId: number,
  newName: string,
  wasNeedsConfirmation: boolean,
): Promise<CascadeResult> {
  if (!wasNeedsConfirmation) {
    return { propagated: false, updatedRows: 0 };
  }
  const updatedRows = await db.backfillVariantNameSnapshots(variantId, newName);
  return { propagated: true, updatedRows };
}
