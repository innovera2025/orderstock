import * as React from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { ceToBeDisplay, parseDateInputValue } from "@/lib/be-date";
import {
  ACTUAL_PRODUCED_EMPTY_TEXT,
  formatQty,
  moStatusLabel,
  moStatusTone,
} from "@/lib/production-status";
import { isoDate, type MoListRow } from "@/lib/production-data";
import {
  PRODUCTION_BASE_PATH,
  PRODUCTION_PAGE_SIZE,
  moDetailHref,
  paginate,
  sortRows,
  type ProductionUrlState,
} from "./production-url";

// erp-dashboards Phase 4 — the MO list (desktop table + mobile cards via the shared Phase 1
// component, which renders both from one `rows` array).
//
// AC7 STRUCTURAL GUARANTEE: the "ผลิตจริง" cell is produced by `ActualProducedCell`, a component
// that accepts NO props at all. There is no numeric value anywhere in its call path, so it cannot
// regress into printing `Prodqty` — a future edit would have to add a parameter first.

/** The plan-only "actual produced" cell. Takes no props, by design. */
function ActualProducedCell() {
  return (
    <span data-testid="mo-actual-produced" className="th text-[var(--text-faint)]">
      {ACTUAL_PRODUCED_EMPTY_TEXT}
    </span>
  );
}

const columns: DataTableColumn[] = [
  { key: "moNo", label: "เลขที่ใบสั่งผลิต", sortable: true },
  { key: "item", label: "สินค้า", sortable: true },
  { key: "date", label: "วันที่ตามแผน", sortable: true },
  { key: "qty", label: "ปริมาณตามแผน", sortable: true, align: "right" },
  { key: "status", label: "สถานะ", sortable: true },
  { key: "actual", label: "ผลิตจริง" },
];

export function MoListTable({
  mos,
  state,
}: {
  mos: readonly MoListRow[];
  state: ProductionUrlState;
}) {
  const sorted = sortRows(
    mos,
    state.sort,
    {
      moNo: (r) => r.MoNumBer,
      item: (r) => r.FgName,
      date: (r) => isoDate(r.Modate),
      qty: (r) => Number(r.PlannedQty),
      status: (r) => r.StatusKey,
    },
    { key: "moNo", desc: true },
  );

  const rows: DataTableRow[] = paginate(sorted, state.page).map((mo) => {
    const iso = isoDate(mo.Modate);
    return {
      moNo: (
        <Link
          href={moDetailHref(mo.MoNumBer, state.raw)}
          data-testid={`mo-row-${mo.MoNumBer}`}
          className="font-medium text-[var(--text)] underline-offset-2 hover:underline"
        >
          {mo.MoNumBer}
        </Link>
      ),
      item: (
        <span className="flex flex-col">
          <span className="th text-[var(--text)]">{mo.FgName}</span>
          <span className="th text-[11px] text-[var(--text-faint)]">{mo.FgCode}</span>
        </span>
      ),
      date: (
        <span className="tabular-nums">{iso ? ceToBeDisplay(parseDateInputValue(iso)) : "—"}</span>
      ),
      qty: (
        <span className="tabular-nums">
          {formatQty(Number(mo.PlannedQty))} <span className="th">{mo.MainUnits}</span>
        </span>
      ),
      status: (
        <Chip tone={moStatusTone(mo.StatusKey)}>
          <span className="th">{moStatusLabel(mo.StatusKey)}</span>
        </Chip>
      ),
      actual: <ActualProducedCell />,
    };
  });

  return (
    <DashboardDataTable
      columns={columns}
      rows={rows}
      basePath={PRODUCTION_BASE_PATH}
      searchParams={state.raw}
      currentSort={state.sort ?? undefined}
      currentPage={state.page}
      pageSize={PRODUCTION_PAGE_SIZE}
      totalRows={sorted.length}
      mobileTitleKey="moNo"
      emptyText="ไม่มีใบสั่งผลิตตามเงื่อนไขที่เลือก"
    />
  );
}
