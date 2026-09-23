import * as React from "react";
import Link from "next/link";
import {
  DashboardDataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/dashboard-data-table";
import { formatMoney, formatQty } from "@/lib/sales-basis-core";
import type { DoCustomerRow, DoProductRow } from "@/lib/sales-queries";
import {
  CUSTOMER_PAGE_PARAM,
  PRODUCT_PAGE_PARAM,
  SALES_BASE_PATH,
  SALES_PAGE_SIZE,
  clearPageParams,
  paginate,
  salesHref,
  type RawSearchParams,
} from "./sales-url";

// erp-dashboards Phase 2 — the summary view's two breakdown tables: ยอดตามสินค้า / ยอดตามลูกค้า.
//
// PAGINATION (sales-breakdown-pagination, 23-09-26): these two tables used to be hand-rolled and
// rendered EVERY row — on the live ERP that was 135 products / 21 customers and a ~9,000px page.
// They now go through the SAME shared `DashboardDataTable` the PO and MO lists use, so page size,
// footer wording ("หน้า X จาก Y"), the mobile card branch and the "preserve every other search
// param" link contract are all inherited rather than re-implemented. Nothing about this component
// needed a second pagination implementation:
//   - the per-unit customer quantities were always ONE cell (a " · "-joined string), not sub-rows;
//   - row-click filtering is just a `<Link>` INSIDE the first cell's ReactNode, which the shared
//     table renders verbatim;
//   - the only genuinely missing capability was a per-row `data-testid` keyed on the business code
//     (ItemCode / CustCode), added to the shared component as the optional, default-off
//     `rowTestId` prop rather than by forking it.
// The two tables page INDEPENDENTLY via their own query keys (`productPage` / `customerPage`), so
// turning one never moves the other, and `page` still belongs to the DO list alone.
//
// DRILLDOWN: every row links to the DO list filtered by that product or customer — step one of
// breakdown → DO list → DO lines (AC11).
//
// GROUPING IDENTITY: products group by `ItemCode`, customers by `CustCode` — never by display name.
// `CustName` is shown but never grouped on (the data dictionary's explicit caution).
//
// CANONICAL ITEM ROW: the product name / unit / category on each row already comes from the single
// highest-Roworder InventoryItem row resolved in `do-by-product.sql` (registry Cross-Phase
// Precondition, E5) — this component never re-looks-up an item by a possibly-duplicated ItemCode.
//
// PER-UNIT QUANTITIES: a customer yields ONE ROW PER UNIT from `do-by-customer.sql`, which this
// component renders as separate "qty unit" entries. There is no cross-unit total anywhere.
//
// MONEY (AC9): money columns are omitted from the markup entirely when `canSeeMoney` is false.
//
// CSV-EXPORT READINESS (this phase's own convention, consumed by Phase 5's export route): each
// column below declares a `csvLabel` (header text) and a `csvValue` (raw, unformatted cell value)
// next to its rendered form, so an export can be generated from the same definition rather than
// re-derived from rendered HTML. The breakdown tables themselves opt OUT of the shared table's
// export button (`exportHref={false}`) — `deriveExportTarget()` would resolve `/dashboards/sales`
// to the DO-LIST dataset, so an inherited button here would silently download the wrong file.

export interface BreakdownColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** CSV convention (Phase 5 consumes these; no export route is built in this phase). */
  csvLabel: string;
  csvValue: (row: T) => string | number;
}

const productColumns = (canSeeMoney: boolean): Array<BreakdownColumn<DoProductRow>> => {
  const columns: Array<BreakdownColumn<DoProductRow>> = [
    {
      key: "item",
      label: "สินค้า",
      render: (r) => (
        <span className="flex flex-col">
          <span className="th text-[var(--text)]">{r.ItemName}</span>
          <span className="text-[11px] text-[var(--text-faint)]">{r.ItemCode}</span>
        </span>
      ),
      csvLabel: "สินค้า",
      csvValue: (r) => r.ItemName,
    },
    {
      key: "qty",
      label: "จำนวน",
      align: "right",
      render: (r) => formatQty(Number(r.Qty)),
      csvLabel: "จำนวน",
      csvValue: (r) => Number(r.Qty),
    },
    {
      key: "unit",
      label: "หน่วย",
      render: (r) => r.Unit,
      csvLabel: "หน่วย",
      csvValue: (r) => r.Unit,
    },
  ];
  if (canSeeMoney) {
    columns.push({
      key: "amount",
      label: "ยอดเงิน",
      align: "right",
      render: (r) => (Number(r.Amount) > 0 ? formatMoney(Number(r.Amount)) : "—"),
      csvLabel: "ยอดเงิน",
      csvValue: (r) => Number(r.Amount),
    });
  }
  return columns;
};

/**
 * One breakdown table: its own heading, its own page key, and the shared data table underneath.
 *
 * The heading stays OUTSIDE `DashboardDataTable` (which is deliberately data-shape agnostic and
 * owns no title), and the wrapping element keeps `data-testid={testId}` so existing selectors that
 * scope into this table — including the drilldown gates — are unchanged.
 *
 * EXPORTED (sales-invoice-basis, 23-09-26) so the INVOICE section's breakdown tables reuse this
 * exact component rather than forking it. It is already generic over the row type `T`, so the
 * invoice row shapes needed no adapter — this is the real reusable seam, whereas
 * `SalesBreakdownTables` below is a delivery-specific composition of two instances of it.
 */
export function BreakdownCard<T>({
  title,
  subtitle,
  columns,
  rows,
  rowKey,
  rowHref,
  testId,
  emptyText,
  pageParam,
  currentPage,
  searchParams,
}: {
  title: string;
  subtitle: string;
  columns: Array<BreakdownColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  rowHref: (row: T) => string;
  testId: string;
  emptyText: string;
  pageParam: string;
  currentPage: number;
  searchParams: RawSearchParams;
}) {
  // The row's business key rides along as a hidden field so `rowTestId` can read it back out of
  // the (deliberately shape-agnostic) row object the shared table receives.
  const keyField = "__key";

  const tableColumns: DataTableColumn[] = columns.map((col) => ({
    key: col.key,
    label: col.label,
    align: col.align,
  }));

  const tableRows: DataTableRow[] = paginate(rows, currentPage).map((row) => {
    const out: DataTableRow = { [keyField]: rowKey(row) };
    columns.forEach((col, i) => {
      // Only the FIRST cell is the drilldown link — the same click target as before.
      out[col.key] =
        i === 0 ? (
          <Link href={rowHref(row)} className="hover:underline">
            {col.render(row)}
          </Link>
        ) : (
          col.render(row)
        );
    });
    return out;
  });

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div>
        <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">{title}</h2>
        <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">{subtitle}</p>
      </div>
      <DashboardDataTable
        columns={tableColumns}
        rows={tableRows}
        basePath={SALES_BASE_PATH}
        searchParams={searchParams}
        pageParam={pageParam}
        currentPage={currentPage}
        pageSize={SALES_PAGE_SIZE}
        totalRows={rows.length}
        mobileTitleKey={columns[0]?.key}
        emptyText={emptyText}
        rowTestId={(row) => `${testId}-row-${String(row[keyField] ?? "")}`}
        exportHref={false}
      />
    </div>
  );
}

/** One row per customer, carrying that customer's per-unit quantities (never a cross-unit total). */
interface CustomerGroup {
  custCode: string;
  custName: string;
  units: Array<{ unit: string; qty: number }>;
  amount: number;
}

function groupCustomers(rows: readonly DoCustomerRow[]): CustomerGroup[] {
  const groups = new Map<string, CustomerGroup>();
  for (const row of rows) {
    const code = row.CustCode ?? "-";
    const existing = groups.get(code) ?? {
      custCode: code,
      custName: row.CustName ?? code,
      units: [],
      amount: 0,
    };
    existing.units.push({ unit: row.Unit, qty: Number(row.Qty) });
    existing.amount += Number(row.Amount);
    groups.set(code, existing);
  }
  return [...groups.values()].sort((a, b) => a.custName.localeCompare(b.custName, "th"));
}

export function SalesBreakdownTables({
  products,
  customers,
  canSeeMoney,
  searchParams,
  productPage,
  customerPage,
}: {
  products: readonly DoProductRow[];
  customers: readonly DoCustomerRow[];
  canSeeMoney: boolean;
  searchParams: RawSearchParams;
  productPage: number;
  customerPage: number;
}) {
  const customerGroups = groupCustomers(customers);

  const customerColumns: Array<BreakdownColumn<CustomerGroup>> = [
    {
      key: "cust",
      label: "ลูกค้า",
      render: (r) => (
        <span className="flex flex-col">
          <span className="th text-[var(--text)]">{r.custName}</span>
          <span className="text-[11px] text-[var(--text-faint)]">{r.custCode}</span>
        </span>
      ),
      csvLabel: "ลูกค้า",
      csvValue: (r) => r.custName,
    },
    {
      key: "qty",
      label: "จำนวน (ตามหน่วย)",
      align: "right",
      render: (r) => r.units.map((u) => `${formatQty(u.qty)} ${u.unit}`).join(" · "),
      csvLabel: "จำนวน (ตามหน่วย)",
      csvValue: (r) => r.units.map((u) => `${u.qty} ${u.unit}`).join(" · "),
    },
  ];
  if (canSeeMoney) {
    customerColumns.push({
      key: "amount",
      label: "ยอดเงิน",
      align: "right",
      render: (r) => (r.amount > 0 ? formatMoney(r.amount) : "—"),
      csvLabel: "ยอดเงิน",
      csvValue: (r) => r.amount,
    });
  }

  // Drilling down leaves the summary view entirely, so every page key resets — including the other
  // table's, which would otherwise linger in the URL as dead state.
  const drilldownReset = clearPageParams();

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
      <BreakdownCard<DoProductRow>
        title="ยอดตามสินค้า"
        subtitle="คลิกแถวเพื่อดูใบส่งสินค้าของสินค้านั้น"
        columns={productColumns(canSeeMoney)}
        rows={products}
        rowKey={(r) => r.ItemCode}
        rowHref={(r) =>
          salesHref(searchParams, {
            ...drilldownReset,
            view: "documents",
            product: r.ItemCode,
            customer: null,
            doNo: null,
          })
        }
        testId="sales-product-breakdown"
        emptyText="ไม่พบใบส่งสินค้าตามเงื่อนไขที่เลือก"
        pageParam={PRODUCT_PAGE_PARAM}
        currentPage={productPage}
        searchParams={searchParams}
      />

      <BreakdownCard<CustomerGroup>
        title="ยอดตามลูกค้า"
        subtitle="คลิกแถวเพื่อดูใบส่งสินค้าของลูกค้านั้น"
        columns={customerColumns}
        rows={customerGroups}
        rowKey={(r) => r.custCode}
        rowHref={(r) =>
          salesHref(searchParams, {
            ...drilldownReset,
            view: "documents",
            customer: r.custCode,
            product: null,
            doNo: null,
          })
        }
        testId="sales-customer-breakdown"
        emptyText="ไม่พบใบส่งสินค้าตามเงื่อนไขที่เลือก"
        pageParam={CUSTOMER_PAGE_PARAM}
        currentPage={customerPage}
        searchParams={searchParams}
      />
    </div>
  );
}
