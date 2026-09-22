import * as React from "react";
import Link from "next/link";
import { SALES_PERIODS, type SalesPeriod } from "@/lib/sales-basis-core";
import { salesHref, type RawSearchParams } from "./sales-url";

// erp-dashboards Phase 2 — "แบ่งกราฟตาม" (สัปดาห์ / เดือน / ปี), the ONE period-granularity control.
//
// BOTH sales charts read their bins from this single `?period=` value — the DO-count chart (all
// users) and the Admin-only money chart — so their bars can never be cut on different period
// boundaries. เดือน is the default (the ERP reports sales monthly).
//
// Server component: the segmented control is three links, not buttons, so the selection round-trips
// through the URL with zero client JS and a reload reproduces the chosen bin exactly (AC8/AC10).

export function SalesPeriodToggle({
  current,
  searchParams,
}: {
  current: SalesPeriod;
  searchParams: RawSearchParams;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span id="sales-period-label" className="th text-[var(--t-xs)] text-[var(--text-muted)]">
        แบ่งกราฟตาม
      </span>
      <div
        role="group"
        aria-labelledby="sales-period-label"
        data-testid="sales-period-toggle"
        className="inline-flex overflow-hidden rounded-[var(--r-md)] border border-[var(--border)]"
      >
        {SALES_PERIODS.map((period) => {
          const active = period.key === current;
          return (
            <Link
              key={period.key}
              href={salesHref(searchParams, { period: period.key, page: null })}
              data-testid={`sales-period-${period.key}`}
              aria-pressed={active}
              className={
                "th border-r border-[var(--border)] px-3 py-1.5 text-[var(--t-xs)] last:border-r-0 " +
                (active
                  ? "bg-[var(--brand-int)] text-[var(--text-on-brand)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-sunken)]")
              }
            >
              {period.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
