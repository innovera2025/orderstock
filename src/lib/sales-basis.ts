// erp-dashboards Phase 2 — `resolveSalesBasis()`: which ERP table set backs "sales".
//
// This is the THIN DB-touching wrapper of the `locations.ts` / `locations-core.ts` split the plan
// asks Phase 2 to mirror. It does exactly one thing — read one `AppSetting` row — and hands the
// raw value to the PURE `resolveSalesBasisFromValue()` in `sales-basis-core.ts`, which is where
// the decision logic lives and where the unit gate points.
//
// DELIBERATELY NOT UNIT-TESTED WITH A LIVE CONNECTION (execute-agent instruction E6): this repo's
// own `app-settings.ts` — the pattern this file mirrors — has no unit test for its live-Prisma
// get/set calls either. A DB round-trip proof, if ever needed, belongs in an agent probe, not in a
// new live-connection unit test.
//
// SCOPE: Sales-only. This does NOT extend `APP_SETTING_KEYS` in `src/lib/app-settings.ts` and
// changes no existing setting's meaning — it is purely additive.

import { prisma } from "@/lib/db";
import {
  resolveSalesBasisFromValue,
  SALES_BASIS_SETTING_KEY,
  type SalesBasis,
} from "@/lib/sales-basis-core";

export * from "@/lib/sales-basis-core";

/**
 * Resolve the sales basis from its `AppSetting` row.
 *
 * The value is read from settings, so changing basis is a settings change rather than a redeploy.
 * As of the `sales-invoice-basis` plan (23-09-26) `"invoice"` is a REAL branch — it is the basis
 * the customer's ERP team names as the source of truth for sales, and the Sales dashboard's
 * primary headline figure now comes from it. `"so"` remains unimplemented (the SalesOrder module
 * is unused on this site) and narrows to `"do"`, as does any unrecognised value.
 *
 * A missing row, or any read failure, falls back to `"do"` — the dashboard must never fail to
 * render because a settings row is absent.
 */
export async function resolveSalesBasis(): Promise<SalesBasis> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SALES_BASIS_SETTING_KEY },
      select: { value: true },
    });
    return resolveSalesBasisFromValue(row?.value ?? null);
  } catch {
    return resolveSalesBasisFromValue(null);
  }
}
