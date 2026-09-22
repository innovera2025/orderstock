# ERP Dashboards — Program SPEC

> **Program-level (umbrella) SPEC.** Written ONCE during the outer loop of this 6-phase program
> (P0 Prerequisites → P1 ERP Read Foundation → P2 Sales / P3 Purchase / P4 Production (parallel
> after P1) → P5 Hardening & Rollout). It governs every inner phase; no inner phase writes its own
> SPEC. Companion file: `erp-dashboards_PLAN_18-09-26.md` (or the umbrella + per-phase plan set),
> same folder.
>
> Written for **user review**: plain language, no file paths, no library names, no schema or code.

---

## Summary

Right now, staff can only see sales, purchasing, and production activity by asking the ERP system
directly or waiting for someone to pull a report. This program adds three new screens inside
orderstock ("แดชบอร์ด" — dashboards) that show, at a glance: what has been sold, what has been
bought, and what is being produced — pulling live, read-only numbers from the company's existing
ERP database. Because the underlying ERP data is still new and incomplete in places (the business
has only been recording deliveries and purchases for about 5 weeks, and true "actual production
output" doesn't exist as a concept in the ERP yet), every number on these dashboards is honestly
labeled as either a real, verified figure or a "not available yet" placeholder — never a made-up
or misleading number. Money figures (บาท) are only visible to Admin users; all users can see
counts and quantities. Nothing on these dashboards can ever change ERP data — they only read from
it.

## User Stories / Jobs To Be Done

- As a **Staff or Admin user**, I want to open a "การขาย" (Sales) dashboard, so that I can see how
  many deliveries went out, to which customers, and for which products, without asking anyone.
- As a **Staff or Admin user**, I want to open a "การซื้อ" (Purchase) dashboard, so that I can see
  purchase orders and purchase invoices — what was ordered, what was billed, what's still
  outstanding — without digging through the ERP directly.
- As a **Staff or Admin user**, I want to open a "การผลิต" (Production) dashboard, so that I can
  see planned production batches, their status, and what raw materials were issued for them.
- As an **Admin user**, I want to see the บาท (THB) value for sales, purchases, and any line item,
  so that I can judge the financial picture — while Staff users see the same lists without money
  columns.
- As any **dashboard user**, I want to click into a summary number (e.g. a supplier, a customer, a
  product) and see the underlying list of documents behind it, so that I can verify or investigate
  a figure instead of just trusting a total.
- As any **dashboard user**, I want to filter each dashboard by date range (and by supplier /
  customer / status where relevant), so that I can focus on the period or party I care about.
- As an **Admin user**, I want to export a dashboard's current (filtered) view to a spreadsheet
  file, so that I can share or archive numbers outside the app; Staff exports must never include
  money columns.
- As any **dashboard user**, I want to be clearly warned when a number is still very new / low
  volume ("ข้อมูลนำร่อง"), still catching up ("ข้อมูลอาจไม่ล่าสุด"), or genuinely doesn't exist yet
  ("ยังไม่มีข้อมูลผลิตจริง"), so that I never mistake a placeholder or a stale reading for a
  confirmed fact.
- As the **business owner**, I want a guarantee that nothing these dashboards do can ever write to,
  corrupt, or slow down the live ERP database used for daily accounting, so that adding this
  feature carries no risk to existing operations.

## What The User Wants (Behavioral Outcomes)

- Three new dashboard pages exist, reachable from a new "แดชบอร์ด" group in the sidebar/drawer
  navigation (desktop and tablet). They are **not** added to the phone bottom tab bar, which stays
  at its existing 3 tabs.
- Each dashboard opens to a top row of KPI (summary) tiles, followed by one or more simple bar
  charts, followed by a data table listing the underlying documents (purchase orders, delivery
  documents, or production orders) for the currently applied filters.
- Every dashboard shows a visible "ข้อมูลนำร่อง" (pilot data) banner reminding the user the
  underlying business data is still small and new.
- Every money (บาท) figure, column, or chart series is visible to Admin users and hidden entirely
  (not just grayed out) for Staff users — on screen and in exported files.
- **Sales dashboard**: shows delivery counts, line counts, and quantities (grouped per unit of
  measure — quantities in different units are never added together) as the primary numbers.
  Money is shown separately as "ยอดเงินเฉพาะรายการที่มีราคา" (amount, priced lines only) together
  with a coverage percentage, plus a visible note explaining that a larger pool of ERP sales-
  invoice value exists but is not counted in this total (a reconciliation footnote). Includes
  break-downs by product/category and by customer, each drillable to its underlying delivery
  documents and delivery lines.
- **Purchase dashboard**: shows two separate purchase totals side by side — one based on billed
  purchase invoices, one based on committed purchase orders — each clearly labeled with its own
  basis, since they answer different questions and neither replaces the other. Shows a purchase-
  order status per order with a visible "unvalidated" caveat badge, and shows received vs.
  outstanding quantities per purchase order. Includes a supplier break-down, drillable to purchase
  orders and their line items.
  A note: the customer-facing default framing (which total is presented first) is deferred to the
  chosen primary framing captured in this SPEC's Constraints/Open Questions, not invented per-phase.
- **Production dashboard**: shows planned production batches (which product, planned quantity,
  status) and raw-material issues linked to each batch. Actual produced quantity is explicitly
  shown as unavailable ("ยังไม่มีข้อมูลผลิตจริง") rather than any number — there is deliberately no
  "percent achieved" figure, because no real measurement of production output exists in the source
  system today.
- All three dashboards support date-range filtering (and dashboard-specific filters — supplier,
  customer, status) via the page's own address/URL, so a filtered view can be bookmarked, shared,
  or returned to.
- Clicking any summary/breakdown row (e.g. a supplier, a customer, a product) navigates to the
  matching filtered document list; clicking a document in that list navigates to that document's
  own line-item detail.
- Each dashboard's list can be sorted and paged.
- An Admin user can export the currently filtered list (and its line items) to a spreadsheet-
  readable file, with Thai-language column headers and Thai calendar (Buddhist Era) dates. A Staff
  user can also export, but never sees money columns in the exported file.
- If the ERP connection is temporarily unavailable, the dashboard shows the most recently known
  figures together with a visible "ข้อมูลอาจไม่ล่าสุด" (data may not be current) warning, instead of
  an error page or a blank screen.
- On mobile phone widths, each dashboard's document list renders as a card list (matching the
  existing mobile-list pattern used elsewhere in the app) instead of a wide table.

## Flow / State Diagram

```
[user logs in] --> [sidebar/drawer: "แดชบอร์ด" group]
        |
        v
   [pick a dashboard: Sales / Purchase / Production]
        |
        v
   {ERP reachable?} --no--> [show last-cached figures + "ข้อมูลอาจไม่ล่าสุด" banner]
        |yes                        |
        v                           v
 [KPI tiles + charts + document table, all scoped to current filters]
        |
        |--> [apply date-range / supplier / customer / status filter] --> [table + tiles update, URL updates]
        |
        |--> [click a breakdown row, e.g. a supplier] --> [navigate to filtered document list for that supplier]
        |
        |--> [click a document row] --> [navigate to that document's line-item detail]
        |
        |--> [Admin: click Export] --> [download spreadsheet-readable file honoring current filters]
        |         (Staff: same export, money columns removed)
        |
        v
   {role = Staff?} --yes--> [money figures/columns hidden everywhere on this screen and any export]
                    --no (Admin)--> [money figures/columns visible]

   Production-specific branch:
        [production batch row] --> {actual output ever recorded?} --always no today--> ["ยังไม่มีข้อมูลผลิตจริง" shown instead of a number]
```

## Acceptance Criteria (Testable Outcomes)

- AC1: A logged-in Staff or Admin user sees a new "แดชบอร์ด" navigation group in the sidebar/drawer
  (desktop and tablet) containing Sales, Purchase, and Production entries; the phone bottom tab bar
  still shows exactly its existing 3 tabs.
  proven by: dashboards-nav-visibility e2e scenario (mirrors `e2e/mobile.spec.ts`'s existing 3-tab
  assertion + a new sidebar/drawer nav-link check, per `all-tests.md`'s Playwright role/nav
  conventions)
  strategy: Fully-Automated

- AC2: An unauthenticated visitor who requests any dashboard URL directly is redirected to login,
  matching the existing protected-route behavior for every other app page.
  proven by: dashboards-auth-redirect e2e scenario (mirrors `e2e/auth.spec.ts`'s existing
  unauth-redirect gates)
  strategy: Fully-Automated

- AC3: On the Sales dashboard, the displayed delivery count, line count, and per-unit quantity
  totals match an independently computed total from the same underlying data (header sum equals
  detail sum, the same reconciliation method already used for orderstock's own order totals).
  proven by: sales-basis-reconciliation unit + integration scenario against the ERP fixture dataset
  strategy: Fully-Automated

- AC4: The Sales dashboard shows a money figure labeled "ยอดเงินเฉพาะรายการที่มีราคา" together with
  a coverage percentage of priced vs. unpriced lines, and a visible footnote stating that a larger,
  currently-excluded pool of ERP sales value exists and is not included in this total.
  proven by: sales-money-coverage-footnote scenario against the ERP fixture dataset
  strategy: Hybrid (fixture-driven assertion of the coverage number + agent-probe visual check of
  the footnote wording/placement)

- AC5: On the Purchase dashboard, both the invoice-based total and the purchase-order (committed)
  total are shown side by side, each labeled with its own basis, computed against the ERP fixture
  dataset's known values.
  proven by: purchase-dual-basis-reconciliation fixture scenario
  strategy: Fully-Automated

- AC6: Every purchase order's status badge and every "received vs. outstanding" quantity is
  computed correctly against the documented fixture edge cases (including a purchase order whose
  "closed" flag is stored as null rather than false), and the status badge visibly indicates it is
  unvalidated at real-world scale.
  proven by: purchase-status-flag-edge-cases fixture scenario
  strategy: Fully-Automated

- AC7: On the Production dashboard, every listed production batch shows its planned quantity and
  status; the "actual produced" column always renders as an explicit not-available indicator
  ("ยังไม่มีข้อมูลผลิตจริง") rather than any numeric value, and no achievement-percentage figure is
  rendered anywhere on the page.
  proven by: production-plan-only-empty-state fixture scenario
  strategy: Fully-Automated

- AC8: Selecting a raw-material-issue row under a production batch navigates to (or expands into)
  the list of material issues tied to that batch, matching the documented linkage.
  proven by: production-material-issue-drilldown scenario against the ERP fixture dataset
  strategy: Fully-Automated

- AC9: On every dashboard, an Admin-role user sees every money figure/column/chart series; a
  Staff-role user never sees any money figure/column/chart series anywhere on the same page, and
  the hiding happens on the server (never a client-side visual hide of data still present in the
  page).
  proven by: dashboards-money-visibility-role-gate scenario across all 3 dashboards (pattern mirrors
  the existing `auth-guard-coverage` test convention)
  strategy: Fully-Automated

- AC10: Changing a date-range (or supplier/customer/status) filter on any dashboard updates the
  page's address/URL and the displayed tiles/chart/table update to match; reloading the page with
  that URL reproduces the same filtered view.
  proven by: dashboards-filter-url-roundtrip scenario per dashboard (pattern mirrors
  `shop-location-filter`'s existing `?location=` searchParam precedent)
  strategy: Fully-Automated

- AC11: Clicking a summary/breakdown row (e.g. a supplier on Purchase, a customer or product on
  Sales) navigates to a document list correctly filtered to that entity; clicking a document in
  that list navigates to that document's own line-item detail.
  proven by: dashboards-drilldown-navigation scenario per dashboard
  strategy: Fully-Automated

- AC12: Each dashboard's document table can be sorted by at least one column and paged when the
  result set exceeds one page, without losing the currently applied filters.
  proven by: dashboards-table-sort-paginate scenario per dashboard
  strategy: Fully-Automated

- AC13: On a phone-width viewport, each dashboard's document list renders as a card list instead of
  a wide table, matching the existing mobile-card pattern used elsewhere in the app.
  proven by: dashboards-mobile-card-view scenario (mobile Playwright project, mirrors
  `admin/users/users-mobile.tsx`'s existing responsive pattern)
  strategy: Fully-Automated

- AC14: An Admin user can export the current (filtered) view of any dashboard to a spreadsheet-
  readable file with Thai column headers and Buddhist-era dates; a Staff user can perform the same
  export but the file never contains a money column.
  proven by: dashboards-csv-export-role-gate scenario per dashboard
  strategy: Fully-Automated

- AC15: When the ERP connection is unreachable, every dashboard shows its most recently cached
  figures together with a visible "ข้อมูลอาจไม่ล่าสุด" banner, and never renders a generic error
  page or a blank screen.
  proven by: dashboards-erp-degraded-mode scenario (mock/offline ERP driver forces the unreachable
  condition, per the mock-driver testing convention)
  strategy: Fully-Automated

- AC16: Every dashboard displays a visible "ข้อมูลนำร่อง" (pilot data) banner at all times while the
  underlying data volume remains small (as defined during PLAN).
  proven by: dashboards-pilot-banner-presence scenario per dashboard
  strategy: Fully-Automated

- AC17: No dashboard feature — page load, filter, drill-down, export, or the ERP read layer itself
  — can execute a write, update, delete, or schema-changing statement against the ERP database;
  any attempt is rejected before reaching the ERP connection.
  proven by: erp-read-only-guard unit scenario (ported guard test suite, ~24 cases covering
  disallowed statement types, per the approved architecture's guard layer)
  strategy: Fully-Automated

- AC18: A production probe confirms the dashboards' ERP read connection uses a login that cannot
  write to the ERP database (a scoped read-only login), not the application's existing full-access
  database login — required before any dashboard is enabled for real customer use.
  proven by: erp-login-permission-boot-probe scenario (boot-time permission check that refuses to
  start if the connected login is write-capable)
  strategy: Agent-Probe (requires an actual live database login/permission check against the real
  ERP server — not reproducible from source code or the fixture dataset alone; this is the
  explicitly-justified residual noted in the Constraints section)

## Out Of Scope

- Writing, editing, or deleting any ERP data from these dashboards, or from orderstock generally —
  every dashboard is strictly read-only against the ERP.
- Exporting to Excel's native `.xlsx` file format — the CSV export format is in scope; `.xlsx` is
  explicitly deferred to a future phase.
- Adding a 4th tab to the phone bottom navigation bar — dashboards are reachable only via the
  sidebar/drawer on tablet and desktop widths in this program.
- Showing a production "percent achieved" or achievement-rate figure — no genuine actual-production
  measurement exists in the source system, so no such figure is shown, ever, in this program.
- Migrating the Sales dashboard's underlying basis (from delivery documents to sales
  orders/invoices) — the mechanism to switch later is planned for, but the switch itself does not
  happen in this program unless the customer confirms real adoption of that other workflow.
- Building any new automated, continuously-running reconciliation job against the live ERP — this
  program uses a manual, human-run reconciliation check before each dashboard's go-live, not an
  automated one.
- Any change to how orders are entered, printed, or stored inside orderstock's own existing order
  system — this program only reads from the separate ERP system; it does not touch orderstock's own
  schema for shops, products, or order sheets.
- Real-time or sub-5-minute data freshness — dashboards may lag the live ERP by a short caching
  window; this program does not promise instant freshness.

## Constraints

- **Read-only, always.** Every dashboard query must be provably incapable of modifying the ERP
  database. This is a hard safety constraint, not a preference.
- **Money visibility is server-enforced.** THB figures are visible to Admin users only, both on
  screen and in exports; this must be enforced on the server, never only hidden in the browser.
- **No production login until a scoped read-only ERP login exists.** Development happens against a
  local ERP-shaped fixture database until the dedicated read-only ERP login is provisioned; going
  live to real customer use is blocked on that login existing.
- **Never treat a copy-of-plan figure as an actual measurement.** Where the ERP has no genuine
  "actual output" data (Production), the dashboard must say so explicitly rather than substitute
  the planned figure.
- **Never silently omit a larger, real number that a customer could independently check.** Where a
  total excludes real ERP data for a defensible reason (Sales basis), that exclusion must be
  visibly disclosed, not hidden.
- **Never combine quantities across different units of measure into one number.** Sales quantity
  totals must always be shown per unit (or per product), never summed blindly across units.
- **The existing 3-tab phone navigation must not regress.** Dashboards must not be added to the
  bottom tab bar in this program.
- **Data volume is genuinely small today** (roughly 5 weeks of pilot data: a handful of purchase
  orders, delivery documents, and production batches). Every dashboard must visibly acknowledge
  this so low numbers are not mistaken for a broken feature.
- **The primary Purchase framing (which total is presented first — invoice-based vs. purchase-order
  committed) and the exact production/customer-confirmation timeline for the Sales basis and the
  read-only ERP login are pending real customer/ERP-team answers** — see Open Questions.

## Open Questions

- Does the business intend to move to recording real sales orders/invoices going forward, or should
  delivery-document-based sales remain the permanent basis? — Owner: user/customer (deferred to
  backlog; the switchable design in Constraints/Background covers this either way, so this
  question does not block PLAN)
- Should the excluded, larger pool of sales-invoice value be disregarded permanently, or does it
  represent real transactions that need separate handling later? — Owner: user/customer (deferred
  to backlog; the visible reconciliation footnote required in this program's acceptance criteria
  covers the interim disclosure)
- Which purchase total (invoice-based or purchase-order-based) should be presented as the primary
  headline figure, with the other as secondary? — Owner: user/customer (deferred to backlog;
  program ships both as acceptance criteria require, PLAN may pick a visual default pending this
  answer)
- Is there a documented purchase-order/status workflow outside the database that should replace the
  derived status logic once available? — Owner: user/customer (deferred to backlog; interim
  "unvalidated" badge required by acceptance criteria covers this)
- Is there, or will there ever be, a step that records real production output (vs. plan) in the
  source system? — Owner: user/customer (deferred to backlog; plan-only + explicit empty state
  required by acceptance criteria covers this regardless of the answer)
- When will the dedicated read-only ERP login be provisioned by the ERP team? — Owner: user/KRS ERP
  team (deferred to backlog; this program is hard-gated on that login before any dashboard is
  enabled for real customer use, per Constraints, and development proceeds against the fixture
  database in the meantime — this does not block writing this SPEC or starting PLAN/INNOVATE)

All items above are recorded and deferred to backlog rather than blocking; none require a
answer before PLAN begins, because every acceptance criterion in this SPEC is written to hold true
regardless of how each question is eventually answered (switchable basis, dual display, visible
badges/footnotes, and explicit empty states already absorb every plausible answer).

## Background / Research Findings

- This program follows an approved final proposal (`erp-dashboards-proposal_REF_18-09-26.md`) built
  from direct inspection of the live ERP database's schema and real row data, cross-checked against
  the ERP's own report-generation logic, plus a residual finding on production-planning tables
  (`tbl_BatchMRP`/`tbl_BatchPJBal`/`tbl_BatchLot`) confirming no field anywhere in the ERP holds a
  genuine "actual production output" measurement — every candidate column that looked like it might
  hold one turned out to be an unpopulated planning field or an exact copy of the planned quantity.
- Sales data today is reconciled and trustworthy at the delivery-document level (header totals equal
  detail totals exactly), but a separate, larger pool of sales-invoice value exists in the ERP that
  the business's own official sales-report logic does not currently count — both numbers are real,
  and hiding either would be misleading.
- Purchase data has two equally valid totals depending on the question being asked (what has been
  billed vs. what has been committed via purchase order) — both are correct, so both are shown.
  Purchase order status is not computed by any existing system logic; the dashboards derive it from
  raw filed flags with a caveat, since this derivation has only been exercised on a handful of real
  records so far.
- All three dashboards will run against genuinely small, roughly 5-week-old pilot data volumes,
  which is why a visible pilot-data disclosure is required everywhere rather than presenting the
  numbers as if they represent mature, high-volume operations.
- Money figures are a new access-control dimension for this codebase — today's authentication
  system checks a single user role but has no existing concept of "can view but not edit
  financial data." This program introduces that distinction for the first time, entirely within the
  new dashboard pages.
- The existing test-context conventions for this project (per `process/context/tests/all-tests.md`)
  already establish the testing shapes this program's acceptance criteria are grounded in: pure
  unit tests for calculation/derivation logic, Playwright end-to-end tests for navigation/role/
  filter behavior (mirroring existing auth-redirect, mobile-viewport, and searchParam-filter
  precedents in this same codebase), and a fixture-driven approach for anything that would otherwise
  require live database access — because there is currently no automated test path against the real
  ERP database at all, and creating one is itself part of the approved plan for this program.
- The customer's underlying ERP database is a shared, live system also used for the business's
  day-to-day accounting outside of this project — every acceptance criterion in this SPEC is written
  so that read-only safety is proven by an automated or a manual permission check, never assumed.

---

## SPEC Gaps (inner-loop reference)

> **Convention note — not part of this SPEC's body.** This program SPEC is frozen once
> INNOVATE/PLAN begins. When an inner-loop phase (P0–P5) discovers a scope gap versus this
> umbrella SPEC, it does **not** edit this file. Instead the phase report records the gap under its
> own `## SPEC Gaps` heading plus a backlog note, and the loop continues. UPDATE PROCESS scores SPEC
> achievement per acceptance criterion at closeout; any unmet criterion becomes a backlog note.
