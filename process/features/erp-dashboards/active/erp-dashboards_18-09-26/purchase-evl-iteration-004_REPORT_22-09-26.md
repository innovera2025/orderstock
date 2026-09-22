---
name: report:purchase-evl-iteration-004
description: "EVL fix cycle 2 for Phase 3 purchase dashboard — no code fix applicable; env-blocked gates re-confirmed as known gap"
date: 22-09-26
metadata:
  node_type: memory
  type: report
  feature: erp-dashboards
  phase: phase-03-purchase-dashboard
---

# Purchase EVL — fix cycle 2 (iteration 004)

## Verdict

**No code changes made.** The single reported failing gate group is environment-blocked, not a
code defect, so there is nothing inside this phase's owned paths to fix.

## Why no fix was applied

The failing rows (AC5-kpi / AC6-badge / AC9–13 / Agent-Probe) all require a live connection to the
local `erp_fixture` sandbox. Building `ERP_DATABASE_URL` requires reading `.env`, which this
session's auto-mode classifier denies (Credential Materialization). The container
`orderstock-sql` is up, but `sqlcmd` cannot authenticate with no password in the shell env.
This is the identical restriction already recorded in cycles 1–3 (`purchase-evl-iteration-001/002/003`).
A code edit cannot lift a credential-access restriction, so any change here would be
out-of-scope churn.

## Re-confirmation run (this cycle)

| Check | Command | Result |
|---|---|---|
| Purchase unit gates | `pnpm vitest run src/lib/__tests__/purchase-{dual-basis,received,status}.test.ts` | PASS — 67/67 across 3 files |
| SQL↔TS byte-identity drift | covered inside `purchase-dual-basis.test.ts` + `purchase-received.test.ts` | PASS |
| Typecheck | `pnpm exec tsc --noEmit` | PASS — clean |
| Lint (owned paths) | `pnpm exec eslint "src/app/(main)/dashboards/purchase" "src/lib/purchase-*.ts"` | PASS — clean |

## Audit findings

All 7 audit items in the cycle-2 request were re-read and remain satisfied; none required a change:
guarded-query-only ERP access, zero `$queryRaw`/`prisma.*` on ERP tables, untouched
`prisma/schema.prisma`, no cross-`MainUnits` quantity sums, server-side (JSX-omission) money gating
for STAFF, both purchase bases fetched separately, and a diff confined to this phase's owned paths.

## Outcome

`HALTED_KNOWN_GAP` — 8 Fully-Automated gates green; 9 Hybrid/Agent-Probe gates remain env-blocked.
Follow-up already recorded for Phase 5 (run the hybrid + Agent-Probe rows in a session that can
reach the sandbox credentials).
