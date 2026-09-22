import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatMoney, formatQty } from "@/lib/sales-basis-core";
import type { DoCustomerRow, DoProductRow } from "@/lib/sales-queries";
import { salesHref, type RawSearchParams } from "./sales-url";

// erp-dashboards Phase 2 — the summary view's two breakdown tables: ยอดตามสินค้า / ยอดตามลูกค้า.
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
// CSV-EXPORT READINESS (this phase's own convention, consumed by Phase 5's export route — Phase 1's
// shared data-table has no export wiring): each column below declares a `csvLabel` (header text)
// and a `csvValue` (raw, unformatted cell value) next to its rendered form, so a future export can
// be generated from the same definition rather than re-deriving it from rendered HTML.

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

function BreakdownCard<T>({
  title,
  subtitle,
  columns,
  rows,
  rowKey,
  rowHref,
  testId,
  emptyText,
}: {
  title: string;
  subtitle: string;
  columns: Array<BreakdownColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  rowHref: (row: T) => string;
  testId: string;
  emptyText: string;
}) {
  return (
    <Card className="overflow-hidden" data-testid={testId}>
      <div className="border-b border-[var(--border)] p-4">
        <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">{title}</h2>
        <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="th p-6 text-center text-[var(--t-sm)] text-[var(--text-faint)]">{emptyText}</p>
      ) : (
        <table className="w-full border-collapse text-[var(--t-sm)]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={
                    "th px-3 py-2 font-medium text-[var(--text-muted)] " +
                    (col.align === "right" ? "text-right" : "text-left")
                  }
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                data-testid={`${testId}-row-${rowKey(row)}`}
                className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-sunken)]"
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={
                      "px-3 py-2 text-[var(--text)] " +
                      (col.align === "right" ? "text-right tabular-nums" : "text-left")
                    }
                  >
                    {i === 0 ? (
                      <Link href={rowHref(row)} className="hover:underline">
                        {col.render(row)}
                      </Link>
                    ) : (
                      col.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
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
}: {
  products: readonly DoProductRow[];
  customers: readonly DoCustomerRow[];
  canSeeMoney: boolean;
  searchParams: RawSearchParams;
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

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <BreakdownCard<DoProductRow>
        title="ยอดตามสินค้า"
        subtitle="คลิกแถวเพื่อดูใบส่งสินค้าของสินค้านั้น"
        columns={productColumns(canSeeMoney)}
        rows={products}
        rowKey={(r) => r.ItemCode}
        rowHref={(r) =>
          salesHref(searchParams, {
            view: "documents",
            product: r.ItemCode,
            customer: null,
            doNo: null,
            page: null,
          })
        }
        testId="sales-product-breakdown"
        emptyText="ไม่พบใบส่งสินค้าตามเงื่อนไขที่เลือก"
      />

      <BreakdownCard<CustomerGroup>
        title="ยอดตามลูกค้า"
        subtitle="คลิกแถวเพื่อดูใบส่งสินค้าของลูกค้านั้น"
        columns={customerColumns}
        rows={customerGroups}
        rowKey={(r) => r.custCode}
        rowHref={(r) =>
          salesHref(searchParams, {
            view: "documents",
            customer: r.custCode,
            product: null,
            doNo: null,
            page: null,
          })
        }
        testId="sales-customer-breakdown"
        emptyText="ไม่พบใบส่งสินค้าตามเงื่อนไขที่เลือก"
      />
    </div>
  );
}
