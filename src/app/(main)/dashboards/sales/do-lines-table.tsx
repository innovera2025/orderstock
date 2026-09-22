import * as React from "react";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  beShort,
  formatInt,
  formatMoney,
  formatQty,
  quantityByUnitList,
  salesStatusLabel,
  salesStatusTone,
} from "@/lib/sales-basis-core";
import { isoDate, type DoHeaderRow, type DoLineRow } from "@/lib/sales-queries";
import { SALES_PAGE_SIZE, paginate, sortRows, type SalesUrlState } from "./sales-url";

// erp-dashboards Phase 2 — the DO line-item detail (drilldown step 3 of 3).
//
// Shows one delivery order: its header facts, its per-unit quantity totals, and its line items via
// Phase 1's shared data table (same sort/paginate/mobile-card contract as the DO list).
//
// PER-UNIT TOTALS: `quantityByUnitList` — one entry per unit, never a combined cross-unit number.
//
// MONEY (AC9): the "ราคา/หน่วย" and "ยอดเงิน" columns, and the header's amount field, are all
// omitted from the markup entirely for a non-Admin viewer.
//
// CSV-EXPORT READINESS: `DO_LINES_CSV_COLUMNS` follows this phase's convention for Phase 5.

export const DO_LINES_CSV_COLUMNS: ReadonlyArray<{
  key: string;
  csvLabel: string;
  csvValue: (row: DoLineRow) => string | number;
  money?: boolean;
}> = [
  { key: "item", csvLabel: "สินค้า", csvValue: (r) => r.ItemName },
  { key: "qty", csvLabel: "จำนวน", csvValue: (r) => Number(r.Qty) },
  { key: "unit", csvLabel: "หน่วย", csvValue: (r) => r.Unit },
  { key: "price", csvLabel: "ราคา/หน่วย", csvValue: (r) => Number(r.Saleprice), money: true },
  { key: "amount", csvLabel: "ยอดเงิน", csvValue: (r) => Number(r.Amount), money: true },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--t-sm)] text-[var(--text)]">{children}</dd>
    </div>
  );
}

export function DoLinesTable({
  header,
  lines,
  state,
  canSeeMoney,
}: {
  header: DoHeaderRow | undefined;
  lines: readonly DoLineRow[];
  state: SalesUrlState;
  canSeeMoney: boolean;
}) {
  if (!header) {
    return (
      <Card className="p-6 text-center" data-testid="do-lines-not-found">
        <span className="th text-[var(--t-sm)] text-[var(--text-faint)]">
          ไม่พบใบส่งสินค้าเลขที่ {state.doNo}
        </span>
      </Card>
    );
  }

  const units = quantityByUnitList(
    lines.map((line) => ({ unit: line.Unit, qty: Number(line.Qty) })),
  );
  const pricedLines = lines.filter((line) => Number(line.Saleprice) !== 0).length;

  const columns: DataTableColumn[] = [
    { key: "item", label: "สินค้า", sortable: true },
    { key: "qty", label: "จำนวน", sortable: true, align: "right" },
    { key: "unit", label: "หน่วย" },
  ];
  if (canSeeMoney) {
    columns.push(
      { key: "price", label: "ราคา/หน่วย", sortable: true, align: "right" },
      { key: "amount", label: "ยอดเงิน", sortable: true, align: "right" },
    );
  }

  const sorted = sortRows<DoLineRow>(
    lines,
    state.sort,
    {
      item: (r) => r.ItemName,
      qty: (r) => Number(r.Qty),
      unit: (r) => r.Unit,
      price: (r) => Number(r.Saleprice),
      amount: (r) => Number(r.Amount),
    },
    { key: "item", desc: false },
  );

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
    };
    if (canSeeMoney) {
      row.price = Number(line.Saleprice) > 0 ? formatMoney(Number(line.Saleprice)) : "—";
      row.amount = Number(line.Amount) > 0 ? formatMoney(Number(line.Amount)) : "—";
    }
    return row;
  });

  return (
    <div className="flex flex-col gap-3" data-testid="do-lines-table">
      <Card className="p-4">
        <h2 className="th mb-3 text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          ใบส่งสินค้า <span className="tabular-nums">{header.DoNo}</span>
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="วันที่">{beShort(isoDate(header.Dodate))}</Field>
          <Field label="ลูกค้า">
            {header.CustName ?? header.CustCode}
            <span className="block text-[11px] text-[var(--text-faint)]">{header.CustCode}</span>
          </Field>
          <Field label="สถานะการส่งมอบ">
            <Chip tone={salesStatusTone(header.StatusKey)}>
              {salesStatusLabel(header.StatusKey)}
            </Chip>
          </Field>
          <Field label="จำนวนรายการ">{formatInt(Number(header.LineCount))} รายการ</Field>
          <Field label="จำนวน (ตามหน่วย)">
            {units.length === 0
              ? "—"
              : units.map((u) => `${formatQty(u.qty)} ${u.unit}`).join(" · ")}
          </Field>
          {canSeeMoney && (
            <Field label="ยอดเงิน (เฉพาะรายการที่มีราคา)">
              <span data-testid="do-lines-amount">
                {Number(header.Amount) > 0 ? formatMoney(Number(header.Amount)) : "—"}
              </span>
              <span className="block text-[11px] text-[var(--text-faint)]">
                มีราคา {formatInt(pricedLines)} จาก {formatInt(lines.length)} รายการ
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
        emptyText="ไม่มีรายการสินค้า"
      />
    </div>
  );
}
