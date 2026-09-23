import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  beShort,
  categoryLabel,
  salesStatusLabel,
  type CategoryLabels,
} from "@/lib/sales-basis-core";
import { SalesPeriodToggle } from "./sales-period-toggle";
import { clearPageParams, salesHref, type SalesUrlState } from "./sales-url";

// erp-dashboards Phase 2 — the filter bar.
//
// INNOVATE decision (22-09-26): ONE native `<form method="get">` that updates every filter param in
// a single navigation — matching the approved mockup exactly, rather than `shop-location-filter`'s
// per-field `useRouter` push. That keeps this a SERVER component with zero client JS.
//
// Every non-date filter that a chart/donut click set is shown as a dismissible chip whose `x` link
// removes just that param, so a user can always see (and undo) what is narrowing the view.
//
// Hidden inputs carry the params the form has no visible control for — a GET form submit rebuilds
// the query string from its own fields, so anything not represented here would be silently dropped.

const hiddenKeys = ["view", "customer", "product", "status", "cat", "period"] as const;

// `catLabels` carries the ERP's own `tbl_ItemGroup` labels (see `sales-basis-core.ts`) so the
// "หมวดสินค้า" chip names the selected category the same way the pie does. It is optional: without
// it the chip still renders the safe "หมวด {code}" fallback rather than nothing.
export function SalesFilterBar({
  state,
  catLabels,
}: {
  state: SalesUrlState;
  catLabels?: CategoryLabels;
}) {
  const chips: Array<{ label: string; value: string; clear: string; testId: string }> = [];
  if (state.customer) {
    chips.push({
      label: "ลูกค้า",
      value: state.customer,
      clear: salesHref(state.raw, { customer: null, view: null, ...clearPageParams() }),
      testId: "chip-customer",
    });
  }
  if (state.product) {
    chips.push({
      label: "สินค้า",
      value: state.product,
      clear: salesHref(state.raw, { product: null, view: null, ...clearPageParams() }),
      testId: "chip-product",
    });
  }
  if (state.status) {
    chips.push({
      label: "สถานะการส่งมอบ",
      value: salesStatusLabel(state.status),
      clear: salesHref(state.raw, { status: null, ...clearPageParams() }),
      testId: "chip-status",
    });
  }
  if (state.cat) {
    chips.push({
      label: "หมวดสินค้า",
      value: categoryLabel(state.cat, catLabels),
      clear: salesHref(state.raw, { cat: null, ...clearPageParams() }),
      testId: "chip-cat",
    });
  }

  return (
    <Card className="p-4" data-testid="sales-filter-bar">
      <form method="get" action="/dashboards/sales" className="flex flex-wrap items-end gap-4">
        {hiddenKeys.map((key) => {
          const value = state.raw[key];
          const single = Array.isArray(value) ? value[0] : value;
          return single ? <input key={key} type="hidden" name={key} value={single} /> : null;
        })}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="sales-from"
            className="th text-[var(--t-xs)] text-[var(--text-muted)]"
          >
            ตั้งแต่
          </label>
          <input
            id="sales-from"
            name="from"
            type="date"
            defaultValue={state.from}
            data-testid="sales-from"
            className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--t-sm)] text-[var(--text)]"
          />
          <span className="th text-[11px] text-[var(--text-faint)]">พ.ศ. {beShort(state.from)}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sales-to" className="th text-[var(--t-xs)] text-[var(--text-muted)]">
            ถึง
          </label>
          <input
            id="sales-to"
            name="to"
            type="date"
            defaultValue={state.to}
            data-testid="sales-to"
            className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--t-sm)] text-[var(--text)]"
          />
          <span className="th text-[11px] text-[var(--text-faint)]">พ.ศ. {beShort(state.to)}</span>
        </div>

        <SalesPeriodToggle current={state.period} searchParams={state.raw} />

        <button
          type="submit"
          data-testid="sales-apply-filters"
          className="th rounded-[var(--r-md)] bg-[var(--brand-int)] px-4 py-1.5 text-[var(--t-sm)] font-medium text-[var(--text-on-brand)] hover:bg-[var(--brand-int-hover)]"
        >
          ใช้ตัวกรอง
        </button>
      </form>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="sales-filter-chips">
          {chips.map((chip) => (
            <span
              key={chip.testId}
              data-testid={chip.testId}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--bg-sunken)] px-2.5 py-0.5 text-[var(--t-xs)] text-[var(--text-muted)]"
            >
              <span className="th">
                {chip.label}: {chip.value}
              </span>
              <Link
                href={chip.clear}
                aria-label={`ล้างตัวกรอง${chip.label}`}
                data-testid={`${chip.testId}-clear`}
                className="font-semibold text-[var(--text-faint)] hover:text-[var(--text)]"
              >
                ✕
              </Link>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
