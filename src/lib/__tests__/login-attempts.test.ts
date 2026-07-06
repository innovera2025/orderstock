import { describe, it, expect } from "vitest";
import { LoginAttemptTracker } from "../login-attempts";

// DoD#3-lockout (validate-contract): after N failed attempts the login is BLOCKED (not just
// a counter incremented); a successful login RESETS the counter; the window EXPIRES.
// A mutable injected clock makes window/expiry deterministic (E11).
function makeClock(start = 0) {
  const state = { t: start };
  return { now: () => state.t, advance: (ms: number) => (state.t += ms) };
}

describe("login lockout (DoD#3-lockout)", () => {
  it("does not block while under the failure threshold", () => {
    const clock = makeClock();
    const t = new LoginAttemptTracker({ maxAttempts: 5, lockoutMs: 60_000, now: clock.now });
    for (let i = 0; i < 4; i++) t.recordFailure("bob");
    expect(t.isBlocked("bob")).toBe(false);
  });

  it("BLOCKS further attempts after N consecutive failures", () => {
    const clock = makeClock();
    const t = new LoginAttemptTracker({ maxAttempts: 5, lockoutMs: 60_000, now: clock.now });
    for (let i = 0; i < 5; i++) t.recordFailure("bob");
    expect(t.isBlocked("bob")).toBe(true);
  });

  it("RESETS the counter on a successful login", () => {
    const clock = makeClock();
    const t = new LoginAttemptTracker({ maxAttempts: 5, lockoutMs: 60_000, now: clock.now });
    for (let i = 0; i < 5; i++) t.recordFailure("bob");
    expect(t.isBlocked("bob")).toBe(true);
    t.recordSuccess("bob");
    expect(t.isBlocked("bob")).toBe(false);
  });

  it("EXPIRES the block after the lockout window passes", () => {
    const clock = makeClock();
    const t = new LoginAttemptTracker({ maxAttempts: 5, lockoutMs: 60_000, now: clock.now });
    for (let i = 0; i < 5; i++) t.recordFailure("bob");
    expect(t.isBlocked("bob")).toBe(true);
    clock.advance(60_001);
    expect(t.isBlocked("bob")).toBe(false);
  });

  it("keys lockouts per-username (locking bob does not lock alice)", () => {
    const clock = makeClock();
    const t = new LoginAttemptTracker({ maxAttempts: 5, lockoutMs: 60_000, now: clock.now });
    for (let i = 0; i < 5; i++) t.recordFailure("bob");
    expect(t.isBlocked("bob")).toBe(true);
    expect(t.isBlocked("alice")).toBe(false);
  });
});
