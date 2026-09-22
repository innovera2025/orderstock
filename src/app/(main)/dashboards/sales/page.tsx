import * as React from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-guard";
import { PilotBanner } from "@/components/pilot-banner";
import { DegradeBanner } from "@/components/degrade-banner";
import { erpDegradeState } from "@/lib/erp/degrade";
import { formatInt, quantityByUnitList, coveragePercent, timeBins, inBin } from "@/lib/sales-basis-core";
import {
  fetchDoByCustomer,
  fetchDoByProduct,
  fetchDoHeaders,
  fetchDoLines,
  fetchExcludedInvoiceTotal,
  isoDate,
  type DoHeaderRow,
  type DoLineRow,
  type SalesFilters,
} from "@/lib/sales-queries";
import { resolveSalesBasis } from "@/lib/sales-basis";
import { SalesFilterBar } from "./sales-filter-bar";
import { SalesKpiTiles } from "./sales-kpi-tiles";
import { SalesChart, type ChartBin } from "./sales-chart";
import { SalesStatusDonut } from "./sales-status-donut";
import { SalesCategoryPie } from "./sales-category-pie";
import { SalesBreakdownTables } from "./sales-breakdown-tables";
import { DoListTable } from "./do-list-table";
import { DoLinesTable } from "./do-lines-table";
import { parseSalesUrl, salesHref, type RawSearchParams } from "./sales-url";
import { SalesUnavailable } from "./sales-unavailable";

// ยอดขาย — /dashboards/sales (erp-dashboards Phase 2).
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
// check — a Staff user's HTML contains no money markup at all.
//
// WHAT THE NUMBERS MEAN: headline figures are COUNTS and QUANTITIES. Quantities are always
// per-unit, never summed across units. The money figure is explicitly labelled "priced lines only",
// always ships with its coverage %, and always carries the footnote naming the larger
// SalesInvoiceHdr pool this dashboard deliberately excludes.

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

  // The basis switch mechanism. Only the DO/DOdtl branch is implemented this phase; reading the
  // setting here is what makes a later migration a settings change rather than a redeploy.
  await resolveSalesBasis();

  const filters: SalesFilters = {
    from: state.from,
    to: state.to,
    doNo: state.doNo,
    customer: state.customer,
    product: state.product,
    status: state.status,
    cat: state.cat,
  };

  // CROSS-FILTER SEMANTICS: the donut and pie each run with their OWN dimension excluded, so a
  // selected slice never collapses its own chart to 100%. Everything else uses the full filter set.
  //
  // COLD-START / OUTAGE PATH: Phase 1's `getCached()` serves the last-known-good value when a live
  // read fails, but RE-THROWS when nothing has ever been cached (first hit after a restart, or an
  // outage that begins before the first successful read). Letting that throw escape rendered Next's
  // generic 500 instead of a Thai message, so it is caught here and turned into the explicit
  // "ERP unavailable" view. Every other error path is unchanged; the stale-data path still renders
  // the full dashboard with `DegradeBanner`.
  let headers, lines, statusHeaders, catLines, excluded;
  let products: Awaited<ReturnType<typeof fetchDoByProduct>> | null = null;
  let customers: Awaited<ReturnType<typeof fetchDoByCustomer>> | null = null;
  try {
    [headers, lines, statusHeaders, catLines, excluded] = await Promise.all([
      fetchDoHeaders(filters),
      fetchDoLines(filters),
      fetchDoHeaders(filters, { skipStatus: true }),
      fetchDoLines(filters, { skipCat: true }),
      fetchExcludedInvoiceTotal(),
    ]);

    if (state.view === "summary") {
      [products, customers] = await Promise.all([
        fetchDoByProduct(filters),
        fetchDoByCustomer(filters),
      ]);
    }
  } catch (error) {
    // Never log the connection string or any row content — just the failure itself.
    console.error(
      "[dashboards/sales] ERP read failed and no cached value exists; rendering the unavailable state.",
      error instanceof Error ? error.message : error,
    );
    return <SalesUnavailable state={state} />;
  }

  const stale =
    headers.stale ||
    lines.stale ||
    statusHeaders.stale ||
    catLines.stale ||
    excluded.stale ||
    (products?.stale ?? false) ||
    (customers?.stale ?? false);

  const headerRows: DoHeaderRow[] = headers.value;
  const lineRows: DoLineRow[] = lines.value;

  const quantityByUnit = quantityByUnitList(
    lineRows.map((line) => ({ unit: line.Unit, qty: Number(line.Qty) })),
  );
  const pricedLines = lineRows.filter((line) => Number(line.Saleprice) !== 0);
  const pricedAmount = pricedLines.reduce((a, line) => a + Number(line.Amount), 0);
  const coverage = coveragePercent(pricedLines.length, lineRows.length);

  const excludedRow = excluded.value[0];
  const excludedInvoiceCount = Number(excludedRow?.InvoiceCount ?? 0);
  const excludedInvoiceTotal = Number(excludedRow?.ExcludedTotal ?? 0);

  // ONE bin set drives BOTH charts, so their bars can never be cut on different boundaries.
  const bins: ChartBin[] = timeBins(state.from, state.to, state.period).map((bin) => ({
    ...bin,
    count: headerRows.filter((h) => inBin(bin, isoDate(h.Dodate))).length,
    amount: pricedLines
      .filter((l) => inBin(bin, isoDate(l.Dodate)))
      .reduce((a, l) => a + Number(l.Amount), 0),
  }));

  const summaryHref = salesHref(state.raw, {
    view: null,
    customer: null,
    product: null,
    doNo: null,
    page: null,
    sort: null,
  });
  const documentsHref = salesHref(state.raw, { view: "documents", doNo: null, page: null, sort: null });

  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="sales-dashboard">
      <header className="flex flex-col gap-1">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">ยอดขาย</h1>
        <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">
          ข้อมูลจากใบส่งสินค้าในระบบ ERP (อ่านอย่างเดียว)
        </p>
      </header>

      <PilotBanner />
      <DegradeBanner state={erpDegradeState({ stale })} />

      <SalesFilterBar state={state} />

      <SalesKpiTiles
        doCount={headerRows.length}
        lineCount={lineRows.length}
        quantityByUnit={quantityByUnit}
        canSeeMoney={canSeeMoney}
        pricedAmount={pricedAmount}
        pricedLineCount={pricedLines.length}
        coverage={coverage}
        excludedInvoiceCount={excludedInvoiceCount}
        excludedInvoiceTotal={excludedInvoiceTotal}
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
          rows={statusHeaders.value}
          selected={state.status}
          searchParams={state.raw}
        />
        <SalesCategoryPie rows={catLines.value} selected={state.cat} searchParams={state.raw} />
      </div>

      {state.view === "summary" && products && customers && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
              สรุปตามสินค้าและลูกค้า
            </h2>
            <Link
              href={documentsHref}
              data-testid="sales-view-documents"
              className="th rounded-[var(--r-md)] border border-[var(--border)] px-3 py-1.5 text-[var(--t-xs)] text-[var(--text-muted)] hover:bg-[var(--bg-sunken)]"
            >
              ดูใบส่งสินค้าทั้งหมด ({formatInt(headerRows.length)} ใบ)
            </Link>
          </div>
          <SalesBreakdownTables
            products={products.value}
            customers={customers.value}
            canSeeMoney={canSeeMoney}
            searchParams={state.raw}
          />
        </>
      )}

      {state.view === "documents" && (
        <>
          <nav className="flex items-center gap-2 text-[var(--t-xs)]" aria-label="เส้นทาง">
            <Link
              href={summaryHref}
              data-testid="sales-breadcrumb-summary"
              className="th text-[var(--text-muted)] hover:underline"
            >
              สรุปตามสินค้าและลูกค้า
            </Link>
            <span className="text-[var(--text-faint)]">/</span>
            <span className="th text-[var(--text)]" aria-current="page">
              ใบส่งสินค้า
            </span>
          </nav>
          <DoListTable headers={headerRows} state={state} canSeeMoney={canSeeMoney} />
        </>
      )}

      {state.view === "lines" && (
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
              href={documentsHref}
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
            header={headerRows[0]}
            lines={lineRows}
            state={state}
            canSeeMoney={canSeeMoney}
          />
        </>
      )}
    </main>
  );
}
