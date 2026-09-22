import * as React from "react";
import Link from "next/link";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { beShort, formatMoney, formatQtyWithUnit, poStatusLabel } from "@/lib/purchase-calc";
import { PoStatusBadges, PoStatusCaveatNote } from "./purchase-status-badges";
import { OutstandingQty } from "./outstanding-qty";
import {
  PURCHASE_BASE_PATH,
  PURCHASE_PAGE_SIZE,
  paginate,
  poDetailHref,
  sortRows,
  type PurchaseUrlState,
} from "./purchase-url";
import type { PoView } from "./purchase-view";

// erp-dashboards Phase 3 — the PO list (drilldown step 1 of 2).
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
// `canSeeMoney` is true, and the underlying `PoView.totalAmount` is already absent for Staff (see
// `purchase-view.ts`). A Staff user's server-rendered HTML contains neither the header cell nor any
// value — nothing is rendered-then-hidden.
//
// CSV-EXPORT READINESS: `PO_LIST_CSV_COLUMNS` is this phase's column-shape convention for Phase 5's
// export route — each column key paired with its CSV header and a raw, unformatted accessor.

export const PO_LIST_CSV_COLUMNS: ReadonlyArray<{
  key: string;
  csvLabel: string;
  csvValue: (row: PoView) => string | number;
  money?: boolean;
}> = [
  { key: "poNo", csvLabel: "เลขที่ใบสั่งซื้อ", csvValue: (r) => r.poNumber },
  { key: "date", csvLabel: "วันที่", csvValue: (r) => r.date },
  { key: "supplier", csvLabel: "ซัพพลายเออร์", csvValue: (r) => r.supplierCode },
  { key: "status", csvLabel: "สถานะ", csvValue: (r) => `${poStatusLabel(r.status)} (ยังไม่ผ่านการยืนยัน)` },
  {
    key: "recv",
    csvLabel: "รับแล้ว/ค้างรับ",
    csvValue: (r) =>
      r.unitTotals.map((u) => `${u.unit}: รับ ${u.received} ค้าง ${u.outstanding}`).join("; "),
  },
  { key: "amount", csvLabel: "ยอดเงิน", csvValue: (r) => r.totalAmount ?? 0, money: true },
];

export function PoListTable({
  views,
  state,
  canSeeMoney,
}: {
  views: readonly PoView[];
  state: PurchaseUrlState;
  canSeeMoney: boolean;
}) {
  const columns: DataTableColumn[] = [
    { key: "poNo", label: "เลขที่ใบสั่งซื้อ", sortable: true },
    { key: "date", label: "วันที่", sortable: true },
    { key: "supplier", label: "ซัพพลายเออร์", sortable: true },
    { key: "status", label: "สถานะ", sortable: true },
    { key: "recv", label: "รับแล้ว/ค้างรับ" },
  ];
  if (canSeeMoney) {
    columns.push({ key: "amount", label: "ยอดเงิน", sortable: true, align: "right" });
  }

  const sorted = sortRows<PoView>(
    views,
    state.sort,
    {
      poNo: (r) => r.poNumber,
      date: (r) => r.date,
      supplier: (r) => r.supplierCode,
      status: (r) => poStatusLabel(r.status),
      amount: (r) => r.totalAmount ?? 0,
    },
    { key: "date", desc: true },
  );

  const rows: DataTableRow[] = paginate(sorted, state.page).map((view) => {
    const row: DataTableRow = {
      poNo: (
        <Link
          href={poDetailHref(state.raw, view.poNumber)}
          data-testid={`po-link-${view.poNumber}`}
          className="font-medium text-[var(--text)] hover:underline"
        >
          {view.poNumber}
        </Link>
      ),
      date: beShort(view.date),
      supplier: <span className="th text-[var(--text)]">{view.supplierCode}</span>,
      status: <PoStatusBadges status={view.status} />,
      recv:
        view.unitTotals.length === 0 ? (
          <span className="text-[var(--text-faint)]">—</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            {view.unitTotals.map((unit) => (
              <span key={unit.unit} className="th text-[12px]">
                รับ <span className="tabular-nums">{formatQtyWithUnit(unit.received, unit.unit)}</span>
                {" · "}
                <OutstandingQty value={unit.outstanding} unit={unit.unit} />
              </span>
            ))}
          </span>
        ),
    };
    // AC9 — money is ABSENT from the row object, not blanked, when the viewer is not an Admin.
    if (canSeeMoney) {
      row.amount = formatMoney(view.totalAmount ?? 0);
    }
    return row;
  });

  return (
    <div data-testid="po-list-table" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          ใบสั่งซื้อ
        </h2>
        <PoStatusCaveatNote />
      </div>
      <DashboardDataTable
        columns={columns}
        rows={rows}
        basePath={PURCHASE_BASE_PATH}
        searchParams={state.raw}
        currentSort={state.sort ?? "-date"}
        currentPage={state.page}
        pageSize={PURCHASE_PAGE_SIZE}
        totalRows={sorted.length}
        mobileTitleKey="poNo"
        emptyText="ไม่พบใบสั่งซื้อตามเงื่อนไขที่เลือก"
      />
    </div>
  );
}
