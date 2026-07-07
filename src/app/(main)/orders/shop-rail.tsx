"use client";

import { useMemo, useRef, useState } from "react";
import type { GridRow } from "./order-grid";

// Order Pad left rail (Phase 04 redesign): fixed 29-slot roster, filterable by ค้นหาร้าน + Enter
// to jump. Two-tier visual status per shop (filled/hollow dot, dimmed idle name), roster gaps
// rendered as disabled "—" rows. Purely presentational — all order/note data comes from parent.

export interface ShopStat {
  lineCount: number;
  qty: number;
}

interface ShopRailProps {
  rows: GridRow[];
  shopStats: Map<number, ShopStat>;
  shopsWithNotes: Set<number>;
  selectedShopId: number | null;
  onSelect: (shopId: number) => void;
  orderedCount: number;
  totalShops: number;
  /** Extra className to toggle rail visibility (desktop rail vs. hidden on mobile). */
  className?: string;
}

export function ShopRail({
  rows,
  shopStats,
  shopsWithNotes,
  selectedShopId,
  onSelect,
  orderedCount,
  totalShops,
  className = "",
}: ShopRailProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter(
      (row) => row.shopId != null && row.shopName?.toLowerCase().includes(normalizedQuery),
    );
  }, [rows, normalizedQuery]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const match = visibleRows.find((row) => row.shopId != null);
    if (match?.shopId != null) onSelect(match.shopId);
  }

  return (
    <div className={`flex flex-col border-[#EBEBEB] bg-white ${className}`}>
      <div className="border-b border-[#EBEBEB] p-3">
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="ค้นหาร้าน…"
          aria-label="ค้นหาร้าน"
          className="w-full rounded-[7px] border border-[#EBEBEB] bg-[#F4F4F5] px-3 py-2 text-sm text-[#171717] placeholder:text-[#A8A8A8] outline-none focus-visible:border-[#2563EB] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-1.5" data-testid="shop-rail-list">
        {visibleRows.map((row) => {
          const isGap = row.shopId == null;
          if (isGap) {
            return (
              <div
                key={row.rosterOrder}
                className="flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-sm"
              >
                <span className="w-4 text-center text-[11px] text-[#A8A8A8] tabular-nums">
                  {row.rosterOrder}
                </span>
                <span className="text-[#A8A8A8]">—</span>
              </div>
            );
          }

          const shopId = row.shopId as number;
          const stat = shopStats.get(shopId);
          const hasNote = shopsWithNotes.has(shopId);
          const ordered = (stat && stat.lineCount > 0) || hasNote;
          const selected = shopId === selectedShopId;

          return (
            <button
              key={row.rosterOrder}
              type="button"
              data-testid={`shop-slot-${row.rosterOrder}`}
              onClick={() => onSelect(shopId)}
              className={`relative flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left transition-colors duration-100 hover:bg-[#F4F4F5] ${
                selected ? "bg-black/[0.02]" : ""
              }`}
            >
              {selected && (
                <span className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full bg-[#171717]" />
              )}
              <span
                className={`h-2 w-2 flex-none rounded-full ${
                  ordered ? "bg-[#15803D]" : "border-[1.5px] border-[#A8A8A8]"
                }`}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="w-4 text-center text-[11px] text-[#A8A8A8] tabular-nums">
                    {row.rosterOrder}
                  </span>
                  <span
                    className={`truncate text-[13.5px] ${
                      ordered ? "text-[#171717]" : "text-[#7D7D7D]"
                    }`}
                  >
                    {row.shopName}
                  </span>
                </span>
                {stat && stat.lineCount > 0 && (
                  <span className="pl-6 text-[11.5px] text-[#7D7D7D] tabular-nums">
                    {stat.lineCount} รายการ · {stat.qty} ชิ้น
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-[#EBEBEB] px-3.5 py-2.5 text-xs text-[#7D7D7D]">
        <span>ลงแล้ว</span>
        <span className="tabular-nums">
          {orderedCount} / {totalShops} ร้าน
        </span>
      </div>
    </div>
  );
}

/** Mobile (≤720px) fallback selector: a native <select> so no custom listbox a11y is needed. */
export function MobileShopSelect({
  rows,
  selectedShopId,
  onSelect,
  className = "",
}: {
  rows: GridRow[];
  selectedShopId: number | null;
  onSelect: (shopId: number) => void;
  className?: string;
}) {
  const shopRows = rows.filter((r) => r.shopId != null);
  return (
    <div className={`border-b border-[#EBEBEB] bg-white p-3 ${className}`}>
      <select
        aria-label="เลือกร้าน"
        value={selectedShopId ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-full appearance-none rounded-[8px] border border-[#EBEBEB] bg-[#F4F4F5] px-3 py-2.5 text-[15px] font-medium text-[#171717] outline-none focus-visible:border-[#2563EB]"
      >
        {shopRows.map((row) => (
          <option key={row.rosterOrder} value={row.shopId as number}>
            {row.rosterOrder}. {row.shopName}
          </option>
        ))}
      </select>
    </div>
  );
}
