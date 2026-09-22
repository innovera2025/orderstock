import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { clearErpCache } from "@/lib/erp/cache";
import { forceDownRouteEnabled, isErpForcedDown, setErpForcedDown } from "@/lib/erp/force-down";

// erp-dashboards Phase 5 — TEST-ONLY ERP simulated-outage toggle (plan Step 0.3b).
//
// OFF BY DEFAULT IN PRODUCTION. `forceDownRouteEnabled()` is true in development, and in a
// production build ONLY when `ERP_TEST_FORCE_DOWN=1` is explicitly set (the e2e suite runs against
// a real production build, so a bare NODE_ENV check would make AC15 untestable). Otherwise this
// handler answers 404 for every verb — a customer deployment never sets the flag, so the toggle
// is unreachable there even though the file ships in the bundle.
//
// AUTHENTICATED. It is a test affordance, not a public probe, so unlike `/api/health/erp` it
// calls `requireAuth()`. The e2e spec drives it with the same storage state it uses for the page,
// so the cookie rides along on `page.request.post(...)`.
//
// WRITES NOTHING ANYWHERE. It flips one in-memory boolean (and optionally clears the in-process
// ERP cache so a test can reach the cold-cache "unavailable" branch on purpose). No database —
// ERP or orderstock — is touched by this route.

export const dynamic = "force-dynamic";

function disabled() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

/**
 * `?down=1|0` flips the simulated outage.
 *
 * While the toggle is ON, `getCached` also bypasses TTL freshness, so a warmed cache still takes
 * the live-read path, fails, and falls back to last-known-good — the AC15 degrade path.
 *
 * `?clearCache=1` DISCARDS the cache instead, so a failing read has nothing to fall back on and
 * the page renders its explicit "ERP unavailable" screen. The two are not interchangeable.
 */
export async function POST(request: Request) {
  if (!forceDownRouteEnabled()) return disabled();
  await requireAuth();

  const url = new URL(request.url);
  const raw = url.searchParams.get("down");
  const down = raw === null ? true : raw === "1" || raw.toLowerCase() === "true";

  setErpForcedDown(down);
  if (url.searchParams.get("clearCache") === "1") clearErpCache();

  return NextResponse.json({ forcedDown: isErpForcedDown() });
}

/** Read the current toggle state — lets a spec assert its own precondition. */
export async function GET() {
  if (!forceDownRouteEnabled()) return disabled();
  await requireAuth();
  return NextResponse.json({ forcedDown: isErpForcedDown() });
}
