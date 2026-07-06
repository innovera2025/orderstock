import { describe, expect, test } from "vitest";
import { sarabunFontFamily } from "../fonts";

// Baseline smoke test — establishes the fully-automated test tier for later phases.
// Asserts a pure, dependency-free value so it never needs the DB or a browser.
describe("vitest baseline", () => {
  test("runs the test runner green", () => {
    expect(1 + 1).toBe(2);
  });

  test("exposes the Sarabun font-family stack", () => {
    expect(sarabunFontFamily).toContain("Sarabun");
    expect(sarabunFontFamily).toContain("sans-serif");
  });
});
