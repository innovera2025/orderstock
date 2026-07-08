import { describe, it, expect } from "vitest";
import { PRINT_VARIANTS, variantDisplayName } from "../product-order";

// Phase 05 rename gate (validate-contract A2): the two ด/ต-ambiguous bases are aligned to
// their canonical intended reading — ดีลานนิ่ม→ตีลานนิ่ม (printOrder 2,3) and ดีลาน→ตีลาน
// (printOrder 4,5). This is display-only: printOrder / column / group / packSize / labelVariant
// are unchanged, and printOrder 1 (ดีนิ่ม A) is deliberately NOT touched.

function displayAt(printOrder: number): string {
  const v = PRINT_VARIANTS.find((pv) => pv.printOrder === printOrder);
  if (!v) throw new Error(`no PRINT_VARIANT at printOrder ${printOrder}`);
  return variantDisplayName(v.productName, v.packSize, v.labelVariant);
}

describe("product-order — ตีลานนิ่ม/ตีลาน display rename", () => {
  it("printOrder 2 renders ตีลานนิ่ม 1 กก.", () => {
    expect(displayAt(2)).toBe("ตีลานนิ่ม 1 กก.");
  });

  it("printOrder 3 renders ตีลานนิ่ม 1/2 กก.", () => {
    expect(displayAt(3)).toBe("ตีลานนิ่ม 1/2 กก.");
  });

  it("printOrder 4 renders ตีลาน 1 กก.", () => {
    expect(displayAt(4)).toBe("ตีลาน 1 กก.");
  });

  it("printOrder 5 renders ตีลาน 1/2 กก.", () => {
    expect(displayAt(5)).toBe("ตีลาน 1/2 กก.");
  });

  it("printOrder 1 (ดีนิ่ม A) is NOT renamed", () => {
    const v = PRINT_VARIANTS.find((pv) => pv.printOrder === 1)!;
    expect(v.productName).toBe("ดีนิ่ม A");
  });

  it("no legacy ดีลานนิ่ม/ดีลาน base names remain in the in-order variants", () => {
    const legacy = PRINT_VARIANTS.filter(
      (v) => v.productName === "ดีลานนิ่ม" || v.productName === "ดีลาน",
    );
    expect(legacy).toHaveLength(0);
  });
});
