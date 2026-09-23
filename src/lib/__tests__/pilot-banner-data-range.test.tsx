import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DATA_RANGE_UNKNOWN_TEXT,
  PILOT_BANNER_TEXT,
  PilotBanner,
  dataRangeText,
} from "@/components/pilot-banner";
import { toErpDataRange, type ErpDateRangeRow } from "@/lib/erp-date-range";

// USER DECISION GATE (23-09-26, option 3). The shared dashboard notice used to render ONE fixed
// sentence — "ข้อมูลชุดนี้อยู่ระหว่างช่วงนำร่อง โปรดตรวจสอบกับระบบ ERP ก่อนนำไปใช้อ้างอิง" — on all three dashboards. It now
// states the REAL ERP data range instead, so it informs rather than nags.
//
// What this file proves:
//   1. all THREE states render honestly: full range + count, count only, and nothing known;
//   2. the range is NEVER invented — a missing/NULL date omits the range, it does not fabricate one;
//   3. dates render in Buddhist Era via `be-date.ts` (3/8/69, not 2026-08-03);
//   4. the old alarming wording is gone, and `data-testid="pilot-banner"` survives so every
//      existing e2e gate still selects the same element.
//
// JSDOM-FREE BY DESIGN, matching `sales-category-erp-labels.test.tsx`: the component is rendered to
// an HTML string with `react-dom/server`.

const OLD_PILOT_SENTENCE = "ข้อมูลชุดนี้อยู่ระหว่างช่วงนำร่อง";

function row(over: Partial<ErpDateRangeRow>): ErpDateRangeRow[] {
  return [{ DocCount: 0, FirstDate: null, LastDate: null, ...over }];
}

describe("dataRangeText — the three honest states", () => {
  it("state 1: a full range renders both BE dates and the document count", () => {
    const text = dataRangeText(
      toErpDataRange(row({ DocCount: 83, FirstDate: "2026-08-14", LastDate: "2026-09-23" }), "ใบส่งสินค้า"),
    );
    // 2026 CE = 2569 BE -> "69".
    expect(text).toBe("ข้อมูลในระบบ ERP มีตั้งแต่ 14/8/69 ถึง 23/9/69 · ใบส่งสินค้า 83 ใบ");
  });

  it("state 2: a count with NO usable dates reports the count and OMITS the range", () => {
    const text = dataRangeText(toErpDataRange(row({ DocCount: 5 }), "ใบสั่งซื้อ"));
    expect(text).toBe("ข้อมูลในระบบ ERP มีใบสั่งซื้อ 5 ใบ");
    // The whole point: no fabricated range sneaks in.
    expect(text).not.toContain("ตั้งแต่");
    expect(text).not.toContain("/");
  });

  it("state 2b: only ONE of the two dates present is still not a range", () => {
    const text = dataRangeText(toErpDataRange(row({ DocCount: 2, FirstDate: "2026-08-14" }), "ใบสั่งผลิต"));
    expect(text).toBe("ข้อมูลในระบบ ERP มีใบสั่งผลิต 2 ใบ");
  });

  it("state 3: nothing known at all (no props) says so, and invents nothing", () => {
    expect(dataRangeText()).toBe(DATA_RANGE_UNKNOWN_TEXT);
    expect(dataRangeText(null)).toBe(DATA_RANGE_UNKNOWN_TEXT);
  });

  it("state 3: an EMPTY ERP table (zero rows, NULL dates) is 'not known', never '0 ใบ'", () => {
    expect(dataRangeText(toErpDataRange([], "ใบส่งสินค้า"))).toBe(DATA_RANGE_UNKNOWN_TEXT);
    expect(dataRangeText(toErpDataRange(row({ DocCount: 0 }), "ใบส่งสินค้า"))).toBe(
      DATA_RANGE_UNKNOWN_TEXT,
    );
  });

  it("formats a four-digit count with a thousands separator", () => {
    const text = dataRangeText(
      toErpDataRange(row({ DocCount: 1234, FirstDate: "2026-01-05", LastDate: "2026-09-23" }), "ใบส่งสินค้า"),
    );
    expect(text).toContain("ใบส่งสินค้า 1,234 ใบ");
  });
});

describe("toErpDataRange — a Date object from mssql normalises like an ISO string", () => {
  it("accepts JS Dates and keeps the calendar day (no TZ drift)", () => {
    const range = toErpDataRange(
      row({
        DocCount: 3,
        FirstDate: new Date("2026-08-14T00:00:00.000Z"),
        LastDate: new Date("2026-09-23T00:00:00.000Z"),
      }),
      "ใบสั่งซื้อ",
    );
    expect(range.from).toBe("2026-08-14");
    expect(range.to).toBe("2026-09-23");
    expect(dataRangeText(range)).toContain("ตั้งแต่ 14/8/69 ถึง 23/9/69");
  });
});

describe("<PilotBanner /> rendering", () => {
  it("keeps data-testid=pilot-banner and shows the neutral chip label", () => {
    const html = renderToStaticMarkup(
      <PilotBanner
        range={toErpDataRange(
          row({ DocCount: 14, FirstDate: "2026-08-03", LastDate: "2026-09-22" }),
          "ใบส่งสินค้า",
        )}
      />,
    );
    expect(html).toContain('data-testid="pilot-banner"');
    expect(html).toContain(PILOT_BANNER_TEXT);
    expect(PILOT_BANNER_TEXT).toBe("ช่วงข้อมูล");
    expect(html).toContain("ข้อมูลในระบบ ERP มีตั้งแต่ 3/8/69 ถึง 22/9/69 · ใบส่งสินค้า 14 ใบ");
  });

  it("renders sensibly with NO props at all (the *-unavailable.tsx screens)", () => {
    const html = renderToStaticMarkup(<PilotBanner />);
    expect(html).toContain('data-testid="pilot-banner"');
    expect(html).toContain(DATA_RANGE_UNKNOWN_TEXT);
  });

  it("never renders the retired alarming pilot sentence", () => {
    for (const element of [
      <PilotBanner key="a" />,
      <PilotBanner
        key="b"
        range={toErpDataRange(
          row({ DocCount: 14, FirstDate: "2026-08-03", LastDate: "2026-09-22" }),
          "ใบส่งสินค้า",
        )}
      />,
    ]) {
      expect(renderToStaticMarkup(element)).not.toContain(OLD_PILOT_SENTENCE);
    }
  });
});
