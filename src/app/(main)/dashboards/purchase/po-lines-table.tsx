import * as React from "react";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { formatMoney, formatQtyWithUnit } from "@/lib/purchase-calc";
import { OutstandingQty } from "./outstanding-qty";
import { PURCHASE_PAGE_SIZE, paginate, sortRows, type PurchaseUrlState } from "./purchase-url";
import type { PoLineView } from "./purchase-view";

// erp-dashboards Phase 3 — the PO-lines table (drilldown step 2 of 2), on the PO detail page.
//
// Same shared `DashboardDataTable` as the list, so sort/paginate/mobile-card behave identically and
// the URL contract is the one Phase 1 owns. Sorting here uses its own `?sort=` value on the detail
// route, so it cannot disturb the list's sort behind it.
//
// MONEY (AC9): `unitPrice`/`amount` are already ABSENT from every `PoLineView` when the viewer is
// not an Admin (stripped in `purchase-view.ts`), and the two money columns are not even added to
// the column list here. A Staff user's HTML contains no price markup at all.

export function PoLinesTable({
  lines,
  state,
  canSeeMoney,
  basePath,
}: {
  lines: readonly PoLineView[];
  state: PurchaseUrlState;
  canSeeMoney: boolean;
  /** This PO's own detail path, so sort/page links stay on the detail page. */
  basePath: string;
}) {
  const columns: DataTableColumn[] = [
    { key: "item", label: "รหัสสินค้า", sortable: true },
    { key: "qty", label: "จำนวนสั่ง", sortable: true, align: "right" },
    { key: "received", label: "จำนวนรับแล้ว", sortable: true, align: "right" },
    { key: "outstanding", label: "จำนวนค้างรับ", sortable: true, align: "right" },
  ];
  if (canSeeMoney) {
    columns.push({ key: "price", label: "ราคาต่อหน่วย", sortable: true, align: "right" });
    columns.push({ key: "amount", label: "จำนวนเงิน", sortable: true, align: "right" });
  }

  const sorted = sortRows<PoLineView>(
    lines,
    state.sort,
    {
      item: (r) => r.itemCode,
      qty: (r) => r.qty,
      received: (r) => r.received,
      outstanding: (r) => r.outstanding,
      price: (r) => r.unitPrice ?? 0,
      amount: (r) => r.amount ?? 0,
    },
    { key: "item", desc: false },
  );

  const rows: DataTableRow[] = paginate(sorted, state.page).map((line) => {
    const row: DataTableRow = {
      item: (
        <span className="th font-medium text-[var(--text)]">{line.itemCode}</span>
      ),
      // Quantities always carry their unit — they are never summed across units anywhere.
      qty: formatQtyWithUnit(line.qty, line.unit),
      received: formatQtyWithUnit(line.received, line.unit),
      outstanding: <OutstandingQty value={line.outstanding} unit={line.unit} />,
    };
    // AC9 — money keys are ADDED for Admin; for Staff they never exist on the row object.
    if (canSeeMoney) {
      row.price = formatMoney(line.unitPrice ?? 0);
      row.amount = formatMoney(line.amount ?? 0);
    }
    return row;
  });

  return (
    <div data-testid="po-lines-table" className="flex flex-col gap-2">
      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
        รายการในใบสั่งซื้อ
      </h2>
      <DashboardDataTable
        columns={columns}
        rows={rows}
        basePath={basePath}
        searchParams={state.raw}
        currentSort={state.sort ?? "item"}
        currentPage={state.page}
        pageSize={PURCHASE_PAGE_SIZE}
        totalRows={sorted.length}
        mobileTitleKey="item"
        emptyText="ไม่มีรายการในใบสั่งซื้อนี้"
      />
    </div>
  );
}
