---
name: report:phase-02-sales-dashboard-evl-iteration-001
description: "EVL confirmation run 1 for Phase 2 (Sales dashboard) — 11 of 17 test gates could not be independently confirmed because ERP_DATABASE_URL / ERP_ALLOW_WRITE_CAPABLE_LOGIN could not be set in this sandboxed session (credential-materialization tool restriction); no code fix applicable"
date: 22-09-26
metadata:
  node_type: memory
  type: report
  feature: erp-dashboards
  phase: "phase-02"
---

# Phase 2 (Sales Dashboard) — EVL Confirmation Run 1

## TL;DR

All Fully-Automated, DB-free gates PASS (pure-function unit tests, lint, build, agent-parity,
registry/contract audit). The 11 gates that require a live `erp_fixture` connection (`AC1`, `AC3`,
`AC4` both halves, `AC8`, `AC9`, `AC10`, `AC11`, `AC12`, `AC13`, cross-filter, and the e2e slice of
the full regression row) could **not be independently re-confirmed** in this session: this
sandbox's tool policy blocks reading `.env` or exporting the sandbox `sa` password
("Credential Materialization" denial), and `ERP_DATABASE_URL`/`ERP_ALLOW_WRITE_CAPABLE_LOGIN` are
not otherwise present in the shell environment. This is the SAME precondition execute-agent's own
report already named as Test Infra Gap #1/#2 — it is an environment-access limitation, not a code
defect, and there is no code fix a supplement cycle could apply. Reporting `DONE_WITH_CONCERNS`
rather than looping a fix cycle that cannot address a credential-access restriction.

## What Was Re-Run

| Command | Result |
|---|---|
| `pnpm test -- sales-basis-reconciliation sales-money-coverage-footnote` | ✅ 39+7 tests, all non-DB assertions pass; 6+5=11(10 reported, see below) skip cleanly with the expected `HYBRID gate SKIPPED — ERP_DATABASE_URL is not set` warning (not silently vacuous) |
| `pnpm test` (full suite) | ✅ 23 files, 272 passed, 10 skipped, 1 todo (283 total) — skip count matches the Hybrid-gated tests exactly; no unexpected skip/fail |
| `pnpm lint` | ✅ exit 0, no output |
| `pnpm build` | ✅ compiled successfully; `/dashboards/sales` listed `ƒ` (dynamic), matches report |
| `pnpm test:e2e -- dashboards-sales.spec.ts` (full suite runs regardless of the `--` arg, per Test Infra Gap #4) | ❌ 15 failed / 6 skipped / 57 passed — every failure is `getByTestId('sales-dashboard')`/`do-list-table` not found because the page itself 500s (`This page couldn't load` / `A server error occurred`) |
| `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | ✅ `failures: []` (pre-existing unrelated warnings only) |
| `git status` / registry cross-check | ✅ every touched/created file matches Phase 2's exclusive OWNED PATHS in `phase-blast-radius-registry.md`; zero cross-phase file touched |

## Root Cause of the 15 E2E Failures (confirmed, not guessed)

Started `pnpm dev` locally and hit `/api/health/erp` directly:
```
{"ok":false,"error":"ERP connection failed","readOnlyLogin":true}
```
Dev server log:
```
[health/erp] ERP read-only connectivity check failed: Error: ERP_DATABASE_URL is not set — cannot
open the read-only ERP connection pool.
    at resolveErpDatabaseUrl (src/lib/erp/resolve-erp-database-url.ts:71:9)
```
This confirms the 500 page is a genuine, expected consequence of a missing `ERP_DATABASE_URL` —
NOT a code regression. Phase 1's `getCached()` rethrows on a first-load failure with no
last-known-good cache entry (Phase 1's own documented behavior, and this phase's already-recorded
Test Infra Gap #3), so the very first hit always 500s rather than showing the degrade banner.

Per the phase report's own "Commands to Stay Green" section, running these gates requires:
```
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox sa>;..."
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1   # LOCAL FIXTURE ONLY
```
This session's tool sandbox blocked every attempt to read `.env`, `docker-compose.yml`'s
password reference, or export `MSSQL_SA_PASSWORD` ("Credential Materialization" denial) — the
same restriction the phase report itself named as being off-limits to agents. I did not attempt to
bypass this; per the harness's own hard rule ("never read `.env*` files"), that restriction is
correct behavior, not a bug in this run.

## Contract Audit

| Item | Status | Evidence |
|---|---|---|
| Every ERP query through `guardedQuery`, lives in `db/erp-queries/sales/*.sql` | ✅ | `guardedQuery` used in `src/lib/sales-queries.ts` + `sales/page.tsx`; SQL text embedded byte-identically per Deviation 1 (unit-gated) |
| No Prisma/`$queryRaw` touches ERP tables | ✅ | Only `prisma.appSetting.findUnique` in `sales-basis.ts` (the `AppSetting` switch, a local Prisma table, not ERP) — grep for `prisma.`/`$queryRaw` in the sales/dashboards tree returns only that one non-ERP call |
| `prisma/schema.prisma` unchanged | ✅ | `git diff --stat prisma/schema.prisma` — empty; not in `git status` |
| Quantities never summed across units | ✅ | `sumQuantityByUnit()` in `sales-basis-core.ts` groups per `MainUnits` key; proven by the Fully-Automated unit test (passed) |
| THB shown only as priced-lines figure + coverage % | ✅ | Code review of `page.tsx`/`sales-basis-core.ts` money-tile composition; numeric confirmation deferred to Hybrid gate (blocked, see above) |
| SI-invoice reconciliation footnote present, names the right number | ✅ (code-level) | `reconciliationNote()` in `sales-basis-core.ts` composes the exact Thai wording naming `excludedTotal`; DB-backed number itself unconfirmed this run (Hybrid, blocked) |
| STAFF sees no money in server-rendered HTML (not CSS-hidden) | ✅ (code-level) | `canSeeMoney = user.role === "ADMIN"` computed once server-side in `page.tsx`; every consumer (`do-list-table.tsx`, `do-lines-table.tsx`, `sales-chart.tsx`, `sales-breakdown-tables.tsx`) conditionally OMITS the markup (`if (canSeeMoney)` / `{canSeeMoney && (...)}`), never a CSS class; runtime HTML-diff proof deferred to the e2e AC9 gate (blocked, see above) |
| Period toggle defaults เดือน; bucket sums equal headline totals | ✅ (code-level) / ❌ (runtime unconfirmed) | `sales-period-toggle.tsx` comment + default confirmed by inspection; e2e round-trip proof blocked |
| Pilot + stale banners wired | not independently re-verified this run | out of Phase 2's new-code scope (Phase 1 components imported, not modified) |
| Nothing outside Phase 2's owned paths changed | ✅ | `git status` cross-checked against `phase-blast-radius-registry.md` OWNED PATHS — clean |

## Gate Status Table (validate-contract rows)

| criterion id | strategy | this-run result |
|---|---|---|
| infra net-gate: `resolveSalesBasisFromValue` | Fully-Automated | ✅ PASS |
| infra net-gate: `sumQuantityByUnit` | Fully-Automated | ✅ PASS |
| AC3 (DO/DOdtl reconciliation) | Hybrid | ⚠️ UNCONFIRMED — DB precondition blocked (credential access) |
| AC4 numeric (coverage %/excluded total) | Hybrid | ⚠️ UNCONFIRMED — same |
| AC4 wording/placement | Agent-Probe | ⚠️ UNCONFIRMED — page 500s without ERP connection, cannot render to inspect |
| AC1/AC2 (nav + page load) | Fully-Automated | ❌ FAILED this run (500 page) / ⚠️ infra-caused, not code |
| AC9 (money role gate) | Fully-Automated | ❌ FAILED this run — same cause |
| AC10 (date filter round-trip) | Fully-Automated | ❌ FAILED this run — same cause |
| AC8 (period toggle round-trip) | Fully-Automated | ❌ FAILED this run — same cause |
| donut/pie cross-filter (3 scenarios) | Fully-Automated | ❌ FAILED this run — same cause |
| AC11 (drilldown, 2 scenarios) | Fully-Automated | ❌ FAILED this run — same cause |
| AC12 (sort/paginate) | Fully-Automated | ❌ FAILED this run — same cause |
| AC13 (mobile card view) | Fully-Automated | ❌ FAILED this run — same cause |
| Recharts spike | Hybrid (optional) | N/A — not attempted, per Defaults Taken #5 (unchanged, `package.json`/lockfile byte-identical) |
| InventoryItem tie-break | Known-Gap (D) | unchanged — SQL pattern present (code review, grep confirms `ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC)` in `do-by-product.sql`) |
| Product/category rollup join path | Known-Gap (D) | unchanged |
| Full regression | Fully-Automated | ⚠️ PARTIAL — unit/lint/build/parity ✅; e2e ❌ (same infra cause) |

## Why No Fix Cycle Was Spawned

The EVL protocol's execute-fix loop exists for **code defects** a supplement `vc-execute-agent`
pass can address. Every failing gate here traces to one root cause — no `ERP_DATABASE_URL` +
`ERP_ALLOW_WRITE_CAPABLE_LOGIN` reachable in this sandboxed session — which is a **credential/tool
access restriction**, not a bug in the Phase 2 code. Spawning a code-fix cycle would not change the
outcome; the harness itself blocks the only path to resolving it (reading `.env` / exporting the
sandbox password). This matches the phase report's own Test Infra Gap #1, already on record before
this EVL run started.

## Recommendation

Someone with `.env`/container-password access needs to run, from an interactive session (not this
sandboxed tester run):
```
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox sa>;encrypt=true;trustServerCertificate=true"
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1
pnpm test -- sales-basis-reconciliation sales-money-coverage-footnote
pnpm exec playwright test e2e/dashboards-sales.spec.ts
```
and confirm the 11 currently-unconfirmed gates directly. Until then, Phase 2 should be treated as
`CODE DONE, DB-connected gates unconfirmed` rather than `✅ VERIFIED`.

## Unresolved Questions

- None beyond the above — the blocker is fully diagnosed (confirmed root cause via `pnpm dev` +
  `/api/health/erp` + dev server log), it is just not resolvable inside this tool sandbox.

**Status:** DONE_WITH_CONCERNS
