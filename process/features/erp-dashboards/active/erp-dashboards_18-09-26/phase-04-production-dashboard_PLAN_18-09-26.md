---
name: plan:erp-dashboards-phase-04-production-dashboard
description: "ERP Dashboards — Phase 4: Production Dashboard (plan-only MO list, no achievement-%, MO status, raw-material-issue drilldown)"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: phase-04
---

# Phase 4 — Production Dashboard

**Date**: 18-09-26
**Status**: ⏳ PLANNED
**Program:** erp-dashboards
**Umbrella plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
**SPEC (frozen, governs this phase):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
**Data dictionary (source of tested SQL filters):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-data-dictionary_REF_18-09-26.md`
**Blast-radius registry (Phase 4 section is authoritative for ownership):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-blast-radius-registry.md`
**Complexity:** COMPLEX
**Phase status:** ⏳ PLANNED
**Report destination:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_REPORT_18-09-26.md` (flat in the program task folder)

---

## Overview

Phase 4 of the erp-dashboards program (see Purpose below for full detail).

## Purpose

Build `/dashboards/production` — the third of the three parallel domain dashboards (Sales / Purchase
/ Production, run after Phase 1's shared foundation lands). Unlike Sales and Purchase, Production has
**no genuine "actual produced" measurement anywhere in the ERP schema** — this is a *proven negative*
finding (§C-4 in the data dictionary, cross-checked across `tbl_MoHdr.Prodqty`, `tbl_BatchOrder.Prodqty`,
`tbl_MoOperDtl.ActualQTY/AccuQTY/CompleteQty/DeffecQTY`, and the residual `tbl_BatchMRP`/`tbl_BatchPJBal`/
`tbl_BatchLot` finding — every candidate "actual" column is either an exact copy of the planned
quantity or NULL/0 on every row). This phase therefore ships a **plan-only** dashboard: every
production batch shows its planned quantity and status, the "actual produced" column always renders
the explicit Thai empty-state string `"ยังไม่มีข้อมูลผลิตจริง"` instead of any number, and there is
**no achievement-percentage figure anywhere on the page** (AC7). A drilldown from a production batch
to its linked raw-material issues (via `InventoryFlowDtl.MONo`, string-matched, no FK) completes the
second half of scope (AC8).

This phase governs ONLY `src/app/(main)/dashboards/production/**`, `db/erp-queries/production/*.sql`,
`src/lib/__tests__/production-*.test.ts`, and `e2e/dashboards-production.spec.ts` — its blast radius
is provably disjoint from Phase 2 (Sales) and Phase 3 (Purchase), per the registry's Parallel-Safety
Statement, so all three phases may execute in parallel once Phase 1's exit gate passes.

---

## Scope

### In scope

1. `/dashboards/production` page: server component, `requireAuth()` (ADMIN + STAFF, no role
   restriction — matches AC1's "Staff or Admin user"), `export const dynamic = "force-dynamic"`.
2. KPI tile row: total planned batches (count), total planned quantity (grouped per `MainUnit` —
   never summed across units), count of batches with ≥1 raw-material issue recorded.
3. One bar chart: planned quantity per FG item (`tbl_MoHdr.FgCode`/`InventoryItem.ItemName`), CSS-bar
   pattern (matching `/summary`'s existing hand-rolled bars) unless Phase 2's Recharts spike passed —
   if so, this phase MAY adopt Recharts independently (its own INNOVATE decision), but does NOT edit
   `package.json` either way (Phase 2 owns that dependency decision per the registry).
4. MO list table (via the shared `dashboard-data-table` component from Phase 1): MO number, FG item,
   planned quantity + unit, status badge, "actual produced" column (always the empty-state string,
   never a number), row count. URL-driven sort + pagination + filters (date range, status).
5. MO status derivation: `tbl_MoHdr.Approved` / `IsClosed` / `IsCancel` → a small status-badge CASE
   (see Data/SQL Details below) — same `ISNULL(...,0)`-when-open caution as Purchase's flag pattern.
6. Drilldown: MO row → MO detail (or expanded raw-material-issue list) showing every
   `InventoryFlowDtl` row where `MONo` matches this MO's `MoNumBer` AND `ReasonName = 'เบิกวัตถุดิบ :
   ใบสั่งผลิต'` — item code, item name, quantity, unit, transaction date (AC8).
7. Mobile card view (phone width, matches `admin/users/users-mobile.tsx`'s existing `md:hidden`
   pattern) for both the MO list and the raw-material-issue drilldown list.
8. Money-visibility gate: Production has **no money figures at all** in this phase's scope (no THB
   anywhere on planned-quantity or material-issue data) — so `canSeeMoney` gating does not apply to
   Production's own tiles/table. Record this explicitly in the phase report so Phase 5's cross-
   dashboard money audit (AC9) does not treat "no money gate found" as a bug for this dashboard.
9. Pilot banner ("ข้อมูลนำร่อง") and ERP-degraded-mode banner ("ข้อมูลอาจไม่ล่าสุด") — both consumed
   from Phase 1's shared degrade/cache wrapper, not reimplemented here.
10. Filters: date range (planned-batch creation/transaction date) + status, via URL searchParams
    (mirrors `shop-location-filter`'s `?location=` precedent — controlled `<select>`/date inputs that
    navigate on change, reproducible by reloading the URL).
11. Append this phase's own new routes/pages to `src/lib/__tests__/auth-guard-coverage.test.ts`
    (append-only, per registry rule — do not touch Sales/Purchase entries).
12. Update this phase's own status line in `process/context/all-context.md`'s erp-dashboards feature
    entry (append/update only — do not restructure Phase 0's original entry).

### Out of scope (this phase)

- Any "percent achieved" / achievement-rate figure — explicitly banned by the umbrella charter and
  SPEC AC7; never build this even if a future ERP data model appears to support it later.
- Sales or Purchase dashboard files, `db/erp-queries/sales|purchase/*`, or any Sales/Purchase-named
  test/spec file (registry non-overlap rule).
- `package.json` edits of any kind (Recharts dependency decision belongs exclusively to Phase 2).
- CSV export wiring — Phase 5 adds the export route(s) that read this phase's data functions; this
  phase only needs to expose data-fetching functions Phase 5 can import, not build the export itself.
- The cross-dashboard money-gate audit test (`dashboards-money-audit.test.ts`) — Phase 5 owns it.
- Any change to `src/lib/erp/*`, the shared `dashboard-data-table` component's core sort/paginate
  logic, `src/app/nav-links.tsx`, or `/api/health/erp` — all Phase 1's owned files; this phase only
  **imports** them.
- Live db_TCL access of any kind — all development/testing runs against the `erp_fixture` sandbox
  database Phase 1 provisions.

---

## Entry Gate

- Phase 1 exit gate passed: `guardedQuery`/`assertReadOnlySql` guard + ~24 ported test cases green
  against `erp_fixture`; `/api/health/erp` live; cache/degrade wrapper proven; nav group renders all
  3 links with the phone bar still at 3 tabs; shared `dashboard-data-table` component renders
  sort+paginate on a fixture dataset.
- `phase-blast-radius-registry.md`'s Phase 1 section shows `status: DONE` (or no BLOCKED-skipped
  entry) before this phase's EXECUTE step begins.
- Phase 4 may start its own RESEARCH/INNOVATE/PLAN-SUPPLEMENT steps in parallel with Phase 2/3 once
  Phase 1's exit gate is confirmed — no need to wait for Phase 2 or Phase 3 to finish.

---

## Touchpoints

**Owned (create) — exclusive to this phase:**

| File | Create/Edit | Purpose |
|---|---|---|
| `src/app/(main)/dashboards/production/page.tsx` | Create | Server component: requireAuth, force-dynamic, fetch + render KPI tiles / chart / table |
| `src/app/(main)/dashboards/production/production-mobile.tsx` | Create | `md:hidden` mobile card list for MO rows (mirrors `admin/users/users-mobile.tsx` pattern) |
| `src/app/(main)/dashboards/production/mo-detail-drilldown.tsx` (or `[moNumber]/page.tsx`) | Create | Raw-material-issue list for one MO — see Innovate note below on route-vs-expand decision |
| `src/app/(main)/dashboards/production/production-status.ts` | Create | Pure helper: `deriveMoStatus(mo)` → status label/tone (no DB access — unit-testable) |
| `src/app/(main)/dashboards/production/production-data.ts` | Create | Pure/async data-fetch helpers: `getProductionMoList(filters)`, `getMaterialIssuesForMo(moNumBer)` — the functions Phase 5's export route will import |
| `db/erp-queries/production/mo-list.sql` | Create | Versioned SQL: planned MO list with status, reviewable by KRS ERP team |
| `db/erp-queries/production/material-issues.sql` | Create | Versioned SQL: `InventoryFlowDtl` rows for a given `MONo` + reason filter |
| `src/lib/__tests__/production-plan-only-empty-state.test.ts` | Create | AC7 fixture scenario — asserts "actual" column always renders empty-state string, no achievement-% anywhere in the rendered output/data shape |
| `src/lib/__tests__/production-material-issue-drilldown.test.ts` | Create | AC8 fixture scenario — MO → material-issue linkage via `MONo` string match |
| `src/lib/__tests__/production-status-derivation.test.ts` | Create | Unit test for `deriveMoStatus()` pure function, including the `ISNULL(IsClosed,0)`-when-open edge case |
| `e2e/dashboards-production.spec.ts` | Create | Playwright: AC1 (nav entry exists)'s Production-specific assertion, AC7, AC8, AC10 (filter), AC11 (drilldown nav), AC12 (sort/paginate), AC13 (mobile card view) — Production's share only |
| `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_REPORT_18-09-26.md` | Create (at UPDATE-PROCESS) | Phase report |

**Imported, never edited (Phase 1's owned files — read-only dependency):**

| File | What this phase imports from it |
|---|---|
| `src/lib/erp/erp-adapter.ts` (`guardedQuery`) | The single choke point for every ERP SQL read in this phase |
| `src/lib/erp/pool.ts` | The separate `mssql.ConnectionPool` singleton |
| `src/lib/erp/cache.ts` | Short-TTL cache wrapper around `getProductionMoList`/`getMaterialIssuesForMo` |
| `src/lib/erp/degrade.ts` | Last-cached-value + "ข้อมูลอาจไม่ล่าสุด" banner state |
| `src/components/dashboard-data-table.tsx` | The shared sort/paginate/mobile-card table shell |
| `src/lib/be-date.ts` (`ceToBeDisplay`, `ceToBeParts`) | Buddhist-era date display for MO transaction dates |
| `src/components/ui/card.tsx`, `src/components/ui/chip.tsx` | KPI tile shells + status badges |
| `src/lib/auth-guard.ts` (`requireAuth`) | Page-level auth boundary — unchanged signature |

**Shared files this phase appends to (registry append-only rule — never restructure another
phase's lines):**

| File | This phase's edit |
|---|---|
| `src/lib/__tests__/auth-guard-coverage.test.ts` | Append `/dashboards/production` (and any sub-route) to the coverage list — Production entries only |
| `process/context/all-context.md` | Update/append this phase's own status line in the erp-dashboards feature entry only |

---

## Public Contracts

- No existing orderstock route, schema, print surface, or auth signature changes — this phase only
  adds new `/dashboards/production` routes and reads a separate ERP connection via Phase 1's
  `guardedQuery`.
- `requireAuth()`'s existing signature (`requireAuth(role?)`) is called unchanged — no new role
  values, no new auth primitive.
- The phone bottom-tab-bar's existing 3-tab contract (`e2e/mobile.spec.ts`) is untouched — Production
  is sidebar/drawer-only (Phase 1 already wired the nav group entry; this phase does not touch
  `nav-links.tsx`).
- `prisma/schema.prisma` is completely untouched by this phase — Production data comes exclusively
  from `guardedQuery` reads against `erp_fixture` (dev/test) / db_TCL (future, gated on the read-only
  login).
- New exported functions `getProductionMoList(filters)` and `getMaterialIssuesForMo(moNumBer)` in
  `production-data.ts` are the contract Phase 5's CSV export route depends on — keep their shape
  stable (return arrays of plain objects, no React-specific types) so Phase 5 can import them
  without modification.

---

## Blast Radius

Exactly the "Owned paths" list in `phase-blast-radius-registry.md`'s Phase 4 section (reproduced in
Touchpoints above), plus the two append-only shared-file edits. This phase does **not** touch:
`src/app/(main)/dashboards/sales/**`, `src/app/(main)/dashboards/purchase/**`, any
`db/erp-queries/sales/*` or `db/erp-queries/purchase/*` file, `package.json`, `src/lib/erp/*`,
`src/components/dashboard-data-table.tsx`'s internals, or `src/app/nav-links.tsx`.

If EXECUTE discovers a genuine need to touch a file outside this list (e.g. `dashboard-data-table.tsx`
needs a Production-specific column-shape change), STOP and write a `registry_change_requests` note in
the phase report instead of editing it directly — route it as a PLAN-SUPPLEMENT to Phase 1.

**registry_change_requests:** none required. See the dedicated `## Registry Change Requests`
section below (added at PVL, 18-09-26) for the one deliberate design choice that avoids a registry
change (mobile-viewport e2e gate).

---

## Registry Change Requests

None required to complete this phase. One deliberate design choice avoids a registry change,
mirroring Phase 2/Phase 3's own already-documented resolution to the same shared-infra gap
(added at PVL, 18-09-26 — see Phase 2's `## Registry Change Requests` section):

- **`playwright.config.ts` is NOT edited by this phase.** The existing `mobile` project's
  `testMatch: /mobile\.spec\.ts/` regex only matches literally `mobile.spec.ts` — it will NOT pick
  up `e2e/dashboards-production.spec.ts`, so AC13's mobile-card-view scenario cannot run via
  `--project=mobile` as originally drafted. Per Phase 2's own PVL fix (flagged there for Phase 3/4 to
  reuse rather than each phase proposing its own registry change), this phase instead uses an
  in-file `test.use({ viewport: { width: 390, height: 844 } })` override inside
  `e2e/dashboards-production.spec.ts` for the mobile-card scenario, achieving the same viewport
  assertion under the default `chromium` project without touching a shared config file no phase in
  the registry currently owns.

---

## Data / SQL Details (tested filters — from the data dictionary)

All queries below run through Phase 1's `guardedQuery` choke point against `erp_fixture` (dev/test)
— never a live db_TCL connection in this phase. WITH (NOLOCK) per the umbrella's RCSI-off / read-only
convention. Table/column names and filter logic are taken verbatim from
`erp-data-dictionary_REF_18-09-26.md` §60-65, §90-96 (residual finding), and §111 (status CASE
pattern), which are already tested against real (fixture-representative) rows — do not re-derive
from training-data guesses.

### MO list query (`mo-list.sql`)

- **Base table:** `tbl_MoHdr` (one row per Manufacturing Order).
- **Planned quantity:** `LotQty` (or `tbl_BatchOrder.PlanQty`, confirmed identical — data dictionary
  §60). **Known edge case:** MO-1 in the tested fixture data has `LotQty = NULL` and only `Prodqty`
  populated (17) — the query and the UI MUST handle a null `LotQty` by falling back to `Prodqty` for
  display purposes ONLY (this is still the planned figure, not an actual — `Prodqty` is proven
  (§C-4) to be a copy of the plan, never a measured output). Never treat a populated `Prodqty` as
  "actual produced."
- **Filter:** `IsCancel = 0` (exclude cancelled MOs from the default view; do not silently drop them
  entirely — a future "show cancelled" filter toggle is out of scope for this phase, note as backlog).
- **Status derivation** (`production-status.ts` → `deriveMoStatus()`), mirroring the Purchase-status
  CASE pattern from data dictionary §111 — **defensive practice, not a confirmed `tbl_MoHdr` fact
  (PVL correction, 18-09-26):** the tested fixture rows show `tbl_MoHdr.IsClosed = 0` (not NULL) on
  all 3 known MOs (data dictionary §63 / `erp-domain-discovery_REF_18-09-26.md:705` — "IsClosed=0 for
  all 3"). This differs from `tbl_PurchaseOrderHdr.IsClosed`, which data dictionary §D proves IS
  NULL-when-open. Still wrap in `ISNULL(IsClosed, 0)` anyway as a precaution borrowed from the
  Purchase table's proven NULL-when-open convention — a future MO row may follow the same pattern —
  but do not describe this as an already-confirmed fact about `tbl_MoHdr` itself:
  ```sql
  SELECT
    MoNumBer,
    FgCode,
    LotQty,
    Prodqty,
    Approved,
    ISNULL(IsClosed, 0) AS IsClosedNorm,
    IsCancel,
    CASE
      WHEN IsCancel = 1 THEN 'ยกเลิก'
      WHEN ISNULL(IsClosed, 0) = 1 THEN 'ปิดแล้ว'
      WHEN Approved = 1 THEN 'อนุมัติแล้ว'
      ELSE 'รออนุมัติ'
    END AS StatusLabel
  FROM tbl_MoHdr
  WHERE IsCancel = 0
  ORDER BY MoNumBer DESC
  ```
  Record explicitly in the phase report (matching the data dictionary's own caveat): this precedence
  order is **LOW confidence** — only 2 of the branches have ever been exercised in real data (n=3
  fixture rows). Ship it as the best-available derivation, not a guaranteed-correct enum; do not
  silently upgrade this confidence level without new evidence.
- **Unit grouping:** join to `InventoryItem` on `FgCode` = `ItemCode` for `MainUnits` — display
  quantity + unit together; never sum `LotQty`/`Prodqty` across MOs with different `MainUnits`.
- **"Actual produced" column:** always render the literal string `"ยังไม่มีข้อมูลผลิตจริง"` — do NOT
  select or display `Prodqty` (or any `tbl_MoOperDtl.ActualQTY/AccuQTY/CompleteQty/DeffecQTY` /
  `tblMPSDtl` ACT. column) as if it were a measured actual. These columns may be selected internally
  for the status/edge-case tests proving the negative finding, but the UI must never surface them as
  "actual."

### Raw-material-issue drilldown query (`material-issues.sql`)

- **Base table:** `InventoryFlowDtl`, filtered `ReasonName = 'เบิกวัตถุดิบ : ใบสั่งผลิต'`.
- **Linkage:** `InventoryFlowDtl.MONo` (nvarchar) matched by **string equality** against
  `tbl_MoHdr.MoNumBer` — data dictionary §64 confirms there is **no FK**, only a string match. The
  query and any TypeScript join logic must treat this as a plain string comparison, never assume
  referential integrity (e.g. do not `INNER JOIN` assuming 1:1 cardinality guarantees — handle zero
  matches gracefully, which is the common case per the fixture: only 7 of 218 header rows are tagged
  this way).
  ```sql
  SELECT
    d.ItemCode,
    i.ItemName,
    d.Qty,
    i.MainUnits,
    h.TransactionDate,
    d.MONo
  FROM InventoryFlowDtl d
  JOIN InventoryFlowHdr h ON h.TransactionNo = d.TransactionNo
  LEFT JOIN InventoryItem i ON i.ItemCode = d.ItemCode
  WHERE TRIM(d.MONo) = TRIM(@moNumBer)
    AND d.ReasonName = N'เบิกวัตถุดิบ : ใบสั่งผลิต'
  ORDER BY h.TransactionDate ASC
  ```
  (PVL fix, 18-09-26: added `TRIM()` on both sides of the `MONo` match — the Risks table below
  already promised this defensive guard against whitespace-padded `MONo` values; SQL Server 2019
  (db_TCL's confirmed version, compat 130) supports the single-argument `TRIM()` function added in
  2017, so this is safe for the target server.)
- **Empty case:** most MOs will have ZERO linked material issues in real data over time (only 7/218
  in the tested fixture-representative snapshot) — the drilldown UI must render a clean "ไม่มีรายการ
  เบิกวัตถุดิบสำหรับใบสั่งผลิตนี้" empty state, not an error or a blank table.

### FG-receipt-into-stock (explicitly absent — do not build)

- Data dictionary §65 confirms **zero** `InventoryFlowHdr` rows are tagged as an FG-receipt-from-
  production movement. Do not attempt to build a "received into stock" indicator for this phase —
  there is no ledger signal for it. Note this as a known-gap in the phase report, not a bug to fix.

---

## UI Details (Thai labels)

| Element | Thai label |
|---|---|
| Page title | การผลิต |
| KPI tile 1 | จำนวนใบสั่งผลิต (ตามแผน) |
| KPI tile 2 | ปริมาณตามแผน (ต่อหน่วย) — one tile per distinct `MainUnits` value present, or a small per-unit breakdown list within one tile |
| KPI tile 3 | ใบสั่งผลิตที่มีการเบิกวัตถุดิบ |
| Chart title | ปริมาณตามแผนต่อสินค้า |
| Table column: MO number | เลขที่ใบสั่งผลิต |
| Table column: FG item | สินค้า |
| Table column: planned qty | ปริมาณตามแผน |
| Table column: status | สถานะ |
| Table column: actual produced | ผลิตจริง |
| Actual-produced empty-state value (every row, always) | ยังไม่มีข้อมูลผลิตจริง |
| Status badge values | รออนุมัติ / อนุมัติแล้ว / ปิดแล้ว / ยกเลิก |
| Material-issue drilldown page/section title | รายการเบิกวัตถุดิบ — [MO number] |
| Material-issue table columns | รหัสสินค้า / ชื่อสินค้า / จำนวน / หน่วย / วันที่เบิก |
| Material-issue empty state | ไม่มีรายการเบิกวัตถุดิบสำหรับใบสั่งผลิตนี้ |
| Pilot banner | ข้อมูลนำร่อง (consumed from Phase 1 shared component — not re-authored here) |
| Degraded-mode banner | ข้อมูลอาจไม่ล่าสุด (consumed from Phase 1 shared component — not re-authored here) |
| Filter labels | ช่วงวันที่ / สถานะ |
| Mobile empty list | ไม่มีใบสั่งผลิตตามเงื่อนไขที่เลือก |

---

## Implementation Checklist

### Step A — Pure logic + data-fetch functions (no UI yet)

- [ ] A1. Create `src/app/(main)/dashboards/production/production-status.ts` — pure
      `deriveMoStatus(mo: { approved, isClosed, isCancel }): { label: string; tone: ChipTone }`,
      implementing the CASE precedence above (`ISNULL(IsClosed,0)` semantics, cancel-first).
- [ ] A2. Write `src/lib/__tests__/production-status-derivation.test.ts` — TDD-first: write the
      failing test asserting the 4 status branches (รออนุมัติ / อนุมัติแล้ว / ปิดแล้ว / ยกเลิก) AND
      the `IsClosed = null` (open, not closed) edge case BEFORE implementing A1's function body; run
      red, then implement A1 to make it green.
- [ ] A3. Create `db/erp-queries/production/mo-list.sql` with the exact query from Data/SQL Details
      above (versioned, reviewable by KRS ERP team — include a header comment citing the data
      dictionary section it's sourced from).
- [ ] A4. Create `db/erp-queries/production/material-issues.sql` with the exact query above.
- [ ] A5. Create `src/app/(main)/dashboards/production/production-data.ts` exporting
      `getProductionMoList(filters: { dateFrom?, dateTo?, status? })` and
      `getMaterialIssuesForMo(moNumBer: string)`, both calling `guardedQuery` (Phase 1's import) with
      the SQL from A3/A4, wrapped in Phase 1's short-TTL cache helper. Both are plain async functions
      returning plain objects — no JSX, no Next-specific types — so Phase 5 can import them for CSV
      export without modification.
- [ ] A6. **Section A test gate:** run `pnpm test production-status-derivation` — must be green
      before proceeding to Step B.

### Step B — Fixture tests proving the plan-only + drilldown behavior (TDD-first)

- [ ] B1. Write `src/lib/__tests__/production-plan-only-empty-state.test.ts` FIRST (red): assert that
      for every row `getProductionMoList()` returns, the rendered/derived "actual produced" field is
      always the literal string `"ยังไม่มีข้อมูลผลิตจริง"` regardless of `Prodqty`/`LotQty` values in
      the fixture, and that no field in the returned shape or rendered output represents a percentage
      achievement figure. This is the direct AC7 proof.
- [ ] B2. Write `src/lib/__tests__/production-material-issue-drilldown.test.ts` FIRST (red): seed the
      `erp_fixture` DB (via Phase 1's fixture seed helper) with an MO that has ≥1 linked
      `InventoryFlowDtl` row (`MONo` string match + correct `ReasonName`) and one MO with ZERO linked
      rows; assert `getMaterialIssuesForMo()` returns the correct rows for the first and an empty
      array (not an error) for the second. This is the direct AC8 proof. **(PVL addition, 18-09-26:**
      also assert a third case — a linked `InventoryFlowDtl.MONo` value with leading/trailing
      whitespace padding still matches its MO via the `TRIM()`-guarded query above; this closes the
      loop on the Risks table's "string-match-only linkage" mitigation, which promised this exact
      fixture case.)
- [ ] B3. Implement A5's query-calling logic (if not already complete) to make B1 and B2 green.
      **Section B test gate:** `pnpm test production-plan-only-empty-state production-material-issue-drilldown` green.

### Step C — Page UI (desktop table + mobile cards)

- [ ] C1. Create `src/app/(main)/dashboards/production/page.tsx` — `requireAuth()`,
      `dynamic = "force-dynamic"`, reads URL searchParams for date-range/status filters, calls
      `getProductionMoList(filters)`, renders KPI tiles (`Card`), the bar chart (CSS bars, matching
      `/summary`'s existing pattern — or Recharts if Phase 2's spike passed and this phase's own
      INNOVATE step independently chooses to adopt it), and the `dashboard-data-table` component with
      MO rows.
- [ ] C2. Render the "actual produced" column via a small inline component that ALWAYS shows the
      empty-state string (never conditionally shows a number) — make this structurally impossible to
      regress by not passing any numeric prop into that cell at all.
- [ ] C3. Wire status badges via `Chip` (tone mapping: รออนุมัติ → neutral, อนุมัติแล้ว → brand,
      ปิดแล้ว → success, ยกเลิก → danger).
- [ ] C4. Create `src/app/(main)/dashboards/production/production-mobile.tsx` — `md:hidden` card list
      mirroring `admin/users/users-mobile.tsx`'s card structure (MO number + FG item + status chip +
      planned qty + actual-produced empty-state line), imported and rendered by `page.tsx` alongside
      the desktop table (desktop table wrapped `hidden md:block` or equivalent — do not duplicate data
      fetching, both consume the same `page.tsx`-level fetched data).
- [ ] C5. Create the MO → material-issue drilldown surface. **INNOVATE decision recorded here:**
      choose either (a) a nested route `dashboards/production/[moNumber]/page.tsx` (full navigation,
      matches SPEC's "navigates to ... the list" wording most literally and gives a bookmarkable URL
      per AC10/AC11's URL-driven pattern) or (b) an in-page expand/collapse row (matches SPEC's
      "or expands into" alternative wording). Default recommendation: **(a) nested route** — it is
      more consistent with AC10/AC11's URL-bookmarkability requirement and the existing app's
      drilldown precedent (e.g. `/orders/[id]`). Implement whichever is chosen and document the
      choice + rejected alternative in the phase report's Decision Summary (INNOVATE step, step 2 of
      Phase Loop Progress).
- [ ] C6. Implement the material-issue empty state (C5's route/expand renders the Thai empty-state
      string when `getMaterialIssuesForMo()` returns `[]`).
- [ ] C7. Wire date-range + status filters as URL searchParams (controlled inputs, navigate on
      change, mirrors `shop-location-filter.tsx`'s pattern) — reloading a filtered URL must reproduce
      the same view (AC10).
- [ ] C8. Wire sort + pagination via the shared `dashboard-data-table` component's existing
      props/contract (no new sort/paginate logic written here — Phase 1 owns that).
- [ ] C9. **Section C test gate:** manually verify (agent-probe, no automated assertion yet) that the
      page renders with a small in-memory/fixture dataset; proceed to Step D for the automated e2e
      proof.

### Step D — E2E gates + append-only shared-file edits

- [ ] D1. Create `e2e/dashboards-production.spec.ts` covering: nav entry visible + reachable (AC1
      Production share), plan-only empty-state column always renders the Thai string with no
      achievement-% anywhere on the page (AC7), material-issue drilldown navigation + empty-state
      (AC8), filter round-trip via URL (AC10), breakdown-row → drilldown navigation (AC11), sort +
      paginate without losing filters (AC12), mobile 390×844 card view renders card list not table
      (AC13, via an in-file `test.use({ viewport: { width: 390, height: 844 } })` override inside
      this same spec file — reuses Phase 2's PVL-resolved pattern; the existing `mobile` Playwright
      project's `testMatch: /mobile\.spec\.ts/` regex does NOT pick up this file, so this phase does
      NOT rely on `--project=mobile` — see Registry Change Requests below).
- [ ] D2. Append `/dashboards/production` (and the drilldown route from C5) to
      `src/lib/__tests__/auth-guard-coverage.test.ts`'s expected-routes list — Production entries
      ONLY, do not touch Sales/Purchase/Phase-1 entries already present.
- [ ] D3. Update `process/context/all-context.md`'s erp-dashboards feature entry with this phase's own
      status line (append/update only).
- [ ] D4. **Section D test gate (full phase regression):** run
      `pnpm test` (full Vitest suite — confirms no regression in Phase 1/2/3's tests, which may exist
      in parallel by the time this phase executes) and
      `pnpm test:e2e -- e2e/dashboards-production.spec.ts` (file-path invocation, mirrors Phase
      2/3's exact pattern for this program — `--grep dashboards-production` would match ZERO tests
      because Playwright's `--grep` filters on test TITLE text, not filename, and this repo's
      existing spec titles do not embed a feature-slug string) green.
- [ ] D5. Recommend `vc-git-manager` for a logical commit of this phase's changes before UPDATE
      PROCESS.

---

## Data Flow

```
User -> GET /dashboards/production?dateFrom=...&status=...
  -> requireAuth() [Phase 1's auth-guard.ts, unchanged]
  -> production-data.ts: getProductionMoList(filters)
       -> Phase 1 cache.ts (short-TTL) -> [cache miss] -> Phase 1 guardedQuery(mo-list.sql)
            -> assertReadOnlySql denylist check -> Phase 1 mssql.ConnectionPool -> erp_fixture (dev/test)
       -> [cache hit or ERP down] -> last-cached value + degrade banner flag (Phase 1's degrade.ts)
  -> page.tsx renders KPI tiles + chart + dashboard-data-table (desktop) / production-mobile.tsx (phone)
  -> user clicks an MO row -> navigate to /dashboards/production/[moNumber] (or expand)
       -> production-data.ts: getMaterialIssuesForMo(moNumBer)
            -> same guardedQuery / cache / degrade path, against material-issues.sql
       -> renders material-issue list or the "ไม่มีรายการเบิกวัตถุดิบ..." empty state
```

Every arrow above passes through Phase 1's single `guardedQuery` choke point — this phase never
opens its own ERP connection, never imports `mssql` directly, and never touches Prisma for ERP data.

---

## Failure Modes

| Failure | Handling |
|---|---|
| ERP connection down when loading `/dashboards/production` | Phase 1's degrade path returns last-cached MO list + a flag; page renders the "ข้อมูลอาจไม่ล่าสุด" banner instead of an error page (AC15 — proven by Phase 1's shared scenario, this phase just consumes it correctly) |
| `LotQty` is NULL (MO-1 fixture case) | Fall back to `Prodqty` for the planned-quantity display ONLY; never label it "actual" |
| `IsClosed` is NULL (open MO) | `ISNULL(IsClosed, 0)` in SQL — never a bare `WHERE IsClosed = 0` comparison, which would silently drop open MOs |
| Zero material issues linked to an MO (the common case) | Render the Thai empty state, not an error or blank table |
| `assertReadOnlySql` rejects a malformed query at dev time | Fail loudly in dev (thrown error surfaces in the Next error boundary); this is the guard working as intended, not a bug to route around |
| A future MO row has a genuinely non-null "actual" figure from some yet-unbuilt ERP workflow | Out of scope for this phase to detect/react to automatically — the empty-state string is hardcoded by design; revisiting this requires an explicit follow-up phase/backlog item once KRS confirms a real actual-capture workflow exists (per data dictionary §129's open question) |
| Two MOs share the same `FgCode` with different `MainUnits` (unlikely given `InventoryItem` design, but not proven impossible) | Group the chart/KPI aggregation strictly by `(FgCode, MainUnits)` pair, never by `FgCode` alone, to avoid an accidental cross-unit sum |

---

## Dependencies

- Phase 1 exit gate (hard dependency — see Entry Gate).
- `erp_fixture` sandbox database must contain representative MO / `InventoryFlowDtl` / `InventoryItem`
  rows reproducing the documented edge cases (null `LotQty`, null `IsClosed`, zero-linked-material-
  issue MOs, at least one MO with ≥1 linked issue) — Phase 1 owns fixture DDL/seed; if the seed is
  missing a needed edge case for this phase's tests, route the gap back to Phase 1 via
  PLAN-SUPPLEMENT rather than editing Phase 1's fixture files directly.
- Shared `dashboard-data-table` component's public props contract (sort/paginate/mobile-card) must be
  stable by the time this phase's Step C begins.

---

## Risks

| Risk | Mitigation |
|---|---|
| Status-derivation CASE precedence is LOW-confidence (only 2/4 branches exercised in real fixture data) | Ship as best-available; document the confidence caveat verbatim in the phase report; do not silently claim it is fully validated |
| String-match-only MO↔material-issue linkage (no FK) could silently miss rows if `MONo` formatting ever drifts (e.g. leading zeros, whitespace) | Add a defensive `TRIM()` in the SQL and a fixture test case with a deliberately whitespace-padded `MONo` to catch this class of bug early |
| Recharts adoption decision (if Phase 2's spike passed) could introduce a bundle-size or peer-dep surprise specific to this dashboard's chart shape | Default to CSS bars (zero new risk) unless this phase's own INNOVATE step explicitly re-validates Recharts against this phase's specific chart (single-series bar, simpler than Sales') |
| Confusing "planned quantity" with "actual" anywhere in code, tests, or UI copy — the single highest-value risk given the proven-negative finding | C2's structural mitigation (never pass a numeric prop into the actual-produced cell) + B1's explicit fixture test are the two independent guards against this regressing |

---

## DB-Safety Notes

- Every SQL file in this phase's scope targets `erp_fixture` for dev/test; the connection resolver
  used is Phase 1's ERP-specific resolver (a separate URL/env var from `DATABASE_URL`), never the
  Prisma `orderstock` sandbox connection string.
- No query in this phase writes, updates, deletes, or issues DDL — every query is a plain `SELECT`.
  The `assertReadOnlySql` guard (Phase 1) is the enforcement mechanism; this phase's own SQL files
  are an additional human-readable safety layer (reviewable by the KRS ERP team) but are not
  themselves the security boundary.
- This phase never connects to db_TCL. The eventual switch to a real, scoped read-only ERP login for
  production go-live is a Phase 5 + USER-RUN (DBA) concern — out of scope here.

---

## Rollback

- All new files are additive (new routes, new pure helpers, new test files, new SQL files). Rollback
  = delete the files listed in Touchpoints' "Owned (create)" table and revert the two append-only
  shared-file edits (removing only this phase's appended lines).
- No schema, migration, or data mutation occurs in this phase — rollback carries zero data-loss risk.
- If `dashboard-data-table` component usage from Phase 1 needs to change to accommodate this phase,
  and that change is rejected, this phase falls back to a simpler hand-rolled table for MO rows
  (documented as a scope reduction in the phase report) rather than blocking on Phase 1.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm test production-status-derivation` | Fully-Automated | AC7 (status derivation correctness, supporting evidence) |
| `pnpm test production-plan-only-empty-state` | Fully-Automated | AC7 — proven by: production-plan-only-empty-state fixture scenario |
| `pnpm test production-material-issue-drilldown` | Fully-Automated | AC8 — proven by: production-material-issue-drilldown scenario against the ERP fixture dataset |
| `pnpm test:e2e -- e2e/dashboards-production.spec.ts` (AC1 nav-entry sub-check) | Fully-Automated | AC1 (Production's share) — proven by: dashboards-nav-visibility e2e scenario |
| `pnpm test:e2e -- e2e/dashboards-production.spec.ts` (filter round-trip) | Fully-Automated | AC10 — proven by: dashboards-filter-url-roundtrip scenario |
| `pnpm test:e2e -- e2e/dashboards-production.spec.ts` (drilldown nav) | Fully-Automated | AC11 — proven by: dashboards-drilldown-navigation scenario |
| `pnpm test:e2e -- e2e/dashboards-production.spec.ts` (sort/paginate) | Fully-Automated | AC12 — proven by: dashboards-table-sort-paginate scenario |
| `pnpm test:e2e -- e2e/dashboards-production.spec.ts` (card view, in-file `test.use({viewport:...})` override — no `--project=mobile`, see Registry Change Requests) | Fully-Automated | AC13 — proven by: dashboards-mobile-card-view scenario |
| Manual visual check of chart/tile rendering at desktop + mobile widths before D4 | Agent-Probe | Supports AC7 UI-quality readability (not a numeric assertion) |
| `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | Fully-Automated | Program-level "verified" bar (harness health, not a SPEC AC) |
| `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` | Fully-Automated | Program-level "verified" bar (context routing health, not a SPEC AC) |
| AC18 live boot-probe against the real scoped read-only login | Agent-Probe (residual, Phase 5-owned) | AC18 — explicitly NOT this phase's gate; recorded here only to note this phase does not attempt it |

Known-gap (per vacuous-green ban — recorded, not silently dropped): the LOW-confidence status
precedence order (see Risks) has no automated way to reach FULL confidence within this phase's
fixture data (n=3 in the tested real-data snapshot at data-dictionary-writing time); the CONDITIONAL
gate on this remains open until KRS confirms a broader real-data spread. This does not block PASS on
the automated gates above (which test the CASE logic mechanically, not the real-world distribution)
but is flagged for Phase 5's regression/hardening pass to re-check with fresh fixture data if
available by then.

---

## Test Infra Improvement Notes

- The `erp_fixture` sandbox database and its seed data are entirely Phase 1's responsibility. If, at
  EXECUTE time, this phase discovers a needed fixture row/edge-case is missing (e.g. an MO with a
  deliberately whitespace-padded `MONo`, or a second FG item sharing the same `MainUnits` value for
  the unit-grouping test), route it back to Phase 1 as a PLAN-SUPPLEMENT rather than seeding it
  directly from this phase's test files — keeps fixture ownership in one place.
- No new test runner or CI wiring is introduced by this phase — it reuses the existing Vitest +
  Playwright setup and the `mobile`/`chromium` projects already configured in `playwright.config.ts`.
  If a future phase needs a Production-specific viewport or project, that is a Phase 5 concern (or a
  backlog item), not this phase's.
- Consider, as a backlog item (not required for this phase's PASS): a small reusable Vitest helper
  for asserting "no numeric value rendered in a designated empty-state cell" — the AC7 pattern (plan-
  only, no achievement-%) may recur if a future ERP dashboard needs a similar honesty-guarantee test.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-04-production-dashboard_PLAN_18-09-26.md`
- Last completed step: none — plan just written, Phase Loop Progress at Step 0 (entry gate check)
- Validate-contract status: pending — placeholder below; vc-validate-agent writes it before EXECUTE
- Next step for a fresh agent: confirm Phase 1's exit gate has passed (read the umbrella's
  `## Current Execution State` and this registry's Phase 1 section for `status: DONE`), then spawn
  vc-research-agent for this phase's RESEARCH step (Phase Loop Progress item 1).
- Do NOT spawn vc-execute-agent until Phase Loop Progress item 4 (PVL) shows a written, non-
  placeholder `## Validate Contract` section below.
- If Phase 1's owned files (`src/lib/erp/*`, `dashboard-data-table.tsx`) do not yet exist on disk
  when this phase's RESEARCH step runs, treat that as a hard entry-gate failure — do not stub or
  reimplement Phase 1's contract independently; wait for Phase 1 or escalate per the BLOCKED
  escalation path in `orchestration.md`.

---

## Blockers That Would Justify BLOCKED Status

- Phase 1's exit gate has not passed (`src/lib/erp/*`, shared data-table component, or `erp_fixture`
  DB do not yet exist/pass their own gates).
- The `erp_fixture` database lacks the MO/`InventoryFlowDtl` rows needed to reproduce the documented
  edge cases (null `LotQty`, null `IsClosed`, zero-linked MOs) and Phase 1 cannot supply them in time
  — route as a backlog note + BLOCKED-skipped registry entry rather than fabricating fixture data
  from this phase.
- Registry conflict discovered: another phase (2 or 3) has, contrary to the Parallel-Safety
  Statement, touched a file this phase also needs — surface via `registry_change_requests` and halt
  this phase's EXECUTE step until resolved.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop
`R → I → P → PVL → E → EVL → UP` SKIPS SPEC (the umbrella SPEC governs this phase; no inner SPEC is
written here).

- [ ] 1. RESEARCH — research-agent: read Phase 1's actual delivered file shapes (once they exist),
      confirm `erp_fixture` seed coverage for this phase's edge cases, re-check the data dictionary
      for any Production-section updates since plan time, check plan drift
- [ ] 2. INNOVATE — innovate-agent: decide C5's nested-route-vs-expand drilldown approach (default
      recommendation: nested route, per Step C5); decide whether to adopt Recharts (only if Phase 2's
      spike passed) or CSS bars; write Decision Summary (chosen approach + rejected alternatives)
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: update this plan with RESEARCH/INNOVATE findings (or mark
      "n/a — research clean"); write an Inner Loop Refresh Note if sections changed
- [ ] 4. PVL — vc-validate-agent: full V1–V7; validate-contract written per
      `.claude/skills/vc-validate-findings/references/example-validate-output.md` (Status / Gate /
      Plan updates applied / Execute-agent instructions / Test gates / High-risk pack / Backlog
      artifacts / Known gaps / Accepted by)
- [ ] 5. EXECUTE — Steps A–D of the Implementation Checklist done; per-section test gates (A6, B3,
      C9, D4) run and green
- [ ] 6. EVL — vc-tester re-runs the exact Verification Evidence gate commands independently; all
      green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written to the destination above, umbrella
      `## Current Execution State` and `## Program Status Table` updated (Phase 4 row), this phase's
      status line appended to `process/context/all-context.md`, commit made via vc-git-manager

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract`
below reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", the orchestrator
must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent
instructions / Test gates sections is treated as a placeholder.

---

## Validate Contract

Status: PASS
Date: 18-09-26
date: 2026-09-18
generated-by: outer-pvl

Parallel strategy: sequential (single-agent inline fan-out)
Rationale: Signal score 2/7 (S4 phase-program classification, S7 9+ files in blast radius) —
MEDIUM band would normally recommend parallel Layer-1/Layer-2 subagents, but this specific PVL run
was explicitly directed to perform the dimension fan-out inline within one agent invocation
(no user menu, automatic mode). All 4 Layer-1 dimensions and the Layer-2 per-section feasibility
checks below were performed directly against the real repo file tree, the SPEC, the umbrella plan,
the blast-radius registry, and the tested data dictionary — not spawned as separate subagents.

Plan updates applied (all fixed in-plan during this PVL pass — 8 edits, see git diff on this file):
1. Step D1 + D4 + Verification Evidence: replaced `pnpm test:e2e --grep dashboards-production` with
   `pnpm test:e2e -- e2e/dashboards-production.spec.ts` everywhere. Playwright's `--grep` filters on
   test TITLE text, not filename — since no test in this repo's e2e suite titles itself with a
   feature-slug string, `--grep dashboards-production` would have matched ZERO tests. The file-path
   invocation mirrors Phase 2/3's own already-written commands (`pnpm test:e2e -- dashboards-sales.spec.ts`
   / `-- dashboards-purchase.spec.ts`).
2. AC13 (mobile card view): removed the `--project=mobile` assumption. The `mobile` Playwright
   project's `testMatch: /mobile\.spec\.ts/` regex only matches the literal file `mobile.spec.ts` —
   it would never pick up `dashboards-production.spec.ts`. Reused Phase 2's own PVL-resolved fix
   (documented in Phase 2's `## Registry Change Requests`, written for Phase 3/4 to reuse): an
   in-file `test.use({ viewport: { width: 390, height: 844 } })` override under the default
   `chromium` project, no `playwright.config.ts` edit.
3. Added a `## Registry Change Requests` section documenting the above (mirrors Phase 2/3's own
   section, explicitly "none required" with the resolution recorded).
4. Updated the inline `registry_change_requests:` note under Blast Radius to point at the new
   section instead of the stale "none identified" text.
5. Corrected the MO status-derivation caveat: the plan claimed `tbl_MoHdr.IsClosed` is "NULL when
   open, not 0" as a `tbl_MoHdr` fact — the tested fixture data (data dictionary §63 /
   `erp-domain-discovery_REF_18-09-26.md:705`) actually shows `IsClosed = 0` (not NULL) on all 3
   known MO rows. That NULL-when-open behavior is proven only for `tbl_PurchaseOrderHdr.IsClosed`.
   Reworded to keep `ISNULL(IsClosed, 0)` as a forward-looking defensive precaution (harmless
   either way) rather than a misattributed claim about `tbl_MoHdr`'s own tested data.
6. Added `TRIM()` to both sides of the `material-issues.sql` MO↔InventoryFlowDtl string-match join
   (`WHERE TRIM(d.MONo) = TRIM(@moNumBer)`) — the Risks table already promised this exact mitigation
   ("add a defensive TRIM() in the SQL") but the shown "exact query to implement" had omitted it.
   SQL Server 2019 (db_TCL's confirmed version) supports single-argument `TRIM()` (added in 2017).
7. Strengthened checklist item B2 to explicitly require a third fixture case (whitespace-padded
   `MONo` still resolves via the new `TRIM()` guard) — closing the loop between the Risks table's
   mitigation promise and the actual test checklist, which previously only covered the ≥1-linked-row
   and zero-linked-row cases.
8. (This entry.) All edits are text-only, additive, and stay within this phase's owned plan file —
   no other phase's file was touched.

Execute-agent instructions:
| # | Instruction | Trigger condition |
|---|---|---|
| E1 | Confirm Phase 1's actually-delivered `dashboard-data-table` component prop shape (sort/paginate/mobile-card contract) before Step C1. If it diverges from this plan's assumed usage, adapt without expanding scope and document the divergence in the phase report — do not edit Phase 1's owned component file. | Start of Step C1 |
| E2 | If `erp_fixture` lacks a needed edge-case row at EXECUTE time (whitespace-padded `MONo`, a second FG item sharing `MainUnits`, or a zero-linked-material-issue MO beyond what Phase 1 already seeded) route the gap back to Phase 1 via PLAN-SUPPLEMENT — never seed it directly into Phase 1's base fixture file or edit `production-seed.sql` to fabricate data outside documented fixture-representative values. | Steps A5/B1/B2 |
| E3 | Complete the C5 INNOVATE decision (nested route vs. expand) and record the Decision Summary (chosen approach + rejected alternative) in the phase report BEFORE writing the drilldown component — do not silently default to nested-route without recording the decision. | Before Step C5 |
| E4 | Read Phase 2's phase report to confirm whether its Recharts spike passed/failed before deciding CSS-bars-vs-Recharts for Step C1's chart. Never edit `package.json` regardless of the outcome — that decision belongs exclusively to Phase 2. | Before Step C1 |
| E5 | Re-run `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs` on this plan file if any further plan edits are made during RESEARCH/INNOVATE (Steps 1-2) before the inner-PVL re-validation — confirm 0 failures before proceeding to PLAN-SUPPLEMENT. | Steps 1-3 |

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC7-status | MO status derivation (4-branch CASE, `ISNULL(IsClosed,0)` defensive) | Fully-Automated | `pnpm test production-status-derivation` | A |
| AC7-empty-state | "Actual produced" column always renders `"ยังไม่มีข้อมูลผลิตจริง"`, never a number, no achievement-% anywhere | Fully-Automated | `pnpm test production-plan-only-empty-state` | A |
| AC8-drilldown | MO -> material-issue linkage via `TRIM()`-guarded `MONo` string match, incl. zero-match + whitespace-padded cases | Fully-Automated | `pnpm test production-material-issue-drilldown` | A |
| AC1-production-share | Production's nav entry reachable | Fully-Automated | `pnpm test:e2e -- e2e/dashboards-production.spec.ts` | A |
| AC10-filter | Date-range/status filter round-trips via URL | Fully-Automated | `pnpm test:e2e -- e2e/dashboards-production.spec.ts` | A |
| AC11-drilldown-nav | MO row click navigates to material-issue list | Fully-Automated | `pnpm test:e2e -- e2e/dashboards-production.spec.ts` | A |
| AC12-sort-paginate | Table sort + pagination without losing filters | Fully-Automated | `pnpm test:e2e -- e2e/dashboards-production.spec.ts` | A |
| AC13-mobile-card | Phone-width (390x844) renders card list, not table (in-file viewport override, no playwright.config.ts edit) | Fully-Automated | `pnpm test:e2e -- e2e/dashboards-production.spec.ts` | A |
| AC7-visual-quality | Chart/tile rendering readability at desktop + mobile widths | Agent-Probe | Manual visual check before D4 | A |
| harness-parity | Agent/skill parity unaffected by this phase's changes | Fully-Automated | `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | A |
| harness-context | Context-discovery routing unaffected | Fully-Automated | `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` | A |
| AC18-boot-probe | Live scoped read-only ERP login probe | Agent-Probe (residual) | Not this phase's gate — explicitly Phase 5-owned | C |
| status-precedence-confidence | Full-spectrum confidence on the 4-branch CASE precedence order (only 2/4 branches exercised, n=3) | Known-Gap | — (mechanical CASE logic is proven above; real-world distribution is not) | D |
| fg-receipt-signal | "Received into stock" indicator for completed MOs | Known-Gap | — (no ledger signal exists anywhere in the ERP schema, data dictionary §65 — explicitly not built, not a bug) | D |

gap-resolution legend: A = proven now, C = deferred to Phase 5 (named), D = backlog test-building
stub / named residual with written justification (both D rows already carry their justification
inline in the plan's own Data/SQL Details and Known-gap note — no separate backlog artifact
required; both are explicitly out-of-this-phase's-scope findings, not silently-dropped coverage).

Legacy line form:
- Production status/empty-state/drilldown logic: Fully-automated: `pnpm test production-status-derivation production-plan-only-empty-state production-material-issue-drilldown`
- Production dashboard e2e (nav/filter/drilldown/sort/mobile): Fully-automated: `pnpm test:e2e -- e2e/dashboards-production.spec.ts`
- Chart/tile visual quality: Agent-probe: manual check at desktop + mobile widths before Step D4
- AC18 live boot-probe: known-gap (explicitly Phase 5-owned residual, not this phase's gate)
- Status-precedence real-world confidence: known-gap: documented in-plan (Risks + Known-gap note), no broader fixture data available yet

Dimension findings:
- Infra fit: PASS — after fix. `dashboard-data-table`/`Card`/`Chip`/`be-date` imports match Phase
  1's documented shapes; the mobile-viewport e2e gate now correctly avoids the `mobile` project's
  narrow `testMatch` regex (fixed via in-file viewport override, reusing Phase 2's precedent).
- Test coverage: PASS — after fix. All Fully-Automated commands are now syntactically valid and
  will actually select tests (verified `--grep`'s title-only matching against real spec-file naming
  conventions in this repo; verified `--project` flag support via `playwright test --help`). Tier
  assignments follow the waterfall correctly; both Known-Gap rows carry written justification
  (no high-risk class is present in this phase's scope, so no hybrid-minimum is violated).
- Breaking changes: PASS — no existing route, schema, auth signature, or print surface is touched;
  new exported functions (`getProductionMoList`/`getMaterialIssuesForMo`) are additive and consumed
  only by this phase and, later, Phase 5 (documented contract, plain-object return shape).
- Security surface: PASS — strictly read-only via Phase 1's inherited `guardedQuery` choke point
  (hard entry-gate dependency, correctly gated); no auth/secret/trust-boundary logic is added by
  this phase; no money data exists in this phase's scope (explicitly and correctly noted for
  Phase 5's cross-dashboard audit).
- Section A (pure logic + data-fetch): PASS — mechanically feasible; `deriveMoStatus()` signature
  and TDD-first ordering (A2 before A1) are sound; no gaps or conflicts found.
- Section B (fixture tests): PASS — mechanically feasible, conditioned on Phase 1's `erp_fixture`
  seed covering the documented edge cases; correctly routes any gap back to Phase 1 via
  PLAN-SUPPLEMENT (E2 above) rather than editing Phase 1's owned seed file.
- Section C (page UI): PASS — mechanically feasible; the C5 nested-route-vs-expand decision is
  correctly deferred to this phase's own INNOVATE step (E3 above) rather than pre-decided without
  a Decision Summary. Highest-risk edit: C2 (structurally preventing a numeric prop from ever
  reaching the "actual produced" cell) — already the plan's own primary mitigation for the
  single highest-value risk (confusing planned-with-actual).
- Section D (e2e + shared-file appends): PASS — after fix (see Plan updates applied #1-2, #7).
  Append-only edits to `auth-guard-coverage.test.ts` and `all-context.md` correctly follow the
  registry's non-overlap rule.

Open gaps: none unresolved. Two named residuals carried forward as Known-Gap (status-precedence
real-world confidence; FG-receipt-into-stock ledger signal) — both already documented in-plan with
written justification, per the vacuous-green ban's "named residual" exception; neither blocks PASS
because the underlying mechanical behaviors they relate to (CASE logic; "no such column exists")
are each separately proven or are an explicit non-build, respectively.

What this coverage does NOT prove:
- `pnpm test production-status-derivation` proves the CASE branch logic is internally consistent;
  it does NOT prove the branch precedence order is correct against a realistic real-world status
  distribution (only 2/4 branches ever exercised in tested data, n=3) — carried as a named Known-Gap.
- `pnpm test production-plan-only-empty-state` / `production-material-issue-drilldown` prove
  fixture-shape correctness; they do NOT prove behavior against live db_TCL data (this phase never
  connects to db_TCL by design) or against ERP data volumes beyond the current pilot scale.
- `pnpm test:e2e -- e2e/dashboards-production.spec.ts` proves UI/navigation/filter/sort behavior
  against the `erp_fixture` sandbox; it does NOT prove real-printer/real-browser visual fidelity
  (that is the Agent-Probe row's job, and even that is a judgment call, not a pixel-perfect proof)
  or performance/load behavior under real ERP data volumes.
- The two harness validators prove agent/skill parity and context-routing health; they prove
  nothing about this phase's own dashboard logic.
- Neither Known-Gap row (status-precedence confidence; FG-receipt signal) has, or can have within
  this phase's scope, an automated proof — both are explicitly named, not silently dropped.

Gate: PASS (no FAILs, no unresolved CONCERNs — 8 plan-text fixes applied in this PVL pass;
2 named Known-Gap residuals carried forward with written justification per the vacuous-green
ban's exception, not blocking PASS)
Accepted by: N/A — Gate is PASS; no CONCERNs required acceptance. The 2 Known-Gap rows are named
residuals with in-plan written rationale, not accepted concerns.
