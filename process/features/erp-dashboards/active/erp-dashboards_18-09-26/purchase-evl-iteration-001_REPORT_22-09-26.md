---
name: report:purchase-evl-iteration-001
description: "EVL confirmation run 1 for Phase 3 (purchase dashboard) — fully-automated + static-audit gates pass; Hybrid/Agent-Probe gates env-blocked (no credential access)"
date: 22-09-26
metadata:
  node_type: memory
  type: report
  feature: erp-dashboards
  phase: phase-3
---

# Purchase Dashboard — EVL Confirmation Run 1

## Result: DONE_WITH_CONCERNS (env-blocked, not a code defect)

All Fully-Automated and static-audit gates independently re-run and PASS. The 9 Hybrid/Agent-Probe
gates (requiring the local `erp_fixture` container + `ERP_DATABASE_URL` +
`ERP_ALLOW_WRITE_CAPABLE_LOGIN=1`) could not be run in this session — this tester's sandbox blocks
reading `.env` / materializing `MSSQL_SA_PASSWORD` even via the documented `APPROVED:.env` retry
path (hard denial: "Credential Materialization", no bypass offered). This is an environment
restriction on this tester invocation, not a finding about the code.

## Gates run and PASS (8/8 independently re-run)

| gate | command | result |
|---|---|---|
| AC6-status | `pnpm test src/lib/__tests__/purchase-status.test.ts` | PASS (14 tests) |
| AC6-received | `pnpm test src/lib/__tests__/purchase-received.test.ts` | PASS (12 tests) |
| AC5-supplier + AC-sql-drift | `pnpm test src/lib/__tests__/purchase-dual-basis.test.ts` | PASS (41 tests, incl. byte-identical SQL-drift assertions) |
| harness-parity | `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | PASS (0 failures; pre-existing cross-tool cosmetic warnings only) |
| harness-context | `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` | PASS (0 failures) |
| build-lint (lint) | `pnpm lint` | PASS (clean) |
| build-lint (build) | `pnpm build` | PASS (compiles; only a pre-existing Turbopack NFT-trace warning on `erp/pool.ts`, not new) |

## Gates blocked (env — not run)

AC5-kpi, AC6-badge, AC9-purchase, AC10-purchase, AC11-purchase, AC12-purchase, AC13-purchase
(all `pnpm exec playwright test dashboards-purchase.spec.ts` assertions) and the 2 Agent-Probe rows
(AC6-badge-visual, AC9-chart-fallback) all require `erp_fixture` + `ERP_DATABASE_URL` +
`ERP_ALLOW_WRITE_CAPABLE_LOGIN=1`. Attempts to source `.env` (needed for `MSSQL_SA_PASSWORD`) were
denied by the sandbox's auto-mode classifier under "Credential Materialization", with no working
retry path found (the `APPROVED:.env` prefix documented in this repo's own gotchas section errored
both as a bare command and as a Bash-command prefix). `docker exec orderstock-sql sqlcmd` without
the password also failed (login failed, as expected without the real password).

## Contract Audit

- **guardedQuery choke point:** confirmed — `src/lib/purchase-data.ts` imports and calls
  `guardedQuery` exclusively; no `$queryRaw`, no `prisma.<erp-table>` calls found in any
  `dashboards/purchase/**` or `purchase-*.ts` file.
- **SQL/constants drift:** confirmed byte-identical — `purchase-dual-basis.test.ts`'s
  `AC-sql-drift` block reads all 6 `db/erp-queries/purchase/*.sql` files and diffs them against the
  embedded constants in `src/lib/purchase-sql.ts`; test passes.
- **prisma/schema.prisma unchanged:** confirmed — `git diff --stat prisma/schema.prisma` empty.
- **Quantities never summed across units:** confirmed — `po-lines.sql`/`purchase-sql.ts` select
  `MainUnits AS Unit` per line and the source comment states units are never summed across
  different `MainUnits`; `computeOutstanding` operates per-line, not aggregated across units.
- **Money gated server-side, STAFF gets zero money markup:** confirmed by reading
  `page.tsx`/`purchase-kpi-tiles.tsx` — `canSeeMoney = user.role === "ADMIN"` computed once
  server-side; when false, the KPI tile renders a locked-message `<Tile>` with NO amount markup at
  all (not CSS-hidden), and the supplier chart branches to a money-free `SupplierCountList`, and the
  period chart (money-only) is omitted entirely (`canSeeMoney &&`) rather than rendered-then-hidden.
- **Both purchase bases shown; PO-status badge present; outstanding not clamped:** confirmed by
  reading `purchase-kpi-tiles.tsx` (two equal-weight tiles, `kpi-invoice-basis-amount` /
  `kpi-po-basis-amount`) and `purchase-calc.ts` (`derivePoStatus` implements
  `ISNULL(IsClosed,0)=1` NULL-falls-through-to-open semantics per the ERP's own rule;
  `computeOutstanding` has no `Math.max(0, ...)` clamp — a negative outstanding is returned as-is).
- **Blast-radius isolation:** confirmed via `git status --porcelain` — every changed/untracked path
  is inside Phase 3's (purchase) or Phase 4's (production, the parallel phase) owned paths per the
  registry; `phase-blast-radius-registry.md`, `process/context/**`, `auth-guard-coverage.test.ts`,
  `playwright.config.ts`, and `src/app/nav-links.tsx` are all untouched.

## Bookkeeping

`evl-results-purchase.tsv` created this cycle (did not exist before this run) with header + baseline
row (17 gates, all unverified) + this cycle's row (8/8 run gates PASS; 9 hybrid/agent-probe gates
env-blocked, not failed).

## Unresolved Questions

1. This tester sandbox cannot materialize `MSSQL_SA_PASSWORD`/`ERP_DATABASE_URL` under any retry
   path tried. A session with credential access (or a documented non-secret local sandbox password)
   is needed to actually run the 7 Hybrid Playwright assertions and the 2 Agent-Probe visual scans.
2. Recommend the orchestrator or a session with `.env` access re-run:
   `export ERP_DATABASE_URL=... ; export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1 ; pnpm exec playwright
   test dashboards-purchase.spec.ts` before treating Phase 3 as fully EVL-confirmed.

**Status:** DONE_WITH_CONCERNS
**Summary:** All fully-automated tests, harness validators, lint, and build pass; static contract
audit finds no violations. The 9 Hybrid/Agent-Probe gates could not be run due to a sandbox
credential-access denial in this session, not a code defect.
**Concerns/Blockers:** Environment cannot access `.env`/`MSSQL_SA_PASSWORD` to stand up
`ERP_DATABASE_URL` for the local `erp_fixture` container — Hybrid + Agent-Probe gates unconfirmed
this cycle.
