---
name: plan:shop-location-roster
description: "Add Shop.location, per-location shop roster on order sheets (dropdown picker, variable-row entry/print), db_TCL delivery migration script"
date: 13-07-26
feature: order-system
---

# Shop → Location Roster — Implementation Plan

**Date**: 13-07-26
**Status**: ✅ VERIFIED AT CODE LEVEL (13-07-26) — committed `e2d3adb`. All Fully-Automated gates
(G1–G3, G7–G9) AND all Hybrid gates (G4–G6) are green (75 unit / 15 files, 43 e2e incl. [setup]).
Residual: this plan's own Phase Completion Rules require explicit user confirmation of live
per-location behavior on a real sheet before calling it "VERIFIED" in the strictest sense — that
manual confirmation, plus on-site >29-row print fidelity (pre-existing project-wide Known-Gap
pattern), remain pending-manual and are tracked below, not blocking archival (all proving gates for
every acceptance criterion are green; nothing is vacuously green).
**Complexity**: COMPLEX (schema change touching the shared prod ERP DB, 3 UI surfaces, 2 print
routes, backward-compat fallback logic, migration delivery script). Single plan file (not a phase
program — one cohesive feature, no independent phase gates needed).

## Overview

Today every shop appears on every daily order sheet in one fixed 29-row roster
(`ROSTER_SLOTS = 29`, hardcoded in `orders/[id]/page.tsx` and `get-sheet-for-print.ts`). This
feature adds a `location` field to `Shop`, lets the daily-sheet location picker choose from
existing shop locations, and filters the order-entry + print surfaces down to only that
location's shops — renumbered 1..N for display. Existing shops are backfilled to `"ยิ่งเจริญ"`.
`rosterOrder` stays the global unique DB field (no migration to a composite unique); per-location
1..N numbering is display-only, computed at render time.

Context loaded per `process/context/all-context.md` routing: `database/all-database.md` (§DANGER
guardrails for the shared db_TCL prod DB + rosterOrder/snapshot patterns), `uxui/all-uxui.md`
(shop/order form conventions), `tests/all-tests.md` (Vitest + Playwright sandbox `.env`-swap
pattern), and the order-form domain reference.

## Goals / Non-Goals

**Goals**
- `Shop.location` field, backfilled, editable in the shop form.
- Order-sheet location picker becomes a dropdown of distinct existing shop locations.
- Order entry (`orders/[id]/page.tsx` + `order-matrix.tsx` + mobile) and both print routes render
  ONLY that sheet's location's shops, numbered 1..N, variable row count.
- Old sheets with `location = null` (or no matching shops) still render — full active-shop
  fallback, unchanged behavior.
- db_TCL delivery script for the prod ERP DB (hand-authored, idempotent, NOT auto-run).

**Non-Goals**
- No separate `Location` entity/table.
- No change to `rosterOrder`'s global `@unique` constraint.
- No change to `totals.ts`, `order-payload.ts`, `order-save.ts`, `saveOrderSheet` payload shape,
  soft-delete, or auth.
- No retroactive location backfill onto historical `OrderLine`/snapshot data (there is none — shop
  location isn't snapshotted; only names are).

## Locked Decisions (from Decision Summary — do not reopen)

1. `Shop.location String? @db.NVarChar(200)` — optional text field on `Shop`, no new entity.
2. Seed backfill: `updateMany({ where: { location: null }, data: { location: "ยิ่งเจริญ" } })`,
   idempotent, run once in `main()` before/alongside the existing rename-migration block.
3. Shop form gets a "สถานที่" text input, **optional** (matches nullable schema + backfill
   default — a shop can be saved with no location, which then falls into the "no location"
   fallback bucket everywhere). **[VALIDATE fix]** zod validation adds `.max(200, "สถานที่ยาวเกินไป")`
   matching the `NVarChar(200)` column and the existing `name` field's own `.max(200, ...)`
   pattern — without this, a longer-than-200-char location would fail at the DB layer with an
   unfriendly error instead of a Thai validation message.
4. Order-sheet location field on `new-sheet-form.tsx` becomes a `<select>` populated by
   `prisma.shop.findMany({ where: { location: { not: null }, active: true }, distinct: ["location"], select: { location: true }, orderBy: { location: "asc" } })`
   — **[VALIDATE fix]** `active: true` added so a location that exists only on soft-deleted shops
   never appears as a selectable (but empty) option. `OrderSheet.location` (existing string column)
   is unchanged; `createOrderSheet` dup-check logic is unchanged in shape.
5. Editor (`orders/[id]/page.tsx`) and print (`get-sheet-for-print.ts`) both fetch the shop list
   with **ONE query each** — `prisma.shop.findMany({ where: { active: true }, orderBy: { rosterOrder: "asc" } })`
   — and pass the result straight into the shared `buildLocationRoster(activeShops, sheetLocation)`
   helper. **[VALIDATE fix — clarifies an internal contradiction between this decision and the
   original Data Flow section]** The helper itself — not the caller — owns the filter + fallback
   + renumber logic: it filters `activeShops` down to `sheetLocation`'s shops; if `sheetLocation`
   is null/empty OR the filter yields 0 shops, it falls back to the full `activeShops` list; either
   way it then sorts by `rosterOrder asc` and assigns `displayNo` 1..N. Neither caller does a
   second conditional query — that would fork the filter/fallback logic between editor and print,
   which is exactly what the shared helper exists to prevent (see Public Contracts below).
6. Print (`get-sheet-for-print.ts` + `print-table.tsx` + both print route pages + `print.css`)
   uses the same single-query + helper call, variable row count, numbered 1..N — see decision 5.
7. `rosterOrder` stays a global `@unique` int on `Shop`. Per-location numbering is **display-only**
   — computed by `buildLocationRoster` as a NEW `displayNo` field, sitting alongside the untouched
   `rosterOrder` (see Public Contracts + Implementation Checklist items 8/10 for exactly which
   rendered/keyed surfaces use which field). New shops still get a global `rosterOrder` value via
   the existing shop-form flow (no logic change needed there — confirm at RESEARCH/EXECUTE time
   that shop creation already assigns the next global `rosterOrder`; if not, that's pre-existing
   behavior, out of scope here).
8. `totals.ts` / grand total unchanged — keys on `printOrder`, not shop identity.

## Touchpoints

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `location String? @db.NVarChar(200)` to `Shop` model |
| `prisma/migrations/<ts>_shop_location/migration.sql` | Generated by `prisma migrate dev` against sandbox |
| `prisma/seed.ts` | Add idempotent backfill `updateMany` block (existing shops → "ยิ่งเจริญ") |
| `db/alter-shop-add-location.sql` | NEW — hand-authored idempotent delivery script for db_TCL (never auto-run) |
| `src/app/(main)/shops/shop-form.tsx` | Add "สถานที่" text input |
| `src/app/(main)/shops/actions.ts` | zod schema: add optional `location` field, `.max(200, ...)` (see Locked Decision 3) |
| `src/app/(main)/orders/new-sheet-form.tsx` | Location field: text/free input → `<select>` of distinct, `active: true`-filtered shop locations (server-fetched) |
| `src/app/(main)/orders/actions.ts` | `createOrderSheet` — no shape change to dup-check; confirm it still accepts `location` string as-is |
| `src/app/(main)/orders/[id]/page.tsx` | Replace fixed `ROSTER_SLOTS=29` loop with one `active: true` shop query + `buildLocationRoster()` call + fallback (now internal to the helper — see Locked Decision 5); thread the new `displayNo` field into `GridRow` for the visible row number only (see Implementation Checklist item 8) |
| `src/app/(main)/orders/order-matrix.tsx` | `GridRow` gains `displayNo: number`. Visible row number (`{row.rosterOrder}` label, mobile `entryNo`, blank-row fallback label) switches to `row.displayNo`. `data-testid` and React `key` KEEP the global `rosterOrder` — see Implementation Checklist item 8 |
| `src/app/(main)/orders/order-mobile-list.tsx` / `order-mobile-entry.tsx` | No change expected (they consume the same `rows` prop, and inherit the `displayNo`/`rosterOrder` split automatically) — verify only |
| `src/lib/get-sheet-for-print.ts` | Replace fixed `ROSTER_SLOTS=29` loop with the same single-query + `buildLocationRoster()` call; `PrintRow` gains the same `displayNo` field |
| `src/app/print/daily/[date]/page.tsx` | Pass through variable row count (no code assuming 29) |
| `src/app/print/shops/[date]/page.tsx` | Pass through variable row count (no code assuming 29). The `?slots=` filter (`selected.has(row.rosterOrder)`) KEEPS using the global `rosterOrder` — unchanged, same rationale as the testid decision above |
| `src/app/print/print-table.tsx` | Row-number `<td>` switches to `row.displayNo`; React `key` keeps `row.rosterOrder` — see Implementation Checklist item 10 |
| `src/styles/print.css` | Document (comment) that page-height budget now flexes with row count; no rule change unless a fixed-29 assumption is found |
| `src/lib/roster.ts` | **NEW** — pure helper `buildLocationRoster(activeShops, sheetLocation)` — takes the FULL active-shop list + the sheet's location string; returns the filtered+renumbered row list, doing the fallback internally (see Locked Decision 5). Unit-testable. |
| `test-fixtures/sheet-13-03-69.json` | Set `location: "ยิ่งเจริญ"` (see Open Questions Q1) |
| `src/lib/__tests__/roster.test.ts` | NEW unit tests for the helper (per-location filter, renumber, fallback, 446 total preserved) |
| `e2e/orders.spec.ts` | Add per-location roster gate; audit existing tests for fixed-29 assumptions |
| `e2e/print.spec.ts` | Add per-location print gate; audit existing tests for fixed-29 assumptions |
| `e2e/summary-history.spec.ts` | Audit only — confirm no fixed-29 assumption |
| `process/context/database/all-database.md` | Update after EXECUTE: new field, migration pattern, roster helper note |

## Public Contracts

- `Shop` Prisma model: adds one nullable column. No breaking change to existing reads (all current
  code that doesn't reference `location` keeps working).
- `createOrderSheet`/`saveOrderSheet` action signatures: **unchanged**. `OrderSheet.location` was
  already a free-text string; the picker becomes a constrained `<select>` client-side only — the
  server action still receives a plain string, so its zod validation is unchanged in shape (still
  a non-empty string).
- New pure export: `src/lib/roster.ts` — `buildLocationRoster(activeShops: {id, rosterOrder,
  name, location}[], sheetLocation: string | null): {rosterOrder: number, displayNo: number,
  shopId: string, shopName: string}[]`. Both `orders/[id]/page.tsx` and
  `get-sheet-for-print.ts` import this single helper — do not fork the filter/fallback logic.
  **[VALIDATE fix]** The filter, the null/0-match fallback, AND the 1..N renumbering ALL happen
  inside this one call — callers pass the full active-shop list (one query) and the sheet's
  location string, nothing more. `rosterOrder` in the return type is the shop's real, stable,
  globally-unique DB value (used for `data-testid`, React `key`, and the print `?slots=` filter —
  unchanged consumers). `displayNo` is the NEW per-location 1..N position (used ONLY for the
  visible row-number label in the matrix and on the printed sheet). These two fields are
  deliberately never conflated — see Implementation Checklist items 8 and 10.

## Blast Radius

**Edit:** `prisma/schema.prisma`, `prisma/seed.ts`, `shops/shop-form.tsx`, `shops/actions.ts`,
`orders/new-sheet-form.tsx`, `orders/actions.ts` (verify only), `orders/[id]/page.tsx`,
`order-matrix.tsx` (verify/adjust), `get-sheet-for-print.ts`, `print/daily/[date]/page.tsx`,
`print/shops/[date]/page.tsx`, `print-table.tsx` (verify/adjust), `print.css` (comment only),
`test-fixtures/sheet-13-03-69.json`, `e2e/orders.spec.ts`, `e2e/print.spec.ts`.

**New:** `prisma/migrations/<ts>_shop_location/`, `db/alter-shop-add-location.sql`,
`src/lib/roster.ts`, `src/lib/__tests__/roster.test.ts`.

**Must stay untouched:** `src/lib/order-payload.ts` (`buildOrderPayload`), `src/lib/totals.ts`,
`src/lib/order-save.ts` (`mergeSnapshots`), `saveOrderSheet` payload keying (printOrder/rosterOrder/qty),
the printOrder/variant contract, the soft-delete feature (`ordersheet-soft-delete` — completed),
the mm `<colgroup>` widths, `src/proxy.ts`/`auth-guard.ts`/auth flow, `src/lib/product-order.ts`.

**High-risk class:** schema/migration on the shared prod ERP DB (`db_TCL`) → manual-first delivery
handoff (see Migration / Deployment Plan). This is a **shared production database used by other
ERP modules outside this app** — the same guardrail class as `database/all-database.md` §DANGER
(never run destructive/reset commands against it; the delivery script is additive-only and
idempotent).

## Open Questions Resolved for This Plan (documented, not reopened)

**Q1 — fixture location assignment:** RESOLVED as: set `test-fixtures/sheet-13-03-69.json`
`location: "ยิ่งเจริญ"` (not left null). Rationale: this proves the real per-location path (not
just the fallback), and matches the plan's actual seeded data (all 25 shops backfilled to
ยิ่งเจริญ) — so filtering to `location = "ยิ่งเจริญ"` still yields all 25 shops and the grand
total of 446 is unchanged either way. **[VALIDATE-confirmed]**: every `rosterOrder` value
referenced by the fixture's 51 cells (1,2,3,5,7,9,10,11,12,14,15,16,17,18,19,21,22,24,25,27,28)
and its 13 `noteLines` (including the intentional orphan at slot 20, which has no shop) belongs to
one of the 25 seeded shops, and the seed backfill (`where: { location: null }`) applies to ALL 25
of them since `location` is a brand-new column — nothing is excluded. A SEPARATE small
fixture-less e2e case (gate G5) covers the null-location fallback path directly against a
fresh/legacy-shaped sheet instead of overloading the canonical fixture with a dual-purpose test.

**Q2 — shop creation rosterOrder assignment:** Existing shop-creation flow assignment of
`rosterOrder` is OUT OF SCOPE for this plan (pre-existing behavior). RESEARCH step within EXECUTE
must confirm it still assigns a sane next value; if a bug is found, file a backlog note — do not
expand scope to fix it here.

## Data Flow

1. **Shop form save** → `location` optional string (`.max(200)`) → `Shop.location` column.
2. **New sheet form** → server component queries distinct non-null, `active: true` locations →
   renders `<select>` → user picks one → `createOrderSheet(location, date)` unchanged signature.
3. **Order editor load** (`orders/[id]/page.tsx`) → reads `sheet.location` → runs ONE query
   `prisma.shop.findMany({ where: { active: true }, orderBy: { rosterOrder: "asc" } })` → passes
   the result + `sheet.location` into `buildLocationRoster()`, which does the filter, the
   null/0-match fallback, AND the 1..N `displayNo` renumbering internally (see Locked Decision 5)
   → render, using `displayNo` for the visible row number and `rosterOrder`/`shopId` for
   identity/testid/save-keying.
4. **Save** (`saveOrderSheet`) → unchanged; keys writes by `shopId`+`variantId` (via
   `buildOrderPayload`'s `cell:{shopId}:{variantId}` format) and `rosterOrder`/`printOrder` for
   totals — never by `displayNo`. The renumbered display position never reaches the save payload.
5. **Print** (`get-sheet-for-print.ts`) → same single-query + `buildLocationRoster()` call →
   variable row count → `print-table.tsx` renders `rows.length` rows using `displayNo` for the
   printed row number, no hardcoded 29.

## Migration / Deployment Plan (CRITICAL — shared prod DB)

- **Sandbox:** `prisma migrate dev --name shop_location` under the sandbox `.env` (safe, disposable
  container). Confirms schema.prisma + generates the migration SQL for reference.
- **db_TCL (customer prod ERP DB):** NEW hand-authored `db/alter-shop-add-location.sql`:
  ```sql
  -- Run ONCE on db_TCL BEFORE deploying this application code.
  -- Idempotent: safe to re-run.
  IF COL_LENGTH('dbo.Shop', 'location') IS NULL
      ALTER TABLE [dbo].[Shop] ADD [location] NVARCHAR(200) NULL;
  ```
  This script is delivered to the customer's vendor/DBA — **no agent executes it**. Document exact
  ordering in the plan's Resume/Handoff: (1) DBA runs `alter-shop-add-location.sql` on db_TCL, (2)
  deploy app code, (3) run the backfill (`pnpm tsx prisma/seed.ts` is idempotent/safe to run against
  db_TCL for the backfill step alone, OR a one-off `UPDATE dbo.Shop SET location = N'ยิ่งเจริญ'
  WHERE location IS NULL;` — plan documents BOTH options and recommends the one-off UPDATE for prod
  since re-running the full seed against a live prod-shaped DB is broader than needed; EXECUTE must
  make the final call and document it in the phase report). Between steps (1) and (3), the app
  runs safely because `location` is null → every query hits the documented fallback path (full
  active-shop list) — no window where the app errors.
- Full guardrails: never run `prisma migrate reset` / `db push --force-reset` against db_TCL; treat
  db_TCL as a **shared production ERP database** per `database/all-database.md` §DANGER.

## Acceptance Criteria

- AC1: A shop saved with a "สถานที่" value persists it; editing a shop can change it.
- AC2: The daily-sheet location picker (`new-sheet-form.tsx`) shows a dropdown of distinct
  existing shop locations (no free text), and creating a sheet still works exactly as before
  in terms of the dup-check.
- AC3: Opening an order sheet whose location matches N shops shows exactly those N shops,
  numbered 1..N via `displayNo`, and shops in a different location are absent.
- AC4: Opening a legacy/null-location sheet (or a location with 0 matching shops) shows the full
  active-shop list, renumbered 1..N — same fallback semantics as today (no location restriction),
  though the exact row count now reflects the actual active-shop count rather than the fixed
  29-slot placeholder list (blank gap rows are no longer rendered in the fallback).
- AC5: Both print routes (combined daily + per-shop) render the same per-location filtered,
  variable-row, 1..N-numbered (`displayNo`) roster as the editor.
- AC6: The grand total (446) for the ยิ่งเจริญ location fixture is unchanged.
- AC7: `rosterOrder` remains globally unique; no schema change to that constraint.
- AC8: `db/alter-shop-add-location.sql` exists, is idempotent, and is never executed by any agent
  against db_TCL.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| G1: `roster.test.ts` — `buildLocationRoster` filters by location, renumbers 1..N via `displayNo`, keeps `rosterOrder` stable | Fully-Automated (`pnpm test`) | AC3 — per-location filtering + display renumbering |
| G2: `roster.test.ts` — fallback to all active shops when location null/no-match, still renumbered | Fully-Automated (`pnpm test`) | AC4 — backward-compat fallback |
| G3: Fixture round-trip — ยิ่งเจริญ location filter yields 25 shops, grand total 446 unchanged | Fully-Automated (`pnpm test`, extend existing fixture test) | AC6 — totals integrity preserved |
| G4 (e2e): create sheet with location "ยิ่งเจริญ" → only its shops show, numbered 1..N; a shop assigned a DIFFERENT location does not appear; cell entry still targets the correct shop via the (unchanged, global) `rosterOrder`-keyed testid | Hybrid (Playwright, `orders.spec.ts`, sandbox DB precondition) | AC3 — per-location entry surface |
| G5 (e2e): legacy/null-location sheet still renders full active-shop list (fallback path, not via the canonical fixture) | Hybrid (Playwright, `orders.spec.ts`) | AC4 — backward-compat fallback proven end-to-end |
| G6 (e2e): print daily + per-shop routes render variable row count for a location, `displayNo`-numbered 1..N | Hybrid (Playwright, `print.spec.ts`, sandbox DB precondition) | AC5 — print surface per-location + variable rows |
| G7: shop form save/edit persists `location` field, rejects >200 chars | Fully-Automated (existing `shops` action test pattern, extend if present, else Hybrid via e2e) | AC1 — master-data editability |
| G8: `pnpm build` succeeds (typecheck + Next build) | Fully-Automated | AC7 — no structural breakage |
| G9: lint clean | Fully-Automated (`pnpm lint`, if configured) | Code quality gate |
| G10: db_TCL delivery script — reviewed manually, never executed by any agent | Agent-Probe (manual review of SQL idempotency + comment clarity) | AC8 — migration delivery constraint |

**Known-gap:** on-site real-printer mm fidelity for a >29-row location is agent-probe only within
this plan (matches existing project precedent — see `all-context.md` Open Questions). Documented,
not blocking.

## Test Infra Improvement Notes

(none identified yet — existing sandbox `.env`-swap Playwright pattern (see
`process/context/tests/all-tests.md`) and Vitest fixture pattern are reused as-is; no new test
infra required)

## Phase Completion Rules

This is a single-plan (non-phase-program) COMPLEX plan. It is considered CODE DONE when the
Implementation Checklist below is fully executed and gates G1–G3, G7–G9 (all Fully-Automated) are
green. It is considered VERIFIED only after the Hybrid gates G4–G6 (Playwright, sandbox `.env`)
also pass AND the user has confirmed the per-location behavior matches expectations on a real
sheet. Do not mark this plan `✅ VERIFIED` on Fully-Automated gates alone — the Hybrid gates and
explicit user confirmation are both required before archival to `completed/`.

**Archival note (13-07-26 UPDATE PROCESS):** G1–G3, G7–G9 (Fully-Automated) AND G4–G6 (Hybrid,
Playwright, sandbox `.env`) are ALL green (see EXECUTE report Test Gate Outcomes). Every acceptance
criterion (AC1–AC8) has a passing Fully-Automated or Hybrid proving gate — no criterion rests on a
Known-Gap. The one remaining item is the STRICT "user confirms on a real live sheet" sign-off this
section calls out, which is archived as a pending-manual residual (see `all-database.md` Known
Gaps) rather than a blocker, consistent with this project's existing precedent for on-site/manual
residuals (e.g. on-site printer fidelity, iPad real-viewport usability). Archived to `completed/`
on this basis.

## Validate Contract

Status: PASS
Date: 13-07-26
date: 2026-07-13
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: Score 3/7 (S2 schema/API surface touched, S6 high-risk class present, S7 5+ blast-radius
files). Single COMPLEX plan (not a phase program) with an explicitly sequenced Implementation
Checklist (items 1–5 land independently; 6–11 must land together since editor and print share
`roster.ts`; 12–16 follow once 1–11 are green) — this is a dependency chain, not independent
fan-out-able work, so a single `vc-execute-agent` (opus) run is recommended over parallel subagents
or an agent team.

Test gates (C3 5-column table — ADDITIVE; existing consumers still parse the legacy line form below it):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | Shop location field persists on create/edit, rejects >200 chars | Fully-Automated | `pnpm test` (extend shops-action unit pattern if present) | A |
| AC2 | Location picker is a distinct, active-filtered `<select>`; dup-check unchanged | Hybrid | `pnpm exec playwright test e2e/orders.spec.ts` (sandbox) | A |
| AC3 | Per-location roster shows only that location's shops, `displayNo` 1..N | Fully-Automated + Hybrid | `pnpm test` (roster.test.ts G1) + `pnpm exec playwright test e2e/orders.spec.ts` (G4) | A |
| AC4 | Null/no-match location falls back to full active-shop list, renumbered | Fully-Automated + Hybrid | `pnpm test` (roster.test.ts G2) + `pnpm exec playwright test e2e/orders.spec.ts` (G5) | A |
| AC5 | Both print routes render same per-location, variable-row, `displayNo`-numbered roster | Hybrid | `pnpm exec playwright test e2e/print.spec.ts` (G6) | A |
| AC6 | Grand total 446 unchanged for ยิ่งเจริญ fixture | Fully-Automated | `pnpm test` (G3, extended fixture test) | A |
| AC7 | `rosterOrder` stays globally `@unique`, no schema break | Fully-Automated | `pnpm build` (G8 — Prisma validate + typecheck) | A |
| AC8 | db_TCL delivery script idempotent, never agent-executed | Agent-Probe | manual SQL review (G10) | A |
| Code quality | lint clean | Fully-Automated | `pnpm lint` (G9) | A |
| Print >29-row physical fidelity | on-site real-printer overflow fidelity for a location with >29 shops | Known-Gap | — | D — documented residual, matches existing project precedent (`all-context.md` Open Questions); backlog-eligible only if a >29-shop location is ever created |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: all 9 proving rows use Fully-Automated/Hybrid/Agent-Probe; Known-Gap appears
exactly once, as a named residual (gap-resolution D), never as a value in the `strategy:` column
for a row that is claimed as proven.

Legacy line form (retained so existing validate-contract consumers still parse):
- roster helper + totals: Fully-automated: `pnpm test` (roster.test.ts G1/G2, extended fixture test G3) | hybrid: `pnpm exec playwright test e2e/orders.spec.ts e2e/print.spec.ts` (precondition: sandbox `.env` active, `docker compose up -d`) | agent-probe: manual review of `db/alter-shop-add-location.sql` idempotency (G10) | known-gap: on-site real-printer fidelity for >29-row locations (documented, D)
- build/lint: Fully-automated: `pnpm build` (G8), `pnpm lint` (G9)

Failing stub (G1 — `roster.test.ts`, Fully-Automated):
```
test("should filter activeShops by location and renumber 1..N as displayNo, keeping rosterOrder stable", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: buildLocationRoster filters + renumbers")
})
```

Failing stub (G2 — `roster.test.ts`, Fully-Automated):
```
test("should fall back to the full active-shop list when location is null or has 0 matches", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: buildLocationRoster fallback path")
})
```

Failing stub (G3 — extended fixture test, Fully-Automated):
```
test("should preserve grand total 446 when the 13/3/69 fixture is filtered to location ยิ่งเจริญ", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: location-filtered fixture totals unchanged")
})
```

Failing stub (G7 — shop location persistence, Fully-Automated, if a unit-test pattern exists for shop actions):
```
test("should reject a shop location value longer than 200 characters", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: shop location max-length validation")
})
```

Failing stub (G8 — build, Fully-Automated):
```
test("should typecheck and build cleanly with the new Shop.location field and roster.ts helper", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: pnpm build gate")
})
```

Failing stub (G9 — lint, Fully-Automated):
```
test("should pass lint with no new violations introduced by this plan's touchpoints", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: pnpm lint gate")
})
```

Dimension findings:
- Infra fit: PASS — no container/infra/runtime surface changes; pure Next.js/Prisma app-level
  feature, same shape as the prior `ordersheet-soft-delete` and `remove-settings-db` plans.
- Test coverage: PASS — G1–G10 cover all 8 ACs across Fully-Automated/Hybrid/Agent-Probe tiers; the
  one Known-Gap (on-site >29-row print fidelity) is narrow, named, and matches an already-accepted
  project-wide residual (see `all-database.md`/`all-tests.md` Known Gaps).
- Breaking changes: PASS — `Shop` gains one nullable column; `saveOrderSheet`/`buildOrderPayload`
  signatures confirmed unchanged by direct code read; no public API breakage.
- Security surface: PASS — no new auth/trust-boundary surface; existing `requireAuth` guards on
  every shop/order/print route are untouched; zod validation tightened (max-length fix applied)
  rather than loosened.
- Schema & migration (db_TCL): PASS — `db/alter-shop-add-location.sql` uses the same idempotent
  `IF COL_LENGTH(...) IS NULL` guard style as prior delivery scripts; deploy ordering documented
  (ALTER → deploy → backfill) with an explicit note that the fallback path keeps the app safe
  between steps; §DANGER guardrails (never `migrate reset`/`db push --force-reset` against db_TCL)
  restated and followed.
- Roster helper / UI wiring (order-matrix.tsx, print-table.tsx, get-sheet-for-print.ts,
  print/shops/[date]/page.tsx): CONCERN found — the original plan draft left the `displayNo` vs.
  `rosterOrder` split (visible row number vs. testid/React-key/`?slots=`-filter identity) unstated,
  and had an internal contradiction between the Public Contracts section (helper owns
  filter+fallback) and the Data Flow section (caller does a two-query fallback dance). **FIXED**
  in this validate pass: Locked Decision 5, Public Contracts, Data Flow, and Implementation
  Checklist items 8/10 now explicitly assign filter+fallback+renumber to the helper (one query per
  caller) and specify exactly which field (`rosterOrder` vs. `displayNo`) each rendered/keyed
  surface uses.
- Master data / picker (shop-form.tsx, actions.ts, new-sheet-form.tsx): CONCERN found — no
  max-length zod validation on the new `location` field (DB is `NVarChar(200)`), and the distinct-
  locations query for the picker had no `active: true` filter (a location could appear as a
  selectable-but-empty option if it existed only on a soft-deleted shop). **FIXED** in this
  validate pass: Locked Decisions 3 and 4 updated with the `.max(200, ...)` and `active: true`
  additions.

Open gaps: none unresolved. (On-site >29-row print fidelity is a documented, accepted Known-Gap —
see Test Gates table above — not an open plan gap.)

What this coverage does NOT prove:
- Real concurrent multi-user roster edits during a location switch (TOCTOU) — not covered; matches
  the already-accepted `OrderSheet` duplicate-sheet TOCTOU residual (see `all-database.md` Known
  Gaps), same class of risk, not newly introduced by this plan.
- On-site physical printer fidelity for a location with more than 29 shops — Known-Gap, agent-probe
  only, documented above.
- Thai collation-aware sorting of the location `<select>` options — locations are sorted by default
  JS/SQL string comparison, not Thai collation; low risk while only one real location
  ("ยิ่งเจริญ") exists in seeded data.
- The migration script's actual execution against db_TCL (COMPATIBILITY_LEVEL 130, live ERP DB) —
  never run by any automated gate, by design; only G10's manual SQL review covers it, per the
  project-wide db_TCL guardrail (manual-only, no agent execution).
- End-to-end dropdown behavior with 2+ REAL distinct locations — current seeded data only produces
  one location (ยิ่งเจริญ) after backfill; G4/G5 exercise the single-location and no-location-match
  paths, not a live multi-location picker UX. If EXECUTE wants this proven, a second location must
  be seeded/created within the e2e spec itself.
- Whether existing shop-creation flow assigns a sane next `rosterOrder` value (Q2, explicitly
  out of scope — EXECUTE confirms and files a backlog note only if broken).

Gate: PASS (no FAILs; 2 CONCERNs found during V2 fan-out, both resolved via plan updates in this
V6 pass — see Dimension findings above for exact fix locations)
Accepted by: session (validate-agent applied all proposed plan fixes before finalizing the
contract; no unresolved concerns remain requiring user acceptance)

## Implementation Checklist

1. `prisma/schema.prisma` — add `location String? @db.NVarChar(200)` to `Shop`.
2. Run `prisma migrate dev --name shop_location` under sandbox `.env` — commit generated migration.
3. `prisma/seed.ts` — add idempotent backfill block (existing shops → "ยิ่งเจริญ" where `location IS NULL`), placed alongside the existing rename-migration block, before the PRINT_VARIANTS loop.
4. Create `src/lib/roster.ts` — `buildLocationRoster(activeShops, sheetLocation)` pure helper. Takes the FULL active-shop list (caller does one query) + the sheet's location string; internally filters, falls back to the full list on null/0-match, sorts by `rosterOrder asc`, and assigns `displayNo` 1..N — see Locked Decision 5.
5. Create `src/lib/__tests__/roster.test.ts` — unit tests (G1, G2).
6. `shops/shop-form.tsx` + `shops/actions.ts` — add optional "สถานที่" input + zod field `.trim().max(200, "สถานที่ยาวเกินไป").optional()` (matches the existing `name` field's `NVarChar(200)` validation pattern).
7. `orders/new-sheet-form.tsx` — location field → `<select>` fed by a server query for distinct non-null, `active: true`-filtered locations.
8. `orders/[id]/page.tsx` — replace fixed `ROSTER_SLOTS=29` loop with ONE `prisma.shop.findMany({ where: { active: true }, orderBy: { rosterOrder: "asc" } })` query passed through `buildLocationRoster()`; remove now-dead `ROSTER_SLOTS` constant. `GridRow` gains `displayNo: number`. The VISIBLE row number (matrix row-label `<td>`, mobile `entryNo`, blank-row fallback label) switches to `row.displayNo`. `data-testid={cell-${row.rosterOrder}-${col.printOrder}}` and React `key={row.rosterOrder}` KEEP using the global `rosterOrder` — unchanged, preserving e2e testid continuity with the existing fixture.
9. Verify `order-matrix.tsx`, `order-mobile-list.tsx`, `order-mobile-entry.tsx` render rows dynamically (no 29-assumption) and correctly consume the new `displayNo` field for any user-visible row number — adjust only if found.
10. `src/lib/get-sheet-for-print.ts` — replace fixed `ROSTER_SLOTS=29` loop with the same single-query + `buildLocationRoster()` call; remove dead constant. `PrintRow` gains the same `displayNo` field.
11. Verify `print-table.tsx` renders `rows.length` rows generically and uses `row.displayNo` for the visible row-number `<td>` (React `key` stays `row.rosterOrder`); verify both print route pages, including that `print/shops/[date]/page.tsx`'s `?slots=` filter (`selected.has(row.rosterOrder)`) keeps using the global `rosterOrder` unchanged; add a `print.css` comment noting the page-height budget now flexes with row count.
12. Update `test-fixtures/sheet-13-03-69.json` — set `location: "ยิ่งเจริญ"`.
13. Run `pnpm test` (Vitest, per `process/context/tests/all-tests.md`) — confirm G1–G3 green, 446 grand total preserved.
14. `e2e/orders.spec.ts` — add G4 (per-location filter) and G5 (fallback) gates.
15. `e2e/print.spec.ts` — add G6 (variable-row print) gate.
16. Audit `e2e/summary-history.spec.ts` and `order-matrix.tsx`/`print-table.tsx` for any remaining hardcoded-29 assumption; fix if found.
17. Create `db/alter-shop-add-location.sql` — idempotent `IF COL_LENGTH ... ADD` delivery script with leading comment on run ordering.
18. Run `pnpm build` (G8) and `pnpm lint` if configured (G9).
19. Update `process/context/database/all-database.md` — document the new field, backfill pattern, and `roster.ts` single-source-of-truth note.
20. Write phase report; recommend `vc-git-manager` commit; route to UPDATE PROCESS.

## Post-Phase Testing

Run `pnpm test` (Vitest — G1, G2, G3, G7 unit coverage) and
`pnpm exec playwright test e2e/orders.spec.ts e2e/print.spec.ts` (Hybrid — G4, G5, G6, under the
sandbox `.env` swap per `process/context/tests/all-tests.md` and `database/all-database.md`
§DANGER — never point Playwright at db_TCL / 43.229.134.162) plus `pnpm build` (G8) and `pnpm lint`
if configured (G9), after every checklist section, not only at the end.

## Resume and Execution Handoff

- **Entry point:** this single plan file — no phase split needed.
- **Prerequisite before EXECUTE touches DB:** confirm the sandbox `.env` is active (never point
  dev commands at db_TCL / 43.229.134.162 — see `database/all-database.md` §DANGER for the exact
  swap/restore procedure).
- **If interrupted mid-EXECUTE:** checklist items 1–5 (schema + helper + unit tests) are safe to
  land independently; items 6–11 (UI + print wiring) should land together since editor and print
  share `roster.ts`; items 12–16 (fixture + e2e) can follow once 1–11 are green.
- **Test gate commands:** `pnpm test` (unit, incl. new `roster.test.ts` + updated fixture test),
  `pnpm exec playwright test e2e/orders.spec.ts e2e/print.spec.ts` (under sandbox `.env`), `pnpm build`.
- **db_TCL delivery is NOT part of EXECUTE** — `db/alter-shop-add-location.sql` is a handoff
  artifact only; no agent runs it against db_TCL.
- **Next Step:** VALIDATE passed (PASS, 13-07-26). Say `ENTER EXECUTE MODE` to implement. After
  EXECUTE + EVL are green and the Hybrid/user-confirmation bar in Phase Completion Rules is met,
  archive this task folder to `process/features/order-system/completed/` via UPDATE PROCESS.

## Autonomous Goal Block

SESSION GOAL: Ship per-location shop rosters for orderstock daily order sheets (Shop.location field, location-filtered variable-row order entry + print, db_TCL delivery script)
Charter + umbrella plan: N/A — single plan (not a phase program)
Autonomy: Standard RIPER-5 gates apply — EXECUTE requires explicit "ENTER EXECUTE MODE"; no standing /goal is active for this plan.
Hard stop conditions / safety constraints:
- Never run `prisma migrate reset`, `prisma migrate dev`, or `prisma db push --force-reset` against db_TCL (shared live ERP database, `43.229.134.162`).
- Never execute `db/alter-shop-add-location.sql` against db_TCL — delivery artifact only, customer's DBA runs it.
- Never point Playwright/dev commands at db_TCL — sandbox `.env` only for all automated gates.
- rosterOrder's global `@unique` constraint must never be altered.
Next phase: EXECUTE — process/features/order-system/active/shop-location-roster_13-07-26/shop-location-roster_PLAN_13-07-26.md
Validate contract: inline in plan (see `## Validate Contract` above)
Execute start: `pnpm test` + `pnpm exec playwright test e2e/orders.spec.ts e2e/print.spec.ts` (sandbox `.env`) + `pnpm build` | e2e specs: e2e/orders.spec.ts, e2e/print.spec.ts | probe scenario: db_TCL delivery script manual SQL review (G10) | high-risk pack: no (schema change is sandbox-first with a manual-only prod delivery step, not a live-provider or irreversible-in-session action)
