import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { moStatusLabel } from "@/lib/production-status";
import { productionHref, type ProductionUrlState } from "./production-url";

// erp-dashboards Phase 4 — the Production filter bar (AC10).
//
// ONE native `<form method="get">` updating every filter param in a single navigation, matching
// the approved mockup and Phase 2's own filter bar — a SERVER component with zero client JS.
// Reloading the resulting URL reproduces the same view exactly.
//
// NO period/granularity toggle here: the approved mockup's production tab has none, because this
// dashboard has no time-series chart for a granularity to govern (the one chart is per-product).
//
// Hidden inputs carry params the form has no visible control for — a GET submit rebuilds the whole
// query string from its own fields, so anything unrepresented would be silently dropped.

const hiddenKeys = ["sort"] as const;

/** Buddhist-era year for a CE `yyyy-mm-dd` string (display only; CE is always what is stored). */
function beShort(iso: string): string {
  const year = Number(iso.slice(0, 4));
  return Number.isFinite(year) ? String(year + 543) : "";
}

export function ProductionFilterBar({ state }: { state: ProductionUrlState }) {
  return (
    <Card className="p-4" data-testid="production-filter-bar">
      <form
        method="get"
        action="/dashboards/production"
        className="flex flex-wrap items-end gap-4"
      >
        {hiddenKeys.map((key) => {
          const value = state.raw[key];
          const single = Array.isArray(value) ? value[0] : value;
          return single ? <input key={key} type="hidden" name={key} value={single} /> : null;
        })}

        <div className="flex flex-col gap-1">
          <label htmlFor="production-from" className="th text-[var(--t-xs)] text-[var(--text-muted)]">
            ตั้งแต่
          </label>
          <input
            id="production-from"
            name="from"
            type="date"
            defaultValue={state.from}
            data-testid="production-from"
            className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--t-sm)] text-[var(--text)]"
          />
          <span className="th text-[11px] text-[var(--text-faint)]">พ.ศ. {beShort(state.from)}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="production-to" className="th text-[var(--t-xs)] text-[var(--text-muted)]">
            ถึง
          </label>
          <input
            id="production-to"
            name="to"
            type="date"
            defaultValue={state.to}
            data-testid="production-to"
            className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--t-sm)] text-[var(--text)]"
          />
          <span className="th text-[11px] text-[var(--text-faint)]">พ.ศ. {beShort(state.to)}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="production-status"
            className="th text-[var(--t-xs)] text-[var(--text-muted)]"
          >
            สถานะ
          </label>
          <select
            id="production-status"
            name="status"
            defaultValue={state.status ?? ""}
            data-testid="production-status-filter"
            className="th rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--t-sm)] text-[var(--text)]"
          >
            <option value="">ทุกสถานะ</option>
            {["pending", "approved", "closed"].map((key) => (
              <option key={key} value={key}>
                {moStatusLabel(key)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          data-testid="production-apply-filters"
          className="th rounded-[var(--r-md)] bg-[var(--brand-int)] px-4 py-1.5 text-[var(--t-sm)] font-medium text-[var(--text-on-brand)] hover:bg-[var(--brand-int-hover)]"
        >
          ใช้ตัวกรอง
        </button>
      </form>

      {state.status && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="production-filter-chips">
          <span
            data-testid="chip-status"
            className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--bg-sunken)] px-2.5 py-0.5 text-[var(--t-xs)] text-[var(--text-muted)]"
          >
            <span className="th">สถานะ: {moStatusLabel(state.status)}</span>
            <Link
              href={productionHref(state.raw, { status: null, page: null })}
              aria-label="ล้างตัวกรองสถานะ"
              data-testid="chip-status-clear"
              className="font-semibold text-[var(--text-faint)] hover:text-[var(--text)]"
            >
              ✕
            </Link>
          </span>
        </div>
      )}
    </Card>
  );
}
