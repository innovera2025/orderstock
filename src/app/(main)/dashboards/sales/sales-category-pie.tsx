import * as React from "react";
import { buildCategoryLabels, categoryLabel } from "@/lib/sales-basis-core";
import { SalesSliceChart, type ChartSlice } from "./sales-slice-chart";
import { clearPageParams, salesHref, type RawSearchParams } from "./sales-url";

// erp-dashboards Phase 2 — "สัดส่วนรายการขายตามหมวดสินค้า": a FULL PIE, as the approved mockup
// draws it (Defaults Taken #2).
//
// CATEGORY SOURCE: slices are grouped by the `InventoryItem.ItemGRP` CODE (the stable identity the
// `?cat=` filter uses), and LABELLED from the ERP's own `dbo.tbl_ItemGroup` via the LEFT JOIN in
// `do-lines.sql`. The app no longer hardcodes the label map: it only knew F/R/P, so the live code
// `W` reached the customer as the raw fallback "หมวด W" (defect, 23-09-26). A code with no group
// row still renders as "หมวด {code}" rather than being lost or merged into another slice.
//
// The `CategoryKey` on each row already comes from the canonical InventoryItem row resolved by
// highest-Roworder-wins in `do-lines.sql` — a duplicate ItemCode on a lower Roworder can never
// silently supply the category here (registry Cross-Phase Precondition, E5).
//
// MEASURE: this counts LINES, not quantities — quantities across categories carry different units
// and must never be added together.
//
// CROSS-FILTER: `rows` comes from a query run with `skipCat: true`, so every category stays
// visible while one is selected.

const PALETTE = ["var(--brand-int)", "var(--accent)", "var(--success)", "var(--text-faint)"];

export function SalesCategoryPie({
  rows,
  selected,
  searchParams,
}: {
  rows: ReadonlyArray<{ CategoryKey: string; CategoryLabel?: string | null }>;
  selected: string | null;
  searchParams: RawSearchParams;
}) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.CategoryKey, (counts.get(row.CategoryKey) ?? 0) + 1);

  const labels = buildCategoryLabels(rows);

  // Biggest slice first; the code breaks ties so the order is stable across renders. There is no
  // fixed slice list any more — the categories shown are exactly the ones the ERP returned.
  const keys = [...counts.keys()].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, "th"),
  );

  const slices: ChartSlice[] = keys.map((key, i) => ({
    key,
    label: categoryLabel(key, labels),
    value: counts.get(key) ?? 0,
    color: PALETTE[i % PALETTE.length],
    href: salesHref(searchParams, { cat: selected === key ? null : key, ...clearPageParams() }),
    selected: selected === key,
  }));

  return (
    <SalesSliceChart
      title="สัดส่วนรายการขายตามหมวดสินค้า"
      subtitle="นับจำนวนรายการ (บรรทัดสินค้า) ในใบส่งสินค้า ไม่ใช่ปริมาณ เพราะหน่วยต่างกัน · คลิกเพื่อกรอง"
      unit="รายการ"
      centerSub="รายการขาย"
      slices={slices}
      pie
      testId="sales-category-pie"
      emptyText="ไม่มีรายการขายในช่วงที่เลือก"
    />
  );
}
