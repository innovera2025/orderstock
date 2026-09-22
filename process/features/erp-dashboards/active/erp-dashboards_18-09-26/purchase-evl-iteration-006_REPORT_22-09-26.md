---
name: report:purchase-evl-iteration-006
description: "EVL fix cycle 3 for Phase 3 purchase dashboard — no code fix applicable; same credential-access env block"
date: 22-09-26
metadata:
  node_type: memory
  type: report
  feature: erp-dashboards
  phase: phase-03-purchase-dashboard
---

# Purchase EVL — fix cycle 3 (iteration 006)

**Outcome: no code change applied. The 9 failing gates are environment-blocked, not defects.**

## What was requested
Fix the failing gates from the EVL confirmation run:
- AC5-kpi / AC6-badge / AC9-13-purchase (Hybrid, Playwright e2e)
- AC6-badge-visual / AC9-chart-fallback (Agent-Probe, manual visual scan)

## Why no fix was applied
Both groups fail for one shared reason, identical to cycles 1–5: running them requires an
`ERP_DATABASE_URL` against the local `erp_fixture` sandbox, and materializing that credential is
denied by the session's auto-mode classifier. The `orderstock-sql` container is up, but neither
`sqlcmd` nor `pnpm test:e2e` can authenticate without it. There is no product defect to repair —
the gate commands cannot be dispatched at all.

Clamping, mis-gating, or stubbing the data path to make these gates runnable would be a deviation
from the approved plan and would weaken the real behaviour, so none was attempted.

## Re-confirmation performed this cycle
| Check | Result |
|---|---|
| `purchase-dual-basis.test.ts` (41) | PASS |
| `purchase-received.test.ts` (12) | PASS |
| `purchase-status.test.ts` (14) | PASS |
| `npx tsc --noEmit` | PASS (exit 0) |

67/67 purchase unit tests green; typecheck clean. No regression from cycles 1–5.

## Audit findings (all previously green, unchanged)
guardedQuery-only single call site; zero Prisma/`$queryRaw` on ERP tables; `prisma/schema.prisma`
untouched; no cross-`MainUnits` quantity sums; money gated server-side to ADMIN
(`page.tsx:65 canSeeMoney = user.role === "ADMIN"`, JSX-conditional server omission); both purchase
bases asserted distinct; PO-status `IsClosed`-NULL fall-through asserted; negative outstanding
asserted non-clamped; scope confinement clean.

## Classification
`known-gap` — harness/env restriction (credential materialization), not `product-breakage`.
Carry to Phase 5 hardening: run the 9 Hybrid/Agent-Probe purchase gates in a session that can
supply `ERP_DATABASE_URL` for the local `erp_fixture` sandbox.
