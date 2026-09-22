---
phase: phase-01-erp-read-foundation
date: 2026-09-22
status: COMPLETE
feature: erp-dashboards
plan: process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_PLAN_18-09-26.md
---

# Phase 1 — ERP Read Foundation — UPDATE PROCESS Closeout Report

**TL;DR** — Phase 1 is **✅ VERIFIED at agent level**. The independent EVL confirmation run
re-ran every validate-contract gate and all passed with no fix cycle (`gates_green: true`). The
read-only ERP pipe (`src/lib/erp/*`), the local `erp_fixture` sandbox DB, `/api/health/erp`, the
shared `dashboard-data-table.tsx`/`pilot-banner.tsx`/`degrade-banner.tsx` components, and the
3-link "แดชบอร์ด" nav group are all built and proven. db_TCL was never contacted. Nothing is
committed yet. One pre-declared known-gap remains (AC18 live-login boot probe, owned by Phase 5).
This report supersedes and REPLACES the EXECUTE-time report
(`phase-01-erp-read-foundation_REPORT_18-09-26.md`, status `COMPLETE_WITH_GAPS`) as the phase's
sole closeout record. That file has been deleted (UPDATE PROCESS, 22-09-26); its full per-step
EXECUTE detail (Steps A–F, the Read-Only Proof table, and the granular per-file test gate table)
is folded in verbatim below as an Appendix so nothing is lost.

---

## What Was Done

Per the EXECUTE report (18-09-26), summarized:

- **Guard + pool + resolver** (`src/lib/erp/{erp-adapter,pool,resolve-erp-database-url,cache,
  degrade}.ts`): the 5-layer read-only defense (normalizer → 19-rule denylist → parameterized-only
  `guardedQuery` choke point → `HAS_PERMS_BY_NAME` boot probe → `ApplicationIntent=ReadOnly`) plus a
  compile-time no-write-method type guard on `ErpAdapter`.
- **Fixture DB**: `db/erp-fixture/{00-schema,01-seed}.sql` — idempotent, LOCAL-SANDBOX-ONLY,
  `erp_fixture` database + `dbo.InventoryItem` (composite `(Roworder, ItemCode)` PK, 10 seeded rows).
- **Route + components**: `/api/health/erp` (never 500), `dashboard-data-table.tsx` (URL-driven
  sort/paginate, searchParam-preserving, mobile card list), `pilot-banner.tsx`, `degrade-banner.tsx`.
- **Nav**: `nav-links.tsx` "แดชบอร์ด" group, 3 links, ADMIN+STAFF, phone tab bar unchanged (3 tabs).
- **Tests**: 57 guard cases, 24 cache/degrade/parser cases, 12 resolver cases, 17 data-table cases,
  7 new e2e cases (chromium + mobile). Unit suite 100 → 212 tests / 16 → 20 files; e2e 49 → 56
  (excl. `[setup]`).
- **Docs**: `all-database.md` (ERP Read Layer section), `all-tests.md` (ERP fixture/guard testing
  section), `all-context.md` (feature status line) — all already appended by execute-agent; this
  UPDATE PROCESS session additionally refreshed the top-of-file "Last updated" line and the feature
  status line's verdict word (`🔨 CODE DONE` → `✅ VERIFIED at agent level`) to reflect this
  session's EVL result.
- **This session (UPDATE PROCESS)**: ran the independent EVL confirmation, wrote this closeout
  report, ticked Phase Loop Progress Steps 6–7, rewrote the umbrella's `## Current Execution
  State`, appended Phase 1's status to the blast-radius registry ledger, and ran the Tier-1 audits.

## What Was Skipped/Deferred

Unchanged from the EXECUTE report — no new deferrals surfaced during EVL:

- **AC18 live boot probe** against the real db_TCL scoped read-only login — the login does not
  exist yet (`db/create-erp-readonly-login.sql` is a DBA delivery step, written and not run).
  Deferred to Phase 5 per the SPEC's own declared Agent-Probe residual. → backlog note not needed;
  this is an already-declared SPEC residual, not a new gap this phase introduced.
- **Degrade-banner visual placement** — no dashboard page exists yet to render it on. Deferred to
  Phase 2/3/4 (already the plan's stated forward dependency).
- **Per-domain fixture tables** (Sales/Purchase/Production seed files) — owned by Phases 2/3/4 per
  the registry's Per-Domain Fixture Seed Split.
- **Charting library decision** — Phase 2's own INNOVATE-step spike.

No new follow-up plan stubs were created this session; every deferral is an already-declared,
already-owned item in the umbrella plan or SPEC.

## Test Gate Outcomes

EVL confirmation run (orchestrator-run, 22-09-26) independently re-ran the validate-contract gates:

| Gate | Command | Result |
|---|---|---|
| Unit (erp-adapter, resolve-erp-database-url, erp-cache-degrade, auth-guard-coverage, dashboard-data-table) | `pnpm test <5 files>` | ✅ 5 files passed, 120/120 |
| E2E nav visibility — chromium | `pnpm test:e2e --project=chromium e2e/dashboards-nav-visibility.spec.ts` | ✅ 4 passed, 3 skipped (mobile-only specs) |
| E2E nav visibility — mobile | `pnpm test:e2e --project=mobile e2e/dashboards-nav-visibility.spec.ts` | ✅ 4 passed, 3 skipped (desktop-only specs) |
| Lint | `pnpm lint` | ✅ clean, exit 0 |
| Build | `pnpm build` | ✅ exit 0; `mssql`/`tedious` correctly externalized |
| Full regression | `pnpm test` | ✅ 20 files passed, 212/212 |

Read-only audit re-confirmed independently during EVL (not re-derived from execute-agent's claim):
19-rule denylist present (grep + 57 passing cases); compile-time no-write-method guard present;
`verifyReadOnlyBoot` mocked refusal/acceptance both pass; `git diff --stat prisma/` empty (zero ERP
models added); no `$queryRaw`/`prisma.` usage in `src/lib/erp/*` or the health route beyond a
comment; `resolve-erp-database-url.ts` keyed strictly on `ERP_DATABASE_URL` (no fallback to
`DATABASE_URL`); no hostname/IP/credential literals in source (db_TCL only appears in comments and
in two fixture-test strings designed to be *rejected* by the guard); `git status` vs the plan's
declared Blast Radius shows zero files touched outside scope.

**Net EVL result: `gates_green: true`, no fix cycle required.** This independent re-run is what
promotes the phase from execute-agent's self-reported 🔨 CODE DONE to ✅ VERIFIED per the plan's
own Phase Completion Rules (EVL re-confirmation, not execute-agent's internal loop, is the bar).

## Plan Deviations

Unchanged from the EXECUTE report — all three remain within blast radius, none touches schema,
auth, API contract, billing, or container lifecycle, and none required a fix during EVL:

1. Relative imports (not `@/`) in the three new components — `vitest.config.ts` has no `@/` alias
   and is outside this phase's blast radius.
2. ERP pool built lazily on first read, not at module load — an eager pool would crash every page
   on a missing `ERP_DATABASE_URL`, defeating the degrade requirement.
3. `verifyReadOnlyBoot` also refuses on an inconclusive probe (no rows / probe error), not only on
   an explicit write grant — a stricter, fail-closed reading of "never silently downgrade."

## Test Infra Gaps Found

- **`password.test.ts` flake** (pre-existing, not introduced by this phase): bcrypt work-factor-12
  timing can exceed vitest's 5000ms default under parallel load. → backlog NOTE recommended: bump
  its `testTimeout`; file is outside this phase's blast radius.
- **No vitest `@/` alias** — forced Deviation 1 above. → backlog NOTE: add `resolve.alias` to
  `vitest.config.ts` so future shared components can use repo-standard imports and stay
  unit-testable.
- **No `pnpm db:seed:erp-fixture` script** — fixture apply is a documented manual `docker cp` +
  `sqlcmd` procedure. → backlog NOTE: a package script would be tidier; `package.json` is outside
  this phase's radius.
- **Narrow Playwright `testMatch` regexes are a silent-zero-test trap** — F1b fixed it for this
  spec; flagged so later phases adding phone-tier specs remember the same edit.

These four items are documented here as backlog candidates per the phase's own Test Infra
Improvement Notes; none block Phase 1's VERIFIED status (all are either pre-existing, out-of-radius,
or forward-looking guidance for later phases).

## SPEC Achievement

Scored against `erp-dashboards_SPEC_18-09-26.md`'s 18 acceptance criteria. Phase 1 is
infrastructure-only — it proves the *shared* half of several criteria; the *per-dashboard* half of
each is explicitly owned by Phases 2/3/4/5 per the umbrella's Scope Tiers and is **not** scored
unmet here (it is not yet in scope, not a Phase-1 miss).

| AC | Criterion (short) | Phase 1 scope | Status |
|---|---|---|---|
| AC1 | Nav group visible, 3-tab phone bar unchanged | Infra half (routes 404 until P2/3/4) | **met** — `dashboards-nav-visibility` e2e (chromium+mobile), both green |
| AC9 | Money hidden server-side | n/a in this phase — no money-bearing page exists yet | not applicable this phase (owned by P2–P5) |
| AC12 | Sort/paginate without losing filters | Shared-component contract | **met** — `dashboard-data-table.test.tsx`, 17/17 |
| AC13 | Mobile card view | Shared-component contract | **met** — same test + mobile e2e project |
| AC15 | Degrade banner on ERP-down | Mechanism (visual placement deferred) | **met** (mechanism) — `erp-cache-degrade.test.ts`, 24/24; visual placement is Phase 2/3/4's own e2e work, not a Phase 1 miss |
| AC16 | Pilot banner always visible | Component built | **met** (component proven to render; no page exists yet to attach it to — same deferred-placement reasoning as AC15) |
| AC17 | No write statement can ever reach the ERP | Fully proven — this IS the guard layer | **met** — `erp-adapter.test.ts`, 57/57, plus a live refusal proof beyond the plan's requirement |
| AC18 | Real scoped read-only login boot probe | Refusal LOGIC (mock) proven now; live-credential half is Phase 5's | **partially met** — mocked refusal/acceptance both pass; live-login half is a pre-declared Known-Gap owned by Phase 5, not scored unmet here (SPEC itself declares this residual) |

AC2–AC8, AC10, AC11, AC14 are entirely out of Phase 1's scope (per-dashboard business logic,
auth-redirect on real dashboard routes, CSV export) — not scored here; Phases 2–5 own them.

**No unmet criterion within Phase 1's own scope.** No new backlog note is required for SPEC gaps
this phase; AC18's live half was already a declared residual before this phase began.

## Closeout Packet

1. **Selected plan path:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_PLAN_18-09-26.md`
2. **Closeout classification:** Program continues (this is an inner-loop phase, not archived) —
   equivalent single-plan state: **Ready for UPDATE PROCESS archival** in EVERY respect except that
   phase programs archive only at program completion, per `phase-programs.md`. Phase 1 itself is
   ✅ VERIFIED at agent level; the umbrella plan and phase plan both stay in `active/`.
3. **What was finished:** see "What Was Done" above — all of Steps A–G, plus the EVL confirmation
   run this session.
4. **Verified vs unverified:** Verified — all Fully-Automated and Hybrid gates (unit 212/212,
   e2e chromium 4/4 + mobile 3/3 with expected skips, lint, build, live curl against the fixture
   DB, live refusal against a real write-capable connection). Unverified — AC18's live-login
   positive case (no DBA login exists yet); visual banner placement (no dashboard page exists yet).
   Both are pre-declared, Phase-5/Phase-2-3-4-owned residuals, not new gaps.
4b. **Validate-contract compliance:** Present — inner-pvl contract dated 22-09-26, `Gate: PASS`,
   `generated-by: inner-pvl: phase-1`, supersedes the 18-09-26 outer-pvl contract. VALIDATE was run,
   not skipped.
5. **Cleanup done vs still needed:** Done — phase report (this file), Phase Loop Progress Steps 6–7
   ticked, umbrella `## Current Execution State` rewritten, registry ledger updated, context docs
   already current (execute-agent's Step F3–F6 appends, plus this session's status-line/timestamp
   refresh), Tier-1 audits run (see below). Still needed — nothing blocking; the next phase
   (Phase 2) needs its own RESEARCH step. Nothing is committed; nothing was requested to be
   committed this session.
6. **Single best next valid state:** Continue the program — spawn `vc-research-agent` for Phase 2
   (Sales Dashboard): `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-02-sales-dashboard_PLAN_18-09-26.md`.
   Per the umbrella's join conditions, Phases 2/3/4 may run in parallel once Phase 1's exit gate is
   met (it is).
7. **Commit-checkpoint recommendation:** Execution commit recommended before further phases —
   Phase 1's implementation (`src/lib/erp/*`, new components, fixture SQL, nav/tests) is
   well-tested and EVL-confirmed green. Per the umbrella charter's hard constraint ("Commit each
   phase's execution changes before starting the next phase. Keep process/plan/context commits
   separate from execution commits."), TWO commits are recommended, in this order:
   - **Execution commit** (source/test/fixture files): `src/lib/erp/**`, `src/components/{dashboard-data-table,pilot-banner,degrade-banner}.tsx`, `src/app/api/health/erp/**`, `src/lib/__tests__/{erp-adapter,erp-cache-degrade,resolve-erp-database-url,dashboard-data-table}.test.ts(x)`, the auth-guard-coverage.test.ts append, `src/app/nav-links.tsx`, `db/erp-fixture/**`, `e2e/dashboards-nav-visibility.spec.ts`, `playwright.config.ts`, `.env.example`, `db/create-erp-readonly-login.sql` (Phase 0 artifact, still uncommitted).
   - **Process commit** (this UPDATE PROCESS session's artifacts): `process/features/erp-dashboards/**` (all plan/report/registry/SPEC/REF files), `process/context/{all-context.md,database/all-database.md,tests/all-tests.md}`.
   No commit was made this session — the user did not request one.
8. **Regression status:** Checked against Phase 0's owned surfaces (context-doc correction lines,
   `db/create-erp-readonly-login.sql`) — untouched, confirmed via `git diff` scope check. No prior
   *verified* phase besides Phase 0 exists yet, so no other regression surface applies.
9. **SPEC achievement:** see "SPEC Achievement" section above — no unmet criterion within Phase 1's
   own scope.

## Forward Preview

### Test Infra Found

Vitest is `environment: "node"` with no jsdom/testing-library and no `@/` alias; the established
component-test pattern for a server component is `renderToStaticMarkup` + relative imports +
mocked `next/link`. Playwright projects match spec files by filename regex, not automatically — a
new phone-tier spec needs an explicit `testMatch` broadening (see Test Infra Gaps Found).

### Blast Radius Changes

New shared surfaces, now owned by Phase 1 and **imported, never edited**, by later phases:
`src/lib/erp/{erp-adapter,pool,resolve-erp-database-url,cache,degrade}.ts`,
`src/components/{dashboard-data-table,pilot-banner,degrade-banner}.tsx`,
`db/erp-fixture/{00-schema,01-seed}.sql`, `src/app/api/health/erp/route.ts`, and the
`nav-links.tsx` "แดชบอร์ด" group. Their prop/export signatures are now binding contracts for
Phases 2, 3, and 4. No file outside Phase 1's declared Blast Radius was touched (confirmed via
`git status` cross-check during EVL).

### Commands to Stay Green

```bash
pnpm test && pnpm lint && pnpm build
pnpm test:e2e --project=chromium e2e/dashboards-nav-visibility.spec.ts
pnpm test:e2e --project=mobile e2e/dashboards-nav-visibility.spec.ts
# Hybrid preconditions: orderstock-sql container up + db/erp-fixture/*.sql applied (LOCAL ONLY)
curl localhost:3000/api/health/erp
```

### Dependency Changes

None. `mssql@^12.2.0` was already present and already externalized in `next.config.ts`.
`package.json` is byte-unchanged this phase.

### For Phase 2 (and 3, 4)

Call `getErpPool()` then `guardedQuery(pool, sql, params)` — never open a separate connection,
never use Prisma for ERP data, never build SQL by string concatenation. Wrap reads in
`getCached(...)` and pass its `stale` flag through `erpDegradeState()` into `<DegradeBanner>`. Put
domain fixture tables in your own seed file (`db/erp-fixture/{sales,purchase,production}-seed.sql`)
— never edit Phase 1's base file directly; route any shared/base fixture gap back to Phase 1 via a
PLAN-SUPPLEMENT. **`InventoryItem`'s real PK is composite `(Roworder, ItemCode)`** — confirm and
apply the highest-`Roworder`-wins tie-break rule in your own RESEARCH step before writing any query
that joins a transactional table to `InventoryItem` by `ItemCode` (registry Cross-Phase
Precondition).

---

## Addendum — write-capable-login opt-in switch (Step H, supplement 22-09-26)

**What changed and why.** The user explicitly chose option B on 22-09-26: for now the ERP
dashboards may run on the EXISTING write-capable login (the app's own `sa` connection to `db_TCL`)
rather than wait for the DBA-provisioned scoped read-only login from
`db/create-erp-readonly-login.sql`. The standing rule "ดึงมาเท่านั้น ห้ามเขียนกลับ" (read only, never
write back) is unchanged — this relaxes WHICH LOGIN may back the pool, never the read-only
guarantee. Implemented as an explicit, off-by-default opt-in with loud, repeated visibility.

### Implementation

| File | Change |
|---|---|
| `src/lib/erp/pool.ts` | `allowsWriteCapableLogin(env)` (accepts the exact string `"1"` only), `runBootProbeWithOptIn(pool, deps)` (warn-instead-of-throw, injectable deps for unit testing), `erpReadOnlyLoginState()` / `resetErpReadOnlyLoginState()`, `buildWriteCapableLoginWarning(labels)`. `getErpPool()` now calls `runBootProbeWithOptIn` instead of `verifyReadOnlyBoot` directly — once per pool creation, never per query. |
| `src/lib/erp/erp-adapter.ts` | **Unchanged** (Step H2's preferred outcome). `verifyReadOnlyBoot` keeps its throw-only contract; the catch-and-warn lives at the `pool.ts` call site, so Step E3's existing mocked cases needed zero edits. |
| `src/app/api/health/erp/route.ts` | Additive `readOnlyLogin: boolean` + optional `warning: string`, spread from `erpReadOnlyLoginState()` onto BOTH the success and the `{ok:false}` branch. No existing field renamed/removed; still never 500s; still unauthenticated by design. |
| env template | Commented-out `# ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` placeholder with a DANGER comment and the remediation path. Placeholder only — no real value; the repo's real `.env` was never read or written. |
| `src/lib/__tests__/erp-pool-write-capable-switch.test.ts` | New, 21 Fully-Automated cases (see matrix below). Kept isolated so the whole supplement can be removed in one file if the exception is retired. |
| `process/context/database/all-database.md` | New "Accepted known-gap — `ERP_ALLOW_WRITE_CAPABLE_LOGIN` (charter exception, 22-09-26)" subsection under ERP Read Layer: who approved, when, what it costs, exit condition. |

### Behaviour matrix proved (4 rows, all Fully-Automated)

| # | Switch | Probe result | Outcome proved |
|---|---|---|---|
| 1 | absent / `"0"` / `"true"` / `""` | write-capable | pool creation still **throws** `ErpWritePermissionError`; nothing logged; `readOnlyLogin: true` untouched. `shouldVerifyBootProbe({NODE_ENV:"production"})` still `true` — production fail-closed behaviour unchanged. |
| 2 | `"1"` | write-capable | resolves; the probe still ran (`verify` called once); **exactly one** warning logged (call count asserted) naming every granted permission + `db/create-erp-readonly-login.sql` + the Thai one-liner; state `{ readOnlyLogin: false, warning }`. |
| 3 | `"1"` | read-only (`can_select` only) | resolves; **no** warning logged; `readOnlyLogin: true`, `warning` undefined. |
| 4 | `"1"` | write-capable | the warning contains none of: the connection string, the password substring, `sqlserver://`, `password`, `pwd=`, `user=`, the host — a negative assertion, not an eyeball check. Health-surfaced copy is the same string. |

Extra hardening beyond the 4 required rows: an inconclusive probe (probe errored / returned no
rows) **always** rethrows even with the switch on — the exception covers only a *proven*
write-capable permission set, never an unproven one. The switch-value parser is asserted against 8
near-miss values (`" 1"`, `"1 "`, `"01"`, …), all false.

### Unchanged layers (verified by diff)

Layers 1, 2, 3 and 5 — normalizer, SELECT-only denylist, single `guardedQuery` choke point with
parameterized requests, no-write-method compile guard, `ApplicationIntent=ReadOnly` — were not
touched. `erp-adapter.ts` has no diff. `db_TCL` was never contacted during this supplement; all new
tests are mock-only with no real connection.

### Gates (supplement run)

| Gate | Result |
|---|---|
| `pnpm test` (full) | see Gate Outcomes below — green |
| `pnpm lint` | green |
| `pnpm build` | green |
| `pnpm test` on the 4 ERP unit files individually | green |

### Residual / exit condition

This is an **accepted known-gap**, recorded in `all-database.md`, not a closed item. Production
go-live for the ERP dashboards still requires EITHER the scoped read-only login provisioned and in
use, OR a dated, named re-confirmation of this exception — a hard Phase 5 rollout gate. "The switch
works" is never sufficient for production sign-off on its own.

---

## Appendix — EXECUTE-time step detail (folded in from the deleted 18-09-26 report)

Preserved verbatim for historical fidelity. Steps E/F test counts and the Read-Only Proof table
below are the EXECUTE-session evidence; the "Test Gate Outcomes" section above is the independent
EVL re-confirmation of the same claims and is the authoritative gate record.

### Step A — pattern confirmation (all 6 items)

- **A1** `src/lib/db.ts` + `resolve-database-url.ts` re-read; singleton + raw-read contract
  unchanged since 18-09-26. Mirrored exactly.
- **A2** Confirmed empirically (not just by doc): `CREATE DATABASE erp_fixture` succeeded inside
  the existing `orderstock-sql` container, and `sys.databases` now lists BOTH `orderstock` and
  `erp_fixture`. No `docker-compose.yml` change was needed or made.
- **A3** Sibling reference read READ-ONLY at `/Users/innovera/Documents/TCL/server/src/erp/
  erp-adapter.ts` (normalizer, `FORBIDDEN_KEYWORDS`, `assertReadOnlySql`) and
  `drivers/mssql.driver.ts` (`PERMISSION_PROBE_SQL`). Logic and structure ported; nothing imported,
  no Thai comments copied — everything re-commented in English.
- **A4** `admin/users/users-mobile.tsx` read; its `md`-breakpoint card-list pattern is what
  `dashboard-data-table.tsx`'s mobile branch mirrors.
- **A5** `src/app/api/health/route.ts` read: it calls no auth guard and hits the DB directly.
  Confirms `/api/health/erp` should follow the same unauthenticated-probe precedent.
- **A6** `ui/card.tsx` + `ui/chip.tsx` read; both reused rather than restyled.

### Step B — guard, pool, resolver (5 new files under `src/lib/erp/`)

- `resolve-erp-database-url.ts` — raw-read `ERP_DATABASE_URL` resolver, same `$`-in-password
  dotenv-expand bypass as `DATABASE_URL`, never logs the value.
- `erp-adapter.ts` — the whole guard: `normalizeSqlForGuard`, `assertReadOnlySql` (19 keyword
  rules), `guardedQuery` (the single choke point), `ErpAdapter` + compile-time no-write-method
  type guard, `PERMISSION_PROBE_SQL` + `verifyReadOnlyBoot`, and two typed error classes.
- `pool.ts` — the separate `mssql.ConnectionPool` singleton, a small JDBC→mssql-config parser,
  `readOnlyIntent: true`, and `shouldVerifyBootProbe()` gating.
- `cache.ts` — 5-minute TTL `Map` cache with last-known-good fallback + `clearErpCache()`.
- `degrade.ts` — `erpDegradeState()` and the exact `"ข้อมูลอาจไม่ล่าสุด"` constant.

Grepped `src/lib/erp/*` for `prisma` / `$queryRaw` / `@prisma` before closing Step B: the only
matches are comment lines stating the rule. Zero code usage.

### Step C — fixture database (LOCAL SANDBOX ONLY)

`db/erp-fixture/00-schema.sql` (idempotent `erp_fixture` DB + `dbo.InventoryItem` with the real
composite `(Roworder, ItemCode)` PK) and `01-seed.sql` (10 idempotent rows: mixed `ItemGRP`,
several units, one deliberate NULL `MainUnits`). Both carry a prominent
"NEVER RUN AGAINST db_TCL" header. Applied to the `orderstock-sql` container only; target was
verified as localhost before each command. Re-running the seed affects 0 rows and the count stays
at 10.

### Step D — route, components, nav

- `src/app/api/health/erp/route.ts` — reads through `getCached` → `getErpPool` → `guardedQuery`.
  Returns HTTP 200 always (`{ok:true, latencyMs, stale, rows}` or `{ok:false, error}`), never 500,
  never echoes driver/connection detail to the client.
- `src/components/dashboard-data-table.tsx` — shared, data-shape-agnostic, server-rendered table:
  URL-driven sort (`?sort=`, `-` prefix = desc), pagination (`?page=`), every other searchParam
  preserved, desktop table + mobile card list, empty state.
- `src/components/pilot-banner.tsx` and `degrade-banner.tsx` — the two reusable banners Phases
  2/3/4 import.
- `src/app/nav-links.tsx` — new "แดชบอร์ด" group (additive), 3 links, no `adminOnly` (ADMIN+STAFF).
- Verified: `git status` confirmed `src/components/bottom-tab-bar.tsx`, `prisma/`, and
  `package.json` were untouched at EXECUTE time.

### Step E/F — tests and docs (EXECUTE-time counts)

57 guard tests, 24 cache/degrade/parser tests, 12 resolver tests, 17 data-table tests, 7 new e2e
tests. `playwright.config.ts` `mobile` `testMatch` broadened. `auth-guard-coverage.test.ts` gained
an explicit public-health-route exemption block. Context docs appended and the env template
documents `ERP_DATABASE_URL` + `ERP_VERIFY_BOOT_PROBE` with placeholders only.

### Read-Only Proof (EXECUTE-time, 5 mechanisms)

| # | Mechanism | Where | Proven by |
|---|---|---|---|
| 1 | Comment-strip + literal/identifier masking before any scanning | `normalizeSqlForGuard` | 6 tests: `update_flag`, `[Update Date]`, forbidden word inside a string literal, `;` smuggling, BOM, whitespace collapse |
| 2 | 19-rule keyword denylist + single-statement + must-start-SELECT/WITH | `assertReadOnlySql` | 19 keyword tests + 14 statement-shape tests + case-insensitivity |
| 3 | Guard runs BEFORE the pool; params bound via `request.input` only | `guardedQuery` | "never touches the pool" test asserts `pool.request()` was not called at all for a forbidden statement, looped over all 19 rules; a separate test asserts the SQL sent still contains `@grp` and NOT the literal value |
| 4 | `HAS_PERMS_BY_NAME` boot probe refuses a write-capable login | `verifyReadOnlyBoot` | 5 mocked per-permission refusal tests + multi-grant naming + no-rows refusal + probe-error refusal + a test that the probe SQL is itself SELECT-only. Also proven LIVE (see below) |
| 5 | `ApplicationIntent=ReadOnly` | `parseJdbcSqlServerUrl` | asserts `options.readOnlyIntent === true` unconditionally |
| + | Compile-time no-write-method guard on `ErpAdapter` | `erp-adapter.ts` | `pnpm build` / typecheck fails if a write-shaped method name is added |

**Live refusal evidence (EXECUTE-time, stronger than the plan required).** With
`ERP_VERIFY_BOOT_PROBE=1` against the real (write-capable `sa`) sandbox connection, the boot probe
refused a genuine live connection and the route degraded safely:

```
GET /api/health/erp -> {"ok":false,"error":"ERP connection failed"}  HTTP 200
server log: ErpWritePermissionError: [ERP read-only boot probe] refusing to serve ERP reads:
  the connected login holds write/DDL permission(s): INSERT, UPDATE, DELETE, ALTER, CREATE TABLE.
  at verifyReadOnlyBoot (src/lib/erp/erp-adapter.ts:411:11)
```

(This live-refusal proof predates the 22-09-26 write-capable-login opt-in switch documented in the
Addendum above; both remain true — the opt-in only changes behavior when the switch is explicitly
set to `"1"`.)
