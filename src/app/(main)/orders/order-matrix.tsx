"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { saveOrderSheet, type OrderSheetActionState } from "./actions";
import { buildOrderPayload } from "@/lib/order-payload";
import {
  computeColumnTotals,
  computeGrandTotal,
  type OrderLineCell,
} from "@/lib/totals";
import { PACK_SIZE_LABELS, type PackSize } from "@/lib/product-order";
import { Button } from "@/components/ui/button";

// order-matrix.tsx (Phase 02) — the 20-column daily-order MATRIX that REPLACES the Order Pad.
// It is a pure VIEW over the SAME flat client state the pad used
// (`cells: Record<"${shopId}:${variantId}", string>` + `notes: Record<shopId, string>`), and it
// submits the IDENTICAL hidden `cell:`/`note:` inputs via buildOrderPayload — so the UNCHANGED
// saveOrderSheet action parses it byte-for-byte. weight/peep are transient UI-only (never saved).

export interface GridColumn {
  variantId: number;
  printOrder: number;
  name: string;
  group: string;
  productId: number;
  productName: string;
  packSize: string;
  labelVariant: string | null;
}

export interface GridRow {
  rosterOrder: number;
  shopId: number | null;
  shopName: string | null;
}

export interface PrintLink {
  href: string;
  label: string;
}

interface OrderMatrixProps {
  sheetId: number;
  columns: GridColumn[];
  rows: GridRow[];
  initialCells: Record<string, number>;
  initialNotes: Record<number, string>;
  printLinks?: PrintLink[];
}

// Grid column index for a print-order position: col 1 = "#", col 2 = shop name, col 3 = printOrder 1.
const colFor = (printOrder: number) => printOrder + 2;

const GRID_TEMPLATE = "40px 172px repeat(20,45px) 168px";

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

/** Tier-3 unit sublabel for a column: label variant (หมู/ไก่/...) or pack-size (1กก./½กก.). */
function columnSub(col: GridColumn): string {
  if (col.labelVariant) return col.labelVariant;
  const label = PACK_SIZE_LABELS[col.packSize as PackSize];
  return label ?? "";
}

const noopSubscribe = () => () => {};
const getTopbarSlot = () =>
  typeof document !== "undefined" ? document.getElementById("topbar-actions") : null;

/** Portal the matrix's save/print controls into the shared topbar `#topbar-actions` slot.
 * `useSyncExternalStore` is hydration-safe: it renders null on the server (matching SSR), then
 * re-reads the slot node on the client after mount — so the portal reliably attaches on every
 * navigation (getElementById returns a stable node reference, no render loop). */
function TopbarActions({ children }: { children: React.ReactNode }) {
  const slot = useSyncExternalStore(noopSubscribe, getTopbarSlot, () => null);
  if (!slot) return null;
  return createPortal(children, slot);
}

export function OrderMatrix({
  sheetId,
  columns,
  rows,
  initialCells,
  initialNotes,
  printLinks = [],
}: OrderMatrixProps) {
  const saveAction = saveOrderSheet.bind(null, sheetId);
  const [state, formAction, pending] = useActionState(
    saveAction,
    {} as OrderSheetActionState,
  );

  const initialCellStrings = useMemo(() => {
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(initialCells)) init[k] = String(v);
    return init;
  }, [initialCells]);

  const [cells, setCells] = useState<Record<string, string>>(() => ({ ...initialCellStrings }));
  const [notes, setNotes] = useState<Record<number, string>>(() => ({ ...initialNotes }));
  const [weight, setWeight] = useState("");
  const [peep, setPeep] = useState("");
  const [query, setQuery] = useState("");
  const [hlFilled, setHlFilled] = useState(true);

  const variantByPrintOrder = useMemo(
    () => new Map(columns.map((c) => [c.variantId, c.printOrder])),
    [columns],
  );

  // Live OrderLineCell[] for the totals engine (blank/invalid cells skipped).
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

  const shopsWithNotes = useMemo(() => {
    const set = new Set<number>();
    for (const [shopId, text] of Object.entries(notes)) {
      if (text.trim() !== "") set.add(Number(shopId));
    }
    return set;
  }, [notes]);

  const namedRows = useMemo(() => rows.filter((r) => r.shopId != null && r.shopName), [rows]);

  const orderedCount = useMemo(() => {
    const withCells = new Set<number>();
    for (const [key, raw] of Object.entries(cells)) {
      if (!hasQty(raw)) continue;
      withCells.add(Number(key.split(":")[0]));
    }
    let count = 0;
    for (const row of namedRows) {
      const id = row.shopId as number;
      if (withCells.has(id) || shopsWithNotes.has(id)) count += 1;
    }
    return count;
  }, [cells, namedRows, shopsWithNotes]);

  // Tier-2 header groups: consecutive columns sharing a productId, colspan = count.
  const tier2Groups = useMemo(() => {
    const groups: { productName: string; start: number; end: number }[] = [];
    for (const col of columns) {
      const last = groups[groups.length - 1];
      const gridCol = colFor(col.printOrder);
      if (last && last.productName === col.productName && last.end === gridCol) {
        last.end = gridCol + 1;
      } else {
        groups.push({ productName: col.productName, start: gridCol, end: gridCol + 1 });
      }
    }
    return groups;
  }, [columns]);

  const setCell = (shopId: number, variantId: number, value: string) => {
    setCells((prev) => ({ ...prev, [`${shopId}:${variantId}`]: value }));
  };
  const setNote = (shopId: number, text: string) => {
    setNotes((prev) => ({ ...prev, [shopId]: text }));
  };

  const filterMatch = (row: GridRow) => {
    const q = query.trim();
    if (q === "") return true;
    return (row.shopName ?? "").includes(q);
  };

  const payloadEntries = useMemo(() => buildOrderPayload(cells, notes), [cells, notes]);

  const cellBg = (raw: string | undefined) =>
    hlFilled && hasQty(raw) ? "#E9F6F0" : "transparent";

  const inputCls =
    "h-full w-full border-none bg-transparent text-center font-[var(--font-mono)] " +
    "text-[13px] tabular-nums text-[var(--text)] outline-none " +
    "focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--brand-int)]";

  // The save button lives in the topbar via a portal — OUTSIDE this form's DOM subtree — so it is
  // associated back to the form by id (`form="order-sheet-form"`), which HTML form-association
  // honors regardless of DOM position.
  const FORM_ID = "order-sheet-form";

  return (
    <form id={FORM_ID} action={formAction} className="flex flex-col gap-3">
      {/* Save + last-edit + print links live in the shared topbar slot. */}
      <TopbarActions>
        <div className="flex items-center gap-3">
          {printLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-[var(--brand-int)] hover:underline"
            >
              {l.label}
            </a>
          ))}
          {state.error && (
            <span className="rounded bg-[var(--danger-bg)] px-2 py-1 text-[12.5px] text-[var(--danger)]">
              {state.error}
            </span>
          )}
          {state.ok && state.savedAt && (
            <span className="text-[12.5px] text-[var(--success)]">
              บันทึกล่าสุด {formatSavedTime(state.savedAt)} ✓
            </span>
          )}
          <Button type="submit" form={FORM_ID} size="sm" disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </TopbarActions>

      {/* Toolbar: search + reset + clear + highlight toggle. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาร้านค้า…"
          className="h-9 w-56 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text)] outline-none focus-visible:border-[var(--brand-int)] focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setCells({ ...initialCellStrings })}
        >
          รีเซ็ตตามใบงาน
        </Button>
        <Button
          type="button"
          variant="danger-ghost"
          size="sm"
          onClick={() => {
            setCells({});
            setNotes({});
          }}
        >
          ล้างทั้งหมด
        </Button>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={hlFilled}
            onChange={(e) => setHlFilled(e.target.checked)}
          />
          เน้นช่องที่กรอก
        </label>
      </div>

      {/* KPI strip. */}
      <div className="grid grid-cols-4 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
        {[
          {
            label: "รวมน้ำหนัก (กก.)",
            node: (
              <input
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="—"
                className="w-full bg-transparent text-center font-[var(--font-mono)] text-[27px] text-[var(--text-strong)] outline-none"
              />
            ),
          },
          {
            label: "รวมปี๊บ",
            node: (
              <input
                type="text"
                inputMode="numeric"
                value={peep}
                onChange={(e) => setPeep(e.target.value)}
                placeholder="—"
                className="w-full bg-transparent text-center font-[var(--font-mono)] text-[27px] text-[var(--text-strong)] outline-none"
              />
            ),
          },
          {
            label: "ร้านที่สั่ง",
            node: (
              <span className="font-[var(--font-mono)] text-[27px] text-[var(--text-strong)]">
                {orderedCount}
                <span className="text-[15px] text-[var(--text-faint)]">/{namedRows.length}</span>
              </span>
            ),
          },
          {
            label: "รวมจำนวน (หน่วย)",
            node: (
              <span
                data-testid="grand-total"
                className="font-[var(--font-mono)] text-[27px] text-[var(--brand-int)]"
              >
                {grandTotal}
              </span>
            ),
          },
        ].map((kpi, i) => (
          <div
            key={kpi.label}
            className={
              "flex flex-col items-center justify-center gap-1 px-3 py-4 " +
              (i > 0 ? "border-l border-[var(--border)]" : "")
            }
          >
            <span className="text-[12px] text-[var(--text-muted)]">{kpi.label}</span>
            <div className="flex h-9 items-center">{kpi.node}</div>
          </div>
        ))}
      </div>

      {/* Matrix. */}
      <div className="overflow-x-auto rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="min-w-max">
          {/* 3-tier header. */}
          <div
            className="grid border-b border-[var(--border)]"
            style={{ gridTemplateColumns: GRID_TEMPLATE, gridTemplateRows: "26px 30px 22px" }}
          >
            <div
              className="flex items-center justify-center bg-[var(--bg-sunken)] text-[11px] text-[var(--text-muted)]"
              style={{ gridColumn: "1", gridRow: "1 / 4" }}
            >
              #
            </div>
            <div
              className="flex items-center px-2 bg-[var(--bg-sunken)] text-[12px] font-semibold text-[var(--text-strong)]"
              style={{ gridColumn: "2", gridRow: "1 / 4" }}
            >
              ร้านค้า
            </div>
            {/* Tier-1 bands. */}
            <div
              className="flex items-center justify-center bg-[var(--green-800,#14532d)] text-[12px] font-semibold text-white"
              style={{ gridColumn: "3 / 19", gridRow: "1", backgroundColor: "var(--green-800)" }}
            >
              สินค้า
            </div>
            <div
              className="flex items-center justify-center text-[12px] font-semibold text-white"
              style={{ gridColumn: "19 / 23", gridRow: "1", backgroundColor: "var(--amber-800)" }}
            >
              เครื่องปรุง
            </div>
            <div
              className="flex items-center justify-center bg-[var(--bg-sunken)] text-[12px] font-semibold text-[var(--text-strong)]"
              style={{ gridColumn: "23", gridRow: "1 / 4" }}
            >
              หมายเหตุ
            </div>
            {/* Tier-2 product-name groups. */}
            {tier2Groups.map((g) => (
              <div
                key={`${g.productName}-${g.start}`}
                className="flex items-center justify-center border-l border-[var(--border)] px-1 text-center text-[11px] font-medium leading-tight text-[var(--text)]"
                style={{ gridColumn: `${g.start} / ${g.end}`, gridRow: "2" }}
                title={g.productName}
              >
                <span className="truncate">{g.productName}</span>
              </div>
            ))}
            {/* Tier-3 unit sublabels. */}
            {columns.map((col) => (
              <div
                key={col.variantId}
                className="flex items-center justify-center border-l border-[var(--border)] text-[10px] text-[var(--text-muted)]"
                style={{ gridColumn: `${colFor(col.printOrder)}`, gridRow: "3" }}
              >
                {columnSub(col)}
              </div>
            ))}
          </div>

          {/* Body rows. */}
          {rows.map((row) => {
            const isBlank = row.shopId == null || !row.shopName;
            const visible = filterMatch(row);
            return (
              <div
                key={row.rosterOrder}
                className="grid border-b border-[var(--border)]"
                style={{
                  gridTemplateColumns: GRID_TEMPLATE,
                  height: "30px",
                  display: visible ? "grid" : "none",
                }}
              >
                <div className="flex items-center justify-center text-[11px] text-[var(--text-faint)]">
                  {row.rosterOrder}
                </div>
                <div
                  className={
                    "flex items-center truncate px-2 text-[12.5px] " +
                    (isBlank ? "text-[var(--text-faint)]" : "text-[var(--text)]")
                  }
                >
                  {row.shopName ?? ""}
                </div>
                {columns.map((col) => {
                  const key = isBlank ? "" : `${row.shopId}:${col.variantId}`;
                  const raw = key ? cells[key] : "";
                  return (
                    <div
                      key={col.variantId}
                      className="border-l border-[var(--border)]"
                      style={{ backgroundColor: cellBg(raw) }}
                    >
                      {!isBlank && (
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid={`cell-${row.rosterOrder}-${col.printOrder}`}
                          value={raw ?? ""}
                          onChange={(e) =>
                            setCell(row.shopId as number, col.variantId, e.target.value)
                          }
                          className={inputCls}
                        />
                      )}
                    </div>
                  );
                })}
                <div className="border-l border-[var(--border)]">
                  {!isBlank && (
                    <input
                      type="text"
                      value={notes[row.shopId as number] ?? ""}
                      onChange={(e) => setNote(row.shopId as number, e.target.value)}
                      placeholder=""
                      className="h-full w-full border-none bg-transparent px-2 text-[12px] text-[var(--text)] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--brand-int)]"
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Totals row. */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: GRID_TEMPLATE,
              height: "32px",
              backgroundColor: "var(--green-50)",
            }}
          >
            <div style={{ gridColumn: "1 / 3" }} className="flex items-center px-2 text-[12.5px] font-bold text-[var(--green-900,#0E3B2E)]">
              รวมทั้งหมด
            </div>
            {columns.map((col) => {
              const t = columnTotals[col.printOrder] ?? 0;
              return (
                <div
                  key={col.variantId}
                  data-testid={`total-${col.printOrder}`}
                  className={
                    "flex items-center justify-center border-l border-[var(--border)] font-[var(--font-mono)] text-[12.5px] font-bold tabular-nums " +
                    (t === 0 ? "text-[#94A29D]" : "text-[var(--text-strong)]")
                  }
                  style={{ gridColumn: `${colFor(col.printOrder)}` }}
                >
                  {t === 0 ? "" : t}
                </div>
              );
            })}
            <div
              className="flex items-center justify-center border-l border-[var(--border)] font-[var(--font-mono)] text-[13px] font-bold text-[var(--brand-int)]"
              style={{ gridColumn: "23" }}
            >
              {grandTotal}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden payload — byte-identical `cell:`/`note:` set the server parses (via buildOrderPayload). */}
      <div className="hidden" aria-hidden="true">
        {payloadEntries.map((e) => (
          <input key={e.name} type="hidden" name={e.name} value={e.value} />
        ))}
      </div>
    </form>
  );
}
