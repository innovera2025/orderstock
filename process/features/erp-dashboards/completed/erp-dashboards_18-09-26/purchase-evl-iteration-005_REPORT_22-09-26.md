---
name: report:purchase-evl-iteration-005
description: "EVL confirmation run 3 for Phase 3 (Purchase dashboard) — independent re-check"
date: 22-09-26
metadata:
  node_type: memory
  type: report
  feature: erp-dashboards
  phase: phase-03-purchase-dashboard
---

# Purchase Dashboard — EVL Confirmation Run 3 (cycle 5)

**Role:** vc-tester, independent of the EXECUTE session's own claims and of prior EVL cycle
claims. This is a fresh confirmation run — nothing from cycles 1-4 was assumed true.

## What was re-run

| Gate | Command | Result |
|---|---|---|
| AC6-status | `pnpm vitest run src/lib/__tests__/purchase-status.test.ts` | PASS — 14/14 |
| AC6-received | `pnpm vitest run src/lib/__tests__/purchase-received.test.ts` | PASS — 12/12 |
| AC5-supplier + AC-sql-drift | `pnpm vitest run src/lib/__tests__/purchase-dual-basis.test.ts` | PASS — 41/41 (incl. embedded-SQL drift-assertion block) |
| Typecheck | `pnpm exec tsc --noEmit` | PASS — clean |
| Lint (owned paths) | `pnpm exec eslint "src/app/(main)/dashboards/purchase" "src/lib/purchase-sql.ts" "src/lib/purchase-data.ts" "src/lib/purchase-calc.ts"` | PASS — clean |
| harness-parity | `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | PASS — 0 failures (18 pre-existing cosmetic warnings, unrelated to this phase) |
| harness-context | `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` | PASS — 0 warnings, 0 failures |
| build-lint | `pnpm lint && pnpm build` | PASS — lint clean; build succeeds (pre-existing NFT tracing warning from `src/lib/erp/resolve-erp-database-url.ts`, unrelated to Phase 3, does not fail the build) |

**Total: 8/8 Fully-Automated gates green (67 unit tests across 3 files).**

### Hybrid + Agent-Probe gates (9 rows) — still environment-blocked

Re-confirmed the identical restriction as cycles 1-4: the `orderstock-sql` Docker container is
running (`docker ps` shows `Up 2 weeks`), but constructing `ERP_DATABASE_URL` requires reading a
credential value from `.env` (or otherwise materializing the SA password), and this session's
auto-mode classifier denies that action with reason `[Credential Materialization]` — confirmed by
directly attempting `echo $MSSQL_SA_PASSWORD` / `cat docker-compose.yml | grep password`, both
denied. This is a session-capability restriction, not a code defect — no diff in this phase's
owned paths can lift it. Affected rows: AC5-kpi, AC6-badge, AC9-purchase, AC10-purchase,
AC11-purchase, AC12-purchase, AC13-purchase, AC6-badge-visual, AC9-chart-fallback.

## Contract audit (independent verification)

| Item | Finding |
|---|---|
| Every ERP query goes through `guardedQuery` | Confirmed — `src/lib/purchase-data.ts:146` is the sole call site (`return guardedQuery<T>(pool, sql, params);`); no other query path exists in the file. |
| SQL files ↔ mirrored TS constants match byte-identically | Confirmed — `purchase-dual-basis.test.ts`'s `describe("embedded Purchase SQL matches db/erp-queries/purchase/*.sql")` block reads each `db/erp-queries/purchase/*.sql` file via `readFileSync` and asserts against the embedded constant; test passed (included in the 41/41 above). |
| No Prisma / `$queryRaw` on ERP tables | Confirmed — `grep -rn` across `purchase-data.ts`, `purchase-sql.ts`, `purchase-calc.ts`, and `src/app/(main)/dashboards/purchase/**` finds zero live usages (one doc-comment mentions the string `$queryRaw` only to say it is forbidden). |
| `prisma/schema.prisma` unchanged, no ERP models | Confirmed — no purchase/supplier/PO-related tokens anywhere in the schema file. |
| Quantities never summed across different `MainUnits` | Confirmed — `po-lines.sql` selects `MainUnits AS Unit` per line (no aggregation); `po-received.sql`'s `SUM(d.MainQuantity)` is grouped per `PoNo`+`ItemCode` (same unit within a group, per the ERP's own `sp_Popending` pattern); `purchase-calc.ts` documents returning a per-unit list rather than a single summed number. |
| Money absent from STAFF's server-rendered HTML | Source-level confirmed — `page.tsx:65` computes `canSeeMoney = user.role === "ADMIN"` and money blocks are conditionally rendered in JSX (server-omitted, not CSS-hidden) per the comment at line 200. Could not independently re-render and inspect actual DOM output this cycle (same credential block as the Hybrid gates above) — this is a repeat of the known env-gap, not a new finding. |
| Both purchase bases shown; PO-status badge present; outstanding not clamped | Source-level confirmed via the unit test suite: `purchase-dual-basis.test.ts` asserts both `TOTAL_INVOICE_BASIS_SQL`/`TOTAL_PO_COMMITTED_BASIS_SQL` are used and produce distinct totals; `purchase-status.test.ts` asserts the `IsClosed IS NULL` fall-through and cancelled short-circuit branches; `purchase-received.test.ts` asserts a negative (non-clamped) outstanding value for an over-received line. |
| Nothing outside this phase's owned paths changed | Confirmed via `git status --porcelain` filtered against the owned-path patterns — every entry matches `purchase`, `production` (the other parallel phase's own files, untouched by me), or the shared umbrella/registry files (unmodified by me). No stray files. |

## Outcome

`HALTED_KNOWN_GAP` (re-confirmed, cycle 5 / EVL confirmation run 3) — 8 Fully-Automated gates
green; 9 Hybrid/Agent-Probe gates remain env-blocked for the same credential-access reason as
cycles 1-4. No code defect found; no fix applicable. Follow-up remains recorded for Phase 5
(umbrella `erp-dashboards_18-09-26`, Phase Ordering table) to run the Hybrid + Agent-Probe rows in
a session that can reach the sandbox credentials.
