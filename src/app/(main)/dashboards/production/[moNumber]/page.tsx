import * as React from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-guard";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PilotBanner } from "@/components/pilot-banner";
import { DegradeBanner } from "@/components/degrade-banner";
import { erpDegradeState } from "@/lib/erp/degrade";
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
import { getMaterialIssuesForMo, getProductionMoList, isoDate } from "@/lib/production-data";
import { ProductionUnavailable } from "../production-unavailable";
import {
  PRODUCTION_BASE_PATH,
  parseProductionUrl,
  productionHref,
  type RawSearchParams,
} from "../production-url";

// erp-dashboards Phase 4 — the MO drilldown: /dashboards/production/[moNumber].
//
// INNOVATE DECISION (confirmed 22-09-26): a NESTED ROUTE, not an in-page expand/collapse row.
// Chosen because it gives a bookmarkable, reload-stable URL (consistent with AC10/AC11's URL-driven
// pattern) and matches the app's existing `/orders/[id]` drilldown precedent.
// Rejected alternative: in-page expand/collapse — simpler, but the expanded state is not
// addressable, so it cannot be bookmarked, shared, or restored by a reload.
//
// The MO -> material-issue linkage is a whitespace-tolerant STRING match on `InventoryFlowDtl.MONo`
// with NO foreign key. Zero matches is the COMMON case (7 detail rows across 218 headers in the
// real data) and renders a clean Thai empty state, never an error.

export const dynamic = "force-dynamic";

const columns: DataTableColumn[] = [
  { key: "code", label: "รหัสสินค้า" },
  { key: "name", label: "ชื่อสินค้า" },
  { key: "qty", label: "จำนวน", align: "right" },
  { key: "unit", label: "หน่วย" },
  { key: "date", label: "วันที่เบิก" },
];

export default async function MoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ moNumber: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAuth();

  const { moNumber } = await params;
  const raw = await searchParams;
  const state = parseProductionUrl(raw);
  const listHref = productionHref(raw);

  let issues, mos;
  try {
    [issues, mos] = await Promise.all([
      getMaterialIssuesForMo(moNumber),
      getProductionMoList({ dateFrom: state.from, dateTo: state.to }),
    ]);
  } catch (error) {
    console.error(
      "[dashboards/production/[moNumber]] ERP read failed and no cached value exists.",
      error instanceof Error ? error.message : error,
    );
    return <ProductionUnavailable />;
  }

  const mo = mos.value.find((m) => m.MoNumBer.trim() === moNumber.trim());
  const stale = issues.stale || mos.stale;

  const rows: DataTableRow[] = issues.value.map((line) => {
    const iso = isoDate(line.TransactionDate);
    return {
      code: <span className="tabular-nums">{line.ItemCode}</span>,
      name: <span className="th">{line.ItemName}</span>,
      qty: <span className="tabular-nums">{formatQty(Number(line.Qty))}</span>,
      unit: <span className="th">{line.MainUnits}</span>,
      date: (
        <span className="tabular-nums">{iso ? ceToBeDisplay(parseDateInputValue(iso)) : "—"}</span>
      ),
    };
  });

  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="production-mo-detail">
      <nav className="flex flex-wrap items-center gap-2 text-[var(--t-xs)]" aria-label="เส้นทาง">
        <Link
          href={listHref}
          data-testid="production-breadcrumb-list"
          className="th text-[var(--text-muted)] hover:underline"
        >
          การผลิต
        </Link>
        <span className="text-[var(--text-faint)]">/</span>
        <span className="tabular-nums text-[var(--text)]" aria-current="page">
          {moNumber}
        </span>
      </nav>

      <PilotBanner />
      <DegradeBanner state={erpDegradeState({ stale })} />

      <Card className="flex flex-col gap-3 p-4">
        <h1 className="text-[var(--t-lg)] font-semibold text-[var(--text-strong)]">
          <span className="th">ใบสั่งผลิต </span>
          <span className="tabular-nums">{moNumber}</span>
        </h1>

        {mo ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">สินค้า</dt>
              <dd className="th text-[var(--t-sm)] text-[var(--text)]">
                {mo.FgName}
                <span className="th block text-[11px] text-[var(--text-faint)]">{mo.FgCode}</span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">ปริมาณตามแผน</dt>
              <dd className="text-[var(--t-base)] font-semibold tabular-nums text-[var(--text-strong)]">
                {formatQty(Number(mo.PlannedQty))} <span className="th">{mo.MainUnits}</span>
                <span className="th block text-[11px] font-normal text-[var(--text-faint)]">
                  {Number(mo.PlannedQtyFromProdqty) === 1
                    ? "ไม่ได้ระบุจำนวนต่อล็อต จึงใช้จำนวนสั่งผลิต (Prodqty)"
                    : "จากจำนวนต่อล็อต (LotQty)"}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">วันที่ตามแผน</dt>
              <dd className="tabular-nums text-[var(--t-sm)] text-[var(--text)]">
                {isoDate(mo.Modate)
                  ? ceToBeDisplay(parseDateInputValue(isoDate(mo.Modate)))
                  : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">สถานะ</dt>
              <dd>
                <Chip tone={moStatusTone(mo.StatusKey)}>
                  <span className="th">{moStatusLabel(mo.StatusKey)}</span>
                </Chip>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">ผลิตจริง</dt>
              <dd
                data-testid="mo-detail-actual-produced"
                className="th text-[var(--t-sm)] text-[var(--text-faint)]"
              >
                {ACTUAL_PRODUCED_EMPTY_TEXT}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="th text-[var(--t-sm)] text-[var(--text-muted)]" data-testid="mo-not-found">
            ไม่พบใบสั่งผลิตเลขที่ {moNumber} ในช่วงวันที่ที่เลือก
          </p>
        )}
      </Card>

      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
        รายการเบิกวัตถุดิบ — <span className="tabular-nums">{moNumber}</span>
      </h2>

      <DashboardDataTable
        columns={columns}
        rows={rows}
        basePath={`${PRODUCTION_BASE_PATH}/${encodeURIComponent(moNumber)}`}
        searchParams={raw}
        pageSize={50}
        totalRows={rows.length}
        mobileTitleKey="code"
        emptyText="ไม่มีรายการเบิกวัตถุดิบสำหรับใบสั่งผลิตนี้"
      />
    </main>
  );
}
