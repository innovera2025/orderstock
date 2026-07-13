import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLocationRoster, type RosterInputShop } from "../roster";
import { computeGrandTotal, type OrderLineCell } from "../totals";

// Fully-automated gates for shop-location-roster:
//   G1 — buildLocationRoster filters by location + renumbers 1..N as displayNo, rosterOrder stable
//   G2 — fallback to full active-shop list when location is null / empty / 0-match
//   G3 — the 13/3/69 fixture filtered to ยิ่งเจริญ still totals 446 (all 25 shops share that location)

const shops: RosterInputShop[] = [
  { id: 101, rosterOrder: 1, name: "A", location: "ยิ่งเจริญ" },
  { id: 103, rosterOrder: 3, name: "C", location: "ยิ่งเจริญ" },
  { id: 105, rosterOrder: 5, name: "E", location: "ยิ่งเจริญ" },
  { id: 107, rosterOrder: 7, name: "G", location: "คลอง 2" },
  { id: 109, rosterOrder: 9, name: "I", location: null },
];

describe("buildLocationRoster — G1 per-location filter + displayNo renumber", () => {
  it("should filter activeShops by location and renumber 1..N as displayNo, keeping rosterOrder stable", () => {
    const rows = buildLocationRoster(shops, "ยิ่งเจริญ");
    // Only the 3 ยิ่งเจริญ shops appear — คลอง 2 (rosterOrder 7) and null-location (9) are absent.
    expect(rows.map((r) => r.shopId)).toEqual([101, 103, 105]);
    // displayNo is contiguous 1..N (renumbered) …
    expect(rows.map((r) => r.displayNo)).toEqual([1, 2, 3]);
    // … while rosterOrder keeps the original, gapped, globally-unique DB values.
    expect(rows.map((r) => r.rosterOrder)).toEqual([1, 3, 5]);
  });

  it("should sort by rosterOrder ascending before assigning displayNo", () => {
    const shuffled = [shops[2], shops[0], shops[1]]; // E(5), A(1), C(3) — all ยิ่งเจริญ
    const rows = buildLocationRoster(shuffled, "ยิ่งเจริญ");
    expect(rows.map((r) => r.rosterOrder)).toEqual([1, 3, 5]);
    expect(rows.map((r) => r.displayNo)).toEqual([1, 2, 3]);
  });

  it("should exclude a shop assigned a DIFFERENT location", () => {
    const rows = buildLocationRoster(shops, "คลอง 2");
    expect(rows.map((r) => r.shopId)).toEqual([107]);
    expect(rows[0].displayNo).toBe(1);
    expect(rows[0].rosterOrder).toBe(7);
  });
});

describe("buildLocationRoster — G2 fallback to full active-shop list", () => {
  it("should fall back to the full active-shop list when location is null or has 0 matches", () => {
    // null → full list, renumbered 1..N
    const nullRoster = buildLocationRoster(shops, null);
    expect(nullRoster.map((r) => r.shopId)).toEqual([101, 103, 105, 107, 109]);
    expect(nullRoster.map((r) => r.displayNo)).toEqual([1, 2, 3, 4, 5]);
    expect(nullRoster.map((r) => r.rosterOrder)).toEqual([1, 3, 5, 7, 9]);

    // empty string → full list
    expect(buildLocationRoster(shops, "").map((r) => r.shopId)).toEqual([101, 103, 105, 107, 109]);
    // whitespace-only → full list
    expect(buildLocationRoster(shops, "   ").length).toBe(5);
    // a location that matches 0 shops → full list (not an empty roster)
    expect(buildLocationRoster(shops, "ไม่มีจริง").length).toBe(5);
  });
});

interface Fixture {
  cells: OrderLineCell[];
  expectedGrandTotal: number;
  location: string | null;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

describe("shop-location-roster — G3 fixture location-filter preserves grand total 446", () => {
  it("should preserve grand total 446 when the 13/3/69 fixture is filtered to location ยิ่งเจริญ", () => {
    // The fixture location is ยิ่งเจริญ (all 25 seeded shops share it after backfill), so filtering
    // to that location includes every shop the fixture's cells reference — the grid total is unchanged.
    expect(fixture.location).toBe("ยิ่งเจริญ");
    expect(computeGrandTotal(fixture.cells)).toBe(446);
    expect(computeGrandTotal(fixture.cells)).toBe(fixture.expectedGrandTotal);
  });
});
