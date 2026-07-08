---
name: context:all-tests
description: Testing entrypoint for orderstock — Vitest 3.2.6 (88 tests/16 files) and Playwright E2E (25 tests, incl. mobile project) both real and wired, sandbox SQL Server constraint
keywords: tests, testing, vitest, playwright, e2e, unit, integration, verification, coverage, sandbox, sql server, health check, build, lint, storage state, fixtures, totals, be-date, order-save, mobile, mobile viewport, mobile project, clean-state
related: [context:all-database, context:all-auth]
metadata:
  read_when: the task involves testing, verification, or test debugging
---

# orderstock - All Tests

Last updated: 2026-07-08 (pguard-redesign PROGRAM COMPLETE — Phase 05 closeout, all 5 phases VERIFIED)

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

**Real, wired, and passing as of pguard-redesign Phase 05 (Data align + verify, ✅ VERIFIED 08-07-26 — FINAL phase, PROGRAM COMPLETE).** phase1-order-system remains program-complete (its own baseline: 70 tests / 12 files, 19 e2e). The pguard-redesign program's final phase added to the SAME suites: Vitest is now **88 tests across 16 files** (Phase 05 added `src/lib/__tests__/product-names.test.ts`, 6 tests, for the ตีลานนิ่ม/ตีลาน rename — unchanged since Phase 03/04 otherwise), and Playwright is still **25 e2e tests across 6 spec files** (unchanged from Phase 04 — the rename needed no new e2e spec, proven via the existing suites + an agent-probe). A Docker SQL Server 2022 sandbox provides the DB-dependent gates, plus a second same-container database (`orderstock2`) used only by the Phase 06 Hybrid round-trip gate. **pguard-redesign is now PROGRAM COMPLETE (08-07-26)** — this baseline (88 units / 16 files, 25 e2e) is the current stable regression suite; any future order-system OR pguard-related work should extend it the same way.

## Testing Approach

Stack: Next.js 16.2.10 (TypeScript) + Prisma 7 + `@prisma/adapter-mssql` + SQL Server (see `all-context.md`):

- **Unit/integration:** Vitest 3.2.6 — `src/lib/__tests__/*.test.ts` (+ one settings-specific spec). **15 files / 82 tests as of pguard-redesign Phase 03** (Phase 02 baseline was 14 files / 75 tests; phase1-order-system's own baseline was 12 files / 70 tests at Phase 06): `smoke.test.ts` (baseline), `variant-validation.test.ts` (5 — printOrder uniqueness over the active non-null set), `correction-cascade.test.ts` (2 — propagate-while-unconfirmed / lock-after-confirm branches), `password.test.ts` (4 — bcryptjs hash/verify round-trip, wrong password, 72-byte limit), `login-attempts.test.ts` (5 — lockout BLOCK/RESET/EXPIRE), `auth-guard-coverage.test.ts` (10 — grep-style assertion that every shop/product/admin/order/settings action AND every settings/print page call `requireAuth`; MODULES paths re-point to `src/app/(main)/…`, with a dedicated `ADMIN_MODULES` assertion for the settings actions module), `secret-leak.test.ts` (2 — no committed plaintext secret in tracked files), `totals.test.ts` (6 — asserts all 20 column totals + grand 446 against `test-fixtures/sheet-13-03-69.json`, NoteLine qty excluded, weight computation shape), `be-date.test.ts` (5 — CE↔BE round-trip via Intl `en-US-u-ca-buddhist`), `order-save.test.ts` (3 — `mergeSnapshots()` proves naive re-derive-from-live-names FAILS while carry-forward passes), `connection-string.test.ts` (14 — fields→`sqlserver://` build, named-instance, brace-escaping, validation, mask, non-load-bearing parse), `env-write.test.ts` (7 — injection-safe serialization against hostile inputs incl. `\n`/`\nKEY=value` clobber/quotes/backslashes/Thai password, `.env.bak` backup-before-write ordering, gitignore assertion), `settings-secret-hygiene.test.ts` (5 — password masking + test-connection error sanitization), `order-payload.test.ts` (6, pguard-redesign Phase 02 — RED-first TDD unit asserting `buildOrderPayload(cells, notes)` from `src/lib/order-payload.ts` emits the exact `cell:{shopId}:{variantId}`/`note:{shopId}` FormData set against the 13/3/69 fixture; this is the UI-seam payload guard — any new order-entry surface (matrix, future mobile) that must emit the identical save payload should import this same pure helper and be covered by an equivalent unit, not a re-derivation), **`summary.test.ts` (7, pguard-redesign Phase 03 — RED-first TDD unit asserting `computeShopTotals`/`topShops` from `src/lib/summary.ts`: shop-totals Σ==446, known per-shop values, top-8 exact ordering, default-n≤8, empty→{}/[], per-column reconciliation via the UNCHANGED `computeColumnTotals`; `summary.ts` imports only `totals.ts`, does not re-derive column arithmetic).**
- **`e2e/orders.spec.ts` is now matrix-driven (pguard-redesign Phase 02)**: rewritten to drive `order-matrix.tsx` via `cell-{rosterOrder}-{printOrder}` testids (was Order Pad combobox-driven pre-Phase-02). D1 enters the 13/3/69 fixture → asserts `grand-total`=446 + spot totals (`total-4`=137, `total-8`=82, `total-2`=99) → save → reload → 446 persists. D2 unchanged in intent (rename a confirmed shop, resave, assert `shopNameAtEntry` snapshot preserved), only the initial-cell-entry mechanism changed to the new testids.
- **`e2e/summary-history.spec.ts` (pguard-redesign Phase 03, 2 tests, ADMIN storage-state)**: G6 asserts `/summary` grand total 446 + 20 bars for the seeded day (via `?date`+`?location`); G7 asserts `/history` shows today as live ("กำลังกรอก") vs. a past sheet as closed ("ปิดยอดแล้ว"), weight `"—"`, and the "เปิดใบงาน" link. **Introduces the deterministic-e2e clean-state pattern**: a `beforeEach` + `afterAll` hook deletes E2E-located sheets and restores any " TEST"-suffixed shop names before/after each run, making the spec re-runnable regardless of prior-run outcome (the same gap `e2e/orders.spec.ts` still has, see Known Gaps below). This pattern is reusable — hoist it into a shared e2e util if Phase 04's mobile e2e specs need the same guarantee.
- **Second sandbox DB fixture (Phase 06, `orderstock2`):** a durable Hybrid-gate fixture living on the SAME `orderstock-sql` container (no second container — host memory headroom was the deciding factor). Created and schema-loaded via `scripts/phase06-roundtrip-gate.ts` (Prisma 7's `prisma db execute` has no `--url` flag, so the script applies the schema through a direct node-mssql batch instead), seeded with one data-distinguishing sentinel Shop row (`rosterOrder 999999`). The round-trip gate drives the real settings save pipeline (`validate → live SELECT 1 → injection-safe env-write`) with `ORDERSTOCK_NO_EXIT=1` so `process.exit(0)` never kills the test server — it stops at the `.env` write and asserts the new URL + `.env.bak`, then observes the sentinel in `orderstock2`, switches back, and asserts the sentinel is gone from `orderstock`. Run: `ORDERSTOCK_NO_EXIT=1 pnpm tsx scripts/phase06-roundtrip-gate.ts`. A stray `.env.bak` (gitignored) is a normal side effect of running this gate.
- **DB-level testing pattern (Phase 02):** pure logic (validators, cascade back-fill decision) is extracted to `src/lib/` and Vitest-unit-tested in isolation via the `CascadeDb` adapter interface (see `database/all-database.md`) — no live DB needed for these units. The actual DB round-trip (CRUD create→edit→soft-delete) is proven via an **agent-probe** against the sandbox for shops/products, not an automated test, because server actions call `redirect()`/`revalidatePath()` (need Next request context). A headless CRUD DB-integration harness is still backlogged — see `process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md`. **Phase 04 closed this gap for order sheets specifically**: the OrderSheet round-trip (create→save→reload, plus snapshot-preserve on rename→resave) is proven via real Playwright hybrid gates (D1/D2 in `e2e/orders.spec.ts`), not an agent-probe.
- **E2E:** Playwright — `e2e/auth.spec.ts` (7 tests: login success, STAFF blocked / ADMIN allowed on `/admin`, logged-out redirect to `/login`, generic-error-on-bad-credentials for both bad-username and bad-password) + `e2e/orders.spec.ts` (2 tests, Phase 04 order-system: D1 enters the full 13/3/69 fixture through the real UI, saves, reloads, asserts grand 446 + column totals persist; D2 renames a confirmed shop, resaves, asserts via prisma that the pre-existing `shopNameAtEntry` snapshot is unchanged while the live name changed) + `e2e/print.spec.ts` (7 tests, Phase 05: G1 colgroup 24 physical/20 semantic cols, G2 29 rows + 3-tier header + totals-last-tbody + grand 446, G3 `@page A4 landscape` rule present, G4 snapshot-render — rename a live shop then confirm print still shows the original snapshot name, restored in `finally`, G5 per-shop `.sheet`/`break-after:page` count, G6 print-page `requireAuth` grep, G7 test-side `page.pdf()` valid-PDF hybrid gate, G8 unauth→`/login` redirect) + `e2e/settings.spec.ts` (3 tests, Phase 06: unauth→`/login` redirect, STAFF denied `/settings/db`, ADMIN served with the settings heading visible — closes the runtime-auth coverage gap the Phase 06 EVL fix cycle found) + `e2e/summary-history.spec.ts` (2 tests, pguard-redesign Phase 03: G6 `/summary` grand 446 + 20 bars, G7 `/history` today-live/past-closed + weight dash + link — see clean-state pattern above) + **`e2e/mobile.spec.ts` (4 tests, pguard-redesign Phase 04, runs on the `mobile` project only)**: enters the 13/3/69 fixture via `mobile-cell-{rosterOrder}-{printOrder}` steppers → taps `mobile-save` → reload → asserts `grand-total`=446, `total-4`=137, `total-8`=82 (proves the mobile branch drives the SAME `buildOrderPayload` as desktop); asserts the per-shop entry overlay is full-viewport (covers the bottom tab bar); asserts STAFF never sees `tab-users` (count 0) while ADMIN sees all 3 tabs; asserts the 3 bottom tabs navigate ร้านค้า/สรุปยอด/ผู้ใช้. `e2e/auth.setup.ts` produces reusable ADMIN + STAFF storage-state fixtures reused across phases (see `auth/all-auth.md` for the reuse pattern) — `orders.spec.ts`/`print.spec.ts`/`settings.spec.ts`/`summary-history.spec.ts`/`mobile.spec.ts` reuse these directly rather than re-implementing login. Needs: dev server (Playwright's `webServer: pnpm start` boots/reuses it), sandbox up, and a seeded admin (`pnpm tsx prisma/seed.ts` + `SEED_ADMIN_PASSWORD` in `.env` — Playwright loads `.env` via `process.loadEnvFile()`, Node 22).
- **Mobile Playwright project (`playwright.config.ts`, pguard-redesign Phase 04):** a NEW `mobile` project (390×844 viewport) alongside the existing `setup`+`chromium` projects, reusing `e2e/.auth/staff.json` + `e2e/.auth/admin.json` storage states. Only `e2e/mobile.spec.ts` runs on this project — the desktop specs (`orders.spec.ts`, `print.spec.ts`, etc.) still run on `chromium`. `pnpm exec playwright test` runs ALL projects (25/25 total: 21 desktop + 4 mobile).
- **Hoisted clean-state helper (`e2e/util/clean-state.ts`, pguard-redesign Phase 04):** the `beforeEach`/`afterAll` clean-state pattern first demonstrated inline in `e2e/summary-history.spec.ts` (Phase 03) is now a SHARED helper — deletes E2E-located sheets, restores " TEST"-suffixed shop names. Both `summary-history.spec.ts` and `mobile.spec.ts` import it. This resolves the Phase-03 EVL follow-up stub ("hoist into a shared e2e util"). `e2e/orders.spec.ts` still has NOT been retrofitted with this helper (see Known Gaps below) — any new DB-mutating spec should import the hoisted helper rather than re-inlining the pattern.
- **Self-seeding + restore-in-finally isolation pattern (Phase 05, standard for any DB-mutating e2e spec):** a spec that must mutate shared master/order data (e.g. `print.spec.ts` G4 renames a shop to prove snapshot fidelity) seeds its OWN dedicated date/location/row via Prisma at spec start, mutates only that seeded row, and restores the original value in a `finally` block regardless of assertion outcome. This keeps the shared `workers:1` sandbox clean for every other spec in the same run — proven pattern first used by Phase 04's D2 (rename→resave→verify-snapshot-unchanged) and reused unchanged by Phase 05. Adopt this shape for any future spec that touches shared state instead of ad hoc setup/teardown.
- **Shared test fixture:** `test-fixtures/sheet-13-03-69.json` (Phase 04) is the canonical 13/3/69 scan-day data source — 51 grid cells, all 20 column totals, grand 446, 13 NoteLines incl. one orphan (`shopId` null). It is imported directly by `totals.test.ts` (unit), `e2e/orders.spec.ts` (E2E/D1), and `e2e/print.spec.ts` (Phase 05 print gates) — do not re-derive a second copy of this data.
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
| root | Playwright | `pnpm exec playwright test` | Yes — needs sandbox up + seeded admin/data (`SEED_ADMIN_PASSWORD` in `.env`); `webServer` auto-starts `pnpm start`; 25/25 as of pguard-redesign Phase 04 (21 desktop `chromium` + 4 mobile `mobile` project) |
| root | Hybrid gate (Phase 06) | `ORDERSTOCK_NO_EXIT=1 pnpm tsx scripts/phase06-roundtrip-gate.ts` | Yes — needs sandbox up + `orderstock2` fixture (self-provisioning) |
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
