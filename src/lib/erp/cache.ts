// Short-TTL in-process cache with a LAST-KNOWN-GOOD degrade path (Phase 1, decision D4).
//
// WHY HAND-ROLLED: `next.config.ts` sets no `cacheComponents`/`dynamicIO` flag, so Next 16.2's
// `'use cache'` directive is unavailable without an opt-in config change this phase does not make.
// `unstable_cache` IS available but exposes no "give me the last successful value even though the
// fetcher just threw" read path — which is exactly what the degrade requirement needs. Using it
// would force a second parallel cache anyway, defeating the point.
//
// Backed by a module-level `Map` behind the same `globalThis` dev-hot-reload guard as
// `src/lib/db.ts`, so fast-refresh does not reset the cache on every edit.

import { isErpForcedDown } from "./force-down";

/** One cache slot: the last SUCCESSFULLY fetched value plus when it landed. */
interface CacheEntry {
  value: unknown;
  storedAt: number;
}

const globalForErpCache = globalThis as unknown as { erpCache?: Map<string, CacheEntry> };

const cache: Map<string, CacheEntry> = globalForErpCache.erpCache ?? new Map<string, CacheEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForErpCache.erpCache = cache;
}

/** Default TTL for ERP reads: 5 minutes, matching the approved proposal. */
export const ERP_CACHE_TTL_MS = 5 * 60_000;

/** What `getCached` returns: the value plus whether it is a stale last-known-good fallback. */
export interface CachedResult<T> {
  value: T;
  /** `true` when the live fetch failed and this is the last successful value. */
  stale: boolean;
}

/**
 * Read through the cache.
 *
 * - Fresh entry within `ttlMs` → returned immediately, `stale: false`.
 * - Otherwise the fetcher runs. On success the value is cached and returned with `stale: false`.
 * - On fetcher FAILURE: if any previous value exists (however old) it is returned with
 *   `stale: true` — the degrade path. If the cache is empty, the error re-throws.
 */
export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<CachedResult<T>> {
  const existing = cache.get(key);
  const now = Date.now();

  // erp-dashboards Phase 5 (test-only, additive): while the simulated-outage toggle is on, a FRESH
  // entry must not short-circuit the read. Otherwise the 5-minute TTL would serve a cached value,
  // the fetcher would never run, and the outage would be invisible — so AC15 would pass for the
  // wrong reason. Bypassing freshness here makes the next read go live, fail in `guardedQuery`,
  // and fall through to the degrade branch below: exactly the real-world "TTL lapsed during an
  // outage" case. Default OFF; in a production deployment the toggle can never be set.
  const forcedDown = isErpForcedDown();

  if (existing && !forcedDown && now - existing.storedAt < ttlMs) {
    return { value: existing.value as T, stale: false };
  }

  try {
    const value = await fetcher();
    cache.set(key, { value, storedAt: now });
    return { value, stale: false };
  } catch (error) {
    // Degrade path: serve the last known good value rather than an error page.
    if (existing) {
      return { value: existing.value as T, stale: true };
    }
    throw error;
  }
}

/** Test-only helper: reset the module-level cache between cases. */
export function clearErpCache(): void {
  cache.clear();
}
