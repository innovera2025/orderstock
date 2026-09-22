// Degrade-state helper (Phase 1, decision D5).
//
// When an ERP read falls back to a stale last-known-good value (see `cache.ts`), the page must
// still render — never a blank or error page — with a visible notice that the data may be out of
// date. This pure helper maps the cache's `stale` flag onto the banner decision, so every
// dashboard page (Phase 2/3/4) derives the banner identically instead of re-inventing the rule.

/** Exact Thai banner copy shown when ERP data is a stale fallback. */
export const ERP_DEGRADE_BANNER_TEXT = "ข้อมูลอาจไม่ล่าสุด";

export interface ErpDegradeState {
  showBanner: boolean;
  bannerText: string;
}

/**
 * Map a cache result's staleness onto the degrade-banner state.
 *
 * @param result anything carrying the cache's `stale` flag (e.g. a `CachedResult`)
 */
export function erpDegradeState(result: { stale: boolean }): ErpDegradeState {
  return {
    showBanner: result.stale === true,
    bannerText: ERP_DEGRADE_BANNER_TEXT,
  };
}
