import { describe, it, expect } from "vitest";
import { mergeSnapshots, type ExistingLineSnapshot, type IncomingCell } from "../order-save";

// Fully-automated gate (validate-contract C1b): the save path deletes-and-recreates order lines,
// but MUST preserve the historical name snapshot for cells that already existed (Phase-02
// correction-cascade lock guarantee). A NAIVE re-derive-from-live-names implementation would
// rewrite history and FAIL this test. `mergeSnapshots` is the pure carry-forward-vs-fresh
// decision, unit-testable without a DB (mirrors the CascadeDb extract-pure-logic pattern).

describe("mergeSnapshots — carry forward existing snapshots, fresh only for new cells", () => {
  it("returns OldName for a pre-existing cell and live NewName only for a brand-new cell", () => {
    // Existing sheet line: shop 1 × variant 1, snapshotted as "OldShop" / "OldVariant".
    const existing: ExistingLineSnapshot[] = [
      {
        shopId: 1,
        variantId: 1,
        shopNameAtEntry: "OldShop",
        variantNameAtEntry: "OldVariant",
      },
    ];

    // Incoming save: the SAME pre-existing cell (still present) + a brand-new cell (shop 2 × var 1).
    const incoming: IncomingCell[] = [
      { shopId: 1, variantId: 1, qty: 5 },
      { shopId: 2, variantId: 1, qty: 3 },
    ];

    // Live names — shop 1 was RENAMED to "NewShop" after the original entry (still needsConfirmation).
    const liveShopNames = new Map<number, string>([
      [1, "NewShop"],
      [2, "BrandNewShop"],
    ]);
    const liveVariantNames = new Map<number, string>([[1, "NewVariant"]]);

    const merged = mergeSnapshots(existing, incoming, {
      shopNames: liveShopNames,
      variantNames: liveVariantNames,
    });

    const preExisting = merged.find((m) => m.shopId === 1 && m.variantId === 1)!;
    const brandNew = merged.find((m) => m.shopId === 2 && m.variantId === 1)!;

    // Pre-existing cell: snapshot text is CARRIED FORWARD (not re-derived from the live rename).
    expect(preExisting.shopNameAtEntry).toBe("OldShop");
    expect(preExisting.variantNameAtEntry).toBe("OldVariant");
    expect(preExisting.qty).toBe(5);

    // Brand-new cell: FRESH snapshot from the live names.
    expect(brandNew.shopNameAtEntry).toBe("BrandNewShop");
    expect(brandNew.variantNameAtEntry).toBe("NewVariant");
    expect(brandNew.qty).toBe(3);
  });

  it("carries forward every matched cell and never leaks a live-name rewrite", () => {
    const existing: ExistingLineSnapshot[] = [
      { shopId: 10, variantId: 4, shopNameAtEntry: "ร้านเดิม", variantNameAtEntry: "ของเดิม" },
    ];
    const incoming: IncomingCell[] = [{ shopId: 10, variantId: 4, qty: 2 }];
    const merged = mergeSnapshots(existing, incoming, {
      shopNames: new Map([[10, "ร้านใหม่"]]),
      variantNames: new Map([[4, "ของใหม่"]]),
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].shopNameAtEntry).toBe("ร้านเดิม");
    expect(merged[0].variantNameAtEntry).toBe("ของเดิม");
  });

  it("falls back to empty string when a live name is missing for a new cell (never undefined)", () => {
    const merged = mergeSnapshots([], [{ shopId: 9, variantId: 9, qty: 1 }], {
      shopNames: new Map(),
      variantNames: new Map(),
    });
    expect(merged[0].shopNameAtEntry).toBe("");
    expect(merged[0].variantNameAtEntry).toBe("");
  });
});
