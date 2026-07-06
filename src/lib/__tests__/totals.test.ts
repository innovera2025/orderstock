import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeColumnTotals,
  computeGrandTotal,
  computeTotalWeight,
  type OrderLineCell,
} from "../totals";

// Fully-automated gate (validate-contract A3): the 13/3/69 scan day recreated from the shared
// fixture must produce EVERY per-column total and grand total == 446, and NoteLine qty must be
// EXCLUDED (type-level: computeGrandTotal only accepts OrderLineCell[]). This is the definitional
// proof gate for Phase 04.

interface Fixture {
  cells: OrderLineCell[];
  expectedColumnTotals: Record<string, number>;
  expectedGrandTotal: number;
  noteLines: { rosterOrder: number; text: string; qty: number | null }[];
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

describe("totals engine — 13/3/69 gate fixture", () => {
  it("computes ALL 20 per-column totals matching the scan", () => {
    const totals = computeColumnTotals(fixture.cells);
    for (let printOrder = 1; printOrder <= 20; printOrder++) {
      const expected = fixture.expectedColumnTotals[String(printOrder)];
      expect(totals[printOrder] ?? 0, `column ${printOrder} total`).toBe(expected);
    }
  });

  it("computes grand total == 446", () => {
    expect(computeGrandTotal(fixture.cells)).toBe(446);
    expect(computeGrandTotal(fixture.cells)).toBe(fixture.expectedGrandTotal);
  });

  it("EXCLUDES NoteLine qty from the grand total (446 is grid-only)", () => {
    // The fixture's notes carry qty 1 (r9) and 20 (r16) — these must NOT be in 446.
    const noteQtySum = fixture.noteLines.reduce((sum, n) => sum + (n.qty ?? 0), 0);
    expect(noteQtySum).toBe(21); // 1 + 20 — proves the notes carry qty that could pollute the total
    // computeGrandTotal takes OrderLineCell[] only; there is no way to pass notes in.
    expect(computeGrandTotal(fixture.cells)).toBe(446);
    expect(computeGrandTotal(fixture.cells)).not.toBe(446 + noteQtySum);
  });

  it("column totals sum to the grand total", () => {
    const totals = computeColumnTotals(fixture.cells);
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    expect(sum).toBe(446);
  });
});

describe("totals engine — total weight (math shape; factors are a known-gap until Q22)", () => {
  it("sums qty × weightKg over cells using an injected factor map", () => {
    const cells: OrderLineCell[] = [
      { rosterOrder: 1, printOrder: 1, qty: 3 },
      { rosterOrder: 1, printOrder: 2, qty: 2 },
      { rosterOrder: 2, printOrder: 1, qty: 5 },
    ];
    // Fabricated factors (real weightKg is null in the DB — known-gap): p1=1.5kg, p2=0.5kg.
    const weightByPrintOrder: Record<number, number> = { 1: 1.5, 2: 0.5 };
    // (3+5)*1.5 + 2*0.5 = 12 + 1 = 13
    expect(computeTotalWeight(cells, weightByPrintOrder)).toBeCloseTo(13, 6);
  });

  it("treats missing factors as zero weight (does not throw)", () => {
    const cells: OrderLineCell[] = [{ rosterOrder: 1, printOrder: 9, qty: 4 }];
    expect(computeTotalWeight(cells, {})).toBe(0);
  });
});
