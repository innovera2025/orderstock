import { describe, it, expect } from "vitest";

import { getMaterialIssuesForMo, getProductionMoList, isoDate } from "../production-data";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";
import { PRODUCTION_FIXTURE_EXPECTED as F } from "./production-fixture-expected";

// erp-dashboards Phase 4 — SPEC AC8: an MO drills down into its linked raw-material issues.
//
// The linkage is `InventoryFlowDtl.MONo` string-matched against `tbl_MoHdr.MoNumBer`. There is NO
// foreign key (data dictionary §64), so this gate proves the three cases that matter:
//   1. an MO WITH linked issues returns exactly its own rows;
//   2. an MO with ZERO linked issues returns [] — not an error, not another MO's rows (the common
//      case: 7 detail rows across 218 headers in the real data);
//   3. a whitespace-PADDED MONo still matches, via the TRIM guard in the SQL.
//
// Precondition: `orderstock-sql` up, `db/erp-fixture/production-seed.sql` applied, and
// `ERP_DATABASE_URL` pointed at `erp_fixture`. LOCAL ONLY — never `db_TCL`.

const erpConfigured = (() => {
  try {
    return typeof resolveErpDatabaseUrl() === "string";
  } catch {
    return false;
  }
})();

if (!erpConfigured) {
  console.warn(
    "[production-material-issue-drilldown] HYBRID gate SKIPPED — ERP_DATABASE_URL is not set. " +
      "Point it at the LOCAL erp_fixture sandbox and re-run to exercise AC8.",
  );
}

describe.skipIf(!erpConfigured)("AC8 — MO to raw-material-issue drilldown (Hybrid)", () => {
  it("returns every linked issue line for an MO that has them", async () => {
    const { value: rows } = await getMaterialIssuesForMo(F.nullLotQtyMo.moNumber);
    expect(rows).toHaveLength(F.nullLotQtyMo.materialIssueLines);
    for (const row of rows) {
      expect(String(row.MONo).trim()).toBe(F.nullLotQtyMo.moNumber);
      expect(row.ItemCode).toBeTruthy();
      expect(isoDate(row.TransactionDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("returns an EMPTY ARRAY — not an error — for an MO with zero linked issues", async () => {
    const { value: rows } = await getMaterialIssuesForMo(F.zeroIssueMo);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(0);
  });

  it("matches a WHITESPACE-PADDED MONo via the TRIM guard", async () => {
    const { value: rows } = await getMaterialIssuesForMo(F.paddedMonoMo.moNumber);
    expect(rows).toHaveLength(F.paddedMonoMo.materialIssueLines);
    // The stored values really are padded — this is the regression the guard exists for.
    expect(rows.some((r) => String(r.MONo) !== String(r.MONo).trim())).toBe(true);
    // A padded ARGUMENT must match too, not just a padded stored value.
    const padded = await getMaterialIssuesForMo(`  ${F.paddedMonoMo.moNumber} `);
    expect(padded.value).toHaveLength(F.paddedMonoMo.materialIssueLines);
  });

  it("excludes rows carrying a different ReasonName for the same MO", async () => {
    const { value: rows } = await getMaterialIssuesForMo(F.nullLotQtyMo.moNumber);
    // The fixture seeds a 'ปรับปรุงสต๊อคออก' row with the same MONo and Qty 999.
    expect(rows.some((r) => Number(r.Qty) === 999)).toBe(false);
  });

  it("keeps a line whose ItemCode is absent from InventoryItem (defensive LEFT JOIN)", async () => {
    const { value: rows } = await getMaterialIssuesForMo(F.nullLotQtyMo.moNumber);
    const orphan = rows.find((r) => r.ItemCode.startsWith("RM-9"));
    expect(orphan, "an orphan ItemCode row must not be dropped by the join").toBeDefined();
    expect(orphan!.ItemName).toBe(orphan!.ItemCode); // falls back to the raw code
    expect(orphan!.MainUnits).toBe("-");
  });

  it("an unknown MO number returns [] rather than throwing", async () => {
    const { value: rows } = await getMaterialIssuesForMo("MO-DOES-NOT-EXIST");
    expect(rows).toHaveLength(0);
  });

  it("the MO list's issue-line count agrees with the drilldown for every row", async () => {
    const { value: mos } = await getProductionMoList({ dateFrom: F.from, dateTo: F.to });
    const withIssues = mos.filter((m) => Number(m.IssueLineCount) > 0);
    expect(withIssues).toHaveLength(F.moWithIssueCount);
    for (const mo of mos) {
      const { value: issues } = await getMaterialIssuesForMo(mo.MoNumBer);
      expect(issues.length, `${mo.MoNumBer} count mismatch`).toBe(Number(mo.IssueLineCount));
    }
  });
});
