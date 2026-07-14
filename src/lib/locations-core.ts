// location-management — PURE, DB-free list transforms for the managed สถานที่ (locations) list.
// Kept separate from `locations.ts` (which imports the Prisma client) so these transforms can be
// unit-tested without loading `db.ts` — matching the repo convention of DB-free pure modules
// (roster.ts, totals.ts, order-save.ts). `locations.ts` re-exports every name below, so the public
// contract (all list-transform helpers importable from `@/lib/locations`) is unchanged.
//
// Exact string-match semantics (case-sensitive, no locale folding) mirror `roster.ts`'s
// `s.location === loc` contract exactly, so the managed list's notion of "same location" never
// diverges from the roster filter's notion.

export const LOCATIONS_KEY = "locations";

/** PURE — trim each entry, drop empties, dedupe (case-sensitive, first occurrence wins), preserve order. */
export function normalizeLocations(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const name = raw.trim();
    if (name === "") continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** PURE — append `name` then normalize. */
export function addLocation(list: string[], name: string): string[] {
  return normalizeLocations([...list, name]);
}

/** PURE — map `oldName` → `newName` across the list, then normalize (handles rename-into-existing). */
export function renameLocation(list: string[], oldName: string, newName: string): string[] {
  const trimmedNew = newName.trim();
  return normalizeLocations(list.map((l) => (l === oldName ? trimmedNew : l)));
}

/** PURE — remove exact matches of `name`. */
export function removeLocation(list: string[], name: string): string[] {
  return list.filter((l) => l !== name);
}
