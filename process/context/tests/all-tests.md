---
name: context:all-tests
description: Testing entrypoint for orderstock — Vitest 3.2.6 (667 passed/1 todo/36 files with the ERP fixture wired; 633 passed/34 self-skipped without it) and Playwright E2E (145 passed/7 skipped, incl. mobile + tablet projects, plus the erp-dashboards Sales/Purchase/Production/export/degraded-mode suites) both real and wired, sandbox SQL Server constraint, the live-schema conformance gates, plus the standing procedure for running ERP-env-dependent gates
keywords: tests, testing, vitest, playwright, e2e, unit, integration, verification, coverage, sandbox, sql server, health check, build, lint, storage state, fixtures, totals, be-date, order-save, mobile, mobile viewport, mobile project, tablet, tablet project, sidebar drawer, clean-state, print page count, pdf page count, one-page print, print footer, roster, location, shop location, per-location, buildLocationRoster, locations, location management, locations.test, managed list, shop location filter, location filter, searchParam filter, shops.spec, orders filter gate, purchase dashboard, production dashboard, purchase-status, purchase-received, purchase-dual-basis, production-status-derivation, production-plan-only-empty-state, production-material-issue-drilldown, dashboards-purchase, dashboards-production, credential materialization, erp_fixture env block, live manifest, live-manifest, schema conformance, schema drift, invalid column name, erp-sql-columns, erp-query-columns, erp-flags, tinyint flag, IsCancel, column reference gate, vacuous gate
related: [context:all-database, context:all-auth]
metadata:
  read_when: the task involves testing, verification, or test debugging
---

# orderstock - All Tests

Last updated: 2026-09-23 (live-schema conformance gates added — see
"## Live-schema conformance gates" at the bottom of this file. Current regression counts:
**Vitest 667 passed / 0 failed / 1 todo across 36 files with the ERP fixture wired** (633 passed /
34 self-skipped without it), **Playwright 145 passed / 7 skipped**. Prior: 2026-07-19
(`per-location-shop-numbering` plan ✅ VERIFIED, archived — added +8 unit
tests to `roster.test.ts` (two new describe blocks: `perLocationDisplayNo`
grouping/numbering/null-bucket, `sortShopsForDisplay` ordering/null-last) + 1 new gate extending
the EXISTING `e2e/shops.spec.ts` (filtered `/shops?location=` shows
per-location numbers `1`/`2`, not the global `rosterOrder`), netting **100 unit/16 files (was 92,
+8), 49 e2e excl. [setup] (50 incl., was 48, +1)**. VALIDATE was intentionally skipped for this plan
(UI-display-only, no schema/auth/API surface, same shape as `shop-location-filter`) — see the
plan's own Validate Contract section. Prior: `shop-location-filter` plan ✅ VERIFIED AT CODE LEVEL,
archived — added 1 new e2e file `e2e/shops.spec.ts` (1 test: สถานที่ column renders + filter
narrows the shop list, ทุกสถานที่ restores all) + 1 new gate extending `e2e/orders.spec.ts`
(selecting a location narrows the sheet list; ทุกสถานที่ restores all), no unit test change (pure
UI/searchParam feature, no new pure-logic helper), netting 92 unit/16 files (unchanged), 48 e2e
excl. [setup] (49 incl.). VALIDATE was intentionally skipped for this plan (UI-only, no
schema/auth/API surface) — see the plan's own Closeout section. Prior: `location-management` plan
✅ VERIFIED AT CODE LEVEL, committed —
added `locations.test.ts` (17 unit tests for `locations-core.ts`'s pure transforms) + 4 new gates
extending `e2e/orders.spec.ts` (managed-list create → shop-form select → rename-cascade →
delete-blocked → delete-succeeds loop), netting **92 unit/16 files, 46 e2e excl. [setup] (47
incl.)**; prior: `shop-location-roster` plan ✅ VERIFIED AT CODE LEVEL — added `roster.test.ts` (5
unit tests: G1/G2/G3) + G4/G5 in `e2e/orders.spec.ts` + G6 in `e2e/print.spec.ts`, netting 75
unit/15 files, 42 e2e excl. [setup] (43 incl.); prior: `matrix-print-darkmode-fixes` plan ✅
VERIFIED at code level — added print e2e gate G9, no unit test change; `remove-settings-db` plan
VERIFIED — deleted 29 unit tests / 3 e2e tests with the removed `/settings/db` page;
`responsive-drawer-sidebar` plan CODE DONE — added 8 new e2e gates across a new `tablet` project +
a new `chromium`-tier spec)

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:

- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

Do not load the whole `process/context/tests/` folder by default. Start here, then drill down.

---

## How This File Works

This is the `all-tests.md` entrypoint for the `tests/` context group. It follows the `all-*.md` routing convention:

1. Agents read `all-context.md` first and get routed here for testing tasks
2. This file gives quick decision rules and commands
3. For deeper details, agents follow the routing table below to specific docs

---

## Current Status

**Real, wired, and passing as of `per-location-shop-numbering_19-07-26` (✅ VERIFIED, archived
19-07-26).** This plan added two new pure exports to `src/lib/roster.ts` (`perLocationDisplayNo`,
`sortShopsForDisplay`) covered by +8 unit tests in the EXISTING `roster.test.ts`, and extended the
EXISTING `e2e/shops.spec.ts` with one new gate (filtering `/shops?location=X` shows per-location
display numbers `1`/`2` for two shops sharing that location, not their global `rosterOrder`
values) — netting **100 unit/16 files (was 92, +8), 49 e2e excl. `[setup]` (50 incl., was 48, +1)**.
VALIDATE was intentionally skipped (UI-display-only, no schema/auth/API surface, same shape as
`shop-location-filter`). Full EVL confirmation run: `pnpm test` 100/16 green, `pnpm build` clean,
`pnpm lint` clean, `pnpm exec playwright test` 50 passed incl. `[setup]`, no regressions across the
full suite.
Prior: `shop-location-filter_17-07-26` (✅ VERIFIED AT CODE LEVEL, archived 17-07-26). This plan
added a new `e2e/shops.spec.ts` (1 test — the "สถานที่" column renders `shop.location ?? "-"` and
the new filter dropdown narrows the `/shops` list via `?location=`, "ทุกสถานที่" restores the full
list) and one new gate in `e2e/orders.spec.ts` (selecting a location in the now-controlled
`new-sheet-form.tsx` select navigates to `/orders?location=...`, narrows the sheet list, and
"ทุกสถานที่" restores it) — netting 48 e2e excl. `[setup]` (49 incl.), unit count unchanged at
92/16 files (no new pure-logic helper — this is a server-searchParam + controlled-select UI
feature reusing the existing `getEffectiveLocationOptions()` helper).
Prior: `location-management_14-07-26` (✅ VERIFIED AT CODE LEVEL, 15-07-26). `location-management_14-07-26` added `src/lib/__tests__/locations.test.ts` (17 unit tests — `normalizeLocations` trim/dedupe/drop-empty/preserve-order, `addLocation`, `renameLocation` incl. rename-into-existing-entry collision, `removeLocation`) and 4 new e2e gates extending `e2e/orders.spec.ts` (create a location → appears in shop-form select → shop selects it → rename cascades to the shop's `location` → delete-while-in-use blocked with Thai error → unassign → delete succeeds), netting **92 unit tests / 16 files, 46 e2e excl. `[setup]` (47 incl.)**, confirmed via `pnpm test` and `pnpm exec playwright test --list`. Prior: `shop-location-roster_13-07-26` (✅ VERIFIED AT CODE LEVEL, 13-07-26, committed `e2d3adb`) added `src/lib/__tests__/roster.test.ts` (5 unit tests — per-location filter/renumber G1, null/no-match fallback G2, extended the existing fixture-totals test for the location-filtered 446 check G3) and 3 new e2e gates (`e2e/orders.spec.ts` G4 per-location filter/displayNo/other-location-absent + G5 null-location fallback; `e2e/print.spec.ts` G6 variable-row print with `displayNo`), netting 75 unit tests / 15 files, 42 e2e excl. `[setup]` (43 incl.). Prior baseline, for context: phase1-order-system and pguard-redesign are both PROGRAM COMPLETE (pguard-redesign Phase 05 baseline was 88 tests/16 files, 25 e2e). The `ordersheet-soft-delete_11-07-26` plan grew the baseline to **99 tests/17 files, 34 e2e**. `remove-settings-db_11-07-26` then DELETED the `/settings/db` runtime DB-connection page and its 3 test files (`connection-string.test.ts` −14, `env-write.test.ts` −7, `settings-secret-hygiene.test.ts` −5, plus −3 `auth-guard-coverage.test.ts` assertions) and `e2e/settings.spec.ts` (−3 e2e) — netting **70 unit tests / 14 files, 30 e2e**. `responsive-drawer-sidebar_11-07-26` (CODE DONE, ✅ Fully-Automated/Hybrid gates green, 3 Agent-Probe rows pending-manual) then ADDED a new `tablet` Playwright project (`e2e/sidebar-drawer.spec.ts`, 5 gates) and a new `chromium`-tier spec (`e2e/sidebar-desktop-collapse.spec.ts`, 3 gates) — netting **38 e2e (excl. `[setup]`)**. `matrix-print-darkmode-fixes_13-07-26` then ADDED one new print gate `G9` to `e2e/print.spec.ts` (PDF page-count assertion, proving the note-tally footer fits one A4-landscape page) — no unit test change (pure CSS/token + one badge-removal, both outside Vitest's reach) — netting **39 e2e (excl. `[setup]`, 40 incl.)**. That `70 unit / 14 files, 39 e2e excl. setup` baseline was then grown by `shop-location-roster_13-07-26` (see above) to the CURRENT stable regression suite: **75 unit / 15 files, 42 e2e excl. setup (43 incl.)**. Any future order-system OR pguard-related work should extend it the same way. `src/lib/env-write.ts`/`connection-string.ts` and their Phase-06 round-trip gate (`scripts/phase06-roundtrip-gate.ts`) no longer exist — the second same-container sandbox database (`orderstock2`) they used is now unused by any active test.

## Testing Approach

Stack: Next.js 16.2.10 (TypeScript) + Prisma 7 + `@prisma/adapter-mssql` + SQL Server (see `all-context.md`):

- **Unit/integration:** Vitest 3.2.6 — `src/lib/__tests__/*.test.ts`. **Current: 16 files / 100 tests as of `per-location-shop-numbering_19-07-26`** (added +8 tests to the EXISTING `roster.test.ts` — `perLocationDisplayNo` describe block: same-location numbering with non-adjacent `rosterOrder` gaps, independent numbering across different locations, null/empty-location shops sharing one bucket, inactive shops still numbered when passed in by the caller; `sortShopsForDisplay` describe block: null-location group sorts last regardless of alphabetical position, `rosterOrder` ascending preserved within a group); prior baseline 16 files / 92 tests as of `location-management_14-07-26` (added `locations.test.ts`, +17 — pure-transform unit tests for `locations-core.ts`'s `normalizeLocations`/`addLocation`/`renameLocation`/`removeLocation`, no DB mocking needed, same pattern as `roster.test.ts`); prior baseline 15 files / 75 tests as of `shop-location-roster_13-07-26` (14 files/70 tests after `remove-settings-db_11-07-26`; pguard-redesign Phase 03 baseline was 15 files/82 tests, which grew to 17 files/99 tests via `ordersheet-soft-delete_11-07-26`; `remove-settings-db_11-07-26` then DELETED `connection-string.test.ts` (−14), `env-write.test.ts` (−7), and `settings-secret-hygiene.test.ts` (−5), and pruned 3 assertions from `auth-guard-coverage.test.ts`, netting 17→14 files, 99→70 tests; `shop-location-roster_13-07-26` then ADDED `roster.test.ts` (+5 — per-location filter/renumber, null/no-match fallback, location-filtered-446 fixture extension), netting 14→15 files, 70→75 tests). Surviving/current files: `smoke.test.ts` (baseline), `variant-validation.test.ts` (5 — printOrder uniqueness over the active non-null set), `correction-cascade.test.ts` (2 — propagate-while-unconfirmed / lock-after-confirm branches), `password.test.ts` (4 — bcryptjs hash/verify round-trip, wrong password, 72-byte limit), `login-attempts.test.ts` (5 — lockout BLOCK/RESET/EXPIRE), `auth-guard-coverage.test.ts` (grep-style assertion that every shop/product/admin/order/settings action AND every settings/print page call `requireAuth`; no longer covers the removed `/settings/db` module), `secret-leak.test.ts` (2 — no committed plaintext secret in tracked files), `totals.test.ts` (6 — asserts all 20 column totals + grand 446 against `test-fixtures/sheet-13-03-69.json`, NoteLine qty excluded, weight computation shape), `be-date.test.ts` (5 — CE↔BE round-trip via Intl `en-US-u-ca-buddhist`), `order-save.test.ts` (3 — `mergeSnapshots()` proves naive re-derive-from-live-names FAILS while carry-forward passes), `order-payload.test.ts` (6, pguard-redesign Phase 02 — RED-first TDD unit asserting `buildOrderPayload(cells, notes)` from `src/lib/order-payload.ts` emits the exact `cell:{shopId}:{variantId}`/`note:{shopId}` FormData set against the 13/3/69 fixture; this is the UI-seam payload guard — any new order-entry surface (matrix, future mobile) that must emit the identical save payload should import this same pure helper and be covered by an equivalent unit, not a re-derivation), `summary.test.ts` (7, pguard-redesign Phase 03 — RED-first TDD unit asserting `computeShopTotals`/`topShops` from `src/lib/summary.ts`: shop-totals Σ==446, known per-shop values, top-8 exact ordering, default-n≤8, empty→{}/[], per-column reconciliation via the UNCHANGED `computeColumnTotals`; `summary.ts` imports only `totals.ts`, does not re-derive column arithmetic), `roster.test.ts` (5, `shop-location-roster_13-07-26` — RED-first TDD unit asserting `buildLocationRoster(activeShops, sheetLocation)` from `src/lib/roster.ts`: filters `activeShops` by matching `location` and renumbers `displayNo` 1..N while keeping `rosterOrder` stable (G1); falls back to the full active-shop list, still renumbered, when `sheetLocation` is null/empty or matches 0 shops (G2); the location-filtered fixture round-trip preserving grand total 446 (G3, extending `totals.test.ts`'s existing fixture assertions) — any future roster-adjacent screen must import this one helper, never re-derive the filter/fallback/renumber logic). **`connection-string.test.ts`, `env-write.test.ts`, and `settings-secret-hygiene.test.ts` no longer exist** (deleted 11-07-26 with the `/settings/db` page they tested).
- **`e2e/orders.spec.ts` is now matrix-driven (pguard-redesign Phase 02)**: rewritten to drive `order-matrix.tsx` via `cell-{rosterOrder}-{printOrder}` testids (was Order Pad combobox-driven pre-Phase-02). D1 enters the 13/3/69 fixture → asserts `grand-total`=446 + spot totals (`total-4`=137, `total-8`=82, `total-2`=99) → save → reload → 446 persists. D2 unchanged in intent (rename a confirmed shop, resave, assert `shopNameAtEntry` snapshot preserved), only the initial-cell-entry mechanism changed to the new testids. **G4/G5 (`shop-location-roster_13-07-26`)**: G4 creates a sheet with location `ยิ่งเจริญ` and asserts only that location's shops render (numbered via the new `rownum-{rosterOrder}` testid, a shop assigned a different location is absent, and cell entry still targets the correct shop via the unchanged global `rosterOrder`-keyed testid); G5 asserts a legacy/null-location sheet (or a location with 0 matches) still renders the full active-shop fallback list, renumbered. The location control is now a `<select>` of real, `active:true`-filtered distinct locations (not free text) — existing test isolation switched from tagging the free-text location (`E2E-D1`/`E2E-DEL-*`/`E2E-MOBILE`) to a unique DATE (`dropByDate` replacing `dropByLocation`). **4 NEW gates (`location-management_14-07-26`)**: create a location via `/locations` → appears as an option in the shop-form select → a shop selects it → rename it on `/locations` → the shop's `location` follows the rename (re-fetch + assert) → attempt delete while still in use → Thai error surfaces, list unchanged → unassign the shop → delete succeeds. Uses a unique location name per test run (timestamp/random suffix) for isolation, with a best-effort `afterAll`/`afterEach` teardown removing the test location even if an earlier assertion throws mid-test (mirrors `dropByDate`'s always-run teardown pattern). **1 NEW gate (`shop-location-filter_17-07-26`)**: selects a location in the now-controlled `new-sheet-form.tsx` select, asserts the URL becomes `/orders?location=...` and the sheet list narrows to that location, then re-selects "ทุกสถานที่" and asserts the full list is restored; the shared `openSheet(page, isoDate, location)` helper was rewritten to be URL-driven (was `page.selectOption` + no navigation wait) because the select now navigates on change.
- **`e2e/shops.spec.ts` (`shop-location-filter_17-07-26`, ADMIN storage-state; extended by `per-location-shop-numbering_19-07-26`, now 2 tests)**: asserts the "สถานที่" column renders `shop.location ?? "-"` for every row, then drives the `shop-location-filter.tsx` client-component dropdown to narrow the `/shops?location=` list to one location, and confirms selecting "ทุกสถานที่" navigates back to plain `/shops` and restores the full list. **NEW gate (`per-location-shop-numbering_19-07-26`)**: assigns 2 active shops the SAME unique location tag with a non-adjacent global `rosterOrder` gap, navigates to `/shops?location=<tag>`, and asserts the ลำดับ column shows `1`/`2` in correct row order — not the underlying `rosterOrder` values.
- **`e2e/summary-history.spec.ts` (pguard-redesign Phase 03, 2 tests, ADMIN storage-state)**: G6 asserts `/summary` grand total 446 + 20 bars for the seeded day (via `?date`+`?location`); G7 asserts `/history` shows today as live ("กำลังกรอก") vs. a past sheet as closed ("ปิดยอดแล้ว"), weight `"—"`, and the "เปิดใบงาน" link. **Introduces the deterministic-e2e clean-state pattern**: a `beforeEach` + `afterAll` hook deletes E2E-located sheets and restores any " TEST"-suffixed shop names before/after each run, making the spec re-runnable regardless of prior-run outcome (the same gap `e2e/orders.spec.ts` still has, see Known Gaps below). This pattern is reusable — hoist it into a shared e2e util if Phase 04's mobile e2e specs need the same guarantee.
- **Second sandbox DB fixture (`orderstock2`) — RETIRED 11-07-26:** Phase 06 created a durable Hybrid-gate fixture on the SAME `orderstock-sql` container, driven by `scripts/phase06-roundtrip-gate.ts` against the `/settings/db` save pipeline. Both the script and the `/settings/db` page it tested were deleted by the `remove-settings-db_11-07-26` plan — the `orderstock2` database (if still present on the sandbox container from a prior run) is now unused by any active test and may be dropped.
- **DB-level testing pattern (Phase 02):** pure logic (validators, cascade back-fill decision) is extracted to `src/lib/` and Vitest-unit-tested in isolation via the `CascadeDb` adapter interface (see `database/all-database.md`) — no live DB needed for these units. The actual DB round-trip (CRUD create→edit→soft-delete) is proven via an **agent-probe** against the sandbox for shops/products, not an automated test, because server actions call `redirect()`/`revalidatePath()` (need Next request context). A headless CRUD DB-integration harness is still backlogged — see `process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md`. **Phase 04 closed this gap for order sheets specifically**: the OrderSheet round-trip (create→save→reload, plus snapshot-preserve on rename→resave) is proven via real Playwright hybrid gates (D1/D2 in `e2e/orders.spec.ts`), not an agent-probe.
- **E2E:** Playwright — `e2e/auth.spec.ts` (7 tests: login success, STAFF blocked / ADMIN allowed on `/admin`, logged-out redirect to `/login`, generic-error-on-bad-credentials for both bad-username and bad-password) + `e2e/orders.spec.ts` (2 tests, Phase 04 order-system: D1 enters the full 13/3/69 fixture through the real UI, saves, reloads, asserts grand 446 + column totals persist; D2 renames a confirmed shop, resaves, asserts via prisma that the pre-existing `shopNameAtEntry` snapshot is unchanged while the live name changed) + `e2e/print.spec.ts` (8 tests, Phase 05 + `matrix-print-darkmode-fixes_13-07-26`: G1 colgroup 24 physical/20 semantic cols, G2 29 rows + 3-tier header + totals-last-tbody + grand 446, G3 `@page A4 landscape` rule present, G4 snapshot-render — rename a live shop then confirm print still shows the original snapshot name, restored in `finally`, G5 per-shop `.sheet`/`break-after:page` count, G6 print-page `requireAuth` grep, G7 test-side `page.pdf()` valid-PDF hybrid gate, G8 unauth→`/login` redirect, **G9 (13-07-26, `matrix-print-darkmode-fixes`) — asserts the combined-daily `page.pdf()` output for the 13-note fixture is EXACTLY 1 page by counting `/Type /Page` object occurrences in the PDF byte buffer, proving the 4-column note-tally footer fits one A4-landscape page; a NEW roster gate (13-07-26, `shop-location-roster`, referred to as G6 in that plan's own verification evidence table) — asserts both print routes render the same per-location, variable-row, `displayNo`-numbered roster as the editor, proving the print surface stays in sync with the order-entry roster helper**) + `e2e/summary-history.spec.ts` (2 tests, pguard-redesign Phase 03: G6 `/summary` grand 446 + 20 bars, G7 `/history` today-live/past-closed + weight dash + link — see clean-state pattern above) + **`e2e/mobile.spec.ts` (4 tests, pguard-redesign Phase 04, runs on the `mobile` project only)**: enters the 13/3/69 fixture via `mobile-cell-{rosterOrder}-{printOrder}` steppers → taps `mobile-save` → reload → asserts `grand-total`=446, `total-4`=137, `total-8`=82 (proves the mobile branch drives the SAME `buildOrderPayload` as desktop); asserts the per-shop entry overlay is full-viewport (covers the bottom tab bar); asserts STAFF never sees `tab-users` (count 0) while ADMIN sees all 3 tabs; asserts the 3 bottom tabs navigate ร้านค้า/สรุปยอด/ผู้ใช้ + **`e2e/sidebar-drawer.spec.ts` (5 tests, `responsive-drawer-sidebar_11-07-26`, runs on the NEW `tablet` project only, 820×1180)**: drawer/backdrop hidden by default; ☰ opens the drawer + backdrop + `aria-expanded=true`; backdrop click closes; Escape closes; order-matrix has no page-level horizontal overflow + **`e2e/sidebar-desktop-collapse.spec.ts` (3 tests, `responsive-drawer-sidebar_11-07-26`, runs on the existing `chromium` project)**: sidebar visible by default at desktop viewport, ☰ collapses it and content reclaims the 216px, ☰ again reopens it, no backdrop ever appears. `e2e/settings.spec.ts` was DELETED 11-07-26 (`remove-settings-db_11-07-26` plan — all 3 gates probed the now-removed `/settings/db` route). `e2e/auth.setup.ts` produces reusable ADMIN + STAFF storage-state fixtures reused across phases (see `auth/all-auth.md` for the reuse pattern) — `orders.spec.ts`/`print.spec.ts`/`summary-history.spec.ts`/`mobile.spec.ts`/`sidebar-drawer.spec.ts`/`sidebar-desktop-collapse.spec.ts` reuse these directly rather than re-implementing login. Needs: dev server (Playwright's `webServer: pnpm start` boots/reuses it), sandbox up, and a seeded admin (`pnpm tsx prisma/seed.ts` + `SEED_ADMIN_PASSWORD` in `.env` — Playwright loads `.env` via `process.loadEnvFile()`, Node 22).
- **Mobile + tablet Playwright projects (`playwright.config.ts`):** `mobile` (390×844, pguard-redesign Phase 04) and `tablet` (820×1180, `responsive-drawer-sidebar_11-07-26`), both alongside the existing `setup`+`chromium` projects, reusing `e2e/.auth/staff.json` + `e2e/.auth/admin.json` storage states. Only `e2e/mobile.spec.ts` runs on `mobile`; only `e2e/sidebar-drawer.spec.ts` runs on `tablet`; the desktop specs (`orders.spec.ts`, `print.spec.ts`, `sidebar-desktop-collapse.spec.ts`, `shops.spec.ts`, etc.) run on `chromium`, whose `testIgnore` excludes both viewport-specific specs (`/mobile\.spec\.ts|sidebar-drawer\.spec\.ts/`). `pnpm exec playwright test` runs ALL projects — **49 tests excl. `[setup]` (50 incl., confirmed via `pnpm exec playwright test --list`, 19-07-26)** as of `per-location-shop-numbering_19-07-26` (was 48 excl. `[setup]` after `shop-location-filter_17-07-26`; +1 for the new per-location numbering gate in the existing `e2e/shops.spec.ts`). Verify the exact current per-project split with `pnpm exec playwright test --list` if precision matters.
- **Hoisted clean-state helper (`e2e/util/clean-state.ts`, pguard-redesign Phase 04):** the `beforeEach`/`afterAll` clean-state pattern first demonstrated inline in `e2e/summary-history.spec.ts` (Phase 03) is now a SHARED helper — deletes E2E-located sheets, restores " TEST"-suffixed shop names. Both `summary-history.spec.ts` and `mobile.spec.ts` import it. This resolves the Phase-03 EVL follow-up stub ("hoist into a shared e2e util"). `e2e/orders.spec.ts` still has NOT been retrofitted with this helper (see Known Gaps below) — any new DB-mutating spec should import the hoisted helper rather than re-inlining the pattern.
- **Self-seeding + restore-in-finally isolation pattern (Phase 05, standard for any DB-mutating e2e spec):** a spec that must mutate shared master/order data (e.g. `print.spec.ts` G4 renames a shop to prove snapshot fidelity) seeds its OWN dedicated date/location/row via Prisma at spec start, mutates only that seeded row, and restores the original value in a `finally` block regardless of assertion outcome. This keeps the shared `workers:1` sandbox clean for every other spec in the same run — proven pattern first used by Phase 04's D2 (rename→resave→verify-snapshot-unchanged) and reused unchanged by Phase 05. Adopt this shape for any future spec that touches shared state instead of ad hoc setup/teardown.
- **Shared test fixture:** `test-fixtures/sheet-13-03-69.json` (Phase 04) is the canonical 13/3/69 scan-day data source — 51 grid cells, all 20 column totals, grand 446, 13 NoteLines incl. one orphan (`shopId` null). It is imported directly by `totals.test.ts` (unit), `roster.test.ts` (unit, G3, `shop-location-roster_13-07-26`), `e2e/orders.spec.ts` (E2E/D1), and `e2e/print.spec.ts` (Phase 05 print gates) — do not re-derive a second copy of this data. Its `location` field is set to `"ยิ่งเจริญ"` (`shop-location-roster_13-07-26`) so the fixture proves the real per-location filter path (all 25 seeded shops share that location, so filtering to it still yields the full 446 total) rather than only the null-location fallback path.
- **Database:** integration tests run against the disposable sandbox SQL Server (Docker, `orderstock-sql` container) — **never against the customer DB**.

## Quick Routing

- use `process/context/database/all-database.md` for the `CascadeDb` adapter test pattern, schema/migration/seed commands, and SQL Server-specific gotchas that affect DB-dependent test gates
- use `process/context/auth/all-auth.md` for the Playwright ADMIN/STAFF storage-state fixture reuse pattern, `requireAuth` test coverage, and session/lockout test scenarios
(No other deeper test docs yet. Add routing entries here as new domains land.)

## Default Verification Order

Unless the task clearly needs a different path:

1. `pnpm build` + `pnpm lint` (fast, no sandbox needed)
2. `pnpm test` (Vitest — fast, no sandbox needed for pure-logic tests)
3. Sandbox-dependent gates (migrate status, health endpoint) — only after `docker compose up -d`
4. End-to-end/browser tests only when the real UI is the thing being verified (Phase 05+)

## Commands

| Package | Runner | Command | Needs sandbox? |
|---|---|---|---|
| root (orderstock) | Vitest | `pnpm test` (→ `vitest run`) | No |
| root | Next.js build | `pnpm build` | No |
| root | ESLint | `pnpm lint` | No |
| root | Prisma | `npx prisma migrate status` | Yes — needs `.env` + sandbox up |
| root | Prisma | `npx prisma migrate dev` | Yes |
| root | manual/curl | `curl -s localhost:3000/api/health` → `{"ok":true}` | Yes — needs `pnpm dev`/`pnpm start` + sandbox up |
| root | Playwright | `pnpm exec playwright test` | Yes — needs sandbox up + seeded admin/data (`SEED_ADMIN_PASSWORD` in `.env`); `webServer` auto-starts `pnpm start`; 49 tests excl. `[setup]` (50 incl.) as of `per-location-shop-numbering_19-07-26` (`chromium` desktop + `mobile` + `tablet` projects) |
| root | Playwright (first run only) | `pnpm exec playwright install chromium` | No — one-time browser download |

## Prerequisites for Sandbox-Dependent Gates

1. `.env` must exist with `DATABASE_URL` (JDBC-style `sqlserver://localhost:1433;...`) and `MSSQL_SA_PASSWORD` — see `all-context.md` Environment and Configuration. `.env` is privacy-hook-guarded; see Gotchas below.
2. Bring the sandbox up: `MSSQL_SA_PASSWORD=... docker compose up -d` (or rely on `.env` if the shell sources it).
3. Run `docker stats --no-stream` first to confirm ≥2 GiB headroom on the shared Docker VM (9 other unrelated containers run there — never touch them).
4. Check `docker logs orderstock-sql` after bringing the container up — SQL Server exits **silently** under memory pressure or on a weak SA password, with no other symptom.

## Debugging Quick Reference

- **`docker logs orderstock-sql` shows nothing / container exited silently:** almost always memory pressure (check `docker stats` for headroom) or a weak/rejected `MSSQL_SA_PASSWORD`. `docker-compose.yml` sets `mem_limit: 2g` explicitly for this reason.
- **Health endpoint returns `{"ok": false}`:** the error is sanitized in the response (`src/app/api/health/route.ts` never echoes the connection string or stack trace) — check the server-side console log for the real error, not the HTTP response.
- **Can't run sandbox-dependent gates because `.env` isn't accessible:** use the inline-env fallback pattern — pass `DATABASE_URL=... MSSQL_SA_PASSWORD=...` directly on the command line for that one invocation (this is how Phase 01 EXECUTE/EVL proved every gate before `.env` existed).
- **`pnpm test` / `pnpm build` fails on a native build script:** pnpm 11.5 requires explicit `allowBuilds` approval in `pnpm-workspace.yaml` for `@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`, `sharp`, `unrs-resolver` — already configured; if a new native-build dependency is added, it needs the same treatment.

## Known Gaps

**`per-location-shop-numbering_19-07-26` residual (Agent-Probe only, pending-manual as of 19-07-26
UPDATE PROCESS):** all Fully-Automated (`roster.test.ts` +8) and Hybrid (`e2e/shops.spec.ts` new
gate, full Playwright suite) gates are green. One item remains outside automated coverage: a
person's visual scan confirming the unfiltered `/shops` list reads as clean per-location groups
(numbering restarting at 1 across a location boundary) — the plan's own Test Plan documents this
as an Agent-Probe row not independently re-confirmed within this UPDATE PROCESS closeout session.
Not a blocker; the pure `sortShopsForDisplay`/`perLocationDisplayNo` unit tests already prove the
underlying grouping/ordering algorithm.

**`shop-location-roster_13-07-26` residuals (pending-manual as of 13-07-26 UPDATE PROCESS):** all
Fully-Automated (G1–G3, G7–G9) and Hybrid (G4–G6, Playwright sandbox) gates are green — see
`database/all-database.md` §Per-Location Shop Roster. Two items remain outside automated coverage:
(1) explicit user confirmation of live per-location behavior on a real sheet (the plan's own Phase
Completion Rules call this out before calling the feature strictly "VERIFIED", not just
code-verified); (2) on-site real-printer fidelity for a location with more than 29 shops (same
pre-existing agent-probe-only pattern as the rest of this project's print surface — see this file's
"On-site real-printer mm fidelity" row below). Also noted: the sandbox `orderstock` DB was bootstrapped via hand-authored SQL rather than a full
linear migration history, so `prisma migrate dev`'s shadow-diff is unusable against it — future
schema changes on this sandbox should use a hand-authored migration file + idempotent sqlcmd ALTER
+ `prisma generate` instead (see `database/all-database.md` for the exact pattern this plan used).
**Correction, 18-09-26 (erp-dashboards Phase 0):** earlier wording here described this sandbox DB
as "an ERP-shaped clone containing unrelated ERP tables (e.g. `krs_log`)" — that was inaccurate;
this DB has never contained ERP tables. A genuinely ERP-shaped fixture database (`erp_fixture`),
introduced by the `erp-dashboards` program's Phase 1, is a separate, deliberately provisioned
sandbox database and must never be confused with this one.

**`responsive-drawer-sidebar_11-07-26` residual (Agent-Probe only, pending-manual as of 11-07-26 UPDATE PROCESS):** iPad 768px/1024px real-viewport usability, dark-mode legibility with the drawer/backdrop open, and `prefers-reduced-motion` OS-level behavior were not re-verified in the UPDATE PROCESS closeout session (no browser/dev-server session available). All Fully-Automated/Hybrid gates are green; plan stays `CODE DONE` until this manual pass is done. No automated Playwright emulation exists repo-wide for `prefers-reduced-motion` or dark-mode visual diffing (pre-existing gap, not newly introduced).

**pguard-redesign Phase 02 residual (non-blocking, e2e infra) — hoisted into a shared util as of Phase 04:**

- **`e2e/orders.spec.ts` is first-run-clean, not idempotent.** `createOrderSheet` dedups by
  date+location, so a persisted E2E-D1/E2E-D2 sheet left over from a prior *failed* run makes
  step 1 carry forward a stale snapshot; a shop renamed by a failed D2 run also pollutes
  subsequent runs. EVL confirmed the spec IS re-runnable on success (two consecutive green runs,
  no order-dependence) — the gap only bites recovery-from-failure. **The fix is now hoisted**:
  `e2e/util/clean-state.ts` (Phase 04) — a shared `beforeEach`+`afterAll` clean-state helper
  (delete E2E-located sheets, restore renamed shops), imported by `summary-history.spec.ts` and
  `mobile.spec.ts`. `e2e/orders.spec.ts` itself has still NOT been retrofitted with the helper
  (remains an open item — low priority, since EVL already confirmed the spec is re-runnable on
  success). Any future DB-mutating spec should import the hoisted helper, not re-inline the
  pattern.

**phase1-order-system is program-complete (all 6 phases ✅ VERIFIED). These gaps are all accepted residuals, tracked as backlog notes for any future work on this feature — none blocked delivery.**

- CRUD DB-integration harness for shops/products round-trips is still an agent-probe, not automated (backlog: `process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md`) — order sheets already closed this via Phase 04's D1/D2 hybrid gates and DB-switch closed it via Phase 06's Hybrid round-trip gate; shops/products CRUD remains the residual.
- No audit log for auth events (Phase 1 scope, accepted known-gap — see `auth/all-auth.md`).
- Total-weight computation (`computeTotalWeight` in `totals.ts`) ships but is not validated against the 13/3/69 form's 4,670 กก / 163 ปี๊บ footer — per-variant `weightKg`/`pipConversion` are null until the customer confirms conversion factors; print footer renders the labels with BLANK values, never fabricated numbers (backlog: `process/features/order-system/backlog/weight-factors_NOTE_06-07-26.md`).
- OrderSheet duplicate-sheet TOCTOU (no DB unique on `date`+`location`) — accepted residual (backlog: `process/features/order-system/backlog/order-sheet-dup-index_NOTE_06-07-26.md`).
- Orphan `NoteLine` (shopId null) persistence is proven only by code inspection, not an E2E DB round-trip (backlog: `process/features/order-system/backlog/order-notes-ui-followups_NOTE_06-07-26.md`).
- Print visual fidelity vs. the scan is proven only by agent-probe screenshot review (G9), not an automated visual-regression baseline — a Playwright A4-viewport screenshot baseline is a recommended future hardening step (Phase 05 report, Test Infra Gaps).
- Print semantic-fill shading (Q30) is an accepted known-gap — the additive CSS layer exists in `print.css` but is OFF; ships border-only until the customer confirms colors (backlog: `process/features/order-system/backlog/print-shading-q30_NOTE_06-07-26.md`).
- Server-side PDF export for `/print/**` is deferred — only a test-side `page.pdf()` gate exists; no `/api/print/**` route ships yet (backlog: `process/features/order-system/backlog/print-pdf-fallback_NOTE_06-07-26.md`).
- On-site real-printer mm fidelity is unverified beyond agent-probe screenshot review — `docs/deployment-guide.md` (Phase 06) instructs an on-site test print (Chrome/Edge, printer Scale = 100%) before relying on the layout.
- The actual `process.exit`/NSSM restart on a real Windows host is not exercised by any automated gate — the Hybrid round-trip gate stops at the `.env` write under `ORDERSTOCK_NO_EXIT=1`; the restart itself is a documented manual/NSSM step verified only by the deployment guide's agent-probe.
- Customer SQL Server version/compatibility level is unconfirmed — `db/create-database-and-login.sql` ships with a TODO-flagged `COMPATIBILITY_LEVEL 140/150` pending confirmation.
- No CI pipeline configured yet — all gates run locally/manually per phase.

---

## ERP fixture / guard testing (erp-dashboards Phase 1)

Added 22-09-26 by `phase-01-erp-read-foundation`. Covers how the read-only ERP layer is tested.

### Unit suites (no DB connection is opened in any of them)

| File | Tests | Proves |
|---|---|---|
| `src/lib/__tests__/erp-adapter.test.ts` | 57 | The full read-only guard: 19 forbidden-keyword rules (one case each) + statement-shape cases (empty, whitespace, comment-only, DECLARE/EXEC/SET prefixes, stacked semicolons, unterminated string/comment, trailing-semicolon allowed, valid SELECT, valid WITH CTE, parameterized SELECT) + normalizer false-positive defense (`update_flag`, `[Update Date]`, forbidden word inside a string literal, semicolon smuggling, BOM) + `guardedQuery` ordering/parameterization + `verifyReadOnlyBoot` mocked refusal/acceptance |
| `src/lib/__tests__/erp-cache-degrade.test.ts` | 24 | TTL cache (fresh / within-TTL / expired), the degrade path (stale fallback, empty-cache rethrow, repeated failures), `erpDegradeState` banner mapping, `shouldVerifyBootProbe` dev-mode gating, and the JDBC-to-mssql-config URL parser |
| `src/lib/__tests__/resolve-erp-database-url.test.ts` | 12 | `$`-in-password verbatim round-trip, quote stripping, CRLF, first-match, `process.env` fallback, clear throw when unset, and key isolation from plain `DATABASE_URL` |
| `src/lib/__tests__/dashboard-data-table.test.tsx` | 17 | The shared table's sort/paginate URL contract, other-searchParam preservation, and the mobile card branch |

Suite total moved 100 → **212 tests across 20 files**.

### Component testing WITHOUT jsdom — the established pattern here

This repo has **no `jsdom`, no `happy-dom`, and no `@testing-library/react`**, and
`vitest.config.ts` stays `environment: "node"`. `dashboard-data-table.test.tsx` therefore renders
the server component directly with `renderToStaticMarkup` from `react-dom/server` (already present
via `react-dom`) and asserts on the returned HTML string, mocking `next/link` to a plain anchor.
**Reuse this pattern for future shared-component tests** rather than adding a DOM test dependency.

Two consequences worth knowing:
- It proves markup and URL contracts, NOT pixel layout or browser-runtime behavior. Those stay
  e2e/agent-probe concerns.
- Vitest does **not** resolve the `@/` TS path alias (no alias in `vitest.config.ts`). Components
  that need to be unit-testable must use **relative imports** — `src/components/dashboard-data-
  table.tsx`, `pilot-banner.tsx`, and `degrade-banner.tsx` do. Route handlers and pages are not
  vitest-loaded and keep using `@/`.

### E2E

`e2e/dashboards-nav-visibility.spec.ts` runs under BOTH the `chromium` and `mobile` projects; each
describe block self-skips outside its viewport tier via `test.skip(({ viewport }) => ...)`.

- chromium (4 tests): the "แดชบอร์ด" group renders 3 links for ADMIN and STAFF, and the hrefs are
  exactly `/dashboards/{sales,purchase,production}`.
- mobile 390×844 (3 tests): the phone bottom tab bar is UNCHANGED — still 3 tabs for ADMIN, 2 for
  STAFF, zero dashboard tabs, and the sidebar stays hidden.

`playwright.config.ts`'s `mobile` project `testMatch` was broadened from `/mobile\.spec\.ts/` to
`/mobile\.spec\.ts|dashboards-nav-visibility\.spec\.ts/`. **Without that edit the phone-tier block
would silently run zero tests** — a reminder that adding a spec file is not enough when a project
uses a narrow `testMatch`. E2E count: 49 → **56** (excluding `[setup]`).

Note: the 3 dashboard routes 404 until Phases 2/3/4 land their pages. The spec asserts the LINKS,
never that the pages render — that is deliberate, not a missing assertion.

### Hybrid gates (require the local sandbox)

Precondition: `orderstock-sql` container running and `db/erp-fixture/00-schema.sql` + `01-seed.sql`
applied (see `database/all-database.md` § ERP Read Layer for the exact sqlcmd invocation).

1. **Fixture present** — `SELECT COUNT(*) FROM dbo.InventoryItem` in `erp_fixture` returns 10;
   re-running the seed affects 0 rows (idempotent).
2. **Live health probe** — with the dev server up and `ERP_DATABASE_URL` pointed at `erp_fixture`:
   `curl localhost:3000/api/health/erp` returns `{"ok":true,"latencyMs":...,"stale":false,"rows":1}`
   at HTTP 200. This exercises the real resolver → parser → pool → guard → cache chain.
3. **Live refusal proof (optional but recommended)** — re-run the same probe with
   `ERP_VERIFY_BOOT_PROBE=1`. Because the sandbox `sa` login IS write-capable, layer 4 must refuse:
   the route returns `{"ok":false,"error":"ERP connection failed"}` at HTTP 200 and the server log
   shows `ErpWritePermissionError ... INSERT, UPDATE, DELETE, ALTER, CREATE TABLE`. This is the
   strongest available proof of the boot probe short of the real scoped login.

**Never run any ERP fixture script, probe, or test against `db_TCL`.** Every gate above targets
localhost only; the live-ERP smoke test is Phase 5's Agent-Probe and needs the DBA-provisioned
read-only login first.

---

## Sales dashboard testing (erp-dashboards Phase 2)

Added 22-09-26 by `phase-02-sales-dashboard`. Extends the ERP fixture/guard pattern above with a
domain-specific fixture (`db/erp-fixture/sales-seed.sql`) and reconciliation-style Hybrid gates.

### Unit suites

| File | Proves |
|---|---|
| `src/lib/__tests__/sales-basis-reconciliation.test.ts` | Fully-Automated half: `resolveSalesBasisFromValue()` decision, `sumQuantityByUnit()` never-sums-across-units, period-bin boundaries, SQL byte-identity/read-only-keyword/no-concatenation/`Roworder`-tie-break sweeps over the `db/erp-queries/sales/*.sql` files. Hybrid half (same file, ERP-connected): header `TotalAmount` sum == detail `Amount` sum exactly against `erp_fixture` |
| `src/lib/__tests__/sales-money-coverage-footnote.test.ts` | Fully-Automated wording assertions + Hybrid numeric half: coverage % and the excluded `SalesInvoiceHdr` total, against real fixture rows |
| `src/lib/__tests__/sales-fixture-expected.ts` | Non-`.test.ts` module holding the shared fixture constants both suites above import (vitest only collects `*.test.ts`, so this avoids re-executing describe blocks) |

Suite total moved 212 → **282 tests across 23 files**.

### Hybrid gate preconditions (this domain adds one requirement beyond Phase 1's)

Both Hybrid gates above **actually run** (not vacuously skip) only when BOTH are set:
```bash
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox sa>;encrypt=true;trustServerCertificate=true"
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1   # LOCAL FIXTURE ONLY — sandbox `sa` is write-capable, never set in production
```
Without `ERP_DATABASE_URL`, both Hybrid gates self-skip with a loud `console.warn` and every
fixture-backed e2e scenario fails with a generic page error rather than a useful assertion —
confirm the env is set before treating a red run as a code regression.

### E2E

`e2e/dashboards-sales.spec.ts` — 19 tests: the 16 original scenarios (nav+page load both roles,
unauth redirect, reconciliation display, coverage+footnote, money role gate via raw-HTML assertion
— never CSS-hidden, filter URL round-trip, period-toggle round-trip, donut/pie render + cross-filter
×2, customer/product drilldown, sort+paginate preserving filters, 390×844 mobile card view via an
in-file `test.use()` override) plus 2 resilience gates added during EVL: the page always returns 200
with a dashboard root (never Next's generic error screen), and with the ERP unreachable the Thai
unavailable state renders with filters still round-tripping and zero money markup for any role. The
second resilience gate self-skips via `/api/health/erp` when the ERP is actually healthy.

**Gotcha:** `pnpm test:e2e -- <spec>` does NOT filter — the `--` argument is swallowed and the full
suite runs. Use `pnpm exec playwright test <spec>` for a scoped run.

### New pattern: degrade-on-cold-cache

Phase 1's `getCached()` deliberately rethrows when an ERP read fails and nothing has ever been
cached (cold process, or an outage starting before the first successful read) — this is by design,
not a bug. Phase 2 is the reference implementation for handling that at the page level: wrap the
ERP read in `try/catch` and render a dedicated unavailable view (`sales-unavailable.tsx`) instead of
letting the throw escape into Next's generic 500 page. Phases 3/4 should reuse this pattern; it is
not yet lifted into a shared component.

### Known gaps

- The positive live boot-probe case (real `db_TCL` scoped read-only login returning all-zero write
  permissions) is untested — the login does not exist yet. Deferred to Phase 5.
- Degrade-banner visual placement is unverified; no dashboard page exists yet to render it on
  (Phase 2/3/4 agent-probe).
- The guard's denylist is proven against every case enumerable from the ported source; it cannot
  prove the absence of an unknown bypass shape. Layers 3–5 exist because of that residual.

---

## Purchase dashboard testing (erp-dashboards Phase 3)

Added 22-09-26 by `phase-03-purchase-dashboard`. Same fixture/Hybrid-gate pattern as Phase 2, own
domain fixture (`db/erp-fixture/purchase-seed.sql`).

### Unit suites

| File | Proves |
|---|---|
| `src/lib/__tests__/purchase-status.test.ts` (14 tests) | `derivePoStatus()` all 7 branches, incl. `IsClosed IS NULL` fall-through (not Closed) and cancelled short-circuiting every other flag |
| `src/lib/__tests__/purchase-received.test.ts` (12 tests) | `computeOutstanding()` incl. an over-received line — negative outstanding, never clamped to 0 |
| `src/lib/__tests__/purchase-dual-basis.test.ts` (41 tests) | `aggregateSupplierBreakdown()` determinism + `SupplierCode`-asc tie-break, plus the "embedded Purchase SQL matches `db/erp-queries/purchase/*.sql`" byte-identity/read-only-keyword/no-concatenation drift sweep (the `src/lib/purchase-sql.ts` pattern — required because `output: "standalone"` excludes `db/` from the production bundle) |

Suite total moved 282 → **382 (EXECUTE-session count) → 390 tests across 30 files** (combined with
Phase 4's additions below; both phases landed in the same window).

### E2E

`e2e/dashboards-purchase.spec.ts` — 27 tests: nav+access, dual-basis KPI tiles (461,140 invoice /
727,920 PO-committed against the fixture), PO status badge + unvalidated caveat (incl. the
`IsClosed IS NULL` row), money-gate DOM-string assertion (AC9), filter/drilldown/sort/paginate
round-trips, 390×844 mobile card view via an in-file `test.use({viewport})` override (NOT
`--project=mobile`, which does not match this spec).

### Known gaps

- Live reconcile of `total-invoice-basis.sql`/`total-po-committed-basis.sql` against real `db_TCL`
  and KRS's own `sp_PurchaseInvoiceMonth`/`sp_Popending` procedures is Phase 5's
  `live-reconcile-script.ts` — this phase proves correctness against `erp_fixture` only.
- **EVL-session credential-access gap — CLOSED 22-09-26, not by a code fix but by a procedure
  fix.** 5 independent `vc-tester` EVL SUBAGENT cycles against this phase could not re-run the 9
  Hybrid/Agent-Probe gates above — every attempt to build `ERP_DATABASE_URL` inside the subagent's
  own sandbox was blocked by a "Credential Materialization" restriction (no `.env` read, no
  `docker exec ... printenv`, no inline `source .env`). This is a property of the **subagent
  sandbox**, not the environment or the code: on 22-09-26 the **orchestrator itself** (not a
  spawned `vc-tester`) ran the full suite directly with `ERP_DATABASE_URL` set inline and
  reproduced all 9 previously-blocked gates green (Playwright 119 passed/7 skipped). **Standing
  procedure, going forward:** any ERP-env-dependent gate that a `vc-tester`/EVL subagent cannot
  reach must be independently confirmed by the **orchestrator or the user** running the exact
  command with the env inline (see the "Commands to Stay Green" block below) — do NOT spawn another
  `vc-tester` and expect a different result; the restriction is session-scoped to subagents, not to
  the machine. This recurred identically for Phase 2 (self-resolved within its own EVL cycle),
  Phase 3 (5 cycles, plateau-accepted as a known-gap until this correction), and Phase 5 (resolved
  immediately by having the orchestrator run EVL directly instead of spawning `vc-tester`).

---

## Production dashboard testing (erp-dashboards Phase 4)

Added 22-09-26 by `phase-04-production-dashboard`. Own domain fixture
(`db/erp-fixture/production-seed.sql`, self-provisions `tbl_MoHdr`/`tbl_BatchOrder`/
`InventoryFlowHdr`/`InventoryFlowDtl` since Phase 1's seed did not yet touch Production tables).

### Unit suites

| File | Proves |
|---|---|
| `src/lib/__tests__/production-status-derivation.test.ts` (26 tests) | `deriveMoStatus()` precedence (cancel → closed → approved → pending, `ISNULL(IsClosed,0)` semantics) + `plannedQuantity()`/`plannedQtyByUnit()` (LotQty with Prodqty fallback, never summed across units) + the embedded-SQL byte-identity drift sweep against `db/erp-queries/production/*.sql` |
| `src/lib/__tests__/production-plan-only-empty-state.test.ts` (10 tests, Hybrid half against real fixture rows) | AC7: the "ผลิตจริง" cell always renders the literal Thai empty-state string, never a computed percentage |
| `src/lib/__tests__/production-material-issue-drilldown.test.ts` (7 tests, Hybrid) | AC8: raw-material-issue lookup + its own empty state when an MO has zero issues |

Suite total (combined with Phase 3): **390 tests across 30 files** (up from 282 pre-Phase-3/4).

### E2E

`e2e/dashboards-production.spec.ts` — 17 tests: nav+access, plan-only empty-state column always
renders the Thai string with no achievement-% anywhere on the page (AC7, 4-level enforcement — see
`uxui/all-uxui.md`'s Plan-only honesty pattern), material-issue drilldown navigation + empty state
(AC8), filter round-trip, breakdown-row drilldown, sort+paginate, 390×844 mobile card view via the
same in-file `test.use({viewport})` pattern as Phase 2/3.

**Gotcha (repeats across Phases 2–4):** `pnpm test:e2e -- <file>` does NOT filter — pnpm swallows
the `--` and Playwright runs the WHOLE suite. Always use `pnpm exec playwright test <file>` for a
scoped run.

### Known gaps

- **Status-precedence confidence is LOW** — only 2 of 4 `deriveMoStatus()` branches have ever been
  exercised by real data (n=3 live MOs). The gates prove the CASE logic mechanically, not the
  real-world branch distribution. Do not upgrade this confidence without new evidence.
- No "FG receipt into stock" ledger signal exists anywhere in the ERP schema for completed MOs
  (data dictionary confirms 0 of 218 `InventoryFlowHdr` rows qualify) — deliberately not built, not
  a bug.
- AC18's live boot-probe against the real scoped read-only login is Phase 5's, not this phase's.
- Unlike Phase 3, this phase's single independent EVL cycle (22-09-26) reached the fixture
  successfully and every gate passed on the first try — it did **not** hit the credential-access
  block described in Phase 3's Known Gaps above (session-dependent, not a fixed property of the
  environment).

---

## Cross-dashboard hardening, export & degraded-mode testing (erp-dashboards Phase 5 — PROGRAM FINAL)

Added 22-09-26 by `phase-05-hardening-export-rollout`. Program-final regression counts: **Vitest
523 passed/0 failed/1 todo, 32 files** with the ERP fixture wired (490 passed/33 self-skipped
without); **Playwright 145 passed/7 skipped**, exactly +26 over the 119/7 baseline (the new tests
below), zero regressions anywhere.

### Unit suites

| File | Proves |
|---|---|
| `src/lib/__tests__/dashboards-money-audit.test.ts` (98 tests) | Cross-dashboard AC9 money-gate audit: role-diffed byte comparison of the real export handler's STAFF vs ADMIN output; static source sweep asserting every money-bearing site on all 3 dashboards derives `canSeeMoney` server-side (never CSS-hiding, never client-derivable); Production asserts NO money token exists anywhere; the CSV serializer contract (BOM, CRLF, formula-neutralisation, row cap) and the export-target derivation (a spoofed searchParam cannot override the target) |
| `src/lib/__tests__/erp-fixture-seed-idempotency.test.ts` (6 tests) | `purchase-seed.sql` + `production-seed.sql` apply cleanly in EITHER run order, twice each, against throwaway databases — the fixture's `InventoryFlowHdr`/`InventoryFlowDtl` column set now converges on the UNION of both live spellings (`VoucherNo`/`InOutDate`/`MainQuantity`/`Approved` AND `DocuNo`/`TransactionDate`/`Qty`/`MONo` — both genuinely live, both used by shipped queries, neither droppable). Confirmed RED before the fix (3 failures in purchase-then-production order). |

### E2E

- `e2e/dashboards-export.spec.ts` — 19 tests (18 + setup): CSV export button on all six
  dashboard-table call sites, role-diffed column counts (STAFF has strictly fewer columns, nothing
  blanked in place), Thai headers, BE dates, BOM presence read via raw bytes (⚠ `Response.text()`
  strips the BOM per the WHATWG spec — always decode with `ignoreBOM: true}`), and a rendered-HTML
  STAFF/ADMIN money-value check across every dashboard + drilldown (reads `page.content()`, catching
  a value that was rendered then CSS-hidden — plus a positive ADMIN control so the STAFF assertion
  cannot pass vacuously).
- `e2e/dashboards-degraded-mode.spec.ts` — 9 tests (8 + setup): warms each dashboard's cache while
  healthy, forces a REAL outage via `/api/test/erp-force-down`, reloads and asserts last-cached
  content renders behind "ข้อมูลอาจไม่ล่าสุด" (never an error page, never blank), recovery, the health
  probe, the pilot banner on every dashboard/drilldown for both roles, and the unauth-redirect pair
  re-confirmation (AC2) across `/dashboards/purchase` + `/dashboards/production`.

### Commands to Stay Green (ERP-backed gates — LOCAL SANDBOX ONLY, never `db_TCL`)

```bash
export ERP_DATABASE_URL="sqlserver://localhost:1433;database=erp_fixture;user=sa;password=<sandbox sa>;encrypt=true;trustServerCertificate=true"
export ERP_ALLOW_WRITE_CAPABLE_LOGIN=1   # sandbox `sa` is write-capable — never set in production
export ERP_TEST_FORCE_DOWN=1             # e2e ONLY — AC15 specs 404 without it; NEVER set on a customer deployment
pnpm test && pnpm lint && pnpm build && pnpm test:e2e
```

`ERP_TEST_FORCE_DOWN` was an undocumented requirement discovered at this phase's own EVL run — the
e2e suite runs a real production build (`pnpm start` sets `NODE_ENV=production`), so the
force-down route's original `NODE_ENV !== "production"` gate alone made AC15 untestable. The gate
is now `NODE_ENV !== "production" || ERP_TEST_FORCE_DOWN === "1"`. **This var must never be set on
a customer deployment** — it is listed as a "must not be set" item in the rollout-readiness REF.

### Known gaps (permanent, USER-RUN — do not expect these to close via any future agent session)

- **Live-mode AC18 boot-probe** — the scoped read-only ERP login does not exist yet (blocked on the
  DBA running `db/create-erp-readonly-login.sql`). Fixture-mode AC18 is green.
- **Manual live reconcile against real `db_TCL`** — `src/lib/erp/live-reconcile-script.ts` /
  `scripts/erp-reconcile.ts` are written, their refusal gates (`ERP_RECONCILE_CONFIRM=1` +
  explicit `ERP_DATABASE_URL` both required) are exercised, and the script reproduces every known
  fixture truth exactly when pointed at `erp_fixture` — but it has NEVER been run against `db_TCL`.
  This is USER-RUN by charter, not a code shortfall.
- Spreadsheet-rendering fidelity of the exported CSVs (Thai glyphs in a real Excel/Google Sheets
  session) is untestable headless — a human open-in-Excel check is the only closing action.

---

## Live-schema conformance gates

Added 23-09-26, in response to a production defect: every ERP dashboard page rendered
"ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้" against the live `db_TCL` while `/api/health/erp` reported
healthy and the ENTIRE local suite was green.

### What went wrong, and why no test caught it

The queries were not logically wrong. They named things that do not exist in production:

| Referenced | Reality on `db_TCL` |
|---|---|
| `dbo.tbl_DOhdr.IsCancel` | no such column (real flags: `IsApproved`/`IsClosed`/`IsComplete`/`IsCheck`/`IsAcc`, each with a paired `*By`/`*Date`) |
| `dbo.InventoryFlowDtl.Qty` | the quantity column is `MainQuantity` |
| `dbo.InventoryFlowHdr.TransactionDate` | the flow date is `InOutDate` |
| flag columns treated as SQL `BIT` | every flag is `TINYINT`, so the `mssql` driver returns a **number** |

Root cause: the local `erp_fixture` sandbox had been hand-built from a PROSE data dictionary rather
than from the live column list. The fixture therefore contained the same invented columns and the
same wrong types, so query and fixture agreed with each other and both disagreed with production.
**A suite that only ever compares code against a fixture cannot detect that the fixture itself is
the fiction.**

### The mechanism

`db/erp-schema/live-manifest_23-09-26.json` is the new anchor: a metadata-only capture (name, type,
nullability — no rows, no counts, no customer data) read from `sys.columns`/`sys.types` on the live
server for all 11 tables the dashboards touch, 809 columns. `db/erp-schema/README.md` documents how
to re-capture it. Everything below compares against that file, never against the fixture.

| Gate | File | Proves |
|---|---|---|
| Fixture DDL ↔ live | `src/lib/__tests__/erp-fixture-schema-conformance.test.ts` (16 tests) | every `CREATE TABLE` in `00-schema.sql` matches the manifest column-for-column (name, order, type, nullability); no seed file contains `CREATE TABLE`/`ALTER TABLE` |
| Query SQL ↔ live | `src/lib/__tests__/erp-query-schema-conformance.test.ts` (106 tests) | every column every `db/erp-queries/**/*.sql` file reads exists on the live table |
| Flag coercion | `src/lib/__tests__/erp-flags.test.ts` (13 tests) | TINYINT `1`/`0` (what the driver really returns) derive PO and MO status correctly; `=== true` on a flag can never come back |

All three are pure text/JSON analysis — **no database, no Docker, no network** — so they run in
every environment and cannot self-skip into uselessness.

### How the query gate works (and why it is not vacuous)

Two cooperating halves, in `src/lib/erp-sql-columns.ts` (analyser) and
`src/lib/erp-query-columns.ts` (declared contracts):

1. **Automatic, zero-maintenance:** the analyser strips comments and string literals, resolves
   `FROM/JOIN dbo.X alias` bindings, and checks every QUALIFIED reference (`h.IsClosed`) against the
   manifest. Comment stripping is load-bearing — several queries legitimately *document* the removed
   bad columns in their headers.
2. **Declared, for the unresolvable rest:** an UNQUALIFIED read inside a CTE
   (`SELECT ItemCode ... FROM dbo.InventoryItem`) cannot be attributed by regex, because `ItemCode`
   is a real column on several of these tables. Rather than guess, each query file declares its
   column contract in `ERP_QUERY_COLUMNS`.

The declaration is checked from **both** sides, plus an anti-padding check, so it cannot be used to
launder a bad column:

- every declared column must exist in the manifest (the list cannot invent);
- every column the SQL reads must be declared (the list cannot omit);
- every declared column must appear as an identifier in its query file (the list cannot be padded
  with real-but-unused column names until the first check passes by construction);
- an unresolved alias, or one alias bound to two tables in a file, is a hard FAILURE — the analyser
  never silently drops a reference it did not understand.

Anti-vacuity, verified by deliberate mutation on 23-09-26 (each reverted immediately after):

| Mutation | Result |
|---|---|
| re-add `h.IsCancel` to `do-headers.sql` | 2 arms fail, naming `h.IsCancel -> dbo.tbl_DOhdr.IsCancel` |
| re-add it **and** declare it in `ERP_QUERY_COLUMNS` (whitewash attempt) | still 2 failures — the automatic arm is independent of the declaration |
| drop a real column (`IsCheck`) from a declaration | fails: "declares every column the SQL reads" |
| pad a declaration with a real-but-unused column (`tbl_DOhdr.DueDate`) | fails: "declares nothing the file never mentions" |

### Rules going forward

- **Editing a query?** Update its `ERP_QUERY_COLUMNS` entry in the same edit.
- **A column is not in the manifest?** It does not exist in production, whatever the data dictionary
  says. Re-capture the manifest before trusting a new name.
- **Reading a flag column?** Use `erpFlag()` / `erpFlagOrNull()` from `src/lib/erp-flags.ts`. Never
  compare an ERP flag with `=== true` — every one of them is TINYINT.
- **Adding a table to a query?** Capture it into the manifest first; the gate fails on a table it
  cannot describe rather than skipping it.
- **Refreshed the manifest?** Regenerate the `CREATE TABLE` blocks in `00-schema.sql` from it
  instead of hand-editing, then re-run both conformance gates.

### Known gap

The manifest is a point-in-time capture (23-09-26). If the customer's vendor alters `db_TCL`, the
gates keep passing against the stale snapshot. There is no automated drift alarm — re-capturing is
a deliberate, USER-RUN action. Write a NEW dated file rather than overwriting, so drift stays
visible in git history.
