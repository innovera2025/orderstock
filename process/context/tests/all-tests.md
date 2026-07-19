---
name: context:all-tests
description: Testing entrypoint for orderstock — Vitest 3.2.6 (100 tests/16 files) and Playwright E2E (49 tests excl. [setup], incl. mobile + tablet projects) both real and wired, sandbox SQL Server constraint
keywords: tests, testing, vitest, playwright, e2e, unit, integration, verification, coverage, sandbox, sql server, health check, build, lint, storage state, fixtures, totals, be-date, order-save, mobile, mobile viewport, mobile project, tablet, tablet project, sidebar drawer, clean-state, print page count, pdf page count, one-page print, print footer, roster, location, shop location, per-location, buildLocationRoster, locations, location management, locations.test, managed list, shop location filter, location filter, searchParam filter, shops.spec, orders filter gate
related: [context:all-database, context:all-auth]
metadata:
  read_when: the task involves testing, verification, or test debugging
---

# orderstock - All Tests

Last updated: 2026-07-19 (`per-location-shop-numbering` plan ✅ VERIFIED, archived — added +8 unit
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
"On-site real-printer mm fidelity" row below). Also noted: the sandbox `orderstock` DB is an
ERP-shaped clone containing unrelated ERP tables (e.g. `krs_log`), so `prisma migrate dev`'s
shadow-diff is unusable against it — future schema changes on this sandbox should use a
hand-authored migration file + idempotent sqlcmd ALTER + `prisma generate` instead (see
`database/all-database.md` for the exact pattern this plan used).

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
