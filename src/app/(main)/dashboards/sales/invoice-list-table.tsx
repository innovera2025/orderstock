import * as React from "react";
import Link from "next/link";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { beShort, formatInt, formatMoney } from "@/lib/sales-basis-core";
import { isoDate, type InvoiceHeaderRow } from "@/lib/sales-queries";
import { SALES_PAGE_SIZE, paginate, salesHref, sortRows, type SalesUrlState } from "./sales-url";

// sales-invoice-basis (23-09-26) — the INVOICE list. The invoice-section twin of `do-list-table`,
// built on the same shared `DashboardDataTable` and the same server-side sort/paginate contract.
//
// MONEY (AC9): the "ยอดเงิน" column is added to the column list AND to each row object only when
// `canSeeMoney` is true. A Staff user's server-rendered HTML contains neither the header cell nor
// the value — nothing is rendered-then-hidden.
//
// This table auto-derives its CSV export target from ambient URL state (it does NOT pass
// `exportHref={false}`), which is safe because `view` can only ever be ONE string: the invoice list
// and the delivery list are never mounted at the same time.

export const INVOICE_LIST_CSV_COLUMNS: ReadonlyArray<{
  key: string;
  csvLabel: string;
  csvValue: (row: InvoiceHeaderRow) => string | number;
  money?: boolean;
}> = [
  { key: "invoiceNo", csvLabel: "เลขที่ใบแจ้งหนี้", csvValue: (r) => r.InvoiceNo },
  { key: "date", csvLabel: "วันที่", csvValue: (r) => isoDate(r.InvDate) },
  { key: "cust", csvLabel: "ลูกค้า", csvValue: (r) => r.CustName ?? r.CustCode ?? "" },
  { key: "lines", csvLabel: "จำนวนรายการ", csvValue: (r) => Number(r.LineCount) },
  { key: "amount", csvLabel: "ยอดเงิน", csvValue: (r) => Number(r.Amount), money: true },
];

/** The sort accessors — shared by the on-screen table and the CSV export, so they never disagree. */
export const INVOICE_LIST_SORT = {
  invoiceNo: (r: InvoiceHeaderRow) => r.InvoiceNo,
  date: (r: InvoiceHeaderRow) => isoDate(r.InvDate),
  cust: (r: InvoiceHeaderRow) => r.CustName ?? r.CustCode ?? "",
  lines: (r: InvoiceHeaderRow) => Number(r.LineCount),
  amount: (r: InvoiceHeaderRow) => Number(r.Amount),
};

export const INVOICE_LIST_SORT_DEFAULT = { key: "date", desc: true } as const;

export function InvoiceListTable({
  headers,
  state,
  canSeeMoney,
}: {
  headers: readonly InvoiceHeaderRow[];
  state: SalesUrlState;
  canSeeMoney: boolean;
}) {
  const columns: DataTableColumn[] = [
    { key: "invoiceNo", label: "เลขที่ใบแจ้งหนี้", sortable: true },
    { key: "date", label: "วันที่", sortable: true },
    { key: "cust", label: "ลูกค้า", sortable: true },
    { key: "lines", label: "จำนวนรายการ", sortable: true, align: "right" },
  ];
  if (canSeeMoney) {
    columns.push({ key: "amount", label: "ยอดเงิน", sortable: true, align: "right" });
  }

  const sorted = sortRows<InvoiceHeaderRow>(headers, state.sort, INVOICE_LIST_SORT, {
    ...INVOICE_LIST_SORT_DEFAULT,
  });
  const pageRows = paginate(sorted, state.page);

  const rows: DataTableRow[] = pageRows.map((header) => {
    const row: DataTableRow = {
      invoiceNo: (
        <Link
          href={salesHref(state.raw, {
            invoiceNo: header.InvoiceNo,
            doNo: null,
            view: null,
            page: null,
            sort: null,
          })}
          data-testid={`invoice-link-${header.InvoiceNo}`}
          className="font-medium text-[var(--text)] hover:underline"
        >
          {header.InvoiceNo}
        </Link>
      ),
      date: beShort(isoDate(header.InvDate)),
      cust: (
        <span className="flex flex-col">
          <span className="th text-[var(--text)]">{header.CustName ?? header.CustCode}</span>
          <span className="text-[11px] text-[var(--text-faint)]">{header.CustCode}</span>
        </span>
      ),
      lines: formatInt(Number(header.LineCount)),
    };
    // Money is ABSENT from the row object, not blanked, when the viewer is not an Admin.
    if (canSeeMoney) {
      row.amount = Number(header.Amount) > 0 ? formatMoney(Number(header.Amount)) : "—";
    }
    return row;
  });

  return (
    <div data-testid="invoice-list-table">
      <DashboardDataTable
        columns={columns}
        rows={rows}
        basePath="/dashboards/sales"
        searchParams={state.raw}
        currentSort={state.sort ?? "-date"}
        currentPage={state.page}
        pageSize={SALES_PAGE_SIZE}
        totalRows={sorted.length}
        mobileTitleKey="invoiceNo"
        emptyText="ไม่พบใบแจ้งหนี้ตามเงื่อนไขที่เลือก"
      />
    </div>
  );
}
