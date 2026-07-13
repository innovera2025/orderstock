import { SheetHeader, type SheetHeaderColumn } from "@/components/sheet-header";
import {
  PRINT_VARIANTS,
  PACK_SIZE_LABELS,
  type PackSize,
} from "@/lib/product-order";
import type { PrintColumn, PrintRow, NoteTallyLine } from "@/lib/get-sheet-for-print";

// Pure server render of ONE printable order-form: a fixed-mm 24-physical-column table (2 lead +
// 20 data + 2 หมายเหตุ) with a 3-tier header, a totals row as the LAST tbody row (NEVER <tfoot> —
// Chromium repeats a footer group on every page), and the footer tally / weight block. Reused by
// the combined daily sheet and each per-shop page (decision 8).

interface PrintTableProps {
  title: string;
  columns: PrintColumn[];
  rows: PrintRow[];
  columnTotals: Record<number, number>;
  grandTotal: number;
  noteTally: NoteTallyLine[];
}

// printOrder → 3rd-tier sub-label (flavor, else pack size, else blank) sourced from the canonical
// print-variant contract (Phase 02). Keeps the header's middle tier = full/snapshot name (E1b).
const subLabelByPrintOrder = new Map<number, string>(
  PRINT_VARIANTS.map((v) => [
    v.printOrder,
    v.labelVariant ?? PACK_SIZE_LABELS[v.packSize as PackSize] ?? "",
  ]),
);

export function PrintTable({
  title,
  columns,
  rows,
  columnTotals,
  grandTotal,
  noteTally,
}: PrintTableProps) {
  // The heavy vertical divider sits at the first เครื่องปรุง column (C18/C19 boundary).
  const seamPrintOrder = columns.find((c) => c.group === "SEASONING")?.printOrder ?? null;

  const headerColumns: SheetHeaderColumn[] = columns.map((c) => ({
    printOrder: c.printOrder,
    name: c.name,
    group: c.group,
    subLabel: subLabelByPrintOrder.get(c.printOrder) ?? "",
    className: c.printOrder === seamPrintOrder ? "seam-left" : undefined,
  }));

  const dataCellClass = (printOrder: number) =>
    printOrder === seamPrintOrder ? "seam-left" : undefined;

  return (
    <div className="sheet">
      <div className="print-sheet">
        <div className="sheet-title">{title}</div>
        <table>
          <colgroup>
            <col className="c-seq" />
            <col className="c-shop" />
            {columns.map((c) => (
              <col
                key={c.printOrder}
                data-data-col="1"
                className={`${c.group === "SEASONING" ? "c-seasoning" : "c-goods"} ${
                  c.printOrder === seamPrintOrder ? "seam-left" : ""
                }`}
              />
            ))}
            <col className="c-note" />
            <col className="c-noteqty" />
          </colgroup>

          <SheetHeader columns={headerColumns} trailingColSpan={2} />

          <tbody>
            {rows.map((row) => (
              <tr key={row.rosterOrder} className="data-row">
                <td>{row.displayNo}</td>
                <td className="shop-cell">{row.shopName ?? ""}</td>
                {columns.map((c) => (
                  <td key={c.printOrder} className={dataCellClass(c.printOrder)}>
                    {row.cells[c.printOrder] || ""}
                  </td>
                ))}
                <td className="note-cell">{row.note ?? ""}</td>
                <td className="note-qty" />
              </tr>
            ))}

            {/* Totals row = LAST tbody row (never <tfoot>). */}
            <tr className="totals-row">
              <td colSpan={2}>รวม</td>
              {columns.map((c) => (
                <td
                  key={c.printOrder}
                  className={dataCellClass(c.printOrder)}
                  data-testid={`ptotal-${c.printOrder}`}
                >
                  {columnTotals[c.printOrder] || ""}
                </td>
              ))}
              <td colSpan={2} data-testid="pgrand">
                {grandTotal || ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer: หมายเหตุ tally lists + weight totals. Weight VALUES are intentionally BLANK
            (labels in position) until the customer Q22 per-variant factors arrive — never a
            fabricated "0 กก." (E6). The yellow 24/21 figures are never reproduced. */}
        <div className="print-footer">
          <div className="tally-col">
            <div className="font-semibold">หมายเหตุ</div>
            {noteTally.map((line, i) => (
              <div key={`${line.text}-${i}`} className="tally-line" data-testid="tally-line">
                <span>{line.text}</span>
                <span>{line.qty != null ? line.qty : ""}</span>
              </div>
            ))}
          </div>
          <div className="weight-col">
            <div className="weight-line" data-testid="weight-kg">
              รวมน้ำหนัก <span data-testid="weight-kg-value" /> กก.
            </div>
            <div className="weight-line" data-testid="weight-pip">
              <span data-testid="weight-pip-value" /> ปี๊บ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
