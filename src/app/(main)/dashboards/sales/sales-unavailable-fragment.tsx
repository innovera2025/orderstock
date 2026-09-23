import * as React from "react";
import { Card } from "@/components/ui/card";
import { SALES_UNAVAILABLE_BODY, SALES_UNAVAILABLE_TITLE } from "./sales-unavailable";

// sales-invoice-basis (23-09-26) — the PER-SECTION "ERP unreachable" notice.
//
// WHY THIS EXISTS SEPARATELY FROM `sales-unavailable.tsx`: that component renders the WHOLE page
// shell — the `<main data-testid="sales-dashboard">` root, the `<h1>`, the pilot banner and the
// filter bar. It cannot be rendered twice (once per section) without duplicating the page root and
// the id every existing e2e selector keys on. This is just the notice block, scoped to one
// section, so the other section keeps rendering its real data.
//
// THREE DISTINCT STATES, all of which must render correctly:
//   (a) BOTH sections down with nothing cached  → the whole-page `SalesUnavailable` fallback,
//       unchanged, with its original `data-testid="sales-erp-unavailable"`;
//   (b) ONE section down, the other has data    → this fragment, with its own section-scoped
//       testid, beside a normally-rendered sibling section;
//   (c) stale-but-cached                        → neither; the existing `DegradeBanner` path.
//
// This is the COLD-CACHE case only: `getCached()` re-throws when a live read fails and no
// last-known-good value has ever been stored.

export function SalesUnavailableFragment({
  testId,
  sectionLabel,
}: {
  /** e.g. `sales-invoice-unavailable` / `sales-delivery-unavailable`. */
  testId: string;
  /** The Thai section name, so the user knows WHICH half of the page is missing. */
  sectionLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div
        role="status"
        className={
          "flex flex-col gap-1 rounded-[var(--r-lg)] border border-[var(--danger)] " +
          "bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-xs)] text-[var(--danger)]"
        }
      >
        <span className="th font-medium">
          {sectionLabel}: {SALES_UNAVAILABLE_TITLE}
        </span>
        <span className="th opacity-80">{SALES_UNAVAILABLE_BODY}</span>
      </div>

      <Card className="p-6">
        <p className="th text-center text-[var(--t-sm)] text-[var(--text-muted)]">
          ยังไม่มีข้อมูลที่จะแสดง
        </p>
      </Card>
    </div>
  );
}
