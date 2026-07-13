// shop-location-roster — the SINGLE source of truth for turning the full active-shop list into a
// per-location, display-numbered roster. BOTH the order editor (`orders/[id]/page.tsx`) and the
// print fetch (`get-sheet-for-print.ts`) call this ONE helper so the filter + fallback + renumber
// logic never forks between the two surfaces.
//
// Two distinct numbers travel together on every row and must never be conflated:
//   - `rosterOrder` — the shop's real, stable, globally-unique DB value. Identity: used for
//     React keys, `data-testid`, the print `?slots=` filter, and cell/save keying. NEVER renumbered.
//   - `displayNo`   — the NEW per-location 1..N position, assigned here. Display-only: the visible
//     row number in the matrix and on the printed sheet. NEVER reaches the save payload.

export interface RosterInputShop {
  id: number;
  rosterOrder: number;
  name: string;
  location: string | null;
}

export interface RosterRow {
  /** Real globally-unique DB roster slot — identity/testid/key/`?slots=`. Never renumbered. */
  rosterOrder: number;
  /** Per-location 1..N visible position — display-only. */
  displayNo: number;
  shopId: number;
  shopName: string;
}

/**
 * Build the per-location roster from the FULL active-shop list.
 *
 * Filter + fallback + renumber all happen HERE (callers pass only the full active-shop list + the
 * sheet's location string):
 *   1. Filter `activeShops` down to the shops whose `location` matches `sheetLocation`.
 *   2. Fallback: if `sheetLocation` is null/empty OR the filter yields 0 shops, use the FULL
 *      active-shop list (backward-compatible with legacy/null-location sheets).
 *   3. Sort by `rosterOrder` ascending and assign `displayNo` 1..N.
 */
export function buildLocationRoster(
  activeShops: RosterInputShop[],
  sheetLocation: string | null,
): RosterRow[] {
  const sorted = [...activeShops].sort((a, b) => a.rosterOrder - b.rosterOrder);

  const loc = sheetLocation?.trim() ?? "";
  let selected = sorted;
  if (loc !== "") {
    const filtered = sorted.filter((s) => s.location === loc);
    if (filtered.length > 0) selected = filtered;
  }

  return selected.map((s, i) => ({
    rosterOrder: s.rosterOrder,
    displayNo: i + 1,
    shopId: s.id,
    shopName: s.name,
  }));
}
