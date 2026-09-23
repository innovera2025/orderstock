import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// erp-dashboards Phase 1 — gate AC12-AC13 (shared data-table contract).
//
// JSDOM-FREE BY DESIGN (Execute-agent instruction E1): this repo has no `jsdom`, `happy-dom`, or
// `@testing-library/react`, `vitest.config.ts` stays `environment: "node"`, and `package.json` is
// outside this phase's blast radius. So the server component is invoked directly and rendered to
// an HTML string via `react-dom/server` (already present), with assertions on that string.
// This proves the markup/URL contract, NOT pixel-level or browser-runtime behavior.

// `next/link` needs no Next runtime here — a plain anchor preserves the href contract under test.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { DashboardDataTable } = await import("../../components/dashboard-data-table");

interface RenderOptions {
  searchParams?: Record<string, string | string[] | undefined>;
  currentSort?: string;
  currentPage?: number;
  pageSize?: number;
  totalRows?: number;
  rows?: Record<string, React.ReactNode>[];
}

const COLUMNS = [
  { key: "item", label: "สินค้า", sortable: true },
  { key: "total", label: "ยอดรวม", sortable: true, align: "right" as const },
  { key: "unit", label: "หน่วย" },
];

const ROWS = [
  { item: "FG-1001", total: "120", unit: "KG" },
  { item: "FG-1002", total: "80", unit: "KG" },
];

function render(options: RenderOptions = {}): string {
  return renderToStaticMarkup(
    React.createElement(DashboardDataTable, {
      columns: COLUMNS,
      rows: options.rows ?? ROWS,
      basePath: "/dashboards/sales",
      searchParams: options.searchParams ?? {},
      currentSort: options.currentSort,
      currentPage: options.currentPage ?? 1,
      pageSize: options.pageSize ?? 10,
      totalRows: options.totalRows ?? ROWS.length,
    }),
  );
}

/** Extract the href of the anchor carrying the given data-testid. */
function hrefOf(html: string, testId: string): string | undefined {
  const anchors = html.match(/<a[^>]*>/g) ?? [];
  const match = anchors.find((a) => a.includes(`data-testid="${testId}"`));
  return match?.match(/href="([^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
}

describe("DashboardDataTable — rendering", () => {
  it("renders every column header and every row", () => {
    const html = render();
    expect(html).toContain("สินค้า");
    expect(html).toContain("ยอดรวม");
    expect(html).toContain("หน่วย");
    expect(html).toContain("FG-1001");
    expect(html).toContain("FG-1002");
  });

  it("renders BOTH a desktop table and a mobile card list, gated by the md breakpoint", () => {
    const html = render();
    // Desktop table: hidden below md.
    expect(html).toMatch(/class="[^"]*hidden[^"]*md:block[^"]*"/);
    expect(html).toContain("<table");
    // Mobile cards: hidden at md and up.
    expect(html).toContain('data-testid="dashboard-data-cards"');
    expect(html).toMatch(/class="[^"]*md:hidden[^"]*"/);
  });

  it("renders an empty-state card instead of a table when there are no rows", () => {
    const html = render({ rows: [], totalRows: 0 });
    expect(html).toContain("ไม่มีข้อมูล");
    expect(html).not.toContain("<table");
  });

  it("marks only sortable columns as links", () => {
    const html = render();
    expect(hrefOf(html, "sort-item")).toBeDefined();
    expect(hrefOf(html, "sort-total")).toBeDefined();
    expect(hrefOf(html, "sort-unit")).toBeUndefined();
  });
});

describe("DashboardDataTable — sorting via ?sort=", () => {
  it("links to ascending sort when the column is not currently sorted", () => {
    const html = render();
    expect(hrefOf(html, "sort-total")).toBe("/dashboards/sales?sort=total&page=1");
  });

  it("toggles to descending when the column is already sorted ascending", () => {
    const html = render({ currentSort: "total" });
    // The leading `-` marks descending.
    expect(hrefOf(html, "sort-total")).toBe("/dashboards/sales?sort=-total&page=1");
  });

  it("produces the descending href from an ascending current sort", () => {
    const html = render({ currentSort: "item" });
    expect(hrefOf(html, "sort-item")).toContain("sort=-item");
  });

  it("returns to ascending from a descending current sort", () => {
    const html = render({ currentSort: "-item" });
    expect(hrefOf(html, "sort-item")).toContain("sort=item");
    expect(hrefOf(html, "sort-item")).not.toContain("sort=-item");
  });

  it("shows a direction indicator on the active sort column only", () => {
    const html = render({ currentSort: "-item" });
    expect(html).toContain("↓");
    expect(html).not.toContain("↑");
  });

  it("resets to page 1 when the sort changes", () => {
    const html = render({ currentPage: 3, totalRows: 100, searchParams: { page: "3" } });
    expect(hrefOf(html, "sort-item")).toContain("page=1");
  });
});

describe("DashboardDataTable — pagination via ?page= (AC12 filter preservation)", () => {
  it("PRESERVES all other search params when paging", () => {
    const html = render({
      searchParams: { location: "ยิ่งเจริญ", from: "2026-01-01", page: "1" },
      currentPage: 1,
      pageSize: 1,
      totalRows: 5,
    });
    const next = hrefOf(html, "data-table-next") ?? "";
    expect(next).toContain("location=");
    expect(next).toContain("from=2026-01-01");
    expect(next).toContain("page=2");
  });

  it("PRESERVES all other search params when sorting", () => {
    const html = render({ searchParams: { location: "ยิ่งเจริญ", from: "2026-01-01" } });
    const sort = hrefOf(html, "sort-total") ?? "";
    expect(sort).toContain("location=");
    expect(sort).toContain("from=2026-01-01");
    expect(sort).toContain("sort=total");
  });

  it("overrides only the page key, keeping an existing sort intact", () => {
    const html = render({
      searchParams: { sort: "-total", page: "2" },
      currentSort: "-total",
      currentPage: 2,
      pageSize: 1,
      totalRows: 5,
    });
    const next = hrefOf(html, "data-table-next") ?? "";
    expect(next).toContain("sort=-total");
    expect(next).toContain("page=3");
  });

  it("preserves repeated (array) search param values", () => {
    const html = render({
      searchParams: { tag: ["a", "b"] },
      pageSize: 1,
      totalRows: 5,
    });
    const next = hrefOf(html, "data-table-next") ?? "";
    expect(next).toContain("tag=a");
    expect(next).toContain("tag=b");
  });

  it("hides the previous link on the first page and the next link on the last", () => {
    const first = render({ currentPage: 1, pageSize: 1, totalRows: 3 });
    expect(hrefOf(first, "data-table-prev")).toBeUndefined();
    expect(hrefOf(first, "data-table-next")).toBeDefined();

    const last = render({ currentPage: 3, pageSize: 1, totalRows: 3 });
    expect(hrefOf(last, "data-table-prev")).toBeDefined();
    expect(hrefOf(last, "data-table-next")).toBeUndefined();
  });

  it("renders the Thai page label with the computed page count", () => {
    const html = render({ currentPage: 2, pageSize: 10, totalRows: 45 });
    expect(html).toContain("หน้า 2 จาก 5");
  });

  it("clamps an out-of-range page into the valid range", () => {
    const html = render({ currentPage: 99, pageSize: 10, totalRows: 20 });
    expect(html).toContain("หน้า 2 จาก 2");
  });
});

// ---------------------------------------------------------------------------------------------
// sales-breakdown-pagination (23-09-26) — the optional `rowTestId` / `pageParam` / `exportHref`
// extension points the Sales breakdown tables needed in order to REUSE this component instead of
// forking a second pagination implementation. Both must stay default-off so no pre-existing call
// site changes behaviour.
// ---------------------------------------------------------------------------------------------
describe("DashboardDataTable — additive extension points", () => {
  it("emits no per-row data-testid unless rowTestId is supplied", () => {
    expect(render()).not.toContain('data-testid="row-');
  });

  it("stamps rowTestId on both the desktop row and the mobile card", () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardDataTable, {
        columns: COLUMNS,
        rows: ROWS,
        basePath: "/dashboards/sales",
        pageSize: 10,
        totalRows: ROWS.length,
        rowTestId: (row: Record<string, React.ReactNode>) => `brk-row-${String(row.item)}`,
      }),
    );
    // Once in the table, once in the card list.
    expect(html.match(/data-testid="brk-row-FG-1001"/g)).toHaveLength(2);
    expect(html).toContain('data-testid="brk-row-FG-1002"');
  });

  it("paginates on a custom pageParam, leaving the default `page` key untouched", () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardDataTable, {
        columns: COLUMNS,
        rows: ROWS,
        basePath: "/dashboards/sales",
        searchParams: { page: "7", status: "checked" },
        pageParam: "productPage",
        currentPage: 1,
        pageSize: 10,
        totalRows: 25,
      }),
    );
    const next = hrefOf(html, "data-table-next");
    expect(next).toContain("productPage=2");
    expect(next).toContain("page=7");
    expect(next).toContain("status=checked");
  });

  it("suppresses the export button when exportHref is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardDataTable, {
        columns: COLUMNS,
        rows: ROWS,
        basePath: "/dashboards/sales",
        pageSize: 10,
        totalRows: ROWS.length,
        exportHref: false as const,
      }),
    );
    expect(html).not.toContain("data-table-export-csv");
  });
});
