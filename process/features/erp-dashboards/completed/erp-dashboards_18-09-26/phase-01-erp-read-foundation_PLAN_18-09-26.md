---
name: plan:erp-dashboards-phase-01-erp-read-foundation
description: "ERP Dashboards — Phase 1: ERP guarded read layer, fixture DB, cache/degrade, /api/health/erp, shared data-table, nav group, ported guard tests"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: phase-01
---

# Phase 1 — ERP Read Foundation

**Program:** erp-dashboards
**Umbrella plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
**Registry:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-blast-radius-registry.md`
**SPEC (frozen, governs this phase):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
**Phase status:** ✅ VERIFIED at agent level (22-09-26)
**Report destination:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_REPORT_22-09-26.md`
(the EXECUTE-time report, formerly `phase-01-erp-read-foundation_REPORT_18-09-26.md`, was folded
into the 22-09-26 report's Appendix and deleted at UPDATE PROCESS, 22-09-26 — the 22-09-26 report
is now the sole closeout record, Steps A–F detail included)
Date: 18-09-26
Status: ✅ VERIFIED at agent level (22-09-26) — see Phase Completion Rules; 1 pre-declared
known-gap (AC18 live login, owned by Phase 5), non-blocking
Complexity: COMPLEX

---

## Overview

## Purpose

Build the shared, reusable ERP-read infrastructure that Phases 2, 3, and 4 (Sales / Purchase /
Production dashboards) will import but never re-implement: a single guarded read-only SQL choke
point (`guardedQuery` + `assertReadOnlySql`) ported from the sibling KRS TCL project, a separate
`mssql` connection pool with its own env var and raw-read URL resolver, a short-TTL in-process
cache with a last-known-good degrade path, a health-check route, a shared responsive data-table
component, the "แดชบอร์ด" nav group (all 3 links), and the ~24 ported guard test cases. Nothing in
this phase touches ERP business data shape — that is Phase 2/3/4's job. Phase 1 proves the pipe is
safe and reusable; it does not yet know what flows through it beyond a minimal fixture probe table.

This phase is the **sole owner** of `src/lib/erp/*`, the shared data-table component, the ERP
fixture DDL/seed files, and `src/app/nav-links.tsx` for this program — every later phase imports,
never edits, these files (per the registry's ownership rules).

---

## Read First (context this phase depends on)

- Umbrella plan `## Program Goal Charter` (hard safety constraints — db_TCL never mutated, `sa`/
  `orderstock_app` never backs the ERP pool, ERP tables never added to `prisma/schema.prisma`,
  never route ERP reads through Prisma/`$queryRaw`)
- Registry Phase 1 section (owned paths, shared-file touch rules) and the Parallel-Safety Statement
- SPEC ACs 1, 2, 9 (partially — the shared infra piece), 12, 13, 15, 16, 17 — this phase's exit
  gate proves the infra pieces of these; the domain-specific pieces (AC3–AC8, AC10, AC11, AC14)
  belong to Phases 2–5
- `erp-dashboards-proposal_REF_18-09-26.md` — architecture source of record (guard layer,
  separate pool, cache/degrade, versioned SQL files, pilot banner, nav group placement)
- Sibling project reference (READ-ONLY source of a proven pattern, never imported as a package):
  `/Users/innovera/Documents/TCL/server/src/erp/erp-adapter.ts` (`assertReadOnlySql`,
  `FORBIDDEN_KEYWORDS`, `BaseErpDriver.guardedQuery`) and
  `/Users/innovera/Documents/TCL/server/src/erp/drivers/mssql.driver.ts` (`PERMISSION_PROBE_SQL`,
  boot permission probe pattern using `HAS_PERMS_BY_NAME`)

---

## Entry Gate

- Phase 0 exit gate passed: prod deploy backlog cleared/deferred-with-owner, corrected context docs
  merged, fixture-DB approach confirmed in Phase 0's report, `db/create-erp-readonly-login.sql`
  written (not run)
- `process/context/database/all-database.md` / `process/context/tests/all-tests.md` no longer
  contain the stale "ERP-shaped clone" claims Phase 0 was tasked to correct

---

## Scope

**In scope:**
- `src/lib/erp/*` guarded read layer (adapter/guard, pool, env resolver, cache, degrade helper)
- A local ERP-shaped fixture database (`erp_fixture`) in the existing sandbox container, separate
  from the Prisma `orderstock` sandbox DB, with a minimal shared/base DDL+seed (NOT the full
  Sales/Purchase/Production schema — see "Fixture DB Scope Decision" below)
- `/api/health/erp` route
- The shared `dashboard-data-table.tsx` component (server-rendered, URL-driven sort+paginate,
  mobile card view) — presentational + data-shape agnostic, no ERP-specific logic
- Two shared, reusable UI components consumed by Phase 2/3/4: `src/components/pilot-banner.tsx`
  (renders the "ข้อมูลนำร่อง" pilot banner, SPEC AC16) and `src/components/degrade-banner.tsx`
  (renders the "ข้อมูลอาจไม่ล่าสุด" degrade banner, consuming `erpDegradeState()`'s output — SPEC
  AC15's UI half). Both are presentational, data-shape agnostic, and exported for later phases to
  import rather than re-author.
- `src/app/nav-links.tsx` "แดชบอร์ด" nav group with all 3 links (routes may 404 until Phase 2/3/4
  land their pages — that is expected and acceptable for this phase's exit gate)
- ~24 ported `assertReadOnlySql` guard test cases + boot permission probe (mock/fixture mode)
- `auth-guard-coverage.test.ts` entry for `/api/health/erp` (Phase 1's own route only)

**Out of scope (belongs to later phases):**
- Any Sales/Purchase/Production business-logic queries, pages, or fixture tables (Phase 2/3/4)
- CSV export, money-visibility cross-dashboard audit, live reconcile script (Phase 5)
- Adopting the real scoped read-only ERP login against db_TCL (AC18 — Agent-Probe, requires the
  DBA-provisioned login from `db/create-erp-readonly-login.sql`, which is a USER-RUN delivery step
  never executed by this phase)
- Recharts or any charting library decision (Phase 2's INNOVATE-step spike)

---

## Key Design Decisions

### D1 — Separate `mssql.ConnectionPool`, reusing the already-installed `mssql` package

`mssql@^12.2.0` is **already a dependency** (`package.json` line 18 — pulled in transitively by
`@prisma/adapter-mssql`). Phase 1 does **not** add a new dependency; it imports `mssql` directly
and constructs a second, independent `ConnectionPool` singleton — completely separate from
Prisma's `PrismaMssql` adapter pool. `next.config.ts`'s `serverExternalPackages: ["mssql",
"tedious"]` already covers it; no `next.config.ts` change needed.

### D2 — `ERP_DATABASE_URL` env var + `resolveErpDatabaseUrl()` raw-read resolver

Mirrors `src/lib/resolve-database-url.ts` exactly (same `$`-in-password dotenv-expand gotcha, same
raw-read-then-fallback-to-`process.env` contract, same "never log the resolved value" rule), but
keyed on `ERP_DATABASE_URL` instead of `DATABASE_URL`. Dev/sandbox value points at the SAME
`orderstock-sql` container, different **database name** (`erp_fixture`):
`sqlserver://localhost:1433;database=erp_fixture;user=sa;password=...;encrypt=true;trustServerCertificate=true`.
Production value (later, once the DBA delivery script runs) points at `db_TCL` with the scoped
read-only login — never `sa`, never `orderstock_app`.

### D3 — Guard layer ported from `TCL/server/src/erp/erp-adapter.ts`, English-language, orderstock-shaped

Port the proven pattern, not the file verbatim: same 5-layer defense-in-depth structure, English
comments and identifiers (source is Thai-commented for its own repo), and orderstock's own module
layout (`src/lib/erp/erp-adapter.ts` holds the guard + choke point; no NestJS DI, no `ErpSecret`
class — orderstock has no ERP write-credential concept, this is 100% read-only from day one).

- `assertReadOnlySql(sql: string): void` — throws `ReadOnlySqlViolationError` unless: (a) the
  trimmed, comment-stripped statement is non-empty, (b) it starts with `SELECT` or `WITH` (case-
  insensitive), (c) it contains no unescaped `;` before the very end (blocks stacked statements),
  (d) it contains none of the forbidden keywords as whole words (case-insensitive):
  `INSERT, UPDATE, DELETE, MERGE, TRUNCATE, DROP, ALTER, CREATE, GRANT, REVOKE, EXEC, EXECUTE,
  sp_executesql, xp_cmdshell, BULK, OPENROWSET, INTO, BACKUP, RESTORE, SHUTDOWN`.
- `guardedQuery<T>(pool, sql, params)` — the SINGLE choke point every ERP query must go through:
  calls `assertReadOnlySql(sql)` first, then executes via `mssql`'s parameterized `request().input(...)`
  API (never string-concatenated params).
- `ErpAdapter` interface with **zero write methods** — a compile-time no-write-method type guard
  (a TypeScript type-level assertion, e.g. `type _NoWriteMethods = AssertNever<Extract<keyof
  ErpAdapter, 'insert' | 'update' | 'delete' | 'write' | 'save' | 'upsert'>>`) so any future PR that
  accidentally adds a write-shaped method name fails the build.
- Boot permission probe (ported from `mssql.driver.ts`'s `PERMISSION_PROBE_SQL` pattern): on pool
  creation, run
  ```sql
  SELECT
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'INSERT')       AS can_insert,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'UPDATE')       AS can_update,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'DELETE')       AS can_delete,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER')        AS can_alter,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS can_create_table,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'SELECT')       AS can_select
  ```
  If any `can_*` (except `can_select`) is `1`, throw and refuse to start serving ERP reads (never
  silently downgrade). This is the SPEC AC18 mechanism — in this phase it is proven in **mock/fixture
  mode only** (the fixture DB's `sa`-backed dev connection legitimately has write perms, so the P1
  exit gate runs the probe against a **mocked** `HAS_PERMS_BY_NAME` result set, not the live fixture
  connection, to prove the refusal logic itself without needing a real scoped login yet). The
  live-mode pass against the real db_TCL scoped login is AC18's Agent-Probe row, owned by Phase 5.
- `ApplicationIntent=ReadOnly` set on the connection string/pool config as defense layer 5 (SQL
  Server routes read-intent connections to a readable secondary when available; on a
  non-AG/non-replicated server it is a documented no-op, which is fine — it's additive, never load-
  bearing alone).

### D4 — Cache: hand-rolled in-process TTL cache, NOT `unstable_cache`/`'use cache'`

`next.config.ts` has no `cacheComponents`/`dynamicIO` experimental flag set, so Next 16.2's
`'use cache'` directive is not available without an opt-in config change this phase does not make.
`unstable_cache` (from `next/cache`) is available but does not expose a clean "give me the last
successful value even though the fetcher just threw" read path — exactly the behavior AC15's
degrade path needs. Decision: `src/lib/erp/cache.ts` implements a small hand-rolled
`Map<key, { value, storedAt }>` TTL cache (~5 min, matching the approved proposal), guarded by the
same `globalThis`-singleton dev-hot-reload pattern as `src/lib/db.ts`, with two exported functions:
- `getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<{ value: T; stale: boolean }>`
  — returns fresh data (`stale: false`) on a live fetch; on fetcher failure, returns the last cached
  value with `stale: true` if one exists, or re-throws if the cache is empty.
- `clearErpCache()` — test-only helper to reset the module-level `Map` between Vitest cases.

Rejected alternative: `unstable_cache` — no last-known-good-on-error semantics; would require a
second parallel cache anyway to implement the degrade path, defeating the point of using it.

### D5 — Degrade path: `src/lib/erp/degrade.ts`

A small pure helper `erpDegradeState(result: { stale: boolean })` returning
`{ showBanner: boolean; bannerText: "ข้อมูลอาจไม่ล่าสุด" }` when `stale` is true. Dashboard pages
(Phase 2/3/4) call `getCached()` then pass its `stale` flag through this helper to decide whether to
render the banner. Phase 1 proves this mechanism end-to-end using `/api/health/erp` itself and a
minimal fixture read (see Exit Gate) — Phase 2/3/4 reuse the same two functions for their own data
fetches.

### D6 — Fixture DB scope decision (resolves an ownership tension in the registry)

The registry gives Phase 1 sole ownership of `db/erp-fixture/*.sql`, but Phases 2/3/4 will each need
their own domain fixture tables (Sales: `tbl_DOhdr`/`tbl_Dodtl`; Purchase: `PurchaseInvoiceHdr`/
`PurchaseOrderHdr`/`InventoryFlowDtl`; Production: `tbl_MoHdr`/`tbl_BatchOrder`/`InventoryFlowDtl`).
Phase 1 does **not** attempt to pre-build all of that (it would require Phase 1 to correctly encode
Phase 2/3/4's own data-dictionary decisions, which is out of Phase 1's scope and knowledge).

**Decision:** Phase 1 creates the `erp_fixture` database itself plus exactly ONE minimal shared
table needed for its own guard/health/cache/data-table proof: `dbo.InventoryItem` (a small subset
of real columns — `ItemCode`, `Description`, `MainUnits`, `ItemGRP` — seeded with ~10 rows), which
is a table every later phase also needs (it's the universal FG/RM lookup joined by all three
domains per the data dictionary). Phase 1's own exit-gate tests (guard cases, health check, cache/
degrade, data-table sort/paginate) run against this one table.

`registry_change_requests`: already reflected in the registry — `phase-blast-radius-registry.md`'s
Phase 1 section already contains this split (dated 18-09-26, same day as this plan): Phase 1 owns
`db/erp-fixture/*.sql` (shared/base tables only) while `db/erp-fixture/{sales,purchase,production}/*.sql`
(domain-specific fixture tables) is reserved for the matching Phase 2/3/4. This plan's own checklist
only touches the base-table file(s); it does not touch or reserve the domain subfolders.

---

## Blast Radius

Stays entirely inside the OWNED PATHS granted to this phase in the registry, plus the explicitly-
permitted shared-file appends:

**Created (new files):**
- `src/lib/erp/erp-adapter.ts`
- `src/lib/erp/pool.ts`
- `src/lib/erp/resolve-erp-database-url.ts`
- `src/lib/erp/cache.ts`
- `src/lib/erp/degrade.ts`
- `src/app/api/health/erp/route.ts`
- `src/lib/__tests__/erp-adapter.test.ts`
- `src/lib/__tests__/resolve-erp-database-url.test.ts` (mirrors the existing
  `resolve-database-url.test.ts` pattern — not separately listed in OWNED PATHS but is a same-
  concern test file colocated with `resolve-erp-database-url.ts`, which IS owned; no other phase
  touches it)
- `src/lib/__tests__/erp-cache-degrade.test.ts` (covers D4/D5 — same rationale as above)
- `src/components/dashboard-data-table.tsx`
- `src/components/pilot-banner.tsx` (SPEC AC16 pilot banner — reusable, imported by Phase 2/3/4)
- `src/components/degrade-banner.tsx` (SPEC AC15 UI half — reusable, imported by Phase 2/3/4)
- `db/erp-fixture/00-schema.sql` (creates `erp_fixture` DB if absent + `dbo.InventoryItem` table)
- `db/erp-fixture/01-seed.sql` (idempotent seed, ~10 rows)
- `e2e/dashboards-nav-visibility.spec.ts` (proves AC1's infra half: nav renders 3 links, phone tab
  bar unchanged — the full AC1 e2e scenario per dashboard is completed once Phase 2/3/4 land real
  pages, but the nav-shell assertion itself is Phase 1's to prove now)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_REPORT_22-09-26.md`
  (this is now the sole report; the original 18-09-26 EXECUTE-time report was folded into its
  Appendix and deleted at UPDATE PROCESS, 22-09-26)

**Edited (existing files, append-only per registry rule):**
- `src/app/nav-links.tsx` — add the entire "แดชบอร์ด" group (all 3 links) in one pass
- `src/lib/__tests__/auth-guard-coverage.test.ts` — append `/api/health/erp` entry only
- `.env.example` — add `ERP_DATABASE_URL=` placeholder line (mirrors existing `DATABASE_URL=`
  placeholder; never touches real `.env`)
- `docker-compose.yml` — no service change needed (same container); note only if a second DB
  requires no compose edit (SQL Server supports multiple databases per instance — confirmed, see
  Step A2)
- `playwright.config.ts` — broaden the `mobile` project's `testMatch` (currently
  `/mobile\.spec\.ts/` only) to also match the new `e2e/dashboards-nav-visibility.spec.ts`, so the
  file actually runs under the `mobile` (390×844) project — otherwise Step F1/G3's "mobile project
  asserts still 3 tabs" gate silently executes zero tests. Minimal one-line regex/array edit only;
  no other project's `testMatch`/`testIgnore` changes.
- `process/context/database/all-database.md` — APPEND a new "ERP Read Layer (erp-dashboards P1)"
  section; does not touch Phase 0's correction lines
- `process/context/tests/all-tests.md` — APPEND a new "ERP fixture/guard testing" section; does not
  touch Phase 0's correction lines
- `process/context/all-context.md` — update ONLY this phase's status line inside the
  erp-dashboards feature entry Phase 0 created; does not restructure that entry
- `src/lib/erp/pool.ts` — supplement (22-09-26): add `ERP_ALLOW_WRITE_CAPABLE_LOGIN` opt-in
  read + warn-instead-of-throw path; append-only logic addition, production fail-closed behavior
  unchanged when the switch is absent
- `src/lib/erp/erp-adapter.ts` — supplement (22-09-26), CONDITIONAL: edited only if
  `verifyReadOnlyBoot`'s return/throw shape must change to support the warn path (Step H2);
  preferred design keeps this file's existing throw-only contract unchanged
- `src/app/api/health/erp/route.ts` — supplement (22-09-26): append `readOnlyLogin`/`warning`
  fields to the JSON response, additive only
- `src/lib/__tests__/erp-adapter.test.ts` / `src/lib/__tests__/erp-cache-degrade.test.ts` / new
  `src/lib/__tests__/erp-pool-write-capable-switch.test.ts` — supplement (22-09-26): new
  Fully-Automated test cases per Step H5

**Never touched by this phase:** anything under `src/app/(main)/dashboards/**`,
`db/erp-queries/**`, `package.json`, `prisma/schema.prisma`, any Sales/Purchase/Production-named
file, `bottom-tab-bar.tsx`, `db/create-database-and-login.sql`, `db/create-erp-readonly-login.sql`.

---

## Touchpoints

| File | Create/Edit | Notes |
|---|---|---|
| `src/lib/erp/erp-adapter.ts` | Create | Guard (`assertReadOnlySql`), `guardedQuery`, `ErpAdapter` type, no-write compile guard, boot probe SQL/logic |
| `src/lib/erp/pool.ts` | Create | `mssql.ConnectionPool` singleton, `globalThis` dev-hot-reload guard (mirrors `db.ts`) |
| `src/lib/erp/resolve-erp-database-url.ts` | Create | Mirrors `resolve-database-url.ts`, keyed `ERP_DATABASE_URL` |
| `src/lib/erp/cache.ts` | Create | `getCached`, `clearErpCache` — hand-rolled TTL Map |
| `src/lib/erp/degrade.ts` | Create | `erpDegradeState()` pure helper |
| `src/app/api/health/erp/route.ts` | Create | `GET` — `{ ok, latencyMs?, error? }`, never throws 500 to the client |
| `src/lib/__tests__/erp-adapter.test.ts` | Create | ~24 ported guard cases + boot-probe refusal case |
| `src/lib/__tests__/resolve-erp-database-url.test.ts` | Create | Mirrors `resolve-database-url.test.ts` |
| `src/lib/__tests__/erp-cache-degrade.test.ts` | Create | Cache TTL + stale-fallback + degrade banner logic |
| `src/components/dashboard-data-table.tsx` | Create | Server-rendered sort+paginate table + mobile card view, data-shape agnostic (generic `columns`/`rows` props) |
| `src/components/pilot-banner.tsx` | Create | Renders "ข้อมูลนำร่อง" pilot banner (SPEC AC16), reusable, no props needed beyond optional className |
| `src/components/degrade-banner.tsx` | Create | Renders "ข้อมูลอาจไม่ล่าสุด" banner from `erpDegradeState()` output (SPEC AC15 UI half), reusable |
| `db/erp-fixture/00-schema.sql` | Create | `erp_fixture` DB + `dbo.InventoryItem` (idempotent `IF NOT EXISTS`) |
| `db/erp-fixture/01-seed.sql` | Create | Idempotent seed rows |
| `e2e/dashboards-nav-visibility.spec.ts` | Create | Nav-shell assertion (AC1 infra half) |
| `playwright.config.ts` | Edit | Broaden `mobile` project's `testMatch` to also cover `e2e/dashboards-nav-visibility.spec.ts` (otherwise the mobile-tab-bar gate in F1/G3 runs zero tests) |
| `src/app/nav-links.tsx` | Edit | Add "แดชบอร์ด" group, 3 links, ADMIN+STAFF (no `adminOnly`) |
| `src/lib/__tests__/auth-guard-coverage.test.ts` | Edit | Append `/api/health/erp` route entry |
| `.env.example` | Edit | Add `ERP_DATABASE_URL=` placeholder |
| `process/context/database/all-database.md` | Edit | Append ERP read-layer section |
| `process/context/tests/all-tests.md` | Edit | Append ERP fixture/guard testing section |
| `process/context/all-context.md` | Edit | Update this phase's status line only |
| `src/lib/erp/pool.ts` | Edit (supplement 22-09-26) | Add opt-in warn-instead-of-throw path; production fail-closed unchanged when absent |
| `src/lib/erp/erp-adapter.ts` | Edit (supplement 22-09-26, conditional) | Only if `verifyReadOnlyBoot`'s shape must change (Step H2) — prefer no change |
| `src/app/api/health/erp/route.ts` | Edit (supplement 22-09-26) | Append `readOnlyLogin`/`warning` fields, additive |
| `src/lib/__tests__/erp-adapter.test.ts` / `erp-cache-degrade.test.ts` / new `erp-pool-write-capable-switch.test.ts` | Edit/Create (supplement 22-09-26) | 4 new Fully-Automated cases per Step H5 |
| env-file placeholder doc | Edit (supplement 22-09-26) | Commented-out opt-in placeholder line documenting the exception |
| `process/context/database/all-database.md` | Edit (supplement 22-09-26) | Append Charter Exception Record subsection |

---

## Public Contracts

- No existing route, server action, schema model, or component prop signature changes.
- `requireAuth()` signature is unchanged (this phase does not gate any page yet — `/api/health/erp`
  is intentionally public like `/api/health`, matching the existing convention: check
  `src/app/api/health/route.ts` — confirm during Step A5 whether it calls `requireAuth()`; if it
  does not, `/api/health/erp` follows the same unauthenticated-health-check precedent).
- `dashboard-data-table.tsx` is a NEW component — its prop contract (`columns`, `rows`,
  `sortParam`, `pageParam`, `pageSize`, mobile-card render props) is defined by this phase and
  becomes a contract Phase 2/3/4 depend on; changing it after this phase closes is a breaking
  change to those phases.
- `pilot-banner.tsx` and `degrade-banner.tsx` are also NEW components whose export shape (a
  renderable component each, `degrade-banner.tsx` accepting the `erpDegradeState()` output shape)
  becomes a contract Phase 2/3/4 import directly — "reused"/"imported, not re-authored" as those
  phase plans already describe. Changing either signature after this phase closes is a breaking
  change to those phases.
- `nav-links.tsx`'s 3 new links point at `/dashboards/sales`, `/dashboards/purchase`,
  `/dashboards/production` — these routes 404 until Phase 2/3/4 land pages; this is a known,
  accepted, temporary state for this phase's exit gate (not a bug).

---

## Implementation Checklist

### Step A — Research + confirm exact patterns before writing code

- [ ] A1. Read `src/lib/db.ts` and `src/lib/resolve-database-url.ts` in full (already read during
      planning — confirm no drift since 18-09-26) to lock the exact singleton + raw-read pattern
      to mirror.
- [ ] A2. Confirm SQL Server supports multiple databases per instance without a `docker-compose.yml`
      change (it does — `CREATE DATABASE erp_fixture` runs against the same `orderstock-sql`
      container/instance; only a schema/seed SQL file is needed, no compose edit). Record this
      confirmation in the phase report.
    - `Failing stub:` `test("should confirm no compose change needed for a second DB", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: multi-database-single-instance confirmation") })` (Hybrid tier — manual/doc confirmation, not a real automated assertion; recorded here only to satisfy the stub-format convention, tier is Hybrid not Fully-Automated).
- [ ] A3. Read `/Users/innovera/Documents/TCL/server/src/erp/erp-adapter.ts` (lines ~380-455,
      `FORBIDDEN_KEYWORDS` + `assertReadOnlySql`) and
      `/Users/innovera/Documents/TCL/server/src/erp/drivers/mssql.driver.ts` (`PERMISSION_PROBE_SQL`
      block, ~lines 565-742) as READ-ONLY reference. Do not import or copy-paste Thai comments;
      port the logic and structure only, re-commented in English for this repo.
- [ ] A4. Read `src/app/(main)/admin/users/users-mobile.tsx` in full to confirm the exact
      responsive card-list pattern `dashboard-data-table.tsx`'s mobile branch must match (breakpoint,
      card structure, `md:hidden`/`hidden md:block` class pairing).
- [ ] A5. Read `src/app/api/health/route.ts` in full to confirm whether it calls `requireAuth()` —
      lock whether `/api/health/erp` should match (unauthenticated) or diverge (if the existing
      health route is already guarded, mirror that instead of assuming).
- [ ] A6. Read `src/components/ui/card.tsx` and `src/components/ui/chip.tsx` (already read during
      planning) to confirm `dashboard-data-table.tsx` reuses these primitives for row-status chips
      (e.g. a generic status column) rather than inventing new styling.

### Step B — `src/lib/erp/*` guard + pool + resolver

- [ ] B1. Create `src/lib/erp/resolve-erp-database-url.ts`: copy the exact contract of
      `resolve-database-url.ts` (raw-read `.env`, first `^ERP_DATABASE_URL=` line, strip one quote
      pair, fallback to `process.env.ERP_DATABASE_URL`, throw a clear error if neither yields a
      value, never log the resolved value). Export `resolveErpDatabaseUrl(envPath?: string): string`.
- [ ] B2. Create `src/lib/erp/erp-adapter.ts`:
      - `export class ReadOnlySqlViolationError extends Error` with a `code` field
        (`'EMPTY_STATEMENT' | 'NOT_SELECT_OR_WITH' | 'MULTIPLE_STATEMENTS' | 'FORBIDDEN_KEYWORD'`).
      - `export function assertReadOnlySql(sql: string): void` — port the normalize → must-start-
        with-SELECT/WITH → no-mid-statement-semicolon → forbidden-keyword-scan logic verbatim in
        structure (see D3 above for the exact keyword list and rules).
      - `export interface ErpQueryParams { [key: string]: string | number | boolean | Date | null }`
      - `export async function guardedQuery<T>(pool: ConnectionPool, sql: string, params?: ErpQueryParams): Promise<T[]>` —
        calls `assertReadOnlySql(sql)`, builds a parameterized `mssql` request (`request.input(key, value)`
        for each param key, never string concatenation), returns `result.recordset`.
      - A compile-time no-write-method type guard: `type _AssertNoWriteMethods<T> = T extends
        Record<'insert' | 'update' | 'delete' | 'write' | 'save' | 'upsert', unknown> ? never : T;`
        applied to an exported `ErpAdapter` marker interface (kept intentionally empty/minimal in
        this phase — Phase 2/3/4 do not extend it with new methods, they call `guardedQuery`
        directly with their own SQL files).
      - `export async function verifyReadOnlyBoot(pool: ConnectionPool): Promise<void>` — runs the
        `HAS_PERMS_BY_NAME` probe SQL via `pool.request().query(...)` (NOT via `guardedQuery`, since
        this one query is infrastructure, not domain data — still SELECT-only itself), throws a
        clear English error naming which permission(s) are granted if any `can_insert/update/
        delete/alter/create_table` is `1`.
- [ ] B3. Create `src/lib/erp/pool.ts`: `import { ConnectionPool } from "mssql"`; build the
      connection config from `resolveErpDatabaseUrl()` (parse the `sqlserver://` JDBC-style string
      into `mssql`'s config shape — reuse or adapt the same parsing `@prisma/adapter-mssql` relies
      on; if `mssql`'s own `ConnectionPool` cannot accept a JDBC-style URL string directly, write a
      small internal parser converting `sqlserver://host:port;database=X;user=Y;password=Z;...` into
      `{ server, port, database, user, password, options: { encrypt, trustServerCertificate } }` —
      confirm exact accepted shape against `mssql`'s installed type defs during Step B3 itself, not
      assumed here). Export a module-level singleton `erpPool` behind the same
      `globalThis`-cache-in-non-production pattern as `db.ts`. Set
      `options.ApplicationIntent = "ReadOnly"` in the pool config (D3, layer 5). Call
      `verifyReadOnlyBoot(erpPool)` once at pool-creation time in production; in
      development/test, gate this behind an env flag (e.g. skip when `NODE_ENV !== "production"`
      AND no explicit `ERP_VERIFY_BOOT_PROBE=1` is set) so the sandbox's inherently write-capable
      `sa`-backed fixture connection does not block local dev — Step E covers the MOCKED version of
      this same probe logic for the automated test gate.
- [ ] B4. Create `src/lib/erp/cache.ts` per D4: `getCached<T>(key, ttlMs, fetcher)` and
      `clearErpCache()`, backed by a `globalThis`-guarded module-level `Map`.
- [ ] B5. Create `src/lib/erp/degrade.ts` per D5: `erpDegradeState({ stale }): { showBanner: boolean; bannerText: string }`.

### Step C — Fixture database

- [ ] C1. Create `db/erp-fixture/00-schema.sql`: idempotent `IF NOT EXISTS (SELECT * FROM
      sys.databases WHERE name = 'erp_fixture') CREATE DATABASE erp_fixture;` followed by
      `USE erp_fixture;` and an idempotent `IF NOT EXISTS (... sys.tables ...) CREATE TABLE
      dbo.InventoryItem (ItemCode NVARCHAR(50) NOT NULL PRIMARY KEY, Description NVARCHAR(200) NULL,
      MainUnits NVARCHAR(20) NULL, ItemGRP CHAR(1) NULL);` (column shapes per the confirmed data
      dictionary — `ItemGRP='F'` for finished goods, matching the residual-finding's confirmed
      pattern).
- [ ] C2. Create `db/erp-fixture/01-seed.sql`: idempotent seed (`MERGE` is a write statement so this
      script itself is NOT subject to the app's read-only guard — it's a setup script run directly
      against the sandbox by a human/CI step, never through `guardedQuery`) inserting ~10
      `InventoryItem` rows covering both `ItemGRP='F'` and a non-`'F'` value, and at least one row
      with a `NULL` `MainUnits` (edge case per the "35 distinct units, never sum across units"
      constraint — Phase 1's own tests don't sum anything, but future phases' fixture rows should
      follow this same null-safety precedent).
- [ ] C3. Document the manual/CI step to apply these scripts against the sandbox
      (`sqlcmd`/equivalent — reuse whatever mechanism `prisma/seed.ts` or the sandbox setup docs
      already use for the `orderstock` DB; do NOT invent a new mechanism) in the phase report.
      **USER-RUN note:** running `00-schema.sql`/`01-seed.sql` against the LOCAL sandbox container is
      normal, agent-runnable dev/test setup (it is a disposable dev fixture, not db_TCL) — this is
      NOT a db_TCL delivery script and is not subject to the DBA-only restriction.

### Step D — Health route, cache/degrade wiring, shared data-table

- [ ] D1. Create `src/app/api/health/erp/route.ts`: `GET` handler that calls `getCached("erp-health",
      5 * 60_000, () => guardedQuery(erpPool, "SELECT 1 AS ok"))`, returns
      `{ ok: true, latencyMs, stale }` on success/stale-fallback, `{ ok: false, error: "..." }` (HTTP
      200, never 500 — matches AC15's "never a blank/error page" spirit at the API layer too) if the
      cache is empty AND the fetch fails.
- [ ] D2. Create `src/components/dashboard-data-table.tsx`: server component, props
      `{ columns: {key, label, sortable?}[], rows: Record<string, ReactNode>[], sortParam: string,
      pageParam: string, currentSort?, currentPage, pageSize, totalRows }`; renders a `<table>` with
      `card.tsx`-styled wrapper on desktop, a card-list on mobile (`md:hidden`/`hidden md:block`
      pairing per A4's confirmed pattern), sort links that toggle `?sort=` in the URL, page links
      that update `?page=`, preserving all OTHER existing searchParams (spread the incoming
      `searchParams` object, only override `sort`/`page` keys) — this exact "preserve other filters"
      behavior is what AC12 requires from every consumer.
- [ ] D2b. Create `src/components/pilot-banner.tsx`: a small presentational server component
      rendering a fixed Thai pilot notice — "ข้อมูลนำร่อง" (SPEC AC16) — styled via existing
      `card.tsx`/`chip.tsx` tokens (no new CSS tokens). Exported for Phase 2/3/4 to import and
      render at the top of each dashboard page; this phase itself has no dashboard page to render
      it on yet (proven only via a direct render-snapshot/unit test — see Step E/Test Plan).
- [ ] D2c. Create `src/components/degrade-banner.tsx`: a small presentational server component
      taking the `erpDegradeState()` return shape (`{ showBanner, bannerText }`) as props and
      rendering the "ข้อมูลอาจไม่ล่าสุด" banner when `showBanner` is true, else rendering nothing.
      Exported for Phase 2/3/4 to import directly rather than re-deriving the same markup.
- [ ] D3. Add the "แดชบอร์ด" nav group to `src/app/nav-links.tsx`'s `GROUPS` array (both ADMIN and
      STAFF — no `adminOnly` flag, matching SPEC AC1's "Staff or Admin" wording) with 3 items:
      `{ href: "/dashboards/sales", label: "ยอดขาย", icon: ... }`,
      `{ href: "/dashboards/purchase", label: "การจัดซื้อ", icon: ... }`,
      `{ href: "/dashboards/production", label: "การผลิต", icon: ... }` (pick `lucide-react` icons
      already imported elsewhere in the app where sensible, e.g. reuse `BarChart3` for one, add new
      icon imports for the others as needed — do not invent custom SVGs).
- [ ] D4. Confirm `bottom-tab-bar.tsx` is NOT touched (grep for any accidental edit before
      committing) — the hard safety constraint from the umbrella charter.

### Step E — Ported guard tests (~24 cases) + boot-probe mock test + cache/degrade tests

- [ ] E1. Create `src/lib/__tests__/erp-adapter.test.ts` porting the guard test matrix from the
      sibling project's forbidden-keyword list (D3) — one case per keyword (14 keywords ×
      straightforward positive-match case), plus: empty string, whitespace-only, comment-only,
      starts-with-`DECLARE`, starts-with-`EXEC`, multiple-statements-via-semicolon,
      trailing-semicolon-is-allowed (positive case), valid `SELECT` passes, valid `WITH` CTE passes,
      case-insensitivity check (`InSeRt`), keyword-as-substring-of-a-column-name does NOT
      false-positive (e.g. a column literally named `update_flag` inside an otherwise-valid SELECT
      — confirm this against the ported regex's word-boundary behavior; if the ported `\b` regex
      DOES false-positive on this, document it as an accepted known-gap in the validate-contract
      rather than silently weakening the denylist). Target ~24 cases total per the umbrella's
      commitment.
    - `Failing stub:` `test("should reject every forbidden keyword", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: assertReadOnlySql forbidden-keyword matrix") })`
- [ ] E2. Add a `guardedQuery` integration case using a mocked `mssql` `ConnectionPool`/`request()`
      (no real DB needed for this specific case) proving `guardedQuery` calls `assertReadOnlySql`
      BEFORE touching the pool (i.e. a forbidden statement never reaches `pool.request()`).
    - `Failing stub:` `test("should call assertReadOnlySql before executing against the pool", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: guardedQuery pre-execution guard ordering") })`
- [ ] E3. Add a `verifyReadOnlyBoot` case with a MOCKED query result (`can_insert: 1`, others `0`)
      proving it throws; a second case with all-`0`/`can_select: 1` proving it resolves cleanly.
      This is the Fully-Automated proof of the boot-probe REFUSAL LOGIC (mock mode) — distinct from
      Phase 5's Agent-Probe live-login row.
    - `Failing stub:` `test("should refuse boot when any write permission is granted", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: verifyReadOnlyBoot mocked refusal") })`
- [ ] E4. Create `src/lib/__tests__/resolve-erp-database-url.test.ts` mirroring
      `resolve-database-url.test.ts`'s existing cases exactly (`$`-in-password round-trip, quote
      stripping, fallback to `process.env`, throw-when-neither).
- [ ] E5. Create `src/lib/__tests__/erp-cache-degrade.test.ts`: fresh-fetch returns `stale: false`;
      fetcher throws with a prior cached value present returns that value with `stale: true`;
      fetcher throws with NO prior cached value re-throws; `erpDegradeState({stale: true})` returns
      `showBanner: true` with the exact Thai banner text; `erpDegradeState({stale: false})` returns
      `showBanner: false`.

### Step F — Nav + data-table e2e, auth-guard-coverage entry, docs

- [ ] F1. Create `e2e/dashboards-nav-visibility.spec.ts` (chromium project): logged-in user sees
      "แดชบอร์ด" group with 3 links in the sidebar; tablet-drawer variant renders the same group
      (reuse the `sidebar-drawer.spec.ts` open-drawer helper pattern if one exists — confirm during
      Step A); mobile project (390×844) asserts the bottom tab bar STILL shows exactly 3 tabs
      (mirrors `e2e/mobile.spec.ts`'s existing assertion — do not weaken or duplicate it, add a new
      assertion in the new dashboards spec file instead of editing `mobile.spec.ts`).
- [ ] F1b. Edit `playwright.config.ts`: broaden the `mobile` project's `testMatch` (currently only
      `/mobile\.spec\.ts/`) so it also matches `e2e/dashboards-nav-visibility.spec.ts` — without
      this, the new spec file never runs under the `mobile` project and F1/G3's mobile-tab-bar
      assertion silently executes zero tests. Do not touch the `chromium` or `tablet` projects'
      `testMatch`/`testIgnore` beyond what's needed for this one addition.
- [ ] F2. `src/lib/__tests__/auth-guard-coverage.test.ts` has NO existing check-shape for API
      route handlers (its `MODULES` array only asserts `requireAuth()` inside server-action
      modules — confirmed by direct read; `/api/health` itself is unenumerated there and calls no
      `requireAuth()`). Resolution (per the existing validate-contract's Execute-agent instruction
      E2, applies unless Step A5's fresh read finds `/api/health` guarded): do NOT force a
      mismatched `MODULES`-shaped entry into this file. Instead add one short, clearly-commented
      note directly above/near the `MODULES` array (or a minimal standalone `describe`/`it.todo`
      block) stating "`/api/health/erp`, like `/api/health`, is intentionally public — not subject
      to this file's action-guard coverage," and record the same rationale in the phase report and
      the `all-database.md` ERP Read Layer section (Step F3). If Step A5 instead finds
      `/api/health` IS guarded, route `/api/health/erp` the same way and design the coverage note
      to match that fresh finding.
- [ ] F3. Append a new "ERP Read Layer" section to `process/context/database/all-database.md`
      documenting: `erp_fixture` DB name/location, `ERP_DATABASE_URL` env var, the separate
      `mssql.ConnectionPool` singleton pattern, the guard choke point, and the hard safety
      constraints (never Prisma/`$queryRaw` for ERP, never add ERP models to
      `prisma/schema.prisma`). Do not edit Phase 0's correction lines elsewhere in the file.
- [ ] F4. Append a new "ERP fixture/guard testing" section to `process/context/tests/all-tests.md`
      documenting the ~24-case guard suite, the mock-mode boot-probe test, and the fixture-DB setup
      step from C3. Do not edit Phase 0's correction lines elsewhere in the file.
- [ ] F5. Update `process/context/all-context.md`'s erp-dashboards feature entry with this phase's
      status line only.
- [ ] F6. Add `ERP_DATABASE_URL=` to `.env.example` with a placeholder value (never a real value).

### Step G — Per-section test gates (run after each Step above, not batched to the end)

- [ ] G1. After Step B: `pnpm test src/lib/__tests__/resolve-erp-database-url.test.ts` green.
- [ ] G2. After Step C: manually apply `db/erp-fixture/00-schema.sql` + `01-seed.sql` against the
      running sandbox container; confirm `erp_fixture` DB + seeded rows exist via a throwaway
      `sqlcmd`/query (not committed as a test — this is the Hybrid-tier precondition check).
- [ ] G3. After Step D: `pnpm test:e2e --project=chromium e2e/dashboards-nav-visibility.spec.ts` and
      `pnpm test:e2e --project=mobile e2e/dashboards-nav-visibility.spec.ts` green.
- [ ] G4. After Step E: `pnpm test src/lib/__tests__/erp-adapter.test.ts
      src/lib/__tests__/erp-cache-degrade.test.ts` green, all ~24+ guard cases passing.
- [ ] G5. After Step F: `pnpm test src/lib/__tests__/auth-guard-coverage.test.ts` green.
- [ ] G6. Full regression: `pnpm test` and `pnpm lint` and `pnpm build` all green (build proves
      `serverExternalPackages` still correctly excludes `mssql`/`tedious` from bundling with the new
      `src/lib/erp/*` imports added).

### Step H — Opt-in write-capable-login switch (charter exception, supplement 2026-09-22)

USER DECISION (2026-09-22, explicit, recorded in full in `## Charter Exception Record` below): for
now the ERP dashboards may run on the EXISTING write-capable login (the app's own `sa` connection to
db_TCL) instead of waiting for the DBA-provisioned scoped read-only login. This must be implemented
as an EXPLICIT, off-by-default opt-in with loud, repeated visibility — never a silent relaxation.

- [x] H1. Edit `src/lib/erp/pool.ts`: read a new env var `ERP_ALLOW_WRITE_CAPABLE_LOGIN` (accept
      only the literal string `"1"`; any other value, including absent, is current fail-closed
      behavior in ALL environments including production — unchanged). Wrap the existing
      `verifyReadOnlyBoot(erpPool)` production call: when the probe finds any write permission AND
      `ERP_ALLOW_WRITE_CAPABLE_LOGIN === "1"`, do NOT throw — instead log ONCE per pool creation
      (never per query) a prominent, credential-free warning naming exactly which write
      permission(s) (`can_insert`/`can_update`/`can_delete`/`can_alter`/`can_create_table`) were
      found `= 1`, pointing at `db/create-erp-readonly-login.sql` as the remediation path. Export a
      new `erpReadOnlyLoginState` value/accessor (`{ readOnlyLogin: boolean; warning?: string }`),
      set once at pool-creation time, for `/api/health/erp` to read.
    - `Failing stub:` `test("should keep throwing when the opt-in switch is absent or not exactly \"1\"", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: opt-in-switch fail-closed-by-default") })`
- [x] H2. Edit `src/lib/erp/erp-adapter.ts` ONLY IF `verifyReadOnlyBoot`'s return/throw shape must
      change to support H1's non-throwing warn path. Prefer keeping `verifyReadOnlyBoot` itself
      unchanged (still returns the raw permission result / still throws its own error) and doing the
      catch-and-warn-instead-of-rethrow logic in `pool.ts`'s call site — this keeps Step E3's
      existing mocked-refusal/mocked-acceptance tests valid with zero edits to this file.
- [x] H3. Edit `src/app/api/health/erp/route.ts`: add `readOnlyLogin: boolean` and optional
      `warning: string` fields to the JSON response, sourced from H1's exported state. Never throw
      500; the existing `{ok, latencyMs?, error?}` shape is additive-only (new fields appended, no
      existing field renamed/removed).
- [x] H4. Edit the repo's example-env placeholder file: add a commented-out opt-in placeholder line
      directly below the existing database-URL placeholder, with a one-line comment stating it is
      an explicit, off-by-default, recorded exception (see `all-database.md`) and must never be set
      without re-confirming the exception. Never write a real value there.
- [x] H5. Create `src/lib/__tests__/erp-pool-write-capable-switch.test.ts` (preferred — keeps this
      supplement's tests isolated and easy to remove if the exception is later retired; editing
      `erp-adapter.test.ts`/`erp-cache-degrade.test.ts` in place is an acceptable fallback if pool.ts
      cannot be unit-tested standalone) with these Fully-Automated cases:
      - switch absent (or any value other than `"1"`, e.g. `"0"`, `"true"`, empty string) + mocked
        write-capable permission result → pool creation still throws (production behavior
        unchanged).
      - switch `= "1"` + mocked write-capable permission result → pool creation resolves (no
        throw); exactly ONE warning is logged (assert call count, not just presence) naming the
        specific write permission(s) found; `erpReadOnlyLoginState` (or equivalent) reports
        `readOnlyLogin: false` and a non-empty `warning` string.
      - switch `= "1"` + mocked read-only-only permission result (`can_select: 1`, all others `0`)
        → pool creation resolves, NO warning is logged, `readOnlyLogin: true`, `warning` is
        undefined/absent.
      - the warning string, when logged, is asserted to NOT contain any of: the resolved env var
        value, `password`, `pwd=`, `sqlserver://`, or any substring of the mocked connection
        config's password field — a credential-leak negative-assertion, not an eyeball check.
    - `Failing stub:` `test("should log exactly one credential-free warning naming the write permissions when the switch is on", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: opt-in warn path") })`
- [x] H6. Edit `process/context/database/all-database.md`'s "ERP Read Layer" section (appended by
      Step F3): append a subsection documenting the write-capable-login opt-in exception verbatim
      per `## Charter Exception Record` below (who/when/why/cost/exit-condition) so the exception is
      discoverable from context, not only from this plan file.

---

## Exit Gate

```bash
pnpm test src/lib/__tests__/erp-adapter.test.ts src/lib/__tests__/resolve-erp-database-url.test.ts src/lib/__tests__/erp-cache-degrade.test.ts src/lib/__tests__/auth-guard-coverage.test.ts
# Expected: all pass, ~24+ guard cases green

pnpm test:e2e --project=chromium e2e/dashboards-nav-visibility.spec.ts
pnpm test:e2e --project=mobile e2e/dashboards-nav-visibility.spec.ts
# Expected: nav group renders 3 links (desktop/tablet), phone tab bar still shows exactly 3 tabs

pnpm lint
pnpm build
# Expected: exit 0; mssql/tedious remain externalized, no bundling errors from src/lib/erp/*
```

- Guard tests green vs the ported `assertReadOnlySql` denylist (~24 cases)
- Boot permission probe (mock mode) refuses a write-capable simulated login; accepts a read-only one
- `/api/health/erp` live against the fixture DB (manually confirmed via `curl` during dev + covered
  by the cache/degrade unit tests)
- Degrade banner logic proven via unit test (fetcher-throws-with-stale-cache scenario)
- Nav renders all 3 dashboard links; phone tab bar unchanged at exactly 3 tabs
- `dashboard-data-table.tsx` renders, sorts, and paginates against a small in-memory fixture dataset
  (unit or component-level test — see Test Plan)
- All checklist items checked; phase report written to the report destination above

---

## Acceptance Criteria

- All ~24+ ported `assertReadOnlySql` guard test cases pass (Step E1-E3).
- `verifyReadOnlyBoot` mocked-refusal and mocked-acceptance cases both pass (Step E3).
- `/api/health/erp` responds `{ ok: true }` (or a stale-but-served response) against the local
  `erp_fixture` sandbox database (Step G2/D1).
- `erp-cache-degrade.test.ts` proves fresh/stale/empty-cache behavior and the exact
  "ข้อมูลอาจไม่ล่าสุด" banner mapping (Step E5).
- `dashboard-data-table.tsx` sorts, paginates, and preserves other URL searchParams against a
  synthetic fixture dataset, with a mobile card-list fallback matching `users-mobile.tsx`'s
  existing pattern (Step D2).
- `src/app/nav-links.tsx` renders all 3 "แดชบอร์ด" links for both ADMIN and STAFF roles; the phone
  bottom tab bar still shows exactly its existing 3 tabs (Step D3-D4, F1).
- `pnpm test`, `pnpm lint`, and `pnpm build` all exit 0 with `src/lib/erp/*` in place and
  `mssql`/`tedious` still correctly externalized (Step G6).
- No file outside this phase's Blast Radius section was created or modified.
- Opt-in switch absent (or any non-`"1"` value) + a mocked write-capable permission result → pool
  creation still throws and refuses to start, in every environment including a simulated
  production `NODE_ENV`, proving the exception is opt-in only and existing fail-closed behavior is
  unchanged (Step H5, case 1).
- Opt-in switch `= "1"` + a mocked write-capable permission result → pool creation resolves,
  exactly ONE credential-free warning is logged naming the specific write permission(s) found, and
  `/api/health/erp` (or the equivalent state export) reports `readOnlyLogin: false` (Step H5,
  case 2; Step H3).
- Opt-in switch `= "1"` + a mocked read-only-only permission result → pool creation resolves with
  NO warning logged and `readOnlyLogin: true` (Step H5, case 3).
- The logged warning never contains a credential, connection string fragment, or password
  substring, proven by a negative assertion, not a manual eyeball check (Step H5, case 4).

## Phase Completion Rules

- This phase is **🔨 CODE DONE** once all Implementation Checklist items (Steps A-F) are checked
  and the per-section test gates (Step G) are green — this alone is NOT sufficient to call the
  phase VERIFIED.
- This phase is **✅ VERIFIED** only once: (a) CODE DONE holds, (b) the Exit Gate commands all pass
  on a clean run, (c) the validate-contract below is written and its gates are green (PVL Step 4),
  and (d) the EVL confirmation run (Step 6) independently re-confirms every gate — execute-agent's
  own internal iterate-until-green loop does not substitute for the EVL re-run.
- AC18's live-login half is explicitly OUT of this phase's completion bar (see Missing Test Areas)
  — Phase 1 completing does not require or claim the real db_TCL scoped login exists yet.
- If any Exit Gate command fails after Steps A-F are checked, the phase stays 🧪 TESTING, not
  🔨 CODE DONE — do not advance the Program Status Table entry past what evidence supports.

---

## Blockers That Would Justify BLOCKED Status

- Phase 0's context-doc corrections are not actually merged (this phase's context-doc appends would
  land on top of stale/incorrect claims)
- `mssql`'s installed type definitions cannot accept a JDBC-style `sqlserver://` connection string
  in any documented config shape, AND no lightweight parser can be written within this phase's
  scope (would require researching/writing a URL parser as a larger unplanned sub-task — if this
  happens, route to a PLAN-SUPPLEMENT rather than inventing an ad hoc parser under time pressure)
- The sandbox container cannot host a second database (`erp_fixture`) alongside `orderstock` for a
  concrete, verified reason (unexpected licensing/edition limit) — Step A2 exists specifically to
  rule this out early

---

## Test Plan (per `vc-test-coverage-plan` waterfall)

### Area: `src/lib/erp/erp-adapter.ts` (guard + choke point)

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | Forbidden-keyword matrix (~14 keywords) + statement-shape cases (empty, comment-only, non-SELECT start, multi-statement, case-insensitivity, word-boundary false-positive check) | `pnpm test src/lib/__tests__/erp-adapter.test.ts` | The denylist rejects every documented dangerous SQL shape | Nothing about a real SQL Server connection or real ERP permissions |
| Fully-Automated | `guardedQuery` calls the guard before touching the pool (mocked pool) | Same file, mocked `ConnectionPool` | Guard ordering is structurally enforced, not just advisory | Real network round-trip behavior |
| Fully-Automated | `verifyReadOnlyBoot` mocked refusal / mocked acceptance | Same file | The refusal LOGIC is correct given a permission result set | Whether the REAL scoped login (once provisioned) actually returns the expected result set — that is AC18's Agent-Probe (Phase 5) |
| Hybrid | `/api/health/erp` returns `{ok:true}` against the live fixture DB | `curl localhost:3000/api/health/erp` after `pnpm dev` + fixture DB applied — precondition: sandbox container running, fixture DB seeded | The real pool/resolver/guard chain works end-to-end against a real (fixture) SQL Server | Behavior against the real db_TCL server or the real scoped login |
| Known-Gap | Live boot-probe refusal against the real db_TCL scoped login | — | — | Requires the DBA-provisioned login (Phase 0 delivery script, run by the DBA) — this IS SPEC AC18's already-declared Agent-Probe residual, owned by Phase 5, not a new gap introduced here |

### Area: `src/lib/erp/cache.ts` + `src/lib/erp/degrade.ts`

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | Fresh fetch, stale-fallback-on-error, empty-cache-rethrow, banner text/flag mapping | `pnpm test src/lib/__tests__/erp-cache-degrade.test.ts` | The exact degrade contract Phase 2/3/4 will reuse | Real ERP downtime timing/latency behavior |
| Agent-Probe | Visual confirmation the "ข้อมูลอาจไม่ล่าสุด" banner is legible/placed sensibly once a real dashboard page exists | Manual scan during Phase 2/3/4's own e2e work (not this phase — Phase 1 has no page to render it on yet) | — | This phase defers the visual check; documented as a forward dependency, not a gap in Phase 1 itself |

### Area: `src/components/dashboard-data-table.tsx`

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | Sort toggles `?sort=`, page toggles `?page=`, other searchParams preserved, mobile breakpoint renders card list instead of table | `pnpm test src/lib/__tests__/dashboard-data-table.test.tsx` (component test against a small fixture `columns`/`rows` array — add this file during Step D2; not separately listed above because it's implied by "create the component," listed here for completeness) | The shared contract Phase 2/3/4 depend on works against synthetic data | Behavior against real ERP-shaped data volumes (Phase 2/3/4's own tables) |

### Area: nav / phone tab bar (AC1 infra half)

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | 3 links render in sidebar/drawer; phone tab bar still exactly 3 tabs | `pnpm test:e2e --project=chromium\|mobile e2e/dashboards-nav-visibility.spec.ts` | Nav shell change is correct and non-regressive | Whether the linked dashboard PAGES themselves render correctly — that's AC1's per-dashboard half, proven in Phase 2/3/4 |

### REQ-TEST-LINK (SPEC criteria this phase proves, partially or fully)

| SPEC AC | proven by | strategy | Coverage in this phase |
|---|---|---|---|
| AC1 (nav visibility) | `dashboards-nav-visibility` scenario | Fully-Automated | Infra half only — routes exist but 404 until P2/3/4 land pages; full AC1 proof completes in P2/3/4 |
| AC9 (money hidden server-side) | n/a in this phase | n/a | Not testable yet — no money-bearing page exists; Phase 5 owns the cross-dashboard audit |
| AC12 (sort/paginate without losing filters) | `dashboard-data-table` component test | Fully-Automated | Shared-component contract proven against synthetic data; per-dashboard proof in P2/3/4 |
| AC13 (mobile card view) | `dashboard-data-table` component test + `dashboards-nav-visibility` mobile-project run | Fully-Automated | Shared-component contract proven; per-dashboard proof in P2/3/4 |
| AC15 (degrade banner on ERP-down) | `erp-cache-degrade` unit scenario | Fully-Automated | Mechanism proven; visual placement proof deferred to P2/3/4's own pages |
| AC17 (no write statement can ever reach the ERP) | `erp-adapter` guard matrix | Fully-Automated | Fully proven — this IS the guard layer itself |
| AC18 (real scoped read-only login boot probe) | `verifyReadOnlyBoot` mocked cases (this phase) + live-login boot probe (Phase 5) | Fully-Automated (mock logic) / Agent-Probe (live login, Phase 5) | Refusal LOGIC proven now; live credential proof is Phase 5's declared residual per SPEC |

### Missing Test Areas

| Area | Why untestable in this phase | Resolution chosen |
|---|---|---|
| Real db_TCL scoped read-only login permission check | Login does not exist yet — Phase 0's delivery script is USER-RUN by the DBA, not executed by any agent | Deferred to Phase 5 (AC18 Agent-Probe row, already declared in SPEC as the justified residual) |
| `mssql` JDBC-URL-to-config parsing against a REAL non-fixture host (TLS cert edge cases on the customer's actual SQL Server version) | No access to a customer-representative server in dev | Backlog note if Phase 5's live reconcile step surfaces a real parsing edge case; not expected to block this phase |

---

## Test Infra Improvement Notes

- Confirm whether the repo has (or needs) a documented `pnpm db:seed:erp-fixture`-style script
  analogous to `pnpm tsx prisma/seed.ts` for applying `db/erp-fixture/*.sql` — if `all-tests.md`'s
  routing chain reveals an existing sqlcmd-invocation convention for the sandbox, reuse it verbatim
  in Step C3 rather than inventing a new invocation style.
- `dashboard-data-table.tsx`'s component test (`dashboard-data-table.test.tsx`) is the first
  component-level (non-e2e, non-page) test in this codebase for a shared UI primitive introduced by
  this program — confirm during Step A whether Vitest + Testing Library (or an equivalent lightweight
  render harness) is already configured, or whether this phase needs to add the minimal render-test
  setup. If setup is needed, keep it minimal (no new heavy test-framework dependency) and document
  the choice in the phase report.

---

## DB-Safety Notes

- `erp_fixture` lives in the SAME disposable sandbox container (`orderstock-sql`) as the existing
  `orderstock` Prisma DB — it is equally disposable and never touches db_TCL.
- No script in this phase's blast radius ever runs against db_TCL. `db/create-erp-readonly-login.sql`
  (Phase 0's artifact) is explicitly out of this phase's scope to run or modify.
- `ApplicationIntent=ReadOnly` and the boot permission probe are defense-in-depth on top of the
  application-level `assertReadOnlySql` guard — neither replaces the eventual DBA-provisioned scoped
  login (AC18); this phase never claims AC18 is fully satisfied, only that its refusal logic is
  correct in mock mode.

---

## Charter Exception Record — write-capable-login opt-in (supplement, 2026-09-22)

- **What:** an explicit, off-by-default opt-in that lets the ERP dashboards' guarded read pool run
  on the EXISTING write-capable login (the app's own `sa` connection to db_TCL) instead of waiting
  for the DBA-provisioned scoped read-only login from `db/create-erp-readonly-login.sql`.
- **Approved by:** the user (repo owner), in-session, 2026-09-22.
- **Why:** unblocks Phase 1-onward ERP dashboard delivery without waiting on a DBA-run, USER-RUN
  delivery script whose timeline this program does not control. The user's standing rule
  ("ดึงมาเท่านั้น ห้ามเขียนกลับ" — read only, never write back) is explicitly preserved: this
  exception relaxes WHICH LOGIN backs the pool, never the READ-ONLY GUARANTEE itself, which stays
  enforced by the unchanged 5-layer defense (`assertReadOnlySql` denylist, no-write-method compile
  guard, parameterized `mssql` requests only, `ApplicationIntent=ReadOnly`, and — even with the
  switch on — the boot probe still runs and still reports what it found; it only stops throwing).
- **What it costs:** the DATABASE-LEVEL enforcement layer (the scoped login itself physically cannot
  write) is lost while the switch is on. The application-level 5-layer guard becomes the ONLY
  protection against an accidental or malicious write reaching db_TCL through this pool. This is a
  real, named reduction in defense-in-depth, not a cosmetic one — recorded here so it is never
  mistaken for "still fully DB-enforced."
- **Exit condition (non-negotiable):** production go-live for the ERP dashboards program still
  requires EITHER (a) the scoped read-only login from `db/create-erp-readonly-login.sql` is
  provisioned and in use, OR (b) an explicit, dated, named re-confirmation of this exception is
  recorded before go-live. This is a hard Phase 5 rollout gate — Phase 5's own plan must not treat
  "the switch works" as sufficient for production sign-off on its own.
- **Charter cross-reference:** this is a deliberate, recorded EXCEPTION to the umbrella Program Goal
  Charter's hard-stop rule ("`sa` / `orderstock_app` proposed for the production ERP pool" —
  refuse). The charter's hard-stop rule itself is UNCHANGED; this record is the one-time, dated,
  user-approved carve-out for this specific opt-in mechanism, not a rewrite of the charter.

---

## Rollback

- All new files are additive (`src/lib/erp/*`, new test files, new fixture SQL files, new
  component, new route) — rollback is `git revert` of this phase's commit(s); no destructive step.
- `nav-links.tsx` edit is additive (new group appended to `GROUPS`) — reverting the phase's commit
  restores the prior 3-group nav exactly.
- The `erp_fixture` sandbox database can be dropped and recreated freely at any time
  (`DROP DATABASE erp_fixture;` against the LOCAL sandbox only) without affecting the `orderstock`
  Prisma DB or any production system.
- No migration is applied to `prisma/schema.prisma` — there is nothing to roll back on the Prisma
  side.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner
loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (the umbrella SPEC governs every phase).

- [x] 1. RESEARCH — research-agent: confirmed Step A findings (patterns A1-A6) still hold; no
      codebase drift since 18-09-26 found; see `## Inner Loop Refresh Note` (22-09-26)
- [x] 2. INNOVATE — n/a — no open design choice (research 22-09-26); D1-D6 already locked and
      verified with no contradicting evidence
- [x] 3. PLAN-SUPPLEMENT — plan-agent applied 3 gaps (playwright.config.ts touchpoint, F2
      resolution, D6 wording fix); see `## Inner Loop Refresh Note` (22-09-26)
- [x] 4. PVL — vc-validate-agent: full V1-V7 inner-loop re-validation complete (22-09-26);
      `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [x] 5. EXECUTE — vc-execute-agent (22-09-26): all checklist items Steps A-F done; per-section
      test gates (Step G1-G6) run and green. Unit 212/212 (20 files), e2e chromium 4/4 + mobile
      3/3, lint clean, build exit 0. Hybrid: `erp_fixture` + 10 rows applied to the LOCAL sandbox
      only; `/api/health/erp` returned `{"ok":true,...,"rows":1}`. db_TCL never contacted. See the
      Appendix of `phase-01-erp-read-foundation_REPORT_22-09-26.md` for full step detail.
- [x] 6. EVL — orchestrator-run EVL confirmation (22-09-26): all gates independently re-run and
      green (unit 212/212, e2e chromium 4/4 + mobile 3/3, lint, build); `gates_green: true`, no fix
      cycle required. No new follow-up stubs; EVL HANDOFF SUMMARY consumed by UPDATE PROCESS.
- [x] 7. UPDATE PROCESS — phase report written
      (`phase-01-erp-read-foundation_REPORT_22-09-26.md`), umbrella `## Current Execution State`
      rewritten, blast-radius registry ledger updated, context docs refreshed, Tier-1 audits run.
      **Commit NOT done** — no commit was requested this session (see the report's Closeout
      Packet item 7 for the recommended execution/process commit split).

**Validate-contract required before execute.** If step 4 is unchecked or `## Validate Contract`
below still reads as a placeholder, spawn vc-validate-agent first — do not spawn vc-execute-agent.

---

## Inner Loop Refresh Note

Dated 2026-09-22.

- Step 1 RESEARCH (this pass) re-confirmed Steps A1-A6's file-level claims still hold (no drift):
  `src/lib/db.ts`/`resolve-database-url.ts` singleton+raw-read pattern, `next.config.ts`'s
  `serverExternalPackages: ["mssql","tedious"]`, `mssql@^12.2.0` already installed transitively,
  `vitest.config.ts`'s `environment: "node"` (no jsdom), the sibling TCL reference files at their
  cited line ranges, `docker ps` confirms `orderstock-sql` running, and `/api/health/route.ts` is
  unauthenticated by design.
- Step 2 INNOVATE: n/a — no open design choice this pass; all D1-D6 decisions were already locked
  and verified against current repo state with no contradicting evidence.
- Step 3 PLAN-SUPPLEMENT applied 3 gaps this pass:
  1. Resolved (via new Step F1b + Blast Radius/Touchpoints additions): `playwright.config.ts`'s
     `mobile` project `testMatch` only matches `/mobile\.spec\.ts/` — without broadening it,
     Step F1/G3's "mobile project asserts still 3 tabs" gate would silently run zero tests. Added
     as an explicit touchpoint and checklist step.
  2. Resolved (Step F2 rewritten): `auth-guard-coverage.test.ts` has no existing check-shape for
     API route handlers, and `/api/health` itself is unenumerated there. Step F2 now states the
     concrete resolution (a documented public-route note, not a mismatched `MODULES` entry) that
     the existing validate-contract's Execute-agent instruction E2 had already independently
     reached — this pass makes that resolution the checklist's own instruction instead of leaving
     it only in the validate-contract.
  3. Resolved (D6 wording): corrected "recommend the registry be amended" to "already reflected in
     the registry" — `phase-blast-radius-registry.md`'s Phase 1 section already contains the
     shared/base vs domain-specific fixture-file split as of the same date (18-09-26).
- No scope expansion: all 3 items were plan-completeness fixes (missing touchpoint, missing
  checklist resolution, stale wording), not new design decisions or new files beyond the one-line
  `playwright.config.ts` edit already covered by this phase's registry ownership of e2e specs.

### Supplement — write-capable-login opt-in switch (dated 2026-09-22)

This is a SEPARATE, later supplement pass on the same date as the RESEARCH-driven refresh above —
triggered by an explicit USER DECISION (option B), not by RESEARCH/INNOVATE findings. It adds:

- New Step H (Implementation Checklist): the write-capable-login opt-in switch —
  `src/lib/erp/pool.ts` (opt-in read + warn-instead-of-throw), `src/lib/erp/erp-adapter.ts`
  (conditional), `src/app/api/health/erp/route.ts` (additive response fields), the repo's
  example-env placeholder file (documented, commented-out placeholder), new
  `src/lib/__tests__/erp-pool-write-capable-switch.test.ts`, and an append to
  `process/context/database/all-database.md`.
- New Blast Radius / Touchpoints rows for the 6 files above (all within this phase's existing
  registry ownership — no new file outside `src/lib/erp/*`, its own tests, the example-env
  placeholder file, or the already-owned context docs).
- New Acceptance Criteria (4 bullets) proving: fail-closed-by-default is unchanged when the switch
  is absent; the switch on + write-capable login logs exactly one credential-free warning and
  reports `readOnlyLogin:false`; the switch on + read-only login logs nothing and reports
  `readOnlyLogin:true`; the warning never leaks a credential.
- A new `## Charter Exception Record` section recording who approved the exception, when, why,
  what it costs, and its exit condition (Phase 5 go-live gate).
- No scope expansion beyond the registry's existing Phase 1 ownership: this supplement only edits
  files already inside Phase 1's owned paths; it does not touch Phase 2/3/4/5's domain-specific
  fixture files, `prisma/schema.prisma`, or `db/create-erp-readonly-login.sql`.
- This phase's `Status:` line, `## Phase Loop Progress`, and `## Validate Contract` (Gate: PASS,
  dated 22-09-26) are intentionally NOT re-ticked or re-run by this supplement — per the task
  instructions, this is a plan-content supplement only; a fresh inner-PVL re-validation covering
  Step H is expected before Step H's own EXECUTE work begins.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `erp-adapter.test.ts` guard matrix (~24 cases) | Fully-Automated | AC17 |
| `erp-adapter.test.ts` `verifyReadOnlyBoot` mocked cases | Fully-Automated | AC18 (refusal logic half) |
| `resolve-erp-database-url.test.ts` | Fully-Automated | Infra precondition for AC17/AC18 (no SPEC AC directly, supports the guard's connection layer) |
| `erp-cache-degrade.test.ts` | Fully-Automated | AC15 |
| `dashboard-data-table.test.tsx` | Fully-Automated | AC12, AC13 (shared-contract half) |
| `dashboards-nav-visibility.spec.ts` (chromium + mobile projects) | Fully-Automated | AC1 (infra half) |
| `/api/health/erp` manual curl against fixture DB | Hybrid | Supports AC15's live-path precondition |
| Live boot-probe against real db_TCL scoped login | Agent-Probe (deferred to Phase 5) | AC18 (live-credential half) |

```bash
pnpm test
pnpm lint
pnpm build
node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs
node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs
```

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-01-erp-read-foundation_PLAN_18-09-26.md`
- Last completed step: 7 — UPDATE PROCESS (this phase is closed; all 7 inner-loop steps done)
- Validate-contract status: inner-PVL Gate: PASS (22-09-26), independently re-confirmed by the EVL
  confirmation run (22-09-26) — `gates_green: true`, no fix cycle required.
- Phase 1 is ✅ VERIFIED at agent level. Next step for a fresh agent: read the umbrella plan's
  `## Current Execution State`, then read `phase-02-sales-dashboard_PLAN_18-09-26.md` and run its
  own Step 1 (RESEARCH). Phases 2/3/4 may run in parallel per the umbrella's join conditions.
- Nothing from this phase is committed yet — see the 22-09-26 report's Closeout Packet item 7 for
  the recommended execution/process commit split before Phase 2 starts.

---

## Validate Contract

Status: PASS
Date: 22-09-26
date: 2026-09-22
generated-by: inner-pvl: phase-1
supersedes: 2026-09-18 (outer-pvl) — inner PVL has current evidence

Parallel strategy: sequential
Rationale: Signal count for this re-validation is 1/7 (S6 high-risk class present — new
guarded read-only pool/API surface; S1/S2/S3/S4/S5/S7 not met — single-phase scope, no
schema/auth/API-contract change to an EXISTING consumer, no open design fork, not a
multi-phase kickoff, no user depth request, and the file count grouped by concern is under 5
per created-file cluster). LOW band → sequential. This re-validation itself was run as a
single pass re-confirming the Inner Loop Refresh Note's 3 completeness fixes against live
repo state (file-existence, dependency, and config checks below) rather than a fresh Layer
1/Layer 2 fan-out, because the underlying design (D1-D6), blast radius, and dimension
findings are unchanged from the outer-PVL pass — only plan-text completeness moved.

Test gates (C3 5-column table — ADDITIVE; existing consumers still parse the legacy line form below it):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC17-denylist | `assertReadOnlySql` rejects every forbidden-keyword/statement-shape violation (ported 19-keyword denylist, re-counted and confirmed against `TCL/server/src/erp/erp-adapter.ts` lines 380-404 during this pass, + structural cases) | Fully-Automated | `pnpm test src/lib/__tests__/erp-adapter.test.ts` | A |
| AC17-order | `guardedQuery` calls `assertReadOnlySql` before touching the pool (mocked `ConnectionPool`) | Fully-Automated | `pnpm test src/lib/__tests__/erp-adapter.test.ts` (guardedQuery ordering case) | A |
| AC18-mock | `verifyReadOnlyBoot` refuses a mocked write-capable login, accepts a mocked read-only one | Fully-Automated | `pnpm test src/lib/__tests__/erp-adapter.test.ts` (boot-probe mock cases) | A |
| INFRA-url | `resolveErpDatabaseUrl` round-trips a `$`-in-password value, strips one quote pair, falls back to `process.env`, throws when neither is set | Fully-Automated | `pnpm test src/lib/__tests__/resolve-erp-database-url.test.ts` | A |
| AC15 | Cache returns fresh data, stale-fallback-on-fetcher-error, empty-cache-rethrow; `erpDegradeState` maps stale→"ข้อมูลอาจไม่ล่าสุด" | Fully-Automated | `pnpm test src/lib/__tests__/erp-cache-degrade.test.ts` | A |
| AC12-AC13 | `dashboard-data-table` sorts via `?sort=`, paginates via `?page=`, preserves other searchParams, renders a mobile card list under the breakpoint | Fully-Automated | `pnpm test src/lib/__tests__/dashboard-data-table.test.tsx` — jsdom-free strategy per Execute-agent instruction E1 (re-confirmed this pass: no `jsdom`/`happy-dom`/`@testing-library/react` in `package.json`) | A |
| AC1-infra | Nav renders all 3 "แดชบอร์ด" links on desktop/tablet; phone bottom tab bar stays at exactly 3 tabs | Fully-Automated | `pnpm test:e2e --project=chromium e2e/dashboards-nav-visibility.spec.ts && pnpm test:e2e --project=mobile e2e/dashboards-nav-visibility.spec.ts` — requires Step F1b's `playwright.config.ts` `mobile`-project `testMatch` broadening (re-confirmed this pass: regex is still `/mobile\.spec\.ts/` only, line 41) | A |
| INFRA-regress | Full regression: `mssql`/`tedious` remain externalized, no bundling errors from `src/lib/erp/*` | Fully-Automated | `pnpm test && pnpm lint && pnpm build` | A |
| INFRA-health | `/api/health/erp` returns `{ok:true}` (or a stale-but-served response) against the live `erp_fixture` sandbox DB | Hybrid — precondition: sandbox container running (re-confirmed this pass: `orderstock-sql` is up), `db/erp-fixture/*.sql` applied | `curl localhost:3000/api/health/erp` after `pnpm dev` | A |
| INFRA-fixture | `erp_fixture` DB + ~10 seeded `InventoryItem` rows exist after applying the fixture SQL | Hybrid — precondition: sandbox container running (confirmed) | manual sqlcmd/query confirmation (Step G2) | A |
| READONLY-boot-mock | Boot permission probe (mock mode) is gated behind `NODE_ENV !== "production"` unless `ERP_VERIFY_BOOT_PROBE=1`, so local dev against the write-capable `sa`-backed fixture connection is never blocked, while the refusal LOGIC itself is proven by AC18-mock above | Fully-Automated | `pnpm test src/lib/__tests__/erp-adapter.test.ts` (verifyReadOnlyBoot mocked cases, same file as AC18-mock — listed separately here to make the read-only-enforcement gate explicit per this pass's special-attention instruction) | A |
| AC18-live | Boot-probe refusal against the REAL db_TCL scoped read-only login | Known-Gap | — (requires the DBA-provisioned `orderstock_dash` login, a USER-RUN delivery step; `db/create-erp-readonly-login.sql` exists, not run — confirmed this pass) | D — deferred to Phase 5, per SPEC's own declared AC18 Agent-Probe residual; not a gap introduced by this phase |
| INFRA-visual | Degrade-banner visual placement/legibility on a real dashboard page | Agent-Probe | Manual scan during Phase 2/3/4's own e2e work (no dashboard page exists yet in Phase 1) | C — deferred to Phase 2/3/4 |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: the `strategy:` column above carries only Fully-Automated / Hybrid /
Agent-Probe. Known-Gap (AC18-live) is a named residual row via gap-resolution D, never a
proving strategy.

Failing stubs (Fully-Automated rows only; E1-E3 stubs already present verbatim in the plan's
Step E checklist — copied here for contract completeness; the remaining rows had no stub in
the plan text and are generated inline from the Scenario/behavior text):

```
test("should reject every forbidden keyword", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: assertReadOnlySql forbidden-keyword matrix") })
test("should call assertReadOnlySql before executing against the pool", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: guardedQuery pre-execution guard ordering") })
test("should refuse boot when any write permission is granted", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: verifyReadOnlyBoot mocked refusal") })
test("should round-trip a $-containing password verbatim via raw env read", () => { throw new Error("NOT IMPLEMENTED — TDD stub: resolveErpDatabaseUrl $-in-password round-trip") })
test("should return the last cached value with stale:true when the fetcher throws", () => { throw new Error("NOT IMPLEMENTED — TDD stub: getCached stale-fallback-on-error") })
test("should sort, paginate, and preserve other searchParams while rendering a mobile card list under the breakpoint", () => { throw new Error("NOT IMPLEMENTED — TDD stub: dashboard-data-table sort/paginate/preserve/mobile") })
test("should render all 3 แดชบอร์ด nav links and keep the phone tab bar at exactly 3 tabs", () => { throw new Error("NOT IMPLEMENTED — TDD stub: dashboards-nav-visibility") })
test("should gate the boot permission probe behind NODE_ENV/ERP_VERIFY_BOOT_PROBE so local sa-backed dev never blocks", () => { throw new Error("NOT IMPLEMENTED — TDD stub: verifyReadOnlyBoot dev-mode gating") })
```

Legacy line form (retained so existing validate-contract consumers still parse):
- `src/lib/erp/erp-adapter.ts` guard matrix: Fully-automated: `pnpm test src/lib/__tests__/erp-adapter.test.ts`
- `src/lib/erp/cache.ts` + `degrade.ts`: Fully-automated: `pnpm test src/lib/__tests__/erp-cache-degrade.test.ts`
- `dashboard-data-table.tsx`: Fully-automated: `pnpm test src/lib/__tests__/dashboard-data-table.test.tsx` (jsdom-free strategy — see E1 below)
- nav/tab-bar: Fully-automated: `pnpm test:e2e --project=chromium|mobile e2e/dashboards-nav-visibility.spec.ts`
- `/api/health/erp` live: hybrid: `curl localhost:3000/api/health/erp` + precondition sandbox up + fixture applied
- AC18 live-login boot probe: known-gap: documented — deferred to Phase 5

Plan updates applied: none this pass (the 3 gaps this Inner Loop Refresh Note addresses were
already applied directly to the plan's checklist/touchpoints by the plan-agent PLAN-SUPPLEMENT
step immediately before this re-validation — see `## Inner Loop Refresh Note`, dated
2026-09-22 — so there is nothing further for this validate pass to add to the plan text
itself).

Execute-agent instructions (re-confirmed against live repo state this pass; unchanged in
substance from the outer-PVL contract, restated here so this inner-PVL contract is
self-contained):

- **E1 — jsdom-free component test strategy (read-only-relevant infra confirmation).**
  Re-confirmed by direct grep: `package.json` contains no `jsdom`, `happy-dom`, or
  `@testing-library/react` dependency, and `vitest.config.ts` still sets
  `environment: "node"`. `package.json` remains outside this phase's Blast Radius. Resolution
  unchanged: write `dashboard-data-table.test.tsx` by calling the server component directly and
  rendering via `renderToStaticMarkup` (already available in `react-dom/server`, zero new
  dependency), asserting on the returned HTML string. Do not install jsdom/testing-library for
  this phase without a PLAN-SUPPLEMENT that explicitly widens the `package.json` exclusion.
- **E2 — `auth-guard-coverage.test.ts` has no existing pattern for a public API route.**
  Re-confirmed by direct read this pass: the `MODULES` array only asserts `requireAuth()`
  inside server-action modules (shops/products/admin-users); `/api/health/route.ts` itself
  calls `prisma.$queryRaw` directly with no `requireAuth()` call and is unauthenticated by
  design (confirmed this pass, resolving Step A5). `/api/health/erp` should follow the same
  precedent. Add one short, clearly-commented note near the `MODULES` array (or a minimal
  standalone `describe`/`it.todo` block) stating "`/api/health/erp`, like `/api/health`, is
  intentionally public — not subject to this file's action-guard coverage," and record the
  rationale in the phase report and the `all-database.md` ERP Read Layer section (Step F3). Do
  not force a mismatched `MODULES`-shaped entry into this file.
- **E3 — forbidden-keyword count is 19, not 14 (re-confirmed this pass, exact line-by-line
  count against `TCL/server/src/erp/erp-adapter.ts` lines 380-404: INSERT, UPDATE, DELETE,
  MERGE, TRUNCATE, DROP, ALTER, CREATE, GRANT, REVOKE, EXEC/EXECUTE combined, sp_executesql,
  xp_cmdshell, BULK, OPENROWSET, INTO, BACKUP, RESTORE, SHUTDOWN = 19 rules).** Use 19 as the
  source-of-truth keyword-rule count for the matrix; the "~24+ cases total" target (which also
  includes the non-keyword structural cases) is unaffected.
- **E4 — `mssql` `ConnectionPool` does not natively accept a JDBC `sqlserver://` string.**
  Unchanged finding, still correctly anticipated by the plan's own INNOVATE step and Blockers
  section: write a small internal parser converting the JDBC-style string into `mssql`'s
  config shape, confirming the exact accepted shape against the installed `mssql` type defs
  during Step B3 itself; if the parser would grow beyond a small, contained helper, route to a
  PLAN-SUPPLEMENT rather than improvising under time pressure.
- **E5 — read-only enforcement is defense-in-depth, not single-point (special-attention
  confirmation for this pass).** The 5 layers (tokenizer/denylist in `assertReadOnlySql`,
  compile-time no-write-method type guard on `ErpAdapter`, parameterized `mssql` requests only,
  the `HAS_PERMS_BY_NAME` boot probe via `verifyReadOnlyBoot`, and `ApplicationIntent=ReadOnly`
  on the pool config) must all be implemented exactly as specified in D3/Step B2-B3 — none may
  be treated as optional or "good enough on its own." No ERP table may ever be added to
  `prisma/schema.prisma` and no ERP read may ever go through `prisma.$queryRaw` or the
  `orderstock_app` Prisma pool — confirmed at Blast Radius level: this phase's "Never touched"
  list already excludes `prisma/schema.prisma`, and `src/lib/erp/pool.ts` is a wholly separate
  `mssql.ConnectionPool` singleton per D1. Execute-agent must grep for any accidental
  `prisma.$queryRaw` or `prisma.erp*` usage in `src/lib/erp/*` before reporting Step B done.
- **E6 — local sandbox is the only environment this phase's Hybrid gates may touch.**
  `db/erp-fixture/00-schema.sql`/`01-seed.sql` run ONLY against the local `orderstock-sql`
  container (confirmed running this pass) targeting a NEW `erp_fixture` database, never against
  db_TCL. `db/create-erp-readonly-login.sql` (Phase 0's artifact, confirmed present, not run)
  stays untouched and unexecuted by this phase — execute-agent must not run it "to save a step."

Dimension findings:
- Infra fit: PASS — re-confirmed this pass by direct file read/grep: `mssql@^12.2.0` installed
  (`package.json` line 18), already externalized in `next.config.ts`'s
  `serverExternalPackages: ["mssql", "tedious"]`; both TCL sibling reference files exist at the
  cited paths with the exact `FORBIDDEN_KEYWORDS` (19 rules, re-counted)/`assertReadOnlySql`
  patterns claimed; `orderstock-sql` container is running (`docker ps` confirmed); SQL Server
  multi-database-per-instance requires no `docker-compose.yml` change.
- Test coverage: CONCERN, resolved via Execute-agent instructions E1/E2/E3/E5/E6 above
  (jsdom/testing-library absence + package.json exclusion conflict for the component test;
  auth-guard-coverage.test.ts has no shape for a public API route — `/api/health/route.ts`
  independently re-read this pass and confirmed unauthenticated with no `requireAuth()` call;
  keyword-count correction; explicit read-only-enforcement and sandbox-only reminders for this
  re-validation's special-attention scope). Playwright project names/`testMatch` regexes
  re-confirmed by direct read (`mobile` project's regex is still `/mobile\.spec\.ts/` only,
  confirming Step F1b's broadening edit is still necessary and not yet applied).
- Breaking changes: PASS — every created file is new; `nav-links.tsx` edit is additive; no
  existing route/schema/component signature changes. New component prop contracts
  (`dashboard-data-table.tsx`, `pilot-banner.tsx`, `degrade-banner.tsx`) correctly flagged as
  becoming binding for Phase 2/3/4.
- Security surface / read-only enforcement (special-attention dimension this pass): PASS —
  the 5-layer defense-in-depth guard is ported from a verified, currently-shipping
  implementation (both TCL sibling files re-read this pass at the cited line ranges); the plan
  correctly scopes the boot-probe to mock-mode only for this phase (never over-claims AC18
  live); `resolveErpDatabaseUrl` mirrors the existing no-log-the-secret contract
  (`resolve-database-url.ts` re-read this pass); no ERP table is ever routed through Prisma or
  `$queryRaw` (confirmed: `prisma/schema.prisma` is in this phase's "Never touched" list, and
  `src/lib/erp/pool.ts` is a wholly separate `mssql.ConnectionPool`); no write-capable
  credential is introduced (login provisioning stays Phase 0's DBA-run, unexecuted artifact,
  confirmed present at `db/create-erp-readonly-login.sql` and untouched by this phase's Blast
  Radius). This satisfies the task's explicit "special attention to the read-only enforcement
  gates" instruction for this re-validation pass.
- Step A (research/confirm patterns): PASS — every file A1-A6 asks the executor to read exists
  exactly as named (all 13 referenced files/paths, including both TCL sibling files, confirmed
  present via direct filesystem check this pass).
- Step B (guard+pool+resolver): CONCERN, already anticipated by the plan itself (E4) — no fresh
  gap.
- Step C (fixture DB): PASS with the same forward note as the outer-PVL pass (InventoryItem's
  real composite PK / non-unique ItemCode — Phase 2/3/4 forward guidance only, elevated to a
  uniform cross-phase rule in the registry's "Cross-Phase Precondition" section, confirmed
  present there this pass).
- Step D (health route, cache/degrade, data-table, nav): CONCERN, resolved via E1/E2 above.
- Step E (guard tests + boot-probe mock + cache/degrade tests): PASS, minor correction via E3.
- Step F (nav+e2e, auth-guard-coverage, docs): CONCERN, resolved via E2 above. Step F1b (the
  `playwright.config.ts` `mobile`-project `testMatch` broadening) is confirmed STILL NOT applied
  in the current repo (regex unchanged at `/mobile\.spec\.ts/`) — this is expected pre-EXECUTE
  state, not a defect; execute-agent must apply it as part of Step F1b, not skip it because
  "the plan already documents the gap."
- Step G (per-section test gates): PASS — all cited commands (`pnpm test`, `pnpm lint`,
  `pnpm build`, `pnpm test:e2e --project=chromium|mobile`) and Playwright project names
  re-confirmed real against the repo's actual `package.json`/`playwright.config.ts` this pass.

Open gaps:
- AC18 live-login boot-probe against the real db_TCL scoped login: known-gap — requires the
  DBA-provisioned `orderstock_dash` login (Phase 0's USER-RUN delivery script, confirmed present
  at `db/create-erp-readonly-login.sql`, not run); deferred to Phase 5 per the SPEC's own
  declared AC18 Agent-Probe residual. Not a gap introduced by this phase.
- Real db_TCL scoped-login TLS/connection-parsing edge cases on the customer's actual SQL
  Server version: known-gap — no access to a customer-representative server in dev; backlog
  only if Phase 5's live reconcile step surfaces a real parsing edge case.
- Degrade-banner visual placement/legibility on a real dashboard page: known-gap (Agent-Probe)
  — deferred to Phase 2/3/4's own e2e work; no dashboard page exists yet in Phase 1.
- InventoryItem's real composite PK / non-unique ItemCode (forward guidance, not a Phase 1
  gap): known-gap — Phase 2/3/4's RESEARCH steps must confirm the `Roworder` tie-break rule
  before writing their own domain fixture seeds/real ERP queries against `InventoryItem`; this
  is now a uniform cross-phase rule in the registry (re-confirmed present this pass), not a
  Phase-1-only note. Does not block Phase 1's own exit gate.
- `playwright.config.ts`'s `mobile`-project `testMatch` broadening (Step F1b) is not yet
  applied in the repo (re-confirmed this pass) — this is a checklist item for EXECUTE, not an
  unresolved plan gap; flagged here only so execute-agent does not mistake "documented" for
  "done."

What this coverage does NOT prove:
- The `erp-adapter.test.ts` guard matrix proves the denylist rejects every documented dangerous
  SQL shape; it does NOT prove anything about a real SQL Server connection, real ERP
  permissions, or whether the real scoped login (once provisioned) actually returns the
  expected `HAS_PERMS_BY_NAME` result set (AC18's Agent-Probe residual, owned by Phase 5).
- The `erp-cache-degrade.test.ts` suite proves the exact degrade contract Phase 2/3/4 will
  reuse; it does NOT prove real ERP downtime timing/latency behavior or visual banner placement
  on an actual page.
- The `dashboard-data-table.test.tsx` test (E1's jsdom-free strategy) proves the shared
  sort/paginate/searchParam-preservation/mobile-breakpoint contract against synthetic fixture
  data; it does NOT prove behavior against real ERP-shaped data volumes or pixel-level visual
  correctness (no jsdom/browser rendering is exercised).
- The `dashboards-nav-visibility.spec.ts` e2e gates prove the nav SHELL renders correctly and is
  non-regressive; they do NOT prove whether the linked dashboard PAGES themselves render
  correctly (all 3 currently 404 — expected for this phase's exit gate).
- The Hybrid `/api/health/erp` curl check proves the real pool/resolver/guard chain works
  end-to-end against a real (fixture) SQL Server; it does NOT prove behavior against the real
  db_TCL server or the real scoped login.
- The read-only-enforcement gates (AC17-denylist, AC17-order, AC18-mock, READONLY-boot-mock)
  prove the guard's LOGIC is correct against every case this pass could enumerate from the
  ported source; they do NOT prove there is no SQL-injection-shaped bypass this denylist has
  never seen — that residual risk is inherent to any denylist approach and is mitigated, not
  eliminated, by layering parameterized queries (layer 3) and the boot permission probe
  (layer 4) on top of the tokenizer (layer 1-2).
- No test in this phase proves anything about Sales/Purchase/Production business-logic
  queries, money-visibility gating, or CSV export — those are Phase 2/3/4/5's own acceptance
  criteria, entirely out of this phase's scope by design.

Gate: PASS (no FAILs; 2 CONCERNs identified and resolved in-contract via Execute-agent
instructions E1-E6 without requiring any plan-checklist edit or blast-radius expansion; this
re-validation independently re-confirmed every file-existence/dependency/config claim the
outer-PVL contract made — none had drifted — and gave special attention to the read-only
enforcement gates and to local-sandbox test-gate runnability per this pass's explicit
instruction; remaining items are already-declared known-gaps requiring USER-RUN/DBA/later-phase
action, not blocking concerns)
Accepted by: N/A — Gate is PASS; no unresolved CONCERNs required user acceptance. All CONCERNs
identified during this pass were closed via Execute-agent instructions E1-E6 above; the 5 Open
Gaps items are pre-existing declared known-gaps (USER-RUN/DBA/later-phase items per the SPEC and
umbrella charter) or EXECUTE-time checklist reminders, not new concerns requiring sign-off in
this cycle.
