---
name: plan:erp-dashboards-phase-03-purchase-dashboard
description: "ERP Dashboards — Phase 3: /dashboards/purchase (dual-basis totals, derived PO status, received/outstanding, supplier drilldown)"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: phase-03
---

# Phase 3 — Purchase Dashboard

**Program:** erp-dashboards
**Umbrella plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
**SPEC (frozen, governs this phase — do not edit):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
**Registry (owned-path source of truth — do not edit; only append your own status):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-blast-radius-registry.md`
**Phase status:** ⏳ PLANNED
**Report destination:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_REPORT_18-09-26.md` (flat in the program task folder)
**Complexity:** COMPLEX
**Date**: 18-09-26
**Status**: ⏳ PLANNED
**Complexity**: COMPLEX

---

## Overview

This phase builds the read-only `/dashboards/purchase` screen (dual-basis totals, derived PO status with an unvalidated caveat, received/outstanding quantities, supplier breakdown, PO list/line drilldown) on top of Phase 1's shared ERP read foundation, per the umbrella SPEC's AC1/AC5/AC6/AC9/AC10-AC13 (Purchase slice). It runs in parallel with Phases 2 and 4 (disjoint blast radii — see the registry) and depends only on Phase 1's exit gate.

## Purpose

Build `/dashboards/purchase`, a read-only screen showing the Purchase module's real ERP activity
(currently 4 PO headers, 2 suppliers): a **dual-basis** money picture (billed via
`PurchaseInvoiceHdr` vs. committed via `PurchaseOrderHdr` — both correct, answering different
questions), a per-PO derived status with a visible "unvalidated" caveat badge, per-PO
received-vs-outstanding quantities computed via the ERP's own `sp_Popending` report logic, a
supplier breakdown, and PO-list → PO-line drilldown tables. Every money figure is server-gated to
ADMIN only. This phase depends only on Phase 1 (the shared ERP read foundation, guard, cache,
degrade path, and data-table component) and runs in **parallel** with Phase 2 (Sales) and Phase 4
(Production) — its blast radius is fully disjoint from both (see registry).

---

## Entry Gate

- Phase 1 exit gate passed: `guardedQuery`/`assertReadOnlySql` + ~24 ported guard tests green
  against `erp_fixture`; boot permission probe (mock mode) refuses a write-capable login;
  `/api/health/erp` live; cache wrapper + degrade banner proven; nav "แดชบอร์ด" group renders (all
  3 links, including `/dashboards/purchase`, already wired by Phase 1 — this phase does not touch
  `nav-links.tsx`); `src/components/dashboard-data-table.tsx` renders sort+paginate on a fixture
  dataset.
- `erp_fixture` sandbox database exists and is seeded (Phase 1's DDL/seed), reachable from the dev
  container per `docker-compose.yml`.
- `src/lib/erp/erp-adapter.ts` (guardedQuery choke point), `src/lib/erp/cache.ts`, and
  `src/lib/erp/degrade.ts` exist and export a stable contract (see Touchpoints → Imported-only).

If Phase 1's exit gate has not passed, this phase is BLOCKED — do not start EXECUTE. RESEARCH may
still run to re-confirm Phase 1's actual exported shapes before PLAN-SUPPLEMENT, per the 7-step loop.

---

## Scope

- `/dashboards/purchase` — page-level dashboard: pilot banner, degraded-mode banner slot, KPI
  tiles (dual-basis totals + PO count + supplier count), a supplier bar chart, a filterable/
  sortable/paginated PO list table.
- `/dashboards/purchase/[poNo]` — PO detail: header info (supplier, dates, status, both amounts)
  + a PO-lines table (item, ordered qty, received qty, price, amount).
- Derived PO status (documented `CASE` rule from the data dictionary) rendered as a status chip,
  ALWAYS paired with a small "ยังไม่ผ่านการยืนยัน" (unvalidated) caveat badge — the precedence
  order is unvalidated confidence-LOW per research; the badge is not optional or removable later
  without a fresh confidence check.
- Received / outstanding quantity per PO line, computed via the `sp_Popending`-derived join
  (`InventoryFlowDtl.PoNo` + `ItemCode`, `H.Approved=1 AND H.IsClosed<>1`, `VoucherNo LIKE
  'IPC%'`).
- Supplier breakdown (grouped by `SupplierCode`) with drilldown to a supplier-filtered PO list.
- Date-range + supplier + status URL-searchParam filters; sort + page on the PO list table without
  losing filters.
- Server-side money gating (`canSeeMoney = role === 'ADMIN'`) on every money figure/column: the
  two KPI totals, the PO list `amount` column, and the PO-lines `price`/`amount` columns.
- Mobile card view (phone width) for both the PO list and PO-lines tables, reusing Phase 1's
  shared data-table component's existing card-mode contract.
- Pure derivation helpers (`src/lib/purchase-calc.ts` or equivalent) for status/received/
  outstanding/dual-basis math, unit-testable without a DB connection.
- Versioned SQL files under `db/erp-queries/purchase/*.sql`.

## Out of Scope (this phase)

- CSV export (Phase 5 owns `src/app/api/dashboards/export/**` and wires it into every dashboard's
  existing data functions — Phase 3 exposes a stable, importable data-fetch function but does not
  build the export route itself).
- The cross-dashboard money-gate AUDIT (Phase 5).
- The manual live-reconcile-vs-`sp_Popending`/`sp_PurchaseInvoiceMonth` script against real
  `db_TCL` (Phase 5; this phase only proves correctness against the `erp_fixture` dataset).
- Any edit to `src/app/nav-links.tsx`, `src/lib/erp/*` (Phase 1-owned), `package.json`, or any
  Sales/Production dashboard file — see Blast Radius and the registry's non-overlap statement.
- Picking which Purchase total is the customer's preferred "primary headline" figure — that
  customer/user answer is an open SPEC question deferred to backlog; this phase ships BOTH totals
  side by side, neither visually subordinate to the other (equal-weight tiles), so the phase does
  not need to guess.
- Recharts adoption decision is Phase 2's alone; per registry, Phase 3 independently decides its
  own chart implementation but never edits `package.json`. This plan's INNOVATE decision (below)
  defaults to hand-rolled CSS bars (matching `/summary`'s existing pattern) — see Charting Decision.

---

## Data / SQL Details

All facts below are sourced from `erp-data-dictionary_REF_18-09-26.md` §B "Purchase / PO
Dashboard", §D "Status-derivation rules", and `erp-master-data_REF_18-09-26.md`'s `sp_Popending`
finding — re-verify against those files during RESEARCH if any figure looks stale.
`erp-domain-discovery_REF_18-09-26.md`'s per-table "Key columns" lists and verified drilldown SQL
were also cross-checked at PVL (18-09-26) and found two column-name errors in the original draft
of `po-list.sql`/`po-lines.sql` below — both are now corrected inline, marked `[PVL fix, 18-09-26]`.

### Primary purchase total (Invoice basis — matches KRS's own `sp_PurchaseInvoiceMonth` rule)

```sql
-- db/erp-queries/purchase/total-invoice-basis.sql
SELECT SUM(TotalAmount) AS total_invoice_basis
FROM PurchaseInvoiceHdr
WHERE (DocuType = 'PC' OR (PurchaseType = 'Invoice' AND VoucherNo NOT LIKE 'PC%'))
  AND IsClosed = 0
```
Known fixture-equivalent value on the live DB was 461,140 (4/4 PO-linked invoice rows). VAT is
always 0 in live data (`VATAmount=0` on every row) — do not build VAT-inclusive/exclusive
branching logic; ship VAT-exclusive display only, with a one-line code comment citing this
finding so a future agent does not "fix" an already-correct absence.

### Secondary purchase total (PO committed basis)

```sql
-- db/erp-queries/purchase/total-po-committed-basis.sql
SELECT SUM(TotalAmount) AS total_po_committed
FROM PurchaseOrderHdr
WHERE IsCancel = 0
```

### Supplier breakdown (PO basis; `SupplierCode` is the join/group key — never `SupplierName`)

```sql
-- db/erp-queries/purchase/supplier-breakdown.sql
SELECT SupplierCode, SUM(TotalAmount) AS total_po_committed, COUNT(*) AS po_count
FROM PurchaseOrderHdr
WHERE IsCancel = 0
GROUP BY SupplierCode
ORDER BY total_po_committed DESC
```
Display label = `SupplierCode` verbatim (e.g. `ช-001`). Do NOT join to a `Supplier`-name lookup
table for the breakdown label in this phase — no supplier-name column has been read/verified by
research, and the data dictionary explicitly warns the code, not the name, is the reliable join
key. This is a deliberate scope-narrowing decision (see Decisions Made table) to avoid introducing
an unverified column; note it as a backlog polish item, not a defect.

### PO list (main table)

```sql
-- db/erp-queries/purchase/po-list.sql
SELECT
  TransactionNo, PONumber, PODate AS VoucherDate, SupplierCode, TotalAmount,
  IsCancel, IsClosed, IsComplete, IsRecPo, IsApproved, IsCheck
FROM PurchaseOrderHdr
WHERE IsCancel = 0
  AND (@supplierCode IS NULL OR SupplierCode = @supplierCode)
  AND (@fromDate IS NULL OR PODate >= @fromDate)
  AND (@toDate IS NULL OR PODate <= @toDate)
ORDER BY PODate DESC
```
**[PVL fix, 18-09-26]** `VoucherDate` is a real ERP column, but it lives on `PurchaseInvoiceHdr` —
`PurchaseOrderHdr`'s own date column is `PODate` (confirmed in `erp-domain-discovery_REF_18-09-26.md`'s
`PurchaseOrderHdr` "Key columns" list). Filter/sort above now use the real column `PODate`; the
`SELECT` still aliases it back to `VoucherDate` so the row-shape name used elsewhere in this plan
(UI Details' "วันที่" column) is unaffected.

Status column is NOT filtered in SQL — it is derived in application code (see
`derivePoStatus()` below) from the flag columns already selected, then optionally filtered
client-of-query-side (in the page's TS layer) when a `?status=` searchParam is present, because
the derivation logic must stay in one place (testable in isolation) rather than duplicated as a
second `CASE` inside every query.

### PO lines (detail table, `TransactionNo` join key — confirmed working 1:N in research)

```sql
-- db/erp-queries/purchase/po-lines.sql
SELECT ItemCode, MainQuantity AS Qty, MainUnitPrice AS UnitPrice, TotalPrice AS Amount
FROM PurchaseOrderDtl
WHERE TransactionNo = @transactionNo
ORDER BY Number
```
**[PVL fix, 18-09-26]** The original draft named the raw columns `Qty`/`UnitPrice`/`Amount` and
ordered by `Slno` — none of the three exist on `PurchaseOrderDtl`, and `Slno` belongs to a
different table (`tbl_PoAmend`), not this one. The real columns, confirmed against
`erp-domain-discovery_REF_18-09-26.md`'s verified drilldown query (`SELECT ... d.Number,
d.ItemCode, d.MainQuantity, d.MainUnitPrice, d.TotalPrice FROM PurchaseOrderHdr h JOIN
PurchaseOrderDtl d ON d.TransactionNo = h.TransactionNo ... ORDER BY h.PODate, d.Number`), are
`MainQuantity` / `MainUnitPrice` / `TotalPrice`, ordered by `Number`. The query above aliases them
back to `Qty`/`UnitPrice`/`Amount` so every other reference in this plan (UI Details, the
Outstanding-quantity formula below) stays unchanged. RESEARCH step B1 still does one final
spot-check against the live `erp_fixture` schema once Phase 1 provisions it — this is now a
confirmatory check, not an open assumption.

### Received quantity per PO line (`sp_Popending` logic — ERP's own "PO ค้างรับ" report)

```sql
-- db/erp-queries/purchase/po-received.sql
SELECT d.PoNo, d.ItemCode, SUM(d.MainQuantity) AS received_qty
FROM InventoryFlowHdr h
JOIN InventoryFlowDtl d ON d.TranSactionno = h.TranSactionno AND d.VoucherNo = h.VoucherNo
WHERE h.Approved = 1
  AND h.IsClosed <> 1
  AND h.VoucherNo LIKE 'IPC%'
  AND d.PoNo = @poNumber
GROUP BY d.PoNo, d.ItemCode
```
Outstanding qty (per line) = `PurchaseOrderDtl.MainQuantity` (aliased `Qty` in `po-lines.sql`
above) `- COALESCE(received_qty, 0)`. Display the raw
computed value even if negative (an over-receipt is real data worth surfacing, not a bug to
clamp/hide) — a negative outstanding value should render with a distinct visual tone (see UI
Details) rather than being silently floored to 0.

### PO status derivation (pure function — NOT computed in SQL; unvalidated precedence, LOW confidence)

```ts
// src/lib/purchase-calc.ts (new)
export type PoStatus =
  | "Cancelled" | "Closed" | "Completed" | "Received" | "Checked" | "Approved" | "Pending";

export function derivePoStatus(flags: {
  isCancel: boolean;
  isClosed: boolean | null; // NULL when open — NEVER treat NULL as falsy without ISNULL semantics
  isComplete: boolean;
  isRecPo: boolean;
  isApproved: boolean;
  isCheck: boolean;
}): PoStatus {
  if (flags.isCancel) return "Cancelled";
  if ((flags.isClosed ?? false) === true) return "Closed"; // ISNULL(IsClosed,0)=1
  if (flags.isComplete) return "Completed";
  if (flags.isRecPo) return "Received";
  if (flags.isApproved && flags.isCheck) return "Checked";
  if (flags.isApproved) return "Approved";
  return "Pending";
}
```
Every call site renders this status alongside the unvalidated caveat chip — never standalone.

### Dual-basis reconciliation footnote (informational, no code — see UI Details)

No footnote is REQUIRED for Purchase the way AC4 requires one for Sales (Purchase's two totals
are both fully counted, not one excluding real data) — but both tiles MUST carry their own basis
label so a user never mistakes one total for "the" total.

---

## UI Details (Thai labels)

- Page title: "แดชบอร์ดการซื้อ"
- Pilot banner (reused component from Phase 1, imported not re-authored): "ข้อมูลนำร่อง"
- Degraded-mode banner (reused from Phase 1): "ข้อมูลอาจไม่ล่าสุด" — shown when the ERP read
  degrades to last-cached value.
- KPI tile 1 (money-gated): label "ยอดซื้อ (ตามใบแจ้งหนี้)" — value = invoice-basis total (THB).
- KPI tile 2 (money-gated): label "ยอดซื้อ (ตามใบสั่งซื้อ)" — value = PO-committed total (THB).
  Both tiles equal visual weight — no "primary/secondary" styling difference, per the deferred
  customer-framing question.
- KPI tile 3 (always visible, not money): label "จำนวนใบสั่งซื้อ" — count of non-cancelled POs.
- KPI tile 4 (always visible, not money): label "จำนวนซัพพลายเออร์" — distinct supplier count.
- Chart: "ยอดซื้อตามซัพพลายเออร์" — horizontal bar per `SupplierCode`, money-gated (bar VALUE
  hidden for Staff; render the chart itself only when `canSeeMoney` is true, since the bars are
  money by construction — Staff instead sees a text list of supplier + PO count with no bar/value).
- PO list table columns: เลขที่ใบสั่งซื้อ (PONumber, links to detail) / วันที่ (BE via
  `ceToBeDisplay`) / ซัพพลายเออร์ (SupplierCode) / สถานะ (status chip + unvalidated badge) /
  รับแล้ว/ค้างรับ (received/outstanding summary, aggregated across the PO's lines) / ยอดเงิน
  (money-gated — column entirely OMITTED from the row shape passed to the table for Staff, not
  CSS-hidden).
- PO detail page columns (PO-lines table): รหัสสินค้า (ItemCode) / จำนวนสั่ง (Qty) /
  จำนวนรับแล้ว (received_qty) / จำนวนค้างรับ (outstanding, red/warning `Chip` tone when negative)
  / ราคาต่อหน่วย (money-gated) / จำนวนเงิน (money-gated).
- Status chip tones (`src/components/ui/chip.tsx`): Cancelled→danger, Closed/Completed→success,
  Received/Checked→brand, Approved→accent, Pending→neutral. Unvalidated caveat badge: separate
  small `Chip tone="warning"` reading "ยังไม่ผ่านการยืนยัน", always adjacent to the status chip,
  never merged into one chip (so its removal later — if confidence improves — is a one-line diff).
- Filters (URL searchParams, mirrors `shop-location-filter.tsx`'s controlled-`<select>` +
  `useRouter().push` pattern for supplier/status; native `<input type="date">` pair for
  from/to, converted to/from BE display via `be-date.ts` the same way `new-sheet-form.tsx` already
  does): `?from=&to=&supplier=&status=&sort=&page=`.
- Empty state (0 rows after filtering): reuse the existing plain-Thai-text empty-state convention
  used elsewhere (e.g. `/history`'s style) — "ไม่พบใบสั่งซื้อตามเงื่อนไขที่เลือก".

## Charting Decision (INNOVATE — resolved for this phase)

**Chosen:** hand-rolled CSS bars, matching `/summary`'s existing pattern (`src/lib/summary.ts`'s
`topShops` shape reused conceptually — same "compute totals, render divs with width%" approach,
new file `src/lib/purchase-calc.ts` owns the Purchase-specific aggregation).
**Rejected:** adopting Recharts even if Phase 2's spike passes. Rationale: Phase 3 has only 2
live suppliers today (2 bars) — a charting library adds a peer-dependency surface for no visual
benefit at this data volume, and the registry explicitly reserves the `package.json` decision to
Phase 2 alone. If Phase 2's spike passed and a future phase wants Purchase to adopt Recharts too,
that is a follow-up PLAN-SUPPLEMENT to this phase, not a Phase-3 EXECUTE-time judgment call.

---

## Blast Radius

**Owned (per registry — exclusive to this phase):**
- `src/app/(main)/dashboards/purchase/page.tsx` (new)
- `src/app/(main)/dashboards/purchase/[poNo]/page.tsx` (new)
- `src/app/(main)/dashboards/purchase/purchase-filters.tsx` (new, client — URL-searchParam filter
  controls, mirrors `shop-location-filter.tsx`)
- `src/app/(main)/dashboards/purchase/purchase-chart.tsx` (new, server — CSS-bar chart)
- `src/lib/purchase-calc.ts` (new — pure derivation helpers: `derivePoStatus`,
  `computeOutstanding`, `aggregateSupplierBreakdown`)
- `src/lib/purchase-data.ts` (new — the guardedQuery-calling data-fetch layer; imports Phase 1's
  `guardedQuery`/cache/degrade contract, never Prisma, never `$queryRaw`)
- `db/erp-queries/purchase/*.sql` (new — 5 files: `total-invoice-basis.sql`,
  `total-po-committed-basis.sql`, `supplier-breakdown.sql`, `po-list.sql`, `po-lines.sql`,
  `po-received.sql`) — 6 files total, versioned and reviewable by KRS's ERP team
- `src/lib/__tests__/purchase-status.test.ts` (new)
- `src/lib/__tests__/purchase-received.test.ts` (new)
- `src/lib/__tests__/purchase-dual-basis.test.ts` (new)
- `e2e/dashboards-purchase.spec.ts` (new)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_REPORT_18-09-26.md` (new, at UPDATE-PROCESS)

**Shared files touched (append-only per registry rule):**
- `src/lib/__tests__/auth-guard-coverage.test.ts` — append ONLY a new `DASHBOARD_PAGES` entry (or
  extend an existing one Phase 1/Phase 2 may have already started — check RESEARCH-time state
  first) for `src/app/(main)/dashboards/purchase/page.tsx` and
  `src/app/(main)/dashboards/purchase/[poNo]/page.tsx`, mirroring the existing `PRINT_PAGES`
  pattern (`export default async function` + `requireAuth(` grep-presence check) — never remove
  or reorder another phase's entries.
- `process/context/all-context.md` — append/update ONLY this phase's own status line inside the
  `erp-dashboards` feature entry (added by Phase 0); do not touch Phase 0's original entry
  structure or any other phase's status line.

**Explicit non-overlap (per registry):** this phase never edits any file under
`src/app/(main)/dashboards/sales/**` or `src/app/(main)/dashboards/production/**`, any
`db/erp-queries/sales/*` or `db/erp-queries/production/*` file, `package.json`, `src/lib/erp/*`
(Phase 1-owned — imported read-only), `src/app/nav-links.tsx`, or any Sales/Production-named
test/spec file. Any registry change request goes below, not inline into another phase's owned
paths.

---

## Acceptance Criteria (SPEC-Linked)

This phase is responsible for proving the Purchase slice of these umbrella SPEC acceptance criteria (full text in `erp-dashboards_SPEC_18-09-26.md`):

- AC1 — Purchase entry in the "แดชบอร์ด" nav group is reachable (nav itself is Phase 1-owned; this phase only needs its route to exist at the path Phase 1 already wired).
- AC5 — dual-basis totals (invoice-based + PO-committed) both render correctly against the `erp_fixture` dataset.
- AC6 — PO status badge + received/outstanding quantities are correct against documented fixture edge cases, with a visible unvalidated-badge caveat.
- AC9 (Purchase) — money figures/columns visible to Admin, absent (server-side) for Staff, on this dashboard.
- AC10-AC13 (Purchase) — filter/URL roundtrip, drilldown navigation, sort+paginate, mobile-card view.

Phase Completion Rules: this phase is DONE only when every checklist item in the Implementation Checklist is checked, every row in Verification Evidence is green or an explicitly-accepted known-gap with a backlog stub, and the Phase Loop Progress steps 1-7 are all checked. It is VERIFIED only after the EVL independent re-run (step 6) confirms every Fully-Automated and Hybrid gate green with no vacuous known-gap standing in for a real proof.

## Registry Change Requests

None identified. This phase's file set matches the registry's Phase 3 section exactly as written
at umbrella-plan time. If RESEARCH discovers Phase 1's actual export names differ from the
placeholder names assumed here (`guardedQuery`, `src/lib/erp/erp-adapter.ts`, etc.), record the
real names in the phase report and treat this section as "n/a — no registry change needed," since
those files are Phase-1-owned and this phase only imports them.

---

## DB Safety Notes (hard constraints, non-negotiable)

- Every query in `db/erp-queries/purchase/*.sql` is a bare `SELECT` — no `INSERT`/`UPDATE`/
  `DELETE`/`MERGE`/DDL, ever. Each file must pass Phase 1's `assertReadOnlySql` guard before this
  phase's own tests are considered meaningful (the guard test suite itself is Phase 1's, but this
  phase's `purchase-data.ts` MUST route every query through `guardedQuery` — never construct a raw
  `mssql` request directly).
- All development and automated testing runs against the local `erp_fixture` sandbox database
  (Phase 1-provisioned), never against live `db_TCL`. No agent in this phase connects to `db_TCL`
  under any circumstance.
- `WITH (NOLOCK)` (or equivalent `READ UNCOMMITTED` session setting, per Phase 1's pool config) is
  used on every aggregate query — apply the same hint Phase 1 establishes as its pool-level
  default; do not add per-query lock hints inconsistent with Phase 1's convention discovered during
  RESEARCH.
- Never add `PurchaseOrderHdr`/`PurchaseOrderDtl`/`PurchaseInvoiceHdr`/`InventoryFlowHdr`/
  `InventoryFlowDtl` (or any other ERP table) to `prisma/schema.prisma`. Never call `prisma.$queryRaw`
  against any ERP table.
- If the `erp_fixture` seed does not yet contain the specific edge case this plan's SQL/derivation
  logic needs (e.g. an `IsClosed IS NULL` row, an over-received PO line), and Phase 1's seed does
  not cover it, this phase MAY add fixture ROWS (not schema/DDL changes) to Phase 1's seed file
  under a clearly-commented "Phase 3 fixture additions" block — never editing Phase 1's existing
  rows, only appending new ones. If Phase 1's seed file structure does not support additive rows
  cleanly, route this as a PLAN-SUPPLEMENT back to Phase 1 instead of forcing an edit.

---

## Implementation Checklist

### Step A — Data layer (pure logic first, TDD)

- [ ] A1. Write `src/lib/purchase-calc.ts`: `derivePoStatus()`, `computeOutstanding(orderedQty,
  receivedQty)`, `aggregateSupplierBreakdown(rows)`. Pure functions, no imports beyond types.
- [ ] A2. Write the 3 pure-logic test files (`purchase-status.test.ts`, `purchase-received.test.ts`,
  `purchase-dual-basis.test.ts`) FIRST as failing tests (red), covering: the `IsClosed IS NULL`
  edge case, an over-received line (negative outstanding), a cancelled PO short-circuiting every
  other flag, and a supplier-breakdown aggregation over ≥2 suppliers with tie-breaking by
  `SupplierCode` ascending (deterministic sort, mirrors `topShops`' tie-break convention).
- [ ] A3. Implement until A2's tests are green.

### Step B — ERP query + fetch layer

- [ ] B1. Write the 6 SQL files under `db/erp-queries/purchase/*.sql` exactly as specified in Data
  / SQL Details above (column names for `po-lines.sql`/`po-list.sql` were corrected at PVL,
  18-09-26 — see the inline `[PVL fix, 18-09-26]` notes in that section); do one final spot-check
  of `PurchaseOrderDtl.Number`/`PurchaseOrderHdr.PODate` against the live `erp_fixture` schema
  once Phase 1 provisions it, before finalizing `po-lines.sql`/`po-list.sql`.
- [ ] B2. Write `src/lib/purchase-data.ts`: functions `getPurchaseTotals()`,
  `getSupplierBreakdown()`, `getPoList(filters)`, `getPoDetail(poNo)` — each loads its `.sql` file,
  calls Phase 1's `guardedQuery`, and returns typed rows. Every function wraps its call in Phase
  1's cache/degrade helper per the established contract (confirm exact function names/signatures
  during RESEARCH — do not guess if they differ from this plan's placeholders).
- [ ] B3. Confirm (via a scratch/manual run against `erp_fixture`, not committed) that
  `total-invoice-basis.sql` and `total-po-committed-basis.sql` reproduce the fixture-equivalent
  values seeded by Phase 1 (or seeded by this phase per DB Safety Notes if a needed edge case is
  missing).

### Step C — Pages and components

- [ ] C1. Write `src/app/(main)/dashboards/purchase/page.tsx`: `requireAuth()` (no role — ADMIN
  and STAFF both open the page), `export const dynamic = "force-dynamic"`, `searchParams:
  Promise<{ from?; to?; supplier?; status?; sort?; page? }>` (Next 16 async-searchParams
  convention, per `orders/page.tsx`'s existing pattern), compute `canSeeMoney = role ===
  "ADMIN"`, render pilot banner + degraded-mode banner (conditionally) + 4 KPI tiles (`Card`
  primitive) + `purchase-chart.tsx` + `purchase-filters.tsx` + the shared data-table component fed
  a money-stripped row shape when `!canSeeMoney`.
- [ ] C2. Write `src/app/(main)/dashboards/purchase/[poNo]/page.tsx`: same auth/dynamic pattern,
  fetches one PO's header + lines, renders header info + PO-lines table (money-stripped for
  Staff).
- [ ] C3. Write `purchase-filters.tsx` (client component): supplier `<select>` + status `<select>`
  + from/to date inputs, `useRouter().push` on change, mirrors `shop-location-filter.tsx`'s
  controlled-value + URL-navigate pattern exactly.
- [ ] C4. Write `purchase-chart.tsx` (server component): CSS-bar rendering, money-gated per
  Charting Decision — when `!canSeeMoney`, render the fallback list (supplier + PO count, no
  bar/value) instead of bars.
- [ ] C5. Confirm the shared `dashboard-data-table.tsx` component (Phase 1) supports: sort-column
  toggling via searchParam, page navigation via searchParam, a mobile card-mode render — read its
  actual prop contract during RESEARCH (do not assume a shape not yet built by Phase 1) and adapt
  Step C1/C2's usage to match exactly.

### Step D — Money gating

- [ ] D1. Verify every money-bearing field (`total_invoice_basis`, `total_po_committed`, PO list
  `amount`, PO-lines `price`/`amount`) is OMITTED from the data object passed to a Staff-rendered
  page/component — never merely CSS-hidden. Write this as an explicit code comment at each strip
  point citing AC9.
- [ ] D2. Add a Staff-role manual/agent-probe check (see Verification Evidence) confirming no
  money string/number appears anywhere in the rendered Staff HTML for both pages.

### Step E — Tests and e2e

- [ ] E1. `e2e/dashboards-purchase.spec.ts`: nav to `/dashboards/purchase` (ADMIN), assert both KPI
  tiles render with the two distinct basis labels and values matching the `erp_fixture` seed;
  assert Staff sees the page with money columns/tiles absent (server-rendered, not hidden);
  assert filter searchParam roundtrip (change supplier filter → URL updates → reload reproduces
  same filtered rows); assert drilldown navigation (breakdown row → filtered PO list → PO row →
  PO detail page with lines); assert sort/page on the PO list without losing the active filter;
  assert mobile-card rendering on the `mobile` Playwright project (390×844).
- [ ] E2. Run `pnpm test` — all new Vitest files green, no regression in existing suites.
- [ ] E3. Run `pnpm test:e2e` — new spec green, no regression in existing specs (incl. the
  existing 3-tab `mobile.spec.ts` assertion, since this phase never touches the bottom tab bar).
- [ ] E4. Run `pnpm lint` and `pnpm build` — both clean.

### Step F — Context + registry housekeeping (UPDATE-PROCESS)

- [ ] F1. Append this phase's routes to `auth-guard-coverage.test.ts` (per Blast Radius §Shared).
- [ ] F2. Append this phase's status line to `process/context/all-context.md`'s erp-dashboards
  feature entry.
- [ ] F3. Append this phase's `status: DONE` (or `BLOCKED-skipped`, if applicable) line to the
  registry's Status Ledger table — append only, never edit another phase's row.
- [ ] F4. Write the phase report to the Report Destination path above.
- [ ] F5. Rewrite the umbrella plan's `## Current Execution State` section (overwrite, not
  append).
- [ ] F6. Commit this phase's execution changes (via vc-git-manager) separately from any
  process/plan commit.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `po-lines.sql`/`po-list.sql` used wrong column names (`Qty`/`UnitPrice`/`Amount`/`Slno`/`VoucherDate`) — resolved at PVL; real columns are `MainQuantity`/`MainUnitPrice`/`TotalPrice`/`Number`/`PODate` | LOW (already corrected + cited against `erp-domain-discovery_REF_18-09-26.md`) | LOW (cosmetic if still off — line order / date filter) | Step B1 does one final spot-check against the live `erp_fixture` schema once Phase 1 provisions it |
| Phase 1's `guardedQuery`/cache/degrade export names differ from this plan's placeholders | MED | LOW (mechanical rename) | RESEARCH re-reads Phase 1's actual committed files before Step B2; PLAN-SUPPLEMENT updates this plan if drift found |
| `erp_fixture` seed lacks the `IsClosed IS NULL` or over-received edge case this plan's tests need | MED | MED (tests can't prove the real-world edge case) | DB Safety Notes §5 permits additive fixture rows; escalate to a Phase-1 PLAN-SUPPLEMENT if seed structure blocks additive rows |
| Shared `dashboard-data-table.tsx` doesn't yet support sort/page/mobile-card exactly as assumed | MED | MED (rework of C1/C2) | Step C5 explicitly re-reads the real component contract before wiring pages; treat any gap as a Phase-1 PLAN-SUPPLEMENT, not a Phase-3 workaround edit to Phase 1's owned file |
| Money-gating regression (a money value leaks to Staff) | LOW (server-strip pattern is well-established in this codebase) | HIGH (SPEC hard constraint / AC9) | D1/D2 explicit strip-and-probe steps; Phase 5's cross-dashboard audit re-verifies independently |
| PO status precedence order is genuinely wrong for a future real status combination not seen in the n=4 pilot data | HIGH (confidence LOW per research) | LOW (cosmetic status label, not a money/safety issue) | Unvalidated caveat badge is mandatory per UI Details; never removed without a fresh confidence re-check |

---

## Rollback

- This phase adds only new files (`dashboards/purchase/**`, `purchase-calc.ts`, `purchase-data.ts`,
  `db/erp-queries/purchase/*.sql`, new test/e2e files) plus append-only edits to two shared files
  (`auth-guard-coverage.test.ts`, `all-context.md`). Rollback = revert this phase's commit(s); no
  other phase or existing surface is touched, so reverting carries zero risk to Phase 1/2/4/5 or to
  the existing order-system.
- No schema change, no migration, no ERP-side write — there is nothing to "undo" on the database
  side in either direction.

---

## Exit Gate

```bash
pnpm test
# Expected: all existing + new purchase-*.test.ts files pass, 0 regressions

pnpm test:e2e -- dashboards-purchase.spec.ts
# Expected: all Purchase e2e gates pass (KPI, status/caveat, money-gate, filter, drilldown, sort/page, mobile)

pnpm lint && pnpm build
# Expected: both clean
```

- All Implementation Checklist items (Steps A-F) checked.
- All Verification Evidence rows green, or an explicitly-accepted known-gap with a backlog stub.
- Phase report written to the Report Destination path.

## Blockers That Would Justify BLOCKED Status

- Phase 1's exit gate has not passed (no `guardedQuery`, no `erp_fixture`, no shared data-table
  component to import).
- `erp_fixture` cannot be reached from the dev/test environment for any reason not resolvable
  within this phase's own scope (route to a Phase-1 PLAN-SUPPLEMENT or backlog note, per
  orchestration.md's BLOCKED escalation path).
- The shared data-table component's real contract is fundamentally incompatible with this phase's
  filter/sort/page/mobile-card needs in a way that requires editing Phase-1-owned files (route as
  a registry change request / Phase-1 PLAN-SUPPLEMENT, do not edit Phase 1's owned files directly).

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner
loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (the umbrella SPEC governs this phase; this plan
does not write its own SPEC).

- [ ] 1. RESEARCH — research-agent: confirm Phase 1's actual `guardedQuery`/cache/degrade/
  data-table export names+signatures; confirm `PurchaseOrderDtl` line-ordering column; confirm
  `erp_fixture` seed coverage for the `IsClosed IS NULL` and over-received edge cases; re-read
  `erp-data-dictionary_REF_18-09-26.md` §B/§D for drift since 18-09-26; check plan drift against
  this file.
- [ ] 2. INNOVATE — innovate-agent: confirm or revise the Charting Decision above; confirm or
  revise the SupplierCode-only display-label decision; write Decision Summary.
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: update this plan with RESEARCH/INNOVATE findings (real
  export names, real ordering column, any fixture gaps), or mark "n/a — research clean" and tick
  this box.
- [x] 4. PVL — vc-validate-agent: full V1-V7 complete 18-09-26; Gate: PASS (2 mechanical
  column-name errors found in Data/SQL Details were fixed in-plan during PVL — see `[PVL fix,
  18-09-26]` notes; 0 unresolved CONCERNs remain). Validate-contract written below.
- [ ] 5. EXECUTE — vc-execute-agent: Steps A-F above, per-section test gates green before moving
  to the next step.
- [ ] 6. EVL — vc-tester: independent re-run of every gate below (Verification Evidence),
  regardless of what EXECUTE reported; follow-up stubs registered for any known gap; EVL HANDOFF
  SUMMARY written.
- [ ] 7. UPDATE PROCESS — phase report written, registry Status Ledger appended, umbrella
  `## Current Execution State` rewritten, commit made.

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate
Contract` below still reads "(placeholder — vc-validate-agent writes this section before
EXECUTE)", the orchestrator must spawn vc-validate-agent first — never spawn vc-execute-agent
against a placeholder contract.

---

## Touchpoints

- `src/app/(main)/dashboards/purchase/page.tsx` (new)
- `src/app/(main)/dashboards/purchase/[poNo]/page.tsx` (new)
- `src/app/(main)/dashboards/purchase/purchase-filters.tsx` (new)
- `src/app/(main)/dashboards/purchase/purchase-chart.tsx` (new)
- `src/lib/purchase-calc.ts` (new)
- `src/lib/purchase-data.ts` (new)
- `db/erp-queries/purchase/total-invoice-basis.sql` (new)
- `db/erp-queries/purchase/total-po-committed-basis.sql` (new)
- `db/erp-queries/purchase/supplier-breakdown.sql` (new)
- `db/erp-queries/purchase/po-list.sql` (new)
- `db/erp-queries/purchase/po-lines.sql` (new)
- `db/erp-queries/purchase/po-received.sql` (new)
- `src/lib/__tests__/purchase-status.test.ts` (new)
- `src/lib/__tests__/purchase-received.test.ts` (new)
- `src/lib/__tests__/purchase-dual-basis.test.ts` (new)
- `e2e/dashboards-purchase.spec.ts` (new)
- `src/lib/__tests__/auth-guard-coverage.test.ts` (append-only edit — this phase's routes)
- `process/context/all-context.md` (append-only edit — this phase's status line)

**Imported-only (Phase 1-owned, never edited by this phase):** `src/lib/erp/erp-adapter.ts`,
`src/lib/erp/cache.ts`, `src/lib/erp/degrade.ts`, `src/components/dashboard-data-table.tsx`,
`src/app/nav-links.tsx`.

---

## Public Contracts

- No existing route, schema, or contract changes — `/dashboards/purchase` and
  `/dashboards/purchase/[poNo]` are brand-new routes with no prior behavior to preserve.
- `requireAuth()`'s existing signature is unchanged; this phase only adds a new inline
  `canSeeMoney = role === "ADMIN"` check within its own page files, matching the umbrella's
  documented contract (no new auth primitive).
- The phone bottom-tab-bar's existing 3-tab contract is unchanged — this phase adds zero tabs.
- `prisma/schema.prisma` is unchanged.
- Phase 1's `guardedQuery`/cache/degrade/data-table contracts are consumed read-only; this phase
  makes no changes to their exported shapes.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm test` — `purchase-status.test.ts` (derivePoStatus, incl. `IsClosed IS NULL` + cancelled-short-circuits-all edge cases) | Fully-Automated | AC6 |
| `pnpm test` — `purchase-received.test.ts` (computeOutstanding, incl. over-received negative case) | Fully-Automated | AC6 |
| `pnpm test` — `purchase-dual-basis.test.ts` (aggregateSupplierBreakdown determinism + tie-break) | Fully-Automated | AC5 |
| `pnpm test:e2e -- dashboards-purchase.spec.ts` — KPI tiles show both bases with correct fixture values | Hybrid (requires `erp_fixture` container running; deterministic once up) | AC5 |
| `pnpm test:e2e -- dashboards-purchase.spec.ts` — PO status badge + unvalidated caveat render for every fixture PO, incl. the `IsClosed IS NULL` fixture row | Hybrid (requires `erp_fixture`) | AC6 |
| `pnpm test:e2e -- dashboards-purchase.spec.ts` — Staff sees page with zero money strings in rendered HTML; Admin sees both totals | Hybrid (requires `erp_fixture`; DOM-string assertion is deterministic) | AC9 (Purchase) |
| `pnpm test:e2e -- dashboards-purchase.spec.ts` — filter searchParam roundtrip (`?supplier=`, `?status=`, `?from=/&to=`) survives reload | Hybrid (requires `erp_fixture`) | AC10 (Purchase) |
| `pnpm test:e2e -- dashboards-purchase.spec.ts` — supplier breakdown row → filtered PO list → PO row → PO detail lines | Hybrid (requires `erp_fixture`) | AC11 (Purchase) |
| `pnpm test:e2e -- dashboards-purchase.spec.ts` — sort + page on PO list retains active filter | Hybrid (requires `erp_fixture`) | AC12 (Purchase) |
| `pnpm test:e2e -- dashboards-purchase.spec.ts` (mobile project, 390×844) — PO list + PO lines render as card list | Hybrid (requires `erp_fixture`) | AC13 (Purchase) |
| Manual agent-probe: visually confirm the unvalidated caveat badge is legible and always co-located with the status chip (never merged/ambiguous) on both `/dashboards/purchase` and `/dashboards/purchase/[poNo]` | Agent-Probe | AC6 (badge visibility/placement, judgment-only) |
| Manual agent-probe: visually confirm the money-gated chart fallback (text list, no bars) renders sensibly for Staff, not a broken/empty chart shell | Agent-Probe | AC9 (Purchase, chart-specific) |
| Known-gap: live reconcile of `total-invoice-basis.sql`/`total-po-committed-basis.sql` against real `db_TCL` and KRS's own `sp_PurchaseInvoiceMonth`/`sp_Popending` procs | Known-Gap — this phase proves correctness against `erp_fixture` only; the manual live-reconcile pass is explicitly Phase 5's scope, backlog stub required if Phase 5 has not yet run when this phase closes | (Phase-5-owned, not this phase's gate) |
| `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | Fully-Automated | harness regression gate |
| `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` | Fully-Automated | harness regression gate |
| `pnpm lint` / `pnpm build` | Fully-Automated | no regression to existing surfaces |

**Known-gap backlog stub required at UPDATE-PROCESS (per vacuous-green ban):** if this phase closes
before Phase 5's manual live-reconcile script exists, write a one-line backlog note in the phase
report under `## SPEC Gaps` pointing at Phase 5's `live-reconcile-script.ts` as the eventual
resolution — never mark AC5/AC6's real-`db_TCL` correctness as PASS on the `erp_fixture`-only Hybrid
gates alone; those gates prove correctness against the fixture, not against the live shared ERP.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-03-purchase-dashboard_PLAN_18-09-26.md`
- Last completed step: Phase Loop Progress Step 4 (PVL) — outer PVL, Gate: PASS (18-09-26)
- Validate-contract status: written 18-09-26 — Gate: PASS (see `## Validate Contract` below)
- Next step for a fresh agent: confirm Phase 1's exit gate has actually passed (do not trust this
  plan's placeholder assumptions about Phase 1's exports — re-verify against Phase 1's real
  committed files), then spawn vc-research-agent for this phase's RESEARCH step (Step 1 in Phase
  Loop Progress above).
- vc-execute-agent may now be spawned once Phase 1's exit gate is confirmed — Phase Loop Progress
  Step 4 (PVL) is checked and `## Validate Contract` below is a real, non-placeholder PASS
  contract.

---

## Test Infra Improvement Notes

(none identified yet)

---

## Validate Contract

Status: PASS
Date: 18-09-26
date: 2026-09-18
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: Single-plan V1-V7 validate pass with 4 Layer-1 dimension checks + per-section Layer-2
feasibility checks run inline by this agent (score 0-1 for this specific PVL task — one plan file,
no live probes needed); the umbrella program itself will fan out P2/P3/P4 outer-PVL as an agent
team once all three phase plans reach this same PVL step (see umbrella `Stable Program Goal`).

Plan updates applied (6 fixes, all mechanical column-name corrections found during Layer-2 Data/SQL
Details feasibility review, cross-checked against `erp-domain-discovery_REF_18-09-26.md`'s verified
"Key columns" lists and drilldown SQL — none required a live-DB probe since the corrected names were
already documented in already-loaded research):
1. `po-lines.sql` — `Qty`/`UnitPrice`/`Amount` did not exist on `PurchaseOrderDtl`; corrected to
   `MainQuantity AS Qty`, `MainUnitPrice AS UnitPrice`, `TotalPrice AS Amount`.
2. `po-lines.sql` — `ORDER BY Slno` was wrong (`Slno` belongs to `tbl_PoAmend`, not
   `PurchaseOrderDtl`); corrected to `ORDER BY Number`, confirmed against the verified drilldown
   query in `erp-domain-discovery_REF_18-09-26.md`.
3. `po-list.sql` — `VoucherDate` does not exist on `PurchaseOrderHdr` (it belongs to
   `PurchaseInvoiceHdr`); corrected to `PODate AS VoucherDate` in the SELECT, and `PODate` in the
   filter/sort clauses.
4. Outstanding-quantity formula text corrected from `PurchaseOrderDtl.Qty` to
   `PurchaseOrderDtl.MainQuantity` (aliased `Qty`).
5. Step B1 checklist item updated to reference the corrected columns and downgrade the RESEARCH
   task from "must confirm before finalizing" (open assumption) to "final spot-check against the
   live `erp_fixture` schema" (confirmatory, since the correct names are now sourced from
   already-loaded research).
6. Risk table row updated to reflect the resolved column-name risk (was MED likelihood/unconfirmed;
   now LOW likelihood/cited).

No other Data/SQL Details query needed correction — `total-invoice-basis.sql` (461,140),
`total-po-committed-basis.sql` (727,920), `supplier-breakdown.sql` (ช-001 635,000 / ว-001 92,920,
which sums to 727,920 — internally consistent), and `po-received.sql` (`InventoryFlowHdr.Approved`/
`TranSactionno` spelling, `InventoryFlowDtl.PoNo` direct join) were all independently cross-checked
against `erp-data-dictionary_REF_18-09-26.md`, `erp-master-data_REF_18-09-26.md`, and
`erp-domain-discovery_REF_18-09-26.md` and match exactly.

Execute-agent instructions:
- E1. Before finalizing `po-lines.sql`/`po-list.sql` (Step B1), do one final spot-check of
  `PurchaseOrderDtl.Number`/`PurchaseOrderHdr.PODate` against the live `erp_fixture` schema once
  Phase 1 provisions it — the PVL fix above is sourced from research-doc transcription, not a
  direct schema query against `erp_fixture` (which does not exist yet). If the real fixture schema
  disagrees, correct in place and note the discrepancy in the phase report; do not silently revert
  to the original wrong names.
- E2. Confirm Phase 1's actual exported names for `guardedQuery`/cache/degrade/data-table (this
  plan's Touchpoints section uses placeholder names) before writing `purchase-data.ts` (Step B2)
  and wiring the pages (Step C1/C2/C5) — this plan's own RESEARCH step (Phase Loop Progress Step 1)
  already requires this; do not skip it because PVL passed.
- E3. `InventoryFlowHdr.Approved` (used in `po-received.sql`) is a distinct column from
  `InventoryFlowHdr.IsApproved` on the same table (both are documented as real, separate columns in
  research) — do not "correct" `Approved` to `IsApproved` at EXECUTE time; the SQL as written
  matches the literal `sp_Popending` stored-procedure source quoted in
  `erp-master-data_REF_18-09-26.md`.
- E4. If Phase 1's seed does not yet contain an `IsClosed IS NULL` or over-received fixture row
  when Step A2/E1 need them, follow DB Safety Notes §5 (additive rows to `db/erp-fixture/purchase-
  seed.sql` only, never editing Phase 1's base file) — do not skip the edge-case tests.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC6-status | `derivePoStatus()` resolves all 7 branches correctly incl. `IsClosed IS NULL` (falls through, not Closed) and cancelled short-circuits every other flag | Fully-Automated | `pnpm test` — `src/lib/__tests__/purchase-status.test.ts` | A |
| AC6-received | `computeOutstanding()` handles an over-received line (negative outstanding, not clamped to 0) | Fully-Automated | `pnpm test` — `src/lib/__tests__/purchase-received.test.ts` | A |
| AC5-supplier | `aggregateSupplierBreakdown()` is deterministic over ≥2 suppliers with tie-break by `SupplierCode` ascending | Fully-Automated | `pnpm test` — `src/lib/__tests__/purchase-dual-basis.test.ts` | A |
| AC5-kpi | Both dual-basis KPI tiles render correct fixture values (461,140 invoice-basis / 727,920 committed-basis) with distinct basis labels | Hybrid (requires `erp_fixture` container running; deterministic once up) | `pnpm test:e2e -- dashboards-purchase.spec.ts` (KPI assertion) | A |
| AC6-badge | PO status badge + unvalidated caveat badge render correctly for every fixture PO incl. the `IsClosed IS NULL` row | Hybrid (requires `erp_fixture`) | `pnpm test:e2e -- dashboards-purchase.spec.ts` (status/caveat assertion) | A |
| AC9-purchase | Staff-rendered HTML contains zero money strings (server-omitted, not hidden); Admin sees both totals | Hybrid (requires `erp_fixture`; DOM-string assertion is deterministic) | `pnpm test:e2e -- dashboards-purchase.spec.ts` (money-gate assertion) | A |
| AC10-purchase | `?supplier=`/`?status=`/`?from=`/`?to=` filter searchParam roundtrip survives reload | Hybrid (requires `erp_fixture`) | `pnpm test:e2e -- dashboards-purchase.spec.ts` (filter roundtrip assertion) | A |
| AC11-purchase | Supplier breakdown row → filtered PO list → PO row → PO detail lines drilldown | Hybrid (requires `erp_fixture`) | `pnpm test:e2e -- dashboards-purchase.spec.ts` (drilldown assertion) | A |
| AC12-purchase | Sort + page on PO list table retains the active filter | Hybrid (requires `erp_fixture`) | `pnpm test:e2e -- dashboards-purchase.spec.ts` (sort/page assertion) | A |
| AC13-purchase | PO list + PO-lines render as card list on phone width | Hybrid (requires `erp_fixture`) | `pnpm test:e2e -- dashboards-purchase.spec.ts --project=mobile` | A |
| AC6-badge-visual | Unvalidated caveat badge is legible and always co-located with (never merged into) the status chip on both pages | Agent-Probe | Manual visual scan of `/dashboards/purchase` and `/dashboards/purchase/[poNo]` | A |
| AC9-chart-fallback | Money-gated chart fallback (supplier + PO-count text list, no bars) renders sensibly for Staff, not a broken/empty shell | Agent-Probe | Manual visual scan under Staff role | A |
| purchase-live-reconcile | `total-invoice-basis.sql`/`total-po-committed-basis.sql` reconcile against real `db_TCL` and KRS's own `sp_PurchaseInvoiceMonth`/`sp_Popending` procs | Known-Gap | — (this phase proves correctness against `erp_fixture` only; Phase 5 owns the live-reconcile script per the umbrella's Phase Ordering) | D |
| harness-parity | Agent/skill parity unaffected by this phase's new files | Fully-Automated | `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` | A |
| harness-context | Context-discovery routing unaffected | Fully-Automated | `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` | A |
| build-lint | No regression to existing surfaces | Fully-Automated | `pnpm lint && pnpm build` | A |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

Legacy line form (retained for existing validate-contract consumers):
- Purchase pure-logic (status/received/supplier): Fully-automated: `pnpm test` (purchase-status.test.ts, purchase-received.test.ts, purchase-dual-basis.test.ts)
- Purchase e2e (KPI/badge/money-gate/filter/drilldown/sort-page/mobile): Hybrid: `pnpm test:e2e -- dashboards-purchase.spec.ts` (+ `--project=mobile` for the mobile-card gate) + precondition: `erp_fixture` container running
- Caveat-badge placement / chart fallback: Agent-probe: manual visual scan of both dashboard pages under both roles
- Live db_TCL reconciliation vs KRS report procs: Known-gap: documented — Phase 5 scope (`erp-dashboards_18-09-26` umbrella, Phase Ordering table)
- Harness regression: Fully-automated: `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` && `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs`

Failing stub: (Fully-Automated rows only — TDD red-first starting point for Step A2)
```
test("should not short-circuit a null IsClosed to Closed (NULL means open, falls through to next check)", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: derivePoStatus with isClosed=null falls through, does not return 'Closed'")
})
test("should return 'Cancelled' when isCancel=true regardless of every other flag being true", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: derivePoStatus cancelled-short-circuits-all")
})
test("should return a negative outstanding value for an over-received PO line, not clamp to 0", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: computeOutstanding over-received negative case")
})
test("should sort supplier breakdown rows deterministically with SupplierCode-ascending tie-break", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: aggregateSupplierBreakdown determinism + tie-break")
})
```

Dimension findings:
- Infra fit: PASS — new routes/files only, no port/container/proxy surface touched; ERP reads route
  exclusively through Phase-1-owned `guardedQuery` (imported, never re-implemented); contingent on
  Phase 1's exit gate, which is an already-documented, correctly-gated dependency (Entry Gate +
  Blockers section), not an unmanaged risk.
- Test coverage: PASS — all 4 waterfall tiers assigned; the money-visibility high-risk class (AC9)
  meets the required Hybrid-minimum via an explicit DOM-string-absence e2e gate, not a known-gap.
- Breaking changes: PASS — `/dashboards/purchase` and `/dashboards/purchase/[poNo]` are brand-new
  routes; `requireAuth()`, the bottom-tab-bar 3-tab contract, and `prisma/schema.prisma` are
  unchanged per Public Contracts.
- Security surface: PASS — every query is a bare `SELECT` routed through `guardedQuery`'s
  `assertReadOnlySql` choke point (Phase-1-owned); filters use bound parameters (`@supplierCode`,
  `@fromDate`, etc.), not string concatenation; money gating is an explicit server-side omission
  (D1/D2), never a client-side hide, matching AC9's hard constraint.
- Data/SQL Details feasibility: PASS (after 6 in-plan fixes) — mechanical column-name errors found
  and corrected (see Plan updates applied); all other queries independently cross-checked against 3
  REF docs and match exactly, including the resolved `InventoryFlowDtl.PoNo` direct-join vs.
  3-hop-chain discrepancy between `erp-domain-discovery_REF_18-09-26.md` (earlier, tentative finding)
  and `erp-master-data_REF_18-09-26.md` (later finding, sourced from reading the actual
  `sp_Popending` stored-procedure definition, which explicitly states it "corrects/extends" the
  earlier finding) — the plan correctly cites and uses the newer, more-authoritative source.
- Pages/Components feasibility: PASS — every "existing pattern to mirror" citation
  (`shop-location-filter.tsx`, `be-date.ts`, `new-sheet-form.tsx`, `summary.ts`'s `topShops`,
  `auth-guard-coverage.test.ts`'s `PRINT_PAGES` pattern, `chip.tsx`, `users-mobile.tsx`) was verified
  to exist on disk with the claimed shape; highest-risk edit is Step C5 (shared data-table contract
  not yet built by Phase 1) — already mitigated by an explicit RESEARCH re-read + PLAN-SUPPLEMENT
  fallback rather than a Phase-3 workaround edit to Phase-1-owned files.
- Money Gating feasibility: PASS — D1/D2's explicit server-omission-plus-probe pattern matches the
  codebase's only existing money-gating precedent (this program's own AC9 contract); no gaps found.
- Tests/e2e feasibility: PASS — `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm build` all confirmed
  as real `package.json` scripts; the `mobile` Playwright project (390×844) confirmed to exist in
  `playwright.config.ts`.

Open gaps: none. (The Phase-5 live-db-reconciliation row is a pre-declared Known-Gap tier in the
Test gates table above, not an unresolved CONCERN — it is explicitly out of this phase's scope per
the umbrella's Phase Ordering table, and the plan already requires a backlog stub for it at
UPDATE-PROCESS if Phase 5 has not yet run when this phase closes.)

What this coverage does NOT prove:
- The 3 Fully-Automated Vitest gates prove pure-function correctness against hand-picked fixture
  values; they do NOT prove the SQL queries themselves execute correctly against a real SQL Server
  connection (that requires Phase 1's `erp_fixture` to exist — proven instead by the Hybrid gates).
- The Hybrid e2e gates prove behavior against the `erp_fixture` fixture dataset only; they do NOT
  prove correctness against the live, shared `db_TCL` database (explicitly out of scope for this
  phase — see the Known-Gap row and Phase 5's Verification Evidence in the umbrella plan).
- The Agent-Probe rows prove visual/placement judgment at a single point in time under whatever
  fixture data exists then; they do NOT constitute a regression gate — a future visual change could
  silently break badge placement without failing any automated gate.
- None of these gates prove the PO-status precedence order is correct for a real-world status
  combination outside the 2 combinations seen in the n=4 pilot data — this is the documented reason
  the "unvalidated" caveat badge is mandatory and non-removable without a fresh confidence check.
- None of these gates prove Phase 1's `guardedQuery`/cache/degrade contract actually behaves as this
  plan assumes — that is proven by Phase 1's own exit gate, not re-verified here.

Gate: PASS (no FAILs, no unresolved CONCERNs; 2 mechanical CONCERNs found in Data/SQL Details were
fixed in-plan during this PVL pass — see Plan updates applied)
Accepted by: N/A — Gate: PASS, no concerns required acceptance
