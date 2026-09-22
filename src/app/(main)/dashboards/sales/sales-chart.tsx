import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  SALES_PERIODS,
  binScopeNote,
  formatInt,
  formatMoney,
  type SalesPeriod,
  type TimeBin,
} from "@/lib/sales-basis-core";
import {
  PLOT_HEIGHT,
  computeBarScale,
  yAxisWidth,
} from "@/lib/sales-chart-scale";
import { salesHref, type RawSearchParams } from "./sales-url";

// erp-dashboards Phase 2 — the period bar charts.
//
// CHARTING DECISION (Defaults Taken #5): HAND-ROLLED CSS/div bars, matching `/summary`'s existing
// pattern. No charting dependency was added. The approved mockup already proves this form renders
// correctly with IBM Plex Sans Thai in both light and dark mode, it costs zero bundle weight, and
// it keeps the chart a SERVER component (a canvas/SVG charting library would force a client
// boundary here). See the phase report's charting-decision section.
//
// Every bar is a LINK: clicking one narrows the date range to that bin, which is why the chart
// doubles as a filter control with no client JS.
//
// MONEY (AC9): the money series is a SEPARATE chart rendered only when `canSeeMoney` is true —
// baht and document counts are different measures and must never share an axis. A Staff user's
// HTML contains no money chart at all.
//
// An empty bin draws an explicit zero-height bar with a visible baseline rather than a gap: "no
// priced lines this month" and "data missing this month" must not look the same.

export interface ChartBin extends TimeBin {
  count: number;
  amount: number;
}

function BarChart({
  bins,
  values,
  formatValue,
  formatTick,
  integer,
  searchParams,
  testId,
  emptyText,
  caption,
  tone,
}: {
  bins: readonly ChartBin[];
  values: readonly number[];
  formatValue: (n: number) => string;
  formatTick: (n: number) => string;
  integer: boolean;
  searchParams: RawSearchParams;
  testId: string;
  emptyText: string;
  caption: string;
  tone: string;
}) {
  const { top, ticks, heights } = computeBarScale(values, { integer });
  if (bins.length === 0 || top <= 0) {
    return (
      <p className="th py-8 text-center text-[var(--t-sm)] text-[var(--text-faint)]">{emptyText}</p>
    );
  }

  const tickLabels = ticks.map(formatTick);
  const yWidth = yAxisWidth(tickLabels);
  // Bar heights are PIXELS, not percentages — see src/lib/sales-chart-scale.ts for why.
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
              style={{ bottom: `${(t / top) * 100}%` }}
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
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex">
            {bins.map((bin, i) => {
              const value = values[i];
              const barPx = heights[i];
              return (
                <Link
                  key={bin.key}
                  href={salesHref(searchParams, { from: bin.from, to: bin.to, page: null })}
                  data-testid={`${testId}-bar-${bin.key}`}
                  title={`${bin.full}: ${formatValue(value)}`}
                  aria-label={`${bin.full}: ${formatValue(value)} — คลิกเพื่อกรองเฉพาะช่วงนี้`}
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
                    {formatValue(value)}
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

export function SalesChart({
  bins,
  period,
  from,
  to,
  canSeeMoney,
  searchParams,
}: {
  bins: readonly ChartBin[];
  period: SalesPeriod;
  from: string;
  to: string;
  canSeeMoney: boolean;
  searchParams: RawSearchParams;
}) {
  const periodLabel = SALES_PERIODS.find((p) => p.key === period)?.label ?? "";
  const scopeNote = binScopeNote(bins, period, from, to);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="flex flex-col p-4" data-testid="sales-count-chart">
        <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          จำนวนใบส่งสินค้าราย{periodLabel}
        </h2>
        <p className="th mb-3 text-[var(--t-xs)] text-[var(--text-muted)]">
          นับตามวันที่ในใบส่งสินค้า · แตะแท่งเพื่อกรองเฉพาะ{periodLabel}นั้น
        </p>
        <BarChart
          bins={bins}
          values={bins.map((b) => b.count)}
          formatValue={(n) => formatInt(n)}
          formatTick={(n) => formatInt(n)}
          integer
          searchParams={searchParams}
          testId="sales-count-bars"
          emptyText="ไม่มีใบส่งสินค้าในช่วงที่เลือก"
          caption={`หน่วยแกน: ${periodLabel}${scopeNote}`}
          tone="var(--brand-int)"
        />
      </Card>

      {canSeeMoney && (
        <Card className="flex flex-col p-4" data-testid="sales-money-chart">
          <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
            ยอดเงินเฉพาะรายการที่มีราคา ราย{periodLabel}
          </h2>
          <p className="th mb-3 text-[var(--t-xs)] text-[var(--text-muted)]">
            เฉพาะผู้ดูแลระบบ · หน่วยเป็นบาท
          </p>
          <BarChart
            bins={bins}
            values={bins.map((b) => b.amount)}
            formatValue={(n) => formatMoney(n)}
            formatTick={(n) => formatInt(Math.round(n))}
            integer={false}
            searchParams={searchParams}
            testId="sales-money-bars"
            emptyText="ไม่มีรายการที่มีราคาในช่วงที่เลือก"
            caption={`หน่วยแกน: ${periodLabel} · แถบเทาที่ฐาน = 0 บาท (ไม่มีรายการที่มีราคาใน${periodLabel}นั้น ไม่ใช่ข้อมูลขาดหาย)${scopeNote}`}
            tone="var(--accent)"
          />
        </Card>
      )}
    </div>
  );
}
