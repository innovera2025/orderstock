import * as React from "react";
import { Chip } from "./ui/chip";
import { ceToBeDisplay, parseDateInputValue } from "@/lib/be-date";
import type { ErpDataRange } from "@/lib/erp-date-range";

// ช่วงข้อมูล — the shared notice at the top of every dashboard (erp-dashboards Phase 1, SPEC AC16).
//
// WHAT CHANGED (user decision 23-09-26, option 3): this used to render one fixed sentence —
// "ข้อมูลชุดนี้อยู่ระหว่างช่วงนำร่อง โปรดตรวจสอบกับระบบ ERP ก่อนนำไปใช้อ้างอิง" — on all three dashboards. A warning that
// never changes teaches the reader to ignore it. It now states the REAL data range each dashboard
// can draw from, so the same strip of screen informs instead of nags.
//
// STILL PRESENTATIONAL: no data fetching, no client state, no `use client`. Each page reads its own
// unfiltered `*-date-range.sql` and passes the result down. `data-testid="pilot-banner"` is kept so
// every existing gate still selects it.
//
// HONESTY RULE: with no props (the three `*-unavailable.tsx` screens call it that way, because the
// ERP is unreachable there) the range is OMITTED, never invented — the banner says the range is not
// known rather than printing a made-up one.

/** The neutral chip label. No longer an alarm word — it names what the line next to it reports. */
export const PILOT_BANNER_TEXT = "ช่วงข้อมูล";

/** Shown when the ERP could not be read at all, or holds no dated document yet. */
export const DATA_RANGE_UNKNOWN_TEXT = "ยังไม่ทราบช่วงข้อมูลในระบบ ERP";

/** Thai BE short date (d/m/yy) from a CE `yyyy-mm-dd`. */
function beShort(iso: string): string {
  return ceToBeDisplay(parseDateInputValue(iso));
}

/**
 * The factual sentence, as a pure function so it can be unit-tested without rendering.
 *
 * Three states, all honest:
 *   1. range + count  -> "ข้อมูลในระบบ ERP มีตั้งแต่ 3/8/69 ถึง 22/9/69 · ใบส่งสินค้า 14 ใบ"
 *   2. count only     -> "ข้อมูลในระบบ ERP มีใบส่งสินค้า 14 ใบ"  (dates missing/NULL)
 *   3. nothing known  -> "ยังไม่ทราบช่วงข้อมูลในระบบ ERP"
 *
 * A zero count with no dates is state 3: the ERP genuinely holds nothing to describe.
 */
export function dataRangeText(range?: ErpDataRange | null): string {
  if (!range) return DATA_RANGE_UNKNOWN_TEXT;

  const countText =
    range.count > 0 ? `${range.docLabel} ${range.count.toLocaleString("en-US")} ใบ` : "";

  if (range.from && range.to) {
    const span = `ข้อมูลในระบบ ERP มีตั้งแต่ ${beShort(range.from)} ถึง ${beShort(range.to)}`;
    return countText ? `${span} · ${countText}` : span;
  }

  return countText ? `ข้อมูลในระบบ ERP มี${countText}` : DATA_RANGE_UNKNOWN_TEXT;
}

export function PilotBanner({
  range,
  className = "",
}: {
  /** The dashboard's real ERP data range. Omit it when the range genuinely is not known. */
  range?: ErpDataRange | null;
  className?: string;
}) {
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
      <Chip tone="neutral" className="th">
        {PILOT_BANNER_TEXT}
      </Chip>
      <span
        data-testid="pilot-banner-range"
        className="th text-[var(--t-xs)] text-[var(--text-muted)]"
      >
        {dataRangeText(range)}
      </span>
    </div>
  );
}
