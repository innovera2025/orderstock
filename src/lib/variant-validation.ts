// Product-variant validation helpers (Phase 02, C3).
//
// F2: printOrder is a nullable, NON-@unique column (SQL Server allows only one NULL per
// UNIQUE constraint, and off-list variants carry printOrder = NULL). Uniqueness is
// therefore enforced HERE, at the app layer, over the ACTIVE non-null variant set.

export interface VariantOrderRow {
  id: number;
  printOrder: number | null;
  active: boolean;
}

/**
 * Is `candidate` printOrder free within the active, non-null variant set?
 *
 * - NULL printOrders (off-list variants) never conflict.
 * - Soft-deleted (active === false) variants never conflict.
 * - When editing an existing variant, pass its id as `excludeId` so a row does not
 *   conflict with itself.
 */
export function isPrintOrderAvailable(
  candidate: number,
  existing: readonly VariantOrderRow[],
  excludeId?: number,
): boolean {
  return !existing.some(
    (v) => v.active && v.printOrder === candidate && v.id !== excludeId,
  );
}
