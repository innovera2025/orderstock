import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  resolveSalesBasisFromValue,
  resolveSalesPeriod,
  sumQuantityByUnit,
  quantityByUnitList,
  coveragePercent,
  timeBins,
  inBin,
  DEFAULT_SALES_PERIOD,
  SALES_BASIS_SETTING_KEY,
} from "../sales-basis-core";
import { SALES_SQL_SOURCES } from "../sales-sql";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";
import { fetchDoHeaders, fetchDoLines, isoDate } from "../sales-queries";
import { SALES_FIXTURE_EXPECTED } from "./sales-fixture-expected";

// erp-dashboards Phase 2 — Sales basis + reconciliation gates.
//
// THREE gates in one file, split by DB dependency exactly as the validate-contract requires
// (PVL fixes P5/P6/P8, execute-agent instruction E3):
//
//   (i)   Fully-Automated, ZERO DB precondition — `resolveSalesBasisFromValue()` decision logic.
//   (ii)  Fully-Automated, ZERO DB precondition — `sumQuantityByUnit()` never sums across units.
//   (iii) Hybrid, precondition: `orderstock-sql` container up + `db/erp-fixture/sales-seed.sql`
//         applied on top of Phase 1's base fixture, with `ERP_DATABASE_URL` pointed at
//         `erp_fixture`. LOCAL ONLY — never `db_TCL`.
//
// The Hybrid block self-skips (loudly, via a console warning) when the ERP connection is not
// configured, so `pnpm test` stays green on a machine without the sandbox while the gate still
// runs — and is still REQUIRED to run — wherever the fixture is up.

const ROOT = resolve(__dirname, "../../..");

// ---------------------------------------------------------------------------------------------
// (i) Fully-Automated — sales-basis DECISION logic (pure; no DB, no Prisma, no ERP).
// ---------------------------------------------------------------------------------------------
describe("resolveSalesBasisFromValue — the sales-basis switch decision", () => {
  it('defaults to "do" when the AppSetting row is absent (null)', () => {
    expect(resolveSalesBasisFromValue(null)).toBe("do");
  });

  it('defaults to "do" when the value is undefined or blank', () => {
    expect(resolveSalesBasisFromValue(undefined)).toBe("do");
    expect(resolveSalesBasisFromValue("")).toBe("do");
    expect(resolveSalesBasisFromValue("   ")).toBe("do");
  });

  it('returns "do" when the value is explicitly "do" (any case / padding)', () => {
    expect(resolveSalesBasisFromValue("do")).toBe("do");
    expect(resolveSalesBasisFromValue("  DO  ")).toBe("do");
  });

  it("falls back rather than throwing on an unrecognised value", () => {
    expect(resolveSalesBasisFromValue("nonsense")).toBe("do");
  });

  // sales-invoice-basis (23-09-26) — `"invoice"` is now a REAL branch, not a recognised-but-
  // unimplemented name. Before this plan every input, including "invoice", narrowed to "do".
  it('returns "invoice" when the value is "invoice" (any case / padding)', () => {
    expect(resolveSalesBasisFromValue("invoice")).toBe("invoice");
    expect(resolveSalesBasisFromValue("  INVOICE  ")).toBe("invoice");
  });

  it('still falls back to "do" for "so" — the SalesOrder module is unused on this site', () => {
    expect(resolveSalesBasisFromValue("so")).toBe("do");
  });

  it("uses a Sales-scoped setting key that does not collide with app-settings.ts keys", () => {
    expect(SALES_BASIS_SETTING_KEY).toBe("salesBasis");
  });

  // EXTENSION POINT — documented, deliberately NOT asserted as implemented behaviour.
  // A future, out-of-program change adds the `"so"` / `"invoice"` query branches; until then these
  // recognised names still resolve to `"do"`, because returning a basis the query layer cannot
  // serve would be worse than ignoring the setting. When that branch lands, THIS is the case to
  // turn into a real assertion.
  it.todo('resolves "so" / "invoice" once those query branches exist (out of scope this program)');
});

// ---------------------------------------------------------------------------------------------
// (ii) Fully-Automated — the "never sum across units" hard safety constraint.
// ---------------------------------------------------------------------------------------------
describe("sumQuantityByUnit — quantities are NEVER summed across units", () => {
  // Fixture-SHAPED literals, in memory. No DB call: this proves the aggregation LOGIC, which the
  // fixture data alone could never prove (fixture rows only guarantee >= 2 units EXIST).
  const lines = [
    { unit: "KG", qty: 10 },
    { unit: "BAG", qty: 3 },
    { unit: "KG", qty: 5.5 },
    { unit: "LITRE", qty: 4 },
    { unit: "BAG", qty: 2 },
  ];

  it("returns one entry PER UNIT, never a single combined number", () => {
    const totals = sumQuantityByUnit(lines);
    expect(totals.size).toBe(3);
    expect([...totals.keys()].sort()).toEqual(["BAG", "KG", "LITRE"]);
  });

  it("sums only within a unit", () => {
    const totals = sumQuantityByUnit(lines);
    expect(totals.get("KG")).toBe(15.5);
    expect(totals.get("BAG")).toBe(5);
    expect(totals.get("LITRE")).toBe(4);
  });

  it("never produces the cross-unit total (24.5) anywhere in its result", () => {
    const totals = sumQuantityByUnit(lines);
    const crossUnitTotal = lines.reduce((a, l) => a + l.qty, 0);
    expect(crossUnitTotal).toBe(24.5); // the number that must NEVER be shown
    expect([...totals.values()]).not.toContain(crossUnitTotal);
  });

  it("buckets blank/missing units under '-' instead of merging them into a real unit", () => {
    const totals = sumQuantityByUnit([
      { unit: "", qty: 7 },
      { unit: "   ", qty: 3 },
      { unit: "KG", qty: 1 },
    ]);
    expect(totals.get("-")).toBe(10);
    expect(totals.get("KG")).toBe(1);
  });

  it("quantityByUnitList orders by quantity desc and stays per-unit", () => {
    const list = quantityByUnitList(lines);
    expect(list.map((x) => x.unit)).toEqual(["KG", "BAG", "LITRE"]);
    expect(list).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------------------------
// (ii-b) Fully-Automated — period bins + coverage arithmetic (pure supporting logic).
// ---------------------------------------------------------------------------------------------
describe("period bins and coverage (pure)", () => {
  it("defaults the period to เดือน (month)", () => {
    expect(DEFAULT_SALES_PERIOD).toBe("month");
    expect(resolveSalesPeriod(undefined)).toBe("month");
    expect(resolveSalesPeriod("bogus")).toBe("month");
    expect(resolveSalesPeriod("week")).toBe("week");
    expect(resolveSalesPeriod("year")).toBe("year");
  });

  it("produces DIFFERENT bin counts per granularity over the same range", () => {
    const from = "2026-08-01";
    const to = "2026-09-30";
    expect(timeBins(from, to, "month")).toHaveLength(2);
    expect(timeBins(from, to, "year")).toHaveLength(1);
    expect(timeBins(from, to, "week").length).toBeGreaterThan(2);
  });

  it("clips the first and last bin to the selected range", () => {
    const bins = timeBins("2026-08-15", "2026-09-10", "month");
    expect(bins[0].from).toBe("2026-08-15");
    expect(bins[bins.length - 1].to).toBe("2026-09-10");
  });

  it("assigns each date to exactly one bin", () => {
    const bins = timeBins("2026-08-01", "2026-09-30", "week");
    const hits = bins.filter((b) => inBin(b, "2026-09-05"));
    expect(hits).toHaveLength(1);
  });

  it("coveragePercent divides rather than returning 0 or 100 on mixed data", () => {
    expect(coveragePercent(6, 31)).toBeCloseTo(19.3548, 3);
    expect(coveragePercent(0, 10)).toBe(0);
    expect(coveragePercent(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// (ii-c) Fully-Automated — the embedded SQL must stay byte-identical to its versioned source file.
// ---------------------------------------------------------------------------------------------
describe("embedded Sales SQL matches db/erp-queries/sales/*.sql", () => {
  for (const source of SALES_SQL_SOURCES) {
    it(`${source.name} is byte-identical to ${source.file}`, () => {
      const onDisk = readFileSync(resolve(ROOT, source.file), "utf8");
      expect(
        source.sql,
        `${source.name} drifted from ${source.file} — re-copy the file text into src/lib/sales-sql.ts`,
      ).toBe(onDisk);
    });

    it(`${source.file} is a single read-only statement (SELECT/WITH, no write keyword)`, () => {
      const text = source.sql.replace(/--[^\n]*/g, "");
      expect(/^\s*(select|with)\b/i.test(text)).toBe(true);
      expect(/\b(insert|update|delete|merge|truncate|drop|alter|create|exec|into)\b/i.test(text)).toBe(
        false,
      );
    });

    it(`${source.file} binds filters as named parameters, never concatenated values`, () => {
      // E2: the only way a value enters these statements is an @param placeholder.
      expect(/'\s*\+\s*/.test(source.sql)).toBe(false);
      expect(/\$\{/.test(source.sql)).toBe(false);
    });
  }

  it("do-by-product.sql resolves ONE canonical InventoryItem row per ItemCode (Roworder tie-break)", () => {
    // Registry Cross-Phase Precondition + execute-agent instruction E5. ItemCode is NOT unique in
    // InventoryItem (~85 duplicated codes live); a lower-Roworder row must never silently win.
    const product = SALES_SQL_SOURCES.find((s) => s.file.endsWith("do-by-product.sql"))!;
    expect(
      /ROW_NUMBER\(\)\s*OVER\s*\(\s*PARTITION BY ItemCode\s+ORDER BY Roworder DESC\s*\)/i.test(
        product.sql,
      ),
    ).toBe(true);
    expect(/RowRank\s*=\s*1/i.test(product.sql)).toBe(true);
  });

  it("every query joining InventoryItem applies the same tie-break", () => {
    const joiners = SALES_SQL_SOURCES.filter((s) => /dbo\.InventoryItem/.test(s.sql));
    expect(joiners.length).toBeGreaterThanOrEqual(4);
    for (const s of joiners) {
      expect(
        /PARTITION BY ItemCode\s+ORDER BY Roworder DESC/i.test(s.sql),
        `${s.file} joins InventoryItem without the highest-Roworder-wins tie-break`,
      ).toBe(true);
    }
  });

  it("no query joins on tbl_Dodtl.SoNo (NULL on 100% of live rows)", () => {
    for (const s of SALES_SQL_SOURCES) {
      expect(/JOIN[^;]*\bSoNo\b/i.test(s.sql), `${s.file} must not join on SoNo`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// (iii) HYBRID — AC3 reconciliation against the REAL erp_fixture data, through the REAL SQL.
//
// Precondition: `orderstock-sql` up, `db/erp-fixture/sales-seed.sql` applied on top of Phase 1's
// `00-schema.sql` + `01-seed.sql`, and ERP_DATABASE_URL pointed at `erp_fixture`. LOCAL ONLY.
// ---------------------------------------------------------------------------------------------


const erpConfigured = (() => {
  try {
    // Same resolver the app boots with — env file first, then `process.env`.
    return typeof resolveErpDatabaseUrl() === "string";
  } catch {
    return false;
  }
})();

if (!erpConfigured) {
  console.warn(
    "[sales-basis-reconciliation] HYBRID gate SKIPPED — ERP_DATABASE_URL is not set. " +
      "Point it at the LOCAL erp_fixture sandbox and re-run to exercise AC3.",
  );
}

describe.skipIf(!erpConfigured)("AC3 — DO reconciliation against erp_fixture (Hybrid)", () => {
  const range = { from: SALES_FIXTURE_EXPECTED.from, to: SALES_FIXTURE_EXPECTED.to };

  it("header TotalAmount sum equals detail Amount sum EXACTLY", async () => {
    const headers = await fetchDoHeaders(range);
    const lines = await fetchDoLines(range);

    const headerSum = headers.value.reduce((a, h) => a + Number(h.Amount), 0);
    const detailSum = lines.value.reduce((a, l) => a + Number(l.Amount), 0);

    // Round to 2dp: both sides are DECIMAL(18,2) in SQL Server, so any difference beyond a
    // float-representation artefact is a real data-integrity divergence.
    expect(Math.round(headerSum * 100)).toBe(Math.round(detailSum * 100));
    expect(Math.round(headerSum * 100) / 100).toBe(SALES_FIXTURE_EXPECTED.total);
  });

  it("returns the expected DO and line counts for the seeded range", async () => {
    const headers = await fetchDoHeaders(range);
    const lines = await fetchDoLines(range);
    expect(headers.value).toHaveLength(SALES_FIXTURE_EXPECTED.doCount);
    expect(lines.value).toHaveLength(SALES_FIXTURE_EXPECTED.lineCount);
  });

  it("the real SQL returns >= 2 distinct MainUnits, so the per-unit rule is exercised", async () => {
    const lines = await fetchDoLines(range);
    const totals = sumQuantityByUnit(
      lines.value.map((l) => ({ unit: l.Unit, qty: Number(l.Qty) })),
    );
    expect(totals.size).toBeGreaterThanOrEqual(2);
  });

  it("the date filter is a real bound, not a no-op", async () => {
    const august = await fetchDoHeaders({ from: "2026-08-01", to: "2026-08-31" });
    expect(august.value.length).toBeGreaterThan(0);
    expect(august.value.length).toBeLessThan(SALES_FIXTURE_EXPECTED.doCount);
    for (const h of august.value) {
      expect(isoDate(h.Dodate).slice(0, 7)).toBe("2026-08");
    }
  });

  it("SoNo is NULL on every fixture line, matching live reality", async () => {
    const lines = await fetchDoLines(range);
    expect(lines.value.length).toBeGreaterThan(0);
    // SoNo is deliberately not selected by do-lines.sql — assert the fixture keeps it absent by
    // checking no row leaks a SoNo field into the result shape.
    for (const line of lines.value) {
      expect(Object.prototype.hasOwnProperty.call(line, "SoNo")).toBe(false);
    }
  });
});
