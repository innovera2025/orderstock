import * as React from "react";
import { Card } from "@/components/ui/card";
import { formatInt, formatMoney } from "@/lib/purchase-calc";

// erp-dashboards Phase 3 — KPI tiles.
//
// TWO MONEY TILES, EQUAL WEIGHT (AC5). "ยอดซื้อ (ตามใบแจ้งหนี้)" is what the business has been
// BILLED (KRS's own sp_PurchaseInvoiceMonth rule); "ยอดซื้อ (ตามใบสั่งซื้อ)" is what it has
// COMMITTED to spend. Both are fully counted and both are correct — they answer different
// questions and diverge because some POs have no matching invoice yet. Which one the customer
// wants as their headline is an open question deferred to backlog, so neither tile is styled as
// primary or secondary: same size, same order of magnitude of prominence, each carrying its own
// basis label so a user can never mistake one for "the" total.
//
// MONEY (AC9): `canSeeMoney` is computed ONCE, server-side, in `page.tsx` from `requireAuth()`.
// When it is false this component renders NO money markup at all — a Staff user's HTML never
// contains the figures, so there is nothing to un-hide in devtools. It is never a CSS class and
// never a client-side check.

export interface PurchaseKpiProps {
  canSeeMoney: boolean;
  invoiceTotal: number;
  invoiceCount: number;
  poTotal: number;
  poCount: number;
  supplierCount: number;
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

function Value({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className="text-[var(--t-xl)] font-semibold tabular-nums text-[var(--text-strong)]"
    >
      {children}
    </span>
  );
}

export function PurchaseKpiTiles({
  canSeeMoney,
  invoiceTotal,
  invoiceCount,
  poTotal,
  poCount,
  supplierCount,
}: PurchaseKpiProps) {
  return (
    <section aria-label="ตัวเลขสรุปการซื้อ" data-testid="purchase-kpis">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {canSeeMoney ? (
          <>
            {/* Basis 1 of 2 — billed. Equal weight with the tile beside it, by design. */}
            <Tile
              label="ยอดซื้อ (ตามใบแจ้งหนี้)"
              hint={`จากใบแจ้งหนี้ซื้อ ${formatInt(invoiceCount)} ใบ ในช่วงที่เลือก`}
              testId="kpi-invoice-basis"
            >
              <Value testId="kpi-invoice-basis-amount">{formatMoney(invoiceTotal)}</Value>
            </Tile>

            {/* Basis 2 of 2 — committed. Same tile shape, same type scale: neither is "the" total. */}
            <Tile
              label="ยอดซื้อ (ตามใบสั่งซื้อ)"
              hint={`จากใบสั่งซื้อ ${formatInt(poCount)} ใบ ที่ไม่ถูกยกเลิก`}
              testId="kpi-po-basis"
            >
              <Value testId="kpi-po-basis-amount">{formatMoney(poTotal)}</Value>
            </Tile>
          </>
        ) : (
          // AC9: no amount, no label naming an amount, nothing to reveal — just the reason.
          <Tile label="ยอดซื้อ" testId="kpi-money-locked">
            <span className="th text-[var(--t-sm)] text-[var(--text-faint)]">
              ยอดซื้อแสดงเฉพาะผู้ดูแลระบบ
            </span>
          </Tile>
        )}

        <Tile label="จำนวนใบสั่งซื้อ" hint="ไม่นับใบที่ยกเลิก" testId="kpi-po-count">
          <Value>
            {formatInt(poCount)} <span className="th text-[var(--t-sm)] font-normal">ใบ</span>
          </Value>
        </Tile>

        <Tile
          label="จำนวนซัพพลายเออร์"
          hint="ที่มีใบสั่งซื้อในช่วงที่เลือก"
          testId="kpi-supplier-count"
        >
          <Value>
            {formatInt(supplierCount)} <span className="th text-[var(--t-sm)] font-normal">ราย</span>
          </Value>
        </Tile>
      </div>
    </section>
  );
}
