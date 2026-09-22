// erp-dashboards Phase 3 — assembling the PO view model from the three ERP reads.
//
// This is where the PO headers, the PO lines and the `sp_Popending` receipt totals are stitched
// together, and — critically — where MONEY IS STRIPPED (AC9).
//
// MONEY GATING (AC9): `canSeeMoney` is computed ONCE per request in `page.tsx` from the server-side
// session and passed in here. When it is false, every money field is simply ABSENT from the object
// the components receive (`amount`/`unitPrice`/`totalAmount` are optional properties that are never
// assigned), so a Staff user's server-rendered HTML contains no money markup and no money value at
// all. It is never a CSS class, never `display:none`, never a client-side check — there is nothing
// in the DOM to reveal. Each strip point below carries a comment naming AC9 so a later refactor
// cannot quietly turn it into a hide.

import {
  computeOutstanding,
  derivePoStatus,
  quantitiesByUnit,
  type PoStatus,
  type UnitQuantityTotal,
} from "@/lib/purchase-calc";
import {
  isoDate,
  receivedKey,
  toNumber,
  type PoHeaderRow,
  type PoLineRow,
  type PoReceivedRow,
} from "@/lib/purchase-data";

export interface PoLineView {
  number: number;
  itemCode: string;
  unit: string;
  qty: number;
  received: number;
  outstanding: number;
  /** AC9 — present only for Admin. */
  unitPrice?: number;
  /** AC9 — present only for Admin. */
  amount?: number;
}

export interface PoView {
  transactionNo: number;
  poNumber: string;
  /** CE `yyyy-mm-dd`; rendered in BE at the edge. */
  date: string;
  supplierCode: string;
  status: PoStatus;
  cancelled: boolean;
  lineCount: number;
  lines: PoLineView[];
  /** Received/outstanding per unit — NEVER a single cross-unit number. */
  unitTotals: UnitQuantityTotal[];
  /** AC9 — present only for Admin. */
  totalAmount?: number;
}

export function buildPoViews(
  headers: readonly PoHeaderRow[],
  lines: readonly PoLineRow[],
  received: readonly PoReceivedRow[],
  canSeeMoney: boolean,
): PoView[] {
  const receivedByKey = new Map<string, number>();
  for (const row of received) {
    receivedByKey.set(receivedKey(row.PoNo, row.ItemCode), toNumber(row.ReceivedQty));
  }

  const linesByTransaction = new Map<number, PoLineRow[]>();
  for (const line of lines) {
    const bucket = linesByTransaction.get(line.TransactionNo);
    if (bucket) bucket.push(line);
    else linesByTransaction.set(line.TransactionNo, [line]);
  }

  return headers.map((header) => {
    const rawLines = linesByTransaction.get(header.TransactionNo) ?? [];

    const lineViews: PoLineView[] = rawLines.map((line) => {
      const qty = toNumber(line.Qty);
      // A PO line with no matching receipt simply has no row in `po-received.sql`'s result —
      // absent means zero received, never NaN.
      const rec = receivedByKey.get(receivedKey(header.PONumber, line.ItemCode)) ?? 0;
      const view: PoLineView = {
        number: toNumber(line.Number),
        itemCode: line.ItemCode,
        unit: (line.Unit ?? "").trim() || "-",
        qty,
        received: rec,
        // Raw, unclamped: a negative outstanding is a real over-receipt worth surfacing.
        outstanding: computeOutstanding(qty, rec),
      };
      // AC9 — money is ADDED for Admin, not blanked for Staff. For Staff these keys never exist.
      if (canSeeMoney) {
        view.unitPrice = toNumber(line.UnitPrice);
        view.amount = toNumber(line.Amount);
      }
      return view;
    });

    const view: PoView = {
      transactionNo: header.TransactionNo,
      poNumber: header.PONumber,
      date: isoDate(header.VoucherDate),
      supplierCode: (header.SupplierCode ?? "").trim() || "-",
      status: derivePoStatus({
        isCancel: header.IsCancel === true,
        // NULL must stay NULL here: `derivePoStatus` applies the ERP's ISNULL(IsClosed,0) semantic
        // itself, and coercing it to false earlier would hide that decision from its own unit test.
        isClosed: header.IsClosed ?? null,
        isComplete: header.IsComplete === true,
        isRecPo: header.IsRecPo === true,
        isApproved: header.IsApproved === true,
        isCheck: header.IsCheck === true,
      }),
      cancelled: header.IsCancel === true,
      lineCount: lineViews.length,
      lines: lineViews,
      unitTotals: quantitiesByUnit(
        lineViews.map((l) => ({ unit: l.unit, orderedQty: l.qty, receivedQty: l.received })),
      ),
    };
    // AC9 — the header money figure is added for Admin only.
    if (canSeeMoney) {
      view.totalAmount = toNumber(header.TotalAmount);
    }
    return view;
  });
}

/** Count POs per derived status, over the WHOLE range (cancelled included) — feeds the donut. */
export function countByStatus(views: readonly PoView[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const view of views) {
    counts.set(view.status, (counts.get(view.status) ?? 0) + 1);
  }
  return counts;
}
