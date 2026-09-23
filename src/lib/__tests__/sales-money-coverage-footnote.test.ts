import { describe, it, expect } from "vitest";

import {
  coveragePercent,
  formatMoney,
  formatPercent,
  reconciliationNote,
} from "../sales-basis-core";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";
import { fetchDoLines, fetchExcludedInvoiceTotal } from "../sales-queries";
import { SALES_FIXTURE_EXPECTED } from "./sales-fixture-expected";

// erp-dashboards Phase 2 — AC4 (numeric half): money coverage % + the excluded-total footnote
// figure, both computed from the REAL `erp_fixture` rows through the REAL SQL via `guardedQuery()`.
//
// HYBRID — precondition: `orderstock-sql` container up, `db/erp-fixture/sales-seed.sql` applied on
// top of Phase 1's base fixture, `ERP_DATABASE_URL` pointed at `erp_fixture`. LOCAL ONLY, never
// `db_TCL`. (PVL fix P6 reclassified this file from Fully-Automated to Hybrid: it executes SQL.)
//
// The WORDING/PLACEMENT half of AC4 is the separate Agent-Probe gate — a visual scan confirming
// the footnote names the excluded figure directly under the money tile.

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
    "[sales-money-coverage-footnote] HYBRID gate SKIPPED — ERP_DATABASE_URL is not set. " +
      "Point it at the LOCAL erp_fixture sandbox and re-run to exercise AC4's numeric half.",
  );
}

// ---------------------------------------------------------------------------------------------
// Fully-Automated half of the footnote: the wording must NAME the amount.
// ---------------------------------------------------------------------------------------------
describe("reconciliationNote wording (pure)", () => {
  it("names the excluded amount explicitly — never a vague 'some data is excluded'", () => {
    const note = reconciliationNote(3, 858937.21);
    expect(note).toContain("858,937.21");
    expect(note).toContain("บาท");
    expect(note).toContain("SalesInvoiceHdr");
    expect(note).toContain("3 ใบ");
    expect(note).not.toMatch(/ข้อมูลบางส่วน/);
  });

  it("states WHY the amount is excluded, not just that it is", () => {
    expect(reconciliationNote(3, 858937.21)).toContain("ยังไม่ใช่ฐานข้อมูลที่ใช้ในแดชบอร์ดนี้");
  });
});

// ---------------------------------------------------------------------------------------------
// HYBRID — the numbers themselves, from the fixture.
// ---------------------------------------------------------------------------------------------
describe.skipIf(!erpConfigured)("AC4 numeric half — coverage % and excluded total (Hybrid)", () => {
  const range = { from: SALES_FIXTURE_EXPECTED.from, to: SALES_FIXTURE_EXPECTED.to };

  it("coverage % divides priced lines by all lines (neither 0% nor 100%)", async () => {
    const lines = await fetchDoLines(range);
    const priced = lines.value.filter((l) => Number(l.Saleprice) !== 0);

    expect(lines.value).toHaveLength(SALES_FIXTURE_EXPECTED.lineCount);
    expect(priced).toHaveLength(SALES_FIXTURE_EXPECTED.pricedLineCount);

    const coverage = coveragePercent(priced.length, lines.value.length);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThan(100);
    expect(formatPercent(coverage)).toBe(SALES_FIXTURE_EXPECTED.coverageLabel);
  });

  it("the priced-only money total counts ONLY priced lines", async () => {
    const lines = await fetchDoLines(range);
    const priced = lines.value.filter((l) => Number(l.Saleprice) !== 0);
    const pricedTotal = priced.reduce((a, l) => a + Number(l.Amount), 0);
    const allTotal = lines.value.reduce((a, l) => a + Number(l.Amount), 0);

    // Unpriced lines carry Amount 0, so the two agree here — the point of the assertion is that
    // the priced subset is what the money tile is built from, and it is non-empty.
    expect(priced.length).toBeGreaterThan(0);
    expect(Math.round(pricedTotal * 100) / 100).toBe(SALES_FIXTURE_EXPECTED.total);
    expect(Math.round(allTotal * 100) / 100).toBe(SALES_FIXTURE_EXPECTED.total);
  });

  it("the excluded SalesInvoiceHdr pool returns a real, nonzero, correctly-labelled figure", async () => {
    const excluded = await fetchExcludedInvoiceTotal();
    const row = excluded.value[0];

    expect(row).toBeTruthy();
    expect(Number(row.InvoiceCount)).toBe(SALES_FIXTURE_EXPECTED.excludedInvoiceCount);
    expect(Math.round(Number(row.ExcludedTotal) * 100) / 100).toBe(
      SALES_FIXTURE_EXPECTED.excludedInvoiceTotal,
    );
  });

  it("the excluded pool is LARGER than the dashboard's own total — the reason the footnote exists", async () => {
    const excluded = await fetchExcludedInvoiceTotal();
    expect(Number(excluded.value[0].ExcludedTotal)).toBeGreaterThan(SALES_FIXTURE_EXPECTED.total);
  });

  it("the rendered footnote for the fixture names the excluded ฿858,937.21 figure", async () => {
    const excluded = await fetchExcludedInvoiceTotal();
    const row = excluded.value[0];
    const note = reconciliationNote(Number(row.InvoiceCount), Number(row.ExcludedTotal));
    expect(note).toContain(formatMoney(SALES_FIXTURE_EXPECTED.excludedInvoiceTotal));
  });
});
