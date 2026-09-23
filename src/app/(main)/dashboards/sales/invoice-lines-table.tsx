import * as React from "react";
import Link from "next/link";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { Card } from "@/components/ui/card";
import {
  beShort,
  formatInt,
  formatMoney,
  formatQty,
  quantityByUnitList,
} from "@/lib/sales-basis-core";
import { isoDate, type InvoiceHeaderRow, type InvoiceLineRow } from "@/lib/sales-queries";
import { SALES_PAGE_SIZE, paginate, salesHref, sortRows, type SalesUrlState } from "./sales-url";

// sales-invoice-basis (23-09-26) — one invoice and its lines. The invoice-section twin of
// `do-lines-table`, reached via `?invoiceNo=` on the SAME page (no nested route).
//
// PER-UNIT TOTALS: `quantityByUnitList` — one entry per unit, never a combined cross-unit number.
// The unit on each line is the LINE's own `MainUnits`, straight from `invoice-lines.sql`.
//
// MONEY (AC9): the "ราคา/หน่วย" and "ยอดเงิน" columns, and the header's amount fields, are omitted
// from the markup entirely for a non-Admin viewer.
//
// RECONCILIATION: an invoice's line sum ties to its header total on every live invoice, so when it
// does NOT tie (a partially-invoiced document) the difference is stated out loud rather than
// quietly rounded away.

export const INVOICE_LINES_CSV_COLUMNS: ReadonlyArray<{
  key: string;
  csvLabel: string;
  csvValue: (row: InvoiceLineRow) => string | number;
  money?: boolean;
}> = [
  { key: "item", csvLabel: "สินค้า", csvValue: (r) => r.ItemName },
  { key: "qty", csvLabel: "จำนวน", csvValue: (r) => Number(r.Qty) },
  { key: "unit", csvLabel: "หน่วย", csvValue: (r) => r.Unit },
  { key: "doNo", csvLabel: "เลขที่ใบส่งสินค้า", csvValue: (r) => r.OrderNo ?? "" },
  { key: "price", csvLabel: "ราคา/หน่วย", csvValue: (r) => Number(r.UnitPrice), money: true },
  { key: "amount", csvLabel: "ยอดเงิน", csvValue: (r) => Number(r.Amount), money: true },
];

export const INVOICE_LINES_SORT = {
  item: (r: InvoiceLineRow) => r.ItemName,
  qty: (r: InvoiceLineRow) => Number(r.Qty),
  unit: (r: InvoiceLineRow) => r.Unit,
  doNo: (r: InvoiceLineRow) => r.OrderNo ?? "",
  price: (r: InvoiceLineRow) => Number(r.UnitPrice),
  amount: (r: InvoiceLineRow) => Number(r.Amount),
};

export const INVOICE_LINES_SORT_DEFAULT = { key: "item", desc: false } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--t-sm)] text-[var(--text)]">{children}</dd>
    </div>
  );
}

export function InvoiceLinesTable({
  header,
  lines,
  state,
  canSeeMoney,
}: {
  header: InvoiceHeaderRow | undefined;
  lines: readonly InvoiceLineRow[];
  state: SalesUrlState;
  canSeeMoney: boolean;
}) {
  if (!header) {
    return (
      <Card className="p-6 text-center" data-testid="invoice-lines-not-found">
        <span className="th text-[var(--t-sm)] text-[var(--text-faint)]">
          ไม่พบใบแจ้งหนี้เลขที่ {state.invoiceNo}
        </span>
      </Card>
    );
  }

  const units = quantityByUnitList(lines.map((l) => ({ unit: l.Unit, qty: Number(l.Qty) })));
  const lineTotal = lines.reduce((a, l) => a + Number(l.Amount), 0);
  // Rounded to 2dp on both sides: both are DECIMAL(18,2) in SQL Server, so anything beyond a float
  // artefact is a genuine partial-invoice gap worth naming.
  const ties = Math.round(lineTotal * 100) === Math.round(Number(header.Amount) * 100);

  const columns: DataTableColumn[] = [
    { key: "item", label: "สินค้า", sortable: true },
    { key: "qty", label: "จำนวน", sortable: true, align: "right" },
    { key: "unit", label: "หน่วย" },
    { key: "doNo", label: "เลขที่ใบส่งสินค้า", sortable: true },
  ];
  if (canSeeMoney) {
    columns.push(
      { key: "price", label: "ราคา/หน่วย", sortable: true, align: "right" },
      { key: "amount", label: "ยอดเงิน", sortable: true, align: "right" },
    );
  }

  const sorted = sortRows<InvoiceLineRow>(lines, state.sort, INVOICE_LINES_SORT, {
    ...INVOICE_LINES_SORT_DEFAULT,
  });

  const rows: DataTableRow[] = paginate(sorted, state.page).map((line) => {
    const row: DataTableRow = {
      item: (
        <span className="flex flex-col">
          <span className="th text-[var(--text)]">{line.ItemName}</span>
          <span className="text-[11px] text-[var(--text-faint)]">{line.ItemCode}</span>
        </span>
      ),
      qty: formatQty(Number(line.Qty)),
      unit: line.Unit,
      doNo: line.OrderNo ? (
        // The link back to the goods this money was billed for.
        <Link
          href={salesHref(state.raw, {
            doNo: line.OrderNo,
            invoiceNo: null,
            view: null,
            page: null,
            sort: null,
          })}
          className="tabular-nums text-[var(--text)] hover:underline"
        >
          {line.OrderNo}
        </Link>
      ) : (
        "—"
      ),
    };
    if (canSeeMoney) {
      row.price = Number(line.UnitPrice) > 0 ? formatMoney(Number(line.UnitPrice)) : "—";
      row.amount = Number(line.Amount) > 0 ? formatMoney(Number(line.Amount)) : "—";
    }
    return row;
  });

  return (
    <div className="flex flex-col gap-3" data-testid="invoice-lines-table">
      <Card className="p-4">
        <h2 className="th mb-3 text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          ใบแจ้งหนี้ <span className="tabular-nums">{header.InvoiceNo}</span>
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="วันที่">{beShort(isoDate(header.InvDate))}</Field>
          <Field label="ลูกค้า">
            {header.CustName ?? header.CustCode}
            <span className="block text-[11px] text-[var(--text-faint)]">{header.CustCode}</span>
          </Field>
          <Field label="จำนวนรายการ">{formatInt(lines.length)} รายการ</Field>
          <Field label="จำนวน (ตามหน่วย)">
            {units.length === 0
              ? "—"
              : units.map((u) => `${formatQty(u.qty)} ${u.unit}`).join(" · ")}
          </Field>
          {canSeeMoney && (
            <Field label="ยอดเงินตามใบแจ้งหนี้">
              <span data-testid="invoice-lines-amount">
                {Number(header.Amount) > 0 ? formatMoney(Number(header.Amount)) : "—"}
              </span>
              <span className="block text-[11px] text-[var(--text-faint)]">
                {ties
                  ? "ยอดรวมรายการตรงกับยอดตามหัวใบแจ้งหนี้"
                  : `ยอดรวมรายการ ${formatMoney(lineTotal)} (ออกใบแจ้งหนี้บางส่วน)`}
              </span>
            </Field>
          )}
        </dl>
        {!canSeeMoney && (
          <p className="th mt-3 text-[var(--t-xs)] text-[var(--text-faint)]">
            ราคาและยอดเงินแสดงเฉพาะผู้ดูแลระบบ
          </p>
        )}
      </Card>

      <DashboardDataTable
        columns={columns}
        rows={rows}
        basePath="/dashboards/sales"
        searchParams={state.raw}
        currentSort={state.sort ?? "item"}
        currentPage={state.page}
        pageSize={SALES_PAGE_SIZE}
        totalRows={sorted.length}
        mobileTitleKey="item"
        emptyText="ไม่พบรายการในใบแจ้งหนี้นี้"
      />
    </div>
  );
}
