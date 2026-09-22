import * as React from "react";
import { Card } from "@/components/ui/card";
import { PilotBanner } from "@/components/pilot-banner";

// erp-dashboards Phase 3 — the explicit "ERP unreachable" view.
//
// Phase 1's `getCached()` serves the last known good value when a live read fails, but RE-THROWS
// when nothing has ever been cached (a cold process, or an outage that begins before the first
// successful read). Letting that throw escape renders Next's generic 500 — a broken-looking screen
// with no Thai explanation and no way to tell "ERP is down" from "the app is broken". So the page
// catches it and renders this instead.
//
// This is the same fix Phase 2 made after its own EVL cycle found the 500; reproduced here rather
// than imported so neither phase owns the other's failure view.

export function PurchaseUnavailable() {
  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="purchase-unavailable">
      <header className="flex flex-col gap-1">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">
          แดชบอร์ดการซื้อ
        </h1>
      </header>

      <PilotBanner />

      <Card className="flex flex-col gap-2 p-6 text-center">
        <span className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          เชื่อมต่อระบบ ERP ไม่ได้ในขณะนี้
        </span>
        <span className="th text-[var(--t-sm)] text-[var(--text-muted)]">
          ยังไม่มีข้อมูลที่บันทึกไว้ล่าสุดให้แสดง โปรดลองใหม่อีกครั้ง
          หากยังไม่ได้โปรดแจ้งผู้ดูแลระบบ
        </span>
      </Card>
    </main>
  );
}
