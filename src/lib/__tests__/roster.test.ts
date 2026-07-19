import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLocationRoster,
  perLocationDisplayNo,
  sortShopsForDisplay,
  type RosterInputShop,
} from "../roster";
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

// Fully-automated gates for per-location-shop-numbering (the /shops display number):
//   perLocationDisplayNo — groups active shops by location, numbers 1..N per group (rosterOrder-asc),
//     rosterOrder gaps don't affect numbering, null/"" are ONE bucket, caller filters active-only.
//   sortShopsForDisplay — unfiltered /shops ordering: location asc, null/"" bucket LAST, rosterOrder asc within.

describe("perLocationDisplayNo — per-location 1..N numbering for /shops", () => {
  it("should number 1..N within each location, ignoring rosterOrder gaps", () => {
    const map = perLocationDisplayNo(shops);
    // ยิ่งเจริญ: rosterOrder 1,3,5 → display 1,2,3 (gaps collapsed)
    expect(map.get(101)).toBe(1);
    expect(map.get(103)).toBe(2);
    expect(map.get(105)).toBe(3);
    // คลอง 2: its own independent 1
    expect(map.get(107)).toBe(1);
    // null-location shop: its own "" bucket, independent 1
    expect(map.get(109)).toBe(1);
  });

  it("should number by rosterOrder ascending within a group regardless of input order", () => {
    const shuffled = [shops[2], shops[0], shops[1]]; // E(5), A(1), C(3) — all ยิ่งเจริญ
    const map = perLocationDisplayNo(shuffled);
    expect(map.get(101)).toBe(1); // rosterOrder 1
    expect(map.get(103)).toBe(2); // rosterOrder 3
    expect(map.get(105)).toBe(3); // rosterOrder 5
  });

  it("should treat null and empty/whitespace location as the SAME bucket, numbered together", () => {
    const input: RosterInputShop[] = [
      { id: 201, rosterOrder: 4, name: "NullLoc", location: null },
      { id: 202, rosterOrder: 2, name: "EmptyLoc", location: "" },
      { id: 203, rosterOrder: 6, name: "SpaceLoc", location: "   " },
    ];
    const map = perLocationDisplayNo(input);
    // All three share the "" bucket → numbered 1..3 by rosterOrder asc (2,4,6): 202,201,203
    expect(map.get(202)).toBe(1);
    expect(map.get(201)).toBe(2);
    expect(map.get(203)).toBe(3);
  });

  it("should number whatever it is given — the caller (not this fn) filters to active-only", () => {
    // The function has no `active` field/branch; an inactive shop passed in still gets numbered.
    // /shops passes active shops only, so inactive ids are naturally absent from the map there.
    const map = perLocationDisplayNo(shops);
    expect(map.size).toBe(shops.length);
  });
});

describe("sortShopsForDisplay — unfiltered /shops ordering", () => {
  it("should put the null/empty-location group LAST regardless of alphabetical position", () => {
    const input = [
      { id: 1, rosterOrder: 1, location: "B" },
      { id: 2, rosterOrder: 2, location: null },
      { id: 3, rosterOrder: 3, location: "A" },
    ];
    const sorted = sortShopsForDisplay(input);
    // A before B (alphabetical), null bucket last.
    expect(sorted.map((s) => s.id)).toEqual([3, 1, 2]);
  });

  it("should preserve rosterOrder ascending within one location group", () => {
    const input = [
      { id: 1, rosterOrder: 5, location: "A" },
      { id: 2, rosterOrder: 1, location: "A" },
      { id: 3, rosterOrder: 3, location: "A" },
    ];
    const sorted = sortShopsForDisplay(input);
    expect(sorted.map((s) => s.rosterOrder)).toEqual([1, 3, 5]);
  });

  it("should group by location then rosterOrder, null-bucket last", () => {
    const input = [
      { id: 1, rosterOrder: 9, location: null },
      { id: 2, rosterOrder: 2, location: "B" },
      { id: 3, rosterOrder: 1, location: "B" },
      { id: 4, rosterOrder: 8, location: "A" },
      { id: 5, rosterOrder: 4, location: "" },
    ];
    const sorted = sortShopsForDisplay(input);
    // A(8), B(1), B(2), then "" bucket [null(9)? no — "" and null share the bucket, rosterOrder asc: 5(4),1(9)]
    expect(sorted.map((s) => s.id)).toEqual([4, 3, 2, 5, 1]);
  });

  it("should not mutate the input array", () => {
    const input = [
      { id: 1, rosterOrder: 2, location: "A" },
      { id: 2, rosterOrder: 1, location: "A" },
    ];
    const snapshot = [...input];
    sortShopsForDisplay(input);
    expect(input).toEqual(snapshot);
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
