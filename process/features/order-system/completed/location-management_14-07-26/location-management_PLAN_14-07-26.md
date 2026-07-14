---
name: plan:location-management
description: "Add a /locations management page (create/rename/delete) backed by AppSetting; shop form + order-sheet form location fields become <select>s fed by the managed list"
date: 14-07-26
feature: order-system
---

# location-management — Implementation Plan (SIMPLE)

Date: 14-07-26
Status: ✅ VERIFIED AT CODE LEVEL (15-07-26) — all Fully-Automated/Hybrid gates green,
EVL-confirmed independently twice; adversarial code review (16-agent fan-out) found 0 high/security
issues and 3 correctness/UX findings, all fixed this session (rename-atomicity, delete-guard vs
soft-delete, duplicate-name feedback). User confirmation of live `/locations` UX on a real browser
is pending-manual (mirrors the `shop-location-roster` precedent). Archived via UPDATE PROCESS.
Complexity: SIMPLE

## Completion Note (15-07-26, UPDATE PROCESS)

- `pnpm test` — 92 passed/16 files (locations.test.ts +17, confirmed by direct re-run)
- `pnpm build` clean; `pnpm lint` clean
- `pnpm exec playwright test --list` — 47 total incl. `[setup]` (46 excl.), confirmed
- Adversarial review fixes landed: (A) rename cascade made atomic via `prisma.$transaction` with a
  graceful error path, (B) delete-guard now also blocks on soft-deleted shops referencing the
  location, (C) duplicate-name create now surfaces a Thai "มีชื่อนี้อยู่แล้ว" error instead of a
  silent normalize/no-op.
- Accepted known-gaps (unchanged from Validate Contract, still accepted): concurrent
  read-modify-write race on the `AppSetting` "locations" row (mirrors the existing `OrderSheet`
  date+location TOCTOU precedent); DB-backed helper test-coverage gaps (union-ordering,
  empty-list-no-reseed contract, malformed-JSON catch branch) — no backlog note required per this
  plan's own Known-Gap acceptance (same rationale class as the Validate Contract's accepted
  concurrent-rename-race row).
- Pending-manual: user sign-off on live `/locations` UX on a real sheet/browser.

Context: see `process/context/all-context.md` (root router) and
`process/context/database/all-database.md` / `process/context/uxui/all-uxui.md` for the AppSetting
pattern, roster contract, and pguard UI primitives this plan builds on. Testing context:
`process/context/tests/all-tests.md` (Vitest + Playwright wiring, tier conventions used below).

Locked decisions (from RESEARCH/user clarification — do NOT re-open): storage = existing
`AppSetting` key/value table (zero schema change), new dedicated route `/locations` in the
"ข้อมูลหลัก" sidebar group, access = both ADMIN+STAFF (`requireAuth()` no role arg, same as
shops/products), shop form's location `<Input>` → `<select>`, orders' new-sheet-form location
`<select>` sources the UNION of managed list ∪ distinct existing `Shop.location` values.

---

## Overview

Today `Shop.location` (สถานที่) is a free-text field typed independently on every shop-edit form,
and the daily order-sheet's location picker (`new-sheet-form.tsx`) only shows locations that
already exist on at least one shop (`orders/page.tsx`'s `distinct` query). There is no single
managed list, so staff can create near-duplicate location strings (typos, extra spaces after trim,
etc.) that silently fragment the roster (`buildLocationRoster` string-matches `location` exactly).

This plan adds ONE managed location list — stored as a JSON array under a single `AppSetting` row
(`key: "locations"`) — plus a new `/locations` page to create/rename/delete entries, and wires both
the shop form and the order-sheet form to source their location options from this managed list
(with the order-sheet form falling back to the union with any legacy free-text values still present
on shops, so no existing sheet-creation option silently disappears).

## Goals

1. One authoritative, editable list of locations (สถานที่), managed from a dedicated page.
2. Shop create/edit forms pick a location from that list instead of free-typing it.
3. New-sheet-form's location picker sources from the SAME managed list (unioned with any legacy
   shop-only values, for backward compatibility).
4. Renaming a location cascades to every `Shop.location` currently set to the old name.
5. Deleting a location in use by an active shop is blocked with a clear Thai error.
6. Zero schema change, zero new dependency, Thai UI / English identifiers, reuse `ui/*` primitives.

## Scope

**In scope:** `src/lib/locations.ts` (pure list transforms + DB read/write helpers), `/locations`
page + actions + client manager component, sidebar link, `shop-form.tsx` location field → select,
`new-sheet-form.tsx` union-sourced select, unit tests for the pure transforms, e2e gate(s) extending
`orders.spec.ts`.

**Out of scope:** no schema/migration change; no change to `Shop.location`'s type (stays
`String?`); no change to `roster.ts`'s string-match logic; no change to `shops/actions.ts`'s zod
validation shape (still validates a trimmed nullable string — the `<select>` just constrains what
value gets posted); no bulk-import/export of locations; no locale-aware Thai collation (exact
string equality only, matching the existing `roster.ts` contract).

---

## Touchpoints

| File | Change type | Reason |
|---|---|---|
| `src/lib/locations.ts` | NEW | Pure list-transform helpers + DB read/write wrappers around `AppSetting` |
| `src/lib/__tests__/locations.test.ts` | NEW | Fully-automated unit tests for the pure transforms |
| `src/app/(main)/locations/page.tsx` | NEW | Server page: list locations, requireAuth (both roles), force-dynamic |
| `src/app/(main)/locations/actions.ts` | NEW | Server actions: createLocation / renameLocation / deleteLocation |
| `src/app/(main)/locations/locations-manager.tsx` | NEW | Client component: add/rename/delete UI, confirm-before-destroy modal |
| `src/app/nav-links.tsx` | EDIT | Add "จัดการสถานที่" menu item to "ข้อมูลหลัก" group |
| `src/app/(main)/shops/shop-form.tsx` | EDIT | Location `<Input>` → `<select>`; add `locations: string[]` prop |
| `src/app/(main)/shops/new/page.tsx` | EDIT | Fetch effective location options, pass to `ShopForm`; **VALIDATE finding — also add `export const dynamic = "force-dynamic"`** (this route has no dynamic directive today, unlike `shops/page.tsx` and `shops/[id]/edit/page.tsx` which already have it; without it `next build` can statically bake in the location list at build time) |
| `src/app/(main)/shops/[id]/edit/page.tsx` | EDIT | Fetch effective location options, pass to `ShopForm` |
| `src/app/(main)/orders/new-sheet-form.tsx` | NO CHANGE (prop contract already `locations: string[]`) | Already a `<select>` fed by a `locations` prop — only the CALLER changes |
| `src/app/(main)/orders/page.tsx` | EDIT | Replace the `distinct` shop-location query with `getEffectiveLocationOptions()` |

Note: `new-sheet-form.tsx` itself needs **no edit** — it already renders a `<select>` driven by a
`locations: string[]` prop (see RESEARCH read of the file). Only its caller (`orders/page.tsx`)
changes what list it passes in. This narrows the blast radius vs. the original brief.

## Public Contracts

- `src/lib/locations.ts` exports:
  - `LOCATIONS_KEY = "locations"` (the `AppSetting.key` value)
  - `getManagedLocations(): Promise<string[]>` — reads + lazy-seeds if the key is absent
  - `setManagedLocations(list: string[]): Promise<void>` — normalizes + upserts JSON
  - `addLocation(list: string[], name: string): string[]` — PURE
  - `renameLocation(list: string[], oldName: string, newName: string): string[]` — PURE
  - `removeLocation(list: string[], name: string): string[]` — PURE
  - `normalizeLocations(list: string[]): string[]` — PURE (trim, drop empty, dedupe exact-match, preserve order)
  - `getEffectiveLocationOptions(): Promise<string[]>` — managed list ∪ distinct active-shop
    `location` values not already in the managed list, appended in `location asc` order after the
    managed list
- `src/app/(main)/locations/actions.ts` exports `createLocation`, `renameLocation`,
  `deleteLocation` — all `(prev, formData) => Promise<{ error?: string }>` shape, matching the
  existing `ShopActionState`/`OrderSheetActionState` convention.
- No changes to any existing exported function signature (`shops/actions.ts`, `roster.ts`,
  `app-settings.ts` are untouched).

## Blast Radius

- **DB:** zero schema change. One new `AppSetting` row (`key: "locations"`) will be created at
  runtime on first use — no migration needed (same pattern as `placeName`/`recorderName` etc. in
  `app-settings.ts`).
- **Auth surface:** none. Reuses `requireAuth()`/`requireAuthState()` exactly as shops/products do
  (no role arg → ADMIN + STAFF both allowed).
- **Existing behavior preserved:** `Shop.location` stays `String?`; `roster.ts`'s exact
  string-match (`s.location === loc`) is completely unchanged — this plan only changes WHERE the
  string value comes from (a managed list) and adds a rename-cascade so existing shops track a
  renamed location automatically.
- **Files with NO changes:** `src/lib/roster.ts`, `src/lib/app-settings.ts` (pattern is followed,
  not modified), `src/app/(main)/shops/actions.ts` zod schema (unchanged — still validates a
  trimmed nullable string ≤200 chars; the `<select>` merely constrains which string gets posted),
  `src/app/(main)/orders/new-sheet-form.tsx` (prop contract already correct), `prisma/schema.prisma`.

---

## Design Decisions (finalized this session)

1. **Seeding location**: `getManagedLocations()` lazy-seeds on first read when the `AppSetting` row
   is absent — it queries `distinct` active, non-null `Shop.location` values, normalizes them, and
   `setManagedLocations()`s the result before returning it. This happens INSIDE
   `getManagedLocations()` itself (not the page), so every caller (`/locations` page,
   `getEffectiveLocationOptions()`) benefits uniformly and seeding never re-runs once the key
   exists (idempotent — first non-empty read wins; presence is checked by row EXISTENCE, not by
   array contents, so an empty-but-present `"[]"` value does NOT re-trigger seeding — VALIDATE
   confirmed this against the `findUnique`-absent-vs-present branch in checklist item 1).
2. **Ordering in `getEffectiveLocationOptions()`**: managed list first (insertion order as stored),
   then any shop-only extra values not already in the managed list, appended sorted `asc`. This
   keeps the primary list stable (user-controlled order) while surfacing legacy stragglers at the
   end rather than interleaving them.
3. **Rename cascade**: `renameLocationAction` (server action) calls `prisma.shop.updateMany({
   where: { location: oldName }, data: { location: newName } })` in the SAME operation as updating
   the managed list (both awaited before `revalidatePath`), so a page reload never shows a
   transient mismatch. `revalidatePath("/locations")`, `revalidatePath("/shops")`,
   `revalidatePath("/orders")`.
4. **Delete policy**: `deleteLocationAction` first counts
   `prisma.shop.count({ where: { location: name, active: true } })`. If count > 0, return
   `{ error: \`ยังมีร้านค้าใช้สถานที่นี้อยู่ (${count} ร้าน) — ย้ายก่อนลบ\` }` and do NOT touch the
   managed list. If count === 0, remove the name from the managed list via `removeLocation()` +
   `setManagedLocations()`, `revalidatePath("/locations")`.
5. **Dedup/normalization**: case-sensitive EXACT match only (no locale folding) — mirrors
   `roster.ts`'s `s.location === loc` contract exactly, so the managed list's notion of "same
   location" never diverges from the roster filter's notion.
6. **Confirm-before-destroy**: `locations-manager.tsx` reuses the `ui/modal.tsx` + `danger-ghost`
   `Button` pattern from `delete-sheet-button.tsx` verbatim (open/close local state,
   `useActionState` per action, error surfaced inside the modal).
7. **List UI shape**: single client component with 3 inline states — add-new (name input + submit),
   per-row rename (inline edit toggle + submit), per-row delete (opens confirm modal). Visual style
   matches `/shops` list — a simple table/list with rows, using the same `ui/input.tsx` /
   `ui/button.tsx` / `ui/card.tsx` primitives, `--text`/`--text-muted`/`--danger` tokens.

---

## Acceptance Criteria

1. `/locations` page exists, is reachable from the "ข้อมูลหลัก" sidebar group, and is visible to
   both ADMIN and STAFF.
2. A new location can be created on `/locations` and immediately appears as an option in both the
   shop-form `<select>` and the new-sheet-form `<select>`.
3. Renaming a location on `/locations` updates every `Shop.location` currently equal to the old
   name to the new name (verified via a shop lookup after rename).
4. Deleting a location still referenced by ≥1 active shop is blocked with a Thai error message
   naming the shop count; the managed list is unchanged after the blocked attempt.
5. Deleting an unused location succeeds and removes it from both `/locations` and the shop-form
   `<select>`.
6. `Shop.location` remains `String?` — no schema/migration change lands with this plan.
7. All existing regression suites (`pnpm test`, `pnpm build`, `pnpm lint`,
   `pnpm exec playwright test`) stay green after this plan's changes.

## Phase Completion Rules

This is a SIMPLE, single-plan (non-phase-program) change — "VERIFIED" for this plan requires:

- All Fully-Automated tiers green (`pnpm test`, `pnpm build`, `pnpm lint`).
- All Hybrid tiers green (new/extended Playwright gate covering create → select-wiring →
  rename-cascade → delete-blocked → delete-succeeds).
- The Agent-Probe visual-consistency check performed at least once during EXECUTE/EVL.
- Do NOT mark this plan VERIFIED on code-completion alone ("CODE DONE") without the above
  gates actually having been run and recorded with their command + outcome, per this repo's
  historical convention (see `shop-location-roster` plan precedent in `all-context.md`).

## Implementation Checklist

1. **`src/lib/locations.ts`** — create with:
   - `LOCATIONS_KEY = "locations"` constant
   - `normalizeLocations(list: string[]): string[]` — trim each, filter out empties, dedupe
     (case-sensitive, first occurrence wins), preserve insertion order
   - `addLocation(list, name)` → `normalizeLocations([...list, name])`
   - `renameLocation(list, oldName, newName)` → map `oldName` → `newName` across the list, then
     `normalizeLocations(...)` the result (handles a rename that collides with an existing entry)
   - `removeLocation(list, name)` → `list.filter(l => l !== name)`
   - `getManagedLocations(): Promise<string[]>` — `prisma.appSetting.findUnique({ where: { key: LOCATIONS_KEY } })`;
     if absent, seed from `prisma.shop.findMany({ where: { active: true, location: { not: null } }, distinct: ["location"], select: { location: true } })`
     → normalize → `setManagedLocations(seeded)` → return `seeded`; if present, `JSON.parse` with a
     try/catch fallback to `[]` on malformed JSON
   - `setManagedLocations(list: string[]): Promise<void>` — `normalizeLocations(list)` then
     `prisma.appSetting.upsert({ where: { key: LOCATIONS_KEY }, create: {...}, update: {...} })`
     with `JSON.stringify(normalized)`
   - `getEffectiveLocationOptions(): Promise<string[]>` — `managed = await getManagedLocations()`;
     `extra = await prisma.shop.findMany({ where: { active: true, location: { not: null } }, distinct: ["location"], select: { location: true }, orderBy: { location: "asc" } })`
     filtered to values NOT already in `managed`; return `[...managed, ...extraNotInManaged]`

2. **`src/lib/__tests__/locations.test.ts`** — RED-first TDD unit tests for the 4 pure functions:
   `normalizeLocations` (trim/dedupe/drop-empty/preserve-order), `addLocation`,
   `renameLocation` (incl. rename-that-collides-with-existing-entry case), `removeLocation`. No DB
   mocking needed — pure functions only.

3. **`src/app/(main)/locations/actions.ts`** — server actions:
   - `createLocationAction(prev, formData)` — `requireAuthState()` guard (no role), zod
     `z.string().trim().min(1, "กรุณากรอกชื่อสถานที่").max(200, "ชื่อสถานที่ยาวเกินไป")`, read
     current list via `getManagedLocations()`, `addLocation()`, `setManagedLocations()`,
     `revalidatePath("/locations")`, return `{}` on success (no redirect — stay on page)
   - `renameLocationAction(oldName, prev, formData)` — same guard + zod for `newName`; read list,
     `renameLocation(list, oldName, newName)`, `setManagedLocations()`, THEN
     `prisma.shop.updateMany({ where: { location: oldName }, data: { location: newName } })`;
     `revalidatePath("/locations")`, `revalidatePath("/shops")`, `revalidatePath("/orders")`
   - `deleteLocationAction(name, prev, formData)` — guard, count active shops at `name`; if >0
     return Thai error; else `removeLocation` + `setManagedLocations` + `revalidatePath("/locations")`

4. **`src/app/(main)/locations/locations-manager.tsx`** (client) — mirrors `delete-sheet-button.tsx`'s
   confirm-modal pattern: an add-form (`Input` + primary `Button`), a list of rows each with an
   inline rename toggle (`Input` + secondary `Button` "บันทึก"/"ยกเลิก") and a delete `Button`
   (`danger-ghost`, opens `Modal` confirm, submits `deleteLocationAction` bound to that name via a
   server-action closure passed from the page, same bind pattern as `edit/page.tsx`'s `boundUpdate`).
   **VALIDATE finding — implement each row as its OWN small subcomponent (e.g. `LocationRow`,
   rendered once per entry via `.map()`), each with its own `useActionState` call** — mirroring the
   already-proven `DeleteSheetButton`-per-sheet-row pattern in `orders/page.tsx`. A single component
   cannot call `useActionState` a variable number of times inside a loop (violates React's Rules of
   Hooks for a dynamic-length list).

5. **`src/app/(main)/locations/page.tsx`** — server, `force-dynamic`, `await requireAuth()` (no
   role arg), `const locations = await getManagedLocations()`, render page title "จัดการสถานที่" +
   `<LocationsManager locations={locations} />`.

6. **`src/app/nav-links.tsx`** — add `{ href: "/locations", label: "จัดการสถานที่", icon: MapPin }`
   to the `"ข้อมูลหลัก"` group's `items` array (between `/shops` and `/products` — matches the
   brief's "next to จัดการร้านค้า/จัดการสินค้า"), import `MapPin` from `lucide-react`. No
   `adminOnly` flag (both roles see it, matching decision 3).

7. **`src/app/(main)/shops/shop-form.tsx`** — add `locations?: string[]` prop; replace the
   location `<Input>` with a `<select name="location">` offering `<option value="">ไม่ระบุ</option>`
   plus one `<option>` per entry in `locations` (and, defensively, the shop's CURRENT
   `defaultValues.location` as a fallback option if it is non-null and not already present in
   `locations` — so an existing shop whose location was deleted from the managed list still shows
   its current value instead of silently resetting). Keep the same `name="location"` attribute so
   `shopSchema` in `actions.ts` needs zero change.

8. **`src/app/(main)/shops/new/page.tsx`** — add `export const dynamic = "force-dynamic";`
   (VALIDATE finding: this route has no dynamic directive today, unlike `shops/page.tsx` and
   `shops/[id]/edit/page.tsx` which already have it; without it `next build` can statically bake in
   the location list at build time and new locations would never appear on this page); then
   `const locations = await getEffectiveLocationOptions()`; pass `locations={locations}` to
   `<ShopForm>`.

9. **`src/app/(main)/shops/[id]/edit/page.tsx`** — same: fetch `getEffectiveLocationOptions()`,
   pass to `<ShopForm>`.

10. **`src/app/(main)/orders/page.tsx`** — replace the current `prisma.shop.findMany({ distinct:
    ["location"] ... })` block with `const locations = await getEffectiveLocationOptions();`
    (drop the now-redundant inline query + filter/map). `<NewSheetForm locations={locations} />`
    call site is UNCHANGED (same prop shape: `string[]`).

11. **e2e gate** — extend `e2e/orders.spec.ts` (or add a new small spec) with a gate proving the
    full loop: create a location via `/locations` → appears as an option in the shop-form select →
    create/edit a shop selecting it → rename the location on `/locations` → the shop's location
    value follows the rename (re-fetch shop, assert new name) → attempt delete while still in use
    → Thai error surfaces → unassign the shop (set to a different/blank location) → delete
    succeeds. Use a unique location name per test run (timestamp/random suffix) for isolation,
    matching the existing `dropByDate` isolation convention (see `orders.spec.ts` G4/G5).
    **VALIDATE finding — add a best-effort `afterAll`/`afterEach` that removes the test location
    name from the managed list even if an earlier assertion throws mid-test** (mirrors
    `dropByDate`'s always-run teardown for sheets) — the happy-path flow already ends in delete,
    but a failed assertion partway through would otherwise leak a test-only location into the
    managed list.

12. **Run the full regression suite** (`pnpm test`, `pnpm build`, `pnpm lint`,
    `pnpm exec playwright test`) before calling EXECUTE done.

---

## Test Plan (tiers)

| Tier | Scenario | Command | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-automated | `normalizeLocations` trims/dedupes/drops-empty/preserves-order | `pnpm test -- locations.test.ts` | Pure transform correctness | DB persistence |
| Fully-automated | `addLocation` appends + normalizes | `pnpm test -- locations.test.ts` | Add-then-normalize composition | DB persistence |
| Fully-automated | `renameLocation` maps old→new incl. collision-with-existing case | `pnpm test -- locations.test.ts` | Rename semantics, no duplicate entries after rename-into-existing | Cascade to `Shop.location` (DB) |
| Fully-automated | `removeLocation` filters exact match | `pnpm test -- locations.test.ts` | Remove semantics | Delete-blocked-when-in-use policy (DB) |
| Fully-automated | `pnpm build` + `pnpm lint` | `pnpm build && pnpm lint` | No TS/type errors, no lint regressions across all edited/new files | Runtime DB behavior |
| Hybrid | full create→shop-select→rename-cascade→delete-blocked→delete-succeeds loop (sandbox DB + Playwright) | `pnpm exec playwright test` (new/extended spec) | End-to-end managed-list ↔ shop ↔ order-sheet wiring, rename cascade, delete-in-use guard | Real customer DB behavior (sandbox only) |
| Agent-probe | `/locations` page visual/UX check matches `/shops` list styling; Thai copy readability | Manual review during EXECUTE/EVL | Visual consistency with existing pguard design system | Cross-browser pixel-exact rendering |
| Known-gap | Concurrent rename/delete race (two staff editing locations simultaneously) | — | — | Low-probability, single-admin-typical usage; matches the project's existing accepted TOCTOU pattern (see `order-sheet-dup-index_NOTE`) |

Known-gap rationale: this mirrors the already-accepted `OrderSheet` date+location TOCTOU gap in
this codebase (no DB unique constraint backing the check) — same acceptance logic applies here,
and locations management is a low-frequency admin operation.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm test -- locations.test.ts` all green | Fully-Automated | Pure list-transform correctness (Goal 1) |
| `pnpm build && pnpm lint` clean | Fully-Automated | No regressions across all touched files (Goals 1-4) |
| Playwright: create location → shop-form select shows it | Hybrid | Goal 2 (shop form sources managed list) |
| Playwright: rename location → shop's `location` field follows | Hybrid | Goal 4 (rename cascade) |
| Playwright: delete location in-use → Thai error, list unchanged | Hybrid | Goal 5 (delete-in-use blocked) |
| Playwright: new-sheet-form select includes managed + legacy union | Hybrid | Goal 3 (union sourcing, backward compat) |
| Agent-probe: `/locations` page visual review vs `/shops` styling | Agent-Probe | Design-system consistency (constraint 6) |

---

## Validate Contract

Status: PASS
Date: 14-07-26
date: 2026-07-14
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: 7-signal score 1/7 (only S7 — 8-file blast radius — present; no multi-package scope, no
schema/API/auth surface, single plan not a phase program, no user-requested depth, no high-risk
class). Single-package SIMPLE plan → sequential VALIDATE fan-out (one vc-validate-agent) is correct,
matching the plan's own resume-note expectation.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-transform-1 | `normalizeLocations` trims/dedupes/drops-empty/preserves order | Fully-Automated | `pnpm test -- locations.test.ts` | A |
| AC-transform-2 | `addLocation` appends then normalizes | Fully-Automated | `pnpm test -- locations.test.ts` | A |
| AC-transform-3 | `renameLocation` maps old→new incl. collision-with-existing-entry | Fully-Automated | `pnpm test -- locations.test.ts` | A |
| AC-transform-4 | `removeLocation` filters exact match | Fully-Automated | `pnpm test -- locations.test.ts` | A |
| AC-regression | No TS/type errors, no lint regressions across all touched files | Fully-Automated | `pnpm build && pnpm lint` | A |
| AC2 | Shop-form select sources managed list; new location appears immediately | Hybrid | `pnpm exec playwright test` (extended `e2e/orders.spec.ts` gate; precondition: sandbox SQL Server running + seeded ADMIN/STAFF storage-state fixtures) | A |
| AC3 | Renaming a location cascades to every `Shop.location` currently set to the old name | Hybrid | same Playwright gate | A |
| AC4 | Deleting a location in use by an active shop is blocked with a Thai error naming the shop count | Hybrid | same Playwright gate | A |
| AC2b | new-sheet-form select sources managed ∪ legacy union | Hybrid | same Playwright gate | A |
| Design-6 | `/locations` page visual/UX consistency with `/shops` list styling; Thai copy readability | Agent-Probe | Manual review during EXECUTE/EVL | A |
| — | Concurrent rename/delete race (two staff editing simultaneously) | — | — | D — named residual, no strategy proves it; see Known Gaps below |

gap-resolution legend: A — proven now; B — fixed in this plan (gate added by checklist); C —
deferred to a named later phase/plan; D — backlog test-building stub (named residual).

C-4 reconciliation: all rows above use only the 3 proving strategies (Fully-Automated / Hybrid /
Agent-Probe); the one Known-Gap row carries gap-resolution D and is a residual, not a strategy.

Legacy line form (retained for existing consumers):
- locations pure transforms: [Fully-automated: `pnpm test -- locations.test.ts`]
- build/lint regression: [Fully-automated: `pnpm build && pnpm lint`]
- managed-list ↔ shop ↔ order-sheet wiring, rename cascade, delete-in-use guard: [hybrid: `pnpm exec playwright test` — precondition: sandbox SQL Server container running, ADMIN/STAFF storage-state fixtures present at `e2e/.auth/*.json`]
- `/locations` visual consistency: [agent-probe: manual review vs `/shops` styling during EXECUTE/EVL]
- concurrent rename/delete race: [known-gap: documented — mirrors accepted `OrderSheet` date+location TOCTOU pattern]

Dimension findings:
- Infra fit: PASS — zero schema/migration change; `AppSetting.value` is `@db.NVarChar(Max)`
  (`prisma/schema.prisma:176`), confirmed to safely hold the JSON-stringified array; the
  JSON.parse-with-try/catch fallback to `[]` on malformed data is sound; no container/port/proxy
  surface touched.
- Test coverage: PASS — pure-transform unit tests are genuinely DB-free (matches the existing
  `roster.test.ts` pattern, confirmed same directory `src/lib/__tests__/`); e2e isolation via a
  unique location name per run is consistent with `orders.spec.ts`'s existing `dropByDate`
  convention; all 4 stated commands are real, confirmed-runnable `package.json` scripts (`test` →
  `vitest run`, `build` → `next build`, `lint` → `eslint`, plus `pnpm exec playwright test` /
  `test:e2e` → `playwright test`).
- Breaking changes: PASS — `shopSchema` in `shops/actions.ts` is unchanged and still receives a
  plain string via `formData.get("location")` regardless of `<input>` vs `<select>`; confirmed no
  existing e2e selector targets the shop-form's location field (only `new-sheet-form`'s
  `select[name="location"]` is referenced, in `orders.spec.ts` and `mobile.spec.ts`);
  `new-sheet-form.tsx` genuinely needs zero edit (confirmed already a `<select>` on a
  `locations: string[]` prop by direct file read); `roster.ts`, `app-settings.ts`,
  `prisma/schema.prisma` confirmed untouched.
- Security surface: PASS — reuses `requireAuthState()`/`requireAuth()` exactly as
  `shops/actions.ts` (no new auth surface, no role-arg change); all writes go through parameterized
  Prisma calls; no secret/credential handling; STRIDE quick-pass finds no new trust boundary (both
  ADMIN+STAFF already share this exact access level on `/shops`/`/products`).
- Section — Rename cascade (Design Decision 3): PASS — `prisma.shop.updateMany({ where: { location:
  oldName }, data: { location: newName } })` matches the real field name/type
  (`Shop.location String? @db.NVarChar(200)`, `prisma/schema.prisma:49`) exactly; `revalidatePath`
  targets (`/locations`, `/shops`, `/orders`) are the correct route segments.
- Section — Delete-in-use guard (Design Decision 4): PASS — `prisma.shop.count({ where: { location:
  name, active: true } })` is a correct, mechanically sound block-check; TOCTOU gap is explicitly
  accepted and consistently rationalized against the existing `OrderSheet` date+location precedent.
- Section — Caching/dynamic-rendering fit: CONCERN → RESOLVED IN PLAN — `shops/new/page.tsx` had no
  `export const dynamic = "force-dynamic"` directive (confirmed via grep: `shops/page.tsx` and
  `shops/[id]/edit/page.tsx` already have it, `shops/new/page.tsx` did not), even though this plan
  gives it a new Prisma-backed data fetch; without it, `next build` risks statically baking in the
  location list at build time. **Fixed in plan**: Implementation Checklist item 8 now explicitly
  adds the directive.
- Section — Per-row client state (`locations-manager.tsx`, Design Decisions 6/7): CONCERN →
  RESOLVED IN PLAN — a single component cannot legally call `useActionState` a variable number of
  times inside a `.map()` loop (violates React's Rules of Hooks for a dynamic-length list). **Fixed
  in plan**: Implementation Checklist item 4 now specifies a per-row subcomponent, mirroring the
  already-proven `DeleteSheetButton`-per-sheet-row pattern in `orders/page.tsx`.
- Section — E2E test data hygiene (checklist item 11): CONCERN → RESOLVED IN PLAN — the happy-path
  e2e flow self-cleans (its last step deletes the test location), but a mid-test assertion failure
  could leave a stray test location in the managed list. **Fixed in plan**: item 11 now calls for a
  best-effort `afterAll`/`afterEach` teardown, mirroring `dropByDate`'s always-run pattern.

Open gaps: none blocking. One named residual carried forward — concurrent rename/delete race
(known-gap, rationale in Test Plan table; matches the already-accepted `OrderSheet` TOCTOU
precedent; no backlog note needed per the plan's own explicit acceptance).

What this coverage does NOT prove:
- `pnpm test -- locations.test.ts`: does NOT prove DB persistence, seeding behavior, or the rename
  cascade against real `Shop` rows (pure-function tests only, no DB involved).
- `pnpm build && pnpm lint`: does NOT prove runtime DB behavior or UI correctness — type/lint-clean
  only.
- The Playwright hybrid gate: runs only against the sandbox SQL Server (Docker) — does NOT prove
  behavior against the production `db_TCL` shared ERP database, and does NOT prove concurrent
  multi-staff edit behavior (accepted known-gap).
- The Agent-Probe visual review: does NOT prove cross-browser pixel-exact rendering or on-site
  real-printer fidelity (not applicable here — no print surface is touched by this plan).

Execute-agent instructions:
- E1: Add `export const dynamic = "force-dynamic";` to `shops/new/page.tsx` (now explicit in
  Implementation Checklist item 8) — do not skip even though it was absent from the original
  Touchpoints reason text.
- E2: Implement `locations-manager.tsx` rows as a per-row subcomponent (e.g. `LocationRow`), each
  with its own `useActionState` call — do not attempt a single component managing a variable number
  of hook calls in a loop.
- E3: Give the new e2e gate a best-effort `afterAll`/`afterEach` teardown for the test-created
  location, in addition to the happy-path delete step.
- E4: Run the full regression suite (`pnpm test`, `pnpm build`, `pnpm lint`,
  `pnpm exec playwright test`) before reporting EXECUTE done — per the plan's own Phase Completion
  Rules; do not mark this plan VERIFIED on code-completion alone.

Accepted by: N/A — Gate: PASS (all findings resolved via in-plan fixes above; no unresolved
concerns require user acceptance).

Gate: PASS

## Autonomous Goal Block

SESSION GOAL: Ship the `/locations` managed-list feature — one authoritative, editable list of
สถานที่ values backing the shop-form and order-sheet location pickers, with rename-cascade and
delete-in-use protection.
Charter + umbrella plan: N/A — single plan (order-system feature, not a phase program)
Autonomy: standard /goal autonomy rules apply — CONDITIONAL findings auto-apply, BLOCKED items go
to backlog and execution continues, irreversible/outward-facing actions without explicit contract
instruction are a hard stop (see `process/development-protocols/autopilot.md` and
`orchestration.md` §Autonomy Mode).
Hard stop conditions / safety constraints:
- No schema/migration change may be introduced — `Shop.location` stays `String?`; any deviation is a hard stop.
- Never touch `prisma/schema.prisma`, `roster.ts`'s string-match logic, or `shops/actions.ts`'s zod shape.
- Both ADMIN and STAFF must retain access to `/locations` — do not add a role gate.
- Full regression suite (`pnpm test`, `pnpm build`, `pnpm lint`, `pnpm exec playwright test`) must be green before EXECUTE is reported done.
Next phase: EXECUTE: process/features/order-system/active/location-management_14-07-26/location-management_PLAN_14-07-26.md
Validate contract: inline in plan (`## Validate Contract` section, this file)
Execute start: `pnpm test -- locations.test.ts` (red-first) | e2e: extended `e2e/orders.spec.ts` gate | Agent-Probe: `/locations` visual review vs `/shops` | high-risk pack: no

## Test Infra Improvement Notes

(none identified yet)

---

## Resume and Execution Handoff

- **Selected plan file**: this file
  (`process/features/order-system/active/location-management_14-07-26/location-management_PLAN_14-07-26.md`)
- **Feature**: `order-system`
- **No schema/migration change** — safe to EXECUTE without any DB delivery-script coordination.
- **Order of implementation**: `locations.ts` → its unit tests (red-first) → `locations/actions.ts`
  → `locations-manager.tsx` → `locations/page.tsx` → `nav-links.tsx` → `shop-form.tsx` +
  `shops/new/page.tsx` + `shops/[id]/edit/page.tsx` → `orders/page.tsx` → e2e gate → full
  regression suite.
- **If EXECUTE is interrupted**: check which of steps 1-11 in the Implementation Checklist have
  landed (grep for `src/lib/locations.ts` existence, then `/locations/` route files, then the
  `shop-form.tsx` `<select name="location">` presence) to resume at the right step.
- **Skip conditions used**: none — full VALIDATE was run (this section). Gate: PASS.

**Next Step (RIPER-5):** say **ENTER EXECUTE MODE** to proceed to implementation.
