import * as React from "react";
import { Card } from "@/components/ui/card";
import { PilotBanner } from "@/components/pilot-banner";

// erp-dashboards Phase 4 — the explicit "ERP unreachable" view.
//
// Phase 1's `getCached()` serves the last-known-good value when a live read fails, but RE-THROWS
// when nothing has ever been cached (first hit after a restart, or an outage that begins before
// the first successful read). Letting that throw escape would render Next's generic 500; this is
// the Thai equivalent Phase 2 established. The stale-data path is unaffected — it still renders
// the full dashboard behind `DegradeBanner`.

export function ProductionUnavailable() {
  return (
    <main className="flex w-full flex-col gap-4 p-4 sm:p-6" data-testid="production-unavailable">
      <header className="flex flex-col gap-1">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">การผลิต</h1>
      </header>
      <PilotBanner />
      <Card className="flex flex-col gap-2 p-6">
        <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้
        </h2>
        <p className="th text-[var(--t-sm)] text-[var(--text-muted)]">
          ยังไม่มีข้อมูลที่เคยโหลดสำเร็จไว้ให้แสดงแทน กรุณาลองใหม่อีกครั้งในภายหลัง
        </p>
      </Card>
    </main>
  );
}
