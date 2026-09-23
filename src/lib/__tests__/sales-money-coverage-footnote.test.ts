import { describe, it, expect } from "vitest";

import {
  coveragePercent,
  formatPercent,
  deliveryCoverageNote,
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
// UPDATED (sales-invoice-basis, 23-09-26): the footnote under the DELIVERY money tile no longer
// describes the SalesInvoiceHdr pool as excluded — that pool is now the dashboard's PRIMARY figure.
// The delivery tile's own standing caveat (most delivery lines carry no price) replaced it, and the
// cross-reference to the delivery section lives on the invoice tile instead. The underlying
// `fetchExcludedInvoiceTotal()` numbers below are UNCHANGED and still asserted — that query was
// kept (as the unfiltered whole-pool variant) and still feeds the live-reconcile script.

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
describe("deliveryCoverageNote wording (pure)", () => {
  it("names the priced/total line counts explicitly — never a vague 'some lines are unpriced'", () => {
    const note = deliveryCoverageNote(13, 1623);
    expect(note).toContain("13");
    expect(note).toContain("1,623");
    expect(note).toContain("รายการ");
    expect(note).not.toMatch(/ข้อมูลบางส่วน/);
  });

  it("does NOT use excluded framing near the invoice pool — invoice money is now PRIMARY", () => {
    const note = deliveryCoverageNote(13, 1623);
    expect(note).not.toContain("SalesInvoiceHdr");
    expect(note).not.toContain("ไม่ถูกนับรวม");
    expect(note).not.toContain("ยังไม่ใช่ฐานข้อมูลที่ใช้ในแดชบอร์ดนี้");
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

  it("the whole-pool SalesInvoiceHdr total returns a real, nonzero, correctly-labelled figure", async () => {
    const excluded = await fetchExcludedInvoiceTotal();
    const row = excluded.value[0];

    expect(row).toBeTruthy();
    expect(Number(row.InvoiceCount)).toBe(SALES_FIXTURE_EXPECTED.excludedInvoiceCount);
    expect(Math.round(Number(row.ExcludedTotal) * 100) / 100).toBe(
      SALES_FIXTURE_EXPECTED.excludedInvoiceTotal,
    );
  });

  it("the invoice pool is LARGER than the delivery basis's total — why invoices became primary", async () => {
    const excluded = await fetchExcludedInvoiceTotal();
    expect(Number(excluded.value[0].ExcludedTotal)).toBeGreaterThan(SALES_FIXTURE_EXPECTED.total);
  });
});
