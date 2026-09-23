import * as React from "react";
import { Card } from "@/components/ui/card";
import { formatInt, formatMoney, formatQty } from "@/lib/sales-basis-core";

// sales-invoice-basis (23-09-26) — the INVOICE section's KPI tiles: the dashboard's PRIMARY figures.
//
// WHY THIS IS THE PRIMARY MONEY: the customer's own ERP team named `sp_SalesInvoice` as the source
// of truth for sales. Delivery orders carry the goods; invoices carry the money. Unlike the
// delivery basis — where only a small fraction of lines carry a price, so its money figure needs a
// permanent coverage caveat — every invoice line's amount rolls up into its header total, so this
// figure needs no coverage-% qualifier. When an individual invoice does NOT reconcile (a partially
// invoiced document) the drilldown says so on that invoice, not here.
//
// MONEY (AC9): `canSeeMoney` is computed ONCE, server-side, in `page.tsx` from `requireAuth()`.
// When it is false this component renders NO money markup at all — a Staff user's HTML never
// contains the figure. It is never a CSS class and never a client-side check.
//
// QUANTITIES render ONE ROW PER UNIT and are never combined into a single cross-unit number
// (umbrella charter hard safety constraint).

export interface InvoiceKpiProps {
  invoiceCount: number;
  lineCount: number;
  quantityByUnit: Array<{ unit: string; qty: number }>;
  canSeeMoney: boolean;
  /** Sum of the selected invoices' header `TotalAmount`. */
  invoiceTotal: number;
  /** Sum of those invoices' line amounts (NULL-safe). Equal to `invoiceTotal` when all reconcile. */
  lineTotal: number;
}

function Tile({
  label,
  hint,
  children,
  testId,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4" data-testid={testId}>
      <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">{label}</span>
      {children}
      {hint && <span className="th text-[11px] text-[var(--text-faint)]">{hint}</span>}
    </Card>
  );
}

export function InvoiceKpiTiles(props: InvoiceKpiProps) {
  const { invoiceCount, lineCount, quantityByUnit, canSeeMoney, invoiceTotal, lineTotal } = props;

  // Both sides are DECIMAL(18,2); anything beyond a float artefact is a real partial-invoice gap.
  const reconciles = Math.round(invoiceTotal * 100) === Math.round(lineTotal * 100);

  return (
    <section aria-label="ตัวเลขสรุปยอดขายตามใบแจ้งหนี้" data-testid="invoice-kpis">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {canSeeMoney ? (
          <Tile label="ยอดขายตามใบแจ้งหนี้" testId="kpi-invoice-money">
            <span
              data-testid="kpi-invoice-money-amount"
              className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]"
            >
              {formatMoney(invoiceTotal)}
            </span>
            <p
              data-testid="kpi-invoice-money-footnote"
              className="th mt-1 text-[11px] leading-relaxed text-[var(--text-faint)]"
            >
              {reconciles
                ? "ยอดที่ออกใบแจ้งหนี้แล้วทั้งหมดในช่วงที่เลือก ยอดรวมรายการตรงกับยอดตามหัวใบแจ้งหนี้ทุกใบ"
                : `ยอดที่ออกใบแจ้งหนี้แล้วทั้งหมดในช่วงที่เลือก (ยอดรวมรายการ ${formatMoney(lineTotal)} — มีใบที่ออกบางส่วน)`}{" "}
              ดูจำนวนสินค้าที่ส่งจริงได้ที่หัวข้อ &quot;การส่งมอบ&quot; ด้านล่าง
            </p>
          </Tile>
        ) : (
          <Tile label="ยอดขายตามใบแจ้งหนี้" testId="kpi-invoice-money-locked">
            <span className="th text-[var(--t-sm)] text-[var(--text-faint)]">
              ยอดเงินแสดงเฉพาะผู้ดูแลระบบ
            </span>
          </Tile>
        )}

        <Tile label="จำนวนใบแจ้งหนี้" hint="นับตามวันที่ในใบแจ้งหนี้" testId="kpi-invoice-count">
          <span className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]">
            {formatInt(invoiceCount)} <span className="th text-[var(--t-sm)] font-normal">ใบ</span>
          </span>
        </Tile>

        <Tile label="จำนวนรายการ" hint="บรรทัดสินค้าในใบแจ้งหนี้" testId="kpi-invoice-line-count">
          <span className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]">
            {formatInt(lineCount)} <span className="th text-[var(--t-sm)] font-normal">รายการ</span>
          </span>
        </Tile>

        {/* One row per unit. There is deliberately NO combined total here — summing across
            different MainUnits values would be arithmetic nonsense presented as a fact. */}
        <Tile
          label="จำนวนสินค้า (ตามหน่วย)"
          hint="แยกตามหน่วย ไม่รวมข้ามหน่วย"
          testId="kpi-invoice-qty-by-unit"
        >
          {quantityByUnit.length === 0 ? (
            <span className="th text-[var(--t-sm)] text-[var(--text-faint)]">—</span>
          ) : (
            <div className="flex flex-col gap-0.5">
              {quantityByUnit.map((entry) => (
                <div
                  key={entry.unit}
                  data-testid={`kpi-invoice-qty-unit-${entry.unit}`}
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
      </div>
    </section>
  );
}
