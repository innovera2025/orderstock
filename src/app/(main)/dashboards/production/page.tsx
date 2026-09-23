import * as React from "react";
import { requireAuth } from "@/lib/auth-guard";
import { PilotBanner } from "@/components/pilot-banner";
import { DegradeBanner } from "@/components/degrade-banner";
import { erpDegradeState } from "@/lib/erp/degrade";
import { plannedQtyByUnit } from "@/lib/production-status";
import { toErpDataRange } from "@/lib/erp-date-range";
import {
  getProductionDateRange,
  getProductionMoList,
  type MoListRow,
} from "@/lib/production-data";
import { ProductionFilterBar } from "./production-filter-bar";
import { ProductionKpiTiles } from "./production-kpi-tiles";
import { ProductionPlanChart, type PlanChartItem } from "./production-plan-chart";
import { ProductionStatusDonut } from "./production-status-donut";
import { MoListTable } from "./mo-list-table";
import { ProductionUnavailable } from "./production-unavailable";
import { parseProductionUrl, type RawSearchParams } from "./production-url";

// การผลิต — /dashboards/production (erp-dashboards Phase 4).
//
// SERVER COMPONENT, READ-ONLY. Every ERP read goes through Phase 1's `guardedQuery()` choke point
// (via `production-data.ts`), wrapped in Phase 1's TTL cache + degrade helper. No Prisma touches an
// ERP table; no ERP model exists in `prisma/schema.prisma`; nothing here can write to db_TCL.
//
// AUTH (AC1): `requireAuth()` with no role argument — ADMIN and STAFF both get the page;
// `proxy.ts` redirects an unauthenticated request to /login before this ever runs.
//
// MONEY (AC9): there is NO money figure anywhere in Production's scope — no THB value exists on
// planned-quantity or material-issue data — so there is no `canSeeMoney` gate on this page.
// Recorded deliberately for Phase 5's cross-dashboard money audit: "no money gate" is correct here.
//
// PLAN-ONLY (AC7): every figure on this page is a PLAN. The "ผลิตจริง" column always renders the
// Thai empty-state string, and NO achievement percentage is computed anywhere — `tbl_MoHdr.Prodqty`
// is proven to be a copy of the plan, not a measurement (data dictionary §C-4).

export const dynamic = "force-dynamic";

export default async function ProductionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAuth();

  const raw = await searchParams;
  const state = parseProductionUrl(raw);
  const filters = { dateFrom: state.from, dateTo: state.to, status: state.status };

  // CROSS-FILTER: the donut runs with its OWN dimension excluded, so a selected status never
  // collapses its own chart to 100% and the user can always click a different slice.
  let mos, statusMos, dateRange;
  try {
    [mos, statusMos, dateRange] = await Promise.all([
      getProductionMoList(filters),
      getProductionMoList(filters, { skipStatus: true }),
      // UNFILTERED on purpose: the ช่วงข้อมูล notice reports what the ERP holds, not what the
      // current filter selected.
      getProductionDateRange(),
    ]);
  } catch (error) {
    // Never log the connection string or any row content — just the failure itself.
    console.error(
      "[dashboards/production] ERP read failed and no cached value exists; rendering the unavailable state.",
      error instanceof Error ? error.message : error,
    );
    return <ProductionUnavailable />;
  }

  const rows: MoListRow[] = mos.value;
  const stale = mos.stale || statusMos.stale || dateRange.stale;

  const plannedByUnit = plannedQtyByUnit(
    rows.map((r) => ({ unit: r.MainUnits, qty: Number(r.PlannedQty) })),
  );
  const moWithIssueCount = rows.filter((r) => Number(r.IssueLineCount) > 0).length;

  // Chart series: planned quantity per (FgCode, MainUnits) PAIR — never by FgCode alone, which
  // could silently add two different units together.
  const byItem = new Map<string, PlanChartItem>();
  for (const row of rows) {
    const key = `${row.FgCode}|${row.MainUnits}`;
    const existing = byItem.get(key);
    if (existing) {
      existing.qty += Number(row.PlannedQty);
      existing.moCount += 1;
    } else {
      byItem.set(key, {
        code: String(row.FgCode ?? "-"),
        name: row.FgName,
        unit: row.MainUnits,
        qty: Number(row.PlannedQty),
        moCount: 1,
      });
    }
  }
  const chartItems = [...byItem.values()].sort((a, b) => b.qty - a.qty);

  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="production-dashboard">
      <header className="flex flex-col gap-1">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">การผลิต</h1>
        <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">
          ข้อมูลจากใบสั่งผลิตในระบบ ERP (อ่านอย่างเดียว)
        </p>
      </header>

      <PilotBanner range={toErpDataRange(dateRange.value, "ใบสั่งผลิต")} />
      <DegradeBanner state={erpDegradeState({ stale })} />

      <ProductionFilterBar state={state} />

      <ProductionKpiTiles
        moCount={rows.length}
        plannedByUnit={plannedByUnit}
        moWithIssueCount={moWithIssueCount}
      />

      <p
        className="th rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2 text-[var(--t-xs)] text-[var(--text-muted)]"
        data-testid="production-plan-only-note"
      >
        หน้านี้แสดงเฉพาะแผนการผลิต ยังไม่มีข้อมูลผลิตจริงจาก ERP จึงไม่มีการคำนวณเปอร์เซ็นต์ความสำเร็จ
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ProductionPlanChart items={chartItems} />
        <ProductionStatusDonut
          rows={statusMos.value}
          selected={state.status}
          searchParams={state.raw}
        />
      </div>

      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">ใบสั่งผลิต</h2>
      <MoListTable mos={rows} state={state} />
    </main>
  );
}
