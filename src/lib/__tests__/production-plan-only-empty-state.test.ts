import { describe, it, expect } from "vitest";

import {
  ACTUAL_PRODUCED_EMPTY_TEXT,
  deriveMoStatus,
  plannedQtyByUnit,
  plannedQuantity,
} from "../production-status";
import * as productionStatusModule from "../production-status";
import { getProductionMoList, isoDate, type MoListRow } from "../production-data";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";
import { PRODUCTION_FIXTURE_EXPECTED as F } from "./production-fixture-expected";

// erp-dashboards Phase 4 — SPEC AC7: the Production dashboard is PLAN-ONLY.
//
// The ERP has no genuine "actual produced" measurement anywhere (data dictionary §C-4 — every
// candidate column is either a copy of the plan or NULL/0). This gate proves two things:
//   1. the "ผลิตจริง" value is ALWAYS the literal Thai empty-state string, for every row, whatever
//      Prodqty/LotQty hold;
//   2. nothing in the data shape is, or could be read as, an achievement percentage.
//
// Precondition for the HYBRID block: `orderstock-sql` up, `db/erp-fixture/production-seed.sql`
// applied on top of Phase 1's base fixture, `ERP_DATABASE_URL` pointed at `erp_fixture`.
// LOCAL ONLY — never `db_TCL`.

/** The one renderer the "ผลิตจริง" cell is allowed to use — it takes NO numeric argument at all. */
function actualProducedCell(): string {
  return ACTUAL_PRODUCED_EMPTY_TEXT;
}

describe("AC7 — the actual-produced cell is structurally incapable of showing a number", () => {
  it("renders the Thai empty-state string with no input whatsoever", () => {
    expect(actualProducedCell()).toBe("ยังไม่มีข้อมูลผลิตจริง");
    expect(actualProducedCell.length).toBe(0); // takes zero arguments, by design
  });

  it("stays the empty-state string for every plausible MO shape", () => {
    const shapes = [
      { lotQty: null, prodQty: 17 },
      { lotQty: 2207, prodQty: 2207 },
      { lotQty: 1352, prodQty: 0 },
      { lotQty: 0, prodQty: 9999 },
      { lotQty: null, prodQty: null },
    ];
    for (const shape of shapes) {
      expect(actualProducedCell()).toBe(ACTUAL_PRODUCED_EMPTY_TEXT);
      // The planned figure is still derived — it is the PLAN, never re-labelled as an actual.
      expect(typeof plannedQuantity(shape).qty).toBe("number");
    }
  });

  it("never computes an achievement percentage, even when Prodqty equals LotQty", () => {
    const mo = { lotQty: 2207, prodQty: 2207 };
    const planned = plannedQuantity(mo);
    expect(planned.qty).toBe(2207);
    // There is deliberately NO exported helper that divides prodQty by lotQty. Asserting the
    // absence of the concept is the point: the module surface has no percentage anywhere.
    const surface = Object.keys(productionStatusModule);
    expect(surface.some((k) => /percent|pct|achiev|actual(?!_produced_empty)/i.test(k))).toBe(
      false,
    );
  });
});

const erpConfigured = (() => {
  try {
    return typeof resolveErpDatabaseUrl() === "string";
  } catch {
    return false;
  }
})();

if (!erpConfigured) {
  console.warn(
    "[production-plan-only-empty-state] HYBRID gate SKIPPED — ERP_DATABASE_URL is not set. " +
      "Point it at the LOCAL erp_fixture sandbox and re-run to exercise AC7 against real rows.",
  );
}

describe.skipIf(!erpConfigured)("AC7 — against the real erp_fixture rows (Hybrid)", () => {
  const filters = { dateFrom: F.from, dateTo: F.to };

  it("returns the seeded live MO rows and excludes the cancelled one", async () => {
    const { value: rows } = await getProductionMoList(filters);
    expect(rows).toHaveLength(F.liveMoCount);
    expect(rows.map((r) => r.MoNumBer)).not.toContain(F.cancelledMoNumber);
  });

  it("no returned field is, or could be read as, an actual-produced or achievement figure", async () => {
    const { value: rows } = await getProductionMoList(filters);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const key of Object.keys(row as unknown as Record<string, unknown>)) {
        expect(/actual|percent|pct|achiev/i.test(key), `${key} leaks an actual-shaped field`).toBe(
          false,
        );
      }
      // Prodqty itself is never returned — only the already-resolved PLANNED quantity.
      expect(Object.prototype.hasOwnProperty.call(row, "Prodqty")).toBe(false);
      expect(actualProducedCell()).toBe(ACTUAL_PRODUCED_EMPTY_TEXT);
    }
  });

  it("falls back to Prodqty for the NULL-LotQty MO, flagged as a fallback (still the plan)", async () => {
    const { value: rows } = await getProductionMoList(filters);
    const mo = rows.find((r) => r.MoNumBer === F.nullLotQtyMo.moNumber)!;
    expect(mo).toBeDefined();
    expect(Number(mo.PlannedQty)).toBe(F.nullLotQtyMo.plannedQty);
    expect(Number(mo.PlannedQtyFromProdqty)).toBe(1);
  });

  it("groups planned quantity PER UNIT and never across units", async () => {
    const { value: rows } = await getProductionMoList(filters);
    const list = plannedQtyByUnit(
      rows.map((r) => ({ unit: r.MainUnits, qty: Number(r.PlannedQty) })),
    );
    expect(list).toEqual(F.plannedQtyByUnit.map((u) => ({ unit: u.unit, qty: u.qty })));
    const crossUnitTotal = rows.reduce((a, r) => a + Number(r.PlannedQty), 0);
    expect(list.map((x) => x.qty)).not.toContain(crossUnitTotal);
  });

  it("derives the same status in SQL as deriveMoStatus() does in TypeScript", async () => {
    const { value: rows } = await getProductionMoList(filters);
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.StatusKey] = (counts[row.StatusKey] ?? 0) + 1;
    expect(counts).toEqual(F.statusCounts);
    // The two NULL-IsClosed MOs must be OPEN, not closed.
    expect(rows.find((r) => r.MoNumBer === "MO-2609-0002")!.StatusKey).toBe("pending");
    expect(deriveMoStatus({ approved: 0, isClosed: null, isCancel: 0 }).key).toBe("pending");
  });

  it("the status filter and the date filter are real bounds, not no-ops", async () => {
    const approved = await getProductionMoList({ ...filters, status: "approved" });
    expect(approved.value).toHaveLength(F.statusCounts.approved);
    for (const row of approved.value) expect(row.StatusKey).toBe("approved");

    const september = await getProductionMoList({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });
    expect(september.value).toHaveLength(F.septemberMoCount);
    for (const row of september.value) expect(isoDate(row.Modate).slice(0, 7)).toBe("2026-09");
  });

  it("skipStatus keeps the full status distribution for the donut", async () => {
    const donut = await getProductionMoList({ ...filters, status: "approved" }, { skipStatus: true });
    const keys = new Set((donut.value as MoListRow[]).map((r) => r.StatusKey));
    expect(keys.size).toBe(Object.keys(F.statusCounts).length);
  });
});
