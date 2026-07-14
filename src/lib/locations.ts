// location-management — the single managed list of สถานที่ (locations), stored as a JSON array
// under ONE `AppSetting` row (key: "locations"). Zero schema change (same pattern as
// `app-settings.ts`). The pure list transforms live in `locations-core.ts` (DB-free, unit-tested)
// and are re-exported here so the whole location API is importable from `@/lib/locations`.

import { prisma } from "@/lib/db";
import {
  LOCATIONS_KEY,
  normalizeLocations,
} from "@/lib/locations-core";

export {
  LOCATIONS_KEY,
  normalizeLocations,
  addLocation,
  renameLocation,
  removeLocation,
} from "@/lib/locations-core";

/**
 * Read the managed list. Lazy-seed on first read (row ABSENT) from distinct active, non-null
 * `Shop.location` values. Presence is checked by row EXISTENCE, so an empty-but-present "[]" value
 * does NOT re-trigger seeding.
 */
export async function getManagedLocations(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: LOCATIONS_KEY } });

  if (row == null) {
    const shopRows = await prisma.shop.findMany({
      where: { active: true, location: { not: null } },
      distinct: ["location"],
      select: { location: true },
    });
    const seeded = normalizeLocations(
      shopRows.map((r) => r.location).filter((l): l is string => l != null),
    );
    await setManagedLocations(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeLocations(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return [];
  }
}

/** Normalize + upsert the managed list as a JSON array. */
export async function setManagedLocations(list: string[]): Promise<void> {
  const normalized = normalizeLocations(list);
  const value = JSON.stringify(normalized);
  await prisma.appSetting.upsert({
    where: { key: LOCATIONS_KEY },
    create: { key: LOCATIONS_KEY, value },
    update: { value },
  });
}

/**
 * The list to offer in the shop-form + order-sheet-form selects: the managed list first (stored
 * order), then any distinct active-shop `location` values NOT already in the managed list, appended
 * in `location asc` order (legacy stragglers surfaced at the end, never interleaved).
 */
export async function getEffectiveLocationOptions(): Promise<string[]> {
  const managed = await getManagedLocations();
  const managedSet = new Set(managed);

  const shopRows = await prisma.shop.findMany({
    where: { active: true, location: { not: null } },
    distinct: ["location"],
    select: { location: true },
    orderBy: { location: "asc" },
  });
  const extra = shopRows
    .map((r) => r.location)
    .filter((l): l is string => l != null && !managedSet.has(l));

  return [...managed, ...extra];
}
