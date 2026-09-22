import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ACTUAL_PRODUCED_EMPTY_TEXT,
  MO_STATUSES,
  deriveMoStatus,
  formatQtyWithUnit,
  moStatusLabel,
  moStatusTone,
  plannedQtyByUnit,
  plannedQuantity,
} from "../production-status";
import { PRODUCTION_SQL_SOURCES } from "../production-sql";

// erp-dashboards Phase 4 — MO status derivation + the SQL drift gate.
//
// Fully-Automated, ZERO DB precondition. Everything here is pure logic or file text.

const ROOT = resolve(__dirname, "../../..");

describe("deriveMoStatus — the 4-branch MO status CASE", () => {
  it("returns ยกเลิก when IsCancel is set, whatever the other flags say", () => {
    expect(deriveMoStatus({ approved: 1, isClosed: 1, isCancel: 1 }).label).toBe("ยกเลิก");
    expect(deriveMoStatus({ isCancel: true }).key).toBe("cancelled");
  });

  it("returns ปิดแล้ว when IsClosed is set and the MO is not cancelled", () => {
    expect(deriveMoStatus({ approved: 1, isClosed: 1, isCancel: 0 }).label).toBe("ปิดแล้ว");
    expect(deriveMoStatus({ approved: 0, isClosed: 1, isCancel: 0 }).key).toBe("closed");
  });

  it("returns อนุมัติแล้ว when Approved is set and the MO is open", () => {
    expect(deriveMoStatus({ approved: 1, isClosed: 0, isCancel: 0 }).label).toBe("อนุมัติแล้ว");
  });

  it("returns รออนุมัติ when nothing is set", () => {
    expect(deriveMoStatus({ approved: 0, isClosed: 0, isCancel: 0 }).label).toBe("รออนุมัติ");
    expect(deriveMoStatus({}).key).toBe("pending");
  });

  // THE edge case the plan calls out: a bare `IsClosed = 0` comparison would drop open MOs.
  it("treats a NULL IsClosed as OPEN (the ISNULL(IsClosed,0) semantics), never as closed", () => {
    expect(deriveMoStatus({ approved: 1, isClosed: null, isCancel: 0 }).key).toBe("approved");
    expect(deriveMoStatus({ approved: 0, isClosed: null, isCancel: null }).key).toBe("pending");
    expect(deriveMoStatus({ approved: null, isClosed: undefined }).key).toBe("pending");
  });

  it("maps every status key to a Thai label and a chip tone", () => {
    expect(MO_STATUSES.map((s) => s.label)).toEqual([
      "รออนุมัติ",
      "อนุมัติแล้ว",
      "ปิดแล้ว",
      "ยกเลิก",
    ]);
    expect(moStatusTone("cancelled")).toBe("danger");
    // An unknown key renders as itself rather than vanishing.
    expect(moStatusLabel("something-new")).toBe("something-new");
    expect(moStatusTone("something-new")).toBe("neutral");
  });
});

describe("plannedQuantity — LotQty is the plan, Prodqty is only its NULL fallback", () => {
  it("uses LotQty when present", () => {
    expect(plannedQuantity({ lotQty: 2207, prodQty: 2207 })).toEqual({
      qty: 2207,
      fromProdqty: false,
    });
  });

  it("falls back to Prodqty when LotQty is NULL (the MO-1 real-data case)", () => {
    expect(plannedQuantity({ lotQty: null, prodQty: 17 })).toEqual({ qty: 17, fromProdqty: true });
  });

  it("returns 0 rather than NaN when both are missing", () => {
    expect(plannedQuantity({})).toEqual({ qty: 0, fromProdqty: false });
  });
});

describe("plannedQtyByUnit — quantities are NEVER summed across units", () => {
  const rows = [
    { unit: "KG", qty: 2207 },
    { unit: "BAG", qty: 120 },
    { unit: "KG", qty: 17 },
    { unit: null, qty: 80 },
    { unit: "BAG", qty: 60 },
  ];

  it("returns one entry PER UNIT, never a single combined number", () => {
    const list = plannedQtyByUnit(rows);
    expect(list.map((x) => x.unit).sort()).toEqual(["-", "BAG", "KG"]);
  });

  it("sums only within a unit", () => {
    const byUnit = new Map(plannedQtyByUnit(rows).map((x) => [x.unit, x.qty]));
    expect(byUnit.get("KG")).toBe(2224);
    expect(byUnit.get("BAG")).toBe(180);
    expect(byUnit.get("-")).toBe(80);
  });

  it("never produces the cross-unit total anywhere in its result", () => {
    const crossUnitTotal = rows.reduce((a, r) => a + r.qty, 0);
    expect(crossUnitTotal).toBe(2484); // the number that must NEVER be shown
    expect(plannedQtyByUnit(rows).map((x) => x.qty)).not.toContain(crossUnitTotal);
  });

  it("always renders a quantity together with its unit", () => {
    expect(formatQtyWithUnit(1352, "กก.")).toBe("1,352 กก.");
  });
});

describe("embedded Production SQL matches db/erp-queries/production/*.sql", () => {
  for (const source of PRODUCTION_SQL_SOURCES) {
    it(`${source.name} is byte-identical to ${source.file}`, () => {
      const onDisk = readFileSync(resolve(ROOT, source.file), "utf8");
      expect(
        source.sql,
        `${source.name} drifted from ${source.file} — re-copy the file text into src/lib/production-sql.ts`,
      ).toBe(onDisk);
    });

    it(`${source.file} is a single read-only statement (SELECT/WITH, no write keyword)`, () => {
      const text = source.sql.replace(/--[^\n]*/g, "");
      expect(/^\s*(select|with)\b/i.test(text.trim())).toBe(true);
      expect(
        /\b(insert|update|delete|merge|truncate|drop|alter|create|exec|into)\b/i.test(text),
      ).toBe(false);
    });

    it(`${source.file} binds filters as named parameters, never concatenated values`, () => {
      expect(/'\s*\+\s*/.test(source.sql)).toBe(false);
      expect(/\$\{/.test(source.sql)).toBe(false);
    });

    it(`${source.file} adds no locking hint (execute-agent instruction E6)`, () => {
      // Comments explain WHY there is no hint; the executable text must carry none.
      expect(/NOLOCK/i.test(source.sql.replace(/--[^\n]*/g, ""))).toBe(false);
    });
  }

  it("mo-list.sql derives status with the SAME precedence as deriveMoStatus()", () => {
    const sql = PRODUCTION_SQL_SOURCES.find((s) => s.file.endsWith("mo-list.sql"))!.sql;
    const order = ["'cancelled'", "'closed'", "'approved'", "'pending'"].map((k) => sql.indexOf(k));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The defensive ISNULL, never a bare `IsClosed = 0` comparison that would drop open MOs.
    expect(/ISNULL\(h\.IsClosed, 0\)/.test(sql)).toBe(true);
  });

  it("mo-list.sql never exposes Prodqty as an actual, and computes no percentage", () => {
    const sql = PRODUCTION_SQL_SOURCES.find((s) => s.file.endsWith("mo-list.sql"))!.sql;
    const code = sql.replace(/--[^\n]*/g, "");
    expect(/AS\s+Actual/i.test(code)).toBe(false);
    expect(/\bPct\b|Percent|achievement/i.test(code)).toBe(false);
    // Prodqty appears ONLY inside the documented COALESCE fallback for a NULL LotQty.
    expect(/COALESCE\(m\.LotQty, m\.Prodqty, 0\) AS PlannedQty/.test(code)).toBe(true);
  });

  it("material-issues.sql filters by the production ReasonName and TRIMs both sides of MONo", () => {
    const sql = PRODUCTION_SQL_SOURCES.find((s) => s.file.endsWith("material-issues.sql"))!.sql;
    expect(sql).toContain("เบิกวัตถุดิบ : ใบสั่งผลิต");
    expect(/LTRIM\(RTRIM\(d\.MONo\)\) = LTRIM\(RTRIM\(@moNumBer\)\)/.test(sql)).toBe(true);
  });

  it("every query joining InventoryItem applies the highest-Roworder-wins tie-break", () => {
    const joiners = PRODUCTION_SQL_SOURCES.filter((s) => /dbo\.InventoryItem/.test(s.sql));
    expect(joiners).toHaveLength(2);
    for (const s of joiners) {
      expect(
        /PARTITION BY ItemCode\s+ORDER BY Roworder DESC/i.test(s.sql),
        `${s.file} joins InventoryItem without the highest-Roworder-wins tie-break`,
      ).toBe(true);
    }
  });

  it("the plan-only empty-state string is a single shared constant", () => {
    expect(ACTUAL_PRODUCED_EMPTY_TEXT).toBe("ยังไม่มีข้อมูลผลิตจริง");
  });
});
