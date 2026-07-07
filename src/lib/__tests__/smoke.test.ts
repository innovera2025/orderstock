import { describe, expect, test } from "vitest";

// Baseline smoke test — establishes the fully-automated test tier for later phases.
// Asserts a pure, dependency-free value so it never needs the DB or a browser.
//
// Note (Phase 01): the former Sarabun font-family assertion was removed with the font swap.
// The type system is now IBM Plex via next/font/google (src/lib/fonts.ts), which imports
// `next/font` and therefore cannot be evaluated in a plain vitest/node context — font wiring
// is proven by the build gate + agent-probe, not a unit test.
describe("vitest baseline", () => {
  test("runs the test runner green", () => {
    expect(1 + 1).toBe(2);
  });
});
