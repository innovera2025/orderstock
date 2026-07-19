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

/** Normalize a shop location to its grouping key: null/empty/whitespace → "" (the "no location"
 * bucket), otherwise the trimmed string. Same convention `buildLocationRoster` uses (`?.trim() ?? ""`),
 * kept in one place so `/shops` numbering and the order sheet can never disagree on what counts as
 * "no location". */
function locationKey(location: string | null): string {
  return location?.trim() || "";
}

/**
 * Per-location display numbers for the `/shops` master-data list.
 *
 * Unlike `buildLocationRoster` (which answers "the roster for ONE location", with a full-list
 * fallback appropriate for an order sheet that always has exactly one location), this answers "the
 * per-location number for EVERY shop across ALL locations at once" — a `Map<shopId, displayNo>`,
 * with NO fallback-to-full-list: a null/empty-location shop lands in its own "" bucket rather than
 * being folded into every other location's numbering. That different shape is why this is a separate
 * function, not a `buildLocationRoster` variant.
 *
 * Contract: the CALLER passes active shops only — this function does not filter by `active`. Inactive
 * shops are therefore absent from the returned map, so `map.get(inactiveShop.id)` is `undefined` and
 * the page renders `-`.
 *
 * Within each location bucket, shops are sorted by `rosterOrder` ascending (same tie-break as
 * `buildLocationRoster`) and numbered 1..N. `rosterOrder` is never renumbered.
 */
export function perLocationDisplayNo(activeShops: RosterInputShop[]): Map<number, number> {
  const groups = new Map<string, RosterInputShop[]>();
  for (const shop of activeShops) {
    const key = locationKey(shop.location);
    const group = groups.get(key);
    if (group) group.push(shop);
    else groups.set(key, [shop]);
  }

  const result = new Map<number, number>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.rosterOrder - b.rosterOrder);
    sorted.forEach((shop, i) => result.set(shop.id, i + 1));
  }
  return result;
}

/**
 * Sort shops for the UNFILTERED `/shops` view: group by location ascending (the null/empty "no
 * location" bucket always sorts LAST regardless of alphabetical position), then `rosterOrder`
 * ascending within each group — so the flat list reads as a sequence of per-location 1..N runs.
 *
 * Generic over any `{ location, rosterOrder }` shape so it works directly on Prisma `Shop` rows
 * (which also carry `id`, `name`, `active`, …) without a mapping step. Returns a new sorted array;
 * the input is not mutated.
 *
 * The filtered (`?location=`) view does NOT use this — its single-location list already arrives
 * `rosterOrder` ascending from the query.
 */
export function sortShopsForDisplay<
  T extends { location: string | null; rosterOrder: number },
>(shops: T[]): T[] {
  return [...shops].sort((a, b) => {
    const ka = locationKey(a.location);
    const kb = locationKey(b.location);
    if (ka !== kb) {
      // "" (no location) always sorts last.
      if (ka === "") return 1;
      if (kb === "") return -1;
      return ka < kb ? -1 : 1;
    }
    return a.rosterOrder - b.rosterOrder;
  });
}
