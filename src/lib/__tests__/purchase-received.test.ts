import { describe, it, expect } from "vitest";

import {
  computeOutstanding,
  quantitiesByUnit,
  formatQtyWithUnit,
  type PoQuantityLine,
} from "../purchase-calc";

// erp-dashboards Phase 3 — AC6-received gate. Fully-Automated, ZERO DB precondition.
//
// Received quantity comes from the ERP's OWN "PO ค้างรับ" report logic (`sp_Popending`), which this
// phase reproduces verbatim in `db/erp-queries/purchase/po-received.sql`. This file tests what
// happens to those numbers AFTER they come back: the subtraction, and the per-unit grouping.

describe("computeOutstanding", () => {
  it("returns ordered − received for a partially received line", () => {
    expect(computeOutstanding(100, 40)).toBe(60);
  });

  it("returns 0 for a fully received line", () => {
    expect(computeOutstanding(400, 400)).toBe(0);
  });

  it("returns the full ordered quantity when nothing has been received", () => {
    expect(computeOutstanding(25, 0)).toBe(25);
  });

  it("returns a NEGATIVE outstanding value for an over-received line, not clamped to 0", () => {
    // An over-receipt is real warehouse data. Clamping it to 0 would make a genuine discrepancy
    // invisible — the UI leads with "รับเกิน 10" and keeps the raw −10 visible after it.
    expect(computeOutstanding(50, 60)).toBe(-10);
    expect(computeOutstanding(0, 5)).toBe(-5);
  });

  it("treats a missing/NaN receipt (no matching InventoryFlow row) as zero received", () => {
    // `po-received.sql` simply returns no row for a PO line with no receipt — the join is a LEFT
    // lookup in TS, so `undefined`/NaN must degrade to 0, never to NaN on screen.
    expect(computeOutstanding(12, Number.NaN)).toBe(12);
    expect(computeOutstanding(Number.NaN, 3)).toBe(-3);
  });
});

describe("quantitiesByUnit — never sums across different MainUnits", () => {
  const LINES: PoQuantityLine[] = [
    { unit: "กก.", orderedQty: 400, receivedQty: 400 },
    { unit: "ถุง", orderedQty: 100, receivedQty: 0 },
    { unit: "กก.", orderedQty: 50, receivedQty: 60 },
    { unit: "กล่อง", orderedQty: 4, receivedQty: 2 },
  ];

  it("returns one entry per unit and never a single combined number", () => {
    const totals = quantitiesByUnit(LINES);
    expect(totals.map((t) => t.unit).sort()).toEqual(["กก.", "กล่อง", "ถุง"]);
    // The return type is a per-unit list, so a cross-unit total is structurally impossible.
    expect(Array.isArray(totals)).toBe(true);
  });

  it("sums ordered/received within a unit and carries a negative outstanding through", () => {
    const totals = quantitiesByUnit(LINES);
    const kg = totals.find((t) => t.unit === "กก.")!;
    expect(kg.ordered).toBe(450);
    expect(kg.received).toBe(460);
    expect(kg.outstanding).toBe(-10); // over-received in aggregate, still not clamped

    const bag = totals.find((t) => t.unit === "ถุง")!;
    expect(bag.outstanding).toBe(100);
  });

  it("buckets a blank/missing unit under '-' instead of merging it into another unit", () => {
    const totals = quantitiesByUnit([
      { unit: "", orderedQty: 5, receivedQty: 1 },
      { unit: "   ", orderedQty: 5, receivedQty: 1 },
      { unit: "กก.", orderedQty: 5, receivedQty: 1 },
    ]);
    expect(totals).toHaveLength(2);
    expect(totals.find((t) => t.unit === "-")!.ordered).toBe(10);
    expect(totals.find((t) => t.unit === "กก.")!.ordered).toBe(5);
  });

  it("is deterministic — input order never changes output order", () => {
    const a = quantitiesByUnit(LINES).map((t) => t.unit);
    const b = quantitiesByUnit([...LINES].reverse()).map((t) => t.unit);
    expect(a).toEqual(b);
  });

  it("returns an empty list for an empty PO rather than a zero total", () => {
    expect(quantitiesByUnit([])).toEqual([]);
  });
});

describe("formatQtyWithUnit", () => {
  it("always prints the unit alongside the number", () => {
    expect(formatQtyWithUnit(400, "กก.")).toBe("400 กก.");
    expect(formatQtyWithUnit(1234.5, "ถุง")).toBe("1,234.5 ถุง");
  });

  it("prints a bare number only when the unit is genuinely unknown", () => {
    expect(formatQtyWithUnit(7, "")).toBe("7");
    expect(formatQtyWithUnit(7, "-")).toBe("7");
  });
});
