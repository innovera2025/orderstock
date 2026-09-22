import * as React from "react";
import { Chip } from "@/components/ui/chip";
import { formatQty, formatQtyWithUnit } from "@/lib/purchase-calc";

// erp-dashboards Phase 3 — how an outstanding quantity is rendered, including when it is negative.
//
// A NEGATIVE OUTSTANDING IS REAL DATA, NOT A BUG TO CLAMP. It means more goods were received than
// the PO ordered — a genuine warehouse/receiving discrepancy the business should see. So:
//
//   * the value is NEVER floored to 0 and never hidden;
//   * the LABEL leads ("รับเกิน 10 กก.") so the reader understands it before parsing a sign;
//   * the raw ERP number stays visible right after it (−10), so the figure on screen is the figure
//     in the database.
//
// A normal outstanding renders plainly, with its unit, and never merged with another unit's number.

export function OutstandingQty({ value, unit }: { value: number; unit: string }) {
  if (value < 0) {
    return (
      <Chip
        tone="warning"
        className="th"
        data-testid="outstanding-over-received"
        title="รับสินค้าเกินจำนวนที่สั่ง — ค่าค้างรับจาก ERP ติดลบ"
      >
        รับเกิน {formatQtyWithUnit(-value, unit)}{" "}
        <span className="tabular-nums">({"−"}{formatQty(-value)})</span>
      </Chip>
    );
  }
  return (
    <span className="th" data-testid="outstanding-qty">
      ค้าง <span className="tabular-nums">{formatQtyWithUnit(value, unit)}</span>
    </span>
  );
}
