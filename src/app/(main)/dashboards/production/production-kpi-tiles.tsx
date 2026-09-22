import * as React from "react";
import { Card } from "@/components/ui/card";
import { formatInt, formatQty, type UnitQuantity } from "@/lib/production-status";

// erp-dashboards Phase 4 — the three Production KPI tiles.
//
// NO MONEY ANYWHERE. Production carries no THB figure in this phase's scope, so there is no
// `canSeeMoney` gate here — there is nothing to gate. (Recorded for Phase 5's cross-dashboard
// money audit: "no money gate found" is CORRECT for this dashboard, not a bug.)
//
// Tile 2 lists planned quantity PER UNIT, one line each. Quantities from different MainUnits are
// never added together — a combined number would be meaningless.

function Tile({
  label,
  hint,
  testId,
  children,
}: {
  label: string;
  hint: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4" data-testid={testId}>
      <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">{label}</span>
      {children}
      <span className="th text-[11px] text-[var(--text-faint)]">{hint}</span>
    </Card>
  );
}

export function ProductionKpiTiles({
  moCount,
  plannedByUnit,
  moWithIssueCount,
}: {
  moCount: number;
  plannedByUnit: readonly UnitQuantity[];
  moWithIssueCount: number;
}) {
  return (
    <section
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="ตัวเลขสรุปการผลิต"
    >
      <Tile label="จำนวนใบสั่งผลิต (ตามแผน)" hint="นับตามวันที่วางแผน" testId="kpi-mo-count">
        <span className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]">
          {formatInt(moCount)} <span className="th text-[var(--t-xs)] font-normal">ใบ</span>
        </span>
      </Tile>

      <Tile
        label="ปริมาณตามแผน (ต่อหน่วย)"
        hint="แยกตามหน่วย ไม่รวมข้ามหน่วย"
        testId="kpi-planned-qty"
      >
        {plannedByUnit.length === 0 ? (
          <span className="th text-[var(--t-base)] text-[var(--text-muted)]">—</span>
        ) : (
          <ul className="flex flex-col gap-0.5" data-testid="kpi-planned-qty-by-unit">
            {plannedByUnit.map((u) => (
              <li
                key={u.unit}
                data-testid={`kpi-planned-qty-unit-${u.unit}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-[var(--t-base)] font-semibold tabular-nums text-[var(--text-strong)]">
                  {formatQty(u.qty)}
                </span>
                <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">{u.unit}</span>
              </li>
            ))}
          </ul>
        )}
      </Tile>

      <Tile
        label="ใบสั่งผลิตที่มีการเบิกวัตถุดิบ"
        hint={`จากทั้งหมด ${formatInt(moCount)} ใบ`}
        testId="kpi-mo-with-issues"
      >
        <span className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]">
          {formatInt(moWithIssueCount)} <span className="th text-[var(--t-xs)] font-normal">ใบ</span>
        </span>
      </Tile>
    </section>
  );
}
