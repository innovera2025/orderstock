import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildOrderPayload } from "../order-payload";

// E1 (Phase 02) — the pure payload builder is the byte-identical bridge between the new
// order-matrix UI state and the UNCHANGED saveOrderSheet action. It must emit exactly:
//   cell:{shopId}:{variantId} = trimmed qty   ONLY when Number.isInteger(qty) && qty > 0
//   note:{shopId}             = RAW text       ONLY when text.trim() !== ""
// Verified against the canonical 13/3/69 fixture (grand total 446, 51 cells).

interface Fixture {
  cells: { rosterOrder: number; printOrder: number; qty: number }[];
  noteLines: { rosterOrder: number; text: string; qty: number | null }[];
  expectedGrandTotal: number;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

function toEntryMap(entries: { name: string; value: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of entries) m.set(e.name, e.value);
  return m;
}

describe("buildOrderPayload — 13/3/69 fixture (446)", () => {
  // Build matrix-shaped state from the fixture: keys `${shopId}:${variantId}` == `${roster}:${print}`.
  const cells: Record<string, string> = {};
  for (const c of fixture.cells) cells[`${c.rosterOrder}:${c.printOrder}`] = String(c.qty);
  const notes: Record<number, string> = {};
  for (const n of fixture.noteLines) notes[n.rosterOrder] = n.text;

  const entries = buildOrderPayload(cells, notes);
  const cellEntries = entries.filter((e) => e.name.startsWith("cell:"));
  const noteEntries = entries.filter((e) => e.name.startsWith("note:"));

  it("emits exactly one cell entry per fixture cell (51)", () => {
    expect(cellEntries).toHaveLength(fixture.cells.length);
  });

  it("emits cell:{shopId}:{variantId} = qty for every fixture cell", () => {
    const map = toEntryMap(cellEntries);
    for (const c of fixture.cells) {
      expect(map.get(`cell:${c.rosterOrder}:${c.printOrder}`)).toBe(String(c.qty));
    }
  });

  it("cell quantities sum to the grand total 446", () => {
    const sum = cellEntries.reduce((s, e) => s + Number(e.value), 0);
    expect(sum).toBe(fixture.expectedGrandTotal);
    expect(sum).toBe(446);
  });

  it("emits note:{shopId} = raw text for every non-empty fixture note", () => {
    const nonEmpty = fixture.noteLines.filter((n) => n.text.trim() !== "");
    expect(noteEntries).toHaveLength(nonEmpty.length);
    const map = toEntryMap(noteEntries);
    for (const n of nonEmpty) {
      expect(map.get(`note:${n.rosterOrder}`)).toBe(n.text);
    }
  });
});

describe("buildOrderPayload — gating rules", () => {
  it("emits a cell only for integer qty > 0, value = trimmed", () => {
    const entries = buildOrderPayload(
      {
        "1:1": "  4 ", // -> "4"
        "1:2": "0", // omit
        "1:3": "", // omit
        "1:4": "2.5", // omit (non-integer)
        "1:5": "-3", // omit (<=0)
        "1:6": "   ", // omit (blank)
        "1:7": "12", // "12"
      },
      {},
    );
    const map = toEntryMap(entries);
    expect(map.get("cell:1:1")).toBe("4");
    expect(map.get("cell:1:7")).toBe("12");
    expect(entries.filter((e) => e.name.startsWith("cell:"))).toHaveLength(2);
  });

  it("emits a note only when trimmed text is non-empty, value = RAW (untrimmed) text", () => {
    const entries = buildOrderPayload(
      {},
      {
        5: "  keep me ", // raw preserved
        6: "   ", // omit
        7: "", // omit
      },
    );
    const map = toEntryMap(entries);
    expect(map.get("note:5")).toBe("  keep me ");
    expect(entries.filter((e) => e.name.startsWith("note:"))).toHaveLength(1);
  });
});
