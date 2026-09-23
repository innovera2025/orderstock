import * as React from "react";
import { requireAuth } from "@/lib/auth-guard";
import { PilotBanner } from "@/components/pilot-banner";
import { DegradeBanner } from "@/components/degrade-banner";
import { erpDegradeState } from "@/lib/erp/degrade";
import {
  aggregateSupplierBreakdown,
  inPurchaseBin,
  purchaseTimeBins,
} from "@/lib/purchase-calc";
import { toErpDataRange } from "@/lib/erp-date-range";
import {
  fetchPoCommittedTotals,
  fetchPoDateRange,
  fetchPoLines,
  fetchPoList,
  fetchPoReceived,
  fetchPurchaseInvoices,
  fetchSupplierBreakdown,
  isoDate,
  toNumber,
  type PurchaseFilters,
} from "@/lib/purchase-data";
import { PurchaseFilterBar } from "./purchase-filter-bar";
import { PurchaseKpiTiles } from "./purchase-kpi-tiles";
import {
  PurchasePeriodChart,
  PurchaseSupplierChart,
  SupplierCountList,
  type PurchaseChartBin,
  type SupplierBarRow,
} from "./purchase-chart";
import { PurchaseStatusDonut, PurchaseSupplierDonut } from "./purchase-donuts";
import { PoListTable } from "./po-list-table";
import { PurchaseUnavailable } from "./purchase-unavailable";
import { parsePurchaseUrl, type RawSearchParams } from "./purchase-url";
import { buildPoViews, countByStatus } from "./purchase-view";

// แดชบอร์ดการซื้อ — /dashboards/purchase (erp-dashboards Phase 3).
//
// SERVER COMPONENT, READ-ONLY. Every ERP read goes through Phase 1's `guardedQuery()` choke point
// (via `purchase-data.ts`), wrapped in Phase 1's TTL cache + degrade helper. No Prisma touches an
// ERP table; no ERP model exists in `prisma/schema.prisma`; nothing here can write to db_TCL.
//
// AUTH (AC1): `requireAuth()` with no role argument — ADMIN and STAFF both get the page;
// `proxy.ts` redirects an unauthenticated request to /login before this ever runs.
//
// MONEY (AC9): `canSeeMoney` is computed ONCE here from the server-side session and threaded down
// as DATA SHAPE (which fields exist, which tiles and charts render at all). It is never a CSS class
// and never a client check — a Staff user's HTML contains no money markup.
//
// TWO BASES, EQUAL WEIGHT (AC5): the invoice basis (KRS's own sp_PurchaseInvoiceMonth rule) and the
// PO-committed basis are both shown, neither styled as subordinate, each labelled with its basis.
// They answer different questions and legitimately diverge.
//
// STATUS (AC6): derived in `derivePoStatus()` from the ERP's flag columns, never read off the free-
// text `Status` column, and ALWAYS rendered beside its "ยังไม่ผ่านการยืนยัน" caveat badge.

export const dynamic = "force-dynamic";

export default async function PurchaseDashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireAuth();
  const canSeeMoney = user.role === "ADMIN";

  const raw = await searchParams;
  const state = parsePurchaseUrl(raw);

  const filters: PurchaseFilters = {
    from: state.from,
    to: state.to,
    supplier: state.supplier,
  };

  // CROSS-FILTER SEMANTICS: the supplier chart and donut run with the supplier dimension EXCLUDED,
  // so a selected supplier never collapses its own chart to 100%. Everything else uses the full
  // filter set. The status donut is fed from the unfiltered-by-status header set for the same
  // reason (status is filtered in TS, below, not in SQL).
  //
  // COLD-START / OUTAGE PATH: `getCached()` re-throws when a live read fails and nothing has ever
  // been cached. That throw would render Next's generic 500, so it is caught here and turned into
  // the explicit Thai "ERP unavailable" view. The stale-data path still renders the full dashboard
  // behind `DegradeBanner`.
  let invoices, poTotals, supplierRows, headers, lines, received, allSupplierInvoices, dateRange;
  try {
    [invoices, poTotals, supplierRows, headers, lines, received, allSupplierInvoices, dateRange] =
      await Promise.all([
        fetchPurchaseInvoices(filters),
        fetchPoCommittedTotals(filters),
        fetchSupplierBreakdown(filters, { skipSupplier: true }),
        fetchPoList(filters),
        fetchPoLines(filters),
        fetchPoReceived(),
        fetchPurchaseInvoices(filters, { skipSupplier: true }),
        // UNFILTERED on purpose: the ช่วงข้อมูล notice reports what the ERP holds, not what the
        // current filter selected.
        fetchPoDateRange(),
      ]);
  } catch (error) {
    // Never log the connection string or any row content — just the failure itself.
    console.error(
      "[dashboards/purchase] ERP read failed and no cached value exists; rendering the unavailable state.",
      error instanceof Error ? error.message : error,
    );
    return <PurchaseUnavailable />;
  }

  const stale =
    invoices.stale ||
    poTotals.stale ||
    supplierRows.stale ||
    headers.stale ||
    lines.stale ||
    received.stale ||
    allSupplierInvoices.stale ||
    dateRange.stale;

  // ---- KPI figures -------------------------------------------------------------------------
  const invoiceTotal = invoices.value.reduce((a, r) => a + toNumber(r.TotalAmount), 0);
  const totalsRow = poTotals.value[0];
  const poTotal = toNumber(totalsRow?.TotalPoCommitted);
  const poCount = toNumber(totalsRow?.PoCount);
  const supplierCount = toNumber(totalsRow?.SupplierCount);

  // ---- PO views (headers + lines + sp_Popending receipts), money stripped for Staff ----------
  const allViews = buildPoViews(headers.value, lines.value, received.value, canSeeMoney);

  // The status donut counts EVERY PO in range including cancelled ones; the table below is what
  // the `?status=` filter narrows.
  const statusCounts = countByStatus(allViews);
  const tableViews = state.status
    ? allViews.filter((v) => v.status === state.status)
    : allViews;

  // ---- Supplier breakdown over BOTH bases ----------------------------------------------------
  const supplierBars: SupplierBarRow[] = aggregateSupplierBreakdown([
    ...supplierRows.value.map((r) => ({
      supplierCode: r.SupplierCode,
      poAmount: toNumber(r.TotalPoCommitted),
      poCount: toNumber(r.PoCount),
    })),
    ...allSupplierInvoices.value.map((r) => ({
      supplierCode: r.SupplierCode,
      invoiceAmount: toNumber(r.TotalAmount),
      invoiceCount: 1,
    })),
  ]).map((row) => ({
    supplierCode: row.supplierCode,
    invoiceAmount: row.invoiceAmount,
    poAmount: row.poAmount,
    poCount: row.poCount,
  }));

  // The filter-bar option list comes from the SAME unfiltered set, so selecting a supplier never
  // removes the other options from the dropdown.
  const supplierOptions = [...supplierBars]
    .map((r) => r.supplierCode)
    .filter((code) => code !== "-")
    .sort((a, b) => a.localeCompare(b, "th"));

  // ---- Period chart (invoice basis, Admin only) ---------------------------------------------
  const bins: PurchaseChartBin[] = purchaseTimeBins(state.from, state.to, state.period).map(
    (bin) => {
      const inRange = invoices.value.filter((v) => inPurchaseBin(bin, isoDate(v.VoucherDate)));
      return {
        ...bin,
        amount: inRange.reduce((a, v) => a + toNumber(v.TotalAmount), 0),
        count: inRange.length,
      };
    },
  );

  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="purchase-dashboard">
      <header className="flex flex-col gap-1">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">
          แดชบอร์ดการซื้อ
        </h1>
        <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">
          ข้อมูลใบสั่งซื้อและใบแจ้งหนี้ซื้อจากระบบ ERP (อ่านอย่างเดียว)
        </p>
      </header>

      <PilotBanner range={toErpDataRange(dateRange.value, "ใบสั่งซื้อ")} />
      <DegradeBanner state={erpDegradeState({ stale })} />

      <PurchaseFilterBar
        state={state}
        suppliers={supplierOptions}
        canSeeMoney={canSeeMoney}
      />

      <PurchaseKpiTiles
        canSeeMoney={canSeeMoney}
        invoiceTotal={invoiceTotal}
        invoiceCount={invoices.value.length}
        poTotal={poTotal}
        poCount={poCount}
        supplierCount={supplierCount}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* AC9 — the baht supplier chart is ADMIN-only; Staff gets the SAME suppliers ranked by
            PO count instead of an empty chart shell. */}
        {canSeeMoney ? (
          <PurchaseSupplierChart
            rows={supplierBars}
            selected={state.supplier}
            searchParams={state.raw}
          />
        ) : (
          <SupplierCountList
            rows={supplierBars}
            selected={state.supplier}
            searchParams={state.raw}
          />
        )}

        {/* The period chart measures invoice baht, so it exists for Admin only — and so does its
            granularity toggle in the filter bar. */}
        {canSeeMoney && (
          <PurchasePeriodChart
            bins={bins}
            period={state.period}
            from={state.from}
            to={state.to}
            searchParams={state.raw}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PurchaseSupplierDonut
          rows={supplierBars.map((r) => ({
            supplierCode: r.supplierCode,
            invoiceAmount: r.invoiceAmount,
            poCount: r.poCount,
          }))}
          selected={state.supplier}
          searchParams={state.raw}
          canSeeMoney={canSeeMoney}
        />
        <PurchaseStatusDonut
          counts={statusCounts}
          selected={state.status}
          searchParams={state.raw}
        />
      </div>

      <PoListTable views={tableViews} state={state} canSeeMoney={canSeeMoney} />
    </main>
  );
}
