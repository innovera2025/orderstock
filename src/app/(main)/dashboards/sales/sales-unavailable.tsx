import * as React from "react";
import { Card } from "@/components/ui/card";
import { PilotBanner } from "@/components/pilot-banner";
import { SalesFilterBar } from "./sales-filter-bar";
import type { SalesUrlState } from "./sales-url";

// erp-dashboards Phase 2 — the WHOLE-PAGE ERP-unreachable fallback (EVL fix cycle 1, 22-09-26).
//
// SCOPE NARROWED (sales-invoice-basis, 23-09-26): this now renders ONLY when BOTH the invoice and
// the delivery section fail cold with nothing cached. When just one section is down the page keeps
// rendering normally and that section shows `sales-unavailable-fragment.tsx` instead — so this
// component, and its `data-testid="sales-erp-unavailable"` contract, are unchanged.
//
// WHY THIS EXISTS: Phase 1's `getCached()` deliberately RE-THROWS when the live ERP read fails and
// the cache holds no previous value (a cold process — first hit after a deploy/restart, or an ERP
// outage that starts before the first successful read). Without this fallback that throw escaped
// the page and Next rendered its generic 500 ("A server error occurred"), which is both a bad
// customer experience and contrary to the approved mockup's requirement that the dashboard always
// renders with an explicit Thai empty/stale state.
//
// CONTRACT: renders a 200 page carrying the SAME `data-testid="sales-dashboard"` root, the pilot
// banner, and a fully working filter bar (so the date range / period toggle still round-trip through
// the URL), but ZERO figures — which also means zero money markup, for every role.
//
// This is NOT the stale-data path. When a last-known-good value exists, `getCached()` serves it and
// the page renders normally with Phase 1's `DegradeBanner` ("ข้อมูลอาจไม่ล่าสุด"). This view is only
// for "no live data AND nothing cached to fall back on".

export const SALES_UNAVAILABLE_TITLE = "ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้";
export const SALES_UNAVAILABLE_BODY =
  "ยังไม่มีข้อมูลที่บันทึกไว้ก่อนหน้า จึงยังแสดงตัวเลขไม่ได้ กรุณาลองใหม่อีกครั้งในอีกสักครู่ " +
  "หากยังไม่ได้ กรุณาแจ้งผู้ดูแลระบบ";

export function SalesUnavailable({ state }: { state: SalesUrlState }) {
  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="sales-dashboard">
      <header className="flex flex-col gap-1">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">ยอดขาย</h1>
        <p className="th text-[var(--t-xs)] text-[var(--text-muted)]">
          ยอดขายจากใบแจ้งหนี้ และการส่งมอบจากใบส่งสินค้า ในระบบ ERP (อ่านอย่างเดียว)
        </p>
      </header>

      <PilotBanner />

      <div
        data-testid="sales-erp-unavailable"
        role="status"
        className={
          "flex flex-col gap-1 rounded-[var(--r-lg)] border border-[var(--danger)] " +
          "bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-xs)] text-[var(--danger)]"
        }
      >
        <span className="th font-medium">{SALES_UNAVAILABLE_TITLE}</span>
        <span className="th opacity-80">{SALES_UNAVAILABLE_BODY}</span>
      </div>

      <SalesFilterBar state={state} />

      <Card className="p-6">
        <p className="th text-center text-[var(--t-sm)] text-[var(--text-muted)]">
          ยังไม่มีข้อมูลที่จะแสดง
        </p>
      </Card>
    </main>
  );
}
