"use client";

import { Search, ChevronRight } from "lucide-react";

// Phase 04 — mobile รายชื่อร้าน (shop list) sub-state of the order-matrix mobile branch. Pure
// presentational: it renders over the SAME cells/notes state the matrix owns (no local state, no
// second save path). Tapping a card opens the per-shop entry overlay for that roster slot.

export interface MobileListRow {
  /** Index into the full rows array — the entry overlay navigates by this. */
  rowIdx: number;
  /** Global unique roster slot — React key + data-testid (never renumbered). */
  rosterOrder: number;
  /** Per-location 1..N visible number shown in the card circle. */
  displayNo: number;
  shopName: string;
  total: number;
  note: string;
  has: boolean;
}

interface OrderMobileListProps {
  dateLabel?: string;
  orderedCount: number;
  totalCount: number;
  query: string;
  onQuery: (v: string) => void;
  rows: MobileListRow[];
  onOpen: (rowIdx: number) => void;
}

export function OrderMobileList({
  dateLabel,
  orderedCount,
  totalCount,
  query,
  onQuery,
  rows,
  onOpen,
}: OrderMobileListProps) {
  const progress = totalCount > 0 ? (orderedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col">
      {/* Green header: brand + BE-date chip + amber progress bar. */}
      <div className="bg-[#0E3B2E] px-[18px] pb-3.5 pt-3 text-white">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-bold">
            <span className="text-[#5FCEA4]">ยิ่ง</span>เจริญ · ออเดอร์วันนี้
          </span>
          {dateLabel && (
            <span className="ml-auto rounded-[var(--r-full)] bg-white/15 px-2.5 py-0.5 font-[var(--font-mono)] text-[12px]">
              {dateLabel}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-[var(--r-full)] bg-white/20">
            <div
              className="h-full rounded-[var(--r-full)] bg-[#F59E0B]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="whitespace-nowrap font-[var(--font-mono)] text-[12px] text-[#C9EEDD]">
            {orderedCount}/{totalCount} ร้าน
          </span>
        </div>
      </div>

      {/* Search. */}
      <div className="px-3.5 py-2.5">
        <div className="flex h-10 items-center gap-2 rounded-[var(--r-md)] border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] px-3">
          <Search size={15} strokeWidth={2} className="text-[var(--text-faint)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="ค้นหาร้านค้า…"
            className="flex-1 border-none bg-transparent text-[14px] text-[var(--text)] outline-none"
          />
        </div>
      </div>

      {/* Shop cards. */}
      <div className="flex flex-col gap-2 px-3.5 pb-3">
        {rows.map((s) => (
          <button
            key={s.rosterOrder}
            type="button"
            onClick={() => onOpen(s.rowIdx)}
            data-testid={`mobile-shop-${s.rosterOrder}`}
            className="flex min-h-11 items-center gap-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-left transition-colors active:bg-[var(--bg-sunken)]"
          >
            <span
              className={
                "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[var(--r-full)] font-[var(--font-mono)] text-[11.5px] font-bold " +
                (s.has
                  ? "bg-[#C9EEDD] text-[#0E5238]"
                  : "bg-[var(--bg-sunken)] text-[var(--text-faint)]")
              }
            >
              {s.displayNo}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[var(--text)]">
                {s.shopName}
              </span>
              <span className="block truncate text-[11.5px] text-[var(--text-faint)]">
                {s.total > 0
                  ? `รวม ${s.total} หน่วย${s.note ? ` · ${s.note}` : ""}`
                  : s.note
                    ? `หมายเหตุ: ${s.note}`
                    : "ยังไม่มีรายการ"}
              </span>
            </span>
            <span
              className={
                "whitespace-nowrap rounded-[var(--r-full)] px-2.5 py-0.5 text-[11px] font-semibold " +
                (s.has
                  ? "bg-[var(--success-bg)] text-[var(--success)]"
                  : "bg-[var(--warning-bg)] text-[var(--warning)]")
              }
            >
              {s.has ? "กรอกแล้ว" : "ยังไม่สั่ง"}
            </span>
            <ChevronRight size={16} strokeWidth={2} className="text-[var(--text-faint)]" />
          </button>
        ))}
      </div>
    </div>
  );
}
