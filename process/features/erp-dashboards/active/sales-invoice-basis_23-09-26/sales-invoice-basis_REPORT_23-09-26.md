---
phase: sales-invoice-basis
date: 2026-09-23
status: COMPLETE_WITH_GAPS
feature: erp-dashboards
plan: process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md
---

# EXECUTE report — sales-invoice-basis

**TL;DR** — All 16 checklist steps (P1, P2, S1–S13) implemented and verified. The Sales dashboard's
headline money now comes from sales invoices (fixture: ฿858,937.21 / 3 ใบ) with the delivery view
kept below as "การส่งมอบ". Unit **757 → 855** passed (+98, 39 → 41 files), e2e **145 → 158** passed
(+13, 7 skipped both before and after) — zero regressions. Lint, `tsc --noEmit` and `pnpm build`
clean. Three named deviations (all forced by real schema/code facts), one accepted CONCERN resolved
via a single shared resolver, one runtime gap that cannot be proven with the current force-down
toggle.

## What Was Done

| Step | Outcome | Verification actually run |
|---|---|---|
| P1 | `IsCancel = 0` divergence from `sp_Purchase` documented in `total-po-committed-basis.sql` + `supplier-breakdown.sql`, mirrored into `purchase-sql.ts` | `git diff` proves comment-only (0 non-comment added lines, 0 removed); `purchase-dual-basis.test.ts` + `erp-query-schema-conformance.test.ts` green |
| P2 | `po-received.sql` stricter-filter divergence documented, mirrored | same gate, green |
| S1 | `dbo.SalesInvoiceDtl` (58 cols) added to the live manifest AND a matching `CREATE TABLE` block to `00-schema.sql`, one atomic change; `db/erp-schema/README.md` table list + provenance note updated | `erp-fixture-schema-conformance.test.ts` 17 → 18 tests green; `erp-query-schema-conformance.test.ts` green |
| S2 | `SalesBasis` union gains `"invoice"`; `resolveSalesBasisFromValue` gains a real branch; `"so"` and unknown values still fall back to `"do"`; stale doc-comments on `sales-basis-core.ts` + `sales-basis.ts` rewritten | +2 tests in the EXISTING `describe("resolveSalesBasisFromValue …")` block (no new file, per contract); `tsc --noEmit` clean. Repo-wide `grep "SalesBasis"` re-confirmed only 2 call sites, no exhaustive switch |
| S2b | `sales-seed.sql` extended with 9 synthetic `SalesInvoiceDtl` rows: 2 invoices tie line-sum to header exactly, 1 line carries `Amount = NULL`, 3 customers / 3 categories / 4 units, `RowOrder` derived from `MAX()` (order-independent), guard on the `(TransactionNo, ItemOrder)` business key | `erp-fixture-seed-idempotency.test.ts` green in BOTH seed orders, twice each; seed applied to the live `erp_fixture` container (9 rows) |
| S3 | 5 new SQL files written: `invoice-headers`, `invoice-lines`, `invoice-by-product`, `invoice-by-customer`, `invoice-date-range`. Canonical-item CTE copied verbatim from `do-by-product.sql`. `COALESCE(Amount, 0)` everywhere; NULL lines counted, never dropped. `ERP_QUERY_COLUMNS` entry added per file in the same edit | `erp-query-schema-conformance.test.ts` 128 → 164 tests green (both directions: no invented column, no undeclared read, no filler) |
| S4 | `sales-invoice-excluded-total.sql` KEPT; header comment fully rewritten (whole-pool, not excluded); `live-reconcile-script.ts` labels rewritten | mirror re-synced byte-identically; drift test green; `tsc --noEmit` clean |
| S5 | Read-through confirmed no new DO query is needed — the delivery section reuses `fetchDo*` unchanged | read-through + the delivery section rendering its original 14 ใบ / 35 รายการ / ฿10,111.00 figures on the live page |
| S6 | All 6 touched/new `.sql` files mirrored into `sales-sql.ts`/`purchase-sql.ts` and the 5 new constants registered in `SALES_SQL_SOURCES` | `sales-basis-reconciliation.test.ts` byte-identity sweep 43 → 59 tests green |
| S7 | 5 fetch wrappers added on the EXISTING `runSalesQuery`/`getCached` path; new `toInvoiceParams` binds only the params the invoice SQL references | new `sales-invoice-basis.test.ts` (13 tests): success, degrade-serves-stale, cold-cache re-throw, exact param set, distinct cache keys, plus 8 Hybrid gates against `erp_fixture` |
| S8 | `page.tsx` restructured into two sections with **independent per-section try/catch**; `sales-unavailable-fragment.tsx` extracted; `sales-unavailable.tsx` kept unchanged as the both-down fallback | `tsc`/lint/build clean; live render probe at 1440×2000 for ADMIN **and** STAFF: 1 dashboard root, 1 invoice section, 1 delivery section, **0 console errors**; screenshots inspected (bars render at full height, not stubs) |
| S9 | Status donut relocated into the delivery section | probe: `donuts=1` for both roles; e2e gate asserts 1 in the delivery section, 0 in the invoice section, both roles |
| S10 | Invoice drilldown as `?invoiceNo=` on the same page (no nested route), mirroring `doNo` | unit tests on `resolveSalesView`/`parseSalesUrl`; e2e clicks through list → drilldown |
| S11 | `ExportTable` widened additively; `deriveExportTarget` rewritten; `parseExportTarget` allow-list widened; `sales:invoice-list`/`sales:invoice-lines` cases added; **explicit `production:lines` case + rejecting `default:`** (`UnknownExportTargetError` → HTTP 400) | money-audit 98 → 123 tests: role-diffed byte comparison now covers all 4 sales shapes; dispatch test proves invoice exports never serve production rows; unrecognised pair returns 400, not production data; e2e export gate |
| S12 | Full regression | see counts below |
| S13 | All 6 copy locations rewritten; `reconciliationNote()` replaced by `deliveryCoverageNote()` and retired from the KPI render path | automated sweep: 0 banned-framing occurrences in any of the 6 files; new unit assertions ban the old strings; e2e asserts the footnote no longer says `SalesInvoiceHdr`/`ไม่ถูกนับรวม` |

## Test Gate Outcomes

Commands run (ERP env inline, pointed at the LOCAL `erp_fixture` only — `db_TCL` never contacted):

```
pnpm test                                   # 855 passed | 1 todo | 41 files   (was 757 | 1 | 39)
npx tsc --noEmit                            # clean
pnpm lint                                   # clean
pnpm build                                  # Compiled successfully
pnpm exec playwright test                   # 158 passed | 7 skipped           (was 145 | 7)
```

Net: **+98 unit tests, +2 unit files, +13 e2e tests, 0 regressions.** The 7 e2e skips are the same
7 that were skipped at baseline.

New/changed test files: `sales-invoice-basis.test.ts` (new, 13), `sales-two-section-url.test.tsx`
(new, 13), `dashboards-money-audit.test.ts` (+25), `sales-basis-reconciliation.test.ts` (+16),
`erp-query-schema-conformance.test.ts` (+36), `erp-fixture-schema-conformance.test.ts` (+1),
`sales-money-coverage-footnote.test.ts` (rewritten for the new copy), `e2e/dashboards-sales.spec.ts`
(+7 gates, 1 assertion updated).

## Plan Deviations

Three, all forced by facts on disk rather than preference:

1. **`InvDate`/`InvoiceNo` do not exist on `dbo.SalesInvoiceHdr`.** The plan's Touchpoints specify
   `MIN(InvDate)/MAX(InvDate)` for `invoice-date-range.sql`. The manifest's real 151-column list has
   **`VoucherDate`** and **`VoucherNo`** (the fixture seed already says so in its own header comment).
   Used the real names, aliased to `InvDate`/`InvoiceNo` in the SELECT list only. Writing the plan's
   names verbatim would have reproduced the exact `tbl_DOhdr.IsCancel` defect this plan warns about.
2. **Manifest types for `SalesInvoiceDtl` are inferred, not live-captured.** The plan records the 58
   column NAMES from a verified `sys.columns` read but no types/nullability, and `db_TCL` may not be
   contacted. Types were inferred from same-named columns on sibling live tables already in the
   manifest (32 of 58 had a direct sibling; 26 follow that family's conventions). Because this file
   is documented as live truth, a top-level `partialCaptureNotes` key in the manifest and a new
   README section state explicitly that this ONE table's names/order are live-verified while its
   types are best-effort. The column-NAME guarantee the gate exists to provide is intact. **Re-capture
   the types on the next live probe and delete the note.**
3. **Delivery breakdown page keys were NOT renamed** to `deliveryProductPage`/`deliveryCustomerPage`.
   They keep `productPage`/`customerPage`; the invoice section gets the new
   `invoiceProductPage`/`invoiceCustomerPage`. The plan's requirement (the two simultaneously-rendered
   tables must never share a key) is fully met; renaming the existing pair would break live bookmarks
   and the shipped e2e pagination gate to say the same thing. `page`/`sort` are deliberately NOT split
   — they belong to the document-LIST views, which a single `view` string makes mutually exclusive.

Two smaller, in-blast-radius decisions worth naming:

- **`DocuType = 'SI'` rather than `sp_SalesInvoice`'s `IsClosed = 0`.** Both are no-ops on today's
  data. `DocuType` is NOT NULL live (so it cannot silently drop a future NULL row) and it is the same
  filter the kept `sales-invoice-excluded-total.sql` uses — which is what makes that query the exact
  unfiltered variant of `invoice-headers.sql`, as Step S4's KEEP decision requires. Documented as a
  deliberate divergence in the SQL header, same style as P1/P2.
- **ช่วงข้อมูล banner scoping.** The page-level `PilotBanner` keeps reporting the DELIVERY range
  exactly as before (AC16's e2e text is unchanged); the invoice basis gets its own range line inside
  the invoice section heading (`data-testid="invoice-data-range"`). `PilotBanner` is shared by all
  three dashboards and every spec selects a single `pilot-banner` per page, so rendering two would
  churn unrelated specs. Neither range is hidden and neither is mislabelled.

## Judgment Calls the Plan Required Me to Record

- **S11 accepted CONCERN — resolver mechanism: shared resolver, as instructed.** `sales-url.ts` now
  exports `resolveSalesView` / `sectionOfView` / `resolveSalesSection`, and
  `dashboard-export-target.ts` **imports `resolveSalesSection`** rather than hand-duplicating the
  precedence rules. The import chain stays free of React/Next/DB (`sales-url.ts` → `sales-basis-core.ts`
  → `be-date.ts`, all pure), so the module remains as trivially unit-testable as before. Both named
  view-only scenarios are covered: `view=invoice-documents` with no `invoiceNo` → `"invoice-list"`;
  `view=delivery-documents` with no `doNo` → unchanged `"list"` (in `dashboards-money-audit.test.ts`,
  plus section-level equivalents in `sales-two-section-url.test.tsx`).
- **S8 bullet 4 — breakdown table: REUSED, not forked.** `BreakdownCard<T>` in
  `sales-breakdown-tables.tsx` was already generic over the row type, so it was simply exported and
  the invoice breakdowns are built on it with no adapter. `SalesBreakdownTables` stays the
  delivery-specific composition; `InvoiceBreakdownTables` is the invoice one. No second
  pagination/mobile-card/link-contract implementation exists.
- **Final `view` enum member names:** `"summary" | "invoice-documents" | "invoice-lines" |
  "delivery-documents" | "delivery-lines"` — the plan's 5-value shape verbatim, matching the file's
  existing lowercase-hyphen style. Pre-plan `"documents"`/`"lines"` are kept as **explicit delivery
  aliases** (a bare legacy `?view=documents` has always meant "show me the delivery orders"); only a
  genuinely unrecognised value falls back to `"summary"`. Both behaviours are unit-tested.

## Test Infra Gaps Found

- **Per-section degrade case (b) is not runtime-provable.** `/api/test/erp-force-down` downs the whole
  ERP pool, so it can only produce case (a) "both sections down" — it cannot simulate one section
  failing while the other serves data. Case (b) is structurally implemented (two separate try/catch
  blocks, verified by reading the built page) and proven at the DOM level by
  `sales-two-section-url.test.tsx` (the scoped fragment renders zero `sales-dashboard` roots; two
  fragments side by side still render zero). A true runtime proof would need a per-query force-down
  toggle — out of this plan's scope, worth a backlog note.
- The pre-existing skipped e2e gate `ERP-unreachable resilience › with the ERP unreachable it shows
  the Thai unavailable notice and no figures` was skipped at baseline and remains skipped; this plan
  neither fixed nor worsened it.

## Closeout Packet

- **Selected plan:** `process/features/erp-dashboards/active/sales-invoice-basis_23-09-26/sales-invoice-basis_PLAN_23-09-26.md`
- **Finished:** all 16 checklist steps; every Fully-Automated and Hybrid gate in the C3 table run and green.
- **Verified vs unverified:** Fully-Automated + Hybrid = verified (the ERP env materialized fine in
  this session, so no gate had to be deferred). Agent-Probe rows (S4 comment read, S5 read-through,
  S9 donut placement, S13 Thai copy review) were performed and are recorded above — S9 additionally has
  an automated e2e gate. **Still unverified: a human's live-UX sign-off** on the new two-section layout
  and the new Thai copy, and behaviour against real `db_TCL` data (fixture-only by charter).
- **Remaining cleanup:** re-capture `SalesInvoiceDtl`'s column types on the next live probe (deviation 2);
  consider a per-query force-down toggle for the degrade gap above.
- **Nothing committed** — per instruction, the orchestrator handles commits after independent verification.
- **Best next state:** `Keep in active/testing` — code-complete and gate-green, pending the user's
  live-UX sign-off on the new layout/copy before archival.

## Forward Preview

### Test Infra Found
`erp-fixture-schema-conformance.test.ts` reads only `{name, type, nullable}` from the manifest and
ignores extra top-level keys — which is what made the honest `partialCaptureNotes` marker possible
without weakening the gate. The ERP TTL cache is module-level and **survives `vi.resetModules()`**,
so mocked-ERP tests must use distinct cache keys (distinct date ranges) rather than expecting module
reset to clear it; and a degrade test must step `Date.now()` past the 5-minute TTL or the fresh entry
short-circuits and the outage is never exercised. Both traps cost a red cycle here.

### Blast Radius Changes
Added beyond the plan's list: `src/app/(main)/dashboards/sales/invoice-list-table.tsx`,
`invoice-lines-table.tsx`, `invoice-kpi-tiles.tsx`, `invoice-breakdown-tables.tsx` (new components —
the plan named the section split but not the files), `db/erp-schema/README.md` (table list +
provenance), and `src/app/api/dashboards/export/route.ts` (the 400 path for the new rejecting
`default:`). `BreakdownCard` in `sales-breakdown-tables.tsx` changed from private to exported.

### Commands to Stay Green
```
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox sa>;encrypt=true;trustServerCertificate=true"
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1
export ERP_TEST_FORCE_DOWN=1          # e2e only
pnpm test && pnpm lint && pnpm build && pnpm exec playwright test
```
After changing `db/erp-fixture/00-schema.sql` or `sales-seed.sql`, re-apply both to the running
`orderstock-sql` container before the Hybrid gates will reflect the change.

### Dependency Changes
None. No package added, no schema migration, no Prisma model touched, no ERP write of any kind.
