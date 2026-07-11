---
phase: ordersheet-soft-delete
date: 2026-07-11
status: COMPLETE
feature: order-system
plan: process/features/order-system/active/ordersheet-soft-delete_11-07-26/ordersheet-soft-delete_PLAN_11-07-26.md
---

# OrderSheet Soft-Delete — EXECUTE Report

## What Was Done

All 15 execution-scope checklist items (1–15) complete; item 16 deferred to UPDATE PROCESS.

- **Schema (1,2):** added `active Boolean @default(true)` to `OrderSheet` (extend, not rewrite). Sandbox migration `prisma/migrations/20260711103207_ordersheet_active/migration.sql` generated + applied — exactly one `ALTER TABLE [dbo].[OrderSheet] ADD [active] BIT NOT NULL … DEFAULT 1`.
- **db_TCL delivery (3):** `db/alter-ordersheet-add-active.sql` — idempotency-guarded (`IF NOT EXISTS … sys.columns`), additive, single table/column, Thai+English usage/ordering warnings. NOT executed against any DB (delivery artifact only).
- **Server action (4):** `softDeleteOrderSheet(prev, formData)` in `orders/actions.ts` — `requireAuthState("ADMIN")`, integer-id validation, idempotent on already-inactive/missing, `revalidatePath("/orders")`.
- **Read/write-path filters (5,7,8,9,10,11,12):** `orders/page.tsx` (active filter + role read + conditional delete UI), `orders/[id]/page.tsx` (`!active → notFound`), `get-sheet-for-print.ts` (active in findFirst), `history/page.tsx` (active on primary findMany only — groupBy untouched), `summary/page.tsx` (active on both findFirst branches), `createOrderSheet` dup-check (P2), `saveOrderSheet` not-found guard (P3).
- **UI (6):** `orders/delete-sheet-button.tsx` — first confirm-before-destroy pattern; pguard `Modal` + `danger-ghost` `Button`, `useActionState`, NO native `confirm()`. Thai copy: "ยืนยันลบใบออเดอร์วันที่ {date}? … ข้อมูลจะถูกซ่อน … แต่ไม่ถูกลบถาวร". Modal unmounts on success via revalidation (no close-on-ok effect — avoids react-hooks/set-state-in-effect lint).
- **Tests (13,14):** P4 per-function ADMIN assertion in `auth-guard-coverage.test.ts`; 9 new e2e gates across `orders.spec.ts` (AC1+AC2, AC3d, AC7, AC8), `auth.spec.ts` (AC4 x2), `summary-history.spec.ts` (AC3a, AC3b), `print.spec.ts` (AC3c). `clean-state.ts` E2E_LOCATIONS extended.

## What Was Skipped or Deferred

- **Item 16** (add `OrderSheet.active` to `database/all-database.md`): deferred to UPDATE PROCESS — execute-agent must not edit `process/context/`.
- **Customer DBA step** (apply `db/alter-ordersheet-add-active.sql` to db_TCL before/with code deploy): outside execution scope; delivery-artifact-only. Deploy-ordering: ALTER must run BEFORE or WITH the code deploy, never after.

## Test Gate Outcomes

- `pnpm test` — **99 passed / 17 files** (was 98; +1 from P4). ≥98 floor met.
- `pnpm lint` — **clean**.
- `pnpm build` — **compiles + TypeScript passes**.
- `pnpm exec playwright test` — **34 passed** (25 existing green + 9 new). The `CredentialsSignin` webserver log lines are the SEC-enum test's deliberate bad logins (expected).
- AC6a (Hybrid) sandbox migration — applied cleanly, single ADD COLUMN. AC6b (Agent-Probe) db_TCL script review — PASS (idempotent, no destructive keywords, single-column scope, compat-130-safe).

## Plan Deviations

See plan `## Deviations` section: (1) AC8 e2e proves the "lines never mutate post-delete" invariant via editor-404 + DB-count-frozen rather than a raw server-action POST (no stable e2e harness for encrypted action ids); P3 source guard present + code-reviewed. (2) Item 16 context-doc edit deferred to UPDATE PROCESS. Both within blast radius.

## Test Infra Gaps Found

- Sandbox admin password was out of sync with `SEED_ADMIN_PASSWORD`; realigned via a one-off `user.updateMany` (sandbox only, no secret printed). A stale `pnpm start` server on :3000 (pointing at prod, reused via `reuseExistingServer: !CI`) was killed so Playwright booted a fresh sandbox-backed server. Both are environment prep, not product gaps.
- No stable harness to invoke a Next server action by raw fetch (encrypted action id) — AC8 uses reachable-surface proxies. Candidate future infra note.

## Closeout Packet

- **Selected plan:** `process/features/order-system/active/ordersheet-soft-delete_11-07-26/ordersheet-soft-delete_PLAN_11-07-26.md`
- **Finished:** all code + tests; 4/4 gates green against sandbox.
- **Verified:** unit/lint/build/e2e all green; migration single-column; db_TCL script reviewed.
- **Unverified:** db_TCL live application (customer DBA, by design — never agent-run).
- **.env restore:** RESTORED byte-exact to db_TCL prod — sha256 `e021fc37567c290d376d5afb710c164032bdf029de6f63e4871e1e1debd9682a` MATCH; host `43.229.134.162` present, localhost absent.
- **Not committed** (left in working tree for EVL).
- **Best next state:** EVL confirmation run (re-run the 4 gates via vc-tester), then UPDATE PROCESS — archive plan + add `OrderSheet.active` to `database/all-database.md` (item 16).

## Forward Preview

### Test Infra Found
Sandbox admin/`SEED_ADMIN_PASSWORD` sync + stale-:3000-server kill are recurring e2e preconditions; consider a preflight assert. No raw-server-action e2e harness.

### Blast Radius Changes
New: `active` column on OrderSheet (sandbox migrated; db_TCL pending DBA). New files: migration, `db/alter-ordersheet-add-active.sql`, `orders/delete-sheet-button.tsx`. Untouched confirmed: `order-payload.ts`, `totals.ts`, `order-save.ts`, 446 fixture, print mm CSS, `saveOrderSheet`/`createOrderSheet` core save/create logic (only P2/P3 guard clauses added).

### Commands to Stay Green
`pnpm test` · `pnpm lint` · `pnpm build` · `pnpm exec playwright test` — all against `.env`=sandbox (verify host=localhost first; restore db_TCL byte-exact after).

### Dependency Changes
None.
