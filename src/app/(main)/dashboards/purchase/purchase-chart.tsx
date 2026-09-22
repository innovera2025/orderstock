import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  PURCHASE_PERIODS,
  binScopeNote,
  formatInt,
  formatMoney,
  type PurchasePeriod,
  type PurchaseTimeBin,
} from "@/lib/purchase-calc";
import { PLOT_HEIGHT, computeBarScale, yAxisWidth } from "@/lib/sales-chart-scale";
import { purchaseHref, type RawSearchParams } from "./purchase-url";

// erp-dashboards Phase 3 — the period bar chart and the supplier bar chart.
//
// CHARTING DECISION: HAND-ROLLED CSS/div bars, no charting dependency (this phase never touches
// `package.json`). The approved mockup already proves the form renders correctly with IBM Plex Sans
// Thai in both themes, it costs zero bundle weight, and it keeps these SERVER components — a
// canvas/SVG charting library would force a client boundary here.
//
// GEOMETRY IN PIXELS, NOT PERCENTAGES: bar heights come from `computeBarScale()` in
// `src/lib/sales-chart-scale.ts`. That helper exists because a percentage height against an
// indeterminate-height flex parent computes to `auto`, which silently collapsed every bar to its
// 2px floor — right data, flat chart, no failing test. Pixels resolve in a pure, unit-tested helper
// instead of inline CSS arithmetic. (Deliberate cross-phase import of a proven, committed helper
// rather than a second copy of the same bug-prone maths.)
//
// Every bar is a LINK: a period bar narrows the date range, a supplier bar toggles that supplier's
// filter. The charts double as filter controls with no client JS.
//
// MONEY (AC9): both charts here are baht measures by construction, so `page.tsx` renders them ONLY
// when `canSeeMoney` is true. Staff gets the count-based fallback list instead — never an empty
// chart shell.
//
// An empty bin draws an explicit zero-height stub with a visible baseline rather than a gap: "no
// purchases this month" and "data missing this month" must not look the same.

export interface PurchaseChartBin extends PurchaseTimeBin {
  amount: number;
  count: number;
}

function VerticalBars({
  bins,
  searchParams,
  testId,
  caption,
  tone,
}: {
  bins: readonly PurchaseChartBin[];
  searchParams: RawSearchParams;
  testId: string;
  caption: string;
  tone: string;
}) {
  const values = bins.map((b) => b.amount);
  const { top, ticks, heights } = computeBarScale(values);
  const tickLabels = ticks.map((t) => formatInt(Math.round(t)));
  const yWidth = yAxisWidth(tickLabels);
  const gridCols = `${yWidth}px minmax(0,1fr)`;

  return (
    <figure data-testid={testId} className="overflow-x-auto">
      {/* pt leaves room for the value cap that sits just above the tallest bar */}
      <div className="grid min-w-full pt-5" style={{ gridTemplateColumns: gridCols }}>
        <div className="relative" style={{ height: `${PLOT_HEIGHT}px` }} aria-hidden="true">
          {ticks.map((t, i) => (
            <span
              key={t}
              className="absolute right-2 translate-y-1/2 text-[11px] tabular-nums text-[var(--text-faint)]"
              style={{ bottom: top > 0 ? `${(t / top) * 100}%` : "0%" }}
            >
              {tickLabels[i]}
            </span>
          ))}
        </div>

        <div
          className="relative border-b border-[var(--border)]"
          style={{ height: `${PLOT_HEIGHT}px` }}
        >
          {ticks.slice(1).map((t) => (
            <i
              key={t}
              aria-hidden="true"
              className="absolute inset-x-0 block border-t border-[var(--border)] opacity-60"
              style={{ bottom: top > 0 ? `${(t / top) * 100}%` : "0%" }}
            />
          ))}

          <div className="absolute inset-0 flex">
            {bins.map((bin, i) => {
              const value = bin.amount;
              const barPx = heights[i];
              return (
                <Link
                  key={bin.key}
                  href={purchaseHref(searchParams, { from: bin.from, to: bin.to, page: null })}
                  data-testid={`${testId}-bar-${bin.key}`}
                  title={`${bin.full}: ${formatMoney(value)}`}
                  aria-label={`${bin.full}: ${
                    value > 0 ? formatMoney(value) : "0 บาท — ไม่มีใบแจ้งหนี้ซื้อในช่วงนี้"
                  } จากใบแจ้งหนี้ ${formatInt(bin.count)} ใบ — คลิกเพื่อกรองเฉพาะช่วงนี้`}
                  className="group relative flex min-w-[44px] flex-1 items-end justify-center rounded-[var(--r-sm)] hover:bg-[var(--bg-sunken)]"
                >
                  <span
                    data-testid={`${testId}-mark-${bin.key}`}
                    data-value={value}
                    className="block rounded-t-[4px] transition-opacity group-hover:opacity-80"
                    style={{
                      height: `${value > 0 ? barPx : 2}px`,
                      width: "min(24px,46%)",
                      backgroundColor: value > 0 ? tone : "var(--text-faint)",
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className={
                      "th absolute inset-x-0 text-center text-[11px] tabular-nums " +
                      (value > 0
                        ? "font-semibold text-[var(--text-strong)]"
                        : "text-[var(--text-muted)]")
                    }
                    style={{ bottom: `${(value > 0 ? barPx : 2) + 4}px` }}
                  >
                    {formatMoney(value)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-1 grid min-w-full" style={{ gridTemplateColumns: gridCols }}>
        <span />
        <div className="flex">
          {bins.map((bin) => (
            <span
              key={bin.key}
              className="th min-w-[44px] flex-1 text-center text-[10px] text-[var(--text-faint)]"
            >
              {bin.label}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="th mt-2 text-[11px] text-[var(--text-faint)]">{caption}</figcaption>
    </figure>
  );
}

/** "ยอดซื้อตามใบแจ้งหนี้ ราย{เดือน}" — Admin-only, sums to the invoice-basis KPI at every granularity. */
export function PurchasePeriodChart({
  bins,
  period,
  from,
  to,
  searchParams,
}: {
  bins: readonly PurchaseChartBin[];
  period: PurchasePeriod;
  from: string;
  to: string;
  searchParams: RawSearchParams;
}) {
  const periodLabel = PURCHASE_PERIODS.find((p) => p.key === period)?.label ?? "";
  const scopeNote = binScopeNote(bins, period, from, to);
  const hasAny = bins.some((b) => b.amount > 0);

  return (
    <Card className="flex flex-col p-4" data-testid="purchase-period-chart">
      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
        ยอดซื้อตามใบแจ้งหนี้ ราย{periodLabel}
      </h2>
      <p className="th mb-3 text-[var(--t-xs)] text-[var(--text-muted)]">
        เฉพาะผู้ดูแลระบบ · หน่วยเป็นบาท · รวมทุก{periodLabel}เท่ากับยอดซื้อ (ตามใบแจ้งหนี้) ด้านบน
      </p>
      {bins.length === 0 || !hasAny ? (
        <p className="th py-8 text-center text-[var(--t-sm)] text-[var(--text-faint)]">
          ไม่มีใบแจ้งหนี้ซื้อในช่วงที่เลือก
        </p>
      ) : (
        <VerticalBars
          bins={bins}
          searchParams={searchParams}
          testId="purchase-period-bars"
          tone="var(--accent)"
          caption={`หน่วยแกน: ${periodLabel} · แถบเทาที่ฐาน = 0 บาท (ไม่มีใบแจ้งหนี้ซื้อใน${periodLabel}นั้น ไม่ใช่ข้อมูลขาดหาย)${scopeNote}`}
        />
      )}
    </Card>
  );
}

export interface SupplierBarRow {
  supplierCode: string;
  invoiceAmount: number;
  poAmount: number;
  poCount: number;
}

/**
 * "ยอดซื้อตามซัพพลายเออร์" — a horizontal grouped bar per supplier showing BOTH bases side by side,
 * at equal weight, matching the KPI tiles above. Admin-only (it is a baht chart);
 * `SupplierCountList` below is the Staff equivalent.
 */
export function PurchaseSupplierChart({
  rows,
  selected,
  searchParams,
}: {
  rows: readonly SupplierBarRow[];
  selected: string | null;
  searchParams: RawSearchParams;
}) {
  const max = Math.max(0, ...rows.flatMap((r) => [r.invoiceAmount, r.poAmount]));
  const BAR_WIDTH = 168; // px — the same "resolve geometry in pixels" rule as the column chart

  const widthPx = (value: number) =>
    max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * BAR_WIDTH)) : 2;

  return (
    <Card className="flex flex-col p-4" data-testid="purchase-supplier-chart">
      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
        ยอดซื้อตามซัพพลายเออร์
      </h2>
      <p className="th mb-3 text-[var(--t-xs)] text-[var(--text-muted)]">
        แสดงยอดทั้ง 2 แบบเท่ากัน · คลิกแถวเพื่อกรองตามซัพพลายเออร์
      </p>

      {rows.length === 0 ? (
        <p className="th py-8 text-center text-[var(--t-sm)] text-[var(--text-faint)]">
          ไม่มีใบสั่งซื้อในช่วงที่เลือก
        </p>
      ) : (
        <>
          <ul className="mb-2 flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: "var(--accent)" }}
              />
              <span className="th">ยอดซื้อ (ตามใบแจ้งหนี้)</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: "var(--brand-int)" }}
              />
              <span className="th">ยอดซื้อ (ตามใบสั่งซื้อ)</span>
            </li>
          </ul>

          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.supplierCode}>
                <Link
                  href={purchaseHref(searchParams, {
                    supplier: selected === row.supplierCode ? null : row.supplierCode,
                    page: null,
                  })}
                  data-testid={`purchase-supplier-bar-${row.supplierCode}`}
                  aria-pressed={selected === row.supplierCode}
                  aria-label={`${row.supplierCode}: ตามใบแจ้งหนี้ ${formatMoney(
                    row.invoiceAmount,
                  )}, ตามใบสั่งซื้อ ${formatMoney(row.poAmount)}, ${formatInt(
                    row.poCount,
                  )} ใบสั่งซื้อ`}
                  className={
                    "flex flex-col gap-1 rounded-[var(--r-sm)] px-2 py-1.5 hover:bg-[var(--bg-sunken)] " +
                    (selected === row.supplierCode ? "bg-[var(--bg-sunken)]" : "")
                  }
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="th text-[var(--t-sm)] font-medium text-[var(--text)]">
                      {row.supplierCode}
                    </span>
                    <span className="th text-[11px] text-[var(--text-faint)]">
                      {formatInt(row.poCount)} ใบสั่งซื้อ
                    </span>
                  </span>
                  {(
                    [
                      { key: "inv", value: row.invoiceAmount, color: "var(--accent)" },
                      { key: "po", value: row.poAmount, color: "var(--brand-int)" },
                    ] as const
                  ).map((series) => (
                    <span key={series.key} className="flex items-center gap-2">
                      <span
                        data-testid={`purchase-supplier-${series.key}-${row.supplierCode}`}
                        data-value={series.value}
                        className="block h-2.5 rounded-[2px]"
                        style={{
                          width: `${widthPx(series.value)}px`,
                          backgroundColor:
                            series.value > 0 ? series.color : "var(--text-faint)",
                        }}
                      />
                      <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                        {formatMoney(series.value)}
                      </span>
                    </span>
                  ))}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/**
 * The Staff equivalent of the supplier chart: the SAME suppliers, ranked by PO COUNT instead of
 * baht. AC9 forbids showing Staff a money figure — but showing them an empty chart shell instead
 * would be a worse answer than showing them the part of the picture they are allowed to see.
 */
export function SupplierCountList({
  rows,
  selected,
  searchParams,
}: {
  rows: readonly SupplierBarRow[];
  selected: string | null;
  searchParams: RawSearchParams;
}) {
  const max = Math.max(0, ...rows.map((r) => r.poCount));
  const BAR_WIDTH = 168;

  return (
    <Card className="flex flex-col p-4" data-testid="purchase-supplier-counts">
      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
        ใบสั่งซื้อตามซัพพลายเออร์
      </h2>
      <p className="th mb-3 text-[var(--t-xs)] text-[var(--text-muted)]">
        นับจำนวนใบสั่งซื้อที่ไม่ถูกยกเลิก · คลิกเพื่อกรองตามซัพพลายเออร์
      </p>

      {rows.length === 0 ? (
        <p className="th py-8 text-center text-[var(--t-sm)] text-[var(--text-faint)]">
          ไม่มีใบสั่งซื้อในช่วงที่เลือก
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.supplierCode}>
              <Link
                href={purchaseHref(searchParams, {
                  supplier: selected === row.supplierCode ? null : row.supplierCode,
                  page: null,
                })}
                data-testid={`purchase-supplier-count-${row.supplierCode}`}
                aria-pressed={selected === row.supplierCode}
                className={
                  "flex items-center gap-3 rounded-[var(--r-sm)] px-2 py-1.5 hover:bg-[var(--bg-sunken)] " +
                  (selected === row.supplierCode ? "bg-[var(--bg-sunken)]" : "")
                }
              >
                <span className="th min-w-[5.5rem] text-[var(--t-sm)] text-[var(--text)]">
                  {row.supplierCode}
                </span>
                <span
                  aria-hidden="true"
                  data-value={row.poCount}
                  className="block h-2.5 rounded-[2px]"
                  style={{
                    width: `${
                      max > 0 && row.poCount > 0
                        ? Math.max(2, Math.round((row.poCount / max) * BAR_WIDTH))
                        : 2
                    }px`,
                    backgroundColor: row.poCount > 0 ? "var(--brand-int)" : "var(--text-faint)",
                  }}
                />
                <span className="th text-[11px] tabular-nums text-[var(--text-muted)]">
                  {formatInt(row.poCount)} ใบสั่งซื้อ
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="th mt-3 text-[11px] text-[var(--text-faint)]">
        สัดส่วนยอดซื้อ (บาท) แสดงเฉพาะผู้ดูแลระบบ — พนักงานเห็นเป็นจำนวนใบสั่งซื้อแทน
      </p>
    </Card>
  );
}
