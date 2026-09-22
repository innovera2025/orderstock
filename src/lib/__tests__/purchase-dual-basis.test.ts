import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_PURCHASE_PERIOD,
  NO_SUPPLIER_CODE,
  PURCHASE_PERIODS,
  aggregateSupplierBreakdown,
  binScopeNote,
  defaultPurchaseDateRange,
  formatMoney,
  inPurchaseBin,
  purchaseTimeBins,
  resolveDateParam,
  resolvePurchasePeriod,
  type SupplierAggregateInput,
} from "../purchase-calc";
import { PURCHASE_SQL_SOURCES } from "../purchase-sql";

// erp-dashboards Phase 3 — AC5 (dual-basis) + AC-sql-drift gates. Fully-Automated, ZERO DB
// precondition. Everything here is a pure transform or a file-content assertion.

const ROOT = resolve(__dirname, "../../..");

// ---------------------------------------------------------------------------------------------
// AC5 — supplier breakdown over BOTH money bases.
// ---------------------------------------------------------------------------------------------

describe("aggregateSupplierBreakdown", () => {
  /** The seeded fixture's shape: 2 suppliers, PO basis 727,920, invoice basis 461,140. */
  const FIXTURE_ROWS: SupplierAggregateInput[] = [
    { supplierCode: "ช-001", poAmount: 444000, poCount: 1 },
    { supplierCode: "ช-001", poAmount: 191000, poCount: 1 },
    { supplierCode: "ว-001", poAmount: 62920, poCount: 1 },
    { supplierCode: "ว-001", poAmount: 30000, poCount: 1 },
    { supplierCode: "ช-001", invoiceAmount: 444000, invoiceCount: 1 },
    { supplierCode: "ช-001", invoiceAmount: 4640, invoiceCount: 1 },
    { supplierCode: "ว-001", invoiceAmount: 6500, invoiceCount: 1 },
    { supplierCode: "ว-001", invoiceAmount: 6000, invoiceCount: 1 },
  ];

  it("aggregates both bases per supplier and reconciles to the documented totals", () => {
    const rows = aggregateSupplierBreakdown(FIXTURE_ROWS);
    expect(rows).toHaveLength(2);

    const cho = rows.find((r) => r.supplierCode === "ช-001")!;
    expect(cho.poAmount).toBe(635000);
    expect(cho.invoiceAmount).toBe(448640);
    expect(cho.poCount).toBe(2);

    const wo = rows.find((r) => r.supplierCode === "ว-001")!;
    expect(wo.poAmount).toBe(92920);
    expect(wo.invoiceAmount).toBe(12500);

    // The two bases are BOTH fully counted; each sums to its own documented total.
    expect(rows.reduce((a, r) => a + r.poAmount, 0)).toBe(727920);
    expect(rows.reduce((a, r) => a + r.invoiceAmount, 0)).toBe(461140);
  });

  it("groups on SupplierCode, never on a name, and keeps the code verbatim as the label", () => {
    const rows = aggregateSupplierBreakdown([
      { supplierCode: "ช-001", poAmount: 1 },
      { supplierCode: " ช-001 ", poAmount: 1 }, // whitespace-padded code is the SAME supplier
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].supplierCode).toBe("ช-001");
  });

  it("buckets a NULL/blank SupplierCode under '-' instead of dropping the money", () => {
    const rows = aggregateSupplierBreakdown([
      { supplierCode: null, poAmount: 500 },
      { supplierCode: "", poAmount: 250 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].supplierCode).toBe(NO_SUPPLIER_CODE);
    expect(rows[0].poAmount).toBe(750);
  });

  it("sorts deterministically: PO amount desc, then invoice amount desc, then SupplierCode ASC", () => {
    const tied: SupplierAggregateInput[] = [
      { supplierCode: "ค-003", poAmount: 100, invoiceAmount: 10 },
      { supplierCode: "ก-001", poAmount: 100, invoiceAmount: 10 },
      { supplierCode: "ข-002", poAmount: 100, invoiceAmount: 10 },
      { supplierCode: "ง-004", poAmount: 900, invoiceAmount: 0 },
    ];
    const order = aggregateSupplierBreakdown(tied).map((r) => r.supplierCode);
    expect(order).toEqual(["ง-004", "ก-001", "ข-002", "ค-003"]);

    // Input order never changes output order.
    const reversed = aggregateSupplierBreakdown([...tied].reverse()).map((r) => r.supplierCode);
    expect(reversed).toEqual(order);
  });

  it("breaks an exact PO-amount tie by invoice amount before falling back to the code", () => {
    const rows = aggregateSupplierBreakdown([
      { supplierCode: "ก-001", poAmount: 100, invoiceAmount: 5 },
      { supplierCode: "ข-002", poAmount: 100, invoiceAmount: 50 },
    ]);
    expect(rows.map((r) => r.supplierCode)).toEqual(["ข-002", "ก-001"]);
  });

  it("returns an empty list for no rows rather than a single zero row", () => {
    expect(aggregateSupplierBreakdown([])).toEqual([]);
  });

  it("keeps a supplier that has invoices but no purchase order at all", () => {
    // A purchase invoice can exist with no PO (petty cash) — that supplier still belongs on the chart.
    const rows = aggregateSupplierBreakdown([
      { supplierCode: "ก-001", poAmount: 1000, poCount: 1 },
      { supplierCode: "ข-002", invoiceAmount: 6500, invoiceCount: 1 },
    ]);
    expect(rows.map((r) => r.supplierCode)).toEqual(["ก-001", "ข-002"]);
    expect(rows.find((r) => r.supplierCode === "ข-002")!.poCount).toBe(0);
  });
});

describe("formatMoney", () => {
  it("always prints บาท — the dashboard never shows a bare number as money", () => {
    expect(formatMoney(461140)).toBe("461,140.00 บาท");
    expect(formatMoney(0)).toBe("0.00 บาท");
  });
});

// ---------------------------------------------------------------------------------------------
// Period bins (the "ยอดซื้อตามช่วงเวลา" chart axis).
// ---------------------------------------------------------------------------------------------

describe("purchaseTimeBins", () => {
  it("defaults to เดือน — the granularity the ERP's own purchase report uses", () => {
    expect(DEFAULT_PURCHASE_PERIOD).toBe("month");
    expect(resolvePurchasePeriod(undefined)).toBe("month");
    expect(resolvePurchasePeriod("nonsense")).toBe("month");
    expect(resolvePurchasePeriod("week")).toBe("week");
    expect(resolvePurchasePeriod(["year"])).toBe("year");
    expect(PURCHASE_PERIODS.map((p) => p.key)).toEqual(["week", "month", "year"]);
  });

  it("tiles a two-month range into two month bins, clipped to the range", () => {
    const bins = purchaseTimeBins("2026-08-01", "2026-09-30", "month");
    expect(bins.map((b) => b.key)).toEqual(["2026-08", "2026-09"]);
    expect(bins[0].from).toBe("2026-08-01");
    expect(bins[1].to).toBe("2026-09-30");
    expect(bins[0].label).toContain("2569"); // BE year, never CE
  });

  it("clips the first and last bin so no bin claims days outside the selection", () => {
    const bins = purchaseTimeBins("2026-08-14", "2026-09-11", "month");
    expect(bins[0].from).toBe("2026-08-14");
    expect(bins[bins.length - 1].to).toBe("2026-09-11");
  });

  it("produces year bins and week bins aligned to the range start", () => {
    expect(purchaseTimeBins("2026-01-01", "2027-12-31", "year").map((b) => b.key)).toEqual([
      "2026",
      "2027",
    ]);
    const weeks = purchaseTimeBins("2026-08-01", "2026-08-21", "week");
    expect(weeks.map((b) => b.from)).toEqual(["2026-08-01", "2026-08-08", "2026-08-15"]);
    expect(weeks[weeks.length - 1].to).toBe("2026-08-21");
  });

  it("returns no bins for an inverted or empty range rather than throwing", () => {
    expect(purchaseTimeBins("2026-09-30", "2026-08-01", "month")).toEqual([]);
    expect(purchaseTimeBins("", "", "month")).toEqual([]);
  });

  it("warns out loud when the whole range collapses into a single bin", () => {
    const one = purchaseTimeBins("2026-08-01", "2026-08-20", "month");
    expect(one).toHaveLength(1);
    expect(binScopeNote(one, "month", "2026-08-01", "2026-08-20")).toContain("ยังไม่ใช่ยอดเต็ม");

    const two = purchaseTimeBins("2026-08-01", "2026-09-30", "month");
    expect(binScopeNote(two, "month", "2026-08-01", "2026-09-30")).toBe("");
  });

  it("matches dates inclusively on both bin ends, and never matches a blank date", () => {
    const bin = { from: "2026-08-01", to: "2026-08-31" };
    expect(inPurchaseBin(bin, "2026-08-01")).toBe(true);
    expect(inPurchaseBin(bin, "2026-08-31")).toBe(true);
    expect(inPurchaseBin(bin, "2026-09-01")).toBe(false);
    expect(inPurchaseBin(bin, "")).toBe(false);
  });
});

describe("date-range params", () => {
  it("defaults to the last 90 days ending today", () => {
    const range = defaultPurchaseDateRange(new Date(2026, 8, 22));
    expect(range.to).toBe("2026-09-22");
    expect(range.from).toBe("2026-06-24");
  });

  it("accepts only a well-formed CE yyyy-mm-dd and otherwise falls back", () => {
    expect(resolveDateParam("2026-08-01", "x")).toBe("2026-08-01");
    expect(resolveDateParam(["2026-08-02"], "x")).toBe("2026-08-02");
    expect(resolveDateParam("01/08/2026", "fallback")).toBe("fallback");
    expect(resolveDateParam(undefined, "fallback")).toBe("fallback");
  });
});

// ---------------------------------------------------------------------------------------------
// AC-sql-drift — the embedded constants must stay identical to the versioned .sql files.
//
// Mirrors `sales-basis-reconciliation.test.ts`'s equivalent block. This is an INFRASTRUCTURE gate,
// not a data gate: `next.config.ts` sets `output: "standalone"` and the production Dockerfile's
// COPY list excludes `db/`, so a runtime file read would work in dev and 500 only in the container.
// Embedding removes that failure mode; this block removes the drift it would otherwise allow.
// ---------------------------------------------------------------------------------------------

describe("embedded Purchase SQL matches db/erp-queries/purchase/*.sql", () => {
  it("covers all 6 versioned query files", () => {
    expect(PURCHASE_SQL_SOURCES).toHaveLength(6);
  });

  for (const source of PURCHASE_SQL_SOURCES) {
    it(`${source.name} is byte-identical to ${source.file}`, () => {
      const onDisk = readFileSync(resolve(ROOT, source.file), "utf8");
      expect(
        source.sql,
        `${source.name} drifted from ${source.file} — re-copy the file text into src/lib/purchase-sql.ts`,
      ).toBe(onDisk);
    });

    it(`${source.file} is a single read-only statement (SELECT/WITH, no write keyword)`, () => {
      const text = source.sql.replace(/--[^\n]*/g, "");
      expect(/^\s*(select|with)\b/i.test(text)).toBe(true);
      expect(
        /\b(insert|update|delete|merge|truncate|drop|alter|create|exec|into|grant|revoke)\b/i.test(
          text,
        ),
      ).toBe(false);
      // A single statement: no mid-statement `;`.
      expect(text.replace(/;\s*$/, "").includes(";")).toBe(false);
    });

    it(`${source.file} binds filters as named parameters, never concatenated values`, () => {
      // The only way a value enters these statements is an @param placeholder.
      expect(/'\s*\+\s*/.test(source.sql)).toBe(false);
      expect(/\$\{/.test(source.sql)).toBe(false);
    });
  }

  it("total-invoice-basis.sql reproduces KRS's own sp_PurchaseInvoiceMonth filter verbatim", () => {
    const invoice = PURCHASE_SQL_SOURCES.find((s) => s.file.endsWith("total-invoice-basis.sql"))!;
    const body = invoice.sql.replace(/--[^\n]*/g, "");
    expect(/DocuType\s*=\s*'PC'/i.test(body)).toBe(true);
    expect(/PurchaseType\s*=\s*'Invoice'/i.test(body)).toBe(true);
    expect(/VoucherNo\s+NOT\s+LIKE\s+'PC%'/i.test(body)).toBe(true);
    expect(/IsClosed\s*=\s*0/i.test(body)).toBe(true);
  });

  it("po-received.sql keeps the sp_Popending filter LITERAL — Approved, bare IsClosed <> 1, IPC%", () => {
    // Execute-agent instruction E3 + the 22-09-26 INNOVATE decision: reproduce the ERP's own report
    // logic exactly, including where it is lossy. A NULL IsClosed makes `IsClosed <> 1` UNKNOWN, so
    // that receipt is silently excluded — real ERP behaviour, asserted here so nobody "fixes" it.
    const received = PURCHASE_SQL_SOURCES.find((s) => s.file.endsWith("po-received.sql"))!;
    const body = received.sql.replace(/--[^\n]*/g, "");
    expect(/\bh\.Approved\s*=\s*1/i.test(body)).toBe(true);
    expect(/\bh\.IsApproved\b/i.test(body)).toBe(false); // NOT the sibling column
    expect(/\bh\.IsClosed\s*<>\s*1/i.test(body)).toBe(true);
    expect(/ISNULL\s*\(\s*h\.IsClosed/i.test(body)).toBe(false); // deliberately NOT NULL-safe
    expect(/VoucherNo\s+LIKE\s+'IPC%'/i.test(body)).toBe(true);
    expect(/\bd\.PoNo\b/i.test(body)).toBe(true); // the direct column, not the 3-hop chain
  });

  it("po-list.sql returns the raw status flags and derives no status in SQL", () => {
    const list = PURCHASE_SQL_SOURCES.find((s) => s.file.endsWith("po-list.sql"))!;
    const body = list.sql.replace(/--[^\n]*/g, "");
    for (const flag of ["IsCancel", "IsClosed", "IsComplete", "IsRecPo", "IsApproved", "IsCheck"]) {
      expect(new RegExp(`\\b${flag}\\b`).test(body), `${flag} missing from po-list.sql`).toBe(true);
    }
    // Status derivation lives in purchase-calc.ts, in ONE testable place — never as a SQL CASE.
    expect(/\bCASE\b/i.test(body)).toBe(false);
  });

  it("po-list.sql and po-lines.sql use the PVL-corrected real column names", () => {
    // Comment-stripped: the header comments deliberately NAME the wrong columns in order to
    // explain why they are wrong, so a raw-text scan would match them.
    const strip = (s: string) => s.replace(/--[^\n]*/g, "");
    const list = strip(PURCHASE_SQL_SOURCES.find((s) => s.file.endsWith("po-list.sql"))!.sql);
    const lines = strip(PURCHASE_SQL_SOURCES.find((s) => s.file.endsWith("po-lines.sql"))!.sql);
    expect(/h\.PODate\s+AS\s+VoucherDate/i.test(list)).toBe(true);
    expect(/d\.MainQuantity\s+AS\s+Qty/i.test(lines)).toBe(true);
    expect(/d\.MainUnitPrice\s+AS\s+UnitPrice/i.test(lines)).toBe(true);
    expect(/d\.TotalPrice\s+AS\s+Amount/i.test(lines)).toBe(true);
    expect(/ORDER BY[^;]*d\.Number/i.test(lines)).toBe(true);
    expect(/\bSlno\b/i.test(lines)).toBe(false); // belongs to tbl_PoAmend, not PurchaseOrderDtl
  });

  it("every Purchase query groups/filters suppliers on the CODE, never on a name column", () => {
    for (const source of PURCHASE_SQL_SOURCES) {
      expect(
        /SupplierName/i.test(source.sql.replace(/--[^\n]*/g, "")),
        `${source.file} references a supplier NAME — codes are the only reliable identity`,
      ).toBe(false);
    }
  });
});
