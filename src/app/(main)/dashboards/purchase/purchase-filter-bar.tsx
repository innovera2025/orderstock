import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  PO_STATUSES,
  PURCHASE_PERIODS,
  beShort,
  poStatusLabel,
} from "@/lib/purchase-calc";
import { PURCHASE_BASE_PATH, purchaseHref, type PurchaseUrlState } from "./purchase-url";

// erp-dashboards Phase 3 — the filter bar (date range + ซัพพลายเออร์ + สถานะ + period toggle).
//
// ONE native `<form method="get">` updates every filter param in a single navigation — the same
// decision Phase 2's sibling bar made, and what the approved mockup draws. That keeps this a SERVER
// component with zero client JS; a reload or a shared link reproduces the view exactly (AC10).
//
// Hidden inputs carry the params the form has no visible control for: a GET form submit rebuilds
// the query string from its own fields, so anything not represented here would be silently dropped.
//
// Every filter a chart/donut click set is ALSO shown as a dismissible chip whose ✕ removes just
// that param, so a user can always see (and undo) what is narrowing the view.
//
// The period toggle governs the period CHART, which is an invoice-baht measure and therefore
// Admin-only — so the toggle is hidden for Staff too. A control governing nothing would be worse
// than no control.

const hiddenKeys = ["supplier", "status", "period"] as const;

export function PurchaseFilterBar({
  state,
  suppliers,
  canSeeMoney,
}: {
  state: PurchaseUrlState;
  /** Every SupplierCode present in the unfiltered range, so the list never hides an option. */
  suppliers: readonly string[];
  canSeeMoney: boolean;
}) {
  const chips: Array<{ label: string; value: string; clear: string; testId: string }> = [];
  if (state.supplier) {
    chips.push({
      label: "ซัพพลายเออร์",
      value: state.supplier,
      clear: purchaseHref(state.raw, { supplier: null, page: null }),
      testId: "chip-supplier",
    });
  }
  if (state.status) {
    chips.push({
      label: "สถานะ",
      value: poStatusLabel(state.status),
      clear: purchaseHref(state.raw, { status: null, page: null }),
      testId: "chip-status",
    });
  }

  const fieldClass =
    "rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 " +
    "text-[var(--t-sm)] text-[var(--text)]";

  return (
    <Card className="p-4" data-testid="purchase-filter-bar">
      <form method="get" action={PURCHASE_BASE_PATH} className="flex flex-wrap items-end gap-4">
        {hiddenKeys.map((key) => {
          const value = state.raw[key];
          const single = Array.isArray(value) ? value[0] : value;
          // `supplier`/`status` have their own visible <select> below — only `period` needs a
          // hidden carrier, and only when it is not the default.
          return key === "period" && single ? (
            <input key={key} type="hidden" name={key} value={single} />
          ) : null;
        })}

        <div className="flex flex-col gap-1">
          <label htmlFor="purchase-from" className="th text-[var(--t-xs)] text-[var(--text-muted)]">
            ตั้งแต่
          </label>
          <input
            id="purchase-from"
            name="from"
            type="date"
            defaultValue={state.from}
            data-testid="purchase-from"
            className={fieldClass}
          />
          <span className="th text-[11px] text-[var(--text-faint)]">พ.ศ. {beShort(state.from)}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="purchase-to" className="th text-[var(--t-xs)] text-[var(--text-muted)]">
            ถึง
          </label>
          <input
            id="purchase-to"
            name="to"
            type="date"
            defaultValue={state.to}
            data-testid="purchase-to"
            className={fieldClass}
          />
          <span className="th text-[11px] text-[var(--text-faint)]">พ.ศ. {beShort(state.to)}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="purchase-supplier"
            className="th text-[var(--t-xs)] text-[var(--text-muted)]"
          >
            ซัพพลายเออร์
          </label>
          {/* The CODE is the label: the supplier master is bulk-imported legacy data and no
              verified name column exists, so showing a name would be a claim the data can't back. */}
          <select
            id="purchase-supplier"
            name="supplier"
            defaultValue={state.supplier ?? ""}
            data-testid="purchase-supplier"
            className={fieldClass}
          >
            <option value="">ทั้งหมด</option>
            {suppliers.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="purchase-status"
            className="th text-[var(--t-xs)] text-[var(--text-muted)]"
          >
            สถานะ
          </label>
          <select
            id="purchase-status"
            name="status"
            defaultValue={state.status ?? ""}
            data-testid="purchase-status"
            className={fieldClass}
          >
            <option value="">ทุกสถานะ</option>
            {PO_STATUSES.map((status) => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {canSeeMoney && (
          <div className="flex flex-col gap-1">
            <span
              id="purchase-period-label"
              className="th text-[var(--t-xs)] text-[var(--text-muted)]"
            >
              แบ่งกราฟตาม
            </span>
            <div
              role="group"
              aria-labelledby="purchase-period-label"
              data-testid="purchase-period-toggle"
              className="inline-flex overflow-hidden rounded-[var(--r-md)] border border-[var(--border)]"
            >
              {PURCHASE_PERIODS.map((period) => {
                const active = period.key === state.period;
                return (
                  <Link
                    key={period.key}
                    href={purchaseHref(state.raw, { period: period.key, page: null })}
                    data-testid={`purchase-period-${period.key}`}
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
        )}

        <button
          type="submit"
          data-testid="purchase-apply-filters"
          className="th rounded-[var(--r-md)] bg-[var(--brand-int)] px-4 py-1.5 text-[var(--t-sm)] font-medium text-[var(--text-on-brand)] hover:bg-[var(--brand-int-hover)]"
        >
          ใช้ตัวกรอง
        </button>
      </form>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="purchase-filter-chips">
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
