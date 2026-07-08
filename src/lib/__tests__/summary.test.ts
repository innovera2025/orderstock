import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeColumnTotals, type OrderLineCell } from "../totals";
import { computeShopTotals, topShops } from "../summary";

// Fully-automated gate G1 (phase-03 validate-contract): the summary aggregation layer.
// computeShopTotals sums qty per rosterOrder (the /summary "ร้านที่สั่งมากที่สุด" source); its
// Σ must equal the same 446 grand total the grid produces, and per-column reconciliation via the
// UNCHANGED computeColumnTotals must match the fixture. summary.ts must NOT re-implement column
// totals — it imports totals.ts.

interface Fixture {
  cells: OrderLineCell[];
  expectedColumnTotals: Record<string, number>;
  expectedGrandTotal: number;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

describe("summary — computeShopTotals", () => {
  it("sums qty per rosterOrder to the 446 grand total", () => {
    const shopTotals = computeShopTotals(fixture.cells);
    const sum = Object.values(shopTotals).reduce((a, b) => a + b, 0);
    expect(sum).toBe(446);
    expect(sum).toBe(fixture.expectedGrandTotal);
  });

  it("computes the correct per-shop total for known rosters", () => {
    const shopTotals = computeShopTotals(fixture.cells);
    expect(shopTotals[27]).toBe(110); // 30+30+50
    expect(shopTotals[28]).toBe(40); // 20+20
    expect(shopTotals[1]).toBe(20); // 15+5
    expect(shopTotals[12]).toBe(2); // 1+1
  });

  it("returns {} for empty input (no throw)", () => {
    expect(computeShopTotals([])).toEqual({});
  });
});

describe("summary — topShops", () => {
  it("returns ≤ n entries sorted by qty desc (rosterOrder asc tiebreak)", () => {
    const top = topShops(fixture.cells, 8);
    expect(top).toHaveLength(8);
    expect(top).toEqual([
      { rosterOrder: 27, qty: 110 },
      { rosterOrder: 28, qty: 40 },
      { rosterOrder: 11, qty: 34 },
      { rosterOrder: 5, qty: 33 },
      { rosterOrder: 18, qty: 32 },
      { rosterOrder: 16, qty: 23 },
      { rosterOrder: 14, qty: 21 },
      { rosterOrder: 1, qty: 20 },
    ]);
    // monotonic non-increasing
    for (let i = 1; i < top.length; i++) {
      expect(top[i].qty).toBeLessThanOrEqual(top[i - 1].qty);
    }
  });

  it("defaults n to 8 and never exceeds it", () => {
    expect(topShops(fixture.cells).length).toBeLessThanOrEqual(8);
  });

  it("returns [] for empty input", () => {
    expect(topShops([])).toEqual([]);
  });
});

describe("summary — column reconciliation via UNCHANGED computeColumnTotals", () => {
  it("per-column totals match the fixture (summary.ts does not re-implement them)", () => {
    const totals = computeColumnTotals(fixture.cells);
    for (let printOrder = 1; printOrder <= 20; printOrder++) {
      expect(totals[printOrder] ?? 0, `column ${printOrder}`).toBe(
        fixture.expectedColumnTotals[String(printOrder)],
      );
    }
    const columnSum = Object.values(totals).reduce((a, b) => a + b, 0);
    const shopSum = Object.values(computeShopTotals(fixture.cells)).reduce((a, b) => a + b, 0);
    expect(columnSum).toBe(shopSum); // two aggregation axes reconcile
  });
});
