import * as React from "react";
import type { ErpDegradeState } from "../lib/erp/degrade";

// Stale-data notice (erp-dashboards Phase 1, SPEC AC15 UI half). Presentational server component
// that takes `erpDegradeState()`'s return shape directly and renders nothing when the data is
// fresh. Phases 2/3/4 IMPORT this rather than re-deriving the markup — its export shape is a
// binding contract once this phase closes.

export function DegradeBanner({
  state,
  className = "",
}: {
  state: ErpDegradeState;
  className?: string;
}) {
  if (!state.showBanner) return null;

  return (
    <div
      data-testid="degrade-banner"
      role="status"
      className={
        "flex items-center gap-2 rounded-[var(--r-lg)] border border-[var(--warning)] " +
        "bg-[var(--warning-bg)] px-3 py-2 text-[var(--t-xs)] text-[var(--warning)] " +
        className
      }
    >
      <span className="th font-medium">{state.bannerText}</span>
      <span className="th opacity-80">
        ระบบแสดงข้อมูลที่บันทึกไว้ล่าสุด เนื่องจากเชื่อมต่อ ERP ไม่ได้ชั่วคราว
      </span>
    </div>
  );
}
