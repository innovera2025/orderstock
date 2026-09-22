// erp-dashboards Phase 5 — the TEST-ONLY ERP force-down switch (plan Step 0.3a/0.3b).
//
// WHY THIS EXISTS: AC15 requires proving all THREE dashboards degrade gracefully when the ERP is
// unreachable. Phase 2's own degraded-mode e2e self-skips (it only asserts the degrade UI if the
// sandbox HAPPENS to already be down), so nothing in P1-P4 can actually FORCE the condition.
//
// WHY NOT AN ENV VAR: `playwright.config.ts` reuses ONE `pnpm start` process for the whole suite
// and `getErpPool()` caches its pool as a `globalThis` singleton keyed to the `ERP_DATABASE_URL`
// in effect at first connect. Changing an env var mid-suite therefore either breaks every other
// spec or does nothing at all. The only workable shape is an in-process flag flipped over HTTP,
// which is what this module plus `src/app/api/test/erp-force-down/route.ts` provide.
//
// SAFETY: the flag defaults OFF, lives only in memory (never persisted), is flipped ONLY by a
// route that refuses to run when `NODE_ENV === "production"`, and is checked in exactly one place
// (`guardedQuery`). When set it throws BEFORE any connection is touched — it never mutates,
// reconfigures or tears down the real pool, so unsetting it restores normal service immediately.

/** Message the synthetic failure carries. Deliberately obvious in a log. */
export const ERP_FORCED_DOWN_MESSAGE =
  "[ERP test-only force-down] simulated ERP outage — ERP reads are disabled by the test toggle.";

/** Thrown by `guardedQuery` while the toggle is on. */
export class ErpForcedDownError extends Error {
  constructor() {
    super(ERP_FORCED_DOWN_MESSAGE);
    this.name = "ErpForcedDownError";
  }
}

// `globalThis`-backed so Next's dev fast-refresh (and the route/handler module graph split) see
// the same flag, exactly like `cache.ts`'s cache map.
const globalForForceDown = globalThis as unknown as { erpForcedDown?: boolean };

/** Is the simulated-outage toggle currently on? */
export function isErpForcedDown(): boolean {
  return globalForForceDown.erpForcedDown === true;
}

/** Flip the toggle. Only ever called by the NODE_ENV-gated test route, or by a unit test. */
export function setErpForcedDown(down: boolean): void {
  globalForForceDown.erpForcedDown = down === true;
}

/**
 * Is the toggle route allowed to exist at all?
 *
 * Enabled in development automatically. In a PRODUCTION BUILD it stays off unless
 * `ERP_TEST_FORCE_DOWN=1` is explicitly set in the environment — ONLY the exact string `"1"`.
 *
 * WHY THE OPT-IN EXISTS: the e2e suite runs against a real production build (`pnpm start` sets
 * `NODE_ENV=production`), so a NODE_ENV check alone would make AC15 untestable — exactly the
 * situation this mechanism was added to fix. The opt-in follows the same explicit, single-value
 * shape as `ERP_ALLOW_WRITE_CAPABLE_LOGIN`: absent, empty, `"0"` or `"true"` all keep it OFF.
 * A customer deployment never sets it, so the route 404s there for every verb.
 */
export function forceDownRouteEnabled(
  env: { NODE_ENV?: string; ERP_TEST_FORCE_DOWN?: string } = process.env,
): boolean {
  if (env.ERP_TEST_FORCE_DOWN === "1") return true;
  return env.NODE_ENV !== "production";
}
