"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GridColumn, GridRow } from "./order-grid";
import { PRODUCT_GROUPS, PRODUCT_GROUP_LABELS, type ProductGroup } from "@/lib/product-order";

// Order Pad main card (Phase 04 redesign): per-shop focused entry. A typeahead "เพิ่มสินค้า"
// combobox adds/merges stepper lines (grouped สินค้า/เครื่องปรุง), plus a single หมายเหตุ
// free-text field for off-list products. All state lives in the parent (order-grid.tsx) — this
// component is a controlled view + keyboard/focus orchestration only.

function hasQty(raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0;
}

interface ShopOrderCardProps {
  shopRow: GridRow | null;
  columns: GridColumn[];
  cells: Record<string, string>;
  noteText: string;
  onAddLine: (variantId: number) => void;
  onSetQty: (variantId: number, value: string) => void;
  onIncrement: (variantId: number) => void;
  onDecrement: (variantId: number) => void;
  onRemoveLine: (variantId: number) => void;
  onSetNote: (text: string) => void;
  /** Bumped by the parent whenever the combobox should receive focus (rail select/jump). */
  focusToken: number;
}

export function ShopOrderCard({
  shopRow,
  columns,
  cells,
  noteText,
  onAddLine,
  onSetQty,
  onIncrement,
  onDecrement,
  onRemoveLine,
  onSetNote,
  focusToken,
}: ShopOrderCardProps) {
  const [comboQuery, setComboQuery] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [pendingFocusVariantId, setPendingFocusVariantId] = useState<number | null>(null);

  const comboRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const shopId = shopRow?.shopId ?? null;

  // Focus the combobox whenever the parent requests it (rail click or search+Enter jump).
  useEffect(() => {
    comboRef.current?.focus();
  }, [focusToken]);

  // Focus (and select) a just-added / already-existing qty input once it exists in the DOM.
  useEffect(() => {
    if (pendingFocusVariantId == null) return;
    const el = qtyRefs.current[pendingFocusVariantId];
    if (el) {
      el.focus();
      el.select();
      setPendingFocusVariantId(null);
    }
  }, [pendingFocusVariantId, cells]);

  const normalizedQuery = comboQuery.trim().toLowerCase();
  const filteredColumns = useMemo(() => {
    if (!normalizedQuery) return columns;
    return columns.filter((c) => c.name.toLowerCase().includes(normalizedQuery));
  }, [columns, normalizedQuery]);

  const groupedLines = useMemo(() => {
    const byGroup = new Map<string, GridColumn[]>();
    for (const group of PRODUCT_GROUPS) byGroup.set(group, []);
    if (shopId != null) {
      for (const col of columns) {
        if (hasQty(cells[`${shopId}:${col.variantId}`])) {
          const arr = byGroup.get(col.group) ?? [];
          arr.push(col);
          byGroup.set(col.group, arr);
        }
      }
    }
    return byGroup;
  }, [columns, cells, shopId]);

  const groupedDropdown = useMemo(() => {
    const byGroup = new Map<string, GridColumn[]>();
    for (const group of PRODUCT_GROUPS) byGroup.set(group, []);
    for (const col of filteredColumns) {
      const arr = byGroup.get(col.group) ?? [];
      arr.push(col);
      byGroup.set(col.group, arr);
    }
    return byGroup;
  }, [filteredColumns]);

  const subtotal = useMemo(() => {
    if (shopId == null) return { lineCount: 0, qty: 0 };
    let lineCount = 0;
    let qty = 0;
    for (const col of columns) {
      const raw = cells[`${shopId}:${col.variantId}`];
      if (hasQty(raw)) {
        lineCount += 1;
        qty += Number(raw);
      }
    }
    return { lineCount, qty };
  }, [columns, cells, shopId]);

  function commitSelection(col: GridColumn) {
    if (shopId == null) return;
    const key = `${shopId}:${col.variantId}`;
    if (!hasQty(cells[key])) onAddLine(col.variantId);
    setComboQuery("");
    setComboOpen(false);
    setHighlighted(0);
    setPendingFocusVariantId(col.variantId);
  }

  function handleComboKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setComboOpen(true);
      setHighlighted((i) => Math.min(i + 1, Math.max(filteredColumns.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredColumns[highlighted] ?? filteredColumns[0];
      if (target) commitSelection(target);
    } else if (e.key === "Escape") {
      setComboOpen(false);
    }
  }

  function handleQtyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      comboRef.current?.focus();
      comboRef.current?.select();
    }
  }

  function handleQtyBlur(variantId: number) {
    const key = shopId != null ? `${shopId}:${variantId}` : "";
    if (!hasQty(cells[key])) onRemoveLine(variantId);
  }

  if (shopRow == null || shopId == null) {
    return (
      <div className="mx-auto max-w-[620px] rounded-[10px] border border-[#EBEBEB] bg-white p-6 text-center text-sm text-[#7D7D7D] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)]">
        ยังไม่มีร้านค้าในระบบ
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[620px] rounded-[10px] border border-[#EBEBEB] bg-white p-[22px_24px] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)]">
      <div className="mb-[18px] flex items-baseline justify-between">
        <span className="text-[16px] font-[590] tracking-[-0.01em] text-[#171717]">
          {shopRow.shopName}
        </span>
        <span className="text-[13px] text-[#7D7D7D] tabular-nums">
          <span className="text-[#4D4D4D]">{subtotal.lineCount}</span> รายการ · รวม{" "}
          <span className="text-[#4D4D4D]">{subtotal.qty}</span> ชิ้น
        </span>
      </div>

      <div className="relative mb-5">
        <svg
          className="pointer-events-none absolute top-1/2 left-[13px] h-4 w-4 -translate-y-1/2 text-[#7D7D7D]"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={comboRef}
          type="text"
          data-testid="product-combobox"
          aria-label="เพิ่มสินค้า"
          value={comboQuery}
          onChange={(e) => {
            setComboQuery(e.target.value);
            setHighlighted(0);
            setComboOpen(true);
          }}
          onFocus={() => setComboOpen(true)}
          onBlur={() => setTimeout(() => setComboOpen(false), 120)}
          onKeyDown={handleComboKeyDown}
          placeholder="เพิ่มสินค้า — พิมพ์ชื่อ เช่น ดีลาน, กรวด, น้ำปลา…"
          className="w-full rounded-[8px] border border-[#DEDEDE] bg-[#F4F4F5] py-[11px] pr-[13px] pl-[38px] text-sm text-[#171717] placeholder:text-[#A8A8A8] outline-none focus-visible:border-[#2563EB] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
        />
        {comboOpen && filteredColumns.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[8px] border border-[#EBEBEB] bg-white py-1 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
            {PRODUCT_GROUPS.map((group) => {
              const items = groupedDropdown.get(group) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="px-3 pt-2 pb-1 text-[11px] tracking-[0.03em] text-[#A8A8A8]">
                    {PRODUCT_GROUP_LABELS[group as ProductGroup]}
                  </div>
                  {items.map((col) => {
                    const idx = filteredColumns.indexOf(col);
                    const active = idx === highlighted;
                    return (
                      <button
                        key={col.variantId}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          commitSelection(col);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-sm ${
                          active ? "bg-[#F4F4F5] text-[#171717]" : "text-[#4D4D4D]"
                        }`}
                      >
                        {col.name}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {PRODUCT_GROUPS.map((group, groupIdx) => {
        const items = groupedLines.get(group) ?? [];
        return (
          <div key={group} className={groupIdx > 0 ? "mt-[18px]" : ""}>
            <div className="mb-2 text-[11px] tracking-[0.03em] text-[#A8A8A8]">
              {PRODUCT_GROUP_LABELS[group as ProductGroup]}
            </div>
            {items.length === 0 ? (
              <p className="pb-1 text-[13px] text-[#A8A8A8]">ยังไม่มีสินค้าในกลุ่มนี้</p>
            ) : (
              <div className="mb-2 flex flex-col gap-2">
                {items.map((col) => {
                  const key = `${shopId}:${col.variantId}`;
                  const qty = cells[key] ?? "1";
                  return (
                    <div
                      key={col.variantId}
                      className="flex items-center gap-3 rounded-[7px] px-1 py-[7px] hover:bg-[#F4F4F5]"
                    >
                      <span className="flex-1 text-sm text-[#171717]">{col.name}</span>
                      <div className="flex items-center">
                        <button
                          type="button"
                          aria-label={`ลด ${col.name}`}
                          onClick={() => onDecrement(col.variantId)}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-l-full border border-[#DEDEDE] bg-white text-[#4D4D4D]"
                        >
                          −
                        </button>
                        <input
                          ref={(el) => {
                            qtyRefs.current[col.variantId] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label={col.name}
                          data-testid={`qty-${col.printOrder}`}
                          value={qty}
                          onChange={(e) => onSetQty(col.variantId, e.target.value.replace(/[^0-9]/g, ""))}
                          onKeyDown={handleQtyKeyDown}
                          onBlur={() => handleQtyBlur(col.variantId)}
                          className="h-[30px] w-[46px] border-t border-b border-[#DEDEDE] bg-white text-center text-sm font-[590] text-[#171717] tabular-nums outline-none"
                        />
                        <button
                          type="button"
                          aria-label={`เพิ่ม ${col.name}`}
                          onClick={() => onIncrement(col.variantId)}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-r-full border border-[#DEDEDE] bg-white text-[#4D4D4D]"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`ลบ ${col.name}`}
                        onClick={() => onRemoveLine(col.variantId)}
                        className="w-[22px] text-center text-[15px] text-[#A8A8A8] hover:text-[#4D4D4D]"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-5 border-t border-[#EBEBEB] pt-[18px]">
        <label className="mb-[7px] block text-xs text-[#7D7D7D]">หมายเหตุ</label>
        <input
          type="text"
          data-testid="shop-note"
          aria-label="หมายเหตุ"
          value={noteText}
          onChange={(e) => onSetNote(e.target.value)}
          className="w-full rounded-[7px] border border-[#EBEBEB] bg-white px-3 py-[9px] text-[13.5px] text-[#171717] outline-none focus-visible:border-[#2563EB] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
        />
        <p className="mt-1.5 text-[11.5px] text-[#A8A8A8]">
          สินค้านอกรายการ (เช่น ดีขาว, พริกแดง) พิมพ์ในช่องนี้ได้เลย
        </p>
      </div>
    </div>
  );
}
