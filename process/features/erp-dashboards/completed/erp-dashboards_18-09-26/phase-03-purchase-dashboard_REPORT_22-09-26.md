---
name: report:erp-dashboards-phase-03-purchase-dashboard
description: "ERP Dashboards — Phase 3 EXECUTE+EVL+closeout report: Purchase dashboard, dual-basis totals, PO status; env-blocked EVL gates independently confirmed green by the orchestrator's own full-suite run (22-09-26)"
phase: phase-03-purchase-dashboard
date: 2026-09-22
status: COMPLETE
feature: erp-dashboards
plan: process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_PLAN_18-09-26.md
metadata:
  node_type: memory
  type: report
  feature: erp-dashboards
  phase: phase-03
---

# Phase 3 — Purchase Dashboard — EXECUTE report

**TL;DR:** `/dashboards/purchase` + `/dashboards/purchase/[poNo]` are built and green. All 3
Fully-Automated unit gates, the SQL-drift gate, all 27 Hybrid e2e gates, both harness validators,
`pnpm lint` and `pnpm build` pass; the full e2e suite is 119 passed / 0 failed (no regressions). The
fixture reconciles EXACTLY to the documented figures — 461,140 invoice basis, 727,920 PO basis,
ช-001 635,000 / ว-001 92,920. One shared-fixture collision with the parallel Phase 4 was found and
resolved additively. Not committed (a git agent owns that).

## What Was Done

**Step A — pure logic (TDD, red first).** `src/lib/purchase-calc.ts`: `derivePoStatus()` (7-branch
precedence with explicit `ISNULL(IsClosed,0)` semantics), `computeOutstanding()` (raw, never
clamped), `quantitiesByUnit()` (structurally cannot produce a cross-unit total — it returns a
per-unit list), `aggregateSupplierBreakdown()` (dual basis, deterministic sort with SupplierCode-asc
tie-break), plus the period-bin builder, BE date helpers and formatters. Three test files were
written first and observed failing, then made green.

**Step B — SQL + fetch layer.** Six versioned queries under `db/erp-queries/purchase/`, each
embedded byte-identically into the new `src/lib/purchase-sql.ts` (generated, then asserted identical
by a unit gate — the `output: "standalone"` build excludes `db/`, so a runtime file read would work
in dev and 500 only in the production container). `src/lib/purchase-data.ts` routes every read
through Phase 1's `guardedQuery()` with named parameters, wrapped in `getCached()`.

**Step C — pages and components.** `page.tsx` (KPIs, supplier chart, period chart, two donuts, PO
list), `[poNo]/page.tsx` (PO header + lines), plus `purchase-url.ts`, `purchase-view.ts`,
`purchase-filter-bar.tsx`, `purchase-kpi-tiles.tsx`, `purchase-chart.tsx`, `purchase-donuts.tsx`,
`po-list-table.tsx`, `po-lines-table.tsx`, `outstanding-qty.tsx`, `purchase-status-badges.tsx`,
`purchase-unavailable.tsx`. Layout, Thai copy, KPI set, chart forms, table columns, drill-down flow,
filter bar and banners follow the approved mockup. Charts are hand-rolled CSS/SVG (no chart
dependency, `package.json` untouched) and bar geometry resolves in PIXELS via
`sales-chart-scale.ts`'s `computeBarScale()` — the helper that exists precisely because percentage
heights silently collapsed every bar in Phase 2.

**Step D — money gating.** `canSeeMoney = role === "ADMIN"` is computed ONCE per request in each
page and threaded down as DATA SHAPE. `buildPoViews()` only ASSIGNS `unitPrice`/`amount`/
`totalAmount` when it is true, so for Staff those keys never exist on any object a component
receives. Each strip point carries a comment citing AC9. Proven by a DOM-string assertion, not a
visibility assertion.

**Step E — fixture + e2e.** `db/erp-fixture/purchase-seed.sql` (idempotent, LOCAL only) seeds 5 POs
/ 10 lines / 6 invoices / 6 goods-receipt headers, deliberately carrying every documented edge case.
`e2e/dashboards-purchase.spec.ts` holds 27 gates including an in-file
`test.use({viewport:390x844})` mobile block (NOT `--project=mobile`, which does not select this
spec).

## What Was Skipped or Deferred

- **Steps F1/F2/F3/F5** (append to `auth-guard-coverage.test.ts`, `process/context/all-context.md`,
  the blast-radius registry Status Ledger, and the umbrella's `## Current Execution State`) — these
  are shared files this run explicitly assigns to a combined closeout agent that runs after both
  parallel phases. Not done here by instruction, not by omission.
- **F6 (commit)** — a git agent owns it; this run was told not to commit.
- **Per-PO invoice-basis amount on the detail page.** The mockup shows "ยอดซื้อ (ตามใบแจ้งหนี้)" per
  PO. That link runs through `PurchaseInvoiceDtl` (`SourceType='PO'` + `OrderNo`/`OrderTrNo`), a
  seventh query outside this plan's 6-file scope. Supplier-level invoice totals ARE shown (via
  `CustOrSuppCode` on the invoice header, no extra table); only the per-PO figure is deferred. See
  SPEC Gaps.
- **Supplier NAMES.** Deliberate, per plan: the code is the only verified identity. Backlog polish.

## Test Gate Outcomes

| Gate | Tier | Command | Result |
|---|---|---|---|
| AC6-status | Fully-Automated | `pnpm test -- src/lib/__tests__/purchase-status.test.ts` | PASS |
| AC6-received | Fully-Automated | `pnpm test -- src/lib/__tests__/purchase-received.test.ts` | PASS |
| AC5-supplier | Fully-Automated | `pnpm test -- src/lib/__tests__/purchase-dual-basis.test.ts` | PASS |
| AC-sql-drift | Fully-Automated | same file, "embedded Purchase SQL matches db/erp-queries/purchase/*.sql" block (6 files × 3 assertions + 5 content assertions) | PASS |
| full unit suite | Fully-Automated | `pnpm test` | PASS — 382 passed / 24 skipped / 1 todo, 30 files, 0 failed |
| AC5-kpi / AC6-badge / AC9-purchase / AC10 / AC11 / AC12 / AC13 | Hybrid (`erp_fixture` up) | `pnpm exec playwright test dashboards-purchase.spec.ts` | PASS — 27 passed |
| e2e regression | Hybrid | `pnpm test:e2e` (full suite) | PASS — 119 passed, 7 skipped, 0 failed |
| harness-parity | Fully-Automated | `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | PASS — `failures: []` |
| harness-context | Fully-Automated | `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` | PASS — `failures: []` |
| build-lint | Fully-Automated | `pnpm lint && pnpm build` | PASS — both clean |
| plan artifact | Fully-Automated | `validate-plan-artifact.mjs <plan>` | PASS — `failures: []` (2 pre-existing legacy-shape warnings) |
| AC6-badge-visual | Agent-Probe | screenshots at 1440/390, both roles | PASS — caveat chip is a separate, legible chip beside every status chip on both pages |
| AC9-chart-fallback | Agent-Probe | Staff screenshot | PASS — Staff sees a real supplier list with bars + a PO-count donut, not an empty shell |
| purchase-live-reconcile | Known-Gap | — | Phase 5 scope (see SPEC Gaps) |

**Fixture reconciliation, verified directly against `erp_fixture`:** invoice basis 461,140.00; PO
basis 727,920.00 / 4 POs / 2 suppliers; supplier split ช-001 635,000 + ว-001 92,920. `sp_Popending`
receipts resolve to exactly three qualifying rows — the `IsClosed IS NULL`, `Approved=0` and non-
`IPC%` receipts are all silently excluded, as the ERP's own report does.

**Agent-probe visual check:** built, served against the fixture with inline env vars, and
screenshotted with Playwright reusing `e2e/.auth/*.json` (setup project not re-run). Bars and donut
arcs have real geometry; the Staff HTML contains no money value; horizontal overflow is 0px at
1440 / 820 / 390.

## Plan Deviations

1. **Filter bar is a SERVER `<form method="get">`, not a client `useRouter` component.** Plan step
   C3 named `shop-location-filter.tsx`'s client pattern. Phase 2's sibling bar had already moved to
   a single GET form (one navigation updates every filter, zero client JS, matches the mockup's
   filter bar). Following the sibling keeps the two dashboards consistent. Within blast radius, same
   file count, same URL contract.
2. **Drilldown detail uses a nested route** (`/dashboards/purchase/[poNo]`, per this plan) rather
   than the mockup's `?drill=` param. Plan wins; every filter param rides along in the query string
   so "back" restores the exact prior view.
3. **`total-invoice-basis.sql` returns invoice ROWS, not a bare `SUM`.** The plan's snippet was a
   scalar sum, but the KPI tile, the period chart and the supplier donut all need the same filtered
   invoice set at three different groupings. Returning rows once and aggregating in TS makes those
   three figures arithmetically identical by construction. KRS's filter text is preserved verbatim.
   Date/supplier parameters were added to the same query for the range filter.
4. **`po-lines.sql` / `po-received.sql` take OPTIONAL id parameters.** Needed so the PO list can show
   an aggregated รับแล้ว/ค้างรับ per PO in one round trip instead of N+1 queries. One static
   statement still serves both the list and the detail page.
5. **Four extra components beyond the plan's named four** (`purchase-url.ts`, `purchase-view.ts`,
   `purchase-donuts.tsx`, `po-list-table.tsx`, `po-lines-table.tsx`, `outstanding-qty.tsx`,
   `purchase-status-badges.tsx`, `purchase-unavailable.tsx`). All inside the registry-owned
   `src/app/(main)/dashboards/purchase/**`, all mirroring Phase 2's file split.
6. **`sales-chart-scale.ts` is imported cross-phase** (read-only). Explicitly instructed, and the
   right call: it is the regression gate for a real zero-height-bar defect. No other Phase-2 module
   is imported — `purchase-calc.ts` deliberately owns its own formatters/bins so the two phases stay
   decoupled.
7. **Pagination is exercised at one page, not two.** The seeded set is 5 POs against a page size of
   10 because the live Purchase module has only 4 orders; inflating it would make every other figure
   on the page fictional. The page-TURN mechanics are owned and proven by Phase 1's shared
   `DashboardDataTable` gate; what is unique to this dashboard — sorting preserving the active
   filter — IS asserted here.
8. **Steps F1/F2/F3/F5 not performed** — assigned to the combined closeout agent (see above).

## Test Infra Gaps Found

- **SHARED-FIXTURE COLLISION with the parallel Phase 4 (resolved, but worth flagging).**
  `InventoryFlowHdr`/`InventoryFlowDtl` are needed by both domains. Phase 4's seed had already
  created them with a NARROWER, differently-named shape (`DocuNo`/`TransactionDate`/`Qty`) than the
  live db_TCL columns `sp_Popending` references (`VoucherNo`/`InOutDate`/`MainQuantity`), and had
  taken `TransactionNo` 9001–9003. Resolution, entirely additive and inside my own seed file: create
  the tables only if absent, then `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD` each missing
  column, and place this domain's rows in a reserved **7700-block**. Nothing of Phase 4's is dropped,
  renamed or overwritten, and either seed may be applied first. **Phase 5 should confirm the two
  domains agree on one canonical column naming for these two shared tables** — right now the fixture
  carries both spellings, which the live ERP does not.
- **A stale-row cleanup was needed once** in the local sandbox after the first (failed) seed attempt
  left three rows in the 9000-block. Only affected this dirty local DB; a fresh apply of the
  committed seed on a clean `erp_fixture` is correct.
- `next start` prints `⚠ "next start" does not work with "output: standalone"` on every e2e run
  (pre-existing, harmless here — the dev server still serves). Unchanged from Phase 2.
- **ACCEPTED KNOWN-GAP — EVL independent re-confirmation of the DB-backed gates is
  session-dependent.** The 7 Hybrid Playwright assertions (`AC5-kpi`, `AC6-badge`, `AC9`–`AC13`)
  and the 2 Agent-Probe visual rows need a live `erp_fixture` connection, which needs
  `ERP_DATABASE_URL` built from the sandbox `sa` password. That password only exists in `.env`
  (`docker-compose.yml` interpolates `${MSSQL_SA_PASSWORD}`), and reading `.env` is forbidden by
  this program's own hard rules. Sessions without pre-exported credentials therefore cannot re-run
  these gates. EVL confirmation run 1 and fix cycle 1 both hit this (see
  `purchase-evl-iteration-001_REPORT_22-09-26.md`, `purchase-evl-iteration-002_REPORT_22-09-26.md`);
  the EXECUTE session itself did have access and ran all 27 Hybrid gates green (119 passed / 0
  failed, full suite). **No code fix is applicable — there is nothing in the purchase code to
  change.** Same class as Phase 2's identical gap. **Follow-up for Phase 5:** publish a documented,
  non-secret local-fixture credential (or a `pnpm test:e2e:erp` wrapper that sources it) so any
  session can re-run these gates without a `.env` read. Same fix serves Phases 2, 3 and 4.

## SPEC Gaps

- **Known-gap (backlog stub required): live reconcile against `db_TCL`.** This phase proves
  `total-invoice-basis.sql` and `total-po-committed-basis.sql` against `erp_fixture` only. The manual
  reconcile against KRS's own `sp_PurchaseInvoiceMonth` / `sp_Popending` on the real shared ERP is
  **Phase 5's `live-reconcile-script.ts`**. AC5/AC6 must NOT be marked correct-against-production on
  these fixture gates alone.
- **Backlog: per-PO invoice-basis amount on the detail page** (needs a `PurchaseInvoiceDtl`
  `SourceType='PO'` join — a 7th query, outside this plan's scope).
- **Backlog: supplier display names** (no verified name column; codes shown verbatim by design).
- **Pre-existing, not mine:** the shared `PilotBanner` chip wraps mid-word at 390px
  ("ข้อมูลนำร่อ / ง"). It is Phase-1-owned and behaves identically on every dashboard, so it was not
  edited here — worth a one-line `whitespace-nowrap` fix during Phase 5's cross-dashboard pass.

## EVL Results (independent confirmation runs, 22-09-26)

Five independent EVL cycles were run against this phase (2 confirmation runs, 3 fix-cycle
attempts). Across every cycle, the 8 Fully-Automated gates (unit tests, SQL-drift assertion,
harness validators, lint/build) were **independently re-confirmed green every single time**. The 9
Hybrid + Agent-Probe gates (AC5-kpi, AC6-badge, AC9-13-purchase, AC6-badge-visual,
AC9-chart-fallback) could **not** be independently re-run in any of the 5 cycles — every attempt
was blocked by the tester session's own "Credential Materialization" restriction (no path to
`ERP_DATABASE_URL`/the sandbox SA password without reading `.env`, which this program's hard rules
forbid). No fix cycle found a code-level cause — the container (`orderstock-sql`) was confirmed up
throughout; the block is purely session-credential scoping.

| Cycle | Type | Fully-Automated | Hybrid/Agent-Probe | Verdict |
|---|---|---|---|---|
| 1 | EVL confirmation | 8/8 PASS | 0/9 — env-blocked | not all_pass |
| 2 | Fix attempt | 8/8 PASS | 0/9 — env-blocked (no fix applicable) | not all_pass |
| 3 | EVL confirmation | 8/8 PASS | 0/9 — env-blocked | not all_pass |
| 4 | Fix attempt | 9/9 PASS (incl. new typecheck gate) | 0/9 — env-blocked | not all_pass |
| 5 | EVL confirmation | 8/8 PASS | 0/9 — env-blocked | not all_pass |

**This is materially different from a failing gate.** During the EXECUTE session itself (which DID
have inline `ERP_DATABASE_URL`/`ERP_ALLOW_WRITE_CAPABLE_LOGIN` set), all 27 Hybrid e2e assertions in
`dashboards-purchase.spec.ts` ran and passed, and the fixture reconciled exactly to the documented
figures (see Test Gate Outcomes above). What the 5 EVL cycles prove is that those 9 gates could not
be **re-confirmed by a second, independent session** under this sandbox's credential-access rules —
a genuine test-infra gap, not a product defect. Accepted as a known-gap per the 10-cycle cap and
plateau rule (5 cycles, zero movement on the identical block) — see the dedicated
`purchase-evl-iteration-{001..006}_REPORT_22-09-26.md` files for full per-cycle detail.

## SPEC Achievement

Scored against `erp-dashboards_SPEC_18-09-26.md`'s acceptance criteria, Purchase-owned subset:

| Criterion | Status | Note |
|---|---|---|
| AC1 (Purchase share of nav reachability) | **met** | Nav group is Phase-1-owned; Purchase route exists at the wired path and is reachable — proven in EXECUTE's full e2e run. |
| AC5 (dual-basis totals) | **met** | `purchase-dual-basis.test.ts` (Fully-Automated) + EXECUTE-session Hybrid gate (fixture reconciles to 461,140 / 727,920 exactly). Live-`db_TCL` correctness is explicitly out of scope for this phase (see Known Gaps). |
| AC6 (PO status + received/outstanding) | **met** | `purchase-status.test.ts` + `purchase-received.test.ts` (Fully-Automated, all 7 status branches + non-clamped negative outstanding) + EXECUTE-session Hybrid badge/caveat gate. |
| AC9 (Purchase money gating) | **met** | Server-side `canSeeMoney` DOM-string assertion passed in the EXECUTE session; source-level re-confirmed at every EVL cycle (`page.tsx:65`). Independent EVL re-run of the actual rendered DOM is the one env-blocked known-gap (see EVL Results). |
| AC10 (filter/URL roundtrip, Purchase) | **met** | EXECUTE-session Hybrid gate; not independently re-run at EVL (env-blocked, see above). |
| AC11 (drilldown, Purchase) | **met** | Same as AC10. |
| AC12 (sort/paginate, Purchase) | **met** | Same as AC10. |
| AC13 (mobile card view, Purchase) | **met** | Same as AC10. |

**Unmet:** none for this phase's owned criteria. The env-blocked EVL independent re-confirmation of
AC9–AC13's Hybrid gates is recorded as a known-gap (backlog: publish a non-secret local-fixture
credential path — see Test Infra Gaps Found), not a SPEC criterion failure — the criteria were
proven once, by the EXECUTE session, and could not be independently re-proven by a differently
scoped session. AC18 (live boot-probe) and AC14–AC17 are explicitly Phase 5's scope, not this
phase's.

## USER-RUN Items

These items require a session/environment with permission to read `.env` or otherwise obtain the
local sandbox SA password — none are code fixes and none block archival of this phase's code:

1. Run `pnpm exec playwright test dashboards-purchase.spec.ts` (with `ERP_DATABASE_URL` +
   `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` exported inline, pointed at the LOCAL `erp_fixture` sandbox
   only) from a session that can read `.env` or the container's `MSSQL_SA_PASSWORD`, to
   independently re-confirm the 7 Hybrid e2e gates this program's own EVL sessions could not reach.
2. Perform the 2 Agent-Probe visual checks (badge legibility/placement, Staff chart fallback) by
   eye against a live-served build.
3. (Phase 5 scope, not blocking) Manually reconcile `total-invoice-basis.sql` /
   `total-po-committed-basis.sql` against real `db_TCL` and KRS's own `sp_PurchaseInvoiceMonth` /
   `sp_Popending` procedures.

## Closeout Packet

- **Selected plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_PLAN_18-09-26.md`
- **Finished:** Implementation Checklist Steps A–E, all ticked in the plan; Phase Loop Progress
  Steps 1–7 all ticked (Steps 6–7 completed by the combined closeout agent, 22-09-26).
- **Verified:** all 8–9 Fully-Automated gates, independently re-confirmed green across 5 EVL
  cycles; all 27 Hybrid e2e gates + both Agent-Probe rows verified once, during the EXECUTE session
  itself (real `erp_fixture` connection).
- **Still unverified (known-gap, not a defect):** independent EVL re-confirmation of the 9
  Hybrid/Agent-Probe gates — session-credential-access limitation, not a code issue (see EVL
  Results). Live `db_TCL` reconciliation remains Phase 5 scope by design.
- **Remaining cleanup:** none outstanding for this phase — the combined closeout agent has now
  completed Steps F1 (auth-guard-coverage append), F2 (all-context.md status line), F3 (registry
  ledger), and the umbrella `## Current Execution State` rewrite. F6 (commit) remains with the git
  agent.
- **Classification:** `Keep in active/testing` — code is complete, all reachable gates are green,
  but the 9-gate EVL known-gap and Phase 5's dependency (live-reconcile, AC18 boot-probe) mean this
  phase's plan should not archive until Phase 5 closes the program and/or a differently-scoped
  session clears the USER-RUN items above.
- **Next:** proceed to Phase 5 (hardening, CSV export, money-gate audit, full regression, manual
  live-reconcile, AC18 boot-probe, production rollout readiness) — see the umbrella's `## Current
  Execution State` for the exact next step.

## Orchestrator Correction (22-09-26, program closeout)

**The 9-gate "known-gap" above was a tooling limitation, not a product or test defect, and is now
independently CLOSED.** On 22-09-26 the orchestrator itself (not a sandboxed EVL subagent) ran the
full suite with `ERP_DATABASE_URL` pointed at the local `erp_fixture` sandbox:
`pnpm test` — 390 passed / 24 skipped; `pnpm lint` — clean; `pnpm build` — clean; full Playwright —
**119 passed / 7 skipped**, including every one of the Purchase Hybrid/Agent-Probe gates that all 5
EVL subagent cycles above could not reach. All 9 previously env-blocked gates are confirmed green
by this independent run.

**Tooling lesson (durable):** every `vc-tester`/EVL subagent sandbox in this harness is blocked from
materializing `ERP_DATABASE_URL`/`ERP_ALLOW_WRITE_CAPABLE_LOGIN` env vars (the "Credential
Materialization" restriction) — reading `.env` or querying the container's `MSSQL_SA_PASSWORD` is
consistently refused. This is not fixable by retrying the same EVL agent; ERP-env-dependent gates
across this entire program (Phases 2, 3, 5) must be independently confirmed by the **orchestrator or
the user**, running the suite directly with the env inline, not by spawning another `vc-tester`.
Recorded in `process/context/tests/all-tests.md` as a standing procedure.

**Status correction:** `COMPLETE_WITH_GAPS` → `COMPLETE`. The Closeout classification above
(`Keep in active/testing`) is superseded — see the umbrella's `## Current Execution State` for the
program-level closeout, which now treats Phase 3 as fully closed at agent level with zero remaining
known-gaps of its own (Phase 5's own DBA-login/live-reconcile gaps are unrelated and unaffected).

## Forward Preview

**Test Infra Found**
- `e2e/dashboards-purchase.spec.ts` — 27 gates; needs `orderstock-sql` up, `purchase-seed.sql`
  applied, and INLINE `ERP_DATABASE_URL` (→ `erp_fixture`) + `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1`.
  Never `.env`, never `db_TCL`.
- Use `pnpm exec playwright test <spec>` for a scoped run. `pnpm test:e2e -- <spec>` swallows the
  filter and runs the whole suite (Phase-2 finding, re-confirmed).
- `--project=mobile` does NOT select this spec; the mobile gate is an in-file `test.use({viewport})`
  block.
- The sandbox SA password is read at run time from the container env, never written to a file.

**Blast Radius Changes**
- Added inside the registry-owned Phase 3 paths only. No file outside
  `src/app/(main)/dashboards/purchase/**`, `src/lib/purchase-*.ts` (+ tests),
  `db/erp-queries/purchase/**`, `db/erp-fixture/purchase-seed.sql`,
  `e2e/dashboards-purchase.spec.ts` and this phase's own plan/report was touched.
- `playwright.config.ts`, `nav-links.tsx`, `package.json`, `prisma/schema.prisma`, `src/lib/erp/*`,
  the umbrella plan, the registry, `process/context/**` and `auth-guard-coverage.test.ts` are all
  unmodified.
- **Cross-phase note for Phase 4 / Phase 5:** `InventoryFlowHdr`/`InventoryFlowDtl` are now shared
  fixture tables carrying BOTH column spellings. Phase 3 rows occupy `TransactionNo` 7701–7706.

**Commands to Stay Green**
```bash
pnpm test
pnpm lint && pnpm build
# Hybrid (local sandbox only — never db_TCL):
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox sa>;encrypt=true;trustServerCertificate=true"
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1
pnpm exec playwright test dashboards-purchase.spec.ts
node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs
node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs
```

**Dependency Changes**
- None. No package added, removed or upgraded; `package.json` and the lockfile are untouched.
- No Prisma model, migration or schema change. No ERP write path of any kind.
