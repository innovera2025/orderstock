import * as React from "react";
import { Chip } from "./ui/chip";

// Pilot-data notice (erp-dashboards Phase 1, SPEC AC16). Presentational server component, no
// props beyond an optional className. Phases 2/3/4 IMPORT and render this at the top of each
// dashboard page rather than re-authoring the markup — its export shape is a binding contract
// once this phase closes.

export const PILOT_BANNER_TEXT = "ข้อมูลนำร่อง";

export function PilotBanner({ className = "" }: { className?: string }) {
  return (
    <div
      data-testid="pilot-banner"
      role="note"
      className={
        "flex items-center gap-2 rounded-[var(--r-lg)] border border-[var(--border)] " +
        "bg-[var(--bg-sunken)] px-3 py-2 " +
        className
      }
    >
      <Chip tone="accent" className="th">
        {PILOT_BANNER_TEXT}
      </Chip>
      <span className="th text-[var(--t-xs)] text-[var(--text-muted)]">
        ข้อมูลชุดนี้อยู่ระหว่างช่วงนำร่อง โปรดตรวจสอบกับระบบ ERP ก่อนนำไปใช้อ้างอิง
      </span>
    </div>
  );
}
