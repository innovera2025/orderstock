import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// sales-invoice-basis (23-09-26) — the two-section URL contract and the per-section degrade shape.
//
// Fully-Automated, ZERO precondition: no database, no Docker, no browser. The URL half is pure
// string logic; the DOM half renders the degrade components to an HTML string via
// `react-dom/server`, the same jsdom-free pattern `dashboard-data-table.test.tsx` established.

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children),
}));

const {
  parseSalesUrl,
  resolveSalesView,
  resolveSalesSection,
  salesHref,
  clearPageParams,
  SALES_PAGE_PARAMS,
  INVOICE_PRODUCT_PAGE_PARAM,
  INVOICE_CUSTOMER_PAGE_PARAM,
  PRODUCT_PAGE_PARAM,
  CUSTOMER_PAGE_PARAM,
} = await import("../../app/(main)/dashboards/sales/sales-url");

describe("sales view resolution — section identity and depth", () => {
  it("defaults to the summary view, which reports the PRIMARY (invoice) section", () => {
    expect(resolveSalesView({})).toBe("summary");
    expect(resolveSalesSection({})).toBe("invoice");
  });

  it("resolves each of the four explicit section/depth views", () => {
    expect(resolveSalesView({ view: "invoice-documents" })).toBe("invoice-documents");
    expect(resolveSalesView({ view: "invoice-lines" })).toBe("invoice-lines");
    expect(resolveSalesView({ view: "delivery-documents" })).toBe("delivery-documents");
    expect(resolveSalesView({ view: "delivery-lines" })).toBe("delivery-lines");

    expect(resolveSalesSection({ view: "invoice-documents" })).toBe("invoice");
    expect(resolveSalesSection({ view: "delivery-documents" })).toBe("delivery");
  });

  // The view-only cases: with no drilldown param, `view` is the ONLY signal telling the two
  // sections' list views apart. This is what the shared resolver exists for.
  it("distinguishes the two LIST views from `view` alone, with no drilldown param present", () => {
    expect(resolveSalesSection({ view: "invoice-documents" })).toBe("invoice");
    expect(resolveSalesSection({ view: "delivery-documents" })).toBe("delivery");
  });

  it("a drilldown param beats the view value, and invoiceNo beats doNo", () => {
    expect(resolveSalesView({ doNo: "DO-2608-0008" })).toBe("delivery-lines");
    expect(resolveSalesView({ invoiceNo: "SI-1" })).toBe("invoice-lines");
    // Both present: the primary section wins, deterministically.
    expect(resolveSalesView({ invoiceNo: "SI-1", doNo: "DO-1" })).toBe("invoice-lines");
    // …and the view value cannot override either.
    expect(resolveSalesView({ view: "summary", doNo: "DO-1" })).toBe("delivery-lines");
  });

  it("keeps the PRE-PLAN spellings working as delivery aliases", () => {
    // A stale bookmark with the old `?view=documents` has always meant "show me the delivery
    // orders" — it must not silently land on the invoice list.
    expect(resolveSalesView({ view: "documents" })).toBe("delivery-documents");
    expect(resolveSalesView({ view: "lines" })).toBe("delivery-lines");
    // The combined stale case from the plan's back-compat rule.
    expect(resolveSalesView({ view: "documents", doNo: "DO-2608-0008" })).toBe("delivery-lines");
  });

  it("falls back to summary on a genuinely unrecognised view value", () => {
    expect(resolveSalesView({ view: "bogus" })).toBe("summary");
    expect(resolveSalesView({ view: "" })).toBe("summary");
    expect(resolveSalesView({ view: ["nope", "invoice-documents"] })).toBe("summary");
  });

  it("a customer/product filter alone no longer forces a documents view away from summary", () => {
    // Pre-plan this returned "documents". Both sections now render on summary and both honour the
    // filter, so there is nothing left to force.
    expect(resolveSalesView({ customer: "CUS-001" })).toBe("summary");
    expect(resolveSalesView({ product: "FG-1001" })).toBe("summary");
  });
});

describe("parseSalesUrl — invoiceNo and per-section page keys", () => {
  it("reads invoiceNo with the same null/empty handling as doNo", () => {
    expect(parseSalesUrl({}).invoiceNo).toBeNull();
    expect(parseSalesUrl({ invoiceNo: "" }).invoiceNo).toBeNull();
    expect(parseSalesUrl({ invoiceNo: "SI-2569-0001" }).invoiceNo).toBe("SI-2569-0001");
    expect(parseSalesUrl({ invoiceNo: ["SI-1", "SI-2"] }).invoiceNo).toBe("SI-1");
  });

  it("the two sections' breakdown tables never share a page key", () => {
    const state = parseSalesUrl({
      [PRODUCT_PAGE_PARAM]: "2",
      [CUSTOMER_PAGE_PARAM]: "3",
      [INVOICE_PRODUCT_PAGE_PARAM]: "4",
      [INVOICE_CUSTOMER_PAGE_PARAM]: "5",
    });
    expect(state.productPage).toBe(2);
    expect(state.customerPage).toBe(3);
    expect(state.invoiceProductPage).toBe(4);
    expect(state.invoiceCustomerPage).toBe(5);
  });

  it("clearPageParams clears ALL FOUR breakdown keys plus the document-list key", () => {
    expect(Object.keys(clearPageParams()).sort()).toEqual([...SALES_PAGE_PARAMS].sort());
    const href = salesHref(
      {
        page: "4",
        [PRODUCT_PAGE_PARAM]: "3",
        [CUSTOMER_PAGE_PARAM]: "2",
        [INVOICE_PRODUCT_PAGE_PARAM]: "6",
        [INVOICE_CUSTOMER_PAGE_PARAM]: "7",
      },
      clearPageParams(),
    );
    const params = new URL(href, "http://x").searchParams;
    for (const key of SALES_PAGE_PARAMS) expect(params.has(key)).toBe(false);
  });
});

describe("per-section degrade renders exactly one dashboard root", () => {
  it("the scoped fragment carries NO sales-dashboard root of its own", async () => {
    const { SalesUnavailableFragment } = await import(
      "../../app/(main)/dashboards/sales/sales-unavailable-fragment"
    );
    const html = renderToStaticMarkup(
      React.createElement(SalesUnavailableFragment, {
        testId: "sales-invoice-unavailable",
        sectionLabel: "ยอดขายตามใบแจ้งหนี้",
      }),
    );
    // A second `sales-dashboard` root is exactly the failure mode that made rendering the
    // whole-page fallback twice (once per section) unworkable.
    expect(html).not.toContain('data-testid="sales-dashboard"');
    expect(html).toContain('data-testid="sales-invoice-unavailable"');
    expect(html).toContain("ยังไม่มีข้อมูลที่จะแสดง");
  });

  it("two fragments side by side still produce zero dashboard roots and distinct testids", async () => {
    const { SalesUnavailableFragment } = await import(
      "../../app/(main)/dashboards/sales/sales-unavailable-fragment"
    );
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(SalesUnavailableFragment, {
          key: "a",
          testId: "sales-invoice-unavailable",
          sectionLabel: "ยอดขายตามใบแจ้งหนี้",
        }),
        React.createElement(SalesUnavailableFragment, {
          key: "b",
          testId: "sales-delivery-unavailable",
          sectionLabel: "การส่งมอบ",
        }),
      ),
    );
    expect(html.match(/data-testid="sales-dashboard"/g)).toBeNull();
    expect(html).toContain('data-testid="sales-invoice-unavailable"');
    expect(html).toContain('data-testid="sales-delivery-unavailable"');
  });

  it("the WHOLE-PAGE fallback still owns the single sales-dashboard root, unchanged", async () => {
    const { SalesUnavailable } = await import(
      "../../app/(main)/dashboards/sales/sales-unavailable"
    );
    const state = parseSalesUrl({});
    const html = renderToStaticMarkup(React.createElement(SalesUnavailable, { state }));
    expect(html.match(/data-testid="sales-dashboard"/g)).toHaveLength(1);
    // Its original e2e contract is untouched.
    expect(html).toContain('data-testid="sales-erp-unavailable"');
  });
});
