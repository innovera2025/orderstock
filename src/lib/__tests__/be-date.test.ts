import { describe, it, expect } from "vitest";
import {
  ceToBeDisplay,
  ceToBeParts,
  toDateInputValue,
  parseDateInputValue,
} from "../be-date";

// Fully-automated gate (validate-contract B1): CE is stored, Buddhist Era is displayed. The scan
// day 13/3/2026 CE must render as 13/3/69 BE (BE year 2569, shown 2-digit "69"). Uses Intl
// `th-TH-u-ca-buddhist` (native `input[type=date]` shows CE only).

describe("be-date — CE↔BE conversion", () => {
  it("renders 13 March 2026 CE as 13/3/69 BE", () => {
    const d = new Date("2026-03-13T00:00:00");
    expect(ceToBeDisplay(d)).toBe("13/3/69");
  });

  it("exposes BE parts (day, month, 2-digit BE year, full BE year)", () => {
    const parts = ceToBeParts(new Date("2026-03-13T00:00:00"));
    expect(parts.day).toBe(13);
    expect(parts.month).toBe(3);
    expect(parts.yearBE).toBe(2569);
    expect(parts.yearBE2).toBe("69");
  });

  it("handles a Buddhist year rollover (1 Jan 2000 CE → 2543 BE)", () => {
    expect(ceToBeDisplay(new Date("2000-01-01T00:00:00"))).toBe("1/1/43");
  });

  it("round-trips a native date-input value (yyyy-mm-dd, CE)", () => {
    const d = new Date("2026-03-13T00:00:00");
    const inputValue = toDateInputValue(d);
    expect(inputValue).toBe("2026-03-13");
    const parsed = parseDateInputValue(inputValue);
    expect(toDateInputValue(parsed)).toBe("2026-03-13");
    expect(ceToBeDisplay(parsed)).toBe("13/3/69");
  });

  it("parseDateInputValue yields a stable local calendar date (no TZ drift)", () => {
    const parsed = parseDateInputValue("2026-03-13");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2); // 0-based March
    expect(parsed.getDate()).toBe(13);
  });
});
