import * as React from "react";
import { Card } from "@/components/ui/card";
import {
  formatInt,
  formatMoney,
  formatPercent,
  formatQty,
  deliveryCoverageNote,
} from "@/lib/sales-basis-core";

// erp-dashboards Phase 2 — the DELIVERY section's KPI tiles ("การส่งมอบ").
//
// SECONDARY SECTION as of sales-invoice-basis (23-09-26): the dashboard's headline money now comes
// from the invoice basis (`invoice-kpi-tiles.tsx`). These tiles answer the other half of the
// question — what actually left the warehouse — and keep their own, unchanged coverage caveat.
//
// PRIMARY FIGURES ARE COUNTS AND QUANTITIES, not money: those are the only Sales numbers the live
// ERP can currently back in full. Quantities render ONE ROW PER UNIT and are never combined into a
// single cross-unit number (umbrella charter hard safety constraint).
//
// MONEY (AC9): the `canSeeMoney` prop is computed ONCE, server-side, in `page.tsx` from
// `requireAuth()`. When it is false this component renders NO money markup at all — a Staff user's
// HTML never contains the figure, so there is nothing to un-hide in devtools. It is never a CSS
// class, never a client-side check.
//
// The money tile ALWAYS ships three things together (AC4): the priced-only amount, the coverage %,
// and the footnote naming the priced/total line counts. They are one unit — the footnote sits
// directly under the amount and can never be hidden separately from it. The footnote NO LONGER
// mentions the invoice pool: that money is not excluded any more, it is this dashboard's primary
// figure, and the invoice tile carries the cross-reference in the other direction.

export interface SalesKpiProps {
  doCount: number;
  lineCount: number;
  quantityByUnit: Array<{ unit: string; qty: number }>;
  canSeeMoney: boolean;
  pricedAmount: number;
  pricedLineCount: number;
  coverage: number;
}

function Tile({
  label,
  hint,
  children,
  testId,
  wide = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  testId: string;
  wide?: boolean;
}) {
  return (
    <Card className={"flex flex-col gap-1 p-4 " + (wide ? "sm:col-span-2" : "")} data-testid={testId}>
      <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">{label}</span>
      {children}
      {hint && <span className="th text-[11px] text-[var(--text-faint)]">{hint}</span>}
    </Card>
  );
}

export function SalesKpiTiles(props: SalesKpiProps) {
  const {
    doCount,
    lineCount,
    quantityByUnit,
    canSeeMoney,
    pricedAmount,
    pricedLineCount,
    coverage,
  } = props;

  return (
    <section aria-label="ตัวเลขสรุปการขาย" data-testid="sales-kpis">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="จำนวนใบส่งสินค้า" hint="นับตามวันที่ในใบส่งสินค้า" testId="kpi-do-count">
          <span className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]">
            {formatInt(doCount)} <span className="th text-[var(--t-sm)] font-normal">ใบ</span>
          </span>
        </Tile>

        <Tile label="จำนวนรายการ" hint="บรรทัดสินค้าในใบส่งสินค้า" testId="kpi-line-count">
          <span className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]">
            {formatInt(lineCount)} <span className="th text-[var(--t-sm)] font-normal">รายการ</span>
          </span>
        </Tile>

        {/* One row per unit. There is deliberately NO combined total here — summing across
            different MainUnits values would be arithmetic nonsense presented as a fact. */}
        <Tile
          label="จำนวนสินค้า (ตามหน่วย)"
          hint="แยกตามหน่วย ไม่รวมข้ามหน่วย"
          testId="kpi-qty-by-unit"
        >
          {quantityByUnit.length === 0 ? (
            <span className="th text-[var(--t-sm)] text-[var(--text-faint)]">—</span>
          ) : (
            <div className="flex flex-col gap-0.5">
              {quantityByUnit.map((entry) => (
                <div
                  key={entry.unit}
                  data-testid={`kpi-qty-unit-${entry.unit}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-[var(--t-base)] font-semibold tabular-nums text-[var(--text-strong)]">
                    {formatQty(entry.qty)}
                  </span>
                  <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">{entry.unit}</span>
                </div>
              ))}
            </div>
          )}
        </Tile>

        {canSeeMoney ? (
          <Tile label="ยอดเงินเฉพาะรายการที่มีราคา" testId="kpi-money">
            <span
              data-testid="kpi-money-amount"
              className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]"
            >
              {formatMoney(pricedAmount)}
            </span>
            <span className="th text-[11px] text-[var(--text-muted)]" data-testid="kpi-money-coverage">
              ครอบคลุม {formatPercent(coverage)}% ของรายการ (มีราคา {formatInt(pricedLineCount)} จาก{" "}
              {formatInt(lineCount)} รายการ)
            </span>
            <div
              role="img"
              aria-label={`สัดส่วนรายการที่มีราคา ${formatPercent(coverage)}%`}
              className="h-1.5 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg-sunken)]"
            >
              <span
                className="block h-full bg-[var(--accent)]"
                style={{ width: `${Math.max(0, Math.min(100, coverage))}%` }}
              />
            </div>
            {/* AC4 — the footnote NAMES the counts and sits directly under the figure. */}
            <p
              data-testid="kpi-money-footnote"
              className="th mt-1 text-[11px] leading-relaxed text-[var(--text-faint)]"
            >
              {deliveryCoverageNote(pricedLineCount, lineCount)}
            </p>
          </Tile>
        ) : (
          <Tile label="ยอดเงิน" testId="kpi-money-locked">
            <span className="th text-[var(--t-sm)] text-[var(--text-faint)]">
              ยอดเงินแสดงเฉพาะผู้ดูแลระบบ
            </span>
          </Tile>
        )}
      </div>
    </section>
  );
}
