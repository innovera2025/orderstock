import { describe, it, expect, vi } from "vitest";
import {
  cascadeShopNameCorrection,
  cascadeVariantNameCorrection,
  type CascadeDb,
} from "../correction-cascade";

function makeDb(): CascadeDb {
  return {
    backfillShopNameSnapshots: vi.fn(async () => 3),
    backfillVariantNameSnapshots: vi.fn(async () => 2),
  };
}

// G-cascade (validate-contract): correction-cascade back-fills snapshots only while
// needsConfirmation === true, and locks after confirm (decision 6).
describe("correction cascade (G-cascade)", () => {
  it("should back-fill snapshots only while needsConfirmation=true and lock after confirm", async () => {
    const db = makeDb();

    // Unconfirmed (needsConfirmation was true) → propagates.
    const propagated = await cascadeShopNameCorrection(db, 10, "เจ๊เปียก", true);
    expect(propagated.propagated).toBe(true);
    expect(propagated.updatedRows).toBe(3);
    expect(db.backfillShopNameSnapshots).toHaveBeenCalledWith(10, "เจ๊เปียก");

    // Confirmed (needsConfirmation was false) → locked, no back-fill.
    const locked = await cascadeShopNameCorrection(db, 10, "เจ๊เปียกใหม่", false);
    expect(locked.propagated).toBe(false);
    expect(locked.updatedRows).toBe(0);
    // Still only the one propagating call happened.
    expect(db.backfillShopNameSnapshots).toHaveBeenCalledTimes(1);
  });

  it("applies the same propagate-then-lock semantics to variant-name corrections", async () => {
    const db = makeDb();

    const propagated = await cascadeVariantNameCorrection(db, 7, "ดีลานนิ่ม 1 กก.", true);
    expect(propagated.propagated).toBe(true);
    expect(propagated.updatedRows).toBe(2);

    const locked = await cascadeVariantNameCorrection(db, 7, "ดีลานนิ่ม (แก้)", false);
    expect(locked.propagated).toBe(false);
    expect(locked.updatedRows).toBe(0);
    expect(db.backfillVariantNameSnapshots).toHaveBeenCalledTimes(1);
  });
});
