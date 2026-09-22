import { describe, it, expect } from "vitest";

import {
  PO_STATUSES,
  PO_STATUS_UNVALIDATED_TEXT,
  derivePoStatus,
  poStatusLabel,
  poStatusTone,
  resolvePoStatusParam,
  type PoStatusFlags,
} from "../purchase-calc";

// erp-dashboards Phase 3 — AC6-status gate. Fully-Automated, ZERO DB precondition.
//
// `derivePoStatus()` is the ONLY place a PO status is decided. It is deliberately a pure TS
// function rather than a SQL `CASE` so the precedence order is testable in isolation and exists in
// exactly one place, and so every call site can pair it with the mandatory unvalidated caveat.

/** All flags off, `IsClosed` NULL — the shape of every open PO in the live ERP. */
const OPEN: PoStatusFlags = {
  isCancel: false,
  isClosed: null,
  isComplete: false,
  isRecPo: false,
  isApproved: false,
  isCheck: false,
};

describe("derivePoStatus — precedence order", () => {
  it("returns 'Pending' when no flag is set (IsClosed NULL = open)", () => {
    expect(derivePoStatus(OPEN)).toBe("Pending");
  });

  it("returns 'Approved' when approved but not checked", () => {
    expect(derivePoStatus({ ...OPEN, isApproved: true })).toBe("Approved");
  });

  it("returns 'Checked' only when approved AND checked", () => {
    expect(derivePoStatus({ ...OPEN, isApproved: true, isCheck: true })).toBe("Checked");
    // Checked without approved is NOT 'Checked' — the ERP's own flag pairing requires both.
    expect(derivePoStatus({ ...OPEN, isCheck: true })).toBe("Pending");
  });

  it("returns 'Received' when IsRecPo outranks approved/checked", () => {
    expect(
      derivePoStatus({ ...OPEN, isRecPo: true, isApproved: true, isCheck: true }),
    ).toBe("Received");
  });

  it("returns 'Completed' when IsComplete outranks received/approved/checked", () => {
    expect(
      derivePoStatus({
        ...OPEN,
        isComplete: true,
        isRecPo: true,
        isApproved: true,
        isCheck: true,
      }),
    ).toBe("Completed");
  });

  it("returns 'Closed' when IsClosed is 1, outranking every non-cancel flag", () => {
    expect(
      derivePoStatus({
        ...OPEN,
        isClosed: true,
        isComplete: true,
        isRecPo: true,
        isApproved: true,
        isCheck: true,
      }),
    ).toBe("Closed");
  });

  it("returns 'Cancelled' when isCancel is true regardless of every other flag being true", () => {
    // Cancelled short-circuits ALL — including IsClosed=1, the next-highest rule.
    expect(
      derivePoStatus({
        isCancel: true,
        isClosed: true,
        isComplete: true,
        isRecPo: true,
        isApproved: true,
        isCheck: true,
      }),
    ).toBe("Cancelled");
  });

  it("resolves every one of the 7 declared statuses from some real flag combination", () => {
    const produced = new Set([
      derivePoStatus(OPEN),
      derivePoStatus({ ...OPEN, isApproved: true }),
      derivePoStatus({ ...OPEN, isApproved: true, isCheck: true }),
      derivePoStatus({ ...OPEN, isRecPo: true }),
      derivePoStatus({ ...OPEN, isComplete: true }),
      derivePoStatus({ ...OPEN, isClosed: true }),
      derivePoStatus({ ...OPEN, isCancel: true }),
    ]);
    expect([...produced].sort()).toEqual(PO_STATUSES.map((s) => s.key).slice().sort());
  });
});

describe("derivePoStatus — IsClosed NULL semantics (ISNULL(IsClosed,0))", () => {
  it("does NOT short-circuit a null IsClosed to Closed — NULL means open, falls through", () => {
    // `IsClosed` is NULL on every open PO in the live ERP. A naive `if (flags.isClosed)` would be
    // correct here by accident, but `if (flags.isClosed !== false)` would not — this pins the
    // intended ISNULL(IsClosed,0) semantic so a future refactor cannot silently invert it.
    expect(derivePoStatus({ ...OPEN, isClosed: null })).toBe("Pending");
    expect(derivePoStatus({ ...OPEN, isClosed: null, isApproved: true })).toBe("Approved");
    expect(derivePoStatus({ ...OPEN, isClosed: null, isRecPo: true })).toBe("Received");
  });

  it("treats an explicit false IsClosed exactly like NULL", () => {
    expect(derivePoStatus({ ...OPEN, isClosed: false, isApproved: true })).toBe(
      derivePoStatus({ ...OPEN, isClosed: null, isApproved: true }),
    );
  });
});

describe("status presentation", () => {
  it("labels every status in Thai and never leaks the raw English key to the UI", () => {
    for (const status of PO_STATUSES) {
      expect(poStatusLabel(status.key)).toBe(status.label);
      expect(poStatusLabel(status.key)).not.toBe(status.key);
    }
  });

  it("falls back to the raw key for an unseen status rather than hiding it", () => {
    expect(poStatusLabel("SomethingNew")).toBe("SomethingNew");
    expect(poStatusTone("SomethingNew")).toBe("neutral");
  });

  it("keeps the unvalidated caveat as its own constant, separate from any status label", () => {
    // The caveat badge must be removable in a one-line diff if confidence ever improves, which
    // means it can never be concatenated into a status label.
    expect(PO_STATUS_UNVALIDATED_TEXT).toBe("ยังไม่ผ่านการยืนยัน");
    for (const status of PO_STATUSES) {
      expect(status.label).not.toContain(PO_STATUS_UNVALIDATED_TEXT);
    }
  });

  it("narrows a ?status= search param to a real status, or null for 'all'", () => {
    expect(resolvePoStatusParam("Approved")).toBe("Approved");
    expect(resolvePoStatusParam(["Cancelled"])).toBe("Cancelled");
    expect(resolvePoStatusParam("approved")).toBeNull(); // case-sensitive: keys are exact
    expect(resolvePoStatusParam("")).toBeNull();
    expect(resolvePoStatusParam(undefined)).toBeNull();
  });
});
