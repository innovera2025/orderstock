---
name: plan:shop-location-filter
description: "Per-location filtering for /shops and /orders list pages (server-side, ?location= searchParam), reusing getEffectiveLocationOptions() — zero schema change"
date: 17-07-26
feature: order-system
---

# Shop/Order Location Filter — Plan

Date: 17-07-26
Status: ✅ VERIFIED AT CODE LEVEL — archived (UPDATE PROCESS, 17-07-26)
Complexity: **SIMPLE** (mechanical UI feature, SPEC/INNOVATE skipped per orchestrator — locked decisions supplied).

## Closeout (UPDATE PROCESS, 17-07-26)

- **VALIDATE: intentionally SKIPPED.** Reason: UI-only mechanical feature — no schema, auth, API, or billing surface changed (Skip condition 1 in `orchestration.md` §VALIDATE Gate). No `## Validate Contract` section was written; this note documents the skip per the archival gate requirement.
- **EVL-confirmed gate results** (orchestrator-independent re-run, not just execute-agent's internal claim):
  - `pnpm test` — 92 tests / 16 files (unchanged — no new unit-testable pure logic introduced by this feature)
  - `pnpm build` — clean
  - `pnpm lint` — clean
  - `pnpm exec playwright test` — 49 passed incl. `[setup]` (1 setup test) → **48 excl. `[setup]`** (was 46 excl. before this feature; +2 new gates: 1 in `e2e/shops.spec.ts`, 1 added to `e2e/orders.spec.ts`)
- **Diff review:** orchestrator-reviewed in place of the safety classifier (unavailable during this execute-agent run) — filter component, controlled-select wiring, and searchParam changes confirmed scoped to Blast Radius; `createOrderSheet`/actions/schema untouched.
- **Execution deviations (all within-blast-radius / test-infra, not scope creep):**
  1. Shared e2e `openSheet` helper (`e2e/orders.spec.ts`) rewritten to be URL-driven, because the now-controlled location select navigates on change (raced the old `selectOption` approach).
  2. Test roster slots 21/24 and 22/23 chosen for the new e2e gates after finding `rosterOrder`-20 is a pre-existing seed gap.
  3. A pre-existing sandbox admin-password drift was resynced so the Playwright `[setup]` auth fixture could authenticate — test-infra only (sandbox `orderstock-sql` container), no code/schema/secret change; the temporary helper used was deleted afterward.
- **Pending:** user live-UX sign-off on the real `/shops` and `/orders` filter behavior; deployment of this change to production is a separate, not-yet-scheduled step.
- **Classification:** Ready for UPDATE PROCESS archival (VERIFIED AT CODE LEVEL — see §Pending above for the residual manual/deploy items, tracked as open items, not blockers).

Context consulted: `process/context/all-context.md`, `process/context/uxui/all-uxui.md`, `process/context/tests/all-tests.md`.

## Phase Completion Rules

This is a SIMPLE single-session plan (no phase program). It is complete when:
- All 10 Implementation Checklist items are done
- All Fully-Automated gates are green (`pnpm build`, `pnpm lint`)
- Both Hybrid Playwright gates (new `/orders` filter test(s), new `/shops` filter test) are green
- No regression in existing `e2e/orders.spec.ts` D1/D2/G4/G5 gates

## Acceptance Criteria

1. Visiting `/shops?location=X` shows only shops with `location === X`; visiting `/shops` (no param) shows all shops.
2. `/shops` renders a "สถานที่" column with `shop.location ?? "-"` for every row.
3. The `/shops` filter dropdown, when changed, navigates to `/shops?location=<value>` (or `/shops` for "ทุกสถานที่") without requiring a manual refresh.
4. Visiting `/orders?location=X` shows only sheets with `location === X` (plus the unaffected `active: true` filter); visiting `/orders` shows all active sheets.
5. On `/orders`, changing the สถานที่ select navigates to `/orders?location=<value>` and the select's displayed value stays in sync with the URL.
6. Submitting "เปิดใบออเดอร์ใหม่" on `/orders` still creates a sheet with the currently-selected location (create behavior unchanged in shape — still calls `createOrderSheet` with `formData.get("location")`).
7. `pnpm build` and `pnpm lint` pass with no new errors.

## Overview

Two Thai user complaints, one root cause and one existing fix pattern:

1. **/shops** — "เพิ่มสถานที่และให้มีเลือกดูได้ตามสถานที่" (add location visibility + filter by location). `Shop.location` already exists but is not shown or filterable on the list page.
2. **/orders** — "หน้า /orders ข้อมูลไม่ filter ตามสถานที่ที่เลือก" (the page doesn't filter by the selected location). The สถานที่ dropdown in `new-sheet-form.tsx` only sets the value used to CREATE a new sheet — it does not filter the list below it.

Both `Shop.location` and `OrderSheet.location` are `String? @db.NVarChar(200)` already in the schema (added by `shop-location-roster_13-07-26`, which is why zero schema change is required here). `getEffectiveLocationOptions()` (`src/lib/locations.ts`) is the existing, already-wired helper that returns the managed-location list ∪ distinct active-shop locations — reuse it verbatim for both dropdowns; do not re-derive it.

## Goals

- G1: `/shops` shows a "สถานที่" column and a location filter dropdown; selecting a location server-filters the shop list via `?location=`.
- G2: `/orders`'s existing สถานที่ dropdown does double duty: selecting a value filters the sheet list below AND remains the default location used by "เปิดใบออเดอร์ใหม่" (create). This is done by making the URL (`?location=`) the single source of truth for both the filter and the form's current selection.
- G3: Zero schema change, zero new dependency, no change to `createOrderSheet`'s call contract.

## Non-Goals

- No change to `Shop.location`/`OrderSheet.location` data model.
- No change to the managed-locations admin UI (`/locations`).
- No multi-select filtering (single location or "ทุกสถานที่" only), matching the existing single-select pattern in both forms.

## Locked Decisions (from orchestrator — do not re-derive)

1. **/shops**: add BOTH (a) a "สถานที่" column (`shop.location ?? "-"`) and (b) a server-side filter dropdown (`?location=` searchParam, default = all). New small client component for the dropdown.
2. **/orders**: the EXISTING `new-sheet-form.tsx` สถานที่ select does double duty — it drives the URL filter (`router.push('/orders?location=...')`) AND remains the value submitted on create. Coupled via a `selectedLocation` prop making the select controlled.
3. `getEffectiveLocationOptions()` is reused unchanged for both dropdowns' option lists.

## Codebase Facts Confirmed by Reading (17-07-26)

- `src/app/(main)/orders/page.tsx` — async server component, `dynamic = "force-dynamic"`. Already fetches `getEffectiveLocationOptions()` (unused for filtering today — only passed to `<NewSheetForm locations={locations} />`). Already renders a "สถานที่" column in the sheet table. Currently only filters `where: { active: true }` — no location filter.
- `src/app/(main)/orders/new-sheet-form.tsx` — client `"use client"`, `useActionState(createOrderSheet, ...)`. Has an uncontrolled `<select name="location" defaultValue="">`. Props today: `{ locations?: string[] }`.
- `src/app/(main)/shops/page.tsx` — async server component, `dynamic = "force-dynamic"`. Fetches `prisma.shop.findMany({ orderBy: { rosterOrder: "asc" } })`, NO location column, NO filter, NO `getEffectiveLocationOptions()` import today.
- `src/lib/locations.ts` — `getEffectiveLocationOptions(): Promise<string[]>` already exists and is stable; reuse directly.
- `grep -rn "useRouter" src/` → **no hits**. This plan introduces the first `useRouter`-driven client component in the codebase. Use `next/navigation`'s `useRouter` (App Router client hook) — `router.push(url)` is sufficient.
- Next.js 16 server component `searchParams` prop is a `Promise<{...}>` — must be typed as a Promise and `await`ed.
- `e2e/orders.spec.ts` — existing convention: `test.use({ storageState: "e2e/.auth/staff.json" })`; isolates test data by a **unique DATE** (not free-text location) because location is now a constrained `<select>` of real shop locations (post `shop-location-roster`); imports `prisma` directly for setup/teardown; helper `openSheet(page, isoDate, location)` already exists and uses `page.selectOption('select[name="location"]', location)`.
- No existing e2e spec file for `/shops` (`e2e/shops.spec.ts` does not exist yet per file listing) — new gates for shops will be a NEW small spec file, OR added inline to an existing shops-adjacent spec if one is found at EXECUTE time (verify via `find e2e -iname '*shop*'` before writing — none found in current listing, so plan for a new `e2e/shops.spec.ts`).

## Touchpoints (exhaustive)

| # | File | Change |
|---|---|---|
| 1 | `src/app/(main)/shops/page.tsx` | EDIT — accept `searchParams: Promise<{ location?: string }>`, await it, filter `prisma.shop.findMany({ where: { ...(location ? { location } : {}) }, orderBy: { rosterOrder: "asc" } })`, fetch `getEffectiveLocationOptions()` via `Promise.all`, render new "สถานที่" column, render `<ShopLocationFilter current={location ?? ""} locations={locations} />` above the table. |
| 2 | `src/app/(main)/shops/shop-location-filter.tsx` | NEW — client component. `<select>` with `<option value="">ทุกสถานที่</option>` + one `<option>` per location. `onChange` → `useRouter().push(location ? \`/shops?location=${encodeURIComponent(location)}\` : "/shops")`. Reuse the exact select Tailwind/token classes from `new-sheet-form.tsx`'s สถานที่ select (`h-10 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[var(--text)] outline-none focus-visible:border-[var(--brand-int)] focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]`). |
| 3 | `src/app/(main)/orders/page.tsx` | EDIT — accept `searchParams: Promise<{ location?: string }>`, await it, add `...(location ? { location } : {})` to the existing `where: { active: true, ... }` filter on `orderSheet.findMany`, pass `selectedLocation={location ?? ""}` to `<NewSheetForm>`. |
| 4 | `src/app/(main)/orders/new-sheet-form.tsx` | EDIT — add `selectedLocation?: string` prop (default `""`). Make the location `<select>` controlled: `value={selectedLocation}`, keep `name="location"` unchanged (so `createOrderSheet` form submission is untouched). Add `onChange` → `useRouter().push(...)`, mirroring the shops filter. |

## Design Note — Controlling `new-sheet-form.tsx`'s select without breaking create-submit

The select must simultaneously: (a) drive the URL filter on change, and (b) still submit its current value as `name="location"` in the create-sheet form POST. Both are satisfiable with ONE `<select>`:

- Keep `name="location"` on the select (untouched — `createOrderSheet` still reads `formData.get("location")` unchanged).
- Set `value={selectedLocation}` (controlled) instead of `defaultValue=""`.
- Add `onChange={(e) => { const v = e.target.value; router.push(v ? \`/orders?location=${encodeURIComponent(v)}\` : "/orders"); }}`.
- Because `selectedLocation` comes from the parent server component (`page.tsx`, itself reading the URL `?location=` searchParam), after `router.push` triggers a server round-trip the new `selectedLocation` prop value flows back down and the select's controlled `value` stays in sync — no local `useState` needed for the location field itself (the existing `date` field's local `useState` is untouched and separate).
- On submit, `createOrderSheet` reads `formData.get("location")` from the currently-rendered (URL-synced) select value — i.e., "create with the currently filtered location" is the correct, requested behavior (per Locked Decision 2: "remains the default location used when creating a new sheet").
- `option value=""` label stays "ทุกสถานที่" — selecting it navigates to plain `/orders` (no query param) and create with location `""` → `createOrderSheet`'s existing empty-string-to-null handling is untouched.

## Public Contracts

- No new server actions. `createOrderSheet` signature and behavior UNCHANGED — it still receives `location` via the same `name="location"` field.
- No new route segments — `?location=` is a searchParam on the existing `/shops` and `/orders` routes, not a new path.
- `softDeleteShop` / `restoreShop` / `DeleteSheetButton` — untouched, no interaction with the new filter.

## Blast Radius

- `src/app/(main)/shops/page.tsx` (edit)
- `src/app/(main)/shops/shop-location-filter.tsx` (new)
- `src/app/(main)/orders/page.tsx` (edit)
- `src/app/(main)/orders/new-sheet-form.tsx` (edit)
- `e2e/shops.spec.ts` (new, if not found to already exist at EXECUTE time)
- `e2e/orders.spec.ts` (edit — add filter gates)

No schema, no migration, no new dependency, no auth/billing/API-contract surface.

## Implementation Checklist

1. Confirm no `e2e/shops.spec.ts` exists yet: `find e2e -iname '*shop*'`. If one exists, add gates there instead of creating a new file.
2. Edit `src/app/(main)/shops/page.tsx`: type `searchParams: Promise<{ location?: string }>`, `await` it, extract `location`, filter `prisma.shop.findMany` with `where: { ...(location ? { location } : {}) }`, add `getEffectiveLocationOptions()` fetch via `Promise.all`.
3. Add a "สถานที่" `<th>`/`<td>` column to the shops table (position: between ชื่อร้านค้า and สถานะ), rendering `shop.location ?? "-"`.
4. Create `src/app/(main)/shops/shop-location-filter.tsx` (client component, `useRouter` from `next/navigation`) per the Touchpoints table row 2 spec. Render it above the shops table in `page.tsx`, passing `current={location ?? ""}` and `locations={locations}`.
5. Edit `src/app/(main)/orders/page.tsx`: type `searchParams` as a Promise, `await` it, add the location filter to the existing `orderSheet.findMany` `where` clause (keep `active: true`), pass `selectedLocation={location ?? ""}` to `<NewSheetForm>`.
6. Edit `src/app/(main)/orders/new-sheet-form.tsx`: add `selectedLocation?: string` prop (default `""`), import `useRouter` from `next/navigation`, make the location select controlled per the Design Note, wire `onChange`.
7. Manual smoke: `pnpm dev`, visit `/shops` and `/orders`, confirm filter changes URL + list contents, confirm "ทุกสถานที่" resets to unfiltered, confirm creating a new sheet still submits the currently-selected location.
8. Run automated gates (see Test Plan) and fix any red result before finalizing.
9. Add/extend e2e gates per Test Plan.
10. Run full validator suite (`pnpm test`, `pnpm build`, `pnpm lint`, `pnpm exec playwright test`) before requesting VALIDATE.

## Test Plan (tiers)

| Tier | Scenario | Command | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-Automated | TypeScript compiles, no type errors from `searchParams` Promise typing or new props | `pnpm build` | Types are correct end-to-end | Runtime filter behavior |
| Fully-Automated | Lint passes on new/edited files | `pnpm lint` | No style/lint regressions | Runtime behavior |
| Hybrid | E2E: `/orders` filter narrows list to one location; "ทุกสถานที่" resets; create-sheet still submits currently-selected location | `pnpm exec playwright test e2e/orders.spec.ts` (new test(s) added per checklist) — precondition: dev server + seeded DB via existing Playwright webServer config | The URL-driven filter genuinely filters the server-rendered list; create/filter coupling works end-to-end | Non-Playwright real-printer or visual fidelity |
| Hybrid | E2E: `/shops` shows สถานที่ column values and the filter dropdown narrows the shop list | `pnpm exec playwright test e2e/shops.spec.ts` (new file) — same precondition | Column renders correct value; filter narrows correctly | — |
| Known-Gap | Multi-tab/back-button navigation edge cases with the filter state | — | — | Out of scope for this mechanical UI feature; acceptable given single-select low-risk surface |

REQ-TEST-LINK:
- G1 (proven by: new `/shops` Playwright test — strategy: Hybrid)
- G2 (proven by: new `/orders` Playwright test(s) — strategy: Hybrid)
- G3 (proven by: `pnpm build` + unchanged `createOrderSheet` call site — strategy: Fully-Automated)

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm build` succeeds | Fully-Automated | G3 (no schema/contract break); type-safety of new searchParams/props |
| `pnpm lint` clean on touched files | Fully-Automated | Code quality baseline |
| New/extended `e2e/orders.spec.ts` filter test | Hybrid | G2 |
| New `e2e/shops.spec.ts` filter test | Hybrid | G1 |

## Test Infra Improvement Notes

(none identified yet)

## Risks

- Low risk overall — single-select dropdown coupling to URL state, no schema/auth/API surface. Main risk is the "double duty" select on `/orders` behaving unexpectedly on submit if `selectedLocation` isn't correctly threaded — mitigated by keeping `name="location"` unchanged so `createOrderSheet`'s contract cannot regress even if the controlled-value wiring has a bug (worst case: create defaults to "" like today).
- `searchParams` Promise typing is a well-established Next 16 pattern in this codebase — low risk of drift.

## Rollback

Both edits are additive (new prop, new searchParam, new column, new small client component) with no data/schema impact — reverting via `git revert` on the touched files is safe and immediate.

## Validate Contract

(To be written by vc-validate-agent during VALIDATE phase — not yet run for this plan.)

## Resume and Execution Handoff

- Plan file: `process/features/order-system/active/shop-location-filter_17-07-26/shop-location-filter_PLAN_17-07-26.md`
- No validate-contract yet — VALIDATE phase runs next.
- EXECUTE must scope-fence to exactly the files in Blast Radius; no schema/migration files should be touched.
- If `e2e/shops.spec.ts` is found to already exist at EXECUTE time, add gates there instead of creating a duplicate file — re-check via `find e2e -iname '*shop*'` before writing.
- Test infrastructure: `pnpm test` (Vitest, no new unit-testable pure logic introduced by this plan — no new test file required there), `pnpm build`, `pnpm lint`, `pnpm exec playwright test`.

Next: say **"ENTER VALIDATE MODE"** to convert this plan into an executable validate-contract before implementation begins.
