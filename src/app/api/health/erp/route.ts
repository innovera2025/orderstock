import { NextResponse } from "next/server";
import { getErpPool, erpReadOnlyLoginState } from "@/lib/erp/pool";
import { guardedQuery } from "@/lib/erp/erp-adapter";
import { getCached, ERP_CACHE_TTL_MS } from "@/lib/erp/cache";

// Route Handlers are static by default; this must hit the ERP on every request.
export const dynamic = "force-dynamic";

// ERP read-only connectivity health check (erp-dashboards Phase 1).
//
// PUBLIC BY DESIGN: like the existing `/api/health`, this route applies no auth guard. It is
// an operator/uptime probe and exposes no ERP business data — only a boolean, a latency number,
// and a fixed sanitized error string. See the note in
// `src/lib/__tests__/auth-guard-coverage.test.ts` and the ERP Read Layer section of
// `process/context/database/all-database.md`.
//
// READ-ONLY: the probe query goes through `guardedQuery`, the same single choke point every ERP
// read uses — there is no bypass path, not even for a health check.
//
// NEVER 500s: the degrade contract requires a served response over an error page, so a failure
// still returns HTTP 200 with `{ ok: false }`.

interface ProbeRow {
  ok: number;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const result = await getCached<ProbeRow[]>("erp-health", ERP_CACHE_TTL_MS, async () => {
      // Establishing the pool is what RUNS the layer-4 boot probe. It must be awaited BEFORE the
      // login state is read — otherwise a cold process would report a verdict that does not exist
      // yet. (This was the 2026-09-23 defect: the first request after a container start reported
      // a read-only login while the pool was in fact backed by a write-capable one.)
      const pool = await getErpPool();
      return guardedQuery<ProbeRow>(pool, "SELECT 1 AS ok");
    });

    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      // `true` when this is a last-known-good value served because the live read failed.
      stale: result.stale,
      rows: result.value.length,
      // Read AFTER the pool is established. `loginCheck: "write-capable"` means the recorded
      // `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` exception is active; `"not-probed"` means the probe has
      // not concluded (never assume read-only). The `warning` is credential-free by construction.
      ...erpReadOnlyLoginState(),
    });
  } catch (error) {
    // Log the real error server-side only — never returned to the client (it can contain host
    // and login details from the driver).
    console.error("[health/erp] ERP read-only connectivity check failed:", error);
    // Also read after the attempt: if the pool DID boot and only the query failed, the probe
    // verdict is real and worth surfacing; if it never booted it stays honestly "not-probed".
    return NextResponse.json({
      ok: false,
      error: "ERP connection failed",
      ...erpReadOnlyLoginState(),
    });
  }
}
