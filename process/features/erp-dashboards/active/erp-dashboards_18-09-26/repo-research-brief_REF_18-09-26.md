# Dashboard Feasibility Research Brief — orderstock repo

- Date: 18-09-26
- Source: scratchpad/repo-brief.md (research session output)
- Purpose: orderstock-repo-side feasibility research for Purchase/Sales/Production dashboards (data model, ERP integration options, UI/dataviz infra, platform constraints, risks, open questions).

> **SUPERSEDED NOTE:** Sections 2 and 4 (ERP) were written before the ERP discovery and are SUPERSEDED by `erp-data-dictionary_REF_18-09-26.md` / `erp-master-data_REF_18-09-26.md`. Where this brief's ERP-table-name guesses or unverified claims conflict with the data dictionary or master-data REF, those two REF docs win.

---

# Dashboard Feasibility Research Brief — orderstock (Purchase / Sales / Production)

*Synthesized from parallel research, critic pass, gap-research follow-ups, and adversarial verification. Adversarially refuted claims are corrected below; unresolved claims are flagged uncertain rather than stated as fact.*

## 1. Bottom Line

- **Sales Dashboard is the only one of the three partially buildable from orderstock's own data today — and only as a PIECE-COUNT total, never baht.** No price/amount field exists anywhere in `prisma/schema.prisma` (verified by full-file read); the `สรุปยอดผลิต→สรุปยอดขาย` rename (commit `bd11700`) was label-only, not a data upgrade — treating order-sheet quantities as "sales" is a conflation risk, not a fact.
- **Purchase and Production dashboards have zero backing data model anywhere confirmed** — no Supplier/PO model in orderstock, no production-plan/target concept in orderstock, and the ERP table names presumed to hold this data in `db_TCL` trace to a **single unverified prose claim** in `process/context/database/all-database.md` with no raw query evidence attached anywhere in the repo (adversarial verdict: **uncertain**).
- **The "safe ERP read via Prisma" plan has a real gap**: Prisma's externally-managed-tables feature (`tables.external`, confirmed present in the pinned 7.8.0) excludes tables from Migrate, but **`prisma db pull` still introspects the entire connected database** — on `db_TCL` ("hundreds of unrelated tables") this is a materially heavier, riskier operation than declaring `external` implies. A scoped least-privilege login is the only documented mitigation, and creating one is itself a DBA-gated change to `db_TCL`.
- **Local sandbox has zero ERP tables** (directly verified: exactly 10 tables = orderstock's 9 models + `_prisma_migrations`; no second database). This **contradicts** existing docs (`all-database.md`, `all-tests.md`) claiming the sandbox is an "ERP-shaped clone" containing `krs_log` — that claim is false as of this session and there is currently **no automated test path** for any ERP-reading dashboard code.
- **Production deploy is confirmed ~12 commits behind local `main`** (last confirmed deploy `fe2df61`, 11-07-26; local main now includes 4 location features + the sales rename through `bd11700`, 26-07-26), and the `Shop.location` delivery ALTER (`db/alter-shop-add-location.sql`) is still recorded everywhere as **not run** against `db_TCL` — any location-sliced dashboard metric must be scoped against this reality, not assumed baseline.

## 2. Requirement → Data-Source Matrix

| Requirement | orderstock data? | Likely ERP table(s) in `db_TCL` | Unit | Confidence |
|---|---|---|---|---|
| **Purchase — ยอดซื้อรวม** | No | `PurchaseOrderHdr/Dtl` (name **unverified**) | baht | Low (table existence unconfirmed) |
| **Purchase — ยอดซื้อตามช่วงเวลา** | No | same, unverified | baht/time | Low |
| **Purchase — ยอดซื้อราย Supplier** | No | `Supplier` + `PurchaseOrderHdr/Dtl` (unverified) | baht | Low |
| **Purchase — PO Status** | No | unverified status field on `PurchaseOrderHdr` | status code | Low |
| **Purchase — Filter/Drill-down** | UI pattern exists (`?param=` filter, one static drill-down link); data does not | n/a | n/a | Medium (UI only) |
| **Sales — Status SO** | No (only `OrderSheet.active` boolean soft-delete + a UI-derived date heuristic, not a persisted state machine) | `SalesInvoiceHdr/Dtl` — **no distinct SO table confirmed anywhere** | status code | Low |
| **Sales — ยอดขายรวม** | **Yes, as piece-count only** — `computeGrandTotal(OrderLine.qty)` | `SalesInvoiceHdr/Dtl` (for a true baht figure) | qty (orderstock) / baht (ERP) | High for qty path; Low for baht path |
| **Sales — รายเดือน/ปี** | **Yes** — `OrderSheet.date` groupBy, precedented in `/history` | same | qty | High |
| **Sales — Product/Category** | **Yes, coarse** — `Product.group` = 2 buckets (GOODS/SEASONING) + 28 variant names | — | qty | Medium (shallow taxonomy) |
| **Sales — Customer** | **Yes, via Shop proxy** — `topShops()`/`computeShopTotals()` already exist | `Customer` (unverified) | qty | Medium-High |
| **Sales — Filter/Drill-down** | Partial — `?location=` filter shipped (`shops.spec`), one static link `/history→/orders/[id]` | — | n/a | Medium |
| **Production — planned vs. actual** | **No** — no planned-quantity concept anywhere in orderstock | `tblBom*` (suggests BOM, not plan-vs-actual; unverified) | qty | Low — likely needs new data model regardless of source |
| **Production — Filter/Drill-down** | UI pattern exists; data does not | n/a | n/a | Medium (UI only) |

## 3. What orderstock Data Can Deliver NOW (No ERP)

All measured in **piece count (Int qty)**, never currency:

- Per-sheet column totals + grand total: `src/lib/totals.ts` (`computeColumnTotals`/`computeGrandTotal`, deliberately excludes `NoteLine` by type).
- Monthly/yearly unit rollups via `OrderSheet.date` groupBy — pattern already live in `/history` (`orderLine.groupBy` + `noteLine.groupBy`, no N+1).
- Top-N shops-as-customers: `src/lib/summary.ts` (`computeShopTotals`/`topShops`), already rendered on `/summary`.
- 2-bucket product/category split (`Product.group`: GOODS/SEASONING) + per-variant breakdown (28 variants currently seeded).
- Location-scoped slicing via the shipped `?location=` searchParam pattern (`shop-location-filter.tsx`).

**Not available at all, from orderstock, under any query design:** baht/currency figures, PO/SO/production status, supplier data, planned-production quantity, weight/ปี๊บ totals (confirmed never persisted — `order-payload.ts` explicitly excludes them; backlog note `weight-peep-persistence_NOTE_07-07-26.md`). Sandbox data volume observed (7 sheets, 9-day span, 1 location) is a **sandbox artifact**, not evidence of production `db_TCL` scale — not verified this pass.

## 4. ERP Integration

**Known, confirmed:**
- App connects to `db_TCL` as `sa` (full sysadmin) — pre-existing flagged risk, no scoped login exists.
- `db_TCL`: SQL Server 2019 Enterprise, `COMPATIBILITY_LEVEL 130`, must never change (guardrail is about server-wide query-plan impact on the customer's whole live ERP — **not** because it blocks modern T-SQL). Correction to a prior overclaim: `STRING_AGG` works at any compat level (engine-version-gated only, 2017+); `FORMAT()` needs ≥110; `STRING_SPLIT` needs ≥130 — `db_TCL` meets that exactly. **No function-availability blocker from the compat pin itself.**
- Prisma 7.8.0 ships "externally managed tables" (`tables.external` in `prisma.config.ts`) — confirmed real, excludes declared tables from Migrate. But it is **Preview status**, provides **no schema-drift verification**, and — critically — **`prisma db pull` always introspects the full connected schema regardless of the `external` list** (confirmed via Prisma docs + community threads; no scoping flag exists). The only documented workaround is a dedicated least-privilege login granted SELECT on just the target tables, then `db pull` as that login.
- Local sandbox verified (direct `INFORMATION_SCHEMA.TABLES` query) to hold **only** orderstock's 9 tables + `_prisma_migrations` — no `krs_log`, no second database. Existing docs claiming an "ERP-shaped clone" are stale/incorrect.

**Unknown (discovery checklist before any Purchase/Production design):**
- Real table/column shapes for `Customer`, `Supplier`, `SalesInvoiceHdr/Dtl`, `PurchaseOrderHdr/Dtl`, `InventoryItem`, `AccountChart`, `GeneralJournal`, `tblBom*`, `Warehouse` — **unverified**, single unattributed source.
- Whether a distinct SalesOrder (SO) table exists separate from `SalesInvoiceHdr/Dtl` — unconfirmed; matters directly for "Status SO."
- Any production-plan/target table anywhere — no positive evidence found in ERP-name list or repo.
- RCSI (`READ_COMMITTED_SNAPSHOT`) status on `db_TCL` — unknown; determines whether dashboard reads risk blocking live ERP writers under default locking.
- ERP table row counts/scale — unknown; needed for query-performance judgment.
- Fix status of Prisma issue `orm#28963` (`Prisma.sql` composition inside `$queryRaw` serializes as JSON instead of composing) at the pinned 7.8.0 — **unresolved by this research pass**; verify locally before depending on composed raw SQL for filters/drill-down.
- Whether `db/alter-shop-add-location.sql` has actually run against `db_TCL` out-of-band — every repo artifact still says pending.
- Whether local `main` (through `bd11700`) is actually deployed — last confirmed deploy is `fe2df61` (11-07-26); no artifact confirms later.

**Safe read-only access options (ranked by risk):**

| Option | Pros | Cons |
|---|---|---|
| Scoped least-privilege login (`GRANT SELECT` on target tables only) + `db pull` as that login | Limits both introspection AND runtime blast radius; only documented way to scope `db pull` | Requires DBA-gated change to `db_TCL`; still Preview-feature risk |
| `tables.external` + unscoped `db pull` | Native typed Prisma queries once declared | Introspects hundreds of unrelated ERP tables in one pass — high blast radius, no drift check |
| `$queryRaw`/raw `mssql` queries (no schema.prisma model) | Zero Migrate risk, no introspection; precedented escape hatch (`mssql@^12.2.0` already a direct dep) | Loses type safety; composed-SQL bug status unresolved at 7.8.0 |
| Separate `mssql` ConnectionPool for reporting | Isolates dashboard read load from the single interactive Prisma pool | New infra pattern, unprecedented in this codebase |
| DBA-created SQL VIEWs exposing only needed columns | Cleanest separation; Prisma introspects only the view | Creating a view is itself DDL against `db_TCL` — same manual-DBA-only gate as every other schema change |

**Hard dangers (unchanged/absolute):** never `migrate reset/dev/db push --force-reset` against `db_TCL`; never alter `COMPATIBILITY_LEVEL`; treat unscoped `db pull` as a novel, heavy operation requiring explicit sign-off, not routine; the existing `sa` connection should be hardened to least-privilege **before**, not after, any new ERP read surface ships.

## 5. UI/Dataviz Infrastructure

- **No chart library installed** (verified against `package.json`: only `lucide-react` for icons). Only existing "chart" is a hand-rolled CSS/div bar on `/summary`, driven by `computeColumnTotals`, colored by `Product.group`.
- Reusable pure-aggregation pattern: `src/lib/totals.ts`, `src/lib/summary.ts` — pure, DB-independent, unit-tested; template for any new metric helper.
- Reusable page pattern: `force-dynamic` + `requireAuth()` + Next 16 `Promise`-typed `searchParams` + single-groupBy-no-N+1 (established in `/history`).
- pguard tokens/primitives (`src/components/ui/{chip,card,status-dot,...}`) are dashboard-chrome-ready — `chip.tsx` tone variants map naturally to PO/SO status chips. No chart-specific color tokens exist beyond the 2 series colors in use today.
- Filter/drill-down precedent is thin: one `?location=` searchParam filter, one static link (`/history` row → `/orders/[id]`). **No date-range picker exists anywhere** (only a single native date input + BE display via `be-date.ts`). No in-chart click-to-filter.
- Chart-library decision is an open INNOVATE-stage choice, not resolved by existing code: Recharts is the most-cited React-19-workable 2026 option but needs a `react-is` peer override to install cleanly; visx has an open unresolved React-19 peer-dep issue (`airbnb/visx#1883`). Both need a `'use client'` boundary (no App Router server-component chart exists in any surveyed library). **Thai font inheritance (IBM Plex Sans Thai via `next/font`) into a chart library's own SVG `<text>` is unverified** — no prior art in this codebase, real risk for non-Latin axis/legend labels.
- `bottom-tab-bar.tsx` currently hardcodes exactly 3 mobile tabs — adding a Dashboard area needs nav rework there and in `nav-links.tsx`'s 3 fixed groups.

## 6. Platform Constraints

- `requireAuth(role?)` is the real security boundary (re-reads active+role from DB every call). Its coverage test is a **hand-maintained static array** — new dashboard routes/actions must be manually added, not auto-discovered.
- Only ADMIN/STAFF roles exist; STAFF sees most master data today. Whether STAFF should see purchase/sales **money** figures is an open policy question with no existing "view-money-can't-edit" precedent.
- Route protection lives in `src/proxy.ts` (Next 16 renamed `middleware.ts`, which is silently ignored) — new `(main)/` routes are covered automatically by the default matcher.
- **No caching layer anywhere** (`unstable_cache`/`revalidate`/`'use cache'` unused) — every dynamic page is a live, uncached read per request; ERP-touching dashboard queries inherit this unless deliberately cached.
- **No CI pipeline** — all gates (`pnpm test/build/lint`, Playwright) run manually per phase.
- Sandbox has **no ERP tables** (confirmed) — no automated test path for ERP-reading code without hand-built fixtures or a mock layer, neither of which exists.
- Deploy mechanics need no Dockerfile change for a new page (`.next/standalone` copied wholesale), but the **deploy itself is manual and confirmed ~12 commits behind** local main — must reconcile before shipping dashboard code that assumes recent features (e.g. location filtering) are live in production.

## 7. Recommended Domain Metric Definitions

**Sales (only dashboard partially definable today):**
- *ยอดขายรวม (orderstock-native)*: `SUM(OrderLine.qty)` in scope — explicitly a **piece-count**, not currency; reuse `computeGrandTotal`.
- *รายเดือน/ปี*: `SUM(qty)` grouped by `OrderSheet.date` truncated to month/year — reuse `/history`'s groupBy pattern.
- *Product/Category*: `SUM(qty)` grouped by `Product.group` (2 buckets) and/or `ProductVariant.name`.
- *Customer*: `SUM(qty)` grouped by `Shop` — reuse `topShops()`/`computeShopTotals()`.
- *Status SO*: **not definable** from orderstock today; nearest proxies (`OrderSheet.active`, or `/history`'s UI-only "กำลังกรอก"/"ปิดยอดแล้ว" heuristic) are not a real workflow state — needs explicit customer decision before either is called "SO Status."

**Purchase:** no orderstock-native definition possible for any of the 4 requested metrics — defer until ERP table/column existence is confirmed.

**Production:** no orderstock-native definition possible — "planned" quantity has no confirmed source anywhere (orderstock or the named ERP tables) — defer entirely until a source is identified.

## 8. Risks (Ranked) and Open Questions

**Risks, most plan-changing first:**
1. Whether Sales/Purchase totals must be baht (new pricing/costing schema layer) vs. piece-count (buildable now) — determines 1-phase reporting vs. multi-phase schema buildout.
2. Whether Purchase/Production read `db_TCL`'s real ERP tables (schema **unverified**) vs. require wholly new orderstock-native schema — both paths are effectively greenfield with very different risk profiles.
3. Existing `sa` full-sysadmin connection extended to more ERP reads without a scoped login — should be hardened before, not after, shipping.
4. Conflating order-sheet quantities with "sales" (cosmetic rename only) risks a misleading dashboard number if presented as authoritative.
5. Production confirmed ~12 commits behind local main — dashboard design must not assume unverified feature baseline is live.
6. Zero automated test path for ERP-reading code (sandbox has no ERP tables, contradicting stale docs).
7. Weight/ปี๊บ metrics are permanently unavailable today (never persisted) — pre-existing customer-pending gap (Q22), not new to this effort.
8. Prisma `$queryRaw`/`Prisma.sql` composition bug status unresolved at pinned 7.8.0 — verify locally before relying on it for dashboard filters.

**Open questions for the user/customer, ranked:**
1. Should Purchase/Production dashboards read `db_TCL`'s live ERP tables, or does the customer expect new orderstock-native schema/data-entry (since neither concept is confirmed anywhere today)?
2. For Sales "ยอดขายรวม" — is a piece-count total acceptable now, or is a baht total required (new pricing layer, larger scope)?
3. Can the customer/DBA supply the actual `db_TCL` schema for the relevant tables — ideally via a scoped read-only login — since the only table-name list in this repo traces to one unverified prose claim?
4. For Production's "planned vs. actual" — where does the PLANNED quantity come from? No source was found anywhere.
5. Does a SalesOrder (SO) concept distinct from `SalesInvoiceHdr/Dtl` exist at all in the ERP?
6. Who should see money figures if/when they exist — ADMIN only, or ADMIN+STAFF?
7. Can production deploy status be reconciled (confirm actual live git SHA / feature set) before dashboard work assumes a baseline?
8. Add a real charting library (e.g. Recharts, pending its React-19 peer-dep caveat), or extend the existing hand-rolled CSS-bar convention?