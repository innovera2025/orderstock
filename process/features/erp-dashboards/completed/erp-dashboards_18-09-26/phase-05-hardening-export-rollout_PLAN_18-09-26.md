---
name: plan:erp-dashboards-phase-05-hardening-export-rollout
description: "ERP Dashboards — Phase 5: cross-dashboard money-gate audit, CSV export, full regression, manual live-reconcile, AC18 boot-probe, production rollout readiness"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: phase-05
---

# Phase 05 — Hardening, Export & Rollout

**Program:** erp-dashboards
**Umbrella plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
**Registry:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-blast-radius-registry.md`
**SPEC (frozen, governs this phase):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
**Phase status:** ⏳ PLANNED
**Report destination:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_REPORT_18-09-26.md` (flat in the program task folder)

---

## Plan Metadata

**Date**: 18-09-26
**Complexity**: COMPLEX (one phase of the erp-dashboards program)
**Status**: ⏳ PLANNED

## Overview

This is a phase plan within the erp-dashboards phase program. Full program context, scope tiers,
and the Program Goal Charter live in the umbrella plan
(`erp-dashboards-umbrella_PLAN_18-09-26.md`). Program context router:
`process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan
runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` (SKIPS SPEC — the umbrella SPEC governs)
and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression
checks against overlapping previously-verified surfaces (Phases 1-4) pass AND the validate-contract
gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to
VERIFIED without recorded evidence for AC2/AC9/AC14/AC15/AC16/AC17, the full regression run, the
manual live-reconcile record, and the AC18 boot-probe record (fixture-mode PASS + live-mode
known-gap or real result).

## Acceptance Criteria

The Exit Gate section below is the acceptance criteria for this phase; each criterion (AC2, AC9,
AC14, AC15, AC16, AC17, AC18, plus the program-wide full-regression requirement) is proven by the
mapped row in the Verification Evidence table. Next Step: this plan enters the RIPER-5 VALIDATE
(PVL) step before EXECUTE (ENTER EXECUTE MODE only after the contract is written).

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the Phase 2/3/4 reports (read all three at
  RESEARCH — this phase's data-fetch reuse and cross-dashboard audit depend on all three).

---

## Purpose

Phase 5 is the closing hardening pass of the ERP Dashboards program. Phases 2, 3, and 4 each built
one dashboard against the ERP fixture database with their own local AC coverage (AC1, AC3–AC8,
AC10–AC13 per-dashboard). Phase 5 does NOT re-implement any dashboard's own logic. It:

1. Runs a **cross-dashboard** money-visibility audit (AC9) that no single-dashboard phase could
   prove alone — one Vitest suite asserting the server-side `canSeeMoney` gate holds on every
   screen AND every export across all three dashboards.
2. Adds **CSV export** (AC14) as a brand-new route surface, extending Phase 1's shared
   `dashboard-data-table.tsx` component additively (never rewriting its sort/paginate logic).
3. Confirms the **degraded-mode** (AC15) and **pilot-banner** (AC16) behaviors hold across all
   three dashboards simultaneously (each phase proved its own dashboard; Phase 5 proves the set).
4. Re-confirms the **read-only guard** (AC17) is still intact after three dashboards' worth of new
   SQL files were added in P2/P3/P4.
5. Runs the **full regression suite** (every existing Vitest + Playwright spec, not just the new
   ones) to catch any P2/P3/P4 interaction bug before rollout.
6. Produces the **manual live-reconcile script** (a human-run, read-only comparison against KRS's
   own report procedures) and the **AC18 boot-probe** recording — both required before real
   customer go-live, per the umbrella's hard safety constraints.
7. Assembles **production rollout readiness** — a checklist of what remains before dashboards can
   be enabled for real customer use (the scoped read-only ERP login being the hard gate).

This phase does not touch Sales/Purchase/Production dashboard page LOGIC (KPI tiles, charts,
breakdowns, drilldowns, query behavior). Any bug this phase's audit finds in a dashboard's own logic
is routed back to that dashboard's own phase as a PLAN-SUPPLEMENT — never fixed inline here (see
`phase-blast-radius-registry.md` §Phase 5 "Explicit non-overlap"). The ONE narrow exception under
discussion — wiring an export-trigger prop into each page's `dashboard-data-table.tsx` call site —
is NOT covered by an existing registry exception and is gated per Step B4 / `## Registry Change
Requests` below; it must be resolved (preferably with zero Phase 5 edits to P2/3/4 files, via a
stub P2/3/4 already left) before any such edit is made.

---

## Entry Gate

- Phase 1 exit gate passed (guard/pool/cache/degrade/data-table/nav all exist and are green).
- Phase 2 exit gate passed (`/dashboards/sales` live against `erp_fixture`, AC1/AC3/AC4/AC9(Sales)/
  AC10–AC13(Sales) green).
- Phase 3 exit gate passed (`/dashboards/purchase` live against `erp_fixture`, AC1/AC5/AC6/
  AC9(Purchase)/AC10–AC13(Purchase) green).
- Phase 4 exit gate passed (`/dashboards/production` live against `erp_fixture`, AC1/AC7/AC8/
  AC9(Production)/AC10–AC13(Production) green).
- All three dashboards' own validate-contracts show `Gate: PASS` (or an explicitly accepted
  CONDITIONAL with ≥1 supplement cycle) — verified via `grep -c 'Gate: PASS'` on each phase plan
  before RESEARCH begins.

---

## Scope / Out of Scope

**In scope:**
- Cross-dashboard money-gate audit test suite (screens + exports, all 3 dashboards).
- CSV export route handler(s) for all 3 dashboards' main + line/detail tables.
- Full regression suite run (existing Vitest 100+ / Playwright 49+ specs, plus every spec added by
  P1–P4).
- Manual, human-run live-reconcile-vs-KRS-procs script (read-only, against real db_TCL — USER-RUN).
- AC18 boot-probe recording (fixture-mode automated; live-mode is Agent-Probe, deferred until the
  scoped read-only login is provisioned per the umbrella's hard gate).
- Production rollout readiness checklist.

**Out of scope (per umbrella/SPEC — do not build):**
- `.xlsx` export (CSV only, per SPEC Out Of Scope).
- A 4th phone bottom-tab-bar entry.
- Any fix to a dashboard's own KPI/chart/breakdown/drilldown logic (route back to P2/P3/P4 instead).
- Any change to `prisma/schema.prisma`, the orderstock order-system surfaces, or the existing
  `/api/health` route.
- Provisioning the real scoped read-only ERP login itself, or running any DDL/login script against
  db_TCL — that is a DBA delivery-script action, USER-RUN, never agent-run (see `db/create-erp-readonly-login.sql`,
  owned by Phase 0).
- An automated continuously-running reconciliation job (manual only, per SPEC).

---

## Touchpoints

**New files (this phase owns — see registry):**
- `src/app/api/dashboards/export/route.ts` (or a per-dashboard variant under
  `src/app/api/dashboards/export/**` — see Step A for the exact routing decision) — CSV export
  route handler(s)
- `src/lib/erp/live-reconcile-script.ts` — manual, human-run reconcile helper (prints a comparison
  report to stdout; never auto-applies anything)
- `src/lib/__tests__/dashboards-money-audit.test.ts` — cross-dashboard AC9 audit suite
- `e2e/dashboards-export.spec.ts` — AC14 CSV export role-gate e2e (all 3 dashboards)
- `e2e/dashboards-degraded-mode.spec.ts` — AC15/AC16 cross-dashboard degraded-mode + pilot-banner e2e

**Extended files (shared — explicit rule, see Shared Touch Rules below):**
- `src/components/dashboard-data-table.tsx` (Phase 1's owned component) — additive export-trigger
  wiring only
- `src/lib/__tests__/auth-guard-coverage.test.ts` — append ONLY the new export route entries
- `process/context/all-context.md` — Phase 5 writes the program-complete status line

**Read-only inputs (this phase reads, never edits):**
- `src/lib/erp/erp-adapter.ts`, `src/lib/erp/pool.ts`, `src/lib/erp/cache.ts`, `src/lib/erp/degrade.ts`
  (or their actual Phase 1 filenames — confirm exact names from Phase 1's report before starting;
  see Step 0 below)
- `src/app/(main)/dashboards/{sales,purchase,production}/**` (Phase 2/3/4's dashboard pages and
  their data-fetch functions — Phase 5's export route calls the SAME data functions those pages use,
  it does not re-derive query logic)
- `src/lib/be-date.ts` (`ceToBeDisplay` — reused for CSV date formatting, unchanged)
- `src/lib/auth-guard.ts` (`requireAuth()` — unchanged signature, reused as-is)

---

## Public Contracts

- `requireAuth()`'s existing signature (`requireAuth(requiredRole?: Role): Promise<AuthedUser>`) is
  UNCHANGED. The export routes call it exactly like every other route.
- The existing `/api/health` route is untouched; the export routes are entirely new endpoints under
  `/api/dashboards/export/**`.
- No existing dashboard page's URL, searchParams filter contract, or rendered markup changes as a
  result of this phase — the export button is an ADDITIVE UI element wired into
  `dashboard-data-table.tsx`, not a page rewrite.
- The phone bottom-tab-bar's existing 3-tab contract (`e2e/mobile.spec.ts`) is unchanged.
- `prisma/schema.prisma` is untouched.

---

## Blast Radius

Stay strictly inside the OWNED PATHS below. Anything discovered during RESEARCH that would require
touching a file outside this list is a **registry change request** — write it into the phase report
under `## Registry Change Requests`, do NOT edit the umbrella, registry, SPEC, or another phase's
plan directly.

**Owned paths (this phase, exclusively):**
- `src/app/api/dashboards/export/**`
- `src/lib/erp/live-reconcile-script.ts`
- `src/lib/__tests__/dashboards-money-audit.test.ts`
- `e2e/dashboards-export.spec.ts`
- `e2e/dashboards-degraded-mode.spec.ts`
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_REPORT_18-09-26.md`
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-rollout-readiness_REF_18-09-26.md` (new — the rollout checklist artifact, see Step D)

**Shared files this phase touches (explicit rule — from the registry):**
- `src/components/dashboard-data-table.tsx` — EXTEND ONLY. Add export-trigger wiring (a button/prop
  that emits the current filtered view for CSV). Do NOT rewrite existing sort/paginate logic. Any
  behavior change to existing sort/paginate is a regression risk — flag it in the RESEARCH step and
  regression-check it against Phases 2/3/4's existing usage before EXECUTE.
- `src/lib/__tests__/auth-guard-coverage.test.ts` — append ONLY this phase's new export-route
  entries (do not touch P1–P4's existing entries).
- `process/context/all-context.md` — Phase 5 writes the program-complete status line; does not
  restructure Phase 0–4's entries.

**Explicit non-overlap (do NOT touch):**
- Any file under `src/app/(main)/dashboards/{sales,purchase,production}/**` (page logic, KPI tiles,
  charts, breakdowns, drilldowns) — bugs found here are routed back to that phase via
  PLAN-SUPPLEMENT, never fixed inline. **Note:** Step B4's export-trigger prop wiring does NOT touch
  the page files themselves — confirmed by RESEARCH (22-09-26): `DashboardDataTable` is never
  called directly from any `page.tsx`; every dashboard delegates to a thin per-list wrapper
  component in the SAME `dashboards/{sales,purchase,production}/**` path. The exact call sites are
  the 5 wrapper files: `do-list-table.tsx`, `do-lines-table.tsx` (sales), `po-list-table.tsx`,
  `po-lines-table.tsx` (purchase), `mo-list-table.tsx` (production; the production
  `[moNumber]/page.tsx` inline usage is the one page-level exception). This is NOT an automatic
  exception — see Step B4 / `## Registry Change Requests` for the required resolution path before
  any such edit.
- `db/erp-queries/{sales,purchase,production}/*.sql` — the export routes call existing data
  functions; they do not add new domain SQL files.
- `package.json` — no new dependency decisions belong to Phase 5 (CSV needs no library — hand-rolled
  UTF-8 BOM + comma-join is sufficient per SPEC's "no new library (.xlsx deferred)" note).
- `prisma/schema.prisma`, any file under `src/app/(main)/orders/**`, `src/app/(main)/shops/**`,
  `src/app/(main)/products/**`, `src/app/(main)/admin/**`, `src/app/print/**` — untouched.

---

## Data / SQL Details

No new SQL files are owned by this phase. The export route(s) MUST call the exact same ERP-read
data functions that Phase 2/3/4's dashboard pages already call for their main/line tables — the
export is a serialization of the SAME query result, not a parallel query path. Concretely:

- **Sales:** reuse whatever function Phase 2 exposes for the DO list (`tbl_DOhdr`/`tbl_Dodtl` basis
  via `resolveSalesBasis()`) and DO-line detail. Confirm the exact exported function name/path from
  `phase-02-sales-dashboard_REPORT_22-09-26.md` during RESEARCH (Step 0) — do not guess it.
- **Purchase:** reuse Phase 3's PO list (`PurchaseInvoiceHdr`/`PurchaseOrderHdr` dual-basis) and
  PO-line detail functions.
- **Production:** reuse Phase 4's MO list (`tbl_MoHdr`/`tbl_BatchOrder` plan-only) and
  raw-material-issue (`InventoryFlowDtl.MONo`) detail functions.
- **Row cap:** apply a fixed row cap (recommend 5,000 rows per export file, matching a sane
  spreadsheet-import ceiling) at the SAME query-result level the page already paginates from — do
  not add a second unbounded query.
- **Money-column stripping for STAFF:** the export route computes `canSeeMoney = role === "ADMIN"`
  exactly like each dashboard page already does, and omits money columns/fields from the CSV
  serialization entirely for STAFF — never redact-in-place (e.g. never emit `"—"` in a money column;
  omit the column/header entirely so a Staff CSV has fewer columns than an Admin CSV).

---

## UI Details (Thai labels)

- Export trigger button label: `"ส่งออก CSV"` (Export CSV), placed inside `dashboard-data-table.tsx`
  next to the existing sort/paginate controls, additive (does not displace any existing control).
- CSV filename convention: `{dashboard-slug}-{yyyy-mm-dd}.csv` in ASCII (avoid Thai characters in
  the filename itself — some OS/browser combinations mangle non-ASCII download filenames; the
  CONTENT is Thai, the filename is ASCII-safe).
- CSV column headers are Thai, matching each dashboard's on-screen column labels exactly (e.g. if
  the Sales DO list column reads "เลขที่ใบส่งสินค้า" on screen, the CSV header for that column reads
  identically) — pull the header strings from the same constant/label source each dashboard page
  already uses, do not hand-retype them into the export route.
- Dates in the CSV body render via `ceToBeDisplay()` (Buddhist Era, `d/m/yy`), matching every other
  BE-displaying surface in the app — never a raw ISO/CE date in the exported file.
- Degraded-mode banner text (already built by P1/P2/3/4; Phase 5 only VERIFIES it, does not create
  new copy): `"ข้อมูลอาจไม่ล่าสุด"`.
- Pilot banner text (already built by P1/P2/3/4; Phase 5 only VERIFIES it): `"ข้อมูลนำร่อง"`.
- Rollout readiness artifact and reconcile script output are internal/ops-facing — English is
  acceptable for script comments and the readiness checklist itself (these are not user-facing UI).

---

## Shared Touch Rules (verbatim from kickoff scope, expanded)

1. **`dashboard-data-table.tsx`** — extend P1's component ADDITIVELY only (export-trigger wiring).
   No rewrite of sort/paginate. If the export feature genuinely requires a sort/paginate behavior
   change (e.g. exporting must ignore pagination and return the full filtered set), implement that
   as a NEW prop/code path alongside the existing one, never by modifying the existing
   sort/paginate function bodies. Regression-check existing sort/paginate against P2/P3/P4's
   current usage before and after this change (see Regression Checkpoint in Exit Gate).
2. **`auth-guard-coverage.test.ts`** — append ONLY export-route entries. Do not touch, reorder, or
   remove P1–P4's existing entries in this file.
3. **Bugs found in P2/P3/P4 logic** — during the cross-dashboard audit or full regression run, if a
   bug is found in a dashboard's OWN logic (not the export/audit surface Phase 5 owns), it is
   documented in the Phase 5 report under `## Bugs Routed to Other Phases` and a PLAN-SUPPLEMENT
   request is raised against that phase's plan file — Phase 5 NEVER fixes it inline by editing that
   phase's owned files.

---

## Bugs Routed to Other Phases` and a PLAN-SUPPLEMENT
   request is raised against that phase's plan file — Phase 5 NEVER fixes it inline by editing that
   phase's owned files.

---

## Implementation Checklist

### Step 0 — Confirm real interfaces before writing code (RESEARCH prerequisite)

- [x] 0.1. Read `phase-01-erp-read-foundation_REPORT_22-09-26.md` (the 18-09-26 EXECUTE-time
      report was folded into its Appendix and deleted, 22-09-26) to confirm the exact file names and
  exported function signatures for: `guardedQuery`, `assertReadOnlySql`, the cache wrapper, the
  degrade-path helper, and `dashboard-data-table.tsx`'s real prop shape (sort/paginate API surface).
- [x] 0.2. Read `phase-02-sales-dashboard_REPORT_22-09-26.md`, `phase-03-purchase-dashboard_REPORT_18-09-26.md`,
  `phase-04-production-dashboard_REPORT_18-09-26.md` to confirm each dashboard's exact data-fetch
  function names/paths for its main list and line/detail data, and each dashboard's exact
  `canSeeMoney` gating implementation (confirm it is truly server-side in every case — this is the
  audit's core assumption to verify, not assume). **Confirmed 22-09-26 (RESEARCH):** Sales =
  `fetchDoHeaders`/`fetchDoLines`/`fetchDoByProduct`/`fetchDoByCustomer` (`src/lib/sales-queries.ts`);
  Purchase = `fetchPurchaseInvoices`/`fetchPoCommittedTotals`/`fetchSupplierBreakdown`/
  `fetchPoList`/`fetchPoLines`/`fetchPoReceived` (`src/lib/purchase-data.ts`); Production =
  `getProductionMoList`/`getMaterialIssuesForMo` (`src/lib/production-data.ts`). **Architecture
  mismatch found:** none of these functions take a role/`canSeeMoney` parameter — they always
  return full money data. The real server-side gate is `const canSeeMoney = user.role === "ADMIN"`
  computed in each `page.tsx` and passed down as a prop to server-rendered components, which
  conditionally omit money JSX. This changes how AC9-fetch must be proven — see the rewritten
  Step C1 below.
- [x] 0.3. Confirm the ERP fixture DB (`erp_fixture`) state and how to force the "ERP unreachable"
  condition for `e2e/dashboards-degraded-mode.spec.ts`. **Confirmed 22-09-26 (RESEARCH): no
  mock/offline-ERP-driver convention exists in P1-P4.** Sales' own "ERP-unreachable resilience"
  e2e test (`e2e/dashboards-sales.spec.ts`, ~line 471) is SELF-SKIPPING — it calls
  `/api/health/erp` and does `test.skip(await erpHealthy(page), ...)`, asserting the degrade UI
  only if the sandbox happens to already be unreachable; it never actually forces the ERP down.
  Phase 5's AC15 (force all 3 dashboards down simultaneously) has no existing mechanism to build
  on — see Step 0.3a (new) below, which this phase must build.
- [x] 0.4. If any of 0.1–0.3 reveal a name/shape that differs from this plan's assumptions, record
  the actual names in the phase report's `## Interface Confirmation` section and proceed using the
  real names — do not silently rename this plan's file references; note the deltas.
- [x] 0.3a. **(New, added by 22-09-26 supplement — residual b/RESEARCH finding)** Build the FIRST
  real force-down mechanism for the ERP-unreachable condition, since none exists to reuse: add a
  test-only override checked by `src/lib/erp/pool.ts`/`degrade.ts` (e.g. an `ERP_FORCE_DEGRADE`
  env flag, or pointing the ERP pool at an unreachable host/port under test) so
  `e2e/dashboards-degraded-mode.spec.ts` can force AND assert the degraded state for real, rather
  than self-skipping like Sales' existing test. If this genuinely requires editing a Phase-1-owned
  file (`pool.ts`/`degrade.ts`), raise it as a Registry Change Request (see `## Registry Change
  Requests`) before editing — do not self-authorize a Phase-1 file edit.
- [x] 0.3b. **(New — mechanical-feasibility finding from this PVL cycle, 22-09-26 inner-PVL.)**
  `playwright.config.ts`'s `webServer` reuses ONE shared `pnpm start` process for the entire e2e
  suite (`reuseExistingServer: !CI`), and `getErpPool()` (`src/lib/erp/pool.ts`) caches its
  connection pool as a `globalThis` singleton keyed to whichever `ERP_DATABASE_URL` was in effect
  the FIRST time any route called it — a later env-var change has no effect for the rest of that
  process's lifetime. This rules out "point `ERP_DATABASE_URL` at an unreachable host" as a
  per-spec toggle (Step 0.3a's second suggested option): it would either break every OTHER spec
  sharing the same server, or do nothing if the pool is already cached from an earlier spec. The
  viable mechanism is an **in-process, HTTP-reachable toggle**: add a small test-only route (e.g.
  `POST /api/test/erp-force-down`, gated to `NODE_ENV !== "production"`) backed by a new exported
  in-memory flag setter alongside the existing `resetErpReadOnlyLoginState`/`clearErpCache`
  test-only exports, checked per-call by `guardedQuery`/`getErpPool` and, when set, synthetically
  throwing instead of touching the real pool. The e2e spec flips it via `page.request.post(...)`,
  the same way it already drives the app via `page.goto(...)`. **Sequencing requirement:**
  `cache.ts`'s degrade path only serves a stale value when a PRIOR successful fetch already
  populated that cache key — an empty cache re-throws and lands on `*-unavailable.tsx`, not the
  "ข้อมูลอาจไม่ล่าสุด" banner. Step D1's spec MUST (1) visit each dashboard once while the ERP is
  healthy to warm the cache, (2) call the force-down toggle, (3) reload/revisit and assert the
  banner — asserting on a cold cache false-fails onto the Unavailable screen instead of proving
  the degrade path.

### Step A0 — Fix fixture seed order-dependency bug (New, added by 22-09-26 supplement — residual a)

- [x] A0.1. `db/erp-fixture/purchase-seed.sql` and `db/erp-fixture/production-seed.sql` share
  `dbo.InventoryFlowHdr`/`InventoryFlowDtl` via a guarded `CREATE TABLE IF NOT EXISTS`, but only
  `purchase-seed.sql` follows its `CREATE` with idempotent `IF COL_LENGTH(...) IS NULL ALTER TABLE
  ... ADD` fallbacks for its own columns (`VoucherNo`/`InOut`/`InOutDate`/`Approved`/etc.).
  `production-seed.sql` has NO such fallback for its columns (`DocuNo`/`TransactionDate`/
  `WarehouseCode`/`Qty`). Both column families are real/live (confirmed against
  `db/erp-queries/purchase/po-received.sql` and `db/erp-queries/production/material-issues.sql`
  respectively) — this is one evolved live table carrying two independently-used column families,
  not a spelling error to converge on one side. If `purchase-seed.sql` runs first, the table is
  created narrow and `production-seed.sql`'s `INSERT` fails with "Invalid column name."
- [x] A0.2. Add symmetric `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD` guards to BOTH seed
  files so the shared table ends up with the full column union regardless of run order — do not
  pick one spelling over the other.
- [x] A0.3. Add a fixture-idempotency regression test (Fully-Automated): re-run both seeds against
  a throwaway schema in both orders (purchase-then-production AND production-then-purchase) and
  assert zero SQL errors in either order. This closes a previously untested infra gap.

### Step A — CSV export route(s)

- [x] A1. Decide route shape: one shared `src/app/api/dashboards/export/route.ts` taking a
  `?dashboard=sales|purchase|production` query param and delegating to per-dashboard serializers, OR
  three separate routes under `src/app/api/dashboards/export/{sales,purchase,production}/route.ts`.
  Prefer the shared-route-with-delegation shape (fewer `requireAuth()`/row-cap/BOM call sites to
  keep consistent) unless RESEARCH finds a reason (e.g. wildly different response shaping) to split.
  Record the decision (with rationale) in the phase report's `## Decisions` section.
- [x] A2. Implement a small shared CSV-serialization helper (e.g. `src/lib/erp/csv-export.ts`) that:
  (a) prepends the UTF-8 BOM (`﻿`) to the output so Excel opens Thai text correctly, (b) joins
  rows with `\r\n` and quotes fields containing commas/quotes/newlines per RFC 4180, (c) accepts a
  pre-built `{ headers: string[], rows: (string|number)[][] }` shape so each dashboard's route just
  supplies already-money-filtered, already-BE-formatted data — the helper does no business logic.
  (Note: this helper is a small addition inside the Phase-5-owned `src/app/api/dashboards/export/**`
  tree or a new `src/lib/erp/csv-export.ts` file — both are within this phase's blast radius; avoid
  creating it under `src/lib/erp/erp-adapter.ts` or any Phase-1-owned file.)
- [x] A3. Wire each of the three dashboards' export path: call the SAME data-fetch function the
  dashboard page uses (per Step 0.2), apply `canSeeMoney` column-stripping server-side, apply the
  row cap, format dates via `ceToBeDisplay()`, run through the CSV helper, return with
  `Content-Type: text/csv; charset=utf-8` and a `Content-Disposition: attachment; filename="..."`
  header using the ASCII filename convention above.
- [x] A4. Every export route calls `requireAuth()` (any authenticated role — Admin AND Staff can
  export, per AC14; the role-gate is on MONEY COLUMNS within the export, not on export access
  itself) at the top of the handler, matching the existing route-handler `requireAuth()` convention.
- [x] A5. Route every export's underlying ERP read through the SAME `guardedQuery` choke point the
  dashboard page already uses (i.e. do not bypass it by calling the ERP pool directly from the
  export route) — confirm this by construction (the export calls the page's existing data function,
  which already goes through `guardedQuery`).
- [x] A6. **Confirmed 22-09-26 (RESEARCH): zero route-handler (`route.ts` `export async function
  GET/POST`) coverage pattern exists in `auth-guard-coverage.test.ts`** — it only covers
  `export async function` server actions (via `extractExportedActions`) and print pages (via a
  dedicated grep); `/api/health` and `/api/health/erp` are explicitly, deliberately exempted as
  public probes. Step A6 is the FIRST to need this pattern (not a re-confirmation). Generalize the
  `extractExportedActions`-style parsing to also match `export async function GET(`/`POST(` shapes,
  then append the new export route(s)' entries using the same "parse exported handler, assert
  requireAuth call" shape used for actions.

### Step B — dashboard-data-table.tsx export-trigger wiring

- [x] B1. Read the actual `dashboard-data-table.tsx` (Phase 1's file) to confirm its real prop
  interface and where the sort/paginate controls render.
- [x] B2. Add an additive `exportHref` (or equivalent) prop that, when supplied, renders the
  "ส่งออก CSV" button linking to the correct `/api/dashboards/export?...` URL WITH the current
  filter/sort/page state serialized into the query string (so the export always reflects "the
  current filtered view" per AC14's exact wording).
- [x] B3. Confirm via manual read (not assumption) that adding this prop requires zero changes to
  the existing sort/paginate function bodies — if it does require a change, stop and flag the
  regression risk in the phase report before proceeding, per the Shared Touch Rules above.
- [x] B4. Wiring the new prop into each dashboard's usage of `dashboard-data-table.tsx` touches
  the CALL SITE inside the wrapper components — **confirmed 22-09-26 (RESEARCH): the exact call
  sites are `do-list-table.tsx`, `do-lines-table.tsx` (sales), `po-list-table.tsx`,
  `po-lines-table.tsx` (purchase), `mo-list-table.tsx` (production), plus the production
  `[moNumber]/page.tsx` inline usage** — NOT the top-level `page.tsx` files generically. All 5 live
  under the SAME `src/app/(main)/dashboards/{sales,purchase,production}/**` tree the registry lists
  under Phase 5's "Explicit non-overlap". **No unwritten registry exception covers this, and no
  P2/3/4-left export stub exists (confirmed via grep — zero hits)** — the registry's "extends
  additively" language is scoped to `dashboard-data-table.tsx` itself (Phase 1's file), not to
  P2/3/4's wrapper files. Do NOT proceed on an assumed exception. Since no stub exists, Fallback 2
  (Registry Change Request) is the only viable path — before editing any of the 5 wrapper files
  (or the one inline page usage), do ONE of the following, in order of preference:
  1. **Preferred — no Phase 5 edit to P2/3/4 files at all.** Check whether Phase 2/3/4's own
     execution already wired a stub `exportHref`-shaped call site into their
     `dashboard-data-table.tsx` usage (raised as a coordination note to those phases' plans/reports
     during RESEARCH, Step 0). If so, Phase 5 only supplies the URL-building logic and the
     Phase-1-owned component; it never edits the P2/3/4 page files itself.
  2. **Fallback — explicit Registry Change Request.** If no such stub exists, write a
     `## Registry Change Requests` entry (this file, below) BEFORE editing any P2/3/4 page file,
     naming the exact call-site lines to change and why a single additive prop value is the
     narrowest possible touch. Surface the request to the orchestrator and wait for it to be
     resolved (either an explicit registry amendment, or routing the edit back to the owning
     phase as a PLAN-SUPPLEMENT) before writing any code inside `dashboards/{sales,purchase,
     production}/**`. Do not silently self-authorize the edit.
  3. **Cross-reference (added this PVL cycle):** `## Registry Change Requests` below now records
     that the registry's §Phase 5 section contains a SEPARATE named exception (for literal
     `page.tsx` paths) beyond the `dashboard-data-table.tsx` "extends additively" bullet — read
     that section's full correction before drafting the Fallback-2 request, so the request asks
     the orchestrator the precise open question (does the existing exception extend to the 5
     wrapper files) instead of requesting a brand-new exception from scratch.

### Step C — Cross-dashboard money-gate audit (AC9 full audit)

- [x] C1. **(Rewritten 22-09-26 supplement — RESEARCH found an architecture mismatch: the
  dashboard data-fetch functions confirmed at Step 0.2 take no role parameter, so they cannot be
  "called with a STAFF role.")** Write `src/lib/__tests__/dashboards-money-audit.test.ts` in two
  testable halves:
  - **C1a (export routes — genuinely role-testable):** for each of the 3 NEW Phase-5 export
    routes, assert that calling the route handler with a STAFF-role auth context never includes
    any money-labeled field/column in the serialized CSV (literally absent, not just blank), and
    calling with ADMIN always includes it. Use the ERP fixture dataset (known values) so
    assertions are concrete, not just "field is undefined." This is directly testable because
    Phase 5 owns the role param at this layer (Step A3's `canSeeMoney` computation).
  - **C1b (existing P2/P3/P4 dashboard pages — static-source-coverage only, per Step C2):** since
    the page-level data-fetch functions have no role param, do NOT attempt to call them with a
    role. Instead rely on Step C2's static-source-coverage grep as the proving mechanism that each
    page's existing `const canSeeMoney = user.role === "ADMIN"` gate is present and guards every
    money-labeled render site.
- [x] C2. Add a static-source-coverage check (mirroring `auth-guard-coverage.test.ts`'s pattern) that
  greps every dashboard page/export-route source file for a money-labeled field name and asserts
  each site is guarded by a `canSeeMoney`/`role === "ADMIN"` check — a mechanical backstop against a
  future accidental unguarded money field, same rationale as the existing ELEV-guard comment block.
- [x] C3. Run this suite against ALL 3 dashboards in ONE test file (not 3 separate files) so the
  "cross-dashboard" framing in the umbrella/SPEC is literally proven by one shared assertion set,
  not 3 independent per-dashboard checks that happen to exist.

### Step D — Degraded-mode + pilot-banner cross-dashboard e2e (AC15/AC16)

- [x] D0. AC2 unauth-redirect confirmation for Purchase and Production specifically: per the
  umbrella's Per-Phase Entry/Exit Gates table, Phase 2's own report already proves AC2 for
  `/dashboards/sales` (do NOT re-derive that case here). During RESEARCH Step 0, check whether
  Phase 3 and/or Phase 4's own e2e suites already added an unauth-redirect assertion for their
  route. If BOTH already cover it, this step is a mechanical re-confirmation only (re-run their
  existing assertions as part of Step F's full regression, no new spec code). If EITHER is
  missing, add the missing unauth-redirect assertion(s) into `e2e/dashboards-degraded-mode.spec.ts`
  (reusing this Phase-5-owned cross-cutting spec file rather than creating a new one) — assert an
  unauthenticated visitor requesting `/dashboards/purchase` and/or `/dashboards/production`
  directly is redirected to login, mirroring `e2e/auth.spec.ts`'s existing unauth-redirect pattern.
  Record which routes needed a new assertion vs. which were already covered in the phase report's
  `## Interface Confirmation` section.
- [x] D1. Write `e2e/dashboards-degraded-mode.spec.ts`: force the ERP-unreachable condition (per
  Step 0.3's confirmed mechanism) and assert ALL THREE dashboards (not just one) show their
  last-cached figures + the "ข้อมูลอาจไม่ล่าสุด" banner, never a generic error page or blank screen.
- [x] D2. In the same spec (or a shared `beforeEach`), assert the "ข้อมูลนำร่อง" pilot banner is
  visible on all three dashboards under normal (non-degraded) conditions too, since AC16 says "at
  all times."
- [x] D3. Write `e2e/dashboards-export.spec.ts`: for each of the 3 dashboards, as ADMIN trigger the
  export and assert the downloaded CSV contains a money column with a known fixture value; as STAFF
  trigger the same export and assert the CSV has NO money column at all (header count differs, not
  just a blank value) and no money value string appears anywhere in the file body.

### Step E — Guard re-confirmation (AC17)

- [x] E1. Re-run the ~24-case `assertReadOnlySql` guard test suite (Phase 1's owned test file) as-is
  — this phase does not modify it, only confirms it is still green after P2/P3/P4/P5 added new SQL
  files, since a new SQL file with an unexpected statement shape could theoretically reveal a guard
  gap the fixture-only P1 tests didn't cover.
- [x] E2. Grep every new `.sql` file added across P1–P5 (`db/erp-queries/**/*.sql`) for any
  write/DDL keyword as a mechanical sanity double-check (this is belt-and-suspenders on top of the
  runtime guard, not a replacement for it) — if anything untoward is found, this is a program-level
  hard-stop, not a phase-5-fix-inline situation; escalate immediately per the umbrella's Hard Safety
  Constraints.

### Step F — Full regression suite

- [x] F1. Run `pnpm test` (full Vitest suite — every existing unit test, not filtered to
  dashboard-related files) and confirm 0 regressions against the pre-Phase-5 baseline count.
- [x] F2. Run `pnpm test:e2e` (full Playwright suite across all projects — `setup`, `chromium`,
  `mobile`, `tablet`) and confirm 0 regressions against the pre-Phase-5 baseline count, including
  the existing `e2e/mobile.spec.ts` 3-tab assertion (must still show exactly 3 tabs).
- [x] F3. Run `pnpm lint` and `pnpm build` and confirm both exit 0.
- [x] F4. Record the exact before/after test counts (Vitest files/tests, Playwright specs/tests) in
  the phase report, matching the existing convention in `process/context/all-context.md`'s Scan
  Metadata history.

### Step G — Manual live-reconcile script (USER-RUN)

- [x] G1. Write `src/lib/erp/live-reconcile-script.ts` — a standalone, human-invoked script (e.g.
  run via `pnpm tsx src/lib/erp/live-reconcile-script.ts`) that connects through the SAME
  `guardedQuery` choke point (read-only, enforced) and prints a side-by-side comparison of each
  dashboard's headline figures against a manually-supplied or independently-queried reference value
  from KRS's own report procedures (e.g. `sp_PurchaseInvoiceMonth`, `sp_Popending`). The script
  itself performs NO write, and its whole purpose is a printed diff report — it does not "fix"
  anything.
- [x] G2. **USER-RUN, not agent-run:** this phase writes the script and documents exactly how to run
  it (in the phase report and/or the rollout-readiness artifact), but the actual execution against
  live db_TCL, and the recording of its output as the "manual reconcile completed" evidence, is a
  human/ops step. Do not execute this script against db_TCL from an agent session.
- [x] G3. Document in the phase report that this step's evidence is "script written and instructions
  recorded; execution pending human/DBA action" unless the user explicitly runs it and shares
  results during this session.

### Step H — AC18 boot-probe recording

- [x] H1. Confirm Phase 1's boot permission probe (refuses to start if the connected ERP login is
  write-capable) runs correctly in FIXTURE mode — this is Fully-Automated/Hybrid and should already
  be covered by Phase 1's own tests; Phase 5 re-confirms it as part of the full regression run
  (Step F1), it does not re-implement it.
- [x] H2. Record the LIVE-mode AC18 status explicitly as a **known-gap** in the phase report: the
  live boot-probe against the real scoped read-only ERP login cannot be exercised until that login
  is provisioned (Phase 0's `db/create-erp-readonly-login.sql`, USER-RUN by the DBA). This is the
  SPEC's own explicitly-justified residual (AC18's `strategy: Agent-Probe` note) — do not attempt to
  fabricate or simulate a "live" result.
- [x] H3. If the login IS provisioned and available by the time this phase executes, run the boot
  probe against it for real and record a genuine Agent-Probe verdict (PASS/FAIL) instead of a
  known-gap.

### Step I — Production rollout readiness

- [x] I1. Write `erp-dashboards-rollout-readiness_REF_18-09-26.md` in this task folder: a checklist
  of every remaining item before dashboards go live for real customer use, explicitly separating
  USER-RUN/ops items (scoped read-only login provisioning, DNS/host items if any, DBA delivery
  scripts) from anything still agent-actionable. Cross-reference the umbrella's Hard Safety
  Constraints so the checklist is provably complete against them.
- [ ] I2. **DEFERRED TO STEP 7 (UPDATE PROCESS) — documented reason, not skipped.** Update
  `process/context/all-context.md`'s erp-dashboards feature entry with the program-complete status
  line (per the registry's Phase 5 rule) — do not restructure Phase 0–4's entries, only add/update
  Phase 5's own line and the overall feature status summary.
  **Why deferred:** EXECUTE is phase-locked out of `process/context/**` ("Creating or modifying
  files under `process/context/` — context doc updates are reserved for UPDATE PROCESS phase"), and
  this plan's own Phase Loop Progress step 7 already assigns `process/context/all-context.md` to
  UPDATE PROCESS. Writing it here would duplicate that step and violate the phase lock.
  **Ready-made content for step 7** (the updater still owns final wording):
  - Feature status: `IN PROGRESS` -> **program-complete at agent level**, all 6 phases (0-5) done;
    Phase 5 ✅ at agent level pending the EVL confirmation run.
  - Phase 5 line: CSV export on all six dashboard tables (UTF-8 BOM, Thai headers, BE dates,
    5,000-row cap with a visible truncation notice, ASCII filename, STAFF money columns omitted
    entirely); the cross-dashboard AC9 money audit; the first real ERP force-down mechanism
    (`src/lib/erp/force-down.ts` + the `NODE_ENV`/`ERP_TEST_FORCE_DOWN`-gated
    `/api/test/erp-force-down` route) proving AC15/AC16 across all three dashboards at once; AC17
    re-confirmed plus a permanent sweep running the real `assertReadOnlySql` over all 13 shipped
    query files; the `production-seed.sql` order-dependence fix with a red-then-green regression
    gate; the USER-RUN read-only reconcile script; and the rollout-readiness checklist.
  - Test counts: unit **390 -> 523 tests / 30 -> 32 files** (with the ERP fixture wired; 490 passed
    / 33 self-skipped without it); e2e **119 -> 145 passed / 7 skipped**, gaining
    `dashboards-export.spec.ts` (14) and `dashboards-degraded-mode.spec.ts` (8).
  - Zero schema change; `package.json` untouched; db_TCL never contacted.
  - Remaining gate to real go-live: the DBA-provisioned scoped read-only ERP login — see
    `erp-dashboards-rollout-readiness_REF_18-09-26.md`.

---

## Bugs Routed to Other Phases (fill in during EXECUTE if found)

(Placeholder — this section is populated during EXECUTE if the cross-dashboard audit or full
regression run finds a bug in P2/P3/P4's own logic. Format per entry:)

- **Bug:** [description] — **Found in:** [dashboard/phase] — **Routed as:** PLAN-SUPPLEMENT request
  to `phase-0N-*_PLAN_18-09-26.md` — **Status:** [pending / applied]

**EXECUTE outcome (22-09-26): NONE.** The cross-dashboard money audit and the full regression run
found no bug in any Phase 2/3/4 dashboard's own logic. Every money site on all three dashboards was
already gated server-side, and every pre-existing spec stayed green. No PLAN-SUPPLEMENT was raised
against Phase 2, 3, or 4.

---

## Test Plan (TDD-first — tier assignments)

**TIER ASSIGNMENTS PROVISIONAL** — the executing agent's RESEARCH step MUST load
`process/context/tests/all-tests.md` and its downstream routing chain, and discover the real Phase
1–4 test files, before PVL. If that chain is not loaded, `vc-validate-agent` must emit
`TIER_ASSIGNMENTS_BLOCKED` rather than accept these tiers as final.

**Area: Cross-dashboard money-gate audit (high-risk: money-visibility access control)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | STAFF role receives zero money fields across all 3 dashboards' data-fetch functions + export routes | `pnpm test -- dashboards-money-audit` | server-side omission, not client hide | UI rendering itself |
| Fully-automated | Static-source-coverage: every money-labeled field site is guarded by `canSeeMoney`/`role==="ADMIN"` | same suite, static-grep sub-test | mechanical backstop against future unguarded field | runtime correctness of the guard logic itself |
| Hybrid | AC14 export role-gate: ADMIN CSV has money column with correct fixture value; STAFF CSV has none | `e2e/dashboards-export.spec.ts` against `erp_fixture` | end-to-end export money-gate | live db_TCL export |

**Area: Degraded-mode + pilot banner (cross-dashboard)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | All 3 dashboards show last-cached + "ข้อมูลอาจไม่ล่าสุด" on forced ERP-down | `e2e/dashboards-degraded-mode.spec.ts` (mock/offline driver) | graceful degrade across the set | real live ERP outage behavior |
| Hybrid | "ข้อมูลนำร่อง" banner visible on all 3 dashboards under normal conditions | same spec | pilot disclosure present everywhere | banner removal criteria (data-volume threshold) |

**Area: Read-only guard re-confirmation (high-risk: write-prevention)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | ~24-case `assertReadOnlySql` guard suite still green after P1-P5 SQL additions | `pnpm test -- erp-adapter` (exact file name confirmed at Step 0.1) | guard intact against the full accumulated SQL set | a genuinely novel bypass class not covered by the 24 cases |
| Fully-automated | No new `.sql` file across P1-P5 contains a write/DDL keyword | grep sanity check (Step E2) | mechanical double-check | semantic correctness of read-only queries |

**Area: AC2 unauth-redirect confirmation (Purchase + Production only)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Unauthenticated visitor requesting `/dashboards/purchase` or `/dashboards/production` directly is redirected to login | `pnpm test:e2e -- dashboards-degraded-mode` (Step D0 assertions) | route-level auth gate holds for these 2 routes | Sales' own AC2 coverage (already proved by Phase 2, not re-derived) |

**Area: Full regression (program-wide)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | Full Vitest suite green, 0 regressions vs. pre-Phase-5 baseline | `pnpm test` | no unit-level regression from P1-P5 | integration/e2e behavior |
| Fully-automated | Full Playwright suite green (all 4 projects), 0 regressions, 3-tab bar still exactly 3 | `pnpm test:e2e` | no e2e regression, no bottom-tab-bar regression | production/live-DB behavior |
| Fully-automated | Lint + build both exit 0 | `pnpm lint && pnpm build` | no type/lint/build regression | runtime correctness |

**Area: AC18 boot-probe + manual live-reconcile (production-gate, high-risk: auth/identity)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Agent-Probe (fixture) | Boot probe refuses a write-capable login in fixture mode | re-run Phase 1's own probe test as part of Step F1 | probe logic correctness | live-login behavior |
| Known-gap (accepted, per SPEC AC18) | Boot probe against the REAL scoped read-only ERP login | — (blocked until Phase 0's login is provisioned by the DBA) | — | live-mode read-only guarantee — this is the SPEC's own explicitly-justified residual; do not attempt to close it without the real login |
| — (manual, USER-RUN) | Live-reconcile-vs-KRS-procs comparison | `pnpm tsx src/lib/erp/live-reconcile-script.ts` run by a human against real db_TCL | real-data plausibility of headline figures | automated/continuous correctness (explicitly out of scope) |

### Gap Resolution Options

| Gap | Resolution options |
|---|---|
| AC18 live-mode boot-probe cannot run without the real scoped login | A) Write new test — not possible without the login; no effort estimate applies. B) Set up infra — provision the login (Phase 0 delivery script, DBA-run, outside this phase's control). C) Accept as known-gap — YES, this is the SPEC's own explicitly-justified residual (AC18 strategy note); rationale: no live write-capable-login-refusal path can be proven without a real, provisioned login, and simulating one would not prove anything about the real server's actual permission grants. D) Backlog artifact — record in the rollout-readiness REF (Step I1) as the single hard-gating remaining item. |
| Manual live-reconcile is human-run, not agent-executed | A) N/A — by SPEC design, this is intentionally manual (Out Of Scope explicitly forbids an automated reconciliation job). C) Accept as known-gap-by-design — this is not a gap, it is the correct, SPEC-mandated shape; rationale: the umbrella's hard safety constraints forbid any agent DDL/write access to db_TCL, and a "manual" step is the safe design, not a shortfall. D) Backlog artifact — none needed; document the run-instructions in the phase report and rollout-readiness REF. |

### Missing Test Areas

| Area | Why untestable in this phase | Resolution chosen |
|---|---|---|
| Real db_TCL data behind the live boot-probe and live-reconcile | Requires the real scoped read-only login (Phase 0 DBA delivery, not yet provisioned) and live production DB access this program's hard safety constraints forbid agents from touching except read-only reconcile checks | Backlog: tracked as the single hard-gating rollout-readiness item (Step I1); becomes testable the moment the login is provisioned |
| CSV rendering fidelity in actual Excel/Google Sheets (BOM handling, Thai glyph rendering) | Requires opening the file in a real spreadsheet application, not reproducible in a headless test run | Agent-Probe row not included above by design (the export e2e checks file CONTENTS, not visual spreadsheet rendering); if desired, add a manual open-in-Excel probe as an optional Agent-Probe row during EXECUTE and record judgment then |

---

## High-Risk Class Table

| Area | High-risk class | Minimum tier | Gap rationale if known-gap accepted |
|---|---|---|---|
| Cross-dashboard money-gate audit (AC9) | billing/money-visibility (treated as billing-adjacent per umbrella's access-control framing) | Hybrid | — (Fully-Automated achieved; no known-gap accepted) |
| CSV export money-column stripping (AC14) | billing/money-visibility | Hybrid | — (Hybrid achieved via e2e; no known-gap accepted) |
| Read-only guard re-confirmation (AC17) | schema/migration-adjacent (write-prevention on external DB) | Hybrid | — (Fully-Automated achieved; no known-gap accepted) |
| AC18 live-mode boot-probe | auth/identity (login permission verification) | Hybrid | Accepted known-gap — see Gap Resolution Options above; blocked on Phase 0's DBA-run login provisioning, explicitly justified in the SPEC itself |

---

## Exit Gate

```bash
pnpm test
# Expected: exit 0, 0 failures, count includes the new dashboards-money-audit.test.ts

pnpm test:e2e
# Expected: exit 0, includes dashboards-export.spec.ts and dashboards-degraded-mode.spec.ts green,
# plus every pre-existing spec (mobile.spec.ts 3-tab assertion unchanged) still green

pnpm lint
# Expected: exit 0

pnpm build
# Expected: exit 0
```

- AC2 green for `/dashboards/purchase` and `/dashboards/production` specifically (Step D0) — Sales'
  AC2 coverage is already proved by Phase 2's report and is NOT re-derived here; Phase 5 confirms
  or adds the Purchase/Production unauth-redirect assertions only.
- AC9 full cross-dashboard audit green (Step C).
- AC14 green on all 3 dashboards (Step D3 / `dashboards-export.spec.ts`).
- AC15 green on all 3 dashboards simultaneously (Step D1).
- AC16 green on all 3 dashboards (Step D2).
- AC17 green (re-confirmed guard suite + SQL-file sanity grep, Step E).
- Full regression suite green (Step F): `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm build` all
  exit 0 with 0 regressions against the pre-Phase-5 baseline.
- Manual live-reconcile script written and run-instructions recorded (Step G) — execution itself is
  USER-RUN; phase report states execution status honestly (executed-with-results, or
  pending-human-action).
- AC18 boot-probe recorded: fixture-mode PASS confirmed; live-mode explicitly recorded as accepted
  known-gap (or a genuine live PASS/FAIL if the login happens to be available) — never fabricated.
- `erp-dashboards-rollout-readiness_REF_18-09-26.md` written (Step I1).
- Phase report written to the report destination above.
- All Implementation Checklist items checked or explicitly marked with a documented reason
  (blocked/deferred/routed).

**Mechanical validators to run:**

```bash
node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_PLAN_18-09-26.md
# Expected: PASS (0 failures)

node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_PLAN_18-09-26.md
# Expected: PASS (0 failures)

node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs
# Expected: exit 0

node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs
# Expected: exit 0
```

---

## DB-Safety Notes

- **Fixture-only development, always.** Every automated/hybrid gate in this phase runs against the
  `erp_fixture` sandbox database (Phase 1's fixture), never against live db_TCL, except the
  explicitly human-run live-reconcile script (Step G) and the explicitly human-run live boot-probe
  (Step H3, only if the login happens to already exist).
- **Never execute `live-reconcile-script.ts` from an agent session against db_TCL.** The script is
  written and its invocation instructions are documented; a human runs it. If the user explicitly
  runs it and shares output during this session, record the results — do not proactively invoke it.
- **Never propose or draft a DDL/login change against db_TCL from this phase.** Any such need is
  routed to the existing Phase 0-owned `db/create-erp-readonly-login.sql` delivery-script path,
  never authored or run here.
- **The export routes and audit tests never write to the ERP** — every read goes through the SAME
  `guardedQuery` choke point already enforced by Phase 1; this phase adds no new write-capable code
  path anywhere.
- **`erp_fixture` remains a SEPARATE sandbox database from the Prisma `orderstock` sandbox DB** —
  this phase's new tests must connect through the ERP pool (`src/lib/erp/pool.ts`), never through
  `src/lib/db.ts`'s Prisma client, confirming the existing P1 separation is not blurred by any new
  test file added here.

---

## Rollback

- All new files in this phase (export routes, CSV helper, audit test, e2e specs, reconcile script,
  rollout-readiness REF) are pure additions — rollback is `git revert` of this phase's commit(s),
  with no data-loss risk since nothing in this phase writes to any database (ERP or orderstock).
- The one extension to a shared file (`dashboard-data-table.tsx`) is additive (new optional prop) —
  reverting this phase's commit fully restores Phase 1's original component with zero impact on
  P2/P3/P4's existing usage, since those usages simply won't pass the new prop if reverted.
- The one append to `auth-guard-coverage.test.ts` is a pure addition of new `it()` blocks / array
  entries — reverting removes exactly those without touching P1-P4's existing entries.
- If the cross-dashboard audit (Step C) or full regression (Step F) reveals a genuine bug in
  P2/P3/P4's own logic, do NOT attempt an in-place fix-and-continue in this phase — document it
  (Bugs Routed to Other Phases section) and let that phase's own PLAN-SUPPLEMENT cycle handle the
  fix; this keeps Phase 5's rollback surface clean (revert Phase 5's commits without needing to
  also revert a cross-phase fix).

---

## Risks

- **Interface drift risk:** this plan was written before Phase 1-4 execute, so exact file/function
  names for the ERP read layer, dashboard data-fetch functions, and `dashboard-data-table.tsx`'s
  prop shape are BEST-GUESS based on the umbrella/registry naming conventions, not confirmed source.
  Mitigation: Step 0 (Confirm real interfaces) is a hard prerequisite before any code is written;
  if names differ, the phase report documents the actual names and this plan is treated as
  correctly superseded by that report, not silently wrong.
- **Additive-extension risk on `dashboard-data-table.tsx`:** if Phase 1's component was not built
  with export-friendly extensibility in mind (e.g. tightly coupled to page-side pagination state
  that can't easily expose "current filtered view" to a sibling export link), Step B3's flag-and-
  stop clause exists specifically to catch this without silently rewriting Phase 1's logic.
- **Cross-dashboard bug discovery risk:** the audit/regression steps may find real bugs in P2/P3/P4.
  This is by design (that is the point of Phase 5) — the "Bugs Routed to Other Phases" section and
  PLAN-SUPPLEMENT routing exist so this doesn't stall Phase 5's own exit gate on someone else's fix.
- **AC18 residual risk:** the live boot-probe cannot be genuinely proven without the real login.
  This is explicitly SPEC-sanctioned (not a plan gap) — Step H2 exists to make sure this is recorded
  honestly rather than glossed over as "done."
- **CSV Thai-encoding risk:** UTF-8 BOM handles Excel correctly on most modern versions, but very old
  Excel versions or some Linux spreadsheet tools may render differently. Mitigation: this is
  explicitly out of this plan's control (no `.xlsx` library in scope) — documented as a known
  limitation in the rollout-readiness REF, not something Step A/B needs to solve further.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `dashboards-money-audit.test.ts` — STAFF gets zero money fields across all 3 dashboards + exports | Fully-Automated | AC9 |
| `dashboards-money-audit.test.ts` static-source-coverage sub-test | Fully-Automated | AC9 |
| `e2e/dashboards-export.spec.ts` — ADMIN CSV has money column, STAFF CSV has none, all 3 dashboards | Hybrid | AC14 |
| `e2e/dashboards-degraded-mode.spec.ts` — cached values + "ข้อมูลอาจไม่ล่าสุด" on all 3 dashboards under forced ERP-down | Hybrid | AC15 |
| `e2e/dashboards-degraded-mode.spec.ts` — "ข้อมูลนำร่อง" visible on all 3 dashboards, normal conditions | Hybrid | AC16 |
| Re-run of Phase 1's ~24-case `assertReadOnlySql` guard suite + new-SQL-file grep sanity check | Fully-Automated | AC17 |
| `e2e/dashboards-degraded-mode.spec.ts` unauth-redirect assertions for Purchase + Production routes (Step D0; Sales already proved by Phase 2) | Fully-Automated | AC2 |
| Fixture-mode boot-probe re-confirmation (part of full regression) | Agent-Probe (fixture) | AC18 (fixture-mode component only) |
| `live-reconcile-script.ts` written + run-instructions recorded; execution USER-RUN | — (manual, non-tier) | supports program Definition of Done §5 (manual reconcile) |
| `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm build` full regression, 0 regressions vs. baseline | Fully-Automated | Program Goal Charter "What verified means" — regression evidence requirement |

---

## Test Infra Improvement Notes

- **`auth-guard-coverage.test.ts` currently has no route-handler (`route.ts` `export async function
  GET/POST`) coverage pattern** — it only covers `export async function` server actions (via the
  `extractExportedActions` splitter) and print pages (via a dedicated grep). This phase's Step A6
  will need to add the FIRST route-handler coverage pattern to this file. Recommend generalizing the
  splitter to also parse `export async function GET/POST` shapes so future route-handler additions
  (beyond just dashboard exports) reuse this pattern instead of each phase inventing its own ad hoc
  check.
- **No existing CSV-export testing convention exists anywhere in this codebase** — this phase
  establishes the first one (`e2e/dashboards-export.spec.ts` downloading and parsing a CSV response
  body). Recommend documenting the download-and-assert-body pattern in
  `process/context/tests/all-tests.md` once proven here, so any future export feature (e.g. a
  future `.xlsx` phase) has a precedent to follow instead of re-deriving it.
- **No mock/offline-ERP-driver convention is confirmed to exist yet** (Phase 1 is expected to build
  one for its own degraded-mode test, per the umbrella). Step 0.3 requires confirming and reusing it
  rather than building a second one; if Phase 1's mechanism turns out to be single-dashboard-scoped
  and doesn't generalize to "force all 3 dashboards down at once," that gap should be raised as a
  PLAN-SUPPLEMENT to Phase 1 rather than Phase 5 building a parallel mechanism.

---

## Known Residuals (22-09-26 supplement — folded in from orchestrator research findings)

Four residuals carried forward from the program's known-gaps list, now explicit plan steps or
recorded known-gaps (never silently dropped):

- **(a) Fixture seed order-dependency bug** — now an explicit checklist item: Step A0 (new, above)
  fixes the `purchase-seed.sql`/`production-seed.sql` shared-table column-union bug and adds a
  Fully-Automated idempotency regression test (A0.3).
- **(b) No live reconcile has ever run against db_TCL** — remains an explicit, honest known-gap.
  This phase delivers the SCRIPT and the procedure (Step G) but never the run itself; Step G3
  already documents this correctly ("script written; execution pending human/DBA action"). No
  further plan action — this is the SPEC-mandated, USER-RUN-by-design shape, not a shortfall.
- **(c) The scoped read-only ERP login does not exist yet** — remains an explicit known-gap gating
  production go-live (AC18-live in the Validate Contract, and the single hard-gating item in the
  rollout-readiness checklist, Step I1). No further plan action until Phase 0's DBA delivery
  script runs.
- **(d) Open UI questions never answered by the user** (phone route into dashboards, donut-vs-pie
  mix, menu/page naming, app-wide white-on-green button contrast) — recorded here as accepted
  defaults, not blockers: no phone route is added (per SPEC Out Of Scope: "no 4th phone
  bottom-tab-bar entry"); donut-vs-pie mix follows each dashboard's own already-built mockup
  choice (Phase 5 does not redesign P2/3/4 charts); menu/page naming is unchanged from P1-P4;
  the white-on-green button contrast issue (3.0:1) is explicitly OUT OF SCOPE for this phase — it
  is a cross-cutting accessibility concern belonging to a separate future pass, not this program's
  hardening/export/rollout phase. No plan action needed; noted here so it is not silently lost.

---

## Blockers That Would Justify BLOCKED Status

- Phase 2, 3, or 4's exit gate has not actually passed (validate-contract missing `Gate: PASS`, or
  the phase report shows unresolved FAIL items) — Phase 5 cannot audit dashboards that don't exist
  yet or aren't proven correct at their own layer.
- `dashboard-data-table.tsx` (Phase 1) is structurally incompatible with additive export-trigger
  wiring without a rewrite (Step B3's flag-and-stop condition) — this becomes a registry change
  request / PLAN-SUPPLEMENT to Phase 1, not a Phase 5 BLOCKED-forever state.
- Step B4's export-trigger call-site wiring has no P2/3/4-left stub AND the raised Registry Change
  Request is not yet resolved by the orchestrator — Phase 5 pauses at Step B4 (does not
  self-authorize the edit) until the request is resolved via registry amendment or PLAN-SUPPLEMENT
  routing.
- The full regression run (Step F) reveals a P1-P4 regression that cannot be resolved via
  PLAN-SUPPLEMENT routing within the supplement-cycle cap — escalate per orchestration.md's BLOCKED
  Escalation Path.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner
loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop; this
phase's SPEC-governing document is `erp-dashboards_SPEC_18-09-26.md`, frozen).

- [x] 1. RESEARCH — research-agent: read Phase 1-4 reports (Step 0 above), confirmed real
  interfaces (see notes in Step 0.2/Step B4 above), test context loaded, plan drift checked (3
  drifts found and fixed — see Inner Loop Refresh Note below)
- [x] 2. INNOVATE — innovate-agent: the export-route shape decision (Step A1: shared vs.
  per-dashboard routes) remains correctly deferred to EXECUTE-time INNOVATE per the plan's own
  design (RESEARCH found no new information forcing an earlier decision); no other design choice
  requiring INNOVATE was surfaced by this RESEARCH pass
- [x] 3. PLAN-SUPPLEMENT — plan-agent: updated this phase plan with confirmed real file/function
  names from Step 0 and applied all RESEARCH findings + the 4 known residuals; Inner Loop Refresh
  Note written below (dated 22-09-26)
- [x] 4. PVL — vc-validate-agent: full V1-V7 inner-PVL re-run complete (22-09-26); re-verified
  every Touchpoints/Blast Radius file path against disk, every Step 0.2 confirmed function name
  against source, and the stored-procedure names against the data dictionary (all matched); found
  and fixed 2 new plan gaps this cycle (Step 0.3a mechanical-feasibility addendum for the
  degraded-mode force-down mechanism; the overlooked registry named-exception clause for Step
  B4/Registry Change Requests) — see `## Validate Contract` below, `generated-by: inner-pvl:
  phase-5`
- [x] 5. EXECUTE — all checklist items (Steps A-I) done (22-09-26); per-section test gates run and
  green against `erp_fixture`; full regression green with ZERO regressions vs the recorded baseline
  (Vitest 523 passed/0 failed with ERP wired, 490 passed/33 skipped without; Playwright 145
  passed/7 skipped vs the 119/7 baseline = exactly the 26 new tests, nothing regressed); lint and
  build exit 0; no bug found in P2/P3/P4 logic, so `## Bugs Routed to Other Phases` stays empty;
  3 Registry Change Requests raised and recorded (see the phase report) — see
  `phase-05-hardening-export-rollout_REPORT_22-09-26.md`
- [x] 6. EVL — all EVL gates green (independent vc-tester re-run of the Exit Gate commands: full
  Vitest 523/0 with ERP wired, full Playwright 145/7 skipped vs 119/7 baseline = zero regressions,
  lint/build/typecheck clean, contract audit confirmed money-gate/read-only/idempotency claims from
  source); no follow-up code stubs required — EVL HANDOFF SUMMARY known_gaps are all documentation/
  registry-sign-off items, not code, folded into UPDATE PROCESS below
- [x] 7. UPDATE PROCESS — phase report corrected with EVL findings, umbrella `## Current Execution
  State` rewritten (program-complete), `process/context/all-context.md` + 3 group files updated,
  registry ledger appended, program archived, commit deferred to the user per this session's
  explicit no-commit instruction

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract`
below reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", the orchestrator
must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent
instructions / Test gates sections is treated as a placeholder.

---

## Inner Loop Refresh Note

**Date: 22-09-26**

RESEARCH (Step 1, this cycle) confirmed real Phase 1-4 interfaces and found three load-bearing
drifts from this plan's original best-guess assumptions, plus the four known residuals (a)-(d)
above. PLAN-SUPPLEMENT (Step 3, this cycle) applied the following fixes directly to this plan —
no scope expansion, all fixes stay inside this phase's owned blast radius:

1. Blast Radius §Explicit non-overlap — named the exact 5 wrapper-file call sites
   (`do-list-table.tsx`/`do-lines-table.tsx`/`po-list-table.tsx`/`po-lines-table.tsx`/
   `mo-list-table.tsx`) instead of the generic "page files" wording.
2. Step 0.2 — recorded confirmed real data-fetch function names and the AC9-fetch architecture
   mismatch (no role param at the fetch layer).
3. Step 0.3 — corrected the false assumption that a reusable mock/offline-ERP-driver convention
   exists; added new Step 0.3a to build the first real force-down mechanism (Sales' own
   degraded-mode test self-skips rather than forcing failure).
4. New Step A0 (before Step A) — fixes the `purchase-seed.sql`/`production-seed.sql` order-dependency
   bug (residual a) with a Fully-Automated idempotency regression test.
5. Step B4 — corrected to name the 5 wrapper files precisely and confirmed no P2/3/4-left export
   stub exists (Fallback 2 / Registry Change Request is the only viable path, not Fallback 1).
6. Step C1 — rewritten into C1a (export routes, genuinely role-testable) and C1b (existing
   dashboard pages, static-source-coverage only via Step C2) to resolve the AC9-fetch architecture
   mismatch found in RESEARCH.
7. Step A6 — confirmed zero existing route-handler coverage pattern; strengthened to require
   generalizing `extractExportedActions` to also parse `GET`/`POST` route-handler shapes.
8. Added `## Known Residuals` section folding in (a)-(d) as explicit steps or recorded known-gaps.

Sections changed: Blast Radius, Step 0 (0.2/0.3, new 0.3a), new Step A0, Step B4, Step C1, Step A6,
new `## Known Residuals` section. No FAIL-level gaps found — all fixes were applicable within this
phase's existing owned blast radius; no Registry Change Request beyond the pre-existing Step B4 one
was newly raised.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-05-hardening-export-rollout_PLAN_18-09-26.md`
- Last completed step: not started (this plan was authored before Phases 0-4 have executed)
- Validate-contract status: written 22-09-26 — Gate: PASS (inner-PVL, `generated-by: inner-pvl:
  phase-5`, supersedes the 18-09-26 outer-pvl contract) — see `## Validate Contract` below.
- Depends on: Phase 2, Phase 3, Phase 4 exit gates all passed (see Entry Gate above) — CONFIRMED
  (22-09-26): all four (Phase 0-4... i.e. 1-4) show `Gate: PASS` in their own validate-contracts and
  are ✅ VERIFIED at agent level per the umbrella's `## Current Execution State`.
- Next step for a fresh agent: spawn vc-execute-agent for this phase's Step 5 (EXECUTE) — PVL is
  green, so EXECUTE may begin with Step 0 (Confirm real interfaces — already partially confirmed
  during RESEARCH/PVL, but EXECUTE should re-confirm at the moment it starts writing code) then
  Steps A0-I in order.
- Execute-agent start instruction: PVL (loop step 4) is green (Gate: PASS) — EXECUTE may begin. Run
  the validate-contract gate commands (Exit Gate section) per-section as each step completes. Step
  B4 still requires pausing for the orchestrator's resolution of the Registry Change Request before
  touching any P2/3/4 wrapper file (see `## Registry Change Requests`) — do not self-authorize.

---

## Registry Change Requests

**Pre-identified at plan-authoring time (see Step B4):** wiring the export-trigger prop into each
of the three dashboard pages' `dashboard-data-table.tsx` usage touches files the registry's Phase 5
"Explicit non-overlap" list forbids (`src/app/(main)/dashboards/{sales,purchase,production}/**`).
The registry's "extends additively" language (§Phase 5, `dashboard-data-table.tsx` bullet) applies
only to `dashboard-data-table.tsx` itself, not to P2/3/4's wrapper files — Step B4 was correct on
that specific bullet.

**Correction found this PVL cycle (22-09-26 inner-PVL):** the registry ALSO contains a SEPARATE,
second clause in the same §Phase 5 "Shared files Phase 5 touches" section — a **named exception**
for `src/app/(main)/dashboards/{sales,purchase,production}/page.tsx`: "Phase 5 MAY add ONLY the
export-trigger call-site prop wiring (the single prop/call passing each page's current filtered
view into the CSV export route) to these three files, without needing a PLAN-SUPPLEMENT back to
Phase 2/3/4." The prior RESEARCH pass (22-09-26) did not address this second clause when concluding
"no registry exception currently covers this" — it only evaluated the `dashboard-data-table.tsx`
bullet above. Since RESEARCH separately confirmed the real `DashboardDataTable` call sites are 5
wrapper files one level below literal `page.tsx` (plus one literal nested `page.tsx` —
`production/[moNumber]/page.tsx` — which DOES match the registry's wording verbatim), this is a
genuine open question, not a settled "no exception exists." **This does NOT change Step B4's
pause-and-wait requirement** — EXECUTE still does not self-authorize the edit — but the Registry
Change Request EXECUTE raises per Step B4's Fallback 2 should be phrased as a targeted question
("does the existing named exception's intent — single, additive export-trigger prop only — extend
to the 5 confirmed wrapper-file call sites, given they are the literal `DashboardDataTable`
invocation site within the SAME owned-by-2/3/4 directories the exception already names?") rather
than a request for a brand-new exception from scratch. This is a request for the orchestrator to
resolve, not a decision this plan or its executing agent makes unilaterally.

Resolution path (unchanged, Step B4 still governs): (1) Phase 2/3/4 already left a stub call site
during their own execution (no Phase 5 edit needed — preferred, confirm during RESEARCH Step 0), or
(2) the targeted Registry Change Request above, raised to the orchestrator before any P2/3/4 file
is touched, resolved either by an amendment/clarification to `phase-blast-radius-registry.md` or by
routing the call-site edit back to the owning phase as a PLAN-SUPPLEMENT. This phase does NOT
self-authorize the edit under an assumed exception.

---

## Registry Change Requests RAISED DURING EXECUTE (22-09-26)

**Step B4 needed NO registry change at all — the open question is moot.** EXECUTE resolved the
export-trigger wiring with ZERO edits to any Phase 2/3/4 file. Instead of threading a new
`exportHref` prop down through the 5 wrapper components, the shared `dashboard-data-table.tsx`
(Phase 1's file, which the registry already lets Phase 5 extend additively) DERIVES the export URL
from the two props it already receives — `basePath` and `searchParams` — via a new pure helper,
`src/lib/erp/dashboard-export-target.ts`. Every call site is untouched. The registry's `page.tsx`
named exception was therefore never exercised, and the orchestrator does not need to rule on
whether it extends to the wrapper files.

Three genuine out-of-radius touches WERE required and are recorded here for orchestrator review.
All three are additive, none changes existing behaviour when its flag is off, and all are covered
by new assertions.

**RCR-1 — `src/lib/erp/erp-adapter.ts` (Phase 1-owned): 4 added lines + 1 import.**
- What: `guardedQuery` now checks a test-only in-memory flag and throws `ErpForcedDownError`
  BEFORE `assertReadOnlySql` and before the pool is touched.
- Why: plan Step 0.3a/0.3b requires a real ERP force-down mechanism for AC15, and RESEARCH
  confirmed none exists; the check must sit in the read path, which is a Phase-1 file. Step 0.3a
  itself anticipated this and required the request be raised rather than silently made.
- Safety: it can only THROW. It cannot skip, relax, or branch around any read-only layer. A new
  assertion in `auth-guard-coverage.test.ts` pins that shape, and a second asserts the flag module
  contains no SQL, pool, or credential code at all.

**RCR-2 — `src/lib/erp/cache.ts` (Phase 1-owned): 1 added condition + 1 import.**
- What: while the same test-only flag is on, `getCached` skips the TTL-freshness early return.
- Why: without it the 5-minute TTL serves a fresh cached value, the fetcher never runs, and a
  forced outage is invisible — AC15 would have passed for the wrong reason. (A cross-bundle cache
  helper was tried first and rejected: in a production build each route bundle owns its own cache
  Map, so an external expiry call cannot reach the pages' caches.)
- Safety: default OFF; the flag cannot be set in a customer deployment.

**RCR-3 — `db/erp-fixture/production-seed.sql` (Phase 4-owned): symmetric column guards added.**
- What: the `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD` top-up guards that `purchase-seed.sql`
  already had, added for this domain's own column family.
- Why: this is Step A0 of this plan (residual (a)) — an explicit Phase 5 checklist item, and named
  as a required deliverable in the EXECUTE handoff. Recorded here because the registry assigns
  `production-seed.sql` exclusively to Phase 4.
- Safety: purely additive; nothing dropped, renamed or redefined. Proven by a new regression gate
  that was confirmed RED before the fix and GREEN after.

**Also touched, owned by no phase:** `vitest.config.ts` gained a `@` -> `src` resolve alias. The
plan's own C1a gate loads the export route directly, and that route (like the dashboard modules it
reuses) imports via `@/`. Purely additive — no existing test used the alias.

(If RESEARCH or EXECUTE discovers any FURTHER need to touch a file outside this phase's OWNED
PATHS — e.g. `dashboard-data-table.tsx` genuinely cannot be extended additively — record the
specific request here with rationale, and raise it to the orchestrator rather than silently editing
the umbrella, registry, SPEC, or another phase's plan.)

---

## Validate Contract

Status: PASS
Date: 22-09-26
date: 2026-09-22
generated-by: inner-pvl: phase-5
supersedes: 2026-09-18 (outer-pvl) — inner PVL has current evidence (RESEARCH/PLAN-SUPPLEMENT ran
22-09-26 after Phases 1-4 executed; the outer-pvl contract pre-dated Phase 0-4 execution entirely
and could only validate against best-guess interfaces)

Parallel strategy: sequential
Rationale: Single self-contained phase plan file, inner-PVL, one prior RESEARCH/PLAN-SUPPLEMENT
cycle already completed (22-09-26) and already folded into this plan via the Inner Loop Refresh
Note above. Signal count LOW (0-1/7 per vc-agent-strategy-compare): no multi-package scope beyond
this plan's own declared blast radius, no 3+ viable directions requiring fan-out, not itself a
phase-program kickoff. Layer 1 (4 dimensions) and Layer 2 (9 implementation-step-group sections
A-I) were run inline by this single agent, consistent with the prior outer-PVL cycle's own
strategy choice for this same plan.

Plan updates applied (this PVL cycle):
- P1: Added Step 0.3b (new checklist item) specifying the exact mechanical constraint and fix for
  Step 0.3a's ERP-unreachable force-down mechanism. Gap found: Step 0.3a offered two candidate
  mechanisms ("an `ERP_FORCE_DEGRADE` env flag, or pointing the ERP pool at an unreachable
  host/port") without checking either against the actual e2e architecture. Verified by reading
  `playwright.config.ts` (ONE shared `pnpm start` webServer process for the whole suite,
  `reuseExistingServer: !CI`) and `src/lib/erp/pool.ts` (`getErpPool()`'s connection pool is a
  `globalThis` singleton, `ERP_DATABASE_URL` read once at first successful connect — later env
  changes are inert for the rest of the process). An env-var-based toggle would either break every
  OTHER spec sharing the server, or silently do nothing once the pool is already cached. Fixed
  directly in the plan: Step 0.3b now specifies the viable mechanism (a small test-only,
  `NODE_ENV !== "production"`-gated HTTP route flipping an in-memory flag `guardedQuery`/
  `getErpPool` checks per-call, in the same spirit as the existing test-only
  `resetErpReadOnlyLoginState`/`clearErpCache` exports) plus the required cache-warm-then-fail-
  then-reload sequencing (verified by reading `src/lib/erp/cache.ts`: an empty cache re-throws
  instead of serving stale — Step D1 must warm the cache first or it will false-fail onto the
  `*-unavailable.tsx` screen instead of proving the "ข้อมูลอาจไม่ล่าสุด" banner).
- P2: Corrected `## Registry Change Requests` (and cross-referenced from Step B4): the section
  claimed "No registry exception currently covers this" for the export-trigger call-site wiring.
  Gap found: `phase-blast-radius-registry.md` §Phase 5 contains a SECOND, separate clause (a named
  exception for literal `page.tsx` paths: "Phase 5 MAY add ONLY the export-trigger call-site prop
  wiring ... without needing a PLAN-SUPPLEMENT back to Phase 2/3/4") that the plan's own RESEARCH
  pass never addressed — it only evaluated the SEPARATE `dashboard-data-table.tsx` "extends
  additively" bullet before concluding no exception exists. Verified by reading the registry file
  directly (`phase-blast-radius-registry.md` lines 273-294). Fixed directly in the plan: the
  section now records both registry clauses accurately and reframes the Fallback-2 Registry
  Change Request as a targeted question (does the existing named exception's intent extend to the
  5 confirmed wrapper files, since they are the literal call-site analog of `page.tsx` within the
  same owned-by-2/3/4 directories) rather than a request for a brand-new exception. This does NOT
  change Step B4's pause-and-wait requirement — EXECUTE still does not self-authorize the edit;
  this is a documentation-accuracy fix that makes the eventual orchestrator resolution faster, not
  a scope decision made by this PVL cycle.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC9-fetch | STAFF role receives zero money fields from all 3 dashboards' page-level data-fetch functions AND all 3 export routes (server-side omission, not client hide) | Fully-Automated | `pnpm test -- dashboards-money-audit` | B |
| AC9-static | Static-source-coverage: every money-labeled field call site is guarded by `canSeeMoney`/`role==="ADMIN"` | Fully-Automated | `pnpm test -- dashboards-money-audit` (static-grep sub-test, Step C2) | B |
| AC14 | ADMIN CSV export has a money column with correct fixture value; STAFF CSV has none (header count differs, no money string anywhere in body) — all 3 dashboards | Hybrid | `pnpm test:e2e -- dashboards-export` against `erp_fixture` (precondition: sandbox container + fixture DB seeded) | B |
| AC15 | All 3 dashboards show last-cached figures + "ข้อมูลอาจไม่ล่าสุด" banner under a forced ERP-unreachable condition (never a generic error/blank screen) | Hybrid | `pnpm test:e2e -- dashboards-degraded-mode` against `erp_fixture` (precondition: mock/offline ERP driver per Step 0.3/0.3a/0.3b — test-only force-down route + cache warm-first sequencing) | B |
| AC16 | "ข้อมูลนำร่อง" pilot banner visible on all 3 dashboards under normal (non-degraded) conditions | Hybrid | `pnpm test:e2e -- dashboards-degraded-mode` (same spec, shared beforeEach) | B |
| AC17-guard | ~24-case `assertReadOnlySql` guard suite still green after P1-P5 SQL additions | Fully-Automated | `pnpm test -- erp-adapter` (confirmed file: `src/lib/erp/__tests__/erp-adapter.test.ts` or equivalent — exact filename re-confirmed at EXECUTE Step 0.1) | B |
| AC17-grep | No new `.sql` file across P1-P5 (`db/erp-queries/**/*.sql`) contains a write/DDL keyword | Fully-Automated | grep sanity check (Step E2) | B |
| AC2 (Purchase+Production) | Unauthenticated visitor requesting `/dashboards/purchase` or `/dashboards/production` directly is redirected to login (Sales' own AC2 already proved by Phase 2, not re-derived) | Fully-Automated | `pnpm test:e2e -- dashboards-degraded-mode` (Step D0 assertions) | B |
| Fixture-seed-idempotency (residual a) | `purchase-seed.sql`/`production-seed.sql` seed the shared `InventoryFlowHdr`/`InventoryFlowDtl` tables with zero SQL errors regardless of run order | Fully-Automated | new idempotency regression test (Step A0.3) — verified this cycle: `production-seed.sql` genuinely lacks the `IF COL_LENGTH(...) IS NULL` guards `purchase-seed.sql` already has (confirmed by direct file read) | B |
| Program regression | Full Vitest suite + full Playwright suite (all 4 projects: setup/chromium/mobile/tablet, incl. `mobile.spec.ts` 3-tab assertion) + lint + build all exit 0, 0 regressions vs. pre-Phase-5 baseline (verified this cycle: baseline recorded in umbrella `## Current Execution State` as 390 passed/24 skipped Vitest, 119 passed/7 skipped Playwright, 22-09-26) | Fully-Automated | `pnpm test && pnpm test:e2e && pnpm lint && pnpm build` | B |
| AC18-fixture | Boot permission probe refuses a write-capable login in fixture mode (re-confirmation of Phase 1's own probe) | Agent-Probe | re-run of Phase 1's own probe test as part of full regression (Step F1/H1) | B |
| AC18-live | Boot permission probe against the REAL scoped read-only ERP login | Agent-Probe (deferred) | — (blocked on Phase 0's `db/create-erp-readonly-login.sql`, DBA-run, not yet provisioned — confirmed still not provisioned this cycle: no scoped read-only login artifact exists beyond the delivery script itself) | D |
| Manual reconcile | `live-reconcile-script.ts` written, connects only via `guardedQuery`, prints a side-by-side comparison vs. KRS's own report procs (`sp_PurchaseInvoiceMonth`, `sp_Popending` — re-confirmed real proc names this cycle via direct grep of `erp-master-data_REF_18-09-26.md`/`erp-data-dictionary_REF_18-09-26.md`) | Hybrid (script correctness only; execution is USER-RUN, never agent-run) | `pnpm tsx src/lib/erp/live-reconcile-script.ts` run by a human against real db_TCL | D |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: every "B" row above names a Fully-Automated, Hybrid, or Agent-Probe proving
strategy already present in this plan's own Implementation Checklist (Steps 0-I); none of the "B"
rows rest on Known-Gap as their proving mechanism. The two "D" rows (AC18-live, manual reconcile)
are named residuals with written justification and a backlog-tracking artifact
(`erp-dashboards-rollout-readiness_REF_18-09-26.md`, Step I1) — NOT a vacuously-green plan: every
developed behavior in this phase's blast radius has a Fully-Automated or Hybrid proving gate; the
only Known-Gap-shaped residuals are pre-existing SPEC/umbrella-sanctioned exceptions outside this
phase's control, not substitutes for coverage of anything this phase itself builds.

Legacy line form (retained so existing validate-contract consumers still parse):
- Cross-dashboard money-gate audit: Fully-automated: `pnpm test -- dashboards-money-audit` | known-gap: none
- CSV export role-gate: Hybrid: `pnpm test:e2e -- dashboards-export` + precondition erp_fixture seeded | known-gap: none
- Degraded-mode + pilot banner: Hybrid: `pnpm test:e2e -- dashboards-degraded-mode` + precondition test-only force-down route (Step 0.3b) + cache-warm-first sequencing | known-gap: none
- Read-only guard re-confirmation: Fully-automated: `pnpm test -- erp-adapter` + grep sanity (Step E2) | known-gap: none
- AC2 Purchase/Production unauth-redirect: Fully-automated: `pnpm test:e2e -- dashboards-degraded-mode` (Step D0) | known-gap: none
- Fixture seed order-dependency (residual a): Fully-automated: new idempotency regression test (Step A0.3) | known-gap: none
- Full regression: Fully-automated: `pnpm test && pnpm test:e2e && pnpm lint && pnpm build` | known-gap: none
- AC18 live-mode boot-probe: known-gap: documented, blocked on Phase 0 DBA-run login provisioning (SPEC-sanctioned residual, re-confirmed still pending this cycle)
- Manual live-reconcile: known-gap-by-design: USER-RUN execution is the correct, SPEC-mandated shape (Out Of Scope explicitly forbids an automated reconciliation job)

Failing stub:
test("should assert STAFF role receives zero money fields across all 3 dashboards data-fetch functions and export routes", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: AC9-fetch cross-dashboard money-gate audit") })

Failing stub:
test("should assert every money-labeled field call site is guarded by canSeeMoney/role===ADMIN via static source grep", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: AC9-static coverage backstop") })

Failing stub:
test("should assert the ~24-case assertReadOnlySql guard suite is still green after P1-P5 SQL additions", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: AC17-guard re-confirmation") })

Failing stub:
test("should assert no new .sql file across P1-P5 contains a write/DDL keyword", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: AC17-grep sanity check") })

Failing stub:
test("should assert an unauthenticated visitor requesting /dashboards/purchase or /dashboards/production directly is redirected to login", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: AC2 Purchase+Production unauth-redirect") })

Failing stub:
test("should assert purchase-seed.sql and production-seed.sql seed the shared InventoryFlowHdr/InventoryFlowDtl tables with zero SQL errors in either run order", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: fixture-seed-idempotency (residual a)") })

Failing stub:
test("should assert pnpm test, pnpm test:e2e, pnpm lint, and pnpm build all exit 0 with 0 regressions vs. the pre-Phase-5 baseline", () => { throw new Error("NOT IMPLEMENTED — TDD stub for: program-wide full regression") })

Dimension findings:
- Infra fit: PASS — re-verified this cycle by reading disk state directly: every Touchpoints/Blast
  Radius file path either exists (5 wrapper files, `dashboard-data-table.tsx`, `auth-guard-
  coverage.test.ts`, `src/lib/erp/*`, `db/erp-queries/**`) or correctly does not yet exist (export
  route, CSV helper, e2e specs — Phase 5 has not executed). `playwright.config.ts`'s `chromium`
  project has no `testIgnore` covering the two new e2e specs, so they need zero config change to
  run. No container/proxy/gateway surface touched.
- Test coverage: PASS (after this cycle's fixes) — every developed behavior in this phase's blast
  radius now has a Fully-Automated or Hybrid gate with a mechanically-verified implementation path
  (Step 0.3b closes the previously-unverified degraded-mode force-down mechanism). The two
  residuals (AC18-live, manual reconcile) are pre-existing, SPEC-sanctioned exceptions, independently
  re-confirmed still pending this cycle (no scoped read-only login provisioned yet).
- Breaking changes: PASS — re-confirmed this cycle by reading the actual current source:
  `requireAuth()`'s signature, `/api/health`+`/api/health/erp`, every existing dashboard page,
  the phone bottom-tab-bar's 3-tab contract, and `prisma/schema.prisma` are unchanged on disk
  today. `dashboard-data-table.tsx` exists as a single file (Phase 1's component) with no P2/3/4
  fork — the planned additive-prop extension remains mechanically sound.
- Security surface: PASS — re-confirmed this cycle against the ACTUAL `auth-guard-coverage.test.ts`
  (read in full): the file has real `canSeeMoney`/server-session-only assertions for Sales and
  Purchase, a `guardedQuery`-only (never Prisma/$queryRaw) assertion for all 3 dashboards, and
  intentionally NO general route-handler (`GET`/`POST`) coverage pattern for authenticated business
  routes — Step A6 will genuinely be the first to add one (the existing `GET`-regex use only checks
  the two INTENTIONALLY-PUBLIC health probes do NOT call `requireAuth`, a different assertion
  entirely). Money-visibility STRIDE risk is mitigated by re-applying `canSeeMoney` server-side
  inside the export route itself (Step A3), not solely trusting the dashboard page's own filtering.
  Row cap (5,000 rows) mitigates unbounded-export DoS risk. No new auth surface; no write-capable
  code path added anywhere.
- Section A (CSV export routes): PASS — mechanically sound; route-shape decision correctly
  deferred to EXECUTE-time INNOVATE; DB-Safety Notes correctly forbid any second query path around
  `guardedQuery`.
- Section B (dashboard-data-table.tsx wiring): CONCERN, fixed this cycle (see Plan Updates P2) —
  RESEARCH's Step B4 conclusion ("no registry exception currently covers this") was based on
  evaluating only ONE of the registry's two relevant clauses; the second (a named exception for
  `page.tsx` paths) was overlooked. Corrected in `## Registry Change Requests` — this does not
  change the pause-and-wait requirement, it only sharpens the question EXECUTE will raise. Net:
  no unresolved CONCERN remains after the fix.
- Section C (money-gate audit): PASS — one shared test file across all 3 dashboards correctly
  proves the "cross-dashboard" framing; C1a/C1b split (re-derived by the prior RESEARCH cycle to
  resolve the no-role-param architecture mismatch) is mechanically sound and independently verified
  this cycle against the actual `fetchDoHeaders`/`fetchPurchaseInvoices`/`getProductionMoList`-style
  function signatures (all confirmed to take no role parameter).
- Section D (degraded-mode + pilot-banner + AC2 e2e): CONCERN, fixed this cycle (see Plan Updates
  P1) — Step 0.3a's two candidate force-down mechanisms were unverified against the actual e2e
  process architecture (single shared webServer + singleton ERP pool). New Step 0.3b closes this
  with a verified, implementable design plus the cache-warm-first sequencing `cache.ts`'s actual
  degrade-vs-empty-cache logic requires. Net: no unresolved CONCERN remains after the fix.
- Section E (guard re-confirmation): PASS — belt-and-suspenders design (runtime guard re-run +
  static grep) is appropriately conservative for a write-prevention high-risk class.
- Section F (full regression): PASS — exact commands; baseline counts independently cross-checked
  against the umbrella's own recorded 22-09-26 full-suite run (390/24 skipped Vitest, 119/7 skipped
  Playwright) rather than this plan's own un-verified guess.
- Section G (manual live-reconcile): PASS — stored-procedure names re-confirmed real this cycle via
  direct grep of the data-dictionary/master-data reference docs (not hallucinated); USER-RUN
  boundary explicit and repeated in DB-Safety Notes.
- Section H (AC18 boot-probe): PASS — correctly refuses to fabricate a live-mode result;
  independently re-confirmed this cycle that the scoped read-only login still does not exist
  (`db/create-erp-readonly-login.sql` remains a delivery script only, per Phase 0's own scope).
- Section I (rollout readiness): PASS — cross-references the umbrella's Hard Safety Constraints as
  required; Step A0 (residual a, fixture seed order-dependency) independently re-verified this
  cycle by direct file read — `production-seed.sql` genuinely lacks the `IF COL_LENGTH` guards
  `purchase-seed.sql` already has, confirming the bug is real and Step A0's fix is correctly scoped.

Open gaps:
- AC18 live-mode boot-probe: known-gap, SPEC-sanctioned residual, independently re-confirmed this
  cycle as still blocked on Phase 0's DBA-run login provisioning. No further plan action required.
- Manual live-reconcile execution: known-gap-by-design (USER-RUN, per SPEC's Out Of Scope
  directive). Not a gap — the correct shape. No further action.
- Step B4 registry-resolution question (see Plan Updates P2 and `## Registry Change Requests`) —
  not a FAIL/CONCERN blocking this plan's own PASS; it is a pause-and-wait coordination need,
  already correctly gated in Step B4/`## Blockers That Would Justify BLOCKED Status`, now phrased
  as a sharper, faster-to-resolve question for the orchestrator.
- Minor terminology note (non-blocking, carried from the prior outer-PVL cycle): SPEC's per-AC
  `strategy:` field lists AC14/AC15/AC16 as "Fully-Automated", while this phase plan classifies
  their proving e2e specs as "Hybrid" (erp_fixture sandbox precondition) — consistent with the
  program's own established convention (Phase 1's `/api/health/erp` check uses the same
  classification for the same reason). No plan fix needed.

What this coverage does NOT prove:
- `pnpm test -- dashboards-money-audit` proves server-side field omission for STAFF and static
  call-site coverage; it does NOT prove the UI never renders a client-side "hidden" element that
  could be un-hidden via devtools.
- `pnpm test:e2e -- dashboards-export` proves the export route's money-gate and CSV structure
  against the `erp_fixture` sandbox; it does NOT prove behavior against live `db_TCL`, nor CSV
  rendering fidelity inside a real spreadsheet application (Excel/Google Sheets BOM/glyph
  handling).
- `pnpm test:e2e -- dashboards-degraded-mode` proves graceful degrade + banner presence against a
  test-only force-down toggle (Step 0.3b); it does NOT prove real live-ERP-outage behavior, timing,
  or the specific failure mode a genuine network/auth outage would produce (the toggle simulates
  "any thrown error," not a specific real-world failure signature).
- `pnpm test -- erp-adapter` + the SQL-file grep prove the guard holds against the ~24 known cases
  and the current accumulated SQL set; neither proves absence of a genuinely novel bypass class
  outside those 24 cases.
- The fixture-seed idempotency test (Step A0.3) proves both run orders succeed against the
  fixture's OWN schema; it does NOT prove the live `db_TCL` schema matches either seed's column
  assumptions (the fixture is a hand-built approximation, not a live-schema mirror).
- The full regression suite proves no P1-P5 unit/e2e/lint/build regression; it does NOT prove
  production/live-DB behavior.
- The AC18 fixture-mode re-confirmation proves the probe's logic is correct against a fixture
  login; it does NOT prove the real production login's actual permission grants — that is exactly
  AC18-live's accepted residual.
- The manual reconcile script proves nothing by itself until a human runs it against real
  `db_TCL` and records the comparison — this is by design, not a limitation to close.

Accepted by: n/a — Gate: PASS, no unresolved CONCERNs requiring user acceptance (both CONCERNs
raised this cycle — Section B, Section D — were fixed directly in the plan text this same cycle,
per Plan Updates P1/P2 above; neither required new information only the user could supply). The
two SPEC/umbrella-sanctioned residuals (AC18-live, manual reconcile) are pre-existing program-level
decisions already recorded in the frozen SPEC and umbrella charter, not new acceptances made in
this PVL cycle.

Gate: PASS
