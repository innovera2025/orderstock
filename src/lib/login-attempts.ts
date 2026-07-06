// Basic login rate-limiting / lockout to close the PVL STRIDE brute-force finding (C4 / E11).
// Username-keyed in-memory counter with a sliding lockout window. Pure logic with an
// injectable clock so the BLOCK / RESET / EXPIRE behavior is deterministically unit-testable.
//
// Accepted known-gap (E11): username-keyed lockout lets an attacker deliberately lock a
// victim's account. Acceptable for a LAN-internal app; an IP+username or delay strategy is
// the hardening upgrade. In-memory state resets on server restart (single-process app).

export interface LoginAttemptOptions {
  /** Consecutive failures that trigger a block. */
  maxAttempts?: number;
  /** Lockout window in ms (also the counter's sliding-reset window). */
  lockoutMs?: number;
  /** Injected clock (defaults to Date.now); tests pass a mutable clock. */
  now?: () => number;
}

interface AttemptRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export class LoginAttemptTracker {
  private readonly records = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly lockoutMs: number;
  private readonly now: () => number;

  constructor(opts: LoginAttemptOptions = {}) {
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.lockoutMs = opts.lockoutMs ?? DEFAULT_LOCKOUT_MS;
    this.now = opts.now ?? Date.now;
  }

  /** True when further login attempts for this key must be blocked. */
  isBlocked(key: string): boolean {
    const rec = this.records.get(key);
    if (!rec || rec.lockedUntil === null) return false;
    if (this.now() >= rec.lockedUntil) {
      // Window expired — clear the record so the next attempt starts fresh.
      this.records.delete(key);
      return false;
    }
    return true;
  }

  /** Record a failed login. Sets the block once maxAttempts is reached. */
  recordFailure(key: string): void {
    const t = this.now();
    let rec = this.records.get(key);
    // Start a fresh window if none exists or the previous window has elapsed.
    if (!rec || t - rec.firstFailureAt > this.lockoutMs) {
      rec = { failures: 0, firstFailureAt: t, lockedUntil: null };
      this.records.set(key, rec);
    }
    rec.failures += 1;
    if (rec.failures >= this.maxAttempts) {
      rec.lockedUntil = t + this.lockoutMs;
    }
  }

  /** Clear all failure state for this key after a successful login. */
  recordSuccess(key: string): void {
    this.records.delete(key);
  }
}

// Module-level singleton wired into authorize() (single-process Next app).
export const loginAttempts = new LoginAttemptTracker();
