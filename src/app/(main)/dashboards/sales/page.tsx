import * as React from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-guard";
import { PilotBanner, dataRangeText } from "@/components/pilot-banner";
import { DegradeBanner } from "@/components/degrade-banner";
import { erpDegradeState } from "@/lib/erp/degrade";
import {
  buildCategoryLabels,
  formatInt,
  quantityByUnitList,
  coveragePercent,
  timeBins,
  inBin,
} from "@/lib/sales-basis-core";
import { toErpDataRange } from "@/lib/erp-date-range";
import {
  fetchDoByCustomer,
  fetchDoByProduct,
  fetchDoDateRange,
  fetchDoHeaders,
  fetchDoLines,
  fetchInvoiceByCustomer,
  fetchInvoiceByProduct,
  fetchInvoiceDateRange,
  fetchInvoiceHeaders,
  fetchInvoiceLines,
  isoDate,
  type DoHeaderRow,
  type DoLineRow,
  type InvoiceHeaderRow,
  type InvoiceLineRow,
  type SalesFilters,
} from "@/lib/sales-queries";
import { resolveSalesBasis } from "@/lib/sales-basis";
import { SalesFilterBar } from "./sales-filter-bar";
import { SalesKpiTiles } from "./sales-kpi-tiles";
import { InvoiceKpiTiles } from "./invoice-kpi-tiles";
import { SalesChart, type ChartBin } from "./sales-chart";
import { SalesStatusDonut } from "./sales-status-donut";
import { SalesCategoryPie } from "./sales-category-pie";
import { SalesBreakdownTables } from "./sales-breakdown-tables";
import { InvoiceBreakdownTables } from "./invoice-breakdown-tables";
import { DoListTable } from "./do-list-table";
import { DoLinesTable } from "./do-lines-table";
import { InvoiceListTable } from "./invoice-list-table";
import { InvoiceLinesTable } from "./invoice-lines-table";
import { clearPageParams, parseSalesUrl, salesHref, type RawSearchParams } from "./sales-url";
import { SalesUnavailable } from "./sales-unavailable";
import { SalesUnavailableFragment } from "./sales-unavailable-fragment";

// ยอดขาย — /dashboards/sales (erp-dashboards Phase 2; two-section rework sales-invoice-basis 23-09-26).
//
// SERVER COMPONENT, READ-ONLY. Every ERP read goes through Phase 1's `guardedQuery()` choke point
// (via `sales-queries.ts`), wrapped in Phase 1's TTL cache + degrade helper. No Prisma touches an
// ERP table; no ERP model exists in `prisma/schema.prisma`; nothing here can write to db_TCL.
//
// AUTH (AC1/AC2): `requireAuth()` with no role argument — ADMIN and STAFF both get the page;
// `proxy.ts` redirects an unauthenticated request to /login before this ever runs.
//
// MONEY (AC9): `canSeeMoney` is computed ONCE here from the server-side session and passed down as
// DATA SHAPE (which columns exist, which tiles render). It is never a CSS class and never a client
// check — a Staff user's HTML contains no money markup at all, in EITHER section.
//
// TWO SECTIONS, TWO QUESTIONS:
//   ยอดขาย (invoice basis, PRIMARY)   — what we BILLED. Source of truth per the customer's own ERP
//                                       team (`sp_SalesInvoice`). Every line rolls up into its
//                                       header total, so this money needs no coverage caveat.
//   การส่งมอบ (delivery basis, SECONDARY) — what LEFT THE WAREHOUSE. Counts and per-unit quantities
//                                       are complete; its money covers only the priced lines, which
//                                       is why it keeps its own coverage footnote and the status
//                                       donut. Nothing about this section's data or SQL changed.
//
// INDEPENDENT PER-SECTION DEGRADE: each section resolves its own reads in its OWN try/catch. An
// invoice-only ERP failure renders a scoped Thai notice on the invoice section while the delivery
// section still shows its real data, and vice versa. Only when BOTH sections fail cold does the
// whole-page `SalesUnavailable` fallback render — which is also the only path that keeps the
// original single `data-testid="sales-dashboard"` + `sales-erp-unavailable` shape.
//
// QUANTITIES are always per-unit, never summed across units, in both sections.

export const dynamic = "force-dynamic";

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireAuth();
  const canSeeMoney = user.role === "ADMIN";

  const raw = await searchParams;
  const state = parseSalesUrl(raw);

  // The basis switch mechanism. Both branches are implemented now; reading the setting here keeps a
  // future change of the ERP's own keying a settings change rather than a redeploy.
  await resolveSalesBasis();

  const filters: SalesFilters = {
    from: state.from,
    to: state.to,
    doNo: state.doNo,
    invoiceNo: state.invoiceNo,
    customer: state.customer,
    product: state.product,
    status: state.status,
    cat: state.cat,
  };

  const isSummary = state.view === "summary";
  const showInvoiceSection = isSummary || state.view.startsWith("invoice-");
  const showDeliverySection = isSummary || state.view.startsWith("delivery-");

  // ---- INVOICE section (primary) --------------------------------------------------------------
  // Its OWN try/catch: a cold-cache invoice failure must not blank the delivery section.
  type InvoiceData = {
    headers: InvoiceHeaderRow[];
    lines: InvoiceLineRow[];
    products: Awaited<ReturnType<typeof fetchInvoiceByProduct>>["value"] | null;
    customers: Awaited<ReturnType<typeof fetchInvoiceByCustomer>>["value"] | null;
    dateRange: Awaited<ReturnType<typeof fetchInvoiceDateRange>>["value"];
    stale: boolean;
  };
  let invoice: InvoiceData | null = null;
  if (showInvoiceSection) {
    try {
      const [headers, lines, dateRange] = await Promise.all([
        fetchInvoiceHeaders(filters),
        fetchInvoiceLines(filters),
        // UNFILTERED on purpose: the ช่วงข้อมูล notice reports what the ERP holds.
        fetchInvoiceDateRange(),
      ]);
      let products = null;
      let customers = null;
      if (isSummary) {
        const [p, c] = await Promise.all([
          fetchInvoiceByProduct(filters),
          fetchInvoiceByCustomer(filters),
        ]);
        products = p;
        customers = c;
      }
      invoice = {
        headers: headers.value,
        lines: lines.value,
        products: products?.value ?? null,
        customers: customers?.value ?? null,
        dateRange: dateRange.value,
        stale:
          headers.stale ||
          lines.stale ||
          dateRange.stale ||
          (products?.stale ?? false) ||
          (customers?.stale ?? false),
      };
    } catch (error) {
      // Never log the connection string or any row content — just the failure itself.
      console.error(
        "[dashboards/sales] invoice-section ERP read failed with no cached value; degrading that section only.",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // ---- DELIVERY section (secondary) — data logic UNCHANGED from Phase 2 -----------------------
  type DeliveryData = {
    headers: DoHeaderRow[];
    lines: DoLineRow[];
    statusHeaders: DoHeaderRow[];
    catLines: DoLineRow[];
    products: Awaited<ReturnType<typeof fetchDoByProduct>>["value"] | null;
    customers: Awaited<ReturnType<typeof fetchDoByCustomer>>["value"] | null;
    dateRange: Awaited<ReturnType<typeof fetchDoDateRange>>["value"];
    stale: boolean;
  };
  let delivery: DeliveryData | null = null;
  if (showDeliverySection) {
    try {
      // CROSS-FILTER SEMANTICS: the donut and pie each run with their OWN dimension excluded, so a
      // selected slice never collapses its own chart to 100%.
      const [headers, lines, statusHeaders, catLines, dateRange] = await Promise.all([
        fetchDoHeaders(filters),
        fetchDoLines(filters),
        fetchDoHeaders(filters, { skipStatus: true }),
        fetchDoLines(filters, { skipCat: true }),
        fetchDoDateRange(),
      ]);
      let products = null;
      let customers = null;
      if (isSummary) {
        const [p, c] = await Promise.all([fetchDoByProduct(filters), fetchDoByCustomer(filters)]);
        products = p;
        customers = c;
      }
      delivery = {
        headers: headers.value,
        lines: lines.value,
        statusHeaders: statusHeaders.value,
        catLines: catLines.value,
        products: products?.value ?? null,
        customers: customers?.value ?? null,
        dateRange: dateRange.value,
        stale:
          headers.stale ||
          lines.stale ||
          statusHeaders.stale ||
          catLines.stale ||
          dateRange.stale ||
          (products?.stale ?? false) ||
          (customers?.stale ?? false),
      };
    } catch (error) {
      console.error(
        "[dashboards/sales] delivery-section ERP read failed with no cached value; degrading that section only.",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Nothing anywhere: fall back to the ORIGINAL whole-page unavailable view, unchanged, so its
  // existing e2e selectors keep passing exactly as before.
  if (invoice === null && delivery === null) {
    return <SalesUnavailable state={state} />;
  }

  const stale = (invoice?.stale ?? false) || (delivery?.stale ?? false);

  // ---- Derived figures -------------------------------------------------------------------------
  const invoiceQtyByUnit = quantityByUnitList(
    (invoice?.lines ?? []).map((l) => ({ unit: l.Unit, qty: Number(l.Qty) })),
  );
  const invoiceTotal = (invoice?.headers ?? []).reduce((a, h) => a + Number(h.Amount), 0);
  const invoiceLineTotal = (invoice?.headers ?? []).reduce((a, h) => a + Number(h.LineAmount), 0);

  const deliveryLineRows = delivery?.lines ?? [];
  const deliveryQtyByUnit = quantityByUnitList(
    deliveryLineRows.map((line) => ({ unit: line.Unit, qty: Number(line.Qty) })),
  );
  const pricedLines = deliveryLineRows.filter((line) => Number(line.Saleprice) !== 0);
  const pricedAmount = pricedLines.reduce((a, line) => a + Number(line.Amount), 0);
  const coverage = coveragePercent(pricedLines.length, deliveryLineRows.length);

  // The ERP's own category labels, taken from the SAME rows the pie draws (that query runs with
  // `skipCat: true`, so every category is present even while one is selected).
  const catLabels = buildCategoryLabels(delivery?.catLines ?? []);

  // ONE bin set drives BOTH delivery charts, so their bars can never be cut on different boundaries.
  const bins: ChartBin[] = timeBins(state.from, state.to, state.period).map((bin) => ({
    ...bin,
    count: (delivery?.headers ?? []).filter((h) => inBin(bin, isoDate(h.Dodate))).length,
    amount: pricedLines
      .filter((l) => inBin(bin, isoDate(l.Dodate)))
      .reduce((a, l) => a + Number(l.Amount), 0),
  }));

  // Every page key resets on a view change — `page` plus all four breakdown keys.
  const pageReset = clearPageParams();
  const summaryHref = salesHref(state.raw, {
    ...pageReset,
    view: null,
    customer: null,
    product: null,
    doNo: null,
    invoiceNo: null,
    sort: null,
  });
  const invoiceDocumentsHref = salesHref(state.raw, {
    ...pageReset,
    view: "invoice-documents",
    doNo: null,
    invoiceNo: null,
    sort: null,
  });
  const deliveryDocumentsHref = salesHref(state.raw, {
    ...pageReset,
    view: "delivery-documents",
    doNo: null,
    invoiceNo: null,
    sort: null,
  });

  // ONE page-level ช่วงข้อมูล banner, and it keeps reporting the DELIVERY range it always has.
  // Two sections could each own a banner, but `PilotBanner` is shared by all three dashboards and
  // every existing gate selects a single `data-testid="pilot-banner"` per page — rendering two
  // would churn unrelated specs to say something this page can state more precisely anyway. The
  // invoice basis gets its OWN range line inside its own section heading (below), so neither range
  // is hidden and neither is mislabelled. The banner falls back to the invoice range only when the
  // delivery section has no data at all.
  const pilotRange = delivery
    ? toErpDataRange(delivery.dateRange, "ใบส่งสินค้า")
    : toErpDataRange(invoice!.dateRange, "ใบแจ้งหนี้ขาย");
  const invoiceRangeText = invoice
    ? dataRangeText(toErpDataRange(invoice.dateRange, "ใบแจ้งหนี้ขาย"))
    : null;

  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="sales-dashboard">
      <header className="flex flex-col gap-1">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">ยอดขาย</h1>
        <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">
          ยอดขายจากใบแจ้งหนี้ และการส่งมอบจากใบส่งสินค้า ในระบบ ERP (อ่านอย่างเดียว)
        </p>
      </header>

      <PilotBanner range={pilotRange} />
      <DegradeBanner state={erpDegradeState({ stale })} />

      <SalesFilterBar state={state} catLabels={catLabels} />

      {/* ============================ INVOICE SECTION (primary) ============================ */}
      {showInvoiceSection && (
        <section className="flex flex-col gap-4" data-testid="sales-invoice-section">
          <div className="flex flex-col gap-0.5">
            <h2 className="th text-[var(--t-lg)] font-semibold text-[var(--text-strong)]">
              ยอดขาย (ตามใบแจ้งหนี้)
            </h2>
            {invoiceRangeText && (
              <p
                data-testid="invoice-data-range"
                className="th text-[var(--t-xs)] text-[var(--text-muted)]"
              >
                {invoiceRangeText}
              </p>
            )}
          </div>

          {invoice === null ? (
            <SalesUnavailableFragment
              testId="sales-invoice-unavailable"
              sectionLabel="ยอดขายตามใบแจ้งหนี้"
            />
          ) : (
            <>
              <InvoiceKpiTiles
                invoiceCount={invoice.headers.length}
                lineCount={invoice.lines.length}
                quantityByUnit={invoiceQtyByUnit}
                canSeeMoney={canSeeMoney}
                invoiceTotal={invoiceTotal}
                lineTotal={invoiceLineTotal}
              />

              {isSummary && invoice.products && invoice.customers && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
                      สรุปตามสินค้าและลูกค้า
                    </h3>
                    <Link
                      href={invoiceDocumentsHref}
                      data-testid="sales-view-invoice-documents"
                      className="th rounded-[var(--r-md)] border border-[var(--border)] px-3 py-1.5 text-[var(--t-xs)] text-[var(--text-muted)] hover:bg-[var(--bg-sunken)]"
                    >
                      ดูใบแจ้งหนี้ทั้งหมด ({formatInt(invoice.headers.length)} ใบ)
                    </Link>
                  </div>
                  <InvoiceBreakdownTables
                    products={invoice.products}
                    customers={invoice.customers}
                    canSeeMoney={canSeeMoney}
                    searchParams={state.raw}
                    productPage={state.invoiceProductPage}
                    customerPage={state.invoiceCustomerPage}
                  />
                </>
              )}

              {state.view === "invoice-documents" && (
                <>
                  <nav className="flex items-center gap-2 text-[var(--t-xs)]" aria-label="เส้นทาง">
                    <Link
                      href={summaryHref}
                      data-testid="sales-breadcrumb-summary"
                      className="th text-[var(--text-muted)] hover:underline"
                    >
                      ยอดขาย
                    </Link>
                    <span className="text-[var(--text-faint)]">/</span>
                    <span className="th text-[var(--text)]" aria-current="page">
                      ใบแจ้งหนี้
                    </span>
                  </nav>
                  <InvoiceListTable
                    headers={invoice.headers}
                    state={state}
                    canSeeMoney={canSeeMoney}
                  />
                </>
              )}

              {state.view === "invoice-lines" && (
                <>
                  <nav className="flex items-center gap-2 text-[var(--t-xs)]" aria-label="เส้นทาง">
                    <Link
                      href={summaryHref}
                      data-testid="sales-breadcrumb-summary"
                      className="th text-[var(--text-muted)] hover:underline"
                    >
                      ยอดขาย
                    </Link>
                    <span className="text-[var(--text-faint)]">/</span>
                    <Link
                      href={invoiceDocumentsHref}
                      data-testid="sales-breadcrumb-invoice-documents"
                      className="th text-[var(--text-muted)] hover:underline"
                    >
                      ใบแจ้งหนี้
                    </Link>
                    <span className="text-[var(--text-faint)]">/</span>
                    <span className="th tabular-nums text-[var(--text)]" aria-current="page">
                      {state.invoiceNo}
                    </span>
                  </nav>
                  <InvoiceLinesTable
                    header={invoice.headers[0]}
                    lines={invoice.lines}
                    state={state}
                    canSeeMoney={canSeeMoney}
                  />
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* ========================== DELIVERY SECTION (secondary) ========================== */}
      {showDeliverySection && (
        <section
          className="flex flex-col gap-4 border-t border-[var(--border)] pt-4"
          data-testid="sales-delivery-section"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="th text-[var(--t-lg)] font-semibold text-[var(--text-strong)]">
              การส่งมอบ
            </h2>
            <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">
              สินค้าที่ส่งออกจากคลังตามใบส่งสินค้า — คนละคำถามกับยอดที่ออกใบแจ้งหนี้ด้านบน
            </p>
          </div>

          {delivery === null ? (
            <SalesUnavailableFragment
              testId="sales-delivery-unavailable"
              sectionLabel="การส่งมอบ"
            />
          ) : (
            <>
              <SalesKpiTiles
                doCount={delivery.headers.length}
                lineCount={deliveryLineRows.length}
                quantityByUnit={deliveryQtyByUnit}
                canSeeMoney={canSeeMoney}
                pricedAmount={pricedAmount}
                pricedLineCount={pricedLines.length}
                coverage={coverage}
              />

              <SalesChart
                bins={bins}
                period={state.period}
                from={state.from}
                to={state.to}
                canSeeMoney={canSeeMoney}
                searchParams={state.raw}
              />

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <SalesStatusDonut
                  rows={delivery.statusHeaders}
                  selected={state.status}
                  searchParams={state.raw}
                />
                <SalesCategoryPie
                  rows={delivery.catLines}
                  selected={state.cat}
                  searchParams={state.raw}
                />
              </div>

              {isSummary && delivery.products && delivery.customers && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
                      สรุปตามสินค้าและลูกค้า
                    </h3>
                    <Link
                      href={deliveryDocumentsHref}
                      data-testid="sales-view-documents"
                      className="th rounded-[var(--r-md)] border border-[var(--border)] px-3 py-1.5 text-[var(--t-xs)] text-[var(--text-muted)] hover:bg-[var(--bg-sunken)]"
                    >
                      ดูใบส่งสินค้าทั้งหมด ({formatInt(delivery.headers.length)} ใบ)
                    </Link>
                  </div>
                  <SalesBreakdownTables
                    products={delivery.products}
                    customers={delivery.customers}
                    canSeeMoney={canSeeMoney}
                    searchParams={state.raw}
                    productPage={state.productPage}
                    customerPage={state.customerPage}
                  />
                </>
              )}

              {state.view === "delivery-documents" && (
                <>
                  <nav className="flex items-center gap-2 text-[var(--t-xs)]" aria-label="เส้นทาง">
                    <Link
                      href={summaryHref}
                      data-testid="sales-breadcrumb-summary"
                      className="th text-[var(--text-muted)] hover:underline"
                    >
                      ยอดขาย
                    </Link>
                    <span className="text-[var(--text-faint)]">/</span>
                    <span className="th text-[var(--text)]" aria-current="page">
                      ใบส่งสินค้า
                    </span>
                  </nav>
                  <DoListTable
                    headers={delivery.headers}
                    state={state}
                    canSeeMoney={canSeeMoney}
                  />
                </>
              )}

              {state.view === "delivery-lines" && (
                <>
                  <nav className="flex items-center gap-2 text-[var(--t-xs)]" aria-label="เส้นทาง">
                    <Link
                      href={summaryHref}
                      data-testid="sales-breadcrumb-summary"
                      className="th text-[var(--text-muted)] hover:underline"
                    >
                      ยอดขาย
                    </Link>
                    <span className="text-[var(--text-faint)]">/</span>
                    <Link
                      href={deliveryDocumentsHref}
                      data-testid="sales-breadcrumb-documents"
                      className="th text-[var(--text-muted)] hover:underline"
                    >
                      ใบส่งสินค้า
                    </Link>
                    <span className="text-[var(--text-faint)]">/</span>
                    <span className="th tabular-nums text-[var(--text)]" aria-current="page">
                      {state.doNo}
                    </span>
                  </nav>
                  <DoLinesTable
                    header={delivery.headers[0]}
                    lines={delivery.lines}
                    state={state}
                    canSeeMoney={canSeeMoney}
                  />
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
