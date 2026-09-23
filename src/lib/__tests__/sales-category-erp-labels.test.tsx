import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildCategoryLabels,
  categoryLabel,
  CATEGORY_UNSPECIFIED_KEY,
} from "../sales-basis-core";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";
import { fetchDoLines } from "../sales-queries";
import { SALES_FIXTURE_EXPECTED } from "./sales-fixture-expected";

// DEFECT GATE (23-09-26): the Sales category pie rendered a legend entry "หมวด W" on the LIVE ERP —
// a raw ItemGRP code with no Thai label — because the label map was hardcoded in the app and only
// covered F / R / P (and `P` is not even a live code). The labels now come from the ERP's own
// `dbo.tbl_ItemGroup` (ICCode -> Description) via a LEFT JOIN in `do-lines.sql`.
//
// What this file proves:
//   1. a code the ERP lookup resolves renders the ERP's OWN label (never "หมวด {code}");
//   2. a code the lookup does NOT resolve still falls back to "หมวด {code}" — visible, not lost;
//   3. filtering keeps using the CODE: every `?cat=` href and the filter chip's clear link carry
//      the code, never the Thai label.
//
// JSDOM-FREE BY DESIGN, matching `dashboard-data-table.test.tsx`: the server components are invoked
// directly and rendered to an HTML string with `react-dom/server`.

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children),
}));

const { SalesCategoryPie } = await import("../../app/(main)/dashboards/sales/sales-category-pie");
const { SalesFilterBar } = await import("../../app/(main)/dashboards/sales/sales-filter-bar");
const { parseSalesUrl } = await import("../../app/(main)/dashboards/sales/sales-url");

/** The live group master's real labels for the codes that actually occur on DO lines. */
const ERP_LABEL_F = "สินค้าสำเร็จรูป";
const ERP_LABEL_R = "วัตถุดิบหลัก";
const ERP_LABEL_W = "สินค้าระหว่างผลิต";

/**
 * Rows shaped like `do-lines.sql` output: F/R/W carry the ERP's label, `P` has none (no group row
 * exists for it — exactly the fixture's and the live server's state), and `-` is the blank-group key.
 */
const ROWS = [
  { CategoryKey: "F", CategoryLabel: ERP_LABEL_F },
  { CategoryKey: "F", CategoryLabel: ERP_LABEL_F },
  { CategoryKey: "F", CategoryLabel: ERP_LABEL_F },
  { CategoryKey: "W", CategoryLabel: ERP_LABEL_W },
  { CategoryKey: "W", CategoryLabel: ERP_LABEL_W },
  { CategoryKey: "R", CategoryLabel: ERP_LABEL_R },
  { CategoryKey: "P", CategoryLabel: null },
  { CategoryKey: CATEGORY_UNSPECIFIED_KEY, CategoryLabel: null },
];

function renderPie(selected: string | null = null): string {
  return renderToStaticMarkup(
    <SalesCategoryPie rows={ROWS} selected={selected} searchParams={{}} />,
  );
}

// ---------------------------------------------------------------------------------------------
// Fully-Automated — the pure lookup.
// ---------------------------------------------------------------------------------------------
describe("buildCategoryLabels / categoryLabel (pure)", () => {
  it("collects the ERP's own label per code, ignoring blank and missing ones", () => {
    const labels = buildCategoryLabels(ROWS);
    expect(labels.get("F")).toBe(ERP_LABEL_F);
    expect(labels.get("W")).toBe(ERP_LABEL_W);
    expect(labels.get("R")).toBe(ERP_LABEL_R);
    expect(labels.has("P")).toBe(false);
    expect(labels.has(CATEGORY_UNSPECIFIED_KEY)).toBe(false);
  });

  it("renders the ERP label for a code the lookup resolves", () => {
    const labels = buildCategoryLabels(ROWS);
    expect(categoryLabel("W", labels)).toBe(ERP_LABEL_W);
    expect(categoryLabel("W", labels)).not.toContain("หมวด");
  });

  it("falls back to 'หมวด {code}' for a code the lookup does NOT resolve", () => {
    const labels = buildCategoryLabels(ROWS);
    expect(categoryLabel("P", labels)).toBe("หมวด P");
    // Same fallback when there is no lookup at all — the old hardcoded map is gone, not replaced.
    expect(categoryLabel("W")).toBe("หมวด W");
  });

  it("keeps the dedicated blank-group label rather than 'หมวด -'", () => {
    expect(categoryLabel(CATEGORY_UNSPECIFIED_KEY, buildCategoryLabels(ROWS))).toBe("ไม่ระบุหมวด");
  });

  it("never lets a label become the key — codes are the identity", () => {
    const labels = buildCategoryLabels(ROWS);
    expect([...labels.keys()].sort()).toEqual(["F", "R", "W"]);
  });
});

// ---------------------------------------------------------------------------------------------
// Fully-Automated — the pie's rendered legend and hrefs.
// ---------------------------------------------------------------------------------------------
describe("SalesCategoryPie labels from the ERP, filters by code", () => {
  it("shows the ERP's label for every resolvable code", () => {
    const html = renderPie();
    expect(html).toContain(ERP_LABEL_F);
    expect(html).toContain(ERP_LABEL_W);
    expect(html).toContain(ERP_LABEL_R);
  });

  it("no longer prints the raw-code fallback for a live code the ERP can label", () => {
    // The exact defect string the customer saw.
    expect(renderPie()).not.toContain("หมวด W");
  });

  it("still prints 'หมวด {code}' for an unresolvable code instead of dropping the slice", () => {
    expect(renderPie()).toContain("หมวด P");
  });

  it("labels the blank-group slice ไม่ระบุหมวด", () => {
    expect(renderPie()).toContain("ไม่ระบุหมวด");
  });

  it("links every slice by CODE — the Thai label never enters the URL", () => {
    const html = renderPie();
    expect(html).toContain("cat=F");
    expect(html).toContain("cat=W");
    expect(html).toContain("cat=P");
    expect(html).not.toContain(encodeURIComponent(ERP_LABEL_W));
    expect(html).not.toContain(`cat=${ERP_LABEL_W}`);
  });

  it("toggles the selected category off by code, not by label", () => {
    const html = renderPie("W");
    // The selected slice's link clears `cat` rather than re-setting it.
    expect(html).not.toContain("cat=W");
    // Unselected slices still offer their own code.
    expect(html).toContain("cat=F");
    expect(html).toContain(ERP_LABEL_W);
  });
});

// ---------------------------------------------------------------------------------------------
// Fully-Automated — the filter chip reads the same lookup.
// ---------------------------------------------------------------------------------------------
describe("SalesFilterBar category chip", () => {
  function renderBar(cat: string, withLabels: boolean): string {
    const state = parseSalesUrl({ cat });
    return renderToStaticMarkup(
      <SalesFilterBar
        state={state}
        catLabels={withLabels ? buildCategoryLabels(ROWS) : undefined}
      />,
    );
  }

  it("names the selected category with the ERP's label", () => {
    const html = renderBar("W", true);
    expect(html).toContain(ERP_LABEL_W);
  });

  it("falls back to 'หมวด {code}' when the code has no ERP label", () => {
    expect(renderBar("P", true)).toContain("หมวด P");
  });

  it("keeps the CODE in the hidden input and the clear link", () => {
    const html = renderBar("W", true);
    expect(html).toContain('value="W"');
    expect(html).not.toContain(`value="${ERP_LABEL_W}"`);
  });
});

// ---------------------------------------------------------------------------------------------
// HYBRID — the REAL SQL against the LOCAL `erp_fixture` sandbox (never db_TCL).
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
    "[sales-category-erp-labels] HYBRID gate SKIPPED — ERP_DATABASE_URL is not set. " +
      "Point it at the LOCAL erp_fixture sandbox and re-run to exercise the tbl_ItemGroup join.",
  );
}

describe.skipIf(!erpConfigured)("do-lines.sql resolves CategoryLabel from tbl_ItemGroup (Hybrid)", () => {
  const range = { from: SALES_FIXTURE_EXPECTED.from, to: SALES_FIXTURE_EXPECTED.to };

  it("returns the group master's Description for codes it knows", async () => {
    const lines = await fetchDoLines(range);
    const labels = buildCategoryLabels(lines.value);

    expect(labels.get("F")).toBe(ERP_LABEL_F);
    expect(labels.get("R")).toBe(ERP_LABEL_R);
  });

  it("returns NULL for a code with no group row, so the app falls back to 'หมวด {code}'", async () => {
    const lines = await fetchDoLines(range);
    const unmatched = lines.value.filter((l) => l.CategoryKey === "P");

    expect(unmatched.length).toBeGreaterThan(0);
    for (const line of unmatched) expect(line.CategoryLabel).toBeNull();
    expect(categoryLabel("P", buildCategoryLabels(lines.value))).toBe("หมวด P");
  });

  it("does not fan lines out — the join adds labels, never rows", async () => {
    const lines = await fetchDoLines(range);
    expect(lines.value).toHaveLength(SALES_FIXTURE_EXPECTED.lineCount);
  });

  it("still filters by CODE through the real SQL", async () => {
    const filtered = await fetchDoLines({ ...range, cat: "F" });
    expect(filtered.value.length).toBeGreaterThan(0);
    for (const line of filtered.value) {
      expect(line.CategoryKey).toBe("F");
      expect(line.CategoryLabel).toBe(ERP_LABEL_F);
    }
  });
});
