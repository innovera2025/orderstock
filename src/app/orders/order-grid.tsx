"use client";

import { useActionState, useMemo, useState } from "react";
import { saveOrderSheet, type OrderSheetActionState } from "./actions";
import { SheetHeader, type SheetHeaderColumn } from "@/components/sheet-header";
import {
  computeColumnTotals,
  computeGrandTotal,
  type OrderLineCell,
} from "@/lib/totals";

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

// Whole-sheet editable matrix (decision 1): rows = 29 roster slots (blank gaps rendered), columns =
// 20 in-order variants + a notes column. Sticky ลำดับ/ร้านค้า columns + horizontal scroll. Live
// footer totals import the SAME totals engine used server-side (decision 7). Whole-form submit.
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

  // Controlled cell values so the footer totals stay live. Key: `${shopId}:${variantId}`.
  const [cells, setCells] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(initialCells)) init[k] = String(v);
    return init;
  });

  const variantByPrintOrder = useMemo(
    () => new Map(columns.map((c) => [c.variantId, c.printOrder])),
    [columns],
  );

  // Build OrderLineCell[] from current inputs for the live totals (blank/invalid → skipped).
  const liveCells: OrderLineCell[] = useMemo(() => {
    const out: OrderLineCell[] = [];
    for (const [key, raw] of Object.entries(cells)) {
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const qty = Number(trimmed);
      if (!Number.isInteger(qty) || qty <= 0) continue;
      const [shopId, variantId] = key.split(":").map(Number);
      const printOrder = variantByPrintOrder.get(variantId);
      if (printOrder == null) continue;
      out.push({ rosterOrder: shopId, printOrder, qty });
    }
    return out;
  }, [cells, variantByPrintOrder]);

  const columnTotals = useMemo(() => computeColumnTotals(liveCells), [liveCells]);
  const grandTotal = useMemo(() => computeGrandTotal(liveCells), [liveCells]);

  const headerColumns: SheetHeaderColumn[] = columns.map((c) => ({
    printOrder: c.printOrder,
    name: c.name,
    group: c.group,
  }));

  const stickyLead = "sticky bg-white";

  return (
    <form action={formAction}>
      <div className="mb-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        {state.error && (
          <span className="rounded bg-red-50 px-3 py-1 text-sm text-red-700">{state.error}</span>
        )}
        {state.ok && <span className="text-sm text-green-700">บันทึกแล้ว ✓</span>}
        <span className="ml-auto text-sm font-medium">
          รวมทั้งหมด: <span data-testid="grand-total">{grandTotal}</span> ชิ้น
        </span>
      </div>

      <div className="overflow-x-auto border">
        <table className="border-collapse text-sm">
          <SheetHeader columns={headerColumns} leadClassName={`left-0 z-10 ${stickyLead}`} />
          <tbody>
            {rows.map((row) => {
              const isGap = row.shopId == null;
              return (
                <tr key={row.rosterOrder} className={isGap ? "bg-zinc-50/50" : ""}>
                  <td className={`border px-2 py-1 text-center ${stickyLead} left-0 z-10`}>
                    {row.rosterOrder}
                  </td>
                  <td className={`border px-2 py-1 whitespace-nowrap ${stickyLead} left-12 z-10`}>
                    {row.shopName ?? <span className="text-zinc-300">—</span>}
                  </td>
                  {columns.map((col) => {
                    const key = row.shopId != null ? `${row.shopId}:${col.variantId}` : "";
                    return (
                      <td key={col.variantId} className="border p-0 text-center">
                        {row.shopId != null && (
                          <input
                            name={`cell:${row.shopId}:${col.variantId}`}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={cells[key] ?? ""}
                            onChange={(e) =>
                              setCells((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="h-8 w-12 text-center outline-none focus:bg-amber-50"
                            aria-label={`ลำดับ ${row.rosterOrder} ${col.name}`}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="border p-0">
                    {row.shopId != null && (
                      <input
                        name={`note:${row.shopId}`}
                        defaultValue={initialNotes[row.shopId] ?? ""}
                        className="h-8 w-40 px-2 outline-none focus:bg-amber-50"
                        aria-label={`หมายเหตุ ลำดับ ${row.rosterOrder}`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-100 text-center text-xs font-medium">
              <td className={`border px-2 py-1 ${stickyLead} left-0 z-10`} colSpan={2}>
                รวม
              </td>
              {columns.map((col) => (
                <td key={col.variantId} className="border px-1 py-1" data-testid={`total-${col.printOrder}`}>
                  {columnTotals[col.printOrder] || ""}
                </td>
              ))}
              <td className="border px-2 py-1">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </form>
  );
}
