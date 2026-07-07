"use client";

import { useActionState, useMemo, useState } from "react";
import { saveOrderSheet, type OrderSheetActionState } from "./actions";
import {
  computeColumnTotals,
  computeGrandTotal,
  type OrderLineCell,
} from "@/lib/totals";
import { ShopRail, MobileShopSelect, type ShopStat } from "./shop-rail";
import { ShopOrderCard } from "./shop-order-card";
import { SummaryBar } from "./summary-bar";

export interface GridColumn {
  variantId: number;
  printOrder: number;
  name: string;
  group: string;
}

export interface GridRow {
  rosterOrder: number;
  shopId: number | null;
  shopName: string | null;
}

interface OrderGridProps {
  sheetId: number;
  columns: GridColumn[];
  rows: GridRow[];
  initialCells: Record<string, number>;
  initialNotes: Record<number, string>;
}

function hasQty(raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0;
}

function formatSavedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

// Order Pad (Phase 04 redesign, EXECUTE-approved follow-up): per-shop focused entry replaces the
// wide 29×20 matrix. Under-the-hood client state stays the SAME flat shape as the old matrix —
// `cells: Record<"${shopId}:${variantId}", string>` + `notes: Record<shopId, string>` — the new
// UI (rail + card + summary) is just a VIEW over these maps, and submit renders the SAME hidden
// `cell:`/`note:` inputs the server already parses (zero server-side change).
export function OrderGrid({
  sheetId,
  columns,
  rows,
  initialCells,
  initialNotes,
}: OrderGridProps) {
  const saveAction = saveOrderSheet.bind(null, sheetId);
  const [state, formAction, pending] = useActionState(
    saveAction,
    {} as OrderSheetActionState,
  );

  const [cells, setCells] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(initialCells)) init[k] = String(v);
    return init;
  });
  const [notes, setNotes] = useState<Record<number, string>>(() => ({ ...initialNotes }));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comboFocusToken, setComboFocusToken] = useState(0);

  const shopRows = useMemo(() => rows.filter((r) => r.shopId != null), [rows]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(
    () => shopRows[0]?.shopId ?? null,
  );

  function selectShop(shopId: number) {
    setSelectedShopId(shopId);
    setComboFocusToken((t) => t + 1);
  }

  const variantByPrintOrder = useMemo(
    () => new Map(columns.map((c) => [c.variantId, c.printOrder])),
    [columns],
  );

  // Build OrderLineCell[] from current inputs for the live totals (blank/invalid → skipped).
  const liveCells: OrderLineCell[] = useMemo(() => {
    const out: OrderLineCell[] = [];
    for (const [key, raw] of Object.entries(cells)) {
      if (!hasQty(raw)) continue;
      const qty = Number(raw.trim());
      const [shopId, variantId] = key.split(":").map(Number);
      const printOrder = variantByPrintOrder.get(variantId);
      if (printOrder == null) continue;
      out.push({ rosterOrder: shopId, printOrder, qty });
    }
    return out;
  }, [cells, variantByPrintOrder]);

  const columnTotals = useMemo(() => computeColumnTotals(liveCells), [liveCells]);
  const grandTotal = useMemo(() => computeGrandTotal(liveCells), [liveCells]);

  // Per-shop line count + qty (rail badges, per-shop subtotal in the card header).
  const shopStats = useMemo(() => {
    const map = new Map<number, ShopStat>();
    for (const [key, raw] of Object.entries(cells)) {
      if (!hasQty(raw)) continue;
      const qty = Number(raw.trim());
      const [shopId] = key.split(":").map(Number);
      const prev = map.get(shopId) ?? { lineCount: 0, qty: 0 };
      map.set(shopId, { lineCount: prev.lineCount + 1, qty: prev.qty + qty });
    }
    return map;
  }, [cells]);

  const shopsWithNotes = useMemo(() => {
    const set = new Set<number>();
    for (const [shopId, text] of Object.entries(notes)) {
      if (text.trim() !== "") set.add(Number(shopId));
    }
    return set;
  }, [notes]);

  const orderedCount = useMemo(() => {
    let count = 0;
    for (const row of shopRows) {
      const shopId = row.shopId as number;
      const stat = shopStats.get(shopId);
      if ((stat && stat.lineCount > 0) || shopsWithNotes.has(shopId)) count += 1;
    }
    return count;
  }, [shopRows, shopStats, shopsWithNotes]);

  const selectedShopRow = shopRows.find((r) => r.shopId === selectedShopId) ?? null;

  function addLine(variantId: number) {
    if (selectedShopId == null) return;
    const key = `${selectedShopId}:${variantId}`;
    setCells((prev) => ({ ...prev, [key]: "1" }));
  }

  function setQty(variantId: number, value: string) {
    if (selectedShopId == null) return;
    const key = `${selectedShopId}:${variantId}`;
    setCells((prev) => ({ ...prev, [key]: value }));
  }

  function increment(variantId: number) {
    if (selectedShopId == null) return;
    const key = `${selectedShopId}:${variantId}`;
    setCells((prev) => {
      const current = Number(prev[key]?.trim() || 0);
      return { ...prev, [key]: String(current + 1) };
    });
  }

  function decrement(variantId: number) {
    if (selectedShopId == null) return;
    const key = `${selectedShopId}:${variantId}`;
    setCells((prev) => {
      const current = Number(prev[key]?.trim() || 1);
      return { ...prev, [key]: String(Math.max(1, current - 1)) };
    });
  }

  function removeLine(variantId: number) {
    if (selectedShopId == null) return;
    const key = `${selectedShopId}:${variantId}`;
    setCells((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setNote(text: string) {
    if (selectedShopId == null) return;
    setNotes((prev) => ({ ...prev, [selectedShopId]: text }));
  }

  return (
    <form action={formAction} className="rounded-xl border border-[#EBEBEB] bg-white">
      <div className="flex items-center gap-3 border-b border-[#EBEBEB] px-4 py-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#171717] px-5 py-2 text-[13.5px] font-[590] text-white disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        {state.error && (
          <span className="rounded bg-red-50 px-3 py-1 text-sm text-red-700">{state.error}</span>
        )}
        {state.ok && state.savedAt && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#15803D]">
            บันทึกล่าสุด {formatSavedTime(state.savedAt)} ✓
          </span>
        )}
      </div>

      <MobileShopSelect
        rows={rows}
        selectedShopId={selectedShopId}
        onSelect={selectShop}
        className="md:hidden"
      />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
        <ShopRail
          rows={rows}
          shopStats={shopStats}
          shopsWithNotes={shopsWithNotes}
          selectedShopId={selectedShopId}
          onSelect={selectShop}
          orderedCount={orderedCount}
          totalShops={shopRows.length}
          className="hidden border-r md:flex md:min-h-[520px]"
        />

        <div className="overflow-y-auto bg-[#FAFAFA] p-4 md:p-6">
          <ShopOrderCard
            shopRow={selectedShopRow}
            columns={columns}
            cells={cells}
            noteText={selectedShopId != null ? notes[selectedShopId] ?? "" : ""}
            onAddLine={addLine}
            onSetQty={setQty}
            onIncrement={increment}
            onDecrement={decrement}
            onRemoveLine={removeLine}
            onSetNote={setNote}
            focusToken={comboFocusToken}
          />
        </div>
      </div>

      <SummaryBar
        grandTotal={grandTotal}
        orderedCount={orderedCount}
        totalShops={shopRows.length}
        columns={columns}
        columnTotals={columnTotals}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
      />

      {/* Hidden payload — SAME contract the server parses: cell:{shopId}:{variantId} / note:{shopId}. */}
      <div className="hidden" aria-hidden="true">
        {Object.entries(cells).map(([key, raw]) => {
          if (!hasQty(raw)) return null;
          return <input key={`cell-${key}`} type="hidden" name={`cell:${key}`} value={raw.trim()} />;
        })}
        {Object.entries(notes).map(([shopId, text]) => {
          if (text.trim() === "") return null;
          return <input key={`note-${shopId}`} type="hidden" name={`note:${shopId}`} value={text} />;
        })}
      </div>
    </form>
  );
}
