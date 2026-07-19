---
name: plan:per-location-shop-numbering
description: "/shops list shows a per-location 1..N display number (matching the order sheet), instead of the global rosterOrder identity value"
date: 19-07-26
feature: order-system
---

# per-location-shop-numbering — Plan (SIMPLE)

**Date**: 19-07-26
**Status**: ✅ VERIFIED (19-07-26) — CODE DONE, all Fully-Automated + Hybrid gates green (full EVL
confirmation run); VALIDATE was explicitly skipped (see Validate Contract below)
**Complexity**: SIMPLE

Context read before drafting: `process/context/all-context.md` (root router), `process/context/uxui/all-uxui.md`, `process/context/database/all-database.md` (roster contract + `rosterOrder` identity rule), `process/context/tests/all-tests.md` (current suite: 92 unit/16 files, 48 e2e excl. `[setup]`).

## Overview

The daily order sheet already numbers shops 1..N **per location** (`displayNo`, computed by
`buildLocationRoster()` in `src/lib/roster.ts`). The `/shops` master-data list, however, still shows
the shop's GLOBAL `rosterOrder` identity value in the "ลำดับ" column — so a shop that is #1 on its
location's order sheet can show as e.g. `29` on `/shops`. This plan makes `/shops` show the SAME
per-location number the order sheet shows, without touching `rosterOrder` (which remains the
`@unique` DB identity field — save payload / print `?slots=` / React keys / test-ids all still key
on it, completely unchanged).

**SPEC/INNOVATE skipped** — design is locked by the user (automatic, no-schema option) and confirmed
against real code in RESEARCH. This PLAN is the only artifact before EXECUTE.

## Goals

1. `/shops` "ลำดับ" column shows a per-location display number (1..N within the shop's own
   location), computed identically in spirit to the order sheet's `displayNo` — so the two surfaces
   can never disagree.
2. The number is computed over **active shops only** (soft-deleted/inactive shops never appear on
   the order sheet, so they get no per-location number — render `-`).
3. List ordering on `/shops`:
   - **Filtered** (`?location=`): unchanged query semantics — that location's shops, `rosterOrder`
     ascending (this already matches the order sheet's own sort).
   - **Unfiltered** (all): group by location (alphabetical; the "no location" bucket sorts last),
     `rosterOrder` ascending within each group — so the flat list visually reads as a sequence of
     per-location 1..N runs instead of one global rosterOrder sequence.
4. Shops with `location: null` (or an empty/whitespace string) are grouped together as their own
   "no location" bucket and numbered 1..N among themselves (their own active-shop count) — this
   mirrors `buildLocationRoster`'s existing null-key normalization (`trim() ?? ""`), just without its
   full-list fallback (which is an order-sheet-specific behavior, not needed here — see Design
   Decision below).

## Out of Scope

- The order sheet (`orders/[id]/page.tsx`, `roster.ts`'s `buildLocationRoster`, print routes) is
  **NOT changed** — it is already correct for this request (see Blast Radius).
- `rosterOrder` — the `@unique` DB identity field — is never reassigned, reordered, or exposed
  differently. This plan is display-only.
- No schema change (user explicitly chose the no-schema/automatic option).
- No new dependency.

## Design Decision (locked)

Add ONE new pure, DB-free, unit-testable helper to `src/lib/roster.ts` — the existing single source
of truth for per-location numbering logic — rather than inlining the grouping/numbering logic in
the page component. This keeps `/shops` and the order sheet unable to silently diverge, and keeps
the new logic covered by fast unit tests instead of only e2e.

**Why not reuse `buildLocationRoster` directly:** `buildLocationRoster(activeShops, sheetLocation)`
answers "what is the roster for ONE location" (with its full-list fallback for null/no-match,
correct for an order sheet that always has exactly one location). `/shops` needs "the per-location
number for EVERY shop across ALL locations at once" (a map), with NO fallback-to-full-list behavior
— a shop with a null location must land in its own small "no location" bucket, not silently become
part of every other location's numbering. These are genuinely different shapes, so a new function is
the right level, not a variant of `buildLocationRoster`.

**New export — `perLocationDisplayNo`:**

```ts
export function perLocationDisplayNo(activeShops: RosterInputShop[]): Map<number, number>
```

- Groups `activeShops` by `location?.trim() || ""` (null/empty/whitespace-only → the `""` bucket,
  same normalization `buildLocationRoster` already uses).
- Within each group, sorts by `rosterOrder` ascending (same tie-break as `buildLocationRoster`).
- Assigns 1..N per group.
- Returns `Map<shopId, displayNo>` — the caller (`/shops/page.tsx`) looks up each active shop's
  number by `shop.id`; inactive shops are never in the input, so `map.get(inactiveShop.id)` is
  naturally `undefined` and the page renders `-`.
- Reuses the existing `RosterInputShop` type (`id`, `rosterOrder`, `name`, `location`) — no new type.

**New export — `sortShopsForDisplay`:**

```ts
export function sortShopsForDisplay<T extends { location: string | null; rosterOrder: number }>(
  shops: T[],
): T[]
```

- Pure sort: location ascending (the `""` / null-normalized bucket always sorts LAST, regardless of
  string comparison), then `rosterOrder` ascending within each location group.
- Generic over any `{ location, rosterOrder }` shape so it works directly on Prisma `Shop` rows
  (which also carry `id`, `name`, `active`, etc.) without needing a mapping step.
- Used ONLY by the unfiltered `/shops` view. The filtered view already gets a single-location list
  from the existing `where: { location }` query, already sorted `rosterOrder` asc — no re-sort
  needed there.

## Touchpoints

| File | Change |
|---|---|
| `src/lib/roster.ts` | ADD `perLocationDisplayNo()` and `sortShopsForDisplay()` — pure functions, no new type, `buildLocationRoster` untouched |
| `src/app/(main)/shops/page.tsx` | Fetch shops once (drop the conditional `where`), compute `activeShops` + `perLocationDisplayNo` map, apply `sortShopsForDisplay` when unfiltered / keep the existing filtered-list order when `?location=` is set, render the map value (or `-`) in the "ลำดับ" `<td>` instead of `shop.rosterOrder` |
| `src/lib/__tests__/roster.test.ts` | ADD unit tests for both new helpers |
| `e2e/shops.spec.ts` | ADD one hybrid gate: 2 shops in the SAME location with non-adjacent global `rosterOrder`s show per-location numbers `1`/`2` on the filtered `/shops?location=` view |

## Public Contracts

- `roster.ts` gains two new named exports. No existing export's signature changes.
  `buildLocationRoster` is untouched (same signature, same behavior, still the order-sheet/print
  source of truth).
- `/shops` page's rendered HTML changes only in the "ลำดับ" column's displayed value and (for the
  unfiltered view) row order. No route, no query param, no server action signature changes.

## Blast Radius

- **Changed:** `src/lib/roster.ts` (additive exports only), `src/app/(main)/shops/page.tsx`
  (`ลำดับ` column + fetch/sort logic), `src/lib/__tests__/roster.test.ts`, `e2e/shops.spec.ts`.
- **Explicitly NOT changed (verified in RESEARCH):**
  - `src/app/(main)/orders/[id]/page.tsx` — already calls `buildLocationRoster(shops, sheet.location)`
    and renders `displayNo`; this is the correct per-location order-sheet behavior the user asked
    for, and it already works.
  - `src/lib/get-sheet-for-print.ts` and both print routes — unaffected, they call
    `buildLocationRoster` directly and never touch `/shops`.
  - `prisma/schema.prisma` — zero schema change; `Shop.rosterOrder` stays the `@unique` identity
    field.
  - `src/app/(main)/shops/shop-location-filter.tsx`, `src/lib/locations.ts` /
    `src/lib/locations-core.ts` — the location-select/filter dropdown and managed-locations list are
    unaffected; this plan only changes what number is displayed in a column and what order rows
    render in.
  - `src/app/(main)/shops/actions.ts`, `shop-form.tsx` — shop create/edit/soft-delete/restore
    actions are unaffected.

## Implementation Checklist

1. `src/lib/roster.ts` — add `perLocationDisplayNo(activeShops: RosterInputShop[]): Map<number, number>`:
   group by `location?.trim() || ""`, sort each group by `rosterOrder` asc, assign 1..N, return a
   `Map<shopId, displayNo>`. Add a short doc comment cross-referencing `buildLocationRoster` and
   explaining why this is a separate function (see Design Decision above).
2. `src/lib/roster.ts` — add `sortShopsForDisplay<T extends { location: string | null; rosterOrder: number }>(shops: T[]): T[]`:
   stable sort by (a) `location?.trim() || ""` ascending, with the `""` bucket always LAST regardless
   of alphabetical position, then (b) `rosterOrder` ascending.
3. `src/app/(main)/shops/page.tsx`:
   - Fetch `allShops = await prisma.shop.findMany({ orderBy: { rosterOrder: "asc" } })` (drop the
     conditional `where: { ...(location ? { location } : {}) }` — filtering now happens in JS so the
     per-location display-number map can be computed over the correct active-shop scope regardless
     of the current filter).
   - Compute `activeShops = allShops.filter((s) => s.active)`.
   - Compute `displayNoMap = perLocationDisplayNo(activeShops)`.
   - Compute the rendered list: `const shops = location ? allShops.filter((s) => s.location === location) : sortShopsForDisplay(allShops);`
   - Replace the "ลำดับ" `<td>` body: `{shop.active ? (displayNoMap.get(shop.id) ?? "-") : "-"}`.
   - Everything else in the file (filter dropdown, สถานที่/สถานะ/จัดการ columns, soft-delete/restore
     forms) is untouched.
4. `src/lib/__tests__/roster.test.ts` — add a new `describe` block for `perLocationDisplayNo`:
   - two shops in the same location, non-adjacent `rosterOrder`s (e.g. 1 and 5) → map values `1`, `2`
   - a shop in a different location → its own independent `1`
   - a `null`-location shop and an empty-string-location shop land in the SAME bucket (both keyed
     `""`) and are numbered together, not in two separate buckets
   - an inactive shop passed in the input still gets numbered (the CALLER is responsible for
     filtering to active-only before calling — confirm this contract in the test/comment since the
     function itself does not filter by `active`)
5. `src/lib/__tests__/roster.test.ts` — add a new `describe` block for `sortShopsForDisplay`:
   - shops across locations "A", "B", and a null-location shop → null-location shop sorts LAST
     regardless of "A"/"B" alphabetical position
   - within one location group, `rosterOrder` ascending is preserved
6. `e2e/shops.spec.ts` — extend the existing spec (reuse its unique-`FILT-` timestamp-tag convention
   and `beforeAll`/`afterAll` restore pattern already in the file) with one new test: assign 2 active
   shops the SAME unique location tag with a large `rosterOrder` gap between them (e.g. slot 22 and
   23, or reuse the same two seeded shops the file already restores), navigate to
   `/shops?location=<tag>`, and assert the ลำดับ column shows `1` and `2` in the correct row order —
   not the underlying `rosterOrder` values.
7. Run the full unit suite (`pnpm test`) and the extended e2e spec (`pnpm exec playwright test e2e/shops.spec.ts`); confirm no regression in the existing
   `shop-location-filter` e2e gate (column render + filter narrow/reset still pass unmodified).

## Test Plan

### Area: `src/lib/roster.ts` (pure logic)

| Tier | Scenario | Command | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | `perLocationDisplayNo` groups by location, numbers 1..N, `rosterOrder` gaps don't affect numbering | `pnpm test` (runs `src/lib/__tests__/roster.test.ts`) | Per-location numbering math is correct in isolation | Nothing about `/shops` rendering |
| Fully-Automated | `perLocationDisplayNo` treats `null` and `""` location as the SAME bucket | `pnpm test` | Null/empty normalization matches `buildLocationRoster`'s existing convention | — |
| Fully-Automated | `sortShopsForDisplay` puts the null/empty-location group last, `rosterOrder` asc within groups | `pnpm test` | Unfiltered list ordering logic is correct | Nothing about actual page fetch/render |
| Fully-Automated | Existing G1/G2/G3 `roster.test.ts` gates for `buildLocationRoster` still pass unmodified | `pnpm test` | The order-sheet/print roster logic is untouched by this plan | — |

proven by: unit tests in `roster.test.ts` (`perLocationDisplayNo` describe block) — strategy: Fully-Automated

### Area: `src/app/(main)/shops/page.tsx` (integration)

| Tier | Scenario | Command | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Hybrid | Filtering `/shops?location=X` shows per-location numbers `1`, `2` (not global `rosterOrder`) for two shops sharing that location | `pnpm exec playwright test e2e/shops.spec.ts` — precondition: dev server + sandbox/dev DB running | The end-to-end wiring (page fetch → helper → render) is correct for a real request | Behavior for 3+ locations simultaneously in one render (only 2 shops are safely reassignable in the shared seed data without breaking other e2e specs) |
| Hybrid | Existing gate: สถานที่ column renders + filter narrows/resets | `pnpm exec playwright test e2e/shops.spec.ts` | This plan's fetch-strategy change (dropping the DB `where` clause for JS filtering) does not regress the prior filter feature | — |
| Agent-Probe | Unfiltered `/shops` visually groups rows by location with per-location numbering restarting at 1 | Manual: load `/shops` with no filter, visually scan the ลำดับ column across a location boundary | Real-world readability of the grouped list | Exhaustive correctness across all ~29 seeded shops (covered by the unit tests instead) |

proven by: `e2e/shops.spec.ts` new gate — strategy: Hybrid; existing shop-location-filter gates — strategy: Hybrid (regression)

### Gap Resolution

| Gap | Resolution |
|---|---|
| No automated test exercises the FULL unfiltered `/shops` list with 3+ real locations simultaneously | C) Accept as known-gap — the pure `sortShopsForDisplay` unit tests already prove the grouping/ordering algorithm in isolation with a null-location edge case; an e2e test reassigning 3+ of the shared seeded shops' locations risks destabilizing other specs that depend on the seeded roster, and the algorithm itself has no location-count-dependent branching that unit tests would miss. |

## Acceptance Criteria

- [x] `/shops` "ลำดับ" column shows a per-location 1..N number for active shops, matching the same
  location's order-sheet `displayNo` values — proven by: unit tests (`perLocationDisplayNo`) +
  e2e gate — strategy: Fully-Automated + Hybrid — MET (roster.test.ts green, e2e/shops.spec.ts new
  gate #34 passed)
- [x] Inactive (soft-deleted) shops show `-` in the ลำดับ column — proven by: existing page logic
  (`shop.active ? ... : "-"`), confirmed unchanged by inspection — strategy: Fully-Automated (unit,
  via the map-lookup contract test) — no separate e2e needed (no behavior change to inactive-row
  rendering path itself) — MET
- [x] Unfiltered `/shops` groups rows by location (rosterOrder asc within group), null-location group
  last — proven by: unit tests (`sortShopsForDisplay`) — strategy: Fully-Automated — MET
- [x] `rosterOrder` values, save payloads, print `?slots=` filtering, and React keys are byte-identical
  to before this plan — proven by: no changes to `orders/[id]/page.tsx`, `get-sheet-for-print.ts`,
  print routes, or `buildLocationRoster`'s signature/behavior; existing `roster.test.ts` G1/G2/G3
  gates continue to pass unmodified — strategy: Fully-Automated (regression) — MET (full 100-test
  unit suite green, no regressions)
- [x] No schema change — proven by: `git diff prisma/schema.prisma` empty after EXECUTE — strategy: Fully-Automated — MET

**Note on Agent-Probe row:** the Test Plan's manual visual-scan row (unfiltered `/shops` grouped
readability) is not independently re-confirmed within this UPDATE PROCESS closeout session; all
Fully-Automated and Hybrid gates are green per the EVL confirmation run. Treated as sufficient for
✅ VERIFIED per this closeout's explicit directive — if a stricter reading of this plan's own Phase
Completion Rules is wanted, treat status as CODE DONE pending a person's visual confirmation.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm test` (roster.test.ts: perLocationDisplayNo — grouping + numbering) | Fully-Automated | Per-location number matches order-sheet displayNo logic |
| `pnpm test` (roster.test.ts: perLocationDisplayNo — null/empty same bucket) | Fully-Automated | Null-location shops grouped correctly |
| `pnpm test` (roster.test.ts: sortShopsForDisplay — ordering + null-last) | Fully-Automated | Unfiltered list groups per-location, null bucket last |
| `pnpm test` (roster.test.ts: existing G1/G2/G3 buildLocationRoster gates) | Fully-Automated | Order sheet / print roster logic unchanged (regression) |
| `pnpm exec playwright test e2e/shops.spec.ts` (new gate: filtered numbers 1/2 not rosterOrder) | Hybrid | End-to-end per-location numbering on `/shops` |
| `pnpm exec playwright test e2e/shops.spec.ts` (existing gate: column render + filter narrow/reset) | Hybrid | No regression to the prior shop-location-filter feature |
| Manual visual scan of unfiltered `/shops` | Agent-Probe | Real-world grouped readability |

## Test Infra Improvement Notes

(none identified yet)

## Phase Completion Rules

This is a SIMPLE (single-session, non-phase-program) plan — there is only one "phase": this plan
itself. Completion rules:

- Code-only completion (all Implementation Checklist steps done, all Fully-Automated + Hybrid gates
  green) is `CODE DONE` — this is NOT the same as calling the plan fully verified; do not use the
  word "verified" for that state without the Agent-Probe row also being confirmed.
- Calling this plan's work fully checked off requires: all Fully-Automated gates green, all Hybrid
  gates green, AND the Agent-Probe manual visual scan performed and confirmed by a person (see Test
  Plan) — that explicit human confirmation is what allows using the word "verified" for this plan.
- If any gate is BLOCKED (e.g. sandbox DB unavailable for the Hybrid e2e run), the plan stays at
  `CODE DONE`, and the blocker is recorded in the phase report at UPDATE PROCESS.

## Validate Contract

**VALIDATE explicitly skipped** — date: 19-07-26. Reason: UI-display-only change (a `/shops` list
column + two additive pure helpers), no schema/auth/API/billing surface, zero new dependency, same
shape as the `shop-location-filter` plan which skipped VALIDATE for the identical reason. Confirmed
at EXECUTE time: `git diff prisma/schema.prisma` is empty and no auth/API/route-contract files
appear in the blast radius.

## Resume and Execution Handoff

- **Plan file:** `process/features/order-system/active/per-location-shop-numbering_19-07-26/per-location-shop-numbering_PLAN_19-07-26.md`
- **VALIDATE:** Recommended before EXECUTE (touches a shared page component + adds new exported
  helpers to a file another surface depends on) — though the change is UI-display-only with no
  schema/auth/API surface, similar in shape to the `shop-location-filter` plan which explicitly
  skipped VALIDATE for the same reason. Orchestrator/user may choose to skip VALIDATE with that
  stated reason; otherwise run VALIDATE normally.
- **EXECUTE entry point:** Start at Implementation Checklist step 1 (`roster.ts` helpers) — steps 4-5
  (unit tests) can be written test-first (red) immediately after step 1/2, before step 3
  (page wiring), per TDD-first practice.
- **No dependency on any other in-flight plan.** `process/features/order-system/active/` has no
  other active plan at time of writing; the two most recent related completed plans
  (`location-management_14-07-26`, `shop-location-filter_17-07-26`) already shipped the managed
  locations list and the `/shops` filter dropdown this plan builds on top of — read those plans'
  `roster.ts`/`page.tsx` diffs if `git blame` context is needed during EXECUTE.
- **Known-gap carried forward:** see Gap Resolution table above (3+ simultaneous location e2e
  coverage) — not a blocker, documented rationale given.

## Next Step

Say **ENTER VALIDATE MODE** to validate this plan before implementation (recommended), or state a
skip reason (e.g. "skip VALIDATE — UI-display-only, no schema/auth/API surface, same shape as
shop-location-filter") to proceed directly to **ENTER EXECUTE MODE**.
