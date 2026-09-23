import { describe, it, expect } from "vitest";
import {
  CUSTOMER_PAGE_PARAM,
  PRODUCT_PAGE_PARAM,
  SALES_PAGE_PARAMS,
  SALES_PAGE_SIZE,
  clearPageParams,
  pageFromParam,
  paginate,
  parseSalesUrl,
  salesHref,
} from "@/app/(main)/dashboards/sales/sales-url";

// sales-breakdown-pagination (23-09-26) — the URL/slice contract behind the two ยอดตามสินค้า /
// ยอดตามลูกค้า breakdown tables.
//
// PURE: no DB, no React, no Next runtime. These are the helpers the summary view uses to decide
// which 10 rows of a breakdown table to render and how paging one table interacts with the other.

const rows = Array.from({ length: 24 }, (_, i) => i + 1);

describe("pageFromParam — reading a 1-based page out of the URL", () => {
  it("defaults to page 1 when the key is absent", () => {
    expect(pageFromParam({}, PRODUCT_PAGE_PARAM)).toBe(1);
  });

  it("reads a valid page number", () => {
    expect(pageFromParam({ [PRODUCT_PAGE_PARAM]: "3" }, PRODUCT_PAGE_PARAM)).toBe(3);
  });

  it("takes the first value of a repeated param", () => {
    expect(pageFromParam({ [PRODUCT_PAGE_PARAM]: ["2", "9"] }, PRODUCT_PAGE_PARAM)).toBe(2);
  });

  for (const bad of ["", "0", "-4", "abc", "NaN"]) {
    it(`collapses the junk value ${JSON.stringify(bad)} to page 1`, () => {
      expect(pageFromParam({ [PRODUCT_PAGE_PARAM]: bad }, PRODUCT_PAGE_PARAM)).toBe(1);
    });
  }

  it("floors a fractional page", () => {
    expect(pageFromParam({ [PRODUCT_PAGE_PARAM]: "2.7" }, PRODUCT_PAGE_PARAM)).toBe(2);
  });

  it("reads each table's key independently — one page key never leaks into the other", () => {
    const raw = { [PRODUCT_PAGE_PARAM]: "3", [CUSTOMER_PAGE_PARAM]: "2", page: "5" };
    expect(pageFromParam(raw, PRODUCT_PAGE_PARAM)).toBe(3);
    expect(pageFromParam(raw, CUSTOMER_PAGE_PARAM)).toBe(2);
    expect(pageFromParam(raw, "page")).toBe(5);
  });
});

describe("paginate — the 10-row slice", () => {
  it("returns at most one page of rows", () => {
    expect(paginate(rows, 1)).toHaveLength(SALES_PAGE_SIZE);
    expect(SALES_PAGE_SIZE).toBe(10);
  });

  it("slices the requested page", () => {
    expect(paginate(rows, 1)[0]).toBe(1);
    expect(paginate(rows, 2)[0]).toBe(11);
    expect(paginate(rows, 3)).toEqual([21, 22, 23, 24]);
  });

  it("clamps a page past the end back onto the last page rather than blanking the table", () => {
    expect(paginate(rows, 99)).toEqual([21, 22, 23, 24]);
  });

  it("returns an empty slice for an empty data set", () => {
    expect(paginate([], 1)).toEqual([]);
  });

  it("never drops or duplicates a row across all pages", () => {
    const all = [paginate(rows, 1), paginate(rows, 2), paginate(rows, 3)].flat();
    expect(all).toEqual(rows);
  });
});

describe("parseSalesUrl — the two breakdown page keys", () => {
  it("defaults both breakdown pages to 1", () => {
    const state = parseSalesUrl({});
    expect(state.productPage).toBe(1);
    expect(state.customerPage).toBe(1);
    expect(state.page).toBe(1);
  });

  it("carries the two breakdown pages independently of the DO-list page", () => {
    const state = parseSalesUrl({
      [PRODUCT_PAGE_PARAM]: "2",
      [CUSTOMER_PAGE_PARAM]: "4",
      page: "3",
    });
    expect(state.productPage).toBe(2);
    expect(state.customerPage).toBe(4);
    expect(state.page).toBe(3);
  });
});

describe("salesHref + clearPageParams — paging one table preserves the filters", () => {
  const filters = {
    from: "2026-08-01",
    to: "2026-09-30",
    status: "checked",
    cat: "F",
    period: "week",
  };

  it("paging the product table keeps every filter and the other table's page", () => {
    const href = salesHref(
      { ...filters, [CUSTOMER_PAGE_PARAM]: "2" },
      { [PRODUCT_PAGE_PARAM]: 3 },
    );
    const params = new URL(href, "http://x").searchParams;
    expect(params.get("from")).toBe("2026-08-01");
    expect(params.get("to")).toBe("2026-09-30");
    expect(params.get("status")).toBe("checked");
    expect(params.get("cat")).toBe("F");
    expect(params.get("period")).toBe("week");
    expect(params.get(PRODUCT_PAGE_PARAM)).toBe("3");
    expect(params.get(CUSTOMER_PAGE_PARAM)).toBe("2");
  });

  it("clearPageParams drops every page key and nothing else", () => {
    expect(Object.keys(clearPageParams()).sort()).toEqual([...SALES_PAGE_PARAMS].sort());

    const href = salesHref(
      { ...filters, page: "4", [PRODUCT_PAGE_PARAM]: "3", [CUSTOMER_PAGE_PARAM]: "2" },
      { ...clearPageParams(), view: "documents" },
    );
    const params = new URL(href, "http://x").searchParams;
    for (const key of SALES_PAGE_PARAMS) expect(params.has(key)).toBe(false);
    expect(params.get("view")).toBe("documents");
    expect(params.get("status")).toBe("checked");
    expect(params.get("from")).toBe("2026-08-01");
  });
});
