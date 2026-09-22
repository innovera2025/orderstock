import * as React from "react";
import { SALES_STATUSES, salesStatusLabel } from "@/lib/sales-basis-core";
import { SalesSliceChart, type ChartSlice } from "./sales-slice-chart";
import { salesHref, type RawSearchParams } from "./sales-url";

// erp-dashboards Phase 2 — "สัดส่วนสถานะการส่งมอบ": a DONUT with the total in its centre,
// exactly as the approved mockup draws it (Defaults Taken #2).
//
// LABEL: "สถานะการส่งมอบ" — NEVER "สถานะ SO". The status is derived from the real
// IsCancel/IsClosed/IsApproved/IsCheck flags on tbl_DOhdr; this ERP's SalesOrder module is unused,
// so any SO wording would be a claim the data cannot support.
//
// CROSS-FILTER: `rows` comes from a query run with `skipStatus: true`, so this donut always shows
// the FULL status distribution for the current date range regardless of which status is selected —
// the user can always click a different slice. Every other panel IS filtered by the selection.
//
// A status the ERP returns that is not in SALES_STATUSES still renders, as itself, rather than
// vanishing (`salesStatusLabel` falls back to the raw key).

export function SalesStatusDonut({
  rows,
  selected,
  searchParams,
}: {
  rows: ReadonlyArray<{ StatusKey: string }>;
  selected: string | null;
  searchParams: RawSearchParams;
}) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.StatusKey, (counts.get(row.StatusKey) ?? 0) + 1);

  const known = SALES_STATUSES.map((s) => s.key);
  const unknown = [...counts.keys()].filter((k) => !known.includes(k)).sort();
  const tones: Record<string, string> = {
    neutral: "var(--text-faint)",
    accent: "var(--accent)",
    brand: "var(--brand-int)",
    success: "var(--success)",
    danger: "var(--danger)",
  };

  const slices: ChartSlice[] = [...known, ...unknown].map((key) => {
    const tone = SALES_STATUSES.find((s) => s.key === key)?.tone ?? "neutral";
    return {
      key,
      label: salesStatusLabel(key),
      value: counts.get(key) ?? 0,
      color: tones[tone],
      // Clicking the selected slice clears the filter — a toggle, not a one-way trip.
      href: salesHref(searchParams, { status: selected === key ? null : key, page: null }),
      selected: selected === key,
    };
  });

  return (
    <SalesSliceChart
      title="สัดส่วนสถานะการส่งมอบ"
      subtitle="นับจำนวนใบส่งสินค้าตามสถานะ · คลิกส่วนของวงหรือแถวคำอธิบายเพื่อกรอง"
      unit="ใบ"
      centerSub="ใบส่งสินค้า"
      slices={slices}
      testId="sales-status-donut"
      emptyText="ไม่มีใบส่งสินค้าในช่วงที่เลือก"
    />
  );
}
