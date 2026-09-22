import * as React from "react";
import Link from "next/link";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { Chip } from "@/components/ui/chip";
import { beShort, formatInt, formatMoney, salesStatusLabel, salesStatusTone } from "@/lib/sales-basis-core";
import { isoDate, type DoHeaderRow } from "@/lib/sales-queries";
import { SALES_PAGE_SIZE, paginate, salesHref, sortRows, type SalesUrlState } from "./sales-url";

// erp-dashboards Phase 2 — the DO list (drilldown step 2 of 3).
//
// Uses Phase 1's shared `DashboardDataTable`, which owns the sort/paginate URL contract and the
// mobile card branch. Its links rewrite ONLY `sort`/`page` and preserve every other search param,
// so filters survive sorting and paging (AC12). The mobile card list below `md` is automatic in
// that component (AC13) — this phase adds no card branch of its own.
//
// SORTING/PAGING happen here, server-side: the shared component is presentational and renders the
// rows it is handed.
//
// MONEY (AC9): the "ยอดเงิน" column is added to the column list AND to each row object only when
// `canSeeMoney` is true. A Staff user's server-rendered HTML contains neither the header cell nor
// the value — nothing is rendered-then-hidden.
//
// CSV-EXPORT READINESS: `DO_LIST_CSV_COLUMNS` below is this phase's column-shape convention for
// Phase 5's export route (Phase 1's shared table has no export wiring). It pairs each column key
// with its CSV header and a raw, unformatted accessor.

export const DO_LIST_CSV_COLUMNS: ReadonlyArray<{
  key: string;
  csvLabel: string;
  csvValue: (row: DoHeaderRow) => string | number;
  money?: boolean;
}> = [
  { key: "doNo", csvLabel: "เลขที่ใบส่งสินค้า", csvValue: (r) => r.DoNo },
  { key: "date", csvLabel: "วันที่", csvValue: (r) => isoDate(r.Dodate) },
  { key: "cust", csvLabel: "ลูกค้า", csvValue: (r) => r.CustName ?? r.CustCode ?? "" },
  { key: "lines", csvLabel: "จำนวนรายการ", csvValue: (r) => Number(r.LineCount) },
  { key: "amount", csvLabel: "ยอดเงิน", csvValue: (r) => Number(r.Amount), money: true },
  { key: "status", csvLabel: "สถานะการส่งมอบ", csvValue: (r) => salesStatusLabel(r.StatusKey) },
];

export function DoListTable({
  headers,
  state,
  canSeeMoney,
}: {
  headers: readonly DoHeaderRow[];
  state: SalesUrlState;
  canSeeMoney: boolean;
}) {
  const columns: DataTableColumn[] = [
    { key: "doNo", label: "เลขที่ใบส่งสินค้า", sortable: true },
    { key: "date", label: "วันที่", sortable: true },
    { key: "cust", label: "ลูกค้า", sortable: true },
    { key: "lines", label: "จำนวนรายการ", sortable: true, align: "right" },
  ];
  if (canSeeMoney) {
    columns.push({ key: "amount", label: "ยอดเงิน", sortable: true, align: "right" });
  }
  columns.push({ key: "status", label: "สถานะการส่งมอบ", sortable: true });

  const sorted = sortRows<DoHeaderRow>(
    headers,
    state.sort,
    {
      doNo: (r) => r.DoNo,
      date: (r) => isoDate(r.Dodate),
      cust: (r) => r.CustName ?? r.CustCode ?? "",
      lines: (r) => Number(r.LineCount),
      amount: (r) => Number(r.Amount),
      status: (r) => salesStatusLabel(r.StatusKey),
    },
    { key: "date", desc: true },
  );

  const pageRows = paginate(sorted, state.page);

  const rows: DataTableRow[] = pageRows.map((header) => {
    const row: DataTableRow = {
      doNo: (
        <Link
          href={salesHref(state.raw, { doNo: header.DoNo, page: null, sort: null })}
          data-testid={`do-link-${header.DoNo}`}
          className="font-medium text-[var(--text)] hover:underline"
        >
          {header.DoNo}
        </Link>
      ),
      date: beShort(isoDate(header.Dodate)),
      cust: (
        <span className="flex flex-col">
          <span className="th text-[var(--text)]">{header.CustName ?? header.CustCode}</span>
          <span className="text-[11px] text-[var(--text-faint)]">{header.CustCode}</span>
        </span>
      ),
      lines: formatInt(Number(header.LineCount)),
      status: (
        <Chip tone={salesStatusTone(header.StatusKey)}>{salesStatusLabel(header.StatusKey)}</Chip>
      ),
    };
    // Money is ABSENT from the row object, not blanked, when the viewer is not an Admin.
    if (canSeeMoney) {
      row.amount = Number(header.Amount) > 0 ? formatMoney(Number(header.Amount)) : "—";
    }
    return row;
  });

  return (
    <div data-testid="do-list-table">
      <DashboardDataTable
        columns={columns}
        rows={rows}
        basePath="/dashboards/sales"
        searchParams={state.raw}
        currentSort={state.sort ?? "-date"}
        currentPage={state.page}
        pageSize={SALES_PAGE_SIZE}
        totalRows={sorted.length}
        mobileTitleKey="doNo"
        emptyText="ไม่พบใบส่งสินค้าตามเงื่อนไขที่เลือก"
      />
    </div>
  );
}
