import { describe, it, expect } from "vitest";
import {
  isPrintOrderAvailable,
  type VariantOrderRow,
} from "../variant-validation";

// G-printorder (validate-contract): printOrder uniqueness enforced over the active,
// non-null variant set (app-level, F2).
describe("printOrder uniqueness (G-printorder)", () => {
  const variants: VariantOrderRow[] = [
    { id: 1, printOrder: 1, active: true },
    { id: 2, printOrder: 2, active: true },
    { id: 3, printOrder: null, active: true }, // off-list — never conflicts
    { id: 4, printOrder: 5, active: false }, // soft-deleted — never conflicts
  ];

  it("should reject a duplicate printOrder within the active non-null variant set", () => {
    expect(isPrintOrderAvailable(2, variants)).toBe(false);
  });

  it("should accept a free printOrder value", () => {
    expect(isPrintOrderAvailable(3, variants)).toBe(true);
  });

  it("does not conflict with off-list (NULL printOrder) variants", () => {
    // Many variants can share printOrder NULL; adding another is always allowed.
    expect(isPrintOrderAvailable(99, variants)).toBe(true);
  });

  it("does not conflict with soft-deleted variants", () => {
    // id 4 holds printOrder 5 but is inactive, so 5 is available.
    expect(isPrintOrderAvailable(5, variants)).toBe(true);
  });

  it("allows an edited variant to keep its own printOrder (excludeId)", () => {
    expect(isPrintOrderAvailable(2, variants, 2)).toBe(true);
  });
});
