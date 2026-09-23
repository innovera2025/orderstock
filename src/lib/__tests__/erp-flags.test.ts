import { describe, it, expect } from "vitest";
import { erpFlag, erpFlagOrNull } from "../erp-flags";
import { derivePoStatus } from "../purchase-calc";
import { deriveMoStatus } from "../production-status";

// Regression lock for the SECOND defect of the 23-09-26 class: code written against an imagined
// column TYPE rather than the live one.
//
// Every flag column in this ERP (`IsCancel`, `IsClosed`, `IsApproved`, `IsCheck`, `IsComplete`,
// `IsRecPo`, `Approved`) is TINYINT on the live server — never BIT. The `mssql` driver returns a
// NUMBER for TINYINT, so the old `header.IsRecPo === true` comparison in the purchase dashboard was
// unconditionally false against real data: no PO could ever derive Received, Closed, Completed,
// Checked or Cancelled. It looked fine locally only because the hand-built fixture declared those
// columns BIT, which made the driver hand back real booleans.
//
// These tests feed the NUMBERS the live driver actually produces. They fail if anyone reintroduces
// a strict boolean comparison on an ERP flag.

describe("erpFlag coerces the TINYINT values the live driver really returns", () => {
  it("treats numeric 1 as true and numeric 0 as false", () => {
    expect(erpFlag(1)).toBe(true);
    expect(erpFlag(0)).toBe(false);
  });

  it("still accepts real booleans (a BIT column, or a fixture that uses one)", () => {
    expect(erpFlag(true)).toBe(true);
    expect(erpFlag(false)).toBe(false);
  });

  it("applies ISNULL(flag, 0): NULL and undefined are false", () => {
    expect(erpFlag(null)).toBe(false);
    expect(erpFlag(undefined)).toBe(false);
  });

  it("matches the SQL `= 1` comparison rather than truthiness", () => {
    // A stray TINYINT 2 is not silently promoted, exactly as `WHERE flag = 1` would not match it.
    expect(erpFlag(2)).toBe(false);
  });

  it("erpFlagOrNull preserves NULL so ISNULL stays the caller's explicit decision", () => {
    expect(erpFlagOrNull(null)).toBeNull();
    expect(erpFlagOrNull(undefined)).toBeNull();
    expect(erpFlagOrNull(1)).toBe(true);
    expect(erpFlagOrNull(0)).toBe(false);
  });
});

describe("PO status derives correctly from TINYINT flags (the live wire shape)", () => {
  /** Build the flag set the way `purchase-view.ts` does, from raw driver values. */
  const fromRow = (row: {
    IsCancel?: number | null;
    IsClosed?: number | null;
    IsComplete?: number | null;
    IsRecPo?: number | null;
    IsApproved?: number | null;
    IsCheck?: number | null;
  }) =>
    derivePoStatus({
      isCancel: erpFlag(row.IsCancel),
      isClosed: erpFlagOrNull(row.IsClosed),
      isComplete: erpFlag(row.IsComplete),
      isRecPo: erpFlag(row.IsRecPo),
      isApproved: erpFlag(row.IsApproved),
      isCheck: erpFlag(row.IsCheck),
    });

  it("PO-L2608-0001 shape (approved+checked+received, IsClosed NULL) is Received", () => {
    expect(
      fromRow({ IsApproved: 1, IsCheck: 1, IsComplete: 0, IsCancel: 0, IsClosed: null, IsRecPo: 1 }),
    ).toBe("Received");
  });

  it("IsClosed = 1 as a NUMBER still reads as Closed", () => {
    expect(
      fromRow({ IsApproved: 1, IsCheck: 1, IsComplete: 0, IsCancel: 0, IsClosed: 1, IsRecPo: 0 }),
    ).toBe("Closed");
  });

  it("IsClosed NULL falls through instead of short-circuiting to Closed", () => {
    expect(
      fromRow({ IsApproved: 1, IsCheck: 0, IsComplete: 0, IsCancel: 0, IsClosed: null, IsRecPo: 0 }),
    ).toBe("Approved");
  });

  it("IsCancel = 1 as a NUMBER still reads as Cancelled", () => {
    expect(
      fromRow({ IsApproved: 1, IsCheck: 1, IsComplete: 0, IsCancel: 1, IsClosed: null, IsRecPo: 0 }),
    ).toBe("Cancelled");
  });

  it("an all-zero PO is Pending", () => {
    expect(
      fromRow({ IsApproved: 0, IsCheck: 0, IsComplete: 0, IsCancel: 0, IsClosed: null, IsRecPo: 0 }),
    ).toBe("Pending");
  });

  it("a strict `=== true` comparison would have broken every one of these", () => {
    // Documents the exact bug: the old expression evaluated false for every live row.
    const liveValue: number = 1;
    expect((liveValue as unknown) === true).toBe(false);
  });
});

describe("MO status derives correctly from TINYINT flags too", () => {
  it("numeric 1 flags drive cancelled/closed/approved", () => {
    expect(deriveMoStatus({ isCancel: 1, isClosed: 0, approved: 1 }).key).toBe("cancelled");
    expect(deriveMoStatus({ isCancel: 0, isClosed: 1, approved: 1 }).key).toBe("closed");
    expect(deriveMoStatus({ isCancel: 0, isClosed: 0, approved: 1 }).key).toBe("approved");
    expect(deriveMoStatus({ isCancel: 0, isClosed: 0, approved: 0 }).key).toBe("pending");
  });

  it("NULL flags behave as ISNULL(flag, 0)", () => {
    expect(deriveMoStatus({ isCancel: null, isClosed: null, approved: null }).key).toBe("pending");
  });
});
