/**
 * erp-dashboards Phase 5 — convenience entrypoint for the manual live reconcile check.
 *
 * The implementation lives at `src/lib/erp/live-reconcile-script.ts` (the path named in the phase
 * plan and its validate contract). This file exists only so the script is also reachable from the
 * conventional `scripts/` location, which is where the deployment guide points operators.
 *
 * Both invocations are identical:
 *
 *   pnpm tsx scripts/erp-reconcile.ts                 --from 2026-08-01 --to 2026-09-30
 *   pnpm tsx src/lib/erp/live-reconcile-script.ts     --from 2026-08-01 --to 2026-09-30
 *
 * USER-RUN ONLY, against a LIVE ERP database, and only with `ERP_RECONCILE_CONFIRM=1` plus an
 * explicit `ERP_DATABASE_URL` in the same command. Read the header comment of the implementation
 * file before running it. It is read-only by construction and cannot write or call a procedure.
 */

import "../src/lib/erp/live-reconcile-script";
