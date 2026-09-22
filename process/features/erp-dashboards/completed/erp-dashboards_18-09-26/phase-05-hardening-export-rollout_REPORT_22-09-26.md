---
phase: phase-05-hardening-export-rollout
date: 2026-09-22
status: COMPLETE
feature: erp-dashboards
plan: process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_PLAN_18-09-26.md
---

## EVL Confirmation Run (orchestrator, 22-09-26)

Independent re-run of the Exit Gate commands (vc-tester spawn), NOT trusting the EXECUTE session's
own report:

| Gate | Result |
|---|---|
| `pnpm test` (ERP fixture wired) | ✅ 523 passed, 0 failed, 1 todo, 32 files |
| `pnpm test` (no ERP env) | ✅ 490 passed / 33 self-skipped hybrid gates |
| `pnpm test:e2e` (full, all 4 projects) | ✅ 145 passed / 7 skipped vs 119/7 baseline — exactly +26, zero regressions |
| `pnpm lint` | ✅ exit 0 |
| `pnpm build` | ✅ exit 0, both new routes present |
| `npx tsc --noEmit` | ✅ clean |
| Source-level contract audit (money gate, read-only guard, seed idempotency, no ERP model in schema) | ✅ all claims independently confirmed against source |

**Verdict: `all_pass: true`.** No fix cycle was required.

**Known gaps surfaced by EVL (documentation/registry only, no code fix applicable):**
1. Missing required env var in the plan/report's documented exit-gate command: the e2e run only
   passes with `ERP_TEST_FORCE_DOWN=1` also set (in addition to `ERP_DATABASE_URL` +
   `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1`) — undocumented in the original Exit Gate block. **Fixed in this
   UPDATE PROCESS pass**: added to `tests/all-tests.md`'s ERP-gate run instructions below.
2. RCR-1/RCR-2 (Phase-1-owned file edits in `erp-adapter.ts`/`cache.ts`) were flagged "for
   orchestrator review" and not yet shown as explicitly approved. **Resolved in this UPDATE PROCESS
   pass**: approved below (both are additive, can only make `guardedQuery` throw earlier, cannot
   skip/relax the read-only guard, and Step 0.3a of this plan explicitly anticipated and required
   raising exactly this kind of edit).
3. `vitest.config.ts` (`@` alias) and `docs/deployment-guide-docker.md` (§12) were touched but not
   listed in the Registry Change Requests table. **Resolved**: both are additive, in-scope for this
   phase's own deliverables (the C1a gate and the rollout doc are this phase's own work items), and
   require no registry exception — only RCR-1/2/3 (edits to files a DIFFERENT phase owns) needed
   registry sign-off; these two are Phase-5-owned files.

**Orchestrator disposition on RCR-1/RCR-2/RCR-3:** APPROVED. All three are reversible, additive,
cannot weaken the read-only guard (RCR-1/2) or are the plan's own explicit deliverable (RCR-3), and
fall within this phase's stated intent per Step 0.3a. No plan-lifecycle escalation needed.

**Closeout classification correction:** the EXECUTE session's own closeout packet (below) says `Keep
in active/testing` pending the rollout-readiness REF's §1-2 items. Those items (DBA-provisioned
login, live db_TCL reconcile) are USER-RUN/ops actions that can never be closed by any agent — they
are not phase-5 code work. Per the Program Goal Charter's own definition of done (agent-level
verification, not live-production sign-off), **Phase 5 is ✅ VERIFIED at agent level** with those two
items recorded as permanent, charter-sanctioned known-gaps — see the umbrella's `## Current
Execution State` for the program-level closeout.

# Phase 05 — Hardening, Export & Rollout — EXECUTE report

## TL;DR

All 40 Implementation Checklist items are done. CSV export ships on all six dashboard tables with
the STAFF money gate proven at three independent levels; the cross-dashboard money audit, the first
real ERP force-down mechanism, and the fixture-seed order-independence fix all landed with gates
that were confirmed to fail before the fix. Full regression is green with **zero** regressions:
Vitest 523 passed / 0 failed (ERP wired), Playwright **145 passed / 7 skipped vs the 119 / 7
baseline — exactly the 26 new tests, nothing regressed**; lint and build exit 0.

Two known gaps remain, both pre-existing and SPEC-sanctioned, neither closable by an agent: the
live boot-probe and the live reconcile both wait on the DBA-provisioned read-only ERP login.

**Step B4's registry question turned out to be moot** — the export wiring needed zero edits to any
Phase 2/3/4 file. Three other out-of-radius touches were required and are recorded as Registry
Change Requests below.

---

## What Was Done

### Step 0 — interface re-confirmation

Re-confirmed against live source at EXECUTE start; every name the plan recorded at PLAN-SUPPLEMENT
matched (`fetchDoHeaders`/`fetchDoLines`, `fetchPoList`/`fetchPoLines`/`fetchPoReceived` +
`buildPoViews`, `getProductionMoList`/`getMaterialIssuesForMo`; `guardedQuery`/`assertReadOnlySql`
in `erp-adapter.ts`; `getCached` in `cache.ts`; `DashboardDataTable`'s prop shape). No deltas.

Two findings worth recording:

- **Phase 2 and 3 left partial CSV groundwork.** `DO_LIST_CSV_COLUMNS`, `DO_LINES_CSV_COLUMNS` and
  `PO_LIST_CSV_COLUMNS` already existed as exported constants pairing each column key with its Thai
  CSV label and a raw accessor. The export route imports all three rather than re-typing headers.
  Purchase PO lines and both Production tables had none, so those column sets are defined in the
  Phase-5-owned dataset module.
- **Step D0 needed no new spec code.** Phase 3 and Phase 4 each already assert the unauth redirect
  for their own route (`dashboards-purchase.spec.ts:77`, `dashboards-production.spec.ts:65`). Phase
  5 re-confirms the pair as a set in its own spec — cheap, and it fails loudly if either is removed.

### Step A0 — fixture seed order-dependence (residual (a))

`production-seed.sql` gained the symmetric `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD` guards
that `purchase-seed.sql` already had. The shared `InventoryFlowHdr`/`InventoryFlowDtl` tables now
converge on the live table's full column **union** in either run order.

The plan's analysis was confirmed correct and the handoff's "converge on the live db_TCL spelling"
is satisfied by the union, not by picking a side: **both** column families are genuinely live and
genuinely used — `VoucherNo`/`InOutDate`/`MainQuantity`/`Approved` by
`db/erp-queries/purchase/po-received.sql` (copied from the ERP's own `sp_Popending`) and
`DocuNo`/`TransactionDate`/`Qty`/`MONo` by `db/erp-queries/production/material-issues.sql`.
Dropping either spelling would break a shipped query.

New gate `src/lib/__tests__/erp-fixture-seed-idempotency.test.ts` applies both seeds to throwaway
databases in both orders, twice each, and asserts the resulting column union and both domains' rows.

### Step A — CSV export

**Decision (A1): ONE shared route** — `src/app/api/dashboards/export/route.ts` with
`?dashboard=&table=&key=`, delegating to `export-datasets.ts`. Rationale: `requireAuth()`, the money
gate, the row cap, the BOM and the `Content-Disposition` convention each exist in exactly one place.
Three routes would have meant three copies of each, and a future money-gate fix applied to two.

- `src/lib/erp/csv-export.ts` — serializer only: UTF-8 BOM, CRLF, RFC 4180 quoting, leading-formula
  neutralisation, 5,000-row cap with a **visible Thai truncation notice row**, ASCII filename.
- `export-datasets.ts` — calls the **same** data function each dashboard page calls, with the same
  URL parser, the same sort accessors and (for Purchase) the same `buildPoViews` assembler. No
  second query path, so an export cannot disagree with the screen it came from, and every read
  passes `guardedQuery` by construction.
- STAFF money columns are **omitted entirely** — header and cell both absent, so a Staff CSV has
  strictly fewer columns than an Admin CSV. Nothing is blanked in place.
- Dates render through `ceToBeDisplay()`; quantity columns always ship with their own unit column.

### Step B — export trigger, with zero Phase 2/3/4 edits

`dashboard-data-table.tsx` gained one optional prop, `exportHref`. Left undefined it **derives** the
target from the `basePath` + `searchParams` it already receives, via the new pure
`src/lib/erp/dashboard-export-target.ts`. Passing `false` suppresses the button; a string overrides
the URL. Existing sort/paginate function bodies are untouched (B3 satisfied by reading, not
assumption) — the button renders in the existing footer row alongside the pager.

Consequence: **no call site changed**, so Step B4's pause-and-wait condition never triggered and the
registry's `page.tsx` exception was never exercised.

### Step C — cross-dashboard money audit

`src/lib/__tests__/dashboards-money-audit.test.ts`, one file covering all three dashboards (98
tests):

- **C1a (Hybrid, role-testable):** calls the real export handler with a STAFF auth context and an
  ADMIN one, over `erp_fixture`, and compares the produced bytes. Asserts the ADMIN file genuinely
  HAS a money column first — otherwise the STAFF assertion would prove nothing.
- **C1b/C2 (static source coverage):** sweeps every money-bearing source on all three dashboards for
  a `canSeeMoney` gate, asserts no CSS-hiding, asserts each entry page derives the flag from the
  server session, asserts the export route computes its own flag and can never read it off the query
  string, and asserts Production carries no money token at all.
- Pure blocks cover the serializer contract and the export-target derivation, including that a
  same-named search param cannot spoof the target.
- **Rendered-HTML half (added in `e2e/dashboards-export.spec.ts`):** asserts that a STAFF browser
  receives no money VALUE on any of the four dashboard screens or either drilldown, reading
  `page.content()` so a value rendered-then-CSS-hidden would still be caught — plus a positive
  control that ADMIN genuinely does see money values, so the STAFF assertion cannot pass vacuously.

### Step D — degraded mode, pilot banner, AC2

The first **real** ERP force-down mechanism in this codebase (Phase 2's own degraded-mode test
self-skips rather than forcing anything): an in-memory flag (`src/lib/erp/force-down.ts`) flipped by
a gated test-only route (`/api/test/erp-force-down`) and checked per call in `guardedQuery`.

`e2e/dashboards-degraded-mode.spec.ts` warms each dashboard's cache while healthy, forces the
outage, then reloads and asserts all three still render their last-cached content behind
"ข้อมูลอาจไม่ล่าสุด" — never an error page, never blank — plus recovery, the health probe's
behaviour, the pilot banner on every dashboard and drilldown for both roles, and the AC2
re-confirmation.

### Step E — read-only guard re-confirmation

Phase 1's `assertReadOnlySql` suite re-run unchanged and green. The E2 grep was additionally made a
**permanent automated gate**: the audit suite now runs the real `assertReadOnlySql` over every one
of the 13 shipped `db/erp-queries/**/*.sql` files and separately checks each against all 19
forbidden-keyword rules on the guard-normalised text. A raw grep was also run for the record — the
single hit is the word "drop" inside English prose in a comment.

### Step F — full regression

See Test Gate Outcomes.

### Step G — manual live reconcile (written, NOT run against db_TCL)

`src/lib/erp/live-reconcile-script.ts`, plus a thin `scripts/erp-reconcile.ts` entrypoint so both
the plan's path and the handoff's path work.

- Refuses to run without `ERP_RECONCILE_CONFIRM=1` **and** an explicit `ERP_DATABASE_URL`.
- **Never reads `.env`** — deliberately not `resolveErpDatabaseUrl()`, so nobody can run it against
  a database they did not name on the command line.
- Every statement goes through `guardedQuery`; `EXEC` is on the denylist, so it cannot invoke
  `sp_PurchaseInvoiceMonth`/`sp_Popending` itself — it reproduces their rule in SELECT form and
  prints a diff against numbers the operator reads off the ERP's own report via `--expect-*` flags.
- Prints a side-by-side table and exits. It writes nothing.

Both refusal gates were exercised, and the script was run **against the local `erp_fixture` only**.
It reproduced every known fixture truth exactly (14 DOs, 10,111 priced amount, 858,937.21 excluded
pool, 461,140 invoice basis, 727,920 PO committed, 11 MOs) — strong evidence the reconcile logic is
correct before a human points it at real data.

### Steps H, I — AC18 and rollout readiness

AC18 fixture-mode re-confirmed green as part of the regression. Live mode recorded honestly as a
known gap (below) — the scoped login still does not exist.

`erp-dashboards-rollout-readiness_REF_18-09-26.md` written: the hard gate, USER-RUN items, what is
done, known gaps, a compliance statement against every umbrella Hard Safety Constraint, and a
recommended go-live sequence. `docs/deployment-guide-docker.md` gained §12 (ERP dashboards) in the
guide's existing customer-facing Thai style, plus env-var, verify-checklist and troubleshooting
entries.

---

## What Was Skipped or Deferred

| Item | Why |
|---|---|
| Running `live-reconcile-script.ts` against real `db_TCL` | USER-RUN by charter; a hard stop for this agent. Script + instructions delivered. |
| Live-mode AC18 boot probe | The scoped read-only login does not exist yet (Phase 0 delivery script, DBA-run). Not simulated — a fabricated result would prove nothing. |
| `.env.example` ERP entries | The repo's privacy hook blocks agent access to `.env*`. Recorded as a user-run item. |
| `.xlsx` export, a 4th phone tab, chart/menu redesign, the white-on-green contrast fix | Explicitly out of scope per SPEC / plan residual (d). |
| Export for the Sales breakdown tables | Not `DashboardDataTable` instances; the plan scopes export to each dashboard's main + line/detail tables (the six shared-table call sites). |

---

## Test Gate Outcomes

Baseline for comparison: the orchestrator's recorded 22-09-26 run — Vitest 390 passed / 24 skipped
(no ERP env), Playwright 119 passed / 7 skipped.

| Gate | Command | Result |
|---|---|---|
| AC9 cross-dashboard money audit | `pnpm test -- dashboards-money-audit` | ✅ 98 passed |
| AC17 guard re-confirmation | `pnpm test -- erp-adapter` | ✅ green (part of full suite) |
| AC17 SQL sweep (Step E2) | in the audit suite + raw grep | ✅ 13/13 files pass the real guard; no write/DDL keyword |
| Fixture seed idempotency (residual a) | `pnpm test -- erp-fixture-seed-idempotency` | ✅ 6 passed; **confirmed RED before the fix** (3 failures in purchase-then-production order) |
| AC14 CSV export | `pnpm test:e2e -- dashboards-export` | ✅ 19 passed (18 + setup) |
| AC15/AC16/AC2 | `pnpm test:e2e -- dashboards-degraded-mode` | ✅ 9 passed (8 + setup) |
| Full Vitest (ERP wired) | `pnpm test` | ✅ **523 passed, 0 failed**, 32 files |
| Full Vitest (no ERP env) | `pnpm test` | ✅ 490 passed / 33 skipped — hybrid blocks self-skip as designed |
| Full Playwright, all 4 projects | `pnpm test:e2e` | ✅ **145 passed / 7 skipped** vs 119 / 7 baseline = **+26 = exactly the new tests; zero regressions** |
| Lint | `pnpm lint` | ✅ exit 0 |
| Build | `pnpm build` | ✅ exit 0 (both new routes present) |
| Typecheck | `npx tsc --noEmit` | ✅ clean |
| `mobile.spec.ts` 3-tab assertion | full e2e run | ✅ unchanged |
| Plan artifact validator | `validate-plan-artifact.mjs` | ✅ 0 failures (1 pre-existing warning) |
| Phase stub validator | `validate-phase-stub.mjs` | ✅ 0 failures, 0 warnings |
| Agent parity | `validate-agent-parity.mjs` | ✅ exit 0 |
| Context discovery | `validate-context-discovery.mjs` | ✅ exit 0 |
| Merge markers | `git diff --check` | ✅ clean |
| AC18 fixture-mode boot probe | part of full regression | ✅ green |
| AC18 **live** boot probe | — | ⚪ **known gap** — blocked on the DBA-provisioned login |
| Manual live reconcile | `pnpm tsx scripts/erp-reconcile.ts` | ⚪ **pending human action** — written, refusal gates exercised, fixture-verified; **never run against db_TCL** |

### Hand-verification of the export bytes (handoff requirement)

Generated real CSVs for all three dashboards in both roles against a running server and inspected
the bytes:

| File | First 3 bytes | Header | Money |
|---|---|---|---|
| admin sales | `ef bb bf` | `เลขที่ใบส่งสินค้า,วันที่,ลูกค้า,จำนวนรายการ,ยอดเงิน,สถานะการส่งมอบ` | 6 cols |
| staff sales | `ef bb bf` | same minus `ยอดเงิน` | **5 cols** |
| admin purchase | `ef bb bf` | `...,รับแล้ว/ค้างรับ,ยอดเงิน` | 6 cols |
| staff purchase | `ef bb bf` | same minus `ยอดเงิน` | **5 cols** |
| admin / staff production | `ef bb bf` | identical, 8 cols | none by design |

All six: CRLF on every line, Thai headers, BE dates (`22/9/69`, `11/9/69`, `8/9/69`),
`content-type: text/csv; charset=utf-8`,
`content-disposition: attachment; filename="sales-list-2026-09-22.csv"` (ASCII). A grep for
`ยอดเงิน|จำนวนเงิน|ราคา` across all three STAFF files: **clean**.

---

## Plan Deviations

All within this phase's intent; none changes behaviour with its flag off.

1. **`vitest.config.ts` — added a `@` -> `src` resolve alias.** Required by the plan's own C1a gate:
   it loads the export route directly, and that route (like the dashboard modules it reuses) imports
   via `@/`, which vitest did not resolve. Additive; no existing test used the alias.
2. **Force-down gate accepts an explicit production opt-in.** `NODE_ENV !== "production"` alone made
   AC15 untestable, because the e2e suite runs a real production build (`pnpm start`). The gate is
   now `NODE_ENV !== "production" || ERP_TEST_FORCE_DOWN === "1"` — the same explicit single-value
   shape as `ERP_ALLOW_WRITE_CAPABLE_LOGIN`. A customer deployment never sets it, so the route 404s
   there for every verb. Recorded in the rollout checklist as a "must not be set" item.
3. **Purchase PO-lines and Production exports add a `หน่วย` column** not present as its own column on
   screen (the screen fuses quantity and unit into one cell). A spreadsheet needs them split, and
   the program forbids summing across units. Every other header is the on-screen label verbatim.
4. **Production list export adds `รหัสสินค้า`** as its own column (on screen it is a sub-line under
   the product name). Same spreadsheet rationale.
5. **Reconcile script delivered at both paths.** Implementation at the plan's
   `src/lib/erp/live-reconcile-script.ts`; a thin `scripts/erp-reconcile.ts` re-exports it because
   the handoff and the deployment guide name that path.
6. **Step A0 kept the column union rather than "converging on one spelling."** Both spellings are
   live and both are used by shipped queries; dropping either breaks a query. This follows the
   plan's own A0.2 wording and satisfies the handoff's intent.

## Registry Change Requests

Recorded in full in the plan's `## Registry Change Requests RAISED DURING EXECUTE (22-09-26)`.
Summary — **Step B4 needed no change at all** (zero Phase 2/3/4 edits; the export URL is derived
inside the Phase-1 shared component from props it already has), plus three genuine out-of-radius
touches for orchestrator review:

| ID | File | Owner | Change | Safety |
|---|---|---|---|---|
| RCR-1 | `src/lib/erp/erp-adapter.ts` | Phase 1 | 4 lines + import: `guardedQuery` throws on the test-only flag before the guard and before the pool | Can only throw; cannot skip or relax any read-only layer. Pinned by two new assertions. |
| RCR-2 | `src/lib/erp/cache.ts` | Phase 1 | 1 condition + import: skip TTL freshness while forced down | Default OFF; unreachable in production |
| RCR-3 | `db/erp-fixture/production-seed.sql` | Phase 4 | Symmetric `COL_LENGTH` guards | Purely additive; this is the plan's own Step A0 |

A cross-bundle cache-expiry helper was tried for RCR-2 first and **rejected**: in a production build
each route bundle owns its own cache `Map`, so an external expiry call cannot reach the pages'
caches. Worth remembering for any future cross-route in-memory state.

## Bugs Routed to Other Phases

**None.** The cross-dashboard audit and the full regression found no bug in any Phase 2/3/4
dashboard's own logic. Every money site was already gated server-side; every pre-existing spec
stayed green.

## Test Infra Gaps Found

1. **No `@` alias in vitest** — fixed (deviation 1). Any future test touching `src/app/**` needed it.
2. **No ERP force-down mechanism existed** — built this phase; Phase 2's degraded-mode test
   self-skips and never forced the condition. `e2e/dashboards-degraded-mode.spec.ts` is now the
   reference pattern.
3. **Cache freshness masked outages in tests** — the 5-minute TTL meant a forced outage was
   invisible until the flag also bypassed freshness. Any future outage-shaped test must warm the
   cache first and account for the TTL, or it will pass for the wrong reason.
4. **`Response.text()` strips the BOM** (WHATWG spec) — asserting BOM presence via `.text()` silently
   passes even when the BOM is missing. Both the unit and e2e gates read raw bytes and decode with
   `ignoreBOM: true`. This was caught by a real failing assertion, not by review.
5. **`auth-guard-coverage.test.ts` had no route-handler pattern** — added
   (`extractExportedHandlers`), reusing the existing action-parser shape for HTTP verbs.
6. **"No money LABEL anywhere" is the wrong leak assertion.** A first version of the rendered-HTML
   check asserted the string `ยอดเงิน` was absent from STAFF markup, and failed — correctly. Sales
   deliberately renders a LOCKED tile labelled `ยอดเงิน` whose body reads
   `ยอดเงินแสดงเฉพาะผู้ดูแลระบบ`, and the DO-lines card carries the same disclosure. That is the
   feature working: STAFF is told the figure exists and is restricted; the number is not rendered.
   The assertion now matches how money is actually rendered (`formatMoney()` always emits
   `1,234.00 บาท`), which is the same leak-detector shape Phase 2/3 already use, and a third test
   pins the locked-tile behaviour explicitly so nobody "fixes" it later. **No product change was
   made — the test was wrong, not the code.**
7. **A visible-element assertion is not a navigation wait.** The export-href sort test read the
   pre-click href intermittently, because the old page's table is already visible when
   `toBeVisible()` resolves. Fixed with `waitForURL(/sort=doNo/)`. Worth copying for any future
   "click a sort link then read the DOM" assertion.

## Closeout Packet

- **Selected plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_PLAN_18-09-26.md`
- **Finished:** all 40 checklist items; CSV export on six tables; cross-dashboard money audit;
  degraded-mode/pilot-banner/AC2 e2e; AC17 re-confirmation plus a permanent SQL sweep; fixture-seed
  order-independence fix with a red-then-green gate; reconcile script; rollout readiness artifact;
  deployment guide §12.
- **Verified:** every Fully-Automated and Hybrid gate green against `erp_fixture`; full regression
  with zero regressions; export bytes hand-inspected for all six role/dashboard combinations;
  reconcile script fixture-verified against known truths.
- **Unverified:** live-mode AC18 boot probe and the live reconcile — both blocked on the DBA login.
  Spreadsheet-rendering fidelity is untestable headless.
- **Remaining cleanup:** orchestrator EVL confirmation run, then UPDATE PROCESS (archive, umbrella
  `## Current Execution State`, commit).
- **Classification:** `Keep in active/testing` — code-complete and green, but the phase's own
  completion rules require the rollout items in
  `erp-dashboards-rollout-readiness_REF_18-09-26.md` §1–2 before ✅ VERIFIED.
- **Next:** EVL (spawn `vc-tester`), then UPDATE PROCESS. No follow-up plan stub was created — the
  open items are ops actions, tracked in the rollout-readiness REF, not code work.

## Forward Preview

### Test Infra Found
`@` alias in vitest; the ERP force-down toggle (`/api/test/erp-force-down` + `ERP_TEST_FORCE_DOWN=1`)
as the reference pattern for outage-shaped tests; the route-handler coverage parser in
`auth-guard-coverage.test.ts`; the throwaway-database pattern for seed regressions.

### Blast Radius Changes
New: `src/app/api/dashboards/export/**`, `src/app/api/test/erp-force-down/`,
`src/lib/erp/{csv-export,dashboard-export-target,force-down,live-reconcile-script}.ts`,
`scripts/erp-reconcile.ts`, two e2e specs, two unit suites, the rollout-readiness REF.
Extended: `dashboard-data-table.tsx`, `auth-guard-coverage.test.ts`, `vitest.config.ts`,
`docs/deployment-guide-docker.md`, `process/context/all-context.md`.
Out-of-radius (RCR-1/2/3): `erp-adapter.ts`, `cache.ts`, `production-seed.sql`.

### Commands to Stay Green
```bash
# ERP-backed gates need the fixture wired (LOCAL SANDBOX ONLY, never db_TCL):
#   ERP_DATABASE_URL=sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox>;encrypt=true;trustServerCertificate=true
#   ERP_ALLOW_WRITE_CAPABLE_LOGIN=1
#   ERP_TEST_FORCE_DOWN=1          # e2e only — the AC15 specs 404 without it
pnpm test && pnpm lint && pnpm build && pnpm test:e2e
```

### Dependency Changes
**None.** `package.json` is untouched — the CSV path is hand-rolled, per the SPEC's no-new-library
note.

### CONTEXT_PARTIAL
None. `.env` / `.env.example` were deliberately never read (hard rule + privacy hook); the one
consequence is user-run item 2.6 in the rollout-readiness REF.
