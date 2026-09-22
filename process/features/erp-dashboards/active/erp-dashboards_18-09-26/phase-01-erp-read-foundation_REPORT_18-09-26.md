---
phase: phase-01-erp-read-foundation
date: 2026-09-22
status: COMPLETE_WITH_GAPS
feature: erp-dashboards
plan: process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_PLAN_18-09-26.md
---

# Phase 1 — ERP Read Foundation — EXECUTE Report

**TL;DR** — The read-only ERP pipe is built and green. All 5 defense layers are implemented and
tested, the local `erp_fixture` sandbox DB is seeded, `/api/health/erp` answers live, and the
"แดชบอร์ด" nav group ships. Unit tests went 100 → 212, e2e 49 → 56; lint and build are clean.
**db_TCL was never contacted.** One declared gap remains: the live boot probe against the real
DBA-provisioned scoped read-only login (Phase 5), because that login does not exist yet.

---

## What Was Done

### Step A — pattern confirmation (all 6 items)

- **A1** `src/lib/db.ts` + `resolve-database-url.ts` re-read; singleton + raw-read contract
  unchanged since 18-09-26. Mirrored exactly.
- **A2** Confirmed empirically (not just by doc): `CREATE DATABASE erp_fixture` succeeded inside
  the existing `orderstock-sql` container, and `sys.databases` now lists BOTH `orderstock` and
  `erp_fixture`. **No `docker-compose.yml` change was needed or made.**
- **A3** Sibling reference read READ-ONLY at `/Users/innovera/Documents/TCL/server/src/erp/
  erp-adapter.ts` (normalizer, `FORBIDDEN_KEYWORDS`, `assertReadOnlySql`) and
  `drivers/mssql.driver.ts` (`PERMISSION_PROBE_SQL`). Logic and structure ported; nothing imported,
  no Thai comments copied — everything re-commented in English.
- **A4** `admin/users/users-mobile.tsx` read; its `md`-breakpoint card-list pattern is what
  `dashboard-data-table.tsx`'s mobile branch mirrors.
- **A5** `src/app/api/health/route.ts` read: it calls **no** auth guard and hits the DB directly.
  Confirms `/api/health/erp` should follow the same unauthenticated-probe precedent (resolves the
  open question E2 flagged).
- **A6** `ui/card.tsx` + `ui/chip.tsx` read; both reused rather than restyled.

### Step B — guard, pool, resolver (5 new files under `src/lib/erp/`)

- `resolve-erp-database-url.ts` — raw-read `ERP_DATABASE_URL` resolver, same `$`-in-password
  dotenv-expand bypass as `DATABASE_URL`, never logs the value.
- `erp-adapter.ts` — the whole guard: `normalizeSqlForGuard`, `assertReadOnlySql` (19 keyword
  rules), `guardedQuery` (the single choke point), `ErpAdapter` + compile-time no-write-method
  type guard, `PERMISSION_PROBE_SQL` + `verifyReadOnlyBoot`, and two typed error classes.
- `pool.ts` — the separate `mssql.ConnectionPool` singleton, a small JDBC→mssql-config parser
  (E4), `readOnlyIntent: true`, and `shouldVerifyBootProbe()` gating.
- `cache.ts` — 5-minute TTL `Map` cache with last-known-good fallback + `clearErpCache()`.
- `degrade.ts` — `erpDegradeState()` and the exact `"ข้อมูลอาจไม่ล่าสุด"` constant.

Per E5, grepped `src/lib/erp/*` for `prisma` / `$queryRaw` / `@prisma` before closing Step B:
**the only matches are comment lines stating the rule. Zero code usage.**

### Step C — fixture database (LOCAL SANDBOX ONLY)

`db/erp-fixture/00-schema.sql` (idempotent `erp_fixture` DB + `dbo.InventoryItem` with the real
composite `(Roworder, ItemCode)` PK) and `01-seed.sql` (10 idempotent rows: mixed `ItemGRP`,
several units, one deliberate NULL `MainUnits`). Both carry a prominent
"NEVER RUN AGAINST db_TCL" header. Applied to the `orderstock-sql` container only; target was
verified as localhost before each command. Re-running the seed affects 0 rows and the count stays
at 10. The apply procedure is documented in `all-database.md` (C3).

### Step D — route, components, nav

- `src/app/api/health/erp/route.ts` — reads through `getCached` → `getErpPool` → `guardedQuery`.
  Returns HTTP 200 always (`{ok:true, latencyMs, stale, rows}` or `{ok:false, error}`), never 500,
  and never echoes driver/connection detail to the client.
- `src/components/dashboard-data-table.tsx` — shared, data-shape-agnostic, server-rendered table:
  URL-driven sort (`?sort=`, `-` prefix = desc), pagination (`?page=`), **every other searchParam
  preserved**, desktop table + mobile card list, empty state.
- `src/components/pilot-banner.tsx` and `degrade-banner.tsx` — the two reusable banners Phases
  2/3/4 import.
- `src/app/nav-links.tsx` — new "แดชบอร์ด" group (additive), 3 links, no `adminOnly` (ADMIN+STAFF).
- **D4 verified:** `git status` confirms `src/components/bottom-tab-bar.tsx`, `prisma/`, and
  `package.json` are untouched.

### Step E/F — tests and docs

57 guard tests, 24 cache/degrade/parser tests, 12 resolver tests, 17 data-table tests, 7 new e2e
tests. `playwright.config.ts` `mobile` `testMatch` broadened (F1b). `auth-guard-coverage.test.ts`
gained an explicit public-health-route exemption block (F2). Context docs appended (F3/F4/F5) and
the env template documents `ERP_DATABASE_URL` + `ERP_VERIFY_BOOT_PROBE` with placeholders only.

---

## Read-Only Proof

Five implemented mechanisms, each with the test that proves it:

| # | Mechanism | Where | Proven by |
|---|---|---|---|
| 1 | Comment-strip + literal/identifier masking before any scanning | `normalizeSqlForGuard` | 6 tests: `update_flag`, `[Update Date]`, forbidden word inside a string literal, `;` smuggling, BOM, whitespace collapse |
| 2 | 19-rule keyword denylist + single-statement + must-start-SELECT/WITH | `assertReadOnlySql` | 19 keyword tests (one per rule, asserting the exact `keyword` on the thrown error) + 14 statement-shape tests + case-insensitivity |
| 3 | Guard runs BEFORE the pool; params bound via `request.input` only | `guardedQuery` | "never touches the pool" test asserts `pool.request()` was **not called at all** for a forbidden statement, looped over all 19 rules; a separate test asserts the SQL sent still contains `@grp` and NOT the literal value |
| 4 | `HAS_PERMS_BY_NAME` boot probe refuses a write-capable login | `verifyReadOnlyBoot` | 5 mocked per-permission refusal tests + multi-grant naming + no-rows refusal + probe-error refusal + a test that the probe SQL is itself SELECT-only. **Also proven LIVE** (below) |
| 5 | `ApplicationIntent=ReadOnly` | `parseJdbcSqlServerUrl` | asserts `options.readOnlyIntent === true` unconditionally |
| + | Compile-time no-write-method guard on `ErpAdapter` | `erp-adapter.ts` | `pnpm build` / typecheck fails if a write-shaped method name is added |

**Live refusal evidence (stronger than the plan required).** With `ERP_VERIFY_BOOT_PROBE=1`
against the real (write-capable `sa`) sandbox connection, the boot probe refused a genuine live
connection and the route degraded safely:

```
GET /api/health/erp -> {"ok":false,"error":"ERP connection failed"}  HTTP 200
server log: ErpWritePermissionError: [ERP read-only boot probe] refusing to serve ERP reads:
  the connected login holds write/DDL permission(s): INSERT, UPDATE, DELETE, ALTER, CREATE TABLE.
  at verifyReadOnlyBoot (src/lib/erp/erp-adapter.ts:411:11)
```

**Structural guarantees:** `ErpAdapter` has no write method and cannot gain one; there is no
exported path to the ERP connection other than `guardedQuery`; `src/lib/erp/*` contains zero
Prisma usage; no ERP table exists in `prisma/schema.prisma`; no migration was created or run.

**db_TCL was never contacted in this phase.** Every DB command targeted the local `orderstock-sql`
container. `db/create-erp-readonly-login.sql` was neither modified nor executed.

---

## Test Gate Outcomes

| Gate | Command | Result |
|---|---|---|
| AC17 + AC18-mock | `pnpm test src/lib/__tests__/erp-adapter.test.ts` | ✅ **57 passed** (plan target was ~24) |
| INFRA-url | `pnpm test src/lib/__tests__/resolve-erp-database-url.test.ts` | ✅ **12 passed** |
| AC15 + boot gating + URL parser | `pnpm test src/lib/__tests__/erp-cache-degrade.test.ts` | ✅ **24 passed** |
| AC12/AC13 | `pnpm test src/lib/__tests__/dashboard-data-table.test.tsx` | ✅ **17 passed** |
| Guard coverage | `pnpm test src/lib/__tests__/auth-guard-coverage.test.ts` | ✅ passed (incl. 2 new public-route assertions) |
| AC1-infra (desktop) | `pnpm test:e2e --project=chromium e2e/dashboards-nav-visibility.spec.ts` | ✅ **4 passed**, 3 skipped (phone-tier blocks) |
| AC1-infra (phone) | `pnpm test:e2e --project=mobile e2e/dashboards-nav-visibility.spec.ts` | ✅ **3 passed**, 3 skipped (desktop-tier blocks) |
| INFRA-regress | `pnpm test && pnpm lint && pnpm build` | ✅ **212/212 tests, 20 files**; lint exit 0; build exit 0, `/api/health/erp` registered as `ƒ` dynamic |
| INFRA-health (Hybrid) | `curl localhost:3000/api/health/erp` | ✅ `{"ok":true,"latencyMs":160,"stale":false,"rows":1}` HTTP 200 |
| INFRA-fixture (Hybrid) | sqlcmd row count in `erp_fixture` | ✅ `erp_fixture` exists, `InventoryItem` = 10 rows, re-seed affects 0 |
| READONLY-boot-mock | same file as AC18-mock | ✅ green, **plus the live refusal above** |
| AC18-live | — | ⛔ Known-Gap, deferred to Phase 5 (login not provisioned) |
| INFRA-visual | — | ⛔ Agent-Probe, deferred to Phase 2/3/4 (no dashboard page exists yet) |

Suite movement: unit **100 → 212 tests / 16 → 20 files**; e2e **49 → 56** (excl. `[setup]`).

**One flaky observation (not a regression):** on a loaded first full-suite run,
`src/lib/__tests__/password.test.ts` timed out at the 5000 ms default (bcrypt work factor 12). It
passes in isolation (2.66 s) and on a re-run of the full suite. That file is untouched by this
phase (`git status` confirms). Logged under Test Infra Gaps.

---

## Plan Deviations

All three are within blast radius (naming/implementation detail inside files this phase owns).
None touches schema, auth, API contract, billing, or container lifecycle.

1. **Relative imports instead of `@/` in the three new components.** Vitest does not resolve the
   `@/` TS path alias (no `resolve.alias` in `vitest.config.ts`), so the component test failed to
   load. `vitest.config.ts` is **outside this phase's blast radius**, so rather than editing it I
   used relative imports inside my own new files (`./ui/card`, `./ui/chip`,
   `../lib/erp/degrade`). Impact: none at runtime; documented in `all-tests.md` as the pattern for
   future unit-testable components. The alternative (adding a vitest alias) is a reasonable future
   cleanup but would have been an out-of-radius edit.
2. **The ERP pool is created lazily, not at module load.** The plan's Step B3 implied a
   module-level `erpPool` mirroring `db.ts`. Building it eagerly would make a missing/blank
   `ERP_DATABASE_URL` crash *every* page, including all non-ERP ones — the opposite of the degrade
   requirement. `getErpPool()` now constructs on first ERP read and caches via `globalThis`. This
   also keeps `pool.ts` importable from unit tests.
3. **`verifyReadOnlyBoot` also refuses on an inconclusive probe.** The plan specified throwing when
   a write permission is granted; I additionally throw when the probe returns no rows or itself
   errors. Fail-closed is the safer reading of "never silently downgrade". Both cases are tested.

Minor, non-deviating note: the guard exposes `ErpWritePermissionError` and `normalizeSqlForGuard`
as named exports (the plan named neither explicitly) so both are directly unit-testable.

---

## Test Infra Gaps Found

- **`password.test.ts` is timing-sensitive** — bcrypt work factor 12 can exceed vitest's 5000 ms
  default under parallel load. Not introduced here; a per-test `testTimeout` bump would remove the
  flake. Recommend as a small standalone cleanup, not a Phase 1 edit (file is out of radius).
- **No vitest `@/` alias** — see Deviation 1. Adding `resolve.alias` to `vitest.config.ts` would
  let future components keep repo-standard imports and still be unit-testable.
- **No `pnpm db:seed:erp-fixture` script** — the fixture apply is a documented two-line `docker cp`
  + `docker exec sqlcmd` procedure (now in `all-database.md`). A package script would be tidier but
  `package.json` is outside this phase's radius; recorded for a later phase.
- **Narrow `testMatch` regexes are a silent-zero-test trap** — adding a spec file is not enough
  when a Playwright project matches by name. F1b fixed it for this spec; later phases adding
  phone-tier specs must remember the same edit.

---

## What Was Skipped or Deferred

- **AC18 live boot probe against the real db_TCL scoped read-only login** — the login does not
  exist (`db/create-erp-readonly-login.sql` is a USER-RUN DBA delivery step, written and NOT run,
  untouched by this phase). Deferred to Phase 5 as the SPEC already declares. Only the *positive*
  case is unproven; the refusal path is proven both mocked and live.
- **Degrade-banner visual placement** — no dashboard page exists yet to render it on. Phase 2/3/4.
- **Per-domain fixture tables** (Sales/Purchase/Production) — owned by Phases 2/3/4 per the
  registry's Per-Domain Fixture Seed Split. Phase 1 built only the shared base file.
- **Charting library decision** — Phase 2's spike, untouched.

No follow-up plan stubs were created; every deferral is an already-declared, already-owned item.
No `CONTEXT_PARTIAL` items were encountered.

---

## Closeout Packet

- **Selected plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_PLAN_18-09-26.md`
- **Classification:** `Keep in active/testing` — code-complete and all automated + hybrid gates
  green, but the EVL confirmation run (Step 6) has not been performed yet, and the phase's own
  Completion Rules require it before ✅ VERIFIED. Status is therefore 🔨 **CODE DONE**, not VERIFIED.
- **Verified:** every Fully-Automated gate, both Hybrid gates, lint, build, plus a live read-only
  refusal proof beyond what the plan asked for.
- **Unverified:** AC18's live positive case (needs the DBA login); banner visual placement.
- **Remaining cleanup:** EVL re-run by vc-tester; then UPDATE PROCESS (archive + umbrella
  `## Current Execution State` rewrite + commit). **Nothing is committed — no commit was requested.**
- **Next valid state:** EVL confirmation run against this plan's Validate Contract gate commands.

---

## Forward Preview

### Test Infra Found
Vitest is `environment: "node"` with no jsdom/testing-library and no `@/` alias; the established
component-test pattern is `renderToStaticMarkup` + relative imports + a mocked `next/link`. Reuse
it. Playwright projects match by filename regex — a new phone-tier spec needs a `testMatch` edit.

### Blast Radius Changes
New shared surfaces now owned by Phase 1 and **imported, never edited** by later phases:
`src/lib/erp/{erp-adapter,pool,resolve-erp-database-url,cache,degrade}.ts`,
`src/components/{dashboard-data-table,pilot-banner,degrade-banner}.tsx`,
`db/erp-fixture/{00-schema,01-seed}.sql`, `src/app/api/health/erp/route.ts`, and the
`nav-links.tsx` "แดชบอร์ด" group. Their prop/export signatures are now binding contracts.

### Commands to Stay Green
```bash
pnpm test && pnpm lint && pnpm build
pnpm test:e2e --project=chromium e2e/dashboards-nav-visibility.spec.ts
pnpm test:e2e --project=mobile e2e/dashboards-nav-visibility.spec.ts
# Hybrid preconditions: orderstock-sql up + db/erp-fixture/*.sql applied (LOCAL ONLY)
curl localhost:3000/api/health/erp
```

### Dependency Changes
**None.** `mssql@^12.2.0` was already present and already externalized in `next.config.ts`. No
package was added, removed, or upgraded; `package.json` is byte-unchanged.

### For Phases 2/3/4
Call `getErpPool()` then `guardedQuery(pool, sql, params)` — never open your own connection, never
use Prisma for ERP data, never build SQL by concatenation. Wrap reads in `getCached(...)` and pass
its `stale` flag through `erpDegradeState()` into `<DegradeBanner>`. Put domain fixture tables in
your own seed file; route any shared/base fixture change back to Phase 1 via PLAN-SUPPLEMENT.
`InventoryItem`'s real PK is composite `(Roworder, ItemCode)` — confirm the tie-break rule first.
