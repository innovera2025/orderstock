"use client";

import { PRODUCT_GROUPS, PRODUCT_GROUP_LABELS, type ProductGroup } from "@/lib/product-order";
import type { GridColumn } from "./order-grid";

// Sticky bottom summary bar (Phase 04 redesign): hero grand-total (data-testid="grand-total"),
// roster progress, and a slide-up drawer of the 20 per-column totals (data-testid=`total-${po}`).
// The drawer content is ALWAYS mounted (visually collapsed via max-height/opacity) so the e2e
// per-column assertions can read it regardless of open/closed state.

interface SummaryBarProps {
  grandTotal: number;
  orderedCount: number;
  totalShops: number;
  columns: GridColumn[];
  columnTotals: Record<number, number>;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

export function SummaryBar({
  grandTotal,
  orderedCount,
  totalShops,
  columns,
  columnTotals,
  drawerOpen,
  onToggleDrawer,
}: SummaryBarProps) {
  const byGroup = new Map<string, GridColumn[]>();
  for (const group of PRODUCT_GROUPS) byGroup.set(group, []);
  for (const col of columns) {
    const arr = byGroup.get(col.group) ?? [];
    arr.push(col);
    byGroup.set(col.group, arr);
  }

  return (
    <div className="sticky bottom-0 border-t border-[#EBEBEB] bg-white">
      <div
        className={`overflow-y-auto border-b border-[#EBEBEB] px-5 transition-[max-height,opacity] duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] motion-reduce:transition-none ${
          drawerOpen ? "max-h-72 py-4 opacity-100" : "max-h-0 py-0 opacity-0"
        }`}
        aria-hidden={!drawerOpen}
      >
        {PRODUCT_GROUPS.map((group) => {
          const items = byGroup.get(group) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-3 last:mb-0">
              <div className="mb-1.5 text-[11px] tracking-[0.03em] text-[#A8A8A8]">
                {PRODUCT_GROUP_LABELS[group as ProductGroup]}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                {items.map((col) => (
                  <div
                    key={col.variantId}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="truncate text-[#4D4D4D]">{col.name}</span>
                    <span
                      className="tabular-nums text-[#171717]"
                      data-testid={`total-${col.printOrder}`}
                    >
                      {columnTotals[col.printOrder] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-5 px-[22px] py-3.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-[#7D7D7D]">รวมทั้งวัน</span>
          <span
            className="text-[26px] font-[650] tracking-[-0.02em] text-[#171717] tabular-nums"
            data-testid="grand-total"
          >
            {grandTotal}
          </span>
          <span className="text-[13px] text-[#7D7D7D]">ชิ้น</span>
        </div>
        <span className="text-[13px] text-[#666666] tabular-nums">
          {orderedCount} / {totalShops} ร้านลงแล้ว
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggleDrawer}
          className="rounded-full border border-[#EBEBEB] bg-[#F4F4F5] px-[13px] py-1.5 text-[12.5px] text-[#4D4D4D]"
        >
          ดูยอดรายสินค้า {drawerOpen ? "▾" : "▴"}
        </button>
      </div>
    </div>
  );
}
