// sales-invoice-basis (23-09-26) — the INVOICE-basis read layer.
//
// Two tiers, deliberately separated:
//
//   (i)  Fully-Automated, ZERO precondition — the five wrappers' degrade contract, proven with a
//        mocked ERP. No database, no Docker, so this half can never be skipped into uselessness.
//   (ii) Hybrid — the REAL SQL executed against the LOCAL `erp_fixture` sandbox, which is the only
//        way to prove the statements parse, that every column they name exists, and that the
//        NULL-`Amount` line (the live DO-2608-0007 case, mirrored in the fixture seed) is summed
//        as 0 WITHOUT being dropped from the line count.
//
// `db_TCL` IS NEVER CONTACTED. `ERP_DATABASE_URL` must point at the local `erp_fixture` database.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";
// STATIC import = the REAL module, bound before any `vi.doMock` below can take effect. The Hybrid
// block must never accidentally read the mocked ERP the Fully-Automated block installs.
import {
  fetchInvoiceHeaders,
  fetchInvoiceLines,
  fetchInvoiceByProduct,
  fetchInvoiceByCustomer,
  fetchInvoiceDateRange,
} from "../sales-queries";

// ---------------------------------------------------------------------------------------------
// (i) Fully-Automated — degrade + cache-key contract, with the ERP mocked.
// ---------------------------------------------------------------------------------------------

describe("invoice fetch wrappers — success and ERP-down degrade (mocked ERP)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock("../erp/pool");
    vi.doUnmock("../erp/erp-adapter");
    vi.resetModules();
  });

  // The TTL cache is module-level and survives `vi.resetModules()`, so every test below uses its
  // OWN date range — a distinct cache key — rather than fighting the module registry.
  let seq = 0;
  const freshRange = () => ({ from: `20${10 + seq++}-01-01`, to: "2030-12-31" });

  /** Load `sales-queries` with `guardedQuery` swapped for a stub. */
  async function withErp(impl: () => unknown[]) {
    const calls: Array<{ sql: string; params: Record<string, unknown> }> = [];
    vi.doMock("../erp/pool", () => ({ getErpPool: async () => ({}) }));
    vi.doMock("../erp/erp-adapter", () => ({
      guardedQuery: async (_pool: unknown, sql: string, params: Record<string, unknown>) => {
        calls.push({ sql, params });
        return impl();
      },
    }));
    const mod = await import("../sales-queries");
    return { mod, calls };
  }

  it("returns typed rows on the success path", async () => {
    const range = freshRange();
    const row = { InvoiceNo: "SI-1", Amount: 100, LineCount: 2, LineAmount: 100 };
    const { mod } = await withErp(() => [row]);
    const got = await mod.fetchInvoiceHeaders(range);
    expect(got.stale).toBe(false);
    expect(got.value).toEqual([row]);
  });

  it("serves last-known-good with stale:true when the ERP goes down — never throws", async () => {
    const range = freshRange();
    let up = true;
    const { mod } = await withErp(() => {
      if (!up) throw new Error("ERP down");
      return [{ InvoiceNo: "SI-1", Amount: 100 }];
    });

    const warm = await mod.fetchInvoiceHeaders(range);
    expect(warm.stale).toBe(false);

    up = false;
    // Step past the 5-minute TTL so the next read actually goes live and fails — otherwise the
    // fresh entry short-circuits and the outage would never be exercised (the same trap Phase 5's
    // force-down toggle exists to avoid).
    const realNow = Date.now.bind(Date);
    const clock = vi.spyOn(Date, "now").mockImplementation(() => realNow() + 10 * 60_000);
    const degraded = await mod.fetchInvoiceHeaders(range);
    clock.mockRestore();
    // The EXACT same contract the fetchDo* wrappers honour: cached value, flagged stale.
    expect(degraded.stale).toBe(true);
    expect(degraded.value).toEqual(warm.value);
  });

  it("re-throws on a COLD cache so the page can render its Thai unavailable state", async () => {
    const { mod } = await withErp(() => {
      throw new Error("ERP down");
    });
    // Nothing has ever been cached for this key — there is no last-known-good to serve.
    await expect(mod.fetchInvoiceLines({ from: "1999-01-01", to: "1999-12-31" })).rejects.toThrow();
  });

  it("binds the invoice parameter set — no doNo, no status, no skipStatus", async () => {
    const range = freshRange();
    const { mod, calls } = await withErp(() => []);
    await mod.fetchInvoiceHeaders({ ...range, invoiceNo: "SI-2569-0001", doNo: "DO-1", status: "closed" });
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0].params).sort()).toEqual([
      "cat", "customer", "from", "invoiceNo", "product", "skipCat", "to",
    ]);
    expect(calls[0].params.invoiceNo).toBe("SI-2569-0001");
  });

  it("each wrapper uses its own cache key, so results can never cross over", async () => {
    const range = freshRange();
    let n = 0;
    const { mod } = await withErp(() => [{ n: ++n }]);
    const a = await mod.fetchInvoiceHeaders(range);
    const b = await mod.fetchInvoiceLines(range);
    const c = await mod.fetchInvoiceByProduct(range);
    const d = await mod.fetchInvoiceByCustomer(range);
    // Four distinct keys => four distinct live reads, not one cached answer served four times.
    expect([a.value, b.value, c.value, d.value]).toEqual([[{ n: 1 }], [{ n: 2 }], [{ n: 3 }], [{ n: 4 }]]);
  });
});

// ---------------------------------------------------------------------------------------------
// (ii) Hybrid — the REAL SQL against the LOCAL erp_fixture sandbox.
//
// Precondition: `orderstock-sql` container up, `erp_fixture` seeded with 00-schema.sql +
// 01-seed.sql + sales-seed.sql, ERP_DATABASE_URL pointed at `erp_fixture`. LOCAL ONLY.
// ---------------------------------------------------------------------------------------------

const erpConfigured = (() => {
  try {
    return typeof resolveErpDatabaseUrl() === "string";
  } catch {
    return false;
  }
})();

if (!erpConfigured) {
  console.warn(
    "[sales-invoice-basis] HYBRID gate SKIPPED — ERP_DATABASE_URL is not set. " +
      "Point it at the LOCAL erp_fixture sandbox and re-run.",
  );
}

/** What `db/erp-fixture/sales-seed.sql`'s SalesInvoiceDtl block declares. */
const FIXTURE = {
  from: "2026-08-01",
  to: "2026-09-30",
  invoiceCount: 3,
  lineCount: 9,
  /** Header TotalAmount sum — the same figure the excluded-total query has always reported. */
  headerTotal: 858937.21,
  /** Invoices 1 and 3 tie line-sum to header exactly; invoice 2 carries the NULL-Amount line. */
  tying: ["SI-2569-0001", "SI-2569-0003"],
  nullAmountInvoice: "SI-2569-0002",
} as const;

describe.skipIf(!erpConfigured)("invoice SQL against erp_fixture (Hybrid)", () => {
  const range = { from: FIXTURE.from, to: FIXTURE.to };

  it("invoice-headers.sql parses and returns the seeded invoices", async () => {
    const headers = await fetchInvoiceHeaders(range);
    expect(headers.value).toHaveLength(FIXTURE.invoiceCount);
    const sum = headers.value.reduce((a, h) => a + Number(h.Amount), 0);
    expect(Math.round(sum * 100) / 100).toBe(FIXTURE.headerTotal);
  });

  it("line SUM ties to the header on the invoices designed to tie", async () => {
    const headers = await fetchInvoiceHeaders(range);
    for (const no of FIXTURE.tying) {
      const h = headers.value.find((r) => r.InvoiceNo === no);
      expect(h, `${no} missing`).toBeDefined();
      expect(Math.round(Number(h!.LineAmount) * 100)).toBe(Math.round(Number(h!.Amount) * 100));
    }
  });

  it("a NULL Amount sums as 0 WITHOUT dropping the line from the count", async () => {
    const headers = await fetchInvoiceHeaders(range);
    const h = headers.value.find((r) => r.InvoiceNo === FIXTURE.nullAmountInvoice)!;
    expect(h).toBeDefined();

    const lines = await fetchInvoiceLines({ ...range, invoiceNo: FIXTURE.nullAmountInvoice });
    // 3 seeded lines, one of which has Amount = NULL in the database.
    expect(lines.value).toHaveLength(3);
    expect(Number(h.LineCount)).toBe(3);

    // The NULL line surfaces as 0, not as null/NaN, and not as a missing row.
    const amounts = lines.value.map((l) => Number(l.Amount));
    expect(amounts.every((a) => Number.isFinite(a))).toBe(true);
    expect(amounts).toContain(0);

    // …and the NULL-safe header total is strictly LESS than the header's own TotalAmount, which is
    // exactly the real-world partial-invoice shape this fixture row mirrors.
    expect(Number(h.LineAmount)).toBeLessThan(Number(h.Amount));
    expect(Number(h.LineAmount)).toBe(amounts.reduce((a, b) => a + b, 0));
  });

  it("the unit label comes from the LINE, not the item master", async () => {
    const lines = await fetchInvoiceLines(range);
    expect(lines.value).toHaveLength(FIXTURE.lineCount);
    // FG-1006's InventoryItem master row has a NULL MainUnits on purpose; its invoice line carries
    // N'KG'. A query that reached for the master would read "-" here.
    const fg1006 = lines.value.find((l) => l.ItemCode === "FG-1006");
    expect(fg1006, "FG-1006 line missing").toBeDefined();
    expect(fg1006!.Unit).toBe("KG");
  });

  it("the date filter is a real bound, not a no-op", async () => {
    const august = await fetchInvoiceHeaders({ from: "2026-08-01", to: "2026-08-31" });
    expect(august.value.length).toBeGreaterThan(0);
    expect(august.value.length).toBeLessThan(FIXTURE.invoiceCount);
  });

  it("invoice-by-product.sql groups per (item, line unit) and never crosses units", async () => {
    const products = await fetchInvoiceByProduct(range);
    expect(products.value.length).toBeGreaterThan(1);
    const keys = products.value.map((p) => `${p.ItemCode}|${p.Unit}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Real category codes reach the breakdown (F/R/P are all seeded).
    expect(new Set(products.value.map((p) => p.CategoryKey)).size).toBeGreaterThanOrEqual(2);
  });

  it("invoice-by-customer.sql groups by the HEADER's customer, never the line's", async () => {
    const customers = await fetchInvoiceByCustomer(range);
    expect(customers.value.length).toBeGreaterThan(0);
    // The fixture leaves SalesInvoiceDtl.CustOrSuppCode NULL on every line precisely so this
    // assertion fails loudly if the query ever groups by the line column instead of the header.
    for (const c of customers.value) {
      expect(c.CustCode, "grouped by the LINE's NULL CustOrSuppCode, not the header's").not.toBeNull();
    }
    expect(new Set(customers.value.map((c) => c.CustCode)).size).toBeGreaterThanOrEqual(2);
  });

  it("invoice-date-range.sql reports the whole pool, unfiltered", async () => {
    const range_ = await fetchInvoiceDateRange();
    const row = range_.value[0];
    expect(Number(row.DocCount)).toBe(FIXTURE.invoiceCount);
    expect(row.FirstDate).not.toBeNull();
    expect(row.LastDate).not.toBeNull();
  });
});
