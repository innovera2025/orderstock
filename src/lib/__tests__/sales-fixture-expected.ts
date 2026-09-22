// erp-dashboards Phase 2 — the LOCAL `erp_fixture` Sales seed's declared truth.
//
// Shared by both Sales Hybrid gates. Lives in its own module (not inside a `.test.ts` file) so
// importing it never re-executes another suite's `describe` blocks. Not collected by vitest —
// `vitest.config.ts` includes only `*.test.ts` / `*.test.tsx`.
//
// These numbers mirror `db/erp-fixture/sales-seed.sql`'s generated rows. LOCAL SANDBOX ONLY.
export const SALES_FIXTURE_EXPECTED = {
  from: "2026-08-01",
  to: "2026-09-30",
  doCount: 14,
  lineCount: 31,
  pricedLineCount: 6,
  /** header TotalAmount sum === detail Amount sum, exactly (AC3). */
  total: 10111,
  excludedInvoiceCount: 3,
  /** The SAME figure the live ERP carries, so the footnote gate asserts a real number. */
  excludedInvoiceTotal: 858937.21,
} as const;
