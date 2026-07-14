import { describe, it, expect } from "vitest";
import {
  normalizeLocations,
  addLocation,
  renameLocation,
  removeLocation,
} from "../locations-core";

// Fully-automated gates for location-management (pure transforms only — no DB):
//   AC-transform-1 normalizeLocations — trim/dedupe/drop-empty/preserve-order
//   AC-transform-2 addLocation — append then normalize
//   AC-transform-3 renameLocation — map old→new incl. collision-with-existing
//   AC-transform-4 removeLocation — filter exact match

describe("normalizeLocations — AC-transform-1", () => {
  it("trims each entry", () => {
    expect(normalizeLocations(["  ยิ่งเจริญ  ", " คลอง 2 "])).toEqual(["ยิ่งเจริญ", "คลอง 2"]);
  });

  it("drops empty and whitespace-only entries", () => {
    expect(normalizeLocations(["A", "", "   ", "B"])).toEqual(["A", "B"]);
  });

  it("dedupes exact (case-sensitive) matches, first occurrence wins", () => {
    expect(normalizeLocations(["A", "B", "A", "a"])).toEqual(["A", "B", "a"]);
  });

  it("preserves insertion order", () => {
    expect(normalizeLocations(["C", "A", "B"])).toEqual(["C", "A", "B"]);
  });

  it("treats trim-equal values as duplicates", () => {
    expect(normalizeLocations(["A", " A "])).toEqual(["A"]);
  });
});

describe("addLocation — AC-transform-2", () => {
  it("appends a new trimmed value", () => {
    expect(addLocation(["A"], "  B  ")).toEqual(["A", "B"]);
  });

  it("does not add a duplicate (already present)", () => {
    expect(addLocation(["A", "B"], "A")).toEqual(["A", "B"]);
  });

  it("drops an empty add", () => {
    expect(addLocation(["A"], "   ")).toEqual(["A"]);
  });
});

describe("renameLocation — AC-transform-3", () => {
  it("maps oldName to newName across the list", () => {
    expect(renameLocation(["A", "B", "C"], "B", "Z")).toEqual(["A", "Z", "C"]);
  });

  it("trims the new name", () => {
    expect(renameLocation(["A", "B"], "B", "  Z  ")).toEqual(["A", "Z"]);
  });

  it("collapses to a single entry when renaming into an existing value (collision)", () => {
    // Rename A → B where B already exists: result must not contain a duplicate B.
    expect(renameLocation(["A", "B", "C"], "A", "B")).toEqual(["B", "C"]);
  });

  it("leaves the list unchanged when oldName is absent", () => {
    expect(renameLocation(["A", "B"], "X", "Y")).toEqual(["A", "B"]);
  });

  it("drops the entry when newName is empty/whitespace-only (pure-fn contract)", () => {
    // normalizeLocations drops empty entries, so renaming into "" removes the old entry.
    // The action's zod min(1) guards this path in the UI; this documents the pure contract.
    expect(renameLocation(["A", "B", "C"], "B", "   ")).toEqual(["A", "C"]);
  });
});

describe("removeLocation — AC-transform-4", () => {
  it("removes an exact match", () => {
    expect(removeLocation(["A", "B", "C"], "B")).toEqual(["A", "C"]);
  });

  it("removes all exact matches", () => {
    expect(removeLocation(["A", "B", "A"], "A")).toEqual(["B"]);
  });

  it("is a no-op when the name is absent", () => {
    expect(removeLocation(["A", "B"], "X")).toEqual(["A", "B"]);
  });

  it("does not remove a non-exact (trim-differing) match", () => {
    expect(removeLocation(["A", " A "], "A")).toEqual([" A "]);
  });
});
