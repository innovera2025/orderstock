import * as React from "react";
import { Card } from "@/components/ui/card";
import { computeBarScale } from "@/lib/sales-chart-scale";
import { formatInt, formatQty } from "@/lib/production-status";

// erp-dashboards Phase 4 — "ปริมาณตามแผนต่อสินค้า": planned quantity per finished-goods item.
//
// HAND-ROLLED CSS BARS, no charting dependency (execute-agent instruction E4: Phase 2's Recharts
// spike was never attempted; every Phase 2 chart ships hand-rolled and package.json is unchanged).
// Geometry comes from Phase 2's PURE px-scale helper `computeBarScale` — NEVER a CSS percentage
// height/width, which collapsed to the 2px floor in Phase 2 because the parent had no definite
// size. Horizontal bars here, so the px value drives WIDTH against a fixed-px track.
//
// GROUPED BY UNIT: one sub-chart per distinct MainUnits value. Quantities from different units are
// never placed on the same axis, because a shared axis would imply they are comparable.

const TRACK_PX = 320;

export interface PlanChartItem {
  code: string;
  name: string;
  unit: string;
  qty: number;
  moCount: number;
}

function UnitGroup({ unit, items, showUnitHeading }: {
  unit: string;
  items: readonly PlanChartItem[];
  showUnitHeading: boolean;
}) {
  const { top, heights } = computeBarScale(
    items.map((i) => i.qty),
    { plotHeight: TRACK_PX },
  );

  return (
    <div className="flex flex-col gap-2" data-testid={`production-plan-chart-unit-${unit}`}>
      {showUnitHeading && (
        <h3 className="th text-[var(--t-xs)] font-medium text-[var(--text-muted)]">
          หน่วย: {unit}
        </h3>
      )}
      {items.map((item, i) => (
        <div key={item.code} className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="th truncate text-[var(--t-xs)] text-[var(--text)]" title={item.name}>
              {item.name}
            </span>
            <span className="th shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
              {formatQty(item.qty)} {unit} · {formatInt(item.moCount)} ใบ
            </span>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-[var(--r-sm)] bg-[var(--bg-sunken)]"
            role="img"
            aria-label={`${item.name}: ปริมาณตามแผน ${formatQty(item.qty)} ${unit} จาก ${formatInt(item.moCount)} ใบสั่งผลิต`}
          >
            <span
              data-testid={`production-plan-bar-${item.code}`}
              data-value={item.qty}
              data-width-px={item.qty > 0 ? heights[i] : 0}
              className="block h-full rounded-[var(--r-sm)] bg-[var(--brand-int)]"
              style={{
                width: `${item.qty > 0 ? Math.max(heights[i], 3) : 0}px`,
                maxWidth: "100%",
              }}
            />
          </div>
        </div>
      ))}
      <span className="th text-[10px] text-[var(--text-faint)]">
        สูงสุดของแกน: {formatQty(top)} {unit}
      </span>
    </div>
  );
}

export function ProductionPlanChart({ items }: { items: readonly PlanChartItem[] }) {
  const units = [...new Set(items.map((i) => i.unit))];

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="production-plan-chart">
      <header className="flex flex-col gap-0.5">
        <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          ปริมาณตามแผนต่อสินค้า
        </h2>
        <p className="th text-[11px] text-[var(--text-faint)]">
          รวมจากใบสั่งผลิตในช่วงที่เลือก · ไม่ใช่ปริมาณที่ผลิตได้จริง
        </p>
      </header>

      {items.length === 0 ? (
        <p className="th py-6 text-center text-[var(--t-sm)] text-[var(--text-muted)]">
          ไม่มีใบสั่งผลิตในช่วงที่เลือก
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {units.map((unit) => (
            <UnitGroup
              key={unit}
              unit={unit}
              showUnitHeading={units.length > 1}
              items={items.filter((i) => i.unit === unit)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
