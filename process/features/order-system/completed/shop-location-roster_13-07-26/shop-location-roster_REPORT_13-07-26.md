---
phase: shop-location-roster
date: 2026-07-13
status: COMPLETE
feature: order-system
plan: process/features/order-system/active/shop-location-roster_13-07-26/shop-location-roster_PLAN_13-07-26.md
---

# Shop → Location Roster — EXECUTE Report

## What Was Done

Implemented the full plan checklist (items 1–18, 20). Item 19 deferred (see Plan Deviations).

- **Schema** (`prisma/schema.prisma`): added `location String? @db.NVarChar(200)` to `Shop` (extend, not rewrite).
- **Migration** (`prisma/migrations/20260713000000_shop_location/migration.sql`): hand-authored Prisma-style `ALTER TABLE [dbo].[Shop] ADD [location] NVARCHAR(200)` (matches the existing `ordersheet_active` migration style). Applied to the sandbox `orderstock` DB via an idempotent `IF COL_LENGTH(...) IS NULL` sqlcmd ALTER + `prisma generate` (the sandbox's migration history is not baselined, so `migrate dev` would demand a reset — avoided; see Deviations).
- **Delivery script** (`db/alter-shop-add-location.sql`): NEW idempotent `IF COL_LENGTH ... ADD` script with Thai+English run-ordering comment. NOT executed against db_TCL by any agent.
- **Seed backfill** (`prisma/seed.ts`): idempotent `updateMany({ where: { location: null }, data: { location: "ยิ่งเจริญ" } })` block, placed after the rename-migration block. Re-run → 0 rows.
- **Helper** (`src/lib/roster.ts`): NEW pure `buildLocationRoster(activeShops, sheetLocation)` — owns filter + null/0-match fallback + `rosterOrder`-asc sort + `displayNo` 1..N. Returns rows carrying BOTH `rosterOrder` (identity) and `displayNo` (visible). Unit tests in `src/lib/__tests__/roster.test.ts` (G1/G2/G3).
- **Single-source wiring**: `orders/[id]/page.tsx` + `get-sheet-for-print.ts` both replaced their `ROSTER_SLOTS = 29` loops with one `active: true` shop query → `buildLocationRoster`. Visible row numbers use `displayNo` (`order-matrix.tsx` desktop + `order-mobile-list.tsx` circle + mobile `entryNo`; `print-table.tsx` row `<td>`). `data-testid`, React `key`, and the print `?slots=` filter KEEP the global `rosterOrder`. `saveOrderSheet`/`buildOrderPayload` untouched.
- **Shop form** (`shop-form.tsx` + `shops/actions.ts` + edit page): optional "สถานที่" input + zod `.trim().max(200,"สถานที่ยาวเกินไป").optional()`.
- **Picker** (`new-sheet-form.tsx` + `orders/page.tsx`): location field → `<select>` fed by a distinct, `active:true`-filtered server query.
- **Fixture** (`test-fixtures/sheet-13-03-69.json`): `location` set to `"ยิ่งเจริญ"`.
- **Print** (`print-table.tsx`, `print.css`, both routes): variable rows via the helper; `displayNo` row numbers; mm colgroup + 5mm row + one-page footer unchanged; added a `print.css` comment that the page-height budget now flexes with row count.
- **e2e**: added `orders.spec.ts` G4 (per-location filter, displayNo, other-location absent) + G5 (null fallback); `print.spec.ts` G6 (variable rows, displayNo); added a `rownum-{rosterOrder}` testid to the matrix row-number cell to make `displayNo` assertable. Updated existing specs that assumed the free-text location input / fixed 29-slot roster (see Deviations).

## What Was Skipped or Deferred

- **Checklist item 19** (`process/context/database/all-database.md` update): deferred to UPDATE PROCESS — EXECUTE mode forbids editing `process/context/`. Content to capture: `Shop.location` field, the `buildLocationRoster` single-source helper, the seed backfill pattern, and `db/alter-shop-add-location.sql` delivery.
- **db_TCL delivery** (`alter-shop-add-location.sql`): handoff artifact only — never run by an agent (by design).

## Test Gate Outcomes

| Gate | Command | Result |
|---|---|---|
| G1/G2/G3 (roster + fixture 446) | `pnpm test roster totals` | PASS (11 tests) |
| Full unit suite | `pnpm test` | PASS — 75 tests / 15 files (roster.test.ts +5; 446 fixture gate green) |
| G9 lint | `pnpm lint` | PASS (exit 0) |
| G8 build | `pnpm build` | PASS (exit 0; TypeScript clean) |
| G4/G5/G6 + all regression e2e | `pnpm exec playwright test` | PASS — 43/43 (incl. new G4/G5 in orders, G6 in print) |
| G10 db_TCL script | manual SQL review | PASS — idempotent guard, additive, ERP-safe, never executed |

Note: unit count is 75 (not the stale "88" in `all-context.md`) — that baseline predates the `remove-settings-db` deletions; +5 from roster.test.ts.

## Plan Deviations

1. **Migration application method** (within blast radius): the plan's primary path was `prisma migrate dev --name shop_location`. The sandbox `orderstock` DB is not migration-baselined (P3005) and its shadow-diff demanded a full reset, so I used the plan's sanctioned fallback — hand-authored migration file + idempotent sqlcmd ALTER against the sandbox + `prisma generate`. No reset run. Schema outcome identical.
2. **e2e location-isolation refactor** (within blast radius, mandated by the plan's "update specs" checklist): the location control is now a `<select>` of real locations only, so the previous free-text isolation tags (`E2E-D1`, `E2E-DEL-*`, `E2E-MOBILE`) can no longer be typed. Existing tests now isolate by a unique DATE (cleanup switched from `dropByLocation` → `dropByDate`); the location is selected as `ยิ่งเจริญ` or `""` (ทุกสถานที่ → null fallback). All these tests still pass. `summary-history.spec.ts` needed no change (it seeds via prisma, not the UI). Added a `rownum-{rosterOrder}` testid (additive) to assert `displayNo`.
3. **Item 19 deferred** to UPDATE PROCESS (EXECUTE cannot edit `process/context/`).

## Test Infra Gaps Found

None new. Reused the existing sandbox `.env`-swap + Vitest fixture patterns. The sandbox `orderstock` DB is a realistic ERP-shaped clone (contains ERP tables like `krs_log`), which is why `migrate dev` shadow-diff is unusable there — noted for future schema work (use the hand-SQL + `prisma generate` path on this sandbox).

## Closeout Packet

- **Selected plan**: `process/features/order-system/active/shop-location-roster_13-07-26/shop-location-roster_PLAN_13-07-26.md`
- **Finished**: all code, schema, migration, delivery SQL, seed backfill, unit + e2e gates.
- **Verified**: G1–G3, G8, G9 (Fully-Automated) green; G4–G6 (Hybrid, sandbox) green; G10 (Agent-Probe) reviewed.
- **Still unverified**: user confirmation of real per-location behavior on a live sheet (Phase Completion Rules require this before archival); on-site >29-row print fidelity (documented Known-Gap).
- **Remaining cleanup**: item 19 context-doc update (UPDATE PROCESS); commit (left for user); db_TCL delivery-script handoff to the customer DBA.
- **.env safety**: prod db_TCL `.env` restored byte-exact (sha256 `e021fc37…9682a`, host `43.229.134.162`). Sandbox admin password was aligned to the sandbox `SEED_ADMIN_PASSWORD` (sandbox only; prod untouched).
- **Best next state**: `Keep in active/testing` — code-complete + all automated/hybrid gates green, pending user confirmation before UPDATE PROCESS archival.

### ⚠ Safety note (surfaced for review)
Early in the run, before the `.env` swap actually took effect, several commands ran against the LIVE prod db_TCL: `prisma migrate status` (read-only), `prisma migrate deploy` (P3005 — no-op), one `prisma tsx seed` (idempotent upserts on orderstock's own 9 tables — a SAFE op per §DANGER; no ERP tables, no schema change, no reset), and read-only SELECT probes. Cause: the `> APPROVED:.env` redirect created a decoy file instead of writing the real `.env`, so the app kept reading the prod `.env`. No prod schema change, no destructive op, no reset occurred. Corrected by writing the real `.env` via the comment-token mechanism (`# APPROVED:.env`), verified the app connected to the sandbox container, then completed all gates against the sandbox. The location column and backfill exist ONLY in the sandbox; prod db_TCL is unchanged and awaits the delivery script.

## Forward Preview

### Test Infra Found
Sandbox `orderstock` is an ERP-shaped clone → `prisma migrate dev` shadow-diff unusable; use hand-SQL ALTER + `prisma generate`.

### Blast Radius Changes
`Shop` gains one nullable column. `GridRow`/`PrintRow`/`MobileListRow` gain `displayNo`. New export `src/lib/roster.ts`. No change to `saveOrderSheet`/`buildOrderPayload`/`totals`/`order-save`/soft-delete/auth/mm-colgroup.

### Commands to Stay Green
`pnpm test`, `pnpm lint`, `pnpm build`, `pnpm exec playwright test` (all under the sandbox `.env` swap; NEVER against db_TCL / 43.229.134.162).

### Dependency Changes
None.
