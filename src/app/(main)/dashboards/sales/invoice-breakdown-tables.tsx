import * as React from "react";
import { formatMoney, formatQty } from "@/lib/sales-basis-core";
import type { InvoiceCustomerRow, InvoiceProductRow } from "@/lib/sales-queries";
import { BreakdownCard, type BreakdownColumn } from "./sales-breakdown-tables";
import {
  INVOICE_CUSTOMER_PAGE_PARAM,
  INVOICE_PRODUCT_PAGE_PARAM,
  clearPageParams,
  salesHref,
  type RawSearchParams,
} from "./sales-url";

// sales-invoice-basis (23-09-26) — the INVOICE section's ยอดตามสินค้า / ยอดตามลูกค้า breakdowns.
//
// REUSE, NOT FORK: these render through the SAME `BreakdownCard` the delivery breakdowns use — it
// was already generic over the row type, so the invoice shapes needed no adapter and no second
// pagination/mobile-card/link-contract implementation exists. Only the columns, the drilldown
// hrefs and the page keys differ.
//
// PAGE KEYS: `invoiceProductPage` / `invoiceCustomerPage`. The two sections' breakdown tables
// render SIMULTANEOUSLY on the summary view, so sharing `productPage`/`customerPage` would make
// paging one table silently move the other.
//
// PER-UNIT QUANTITIES: `invoice-by-customer.sql` yields ONE ROW PER (customer, unit), which is
// grouped back into one row per customer carrying separate "qty unit" entries. There is no
// cross-unit total anywhere.
//
// MONEY (AC9): money columns are omitted from the markup entirely when `canSeeMoney` is false.

const productColumns = (
  canSeeMoney: boolean,
): Array<BreakdownColumn<InvoiceProductRow>> => {
  const columns: Array<BreakdownColumn<InvoiceProductRow>> = [
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
    { key: "unit", label: "หน่วย", render: (r) => r.Unit, csvLabel: "หน่วย", csvValue: (r) => r.Unit },
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

/** One row per customer, carrying that customer's per-unit quantities (never a cross-unit total). */
export interface InvoiceCustomerGroup {
  custCode: string;
  custName: string;
  units: Array<{ unit: string; qty: number }>;
  amount: number;
  invoiceCount: number;
}

export function groupInvoiceCustomers(
  rows: readonly InvoiceCustomerRow[],
): InvoiceCustomerGroup[] {
  const groups = new Map<string, InvoiceCustomerGroup>();
  for (const row of rows) {
    const code = row.CustCode ?? "-";
    const existing = groups.get(code) ?? {
      custCode: code,
      custName: row.CustName ?? code,
      units: [],
      amount: 0,
      invoiceCount: 0,
    };
    existing.units.push({ unit: row.Unit, qty: Number(row.Qty) });
    existing.amount += Number(row.Amount);
    // The SQL counts DISTINCT invoices per (customer, unit); a customer's true invoice count is the
    // max across its unit rows, never their sum — the same invoice appears under several units.
    existing.invoiceCount = Math.max(existing.invoiceCount, Number(row.InvoiceCount));
    groups.set(code, existing);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount || a.custName.localeCompare(b.custName, "th"));
}

export function InvoiceBreakdownTables({
  products,
  customers,
  canSeeMoney,
  searchParams,
  productPage,
  customerPage,
}: {
  products: readonly InvoiceProductRow[];
  customers: readonly InvoiceCustomerRow[];
  canSeeMoney: boolean;
  searchParams: RawSearchParams;
  productPage: number;
  customerPage: number;
}) {
  const customerGroups = groupInvoiceCustomers(customers);

  const customerColumns: Array<BreakdownColumn<InvoiceCustomerGroup>> = [
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

  // Drilling down leaves the summary view entirely, so every page key resets — including the
  // delivery section's, which would otherwise linger in the URL as dead state.
  const drilldownReset = clearPageParams();

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
      <BreakdownCard<InvoiceProductRow>
        title="ยอดตามสินค้า"
        subtitle="คลิกแถวเพื่อดูใบแจ้งหนี้ของสินค้านั้น"
        columns={productColumns(canSeeMoney)}
        rows={products}
        rowKey={(r) => r.ItemCode}
        rowHref={(r) =>
          salesHref(searchParams, {
            ...drilldownReset,
            view: "invoice-documents",
            product: r.ItemCode,
            customer: null,
            doNo: null,
            invoiceNo: null,
          })
        }
        testId="invoice-product-breakdown"
        emptyText="ไม่พบใบแจ้งหนี้ตามเงื่อนไขที่เลือก"
        pageParam={INVOICE_PRODUCT_PAGE_PARAM}
        currentPage={productPage}
        searchParams={searchParams}
      />

      <BreakdownCard<InvoiceCustomerGroup>
        title="ยอดตามลูกค้า"
        subtitle="คลิกแถวเพื่อดูใบแจ้งหนี้ของลูกค้านั้น"
        columns={customerColumns}
        rows={customerGroups}
        rowKey={(r) => r.custCode}
        rowHref={(r) =>
          salesHref(searchParams, {
            ...drilldownReset,
            view: "invoice-documents",
            customer: r.custCode,
            product: null,
            doNo: null,
            invoiceNo: null,
          })
        }
        testId="invoice-customer-breakdown"
        emptyText="ไม่พบใบแจ้งหนี้ตามเงื่อนไขที่เลือก"
        pageParam={INVOICE_CUSTOMER_PAGE_PARAM}
        currentPage={customerPage}
        searchParams={searchParams}
      />
    </div>
  );
}
