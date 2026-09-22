import * as React from "react";
import { CATEGORY_LABELS, categoryLabel } from "@/lib/sales-basis-core";
import { SalesSliceChart, type ChartSlice } from "./sales-slice-chart";
import { salesHref, type RawSearchParams } from "./sales-url";

// erp-dashboards Phase 2 — "สัดส่วนรายการขายตามหมวดสินค้า": a FULL PIE, as the approved mockup
// draws it (Defaults Taken #2).
//
// CATEGORY SOURCE (INNOVATE decision, 22-09-26): grouped directly by `InventoryItem.ItemGRP` plus
// the small code-to-Thai-label map in `sales-basis-core.ts`. There is deliberately NO
// `tbl_ItemGroup` / `tbl_CATEGORY` join — that path is untraced and the mockup itself groups by a
// flat item-group field. An unmapped live code renders as "หมวด {code}" rather than being lost.
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
  rows: ReadonlyArray<{ CategoryKey: string }>;
  selected: string | null;
  searchParams: RawSearchParams;
}) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.CategoryKey, (counts.get(row.CategoryKey) ?? 0) + 1);

  const known = Object.keys(CATEGORY_LABELS);
  const unknown = [...counts.keys()].filter((k) => !known.includes(k)).sort();

  const slices: ChartSlice[] = [...known, ...unknown].map((key, i) => ({
    key,
    label: categoryLabel(key),
    value: counts.get(key) ?? 0,
    color: PALETTE[i % PALETTE.length],
    href: salesHref(searchParams, { cat: selected === key ? null : key, page: null }),
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
