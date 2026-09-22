import { describe, expect, it } from "vitest";
import {
  PLOT_HEIGHT,
  barHeightPx,
  computeBarScale,
  niceTicks,
  yAxisWidth,
} from "../sales-chart-scale";

// REGRESSION GATE — the period charts once rendered every bar as a 2px stub (a CSS percentage
// height against an auto-height parent). These tests assert the geometry itself, in pixels, so a
// flat chart fails here instead of shipping with green tests and no visible bars.

describe("barHeightPx — proportionality", () => {
  it("maps the axis max to the full plot height", () => {
    expect(barHeightPx(10, 10, 200)).toBe(200);
    expect(barHeightPx(7, 7)).toBe(PLOT_HEIGHT);
  });

  it("maps half the axis max to half the plot height", () => {
    expect(barHeightPx(5, 10, 200)).toBe(100);
    expect(barHeightPx(3, 12, 160)).toBe(40);
  });

  it("maps zero to zero height", () => {
    expect(barHeightPx(0, 10, 200)).toBe(0);
  });

  it("never returns a negative height or overflows the plot", () => {
    expect(barHeightPx(-5, 10, 200)).toBe(0);
    expect(barHeightPx(999, 10, 200)).toBe(200);
  });

  it("is degenerate-safe when the axis max is zero or not finite", () => {
    expect(barHeightPx(5, 0, 200)).toBe(0);
    expect(barHeightPx(Number.NaN, 10, 200)).toBe(0);
  });

  it("is monotonic: a larger value is never a shorter bar", () => {
    const heights = [0, 1, 2, 3, 7, 9].map((v) => barHeightPx(v, 9, 180));
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
  });
});

describe("niceTicks", () => {
  it("starts at zero, ascends, and ends at or above the series max", () => {
    const ticks = niceTicks(7, 4, true);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(7);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it("keeps integer series on whole-number steps", () => {
    for (const t of niceTicks(3, 4, true)) expect(Number.isInteger(t)).toBe(true);
  });

  it("handles large money maxima", () => {
    const ticks = niceTicks(7787, 4, false);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(7787);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
  });

  it("returns a single zero tick for an empty/zero series", () => {
    expect(niceTicks(0)).toEqual([0]);
  });
});

describe("computeBarScale", () => {
  it("gives the tallest bar a substantial share of the plot and a zero bin no height", () => {
    // The real fixture series that rendered flat: 0 / 0 / 7 / 7 documents per month.
    const { top, heights } = computeBarScale([0, 0, 7, 7], { integer: true });
    expect(top).toBeGreaterThanOrEqual(7);
    expect(heights[0]).toBe(0);
    expect(heights[1]).toBe(0);
    expect(heights[2]).toBe(heights[3]);
    expect(heights[2]).toBeGreaterThan(PLOT_HEIGHT * 0.5);
    expect(heights[2]).toBeLessThanOrEqual(PLOT_HEIGHT);
  });

  it("scales the money series proportionally", () => {
    const { top, heights } = computeBarScale([0, 0, 2324, 7787]);
    expect(heights[3]).toBeGreaterThan(heights[2]);
    expect(heights[2]).toBe(Math.round((2324 / top) * PLOT_HEIGHT));
    expect(heights[0]).toBe(0);
  });

  it("reports an all-zero series as top = 0 so the caller can render the empty state", () => {
    expect(computeBarScale([0, 0]).top).toBe(0);
    expect(computeBarScale([]).top).toBe(0);
  });
});

describe("yAxisWidth", () => {
  it("never drops below the minimum gutter and grows with the widest label", () => {
    expect(yAxisWidth(["0", "2"])).toBe(44);
    expect(yAxisWidth(["0", "2,000,000"])).toBeGreaterThan(44);
  });
});
