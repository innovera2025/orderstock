---
name: note:erp-dbalogin-and-live-reconcile
description: "erp-dashboards — the 2 permanent USER-RUN go-live blockers: DBA-provisioned scoped read-only ERP login, and the manual live db_TCL reconcile"
date: 22-09-26
metadata:
  node_type: memory
  type: note
  feature: erp-dashboards
  phase: post-program
---

# Backlog: DBA-provisioned scoped read-only login + manual live reconcile

**Priority:** HIGH — this is the single gate on production go-live for all 3 ERP dashboards.

**Status:** Not agent-actionable. Both items are explicit USER-RUN/ops steps by the program's own
Hard Safety Constraints (never run the DBA login script by an agent; never run the reconcile
script against `db_TCL` by an agent).

## What remains

1. **DBA runs `db/create-erp-readonly-login.sql`** on the live SQL Server (`db_TCL`) to create the
   scoped SELECT-only ERP login. Written at Phase 0 (18-09-26), never run.
2. **Repoint + verify.** After the login exists: update `ERP_DATABASE_URL` in the production host's
   `.env`, **remove** `ERP_ALLOW_WRITE_CAPABLE_LOGIN` entirely, restart, and confirm
   `/api/health/erp` reports `readOnlyLogin: true`. Procedure:
   `docs/deployment-guide-docker.md` §12.3.
3. **Run the manual live reconcile** once the scoped login exists:
   ```bash
   ERP_RECONCILE_CONFIRM=1 ERP_DATABASE_URL='<scoped-login-url>' \
     pnpm tsx scripts/erp-reconcile.ts --from <date> --to <date> \
     --expect-purchase-invoice <n> --expect-purchase-po <n>
   ```
   Read the `--expect-*` values off the ERP's own `sp_PurchaseInvoiceMonth`/`sp_Popending` reports.
   Never agent-run. The script has been verified against the local `erp_fixture` sandbox only
   (reproduces all known fixture truths exactly) — it has never touched `db_TCL`.
4. **AC18 live-mode boot-probe** re-confirms itself automatically once step 2 is done — no separate
   action needed beyond confirming the health-check output.

## Why this is a note, not a phase

Neither item is code work. The program (`erp-dashboards`, Phases 0-5) is agent-level COMPLETE —
these are pure ops/DBA-coordination steps outside any agent's action boundary.
