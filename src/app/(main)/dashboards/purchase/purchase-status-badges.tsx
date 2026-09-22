import * as React from "react";
import { Chip } from "@/components/ui/chip";
import { PO_STATUS_UNVALIDATED_TEXT, poStatusLabel, poStatusTone } from "@/lib/purchase-calc";

// erp-dashboards Phase 3 — the PO status chip and its mandatory caveat.
//
// THE CAVEAT IS NOT OPTIONAL (AC6). The PO-status precedence rule was AUTHORED from the ERP's flag
// columns, not read off a validated enum: the live data has 4 PO rows, all in the same lifecycle
// state, and `PurchaseOrderHdr.Status` is free text ('Pending' on every row). Research rates the
// rule LOW confidence. So every rendered status is paired with a visible
// "ยังไม่ผ่านการยืนยัน" badge.
//
// They are TWO separate chips, never merged into one. That is deliberate: when confidence improves
// the caveat should disappear in a one-line diff, without touching the status label itself.

export function PoStatusBadges({ status }: { status: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid={`po-status-${status}`}>
      <Chip tone={poStatusTone(status)} className="th">
        {poStatusLabel(status)}
      </Chip>
      <Chip tone="warning" className="th" data-testid="po-status-unvalidated">
        {PO_STATUS_UNVALIDATED_TEXT}
      </Chip>
    </span>
  );
}

/** The one-line explanation of what the caveat badge means, shown once per table/section. */
export function PoStatusCaveatNote({ className = "" }: { className?: string }) {
  return (
    <p
      data-testid="po-status-caveat-note"
      className={"th text-[11px] leading-relaxed text-[var(--text-faint)] " + className}
    >
      ป้าย “{PO_STATUS_UNVALIDATED_TEXT}” หมายถึงสถานะนี้คำนวณจากข้อมูลในระบบ ERP
      และยังไม่ได้ตรวจทานกับผู้ใช้งานจริง
    </p>
  );
}
