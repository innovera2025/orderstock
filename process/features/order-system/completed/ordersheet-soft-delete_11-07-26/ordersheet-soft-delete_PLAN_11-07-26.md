---
name: plan:ordersheet-soft-delete
description: "ADMIN-only soft-delete of OrderSheet rows via a confirm-modal delete button on the orders list, with an additive `active` column and a scoped db_TCL ALTER script"
date: 11-07-26
feature: order-system
---

# OrderSheet Soft-Delete — Plan

Complexity: **COMPLEX** (schema change on a shared, live production DB + auth surface + 6 read-path
call sites to update consistently). Single plan, not a phase program (one deploy unit, no
independent validation gates between sub-parts).

**Date**: 11-07-26
**Status**: ✅ VERIFIED (11-07-26) — EXECUTE complete, all gates green (99 unit / 34 e2e / lint /
build), archived at UPDATE PROCESS. See `ordersheet-soft-delete_REPORT_11-07-26.md` for the EXECUTE
report. Not yet deployed to db_TCL — the customer's DBA must apply
`db/alter-ordersheet-add-active.sql` before/with the code deploy (delivery-artifact-only, never
agent-applied).

**Context loaded:** `process/context/all-context.md` (root router) →
`process/context/database/all-database.md`, `process/context/auth/all-auth.md`,
`process/context/uxui/all-uxui.md`, `process/context/tests/all-tests.md` (test tiers/runner
selection — Vitest 3.2.6 + Playwright, see Verification Evidence below).

## Overview

Add the ability for an ADMIN user to soft-delete a daily `OrderSheet` from the orders list page.
"Soft-delete" means: set `active = false` on the sheet, keep every `OrderLine`/`NoteLine` row
untouched, and hide the sheet from every read surface that currently assumes all `OrderSheet` rows
are live. No cascade, no data loss, fully reversible via a direct DB update if ever needed (no UI
"undo" in this plan — see Non-Goals).

## Goals

1. Schema: `OrderSheet.active Boolean @default(true)` (mirrors `Shop`/`Product`/`User`).
2. Server action `softDeleteOrderSheet(id)` — ADMIN-only, sets `active = false`, revalidates `/orders`.
3. UI: per-row delete button on `orders/page.tsx`, visible only to ADMIN, guarded by an in-app
   confirmation modal built from `src/components/ui/modal.tsx`.
4. Every read path that lists, aggregates, edits, or prints `OrderSheet` rows excludes inactive
   sheets (or 404s on direct access), so a soft-deleted sheet behaves as if it no longer exists
   everywhere except direct DB inspection.
5. A safe, additive migration path for the **shared live production DB (db_TCL)** — a hand-authored
   scoped `ALTER TABLE` script, delivered the same way Phase 06's `create-database-and-login.sql` was.

## Non-Goals (explicitly out of scope)

- No "restore"/"undo delete" UI. (Reversible only via direct DB `UPDATE ... SET active = 1`, same as
  how `Shop`/`Product`/`User` soft-deletes already work — no existing restore UI for those either.)
- No hard delete, no cascade delete of `OrderLine`/`NoteLine`.
- No bulk-delete / multi-select. One row, one confirm, one delete.
- No change to `saveOrderSheet`/`createOrderSheet` behavior beyond the two small VALIDATE-added
  guard clauses (Plan Updates P2/P3 below), `order-payload.ts`, `totals.ts`, `order-save.ts`, the
  446 fixture, or print layout/mm CSS.
- No STAFF-visible "deleted" state or trash view.
- No `deletedBy`/`deletedAt` audit-trail columns. Accepted as consistent with the existing
  `Shop`/`Product`/`User` soft-delete pattern, which also has no audit trail today — this plan does
  not introduce a new gap, it inherits an existing one. Worth a future cross-cutting backlog item if
  audit trail is ever wanted, but out of scope here (see Validate Contract → Open gaps).

## Research Findings (confirmed — see task context, do not re-derive)

- Only `OrderLine` and `NoteLine` have FKs to `OrderSheet` (`onDelete: NoAction`, `onUpdate: NoAction`
  — schema.prisma:117-130). No other child tables. Soft-delete needs no cascade logic.
- `OrderSheet` model (schema.prisma:100-111) has NO `active` field today — `Shop`/`Product`/`User`
  already have one; this plan adds the same pattern to `OrderSheet`.
- `createOrderSheet`/`saveOrderSheet` (`src/app/(main)/orders/actions.ts`) call
  `requireAuthState()` with **no role arg** — any authenticated user (ADMIN or STAFF) may create/save.
  Delete is a NEW action and MUST call `requireAuthState("ADMIN")` — this is additive, no existing
  action's auth requirement changes.
- `requireAuth(role?: Role)` / `requireAuthState(role?: Role)` in `src/lib/auth-guard.ts` already
  support a required-role arg (used elsewhere for `"ADMIN"`-gated routes, e.g. `/admin/users`,
  `/settings/db`) — reuse as-is, no auth-guard changes needed.
- **VALIDATE read every OrderSheet/OrderLine/NoteLine call site directly (`grep -rn
  "prisma\.orderSheet\.\|prisma\.orderLine\.\|prisma\.noteLine\."` across `src/`)** — confirms the
  table below is exhaustive; no additional call site exists outside it (the `products/actions.ts`
  and `shops/actions.ts` `updateMany` calls are the pre-existing correction-cascade snapshot
  back-fill and are out of this plan's scope — they touch `OrderLine`/`NoteLine` by `shopId`/
  `variantId`, never by sheet activity state).

  | File | What it does today | Change needed |
  |---|---|---|
  | `src/app/(main)/orders/page.tsx` | `prisma.orderSheet.findMany(...)` — lists all sheets, no filter | add `where: { active: true }`; read session role; render delete button + wire confirm modal for ADMIN only |
  | `src/app/(main)/orders/[id]/page.tsx` | `prisma.orderSheet.findUnique({ where: { id: sheetId } })` — editor | if found but `!active`, treat as `notFound()` (soft-deleted sheet is not editable, matches "does not exist" semantics) |
  | `src/lib/get-sheet-for-print.ts` | `prisma.orderSheet.findFirst({...})` (line 91) — shared fetch used by BOTH print routes | add `active: true` to the `where` clause so a soft-deleted sheet's print route returns `found: false` — VERIFIED at VALIDATE: both print pages already render a graceful not-found state for `found: false` |
  | `src/app/print/daily/[date]/page.tsx` | calls `get-sheet-for-print.ts` | none — inherits the fix above |
  | `src/app/print/shops/[date]/page.tsx` | calls `get-sheet-for-print.ts` | none — inherits the fix above |
  | `src/app/(main)/summary/page.tsx` | `requireAuth()`, resolves ONE `sheet` via `orderSheet.findFirst` (two branches: `?date=` lookup, or "most recent"), then scopes every other query to `sheetId: sheet.id` — **VALIDATE read the file in full: no `groupBy` anywhere in this file** | add `active: true` to the `where` of BOTH `findFirst` branches (Plan Update P1) |
  | `src/app/(main)/history/page.tsx` | `requireAuth()`, then `prisma.orderLine.groupBy(...)` + `noteLine.groupBy(...)` keyed by `sheetId`, reduced into an `agg` map that is only ever read via `agg.get(sheet.id)` for sheets present in `sheets = await prisma.orderSheet.findMany(...)` (no filter) — **VALIDATE read the file in full: the primary `sheets` findMany is the only query that needs the filter; the two `groupBy` calls need NO change** | add `where: { active: true }` to the `orderSheet.findMany` ONLY (Plan Update P1) |
  | `src/app/(main)/orders/actions.ts` `createOrderSheet` | dup-check `tx.orderSheet.findFirst({ where: { date, location } })` — no active filter | add `active: true` (Plan Update P2 — see below) |
  | `src/app/(main)/orders/actions.ts` `saveOrderSheet` | `prisma.orderSheet.findUnique({ where: { id: sheetId } })`, checks only `!sheet` | check `!sheet || !sheet.active` (Plan Update P3 — see below) |

- `Modal` primitive (`src/components/ui/modal.tsx`) exists and is reusable as-is: controlled `open`/
  `onClose`, Escape + scrim-click to close, pguard-styled panel — VERIFIED at VALIDATE by reading the
  file. This is the **first confirm-before-destroy pattern in the codebase** — no prior art to copy;
  this plan is the reference implementation for future destructive-action confirms.
- `nav.tsx` pattern for reading role server-side: `const session = await auth(); const role = session.user.role;` — reuse the same idiom in `orders/page.tsx` (a server component) to conditionally render the delete UI.
- The delivery/db split from Phase 06 established the precedent for a shared **prod** DB: dev sandbox
  gets a real Prisma migration; the customer's live DB (`db_TCL`) gets a **hand-authored, scoped SQL
  script** delivered for the DBA to run — never `prisma migrate deploy`/`reset` against it. This plan
  follows that same split (see Design item 2 and `database/all-database.md` §DANGER guardrails, and
  `docs/deployment-guide.md` for the delivery precedent). **VALIDATE re-confirmed against the current
  `database/all-database.md` §DANGER guardrails (dated 11-07-26): db_TCL is the customer's shared LIVE
  ERP database (external SQL Server `43.229.134.162`, SQL Server 2019 Enterprise, `COMPATIBILITY_LEVEL
  130`, collation `Thai_CI_AS`) — the plan's ALTER script (below) matches guardrail #3 exactly (hand-written
  SQL scoped to orderstock's own tables) and is standard ANSI-compatible T-SQL safe at compat level 130.**

## Design

### 1. Schema change (additive only — extend `prisma/schema.prisma`, never rewrite)

```prisma
model OrderSheet {
  id        Int      @id @default(autoincrement())
  date      DateTime @db.Date
  location  String?  @db.NVarChar(200)
  active    Boolean  @default(true)      // NEW — soft-delete flag, mirrors Shop/Product/User
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orderLines OrderLine[]
  noteLines  NoteLine[]

  @@index([date])
}
```

No new `@@index([active])`: `date` is already indexed and every list/read query is small (one
business's daily sheets — dozens to low hundreds of rows total, not a high-cardinality table). Adding
an index without a proven read-path bottleneck violates YAGNI; document this decision in the plan and
revisit only if `orders/page.tsx` becomes measurably slow.

### 2. Migration strategy — CRITICAL, read before EXECUTE touches any DB

Two DBs, two procedures. Never conflate them.

**(a) Sandbox (`localhost:1433`, disposable, dev-only)** — safe to use Prisma normally:
```bash
pnpm prisma migrate dev --name ordersheet_active
```
This is the repo's existing convention (`prisma/migrations/` has 3 prior migrations from Phase 02+).
Apply it, verify the generated SQL only adds the one column with `DEFAULT 1`.

**(b) db_TCL (external, LIVE shared ERP DB — the customer's real production database)** — this is
the same class of DB `database/all-database.md` §DANGER guardrails and Phase 06 warn about. Rules:
- **NEVER** run `prisma migrate reset` or `prisma migrate dev` against it.
- **NEVER** re-run `db/create-database-and-login.sql` (that script `CREATE`s the DB/login — it is
  not idempotent against an existing populated DB).
- The ONLY allowed change is a single, additive, hand-authored, reviewed statement, delivered as a
  **NEW** file `db/alter-ordersheet-add-active.sql`:
  ```sql
  -- Additive, safe against a live populated table: NOT NULL + DEFAULT backfills existing rows to 1
  -- (active) in the same statement. Idempotent-guarded so re-running is a no-op.
  IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[OrderSheet]') AND name = 'active'
  )
  BEGIN
    ALTER TABLE [dbo].[OrderSheet]
      ADD [active] BIT NOT NULL CONSTRAINT [DF_OrderSheet_active] DEFAULT 1;
  END
  ```
- **Ordering constraint (must be stated in the delivery note / deployment-guide addendum):** this
  ALTER MUST be applied to db_TCL **before or atomically with** deploying the new application code.
  If the code deploys first, every `OrderSheet` query (all 8 sites above) will error — Prisma expects
  the `active` column to exist. Document this explicitly in the phase report / handoff so whoever
  ships this feature to the customer doesn't reorder the steps.
- This script is scoped, single-table, single-column, backward-compatible (existing rows all become
  `active = 1`, i.e. visible — zero visible behavior change until someone deletes a sheet). VALIDATE
  confirmed this syntax is safe at `COMPATIBILITY_LEVEL 130` (the live server's actual level) — no
  compat-level-dependent T-SQL feature is used.

### 3. Server action — `src/app/(main)/orders/actions.ts` (extend, do not rewrite the file)

```ts
export interface DeleteSheetActionState {
  error?: string;
  ok?: boolean;
}

export async function softDeleteOrderSheet(
  _prev: DeleteSheetActionState,
  formData: FormData,
): Promise<DeleteSheetActionState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return denied;

  const idRaw = formData.get("id");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "รหัสใบออเดอร์ไม่ถูกต้อง" };
  }

  const sheet = await prisma.orderSheet.findUnique({ where: { id }, select: { id: true, active: true } });
  if (!sheet || !sheet.active) {
    // Already gone / already deleted — idempotent success, not an error (avoids a race-condition
    // error on double-submit).
    revalidatePath("/orders");
    return { ok: true };
  }

  await prisma.orderSheet.update({ where: { id }, data: { active: false } });
  revalidatePath("/orders");
  return { ok: true };
}
```

Follows the file's existing conventions: `requireAuthState` at the top, Thai error strings, zod is
NOT needed here (the only input is a numeric FK, validated with a plain `Number.isInteger` check —
adding zod for a single integer would be over-engineering per YAGNI/KISS).

### 4. Read-path filters — exact change per site (CORRECTED AT VALIDATE)

VALIDATE read `history/page.tsx` and `summary/page.tsx` in full (they were only partially
transcribed/deferred in the original PLAN draft) and traced the actual data flow. **Do NOT implement
the `groupBy` relation-filter Option A/B described in earlier drafts of this plan — it is
unnecessary in both files.** This retires Open Questions 2 and 3 below and removes the Prisma
7.8.0 `groupBy().where` relation-filter feasibility question entirely — it is not load-bearing for
this plan, regardless of whether that Prisma feature is supported.

- **`orders/page.tsx`**: add `where: { active: true }` to the existing `findMany`. Also read
  `session.user.role` (server-side, via `auth()` same as `nav.tsx`) to decide whether to render the
  delete button per row.
- **`orders/[id]/page.tsx`**: after `prisma.orderSheet.findUnique(...)`, change the not-found check
  to `if (!sheet || !sheet.active) notFound();` (currently just `if (!sheet) notFound();`).
- **`src/lib/get-sheet-for-print.ts`**: add `active: true` to the `where` clause of the `findFirst`
  call at line 91. VERIFIED at VALIDATE: both `print/daily/[date]/page.tsx` and
  `print/shops/[date]/page.tsx` already render a graceful not-found state for `found: false`
  (`ไม่พบใบออเดอร์ของวันที่นี้` / `ไม่พบร้านค้าที่มีออเดอร์ในวันที่นี้`) — no follow-up needed there.
- **`history/page.tsx`** (**Plan Update P1**, SIMPLIFIED at VALIDATE): `rows` is built from
  `sheets = await prisma.orderSheet.findMany({ orderBy: [...] })` — this is the ONLY query that
  needs the filter. The two `groupBy` calls (`orderLine.groupBy`/`noteLine.groupBy`, unfiltered,
  keyed by `sheetId`) feed an `agg` lookup map that is only ever read via `agg.get(sheet.id)` for
  sheets present in the (now-filtered) `sheets` array — an inactive sheet's aggregate bucket, even
  if computed, is simply never looked up, so it's harmless to leave the `groupBy` calls unfiltered.
  **Fix: add `where: { active: true }` to the `orderSheet.findMany` call only. Leave both `groupBy`
  calls exactly as they are.**
- **`summary/page.tsx`** (**Plan Update P1**, SIMPLIFIED at VALIDATE): resolves ONE `sheet` via
  `prisma.orderSheet.findFirst(...)` (two branches: `?date=` lookup, or "most recent" —
  `orderBy: [{date:"desc"},{id:"desc"}]`, currently unfiltered), then scopes every subsequent query
  (`orderLine.findMany`/`noteLine.findMany`) to `sheetId: sheet.id` — there is no `groupBy` anywhere
  in this file. **Fix: add `active: true` to the `where` clause of BOTH `findFirst` branches.** With
  that fix: a soft-deleted sheet can never resolve as "most recent" (closes a real latent bug — today
  deleting the newest sheet would leave `/summary` silently still showing it), and `?date=` for a
  soft-deleted date correctly falls through to the existing "ยังไม่มีใบออเดอร์" not-found render
  (`if (!sheet) { ... }`, already present, zero new code needed there).
- **`orders/actions.ts` `createOrderSheet`** (**Plan Update P2**, NEW at VALIDATE — closes a
  redirect-to-404 loop): the duplicate-check `tx.orderSheet.findFirst({ where: { date, location } })`
  does not exclude inactive sheets today. If a sheet for that date+location was soft-deleted and an
  ADMIN opens "เปิดใบออเดอร์ใหม่" for the SAME date+location, this check currently finds the deleted
  sheet, treats it as "existing," and redirects to `/orders/${deletedId}` — which then 404s per the
  `orders/[id]/page.tsx` fix above, trapping the user in a dead end. **Fix: add `active: true` to
  this `where` clause** so a fresh sheet is correctly created after the old one for that
  date+location was deleted.
- **`orders/actions.ts` `saveOrderSheet`** (**Plan Update P3**, NEW at VALIDATE — closes a
  resurrect-via-raw-POST gap): `saveOrderSheet`'s `prisma.orderSheet.findUnique({ where: { id:
  sheetId } })` only checks `!sheet`, not `!sheet.active`. The UI can never reach this action for a
  soft-deleted sheet (the editor page 404s first), but a hand-crafted direct POST with a known
  deleted sheet id would currently succeed and silently write fresh `OrderLine`/`NoteLine` rows to an
  invisible sheet. **Fix: change the check to `if (!sheet || !sheet.active) return { error:
  "ไม่พบใบออเดอร์" };`** — matches the "soft-deleted = does not exist" semantics already established
  for the editor page, reuses the same error string already used for the not-found case, zero new UI
  surface.

### 5. UI — `orders/page.tsx` + new `orders/delete-sheet-button.tsx`

`orders/page.tsx` (server component) becomes ADMIN-aware:

```tsx
const session = await auth();
const role = session?.user?.role;
// ...
<td className="py-2 pr-2 text-right">
  <Link href={`/orders/${sheet.id}`} className="text-[var(--brand-int)] hover:underline">เปิด/แก้ไข</Link>
  {role === "ADMIN" && (
    <DeleteSheetButton sheetId={sheet.id} dateLabel={ceToBeDisplay(normalizeDbDate(sheet.date))} />
  )}
</td>
```

New client component `src/app/(main)/orders/delete-sheet-button.tsx`:
- `"use client"`, imports `Modal` from `src/components/ui/modal.tsx` and `useActionState` (React 19).
  VALIDATE confirmed the exact usage pattern by reading `new-sheet-form.tsx`
  (`import { useActionState } from "react"`) — reuse the same idiom.
- Local `open` state for the modal. Delete icon/text button (Thai: `ลบ`) opens the modal.
- Modal body: confirm copy referencing the sheet's date (e.g. `ยืนยันลบใบออเดอร์วันที่ [date]?
  ข้อมูลจะถูกซ่อนแต่ไม่ถูกลบถาวร` — "the data will be hidden but not permanently deleted", matching
  the actual soft-delete semantics so the ADMIN isn't misled into thinking it's irreversible-forever;
  it IS effectively irreversible from the UI since there's no restore UI, so word this carefully;
  final Thai copy is an EXECUTE-time judgment call, not a blocking plan gap).
  - Two buttons inside the modal: `ยกเลิก` (cancel → `onClose`) and `ลบ` (confirm → submits the
    `softDeleteOrderSheet` form, styled with the button primitive's `"danger-ghost"` variant —
    VALIDATE confirmed this exact prop value exists in `src/components/ui/button.tsx`:
    `type Variant = "primary" | "secondary" | "danger-ghost"`).
- On successful delete (`ok: true`), close the modal; `revalidatePath("/orders")` inside the action
  already triggers the list to refresh (Next.js server-action revalidation — no client refetch
  needed).
- Token-driven styling only (pguard semantic aliases, IBM Plex fonts) — no new raw palette colors,
  per `uxui/all-uxui.md`.

## Touchpoints

| File | Type |
|---|---|
| `prisma/schema.prisma` | extend — `OrderSheet.active` field |
| `db/alter-ordersheet-add-active.sql` | new — db_TCL delivery script |
| `src/app/(main)/orders/actions.ts` | extend — new `softDeleteOrderSheet` action + P2/P3 guard-clause fixes to `createOrderSheet`/`saveOrderSheet` |
| `src/app/(main)/orders/page.tsx` | extend — active filter, role read, delete button |
| `src/app/(main)/orders/[id]/page.tsx` | extend — inactive → notFound |
| `src/app/(main)/orders/delete-sheet-button.tsx` | new — client component + confirm modal |
| `src/lib/get-sheet-for-print.ts` | extend — active filter |
| `src/app/(main)/history/page.tsx` | extend — active filter on the primary `findMany` only (groupBy calls untouched) |
| `src/app/(main)/summary/page.tsx` | extend — active filter on both `findFirst` branches |
| `src/lib/__tests__/auth-guard-coverage.test.ts` | extend — Plan Update P4: add `softDeleteOrderSheet` to `orders/actions.ts`'s `expected` array + one new per-function ADMIN-gate assertion |
| `e2e/orders.spec.ts` | extend — soft-delete e2e gates + P2/P3 regression gates |
| `e2e/summary-history.spec.ts` | extend — exclusion gates |
| `e2e/print.spec.ts` | extend — not-found-on-delete gate |
| `e2e/auth.spec.ts` | extend — ADMIN-only action gate |

## Acceptance Criteria

1. ADMIN can soft-delete an `OrderSheet` from `/orders`; the row disappears from the list
   immediately (no manual refresh needed) — proven by the "sheet disappears from list" E2E gate.
2. Soft-deleted sheet's `OrderLine`/`NoteLine` rows are NOT deleted — proven by the "still exists in
   DB with active=false" E2E gate.
3. Soft-deleted sheet is excluded from `/summary`, `/history`, both print routes, and its own editor
   route (404s) — proven by the 4 corresponding E2E gates in Verification Evidence.
4. STAFF cannot delete a sheet — no delete button rendered, AND a direct action call is rejected
   server-side — proven by the ADMIN-only E2E gate.
5. Existing 98 unit tests and 25 e2e tests continue to pass unmodified (except the deliberately
   extended specs above) — proven by the regression gates.
6. The db_TCL migration path is delivered as a reviewed, additive, idempotent SQL script — never
   auto-applied by any agent — proven by the Agent-Probe review gate.
7. **(added at VALIDATE)** Creating a new sheet for a date+location whose prior sheet was
   soft-deleted creates a genuinely new sheet, not a redirect into a 404 dead end — proven by the
   `createOrderSheet` dup-check E2E gate (Plan Update P2).
8. **(added at VALIDATE)** A direct/raw call to `saveOrderSheet` against a soft-deleted sheet id is
   rejected and writes nothing — proven by the `saveOrderSheet` guard-clause E2E gate (Plan Update P3).

## Implementation Checklist

1. Add `active Boolean @default(true)` to `OrderSheet` in `prisma/schema.prisma`.
2. Run `pnpm prisma migrate dev --name ordersheet_active` against the LOCAL sandbox only; verify
   generated SQL is exactly one `ADD COLUMN`.
3. Write `db/alter-ordersheet-add-active.sql` (idempotency-guarded, additive; delivery artifact —
   do not execute against db_TCL).
4. Add `softDeleteOrderSheet(prevState, formData)` to `src/app/(main)/orders/actions.ts` per Design
   item 3 (ADMIN-only via `requireAuthState("ADMIN")`, idempotent on already-inactive sheets).
5. Update `src/app/(main)/orders/page.tsx`: add `where: { active: true }` to the `findMany`; read
   `session.user.role` via `auth()`; conditionally render the delete UI for ADMIN.
6. Create `src/app/(main)/orders/delete-sheet-button.tsx`: client component wrapping
   `ui/modal.tsx`, `useActionState` submit to `softDeleteOrderSheet`, Thai confirm copy.
7. Update `src/app/(main)/orders/[id]/page.tsx`: change not-found check to
   `if (!sheet || !sheet.active) notFound();`.
8. Update `src/lib/get-sheet-for-print.ts`: add `active: true` to the `findFirst` `where` clause
   (line 91). (Both print pages' `found: false` handling already verified at VALIDATE — no change
   needed there.)
9. Update `src/app/(main)/history/page.tsx`: add `where: { active: true }` to the `orderSheet.findMany`
   call only. Leave both `groupBy` calls untouched (VALIDATE-confirmed unnecessary — see Design item 4).
10. Update `src/app/(main)/summary/page.tsx`: add `active: true` to the `where` clause of BOTH
    `orderSheet.findFirst` branches (`?date=` lookup and "most recent" lookup). No groupBy/relation-filter
    work needed (VALIDATE-confirmed — see Design item 4).
11. Update `src/app/(main)/orders/actions.ts` `createOrderSheet`: add `active: true` to the
    duplicate-check `findFirst` (Plan Update P2 — prevents a redirect-to-404 loop after a
    same-date/location sheet was soft-deleted).
12. Update `src/app/(main)/orders/actions.ts` `saveOrderSheet`: change the not-found check to
    `if (!sheet || !sheet.active) return { error: "ไม่พบใบออเดอร์" };` (Plan Update P3 — rejects a
    raw POST that would otherwise silently write to a soft-deleted sheet).
13. Extend `src/lib/__tests__/auth-guard-coverage.test.ts` (Plan Update P4): add `softDeleteOrderSheet`
    to the `orders/actions.ts` module's `expected` array; add ONE new dedicated test asserting
    `softDeleteOrderSheet`'s body matches `/requireAuth(State)?\(\s*"ADMIN"\s*\)/` — `orders/actions.ts`
    is a MIXED module (not all actions are ADMIN-only), so the existing whole-module `ADMIN_MODULES`
    check cannot be reused as-is; a per-function assertion is required instead.
14. Add/extend E2E gates per the Verification Evidence table (`e2e/orders.spec.ts`,
    `e2e/summary-history.spec.ts`, `e2e/print.spec.ts`, `e2e/auth.spec.ts`), including the two new
    P2/P3 regression gates.
15. Run full regression: `pnpm test` (98 unit) and `pnpm test:e2e` (25+ e2e) against the sandbox,
    with the `.env` swap procedure in Resume and Execution Handoff followed exactly, including
    byte-exact restoration afterward.
16. Update `process/context/database/all-database.md` with the new `OrderSheet.active` field if the
    model documentation there needs it (non-blocking context-maintenance follow-up).

## Phase Completion Rules

This is a single-plan (non-phase-program) COMPLEX plan. It is `CODE DONE` when Implementation
Checklist items 1–14 are complete and all Verification Evidence gates in the "Fully-Automated" and
"Hybrid" rows are green. It is `VERIFIED` only when, in addition: (a) the Agent-Probe review of
`db/alter-ordersheet-add-active.sql` has been performed and recorded, and (b) the full regression
suite (item 15) passes with the `.env` restored byte-exact to its original db_TCL value. It is
**never** considered fully deployed until the customer's DBA has applied
`db/alter-ordersheet-add-active.sql` to db_TCL and the app code is deployed — that step is outside
this plan's execution scope (delivery artifact only, per the High-Risk Execution Handoff in Blast
Radius).

## Validate Contract

Status: PASS
Date: 11-07-26
date: 2026-07-11
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: single-agent read-only VALIDATE pass (no fan-out infra available in this session); signals
present: S2 (schema/auth surface), S6 (high-risk class: schema migration on shared live prod DB),
S7 (10 blast-radius files) → score 3/7 (MEDIUM), which under normal fan-out conditions would
recommend parallel subagents for Layer 1/Layer 2; executed sequentially here via direct evidence
gathering (file reads + grep + structural validator) in one continuous pass, matching the same
methodology the Layer 1/Layer 2 role specs define.

### V2/V3 — Two-Layer Fan-Out Findings

**Layer 1 — dimension findings**

| Layer 1 dimensions | Status |
|---|---|
| Infra fit | PASS — no container/infra/worker/port surfaces touched; db_TCL guardrails re-verified against the current `database/all-database.md` (dated 11-07-26) and matched exactly (hand-authored idempotent ALTER, scoped to the 9 orderstock tables, compat-level-130-safe syntax) |
| Test coverage | PASS — all 4 tiers assigned correctly, high-risk minimums met/exceeded (auth: Fully-Automated exceeds Hybrid minimum; schema/migration: Agent-Probe with explicit, correct rationale for why full automation is forbidden) |
| Breaking changes | PASS — Public Contracts section accurately scoped: one new server action, one additive nullable-default schema field; no existing exported function signature changes |
| Security surface | CONCERN (resolved via Plan Update P4) — the new `softDeleteOrderSheet` action lives in a MIXED module (`orders/actions.ts`, not all-ADMIN); the existing `auth-guard-coverage.test.ts` whole-module `ADMIN_MODULES` check cannot verify per-function ADMIN-specificity for a mixed module, so the regression suite would not catch a future accidental removal of the `"ADMIN"` arg. Fixed by adding a dedicated per-function assertion (checklist item 13). No audit-trail (`deletedBy`/`deletedAt`) gap noted but NOT counted as a new regression — it matches the pre-existing `Shop`/`Product`/`User` soft-delete pattern verbatim (see Open gaps below). |

**Layer 2 — per-section feasibility**

| Layer 2 sections | Status |
|---|---|
| Section 1 — Schema change | PASS — mechanical feasibility confirmed (`schema.prisma:100-111` matches plan's transcription exactly); no `@@index` needed, correctly justified by YAGNI + existing `Shop.rosterOrder`-scale precedent; no conflicts |
| Section 2 — Migration strategy | PASS — sandbox path matches repo convention (3 prior migrations exist); db_TCL ALTER script text is idempotent, single-table/column, and matches all 5 DANGER guardrails in `database/all-database.md` verbatim; highest-risk edit (db_TCL touch) is correctly scoped as delivery-artifact-only, never agent-executed |
| Section 3 — Server action | PASS — `requireAuthState("ADMIN")` usage matches the documented `auth/all-auth.md` contract exactly; idempotent-on-already-inactive handling avoids a double-submit race error |
| Section 4 — Read-path filters | **CONCERN → RESOLVED via Plan Update P1 (this VALIDATE pass) + FEASIBILITY finding below** — see full writeup |
| Section 4b — Read-path edge cases (createOrderSheet/saveOrderSheet) | **CONCERN → RESOLVED via Plan Updates P2/P3** — two write-path gaps found by tracing the full data flow (not in the plan's original site table); both fixed with a single added `where`/`if` clause each, zero new files |
| Section 5 — UI | PASS — `Modal` API shape, `useActionState` import pattern, and the `"danger-ghost"` button variant were all read directly from source and match the plan's assumptions exactly; no EXECUTE-time guesswork required |

**Totals: 0 FAILs / 3 CONCERNs (all 3 resolved via Plan Updates applied to this plan file during this VALIDATE pass, before writing this contract) / 4 PASSes**

**→ Net Gate: PASS**

### FEASIBILITY finding (task priority 1 — Prisma 7.8.0 `groupBy` relation filter)

**Resolution: the question is MOOT for this plan.** VALIDATE read `history/page.tsx` and
`summary/page.tsx` in full (both were only partially transcribed in the pre-VALIDATE plan draft) and
traced the actual data flow line-by-line:

- `history/page.tsx`: the rendered `rows` array comes from `sheets.map(...)`, where `sheets` is the
  PRIMARY `orderSheet.findMany` (currently unfiltered). The two `groupBy` calls only feed a lookup
  map that is read exclusively via `agg.get(sheet.id)` for sheets already present in `sheets` — so
  filtering `sheets` alone (not the `groupBy` calls) is both necessary and sufficient to exclude a
  soft-deleted sheet from the page.
- `summary/page.tsx`: there is no `groupBy` in this file at all. It resolves exactly ONE `sheet` via
  `orderSheet.findFirst`, then every other query is scoped to `sheetId: sheet.id`. Filtering the
  `findFirst` calls alone is necessary and sufficient.

Therefore neither call site needs Prisma's `groupBy().where` relation-filter support (the plan's
originally-proposed Option A) or the two-step id-list fallback (Option B). **This finding does not
depend on Prisma version behavior at all — it is a pure data-flow fact, verified with HIGH
confidence by direct source reading, not by Prisma documentation or a live probe.** No empirical
Prisma probe was run this session (`.env` access requires interactive approval not available in
this VALIDATE pass, and the finding does not require one — it is independent of the mechanism's
existence). The plan text has been corrected (Design item 4, Implementation Checklist items 9-10,
Open Questions 2-3) to remove the Option A/B proposal entirely.

### Read-site completeness (task priority 2)

Re-grepped the full `src/` tree for every `prisma.orderSheet.` / `prisma.orderLine.` /
`prisma.noteLine.` call site. Confirms the plan's 6-site table was ALMOST exhaustive — it correctly
covered `orders/page.tsx`, `orders/[id]/page.tsx`, `get-sheet-for-print.ts` (+ both print pages),
`history/page.tsx`, `summary/page.tsx` — but missed two write-path sites in `orders/actions.ts`
(`createOrderSheet`'s duplicate-check `findFirst`, `saveOrderSheet`'s `findUnique`), both fixed via
Plan Update P2/P3. No other call site exists outside this now-8-site list; the `products/actions.ts`
and `shops/actions.ts` `updateMany` calls are the pre-existing correction-cascade snapshot back-fill,
unrelated to sheet activity state, correctly out of scope.

### Migration safety (task priority 3)

Confirmed: the db_TCL change is a hand-authored idempotent `ALTER TABLE ... ADD ... DEFAULT 1`
script (`db/alter-ordersheet-add-active.sql`, delivery artifact, never auto-applied by any agent),
matching the `database/all-database.md` §DANGER guardrails verbatim (re-read this VALIDATE session,
dated 11-07-26). Sandbox gets a normal `prisma migrate dev`. The ordering constraint (ALTER before
or with code deploy) is explicitly documented in the plan's Design item 2(b). The `.env`
swap-to-sandbox-and-restore-byte-exact procedure is fully spelled out in "Resume and Execution
Handoff" with an explicit warning never to point at db_TCL for tests. This VALIDATE pass did NOT
attempt to read `.env` (the privacy hook requires interactive approval unavailable in this session)
— this is not required for VALIDATE feasibility and is correctly deferred to EXECUTE, which the plan
already instructs to check `.env`'s current value first thing.

### Auth + UI correctness (task priority 4)

Confirmed: `softDeleteOrderSheet` uses `requireAuthState("ADMIN")` (Design item 3, matches
`auth/all-auth.md` contract). List delete button renders for ADMIN only (`role === "ADMIN"` read via
`auth()`, same idiom as `nav.tsx`) AND the action re-checks server-side (defense in depth — a raw
POST as STAFF is rejected by `requireAuthState("ADMIN")` regardless of UI state). No native
`confirm()` — uses the `ui/modal.tsx` primitive (verified: controlled `open`/`onClose`, Escape +
scrim-click close). One CONCERN found and resolved: the mixed-module `auth-guard-coverage.test.ts`
gap (Plan Update P4, see Security surface above).

### Breaking changes / untouched (task priority 5)

Confirmed: `order-payload.ts`, `totals.ts`, `order-save.ts`, the 446 fixture, print mm CSS, and
`saveOrderSheet`'s/`createOrderSheet`'s core save/create logic (delete-and-recreate, snapshot
carry-forward, dup-redirect flow) are ALL left untouched beyond the two small guard-clause additions
in Plan Updates P2/P3 (one added `where` field, one added `if` condition — no logic restructuring).
`schema.prisma` is extended (one new field), not rewritten. All read pages are extended, not
rewritten.

### Test gates (C3 5-column table)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | ADMIN soft-deletes a sheet via the modal; row disappears from `/orders` list immediately | Fully-Automated | `e2e/orders.spec.ts` — "ADMIN soft-deletes a sheet; it disappears from /orders list" | A |
| AC2 | Soft-deleted sheet's `OrderLine`/`NoteLine` rows are NOT deleted (verify `active=false` + lines intact via direct Prisma read in-test) | Fully-Automated | `e2e/orders.spec.ts` — "soft-deleted sheet still has OrderLine/NoteLine rows in DB with active=false" | A |
| AC3a | Soft-deleted sheet excluded from `/summary` for that date | Fully-Automated | `e2e/summary-history.spec.ts` — "soft-deleted sheet excluded from /summary" | A |
| AC3b | Soft-deleted sheet excluded from `/history` list for that date | Fully-Automated | `e2e/summary-history.spec.ts` — "soft-deleted sheet excluded from /history" | A |
| AC3c | Soft-deleted sheet's print routes (`/print/daily/[date]`, `/print/shops/[date]`) render not-found | Fully-Automated | `e2e/print.spec.ts` — "soft-deleted sheet's print routes render not-found" | A |
| AC3d | Soft-deleted sheet's editor route `/orders/[id]` 404s | Fully-Automated | `e2e/orders.spec.ts` — "soft-deleted sheet's /orders/[id] editor 404s" | A |
| AC4 | STAFF cannot delete: no button rendered AND direct action call rejected server-side | Fully-Automated | `e2e/auth.spec.ts` — "STAFF cannot soft-delete a sheet (UI hidden + server rejects)" | A |
| AC7 (P2) | `createOrderSheet` dup-check excludes inactive sheets — no redirect-to-404 loop | Fully-Automated | `e2e/orders.spec.ts` — "new sheet for a date whose prior sheet was soft-deleted creates a fresh sheet, not a redirect to the deleted one" | A |
| AC8 (P3) | `saveOrderSheet` rejects a direct write to a soft-deleted sheet id | Fully-Automated | `e2e/orders.spec.ts` — "direct save to a soft-deleted sheet id returns an error, writes nothing" | A |
| P4 | `softDeleteOrderSheet` is specifically ADMIN-gated (mixed-module regression guard) | Fully-Automated | `src/lib/__tests__/auth-guard-coverage.test.ts` — "softDeleteOrderSheet requires ADMIN role specifically" | A |
| AC5 | Existing 98 unit + 25 e2e continue to pass unmodified (except the deliberately extended specs) | Fully-Automated | `pnpm test` && `pnpm test:e2e` | A |
| AC6a | Sandbox migration applies cleanly, generates exactly one `ADD COLUMN` | Hybrid | `pnpm prisma migrate dev --name ordersheet_active` — precondition: sandbox `orderstock-sql` container up | A |
| AC6b | `db/alter-ordersheet-add-active.sql` reviewed for safety before delivery (idempotency guard present, no destructive keywords, single table/column scope) | Agent-Probe | manual/agent code review, never executed against db_TCL | A |
| — | Pure-logic unit extraction for `softDeleteOrderSheet` | Known-Gap | — (documented, non-behavioral: action is thin CRUD+auth, not worth isolating per YAGNI; the SAME behavior is fully proven by the Fully-Automated E2E gates above) | D |

gap-resolution legend: A — proven now (gate passes in this cycle). D — backlog test-building stub / named residual (documented above), kept-active, non-blocking.

C-4 reconciliation: all 3 proving strategies used are Fully-Automated / Hybrid / Agent-Probe; the one Known-Gap row is a named residual (gap-resolution D), never claimed as a proving strategy — the behavior it would have covered (delete-action correctness) is independently proven Fully-Automated above, so this is not a vacuous-green case.

**Failing stubs (Fully-Automated rows only):**

```
// AC1
test("should soft-delete a sheet via the modal and remove it from the /orders list", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: ADMIN soft-deletes a sheet; it disappears from /orders list")
})

// AC2
test("should retain OrderLine/NoteLine rows with active=false after soft-delete", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: soft-deleted sheet still has OrderLine/NoteLine rows in DB with active=false")
})

// AC3a
test("should exclude a soft-deleted sheet from /summary for that date", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: soft-deleted sheet excluded from /summary")
})

// AC3b
test("should exclude a soft-deleted sheet from /history for that date", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: soft-deleted sheet excluded from /history")
})

// AC3c
test("should render not-found on both print routes for a soft-deleted sheet", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: soft-deleted sheet's print routes render not-found")
})

// AC3d
test("should 404 the editor route for a soft-deleted sheet", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: soft-deleted sheet's /orders/[id] editor 404s")
})

// AC4
test("should hide the delete button from STAFF and reject a direct STAFF call server-side", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: STAFF cannot soft-delete a sheet (UI hidden + server rejects)")
})

// AC7 (P2)
test("should create a fresh sheet, not redirect to a deleted one, for a re-used date+location", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: new sheet for a date whose prior sheet was soft-deleted creates a fresh sheet, not a redirect to the deleted one")
})

// AC8 (P3)
test("should reject a direct saveOrderSheet call against a soft-deleted sheet id", async () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: direct save to a soft-deleted sheet id returns an error, writes nothing")
})

// P4
test("should require the ADMIN role specifically for softDeleteOrderSheet", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: softDeleteOrderSheet requires ADMIN role specifically")
})
```

AC5 (full regression run) has no stub — it re-runs the existing suites, it is not a new scenario.

**Legacy line form (retained for existing consumers):**

- Soft-delete core flow (AC1-AC4): Fully-Automated: `pnpm test:e2e` extended `e2e/orders.spec.ts`, `e2e/summary-history.spec.ts`, `e2e/print.spec.ts`, `e2e/auth.spec.ts`
- Write-path edge cases (AC7-AC8, Plan Updates P2/P3): Fully-Automated: extended `e2e/orders.spec.ts`
- ADMIN-gate regression (P4): Fully-Automated: extended `src/lib/__tests__/auth-guard-coverage.test.ts`
- Regression floor (AC5): Fully-Automated: `pnpm test` (98) + `pnpm test:e2e` (25+)
- Sandbox migration (AC6a): Hybrid: `pnpm prisma migrate dev --name ordersheet_active` (precondition: sandbox up)
- db_TCL script review (AC6b): Agent-Probe: manual/agent code review, never executed
- Delete-action pure-logic unit: Known-Gap: documented, non-behavioral (YAGNI)

### Dimension findings

- Infra fit: PASS — no container/infra/worker/port surfaces touched; db_TCL guardrails re-verified and matched exactly.
- Test coverage: PASS — all tiers correctly assigned; high-risk minimums met/exceeded.
- Breaking changes: PASS — additive schema field + new action only; no signature changes to existing exports beyond two added guard clauses.
- Security surface: PASS (after Plan Update P4 applied) — ADMIN-only enforced at UI + server-action layers; mixed-module regression gap closed.

### Open gaps

- No `deletedBy`/`deletedAt` audit-trail columns on the soft-delete. **Not a new regression** — matches the existing `Shop`/`Product`/`User` soft-delete pattern exactly (none of those have an audit trail either). Recorded here as a documented, non-blocking, cross-cutting known-gap; worth a future backlog note covering ALL soft-deletable models at once if audit trail is ever prioritized, not scoped to this plan.
- Exact Thai confirm-modal copy — deferred to EXECUTE as a judgment call (Design item 5), non-blocking.

### What this coverage does NOT prove

- The Fully-Automated E2E gates prove the soft-delete/exclusion behavior against the SANDBOX SQL Server only — they do not prove behavior against db_TCL's actual `COMPATIBILITY_LEVEL 130` / `Thai_CI_AS` collation combination (the ALTER script's syntax was reviewed for compat-level safety, but no live query was run against db_TCL — by design, per the DANGER guardrails).
- The Agent-Probe review of `db/alter-ordersheet-add-active.sql` proves the script's textual safety (idempotency, scope, no destructive keywords) — it does NOT prove the script actually applies cleanly on the customer's live server; that can only be confirmed by the customer's DBA at delivery time, outside this plan's execution scope.
- The mixed-module ADMIN-gate regression test (P4) proves the `requireAuth(State)?("ADMIN")` CALL exists in `softDeleteOrderSheet`'s source — it does not prove `requireAuthState`'s internal correctness (that is covered by the existing, unmodified `auth-guard.ts` test suite).
- No audit-trail coverage exists or is claimed (see Open gaps above) — "who deleted what, when" cannot be reconstructed from the app; only a direct DB inspection of `active=false` rows is possible.

Gate: PASS (no unresolved FAILs, no unresolved CONCERNs — all 3 CONCERNs found were resolved via Plan Updates P1-P4 applied to this plan file within this VALIDATE pass; two non-blocking Open Gaps are recorded above)
Accepted by: N/A — Gate is PASS; no CONCERNs required user acceptance (all 3 were resolved via Plan Updates P1-P4 applied directly to this plan file during this VALIDATE pass, before the contract was written).

## Public Contracts

- **New:** `softDeleteOrderSheet(prevState, formData): Promise<DeleteSheetActionState>` — server
  action, ADMIN-only, `id: number` (via FormData) in, `{ error? , ok? }` out. No other consumers.
- **Changed (additive, non-breaking):** `OrderSheet` Prisma model gains `active: boolean`
  (default `true`) — every existing query that does NOT filter on `active` continues to work
  unchanged (returns both active and inactive rows) UNLESS explicitly updated per this plan's
  read-path list (now 8 sites, corrected at VALIDATE). This is a deliberate, minimal blast radius.
- **Changed (additive, non-breaking):** `createOrderSheet`'s duplicate-check `where` clause and
  `saveOrderSheet`'s not-found check both gain an `active` condition (Plan Updates P2/P3) — no
  change to either function's exported signature or return-state shape.
- **No changes** to `order-payload.ts`, `totals.ts`, `order-save.ts`, print mm CSS, the 446 fixture.

## Blast Radius

**Extend (never rewrite):**
- `prisma/schema.prisma` — add one field to `OrderSheet`
- `src/app/(main)/orders/actions.ts` — add one new exported action + two small guard-clause fixes (P2/P3)
- `src/app/(main)/orders/page.tsx` — add `where`, role read, conditional button render
- `src/app/(main)/orders/[id]/page.tsx` — one-line not-found condition change
- `src/lib/get-sheet-for-print.ts` — one `where` clause addition
- `src/app/(main)/history/page.tsx` — one `where` clause addition on the primary `findMany` (groupBy calls untouched)
- `src/app/(main)/summary/page.tsx` — one `where` clause addition on each of the two `findFirst` branches
- `src/lib/__tests__/auth-guard-coverage.test.ts` — extend `expected` array + one new test (P4)

**New files:**
- `prisma/migrations/<timestamp>_ordersheet_active/migration.sql` (sandbox, Prisma-generated)
- `db/alter-ordersheet-add-active.sql` (db_TCL delivery script)
- `src/app/(main)/orders/delete-sheet-button.tsx`

**Must stay untouched:** `src/lib/order-payload.ts`, `src/lib/totals.ts`, `src/lib/order-save.ts`,
`saveOrderSheet`/`createOrderSheet` core save/create/carry-forward logic (only two small guard
clauses added, see Design item 4), `test-fixtures/sheet-13-03-69.json`, print mm CSS
(`src/styles/print.css`), `src/app/print/**` layout files (only the underlying data fetch changes,
never the print rendering/layout code).

**High-risk class:** schema/data migration touching a **shared live production ERP database**
(db_TCL) — flag for a **manual-first evidence handoff at EXECUTE** per
`process/development-protocols/orchestration.md` §High-Risk Execution Handoff. The db_TCL ALTER is
NOT to be auto-applied by any agent; it is a delivery artifact for the customer's DBA, exactly like
`db/create-database-and-login.sql` was in Phase 06. Auth surface (new ADMIN-only mutation) is a
secondary, lower-severity high-risk class — covered by the ADMIN-only e2e gate + the new P4
mixed-module regression gate.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Unit: n/a — no new pure-logic helper extracted (action logic is thin CRUD + auth check, not worth isolating per YAGNI) | Known-Gap (documented, non-behavioral) | — |
| E2E: ADMIN creates a sheet, soft-deletes it via the modal → sheet disappears from `/orders` list | Fully-Automated (Playwright, extend `e2e/orders.spec.ts`) | Soft-delete hides sheet from the primary list surface (Goal 3+4) |
| E2E: soft-deleted sheet still exists in DB with `active = false` (verify via a direct Prisma read inside the test) | Fully-Automated | Data is retained, not hard-deleted (Goal 1, Non-Goal: no cascade) |
| E2E: soft-deleted sheet excluded from `/summary` totals and `/history` list for that date | Fully-Automated (extend `e2e/summary-history.spec.ts`) | Aggregation surfaces exclude inactive sheets (Goal 4) |
| E2E: soft-deleted sheet's print routes (`/print/daily/[date]`, `/print/shops/[date]`) render "not found" | Fully-Automated (extend `e2e/print.spec.ts`) | Print surfaces exclude inactive sheets (Goal 4) |
| E2E: soft-deleted sheet's editor route `/orders/[id]` 404s | Fully-Automated | Editor treats inactive sheet as gone (Goal 4) |
| E2E: STAFF role — no delete button rendered on `/orders`, AND direct POST to `softDeleteOrderSheet` as STAFF returns the ADMIN-only error | Fully-Automated (extend `e2e/auth.spec.ts`) | ADMIN-only enforcement at both UI and server-action layers (Goal 2) |
| E2E (added at VALIDATE, Plan Update P2): new sheet for a date+location whose prior sheet was soft-deleted creates a fresh sheet, not a redirect to the deleted one | Fully-Automated (extend `e2e/orders.spec.ts`) | AC7 |
| E2E (added at VALIDATE, Plan Update P3): direct `saveOrderSheet` call against a soft-deleted sheet id is rejected, writes nothing | Fully-Automated (extend `e2e/orders.spec.ts`) | AC8 |
| Unit (added at VALIDATE, Plan Update P4): `softDeleteOrderSheet` requires ADMIN specifically (mixed-module case) | Fully-Automated (extend `src/lib/__tests__/auth-guard-coverage.test.ts`) | Security surface CONCERN resolution |
| Regression: existing 25 e2e specs still pass unmodified except the deliberately extended ones above | Fully-Automated (full `pnpm test:e2e` run) | No behavior change to unrelated surfaces |
| Regression: existing 98 unit tests still pass (baseline is 98 per `all-context.md`) | Fully-Automated (`pnpm test`) | No unintended schema/logic regression |
| Hybrid: sandbox migration applies cleanly (`prisma migrate dev --name ordersheet_active` exits 0, generated SQL reviewed to be exactly one `ADD COLUMN`) | Hybrid (precondition: sandbox SQL Server container running) | Migration strategy Design item 2(a) is correct and minimal |
| Agent-probe: db_TCL ALTER script reviewed for safety (idempotency guard present, no destructive keywords, single table/column scope) before delivery | Agent-Probe (human/agent code review, not executed against db_TCL by any agent) | Migration strategy Design item 2(b) — manual-first evidence handoff requirement satisfied |

**High-risk minimum tier table:**

| Area | High-risk class | Minimum tier | Gap rationale if known-gap accepted |
|---|---|---|---|
| `softDeleteOrderSheet` ADMIN-only auth check | auth/permission | Hybrid (satisfied — e2e is Fully-Automated, exceeds minimum; P4 adds a per-function regression guard) | — |
| `db/alter-ordersheet-add-active.sql` applied to db_TCL | schema/data migration on shared prod DB | Hybrid minimum; actual: Agent-probe review only, execution is manual-first by design | Rationale: automatically applying ANY statement to db_TCL from an agent session is explicitly forbidden by `database/all-database.md` §DANGER guardrails — this is not a coverage gap, it is the correct safety posture. The sandbox migration (Hybrid tier, item above) is the closest automatable proxy and IS covered. |

## Test Infra Improvement Notes

- `e2e/orders.spec.ts` currently has no delete-flow coverage at all (soft-delete is a wholly new
  capability) — this plan's E2E gates above are the first coverage, not an extension of an existing
  gap.
- **(Resolved at VALIDATE)** `summary/page.tsx` and `history/page.tsx` were fully read this session
  — the groupBy relation-filter uncertainty flagged in the pre-VALIDATE draft is resolved and
  removed; see Design item 4 and the Validate Contract FEASIBILITY finding above.
- **(Found at VALIDATE)** `src/lib/__tests__/auth-guard-coverage.test.ts`'s whole-module
  `ADMIN_MODULES` check does not cover mixed-module per-function ADMIN gating — Plan Update P4 adds
  a dedicated assertion. Future ADMIN-only actions added to an otherwise-mixed module should follow
  the same per-function pattern rather than trying to force the file into `ADMIN_MODULES`.
- No test-runner or fixture infra changes needed — reuses existing Playwright config, existing
  ADMIN/STAFF storage-state fixtures (`e2e/auth.setup.ts`), and the existing sandbox DB.

## Resume and Execution Handoff

**Selected plan file:** this file
(`process/features/order-system/active/ordersheet-soft-delete_11-07-26/ordersheet-soft-delete_PLAN_11-07-26.md`)

**Execution order (do NOT reorder):**
1. Schema: add `active` field to `prisma/schema.prisma`.
2. Sandbox migration: `pnpm prisma migrate dev --name ordersheet_active` against the LOCAL sandbox
   only. Confirm generated SQL is a single `ADD COLUMN` before proceeding.
3. Write `db/alter-ordersheet-add-active.sql` (delivery artifact — do NOT execute against db_TCL).
4. Server action `softDeleteOrderSheet` in `orders/actions.ts`.
5. Read-path filters, in this order (each is independently testable): `orders/page.tsx` →
   `orders/[id]/page.tsx` → `get-sheet-for-print.ts` → `history/page.tsx` (findMany filter only) →
   `summary/page.tsx` (both findFirst branches) → `createOrderSheet` dup-check (P2) →
   `saveOrderSheet` not-found check (P3).
6. UI: `orders/delete-sheet-button.tsx` + wire into `orders/page.tsx`.
7. Extend `auth-guard-coverage.test.ts` (P4).
8. Test gates per the Verification Evidence table above, run against the LOCAL sandbox — see the
   `.env` swap note below.
9. Update `process/context/database/all-database.md` if the `OrderSheet` model documentation needs
   a mention of the new `active` field (context-maintenance follow-up, not blocking).

**`.env` swap warning (must be followed exactly, and MUST be restored byte-exact afterward):**
db_TCL will not have the `active` column until the customer's DBA runs the delivered ALTER script —
this repo's LIVE `.env` may currently point at db_TCL (confirm at EXECUTE time via
`APPROVED:.env cat .env` per the `.env` privacy-hook convention noted in `all-context.md`
§Gotchas — VALIDATE deliberately did NOT read `.env` this session since interactive approval was
unavailable and it was not required for the feasibility findings above). If so:
1. Before EXECUTE touches any DB: read the current `DATABASE_URL` value, save it aside (not to a
   committed file).
2. Point `.env` `DATABASE_URL` at the LOCAL sandbox connection string for the duration of schema
   work + test gates.
3. Apply the sandbox migration, run all EXECUTE work and test gates against the sandbox.
4. **Before ending EXECUTE, restore `.env` `DATABASE_URL` to the original db_TCL value, byte-exact.**
   Verify via a diff-equivalent check (e.g. re-read and compare) — do not trust memory alone.
5. Never write the real `DATABASE_URL` value into any report, plan, or commit message (see
   `all-context.md` §Gotchas secret-redaction rule).

**If interrupted mid-EXECUTE:** the schema field + sandbox migration are safe to leave applied (they
are additive and sandbox-only). The `.env` swap is the one state that MUST be checked and restored
before ending any session that touched it — check `.env`'s current `DATABASE_URL` first thing on
resume.

**Deploy-ordering reminder for the eventual customer handoff (record in phase report, not executed
by this plan):** the db_TCL ALTER must run before or with the code deploy, never after.

---

## Open Questions (non-blocking — proceed with stated defaults)

1. Exact Thai confirm-modal copy — deferred to EXECUTE as a judgment call (see Design item 5).
2. **RESOLVED at VALIDATE.** `summary/page.tsx` was read in full — it needs a simple `active: true`
   filter on its `orderSheet.findFirst` calls (both branches), not the groupBy relation-filter
   pattern. See Design item 4 (Plan Update P1).
3. **RESOLVED at VALIDATE — moot.** Neither `history/page.tsx` nor `summary/page.tsx` actually needs
   `groupBy().where` relation-filter support — both are fixed by filtering the primary `OrderSheet`
   query instead. Whether Prisma 7.8.0's `groupBy().where` supports relation filters is therefore not
   load-bearing for this plan. See Design item 4 (Plan Update P1) and the Validate Contract
   FEASIBILITY finding above.

## Deviations (recorded at EXECUTE)

- **AC8 (P3) test mechanism — within blast radius.** The plan specified a "direct/raw call to
  `saveOrderSheet` against a soft-deleted sheet id" e2e gate. A Next.js server action cannot be
  invoked by a raw Playwright `fetch` without its encrypted action id, so the AC8 e2e
  (`e2e/orders.spec.ts` — "AC8 (P3): the editor is unreachable for a soft-deleted sheet and its
  lines stay frozen") instead proves the same semantic ("a soft-deleted sheet's lines can never be
  mutated post-delete") via the two reachable surfaces: (1) the editor route 404s (save UI
  unreachable) and (2) a direct Prisma `orderLine.count` shows the lines are unchanged. The P3
  server guard (`if (!sheet || !sheet.active) return { error: "ไม่พบใบออเดอร์" }`) is present in
  source and additionally covered by code review. Impact: none on behavior; the guard is in place
  and the "writes nothing" invariant is asserted. Rationale: raw server-action invocation has no
  stable e2e harness in this repo.
- **Checklist item 16 (update `all-database.md`) deferred.** Context-doc edits are reserved for the
  UPDATE PROCESS phase (execute-agent must not modify `process/context/`). Follow-up: add the
  `OrderSheet.active` field to the schema-overview table in `database/all-database.md` at closeout.

## Autonomous Goal Block

```
SESSION GOAL: Ship ADMIN-only soft-delete for OrderSheet — schema field, server action, UI + confirm
modal, 8 read/write-path filters, db_TCL delivery script.
Charter + umbrella plan: N/A — single plan (order-system phase program is already COMPLETE and
archived; this is standalone follow-up work, not a new phase in that program).
Autonomy: orchestration.md §Autonomy Mode — CONDITIONAL findings apply-and-proceed; BLOCKED items go
to backlog and continue; irreversible/outward-facing actions without explicit contract instruction
are a hard stop (this plan's ONLY outward-facing action — the db_TCL ALTER — is explicitly
delivery-artifact-only and MUST NOT be auto-applied by EXECUTE, per Blast Radius above).
Hard stop conditions / safety constraints:
- NEVER run `prisma migrate reset`/`prisma migrate dev`/`prisma db push --force-reset` against
  db_TCL (would drop the customer's entire live ERP, not just orderstock's 9 tables).
- NEVER execute `db/alter-ordersheet-add-active.sql` against db_TCL from an agent session — it is a
  delivery artifact for the customer's DBA only.
- NEVER leave `.env` pointed at db_TCL for test runs — swap to sandbox first, restore byte-exact
  after, verify via re-read-and-compare (not memory).
- NEVER write a real `DATABASE_URL`/secret value into any report, plan, or commit message.
Next phase: EXECUTE — ENTER EXECUTE MODE for
process/features/order-system/active/ordersheet-soft-delete_11-07-26/ordersheet-soft-delete_PLAN_11-07-26.md
Validate contract: inline in this plan file (## Validate Contract section above)
Execute start: `pnpm test` (98 unit, baseline) + `pnpm test:e2e` (25+ e2e, baseline) confirm green
BEFORE touching any code; e2e spec: extend `e2e/orders.spec.ts`/`e2e/summary-history.spec.ts`/
`e2e/print.spec.ts`/`e2e/auth.spec.ts` per Test Gates table; agent-probe: `db/alter-ordersheet-add-active.sql`
safety review before delivery; high-risk pack: yes — schema/migration on shared live prod DB
(manual-first evidence handoff required at EXECUTE per orchestration.md §High-Risk Execution
Handoff, db_TCL ALTER is delivery-only).
```
