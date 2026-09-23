import * as React from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-guard";
import { Card } from "@/components/ui/card";
import { PilotBanner } from "@/components/pilot-banner";
import { DegradeBanner } from "@/components/degrade-banner";
import { erpDegradeState } from "@/lib/erp/degrade";
import { beShort, formatInt, formatMoney, formatQtyWithUnit } from "@/lib/purchase-calc";
import { toErpDataRange } from "@/lib/erp-date-range";
import {
  fetchPoDateRange,
  fetchPoLines,
  fetchPoList,
  fetchPoReceived,
  type PurchaseFilters,
} from "@/lib/purchase-data";
import { PoLinesTable } from "../po-lines-table";
import { OutstandingQty } from "../outstanding-qty";
import { PoStatusBadges, PoStatusCaveatNote } from "../purchase-status-badges";
import { PurchaseUnavailable } from "../purchase-unavailable";
import {
  PURCHASE_BASE_PATH,
  parsePurchaseUrl,
  purchaseHref,
  type RawSearchParams,
} from "../purchase-url";
import { buildPoViews } from "../purchase-view";

// ใบสั่งซื้อ (รายละเอียด) — /dashboards/purchase/[poNo] (erp-dashboards Phase 3).
//
// Drilldown step 2 of 2. A real nested route rather than a `?drill=` param, so the PO number is in
// the path and the page is linkable on its own — while every current filter search param rides
// along in the query string, so "back to the list" restores exactly the view the user came from.
//
// AUTH (AC1) and MONEY (AC9) work exactly as on the list page: `requireAuth()` with no role, and
// `canSeeMoney` computed once, server-side, then threaded down as data shape. A Staff user's HTML
// contains no price, no line amount and no PO total.
//
// DATE RANGE: the PO's own date may sit outside the filter range the user came from (e.g. they
// clicked through, then narrowed the dates). This page therefore queries a WIDE range and picks the
// PO by number, so a detail link never 404s just because of a stale range in the URL.

export const dynamic = "force-dynamic";

const WIDE_RANGE = { from: "1900-01-01", to: "2999-12-31" };

export default async function PoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ poNo: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireAuth();
  const canSeeMoney = user.role === "ADMIN";

  const { poNo } = await params;
  const poNumber = decodeURIComponent(poNo);
  const raw = await searchParams;
  const state = parsePurchaseUrl(raw);

  const filters: PurchaseFilters = { ...WIDE_RANGE, poNumber };
  const listHref = purchaseHref(raw, { page: null, sort: null });

  let headers, lines, received, dateRange;
  try {
    headers = await fetchPoList(filters);
    const header = headers.value[0];
    [lines, received, dateRange] = await Promise.all([
      fetchPoLines(WIDE_RANGE, header?.TransactionNo ?? null),
      fetchPoReceived(poNumber),
      // The same unfiltered ช่วงข้อมูล read as the list page, so the notice reads identically on
      // both routes.
      fetchPoDateRange(),
    ]);
  } catch (error) {
    console.error(
      "[dashboards/purchase/[poNo]] ERP read failed and no cached value exists; rendering the unavailable state.",
      error instanceof Error ? error.message : error,
    );
    return <PurchaseUnavailable />;
  }

  const view = buildPoViews(headers.value, lines.value, received.value, canSeeMoney)[0];
  const stale = headers.stale || lines.stale || received.stale || dateRange.stale;
  const dataRange = toErpDataRange(dateRange.value, "ใบสั่งซื้อ");

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-2 text-[var(--t-xs)]" aria-label="เส้นทาง">
      <Link
        href={listHref}
        data-testid="purchase-breadcrumb-dashboard"
        className="th text-[var(--text-muted)] hover:underline"
      >
        แดชบอร์ดการซื้อ
      </Link>
      <span className="text-[var(--text-faint)]">/</span>
      <Link
        href={listHref}
        data-testid="purchase-breadcrumb-list"
        className="th text-[var(--text-muted)] hover:underline"
      >
        ใบสั่งซื้อ
      </Link>
      <span className="text-[var(--text-faint)]">/</span>
      <span className="tabular-nums text-[var(--text)]" aria-current="page">
        {poNumber}
      </span>
    </nav>
  );

  if (!view) {
    return (
      <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="po-detail">
        <PilotBanner range={dataRange} />
        {breadcrumb}
        <Card className="p-6 text-center">
          <span className="th text-[var(--t-sm)] text-[var(--text-muted)]">
            ไม่พบใบสั่งซื้อเลขที่ {poNumber}
          </span>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="po-detail">
      <PilotBanner range={dataRange} />
      <DegradeBanner state={erpDegradeState({ stale })} />
      {breadcrumb}

      <Card className="flex flex-col gap-3 p-4" data-testid="po-detail-header">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">
          <span className="th">ใบสั่งซื้อ </span>
          <span className="tabular-nums">{view.poNumber}</span>
        </h1>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Field label="วันที่">
            <span className="tabular-nums">{beShort(view.date)}</span>
          </Field>
          <Field label="ซัพพลายเออร์">
            <span className="th" data-testid="po-detail-supplier">
              {view.supplierCode}
            </span>
          </Field>
          <Field label="สถานะ">
            <PoStatusBadges status={view.status} />
          </Field>
          <Field label="จำนวนรายการ">
            <span className="th">{formatInt(view.lineCount)} รายการ</span>
          </Field>
        </dl>

        <PoStatusCaveatNote />

        {/* Received/outstanding summary, ONE ROW PER UNIT — never a combined cross-unit number. */}
        {view.unitTotals.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="po-detail-received">
            <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">รับแล้ว/ค้างรับ</span>
            {view.unitTotals.map((unit) => (
              <span key={unit.unit} className="th text-[var(--t-sm)] text-[var(--text)]">
                รับ{" "}
                <span className="tabular-nums">
                  {formatQtyWithUnit(unit.received, unit.unit)}
                </span>
                {" · "}
                <OutstandingQty value={unit.outstanding} unit={unit.unit} />
              </span>
            ))}
          </div>
        )}

        {/* AC9 — the PO total is rendered only for Admin; `view.totalAmount` does not even exist
            for Staff (stripped in purchase-view.ts), so there is no markup to reveal. */}
        {canSeeMoney ? (
          <div className="flex flex-col gap-0.5" data-testid="po-detail-total">
            <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">
              ยอดซื้อ (ตามใบสั่งซื้อ)
            </span>
            <span className="text-[var(--t-lg)] font-semibold tabular-nums text-[var(--text-strong)]">
              {formatMoney(view.totalAmount ?? 0)}
            </span>
            <span className="th text-[11px] text-[var(--text-faint)]">
              จากรายการในใบสั่งซื้อนี้
            </span>
          </div>
        ) : (
          <p className="th text-[var(--t-xs)] text-[var(--text-faint)]">
            ราคาและยอดซื้อแสดงเฉพาะผู้ดูแลระบบ
          </p>
        )}
      </Card>

      <PoLinesTable
        lines={view.lines}
        state={state}
        canSeeMoney={canSeeMoney}
        basePath={`${PURCHASE_BASE_PATH}/${encodeURIComponent(view.poNumber)}`}
      />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="th text-[var(--t-xs)] text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--t-sm)] text-[var(--text)]">{children}</dd>
    </div>
  );
}
