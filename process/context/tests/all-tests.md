---
name: context:all-tests
description: Testing entrypoint for orderstock — Vitest 3.2.6 (41 tests/10 files) and Playwright E2E (16 tests) both real and wired, sandbox SQL Server constraint
keywords: tests, testing, vitest, playwright, e2e, unit, integration, verification, coverage, sandbox, sql server, health check, build, lint, storage state, fixtures, totals, be-date, order-save
related: [context:all-database, context:all-auth]
metadata:
  read_when: the task involves testing, verification, or test debugging
---

# orderstock - All Tests

Last updated: 2026-07-06 (Phase 05 closeout)

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

**Real, wired, and passing as of Phase 05 (Printing).** Vitest 3.2.6 is installed and green with 41 tests across 10 files. Playwright `@playwright/test@1.61.1` is installed and green with 16 tests across `e2e/auth.spec.ts` + `e2e/orders.spec.ts` + `e2e/print.spec.ts`. A Docker SQL Server 2022 sandbox provides the DB-dependent gates. Phase 06 adds its own test coverage as it lands — this file's Commands table below is the baseline; update it per-phase as new gates are established.

## Testing Approach

Stack: Next.js 16.2.10 (TypeScript) + Prisma 7 + `@prisma/adapter-mssql` + SQL Server (see `all-context.md`):

- **Unit/integration:** Vitest 3.2.6 — `src/lib/__tests__/*.test.ts`. 10 files / 41 tests as of Phase 05: `smoke.test.ts` (baseline), `variant-validation.test.ts` (5 — printOrder uniqueness over the active non-null set), `correction-cascade.test.ts` (2 — propagate-while-unconfirmed / lock-after-confirm branches), `password.test.ts` (4 — bcryptjs hash/verify round-trip, wrong password, 72-byte limit), `login-attempts.test.ts` (5 — lockout BLOCK/RESET/EXPIRE), `auth-guard-coverage.test.ts` (7, Phase 05 +2 — grep-style assertion that every shop/product/admin/order action AND both print pages call `requireAuth`; MODULES paths re-point to `src/app/(main)/…` after the Phase 05 route-group move), `secret-leak.test.ts` (2 — no committed plaintext secret in tracked files), `totals.test.ts` (6, Phase 04 — asserts all 20 column totals + grand 446 against `test-fixtures/sheet-13-03-69.json`, NoteLine qty excluded, weight computation shape), `be-date.test.ts` (5, Phase 04 — CE↔BE round-trip via Intl `en-US-u-ca-buddhist`), `order-save.test.ts` (3, Phase 04 — `mergeSnapshots()` proves naive re-derive-from-live-names FAILS while carry-forward passes).
- **DB-level testing pattern (Phase 02):** pure logic (validators, cascade back-fill decision) is extracted to `src/lib/` and Vitest-unit-tested in isolation via the `CascadeDb` adapter interface (see `database/all-database.md`) — no live DB needed for these units. The actual DB round-trip (CRUD create→edit→soft-delete) is proven via an **agent-probe** against the sandbox for shops/products, not an automated test, because server actions call `redirect()`/`revalidatePath()` (need Next request context). A headless CRUD DB-integration harness is still backlogged — see `process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md`. **Phase 04 closed this gap for order sheets specifically**: the OrderSheet round-trip (create→save→reload, plus snapshot-preserve on rename→resave) is proven via real Playwright hybrid gates (D1/D2 in `e2e/orders.spec.ts`), not an agent-probe.
- **E2E:** Playwright — `e2e/auth.spec.ts` (7 tests: login success, STAFF blocked / ADMIN allowed on `/admin`, logged-out redirect to `/login`, generic-error-on-bad-credentials for both bad-username and bad-password) + `e2e/orders.spec.ts` (2 tests, Phase 04: D1 enters the full 13/3/69 fixture through the real UI, saves, reloads, asserts grand 446 + column totals persist; D2 renames a confirmed shop, resaves, asserts via prisma that the pre-existing `shopNameAtEntry` snapshot is unchanged while the live name changed) + `e2e/print.spec.ts` (7 tests, Phase 05: G1 colgroup 24 physical/20 semantic cols, G2 29 rows + 3-tier header + totals-last-tbody + grand 446, G3 `@page A4 landscape` rule present, G4 snapshot-render — rename a live shop then confirm print still shows the original snapshot name, restored in `finally`, G5 per-shop `.sheet`/`break-after:page` count, G6 print-page `requireAuth` grep, G7 test-side `page.pdf()` valid-PDF hybrid gate, G8 unauth→`/login` redirect). `e2e/auth.setup.ts` produces reusable ADMIN + STAFF storage-state fixtures reused across phases (see `auth/all-auth.md` for the reuse pattern) — `orders.spec.ts`/`print.spec.ts` reuse these directly rather than re-implementing login. Needs: dev server (Playwright's `webServer: pnpm start` boots/reuses it), sandbox up, and a seeded admin (`pnpm tsx prisma/seed.ts` + `SEED_ADMIN_PASSWORD` in `.env` — Playwright loads `.env` via `process.loadEnvFile()`, Node 22).
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
| root | Playwright | `pnpm exec playwright test` | Yes — needs sandbox up + seeded admin/data (`SEED_ADMIN_PASSWORD` in `.env`); `webServer` auto-starts `pnpm start`; 16/16 as of Phase 05 |
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

- CRUD DB-integration harness for shops/products round-trips is still an agent-probe, not automated (backlog note above) — Playwright is now available and could close this gap; order sheets already closed this via Phase 04's D1/D2 hybrid gates; re-evaluate shops/products before Phase 06.
- No audit log for auth events (Phase 1 scope, accepted known-gap — see `auth/all-auth.md`).
- Total-weight computation (`computeTotalWeight` in `totals.ts`) ships but is not validated against the 13/3/69 form's 4,670 กก / 163 ปี๊บ footer — per-variant `weightKg`/`pipConversion` are null until the customer confirms conversion factors; print footer renders the labels with BLANK values, never fabricated numbers (backlog: `process/features/order-system/backlog/weight-factors_NOTE_06-07-26.md`).
- OrderSheet duplicate-sheet TOCTOU (no DB unique on `date`+`location`) — accepted residual (backlog: `process/features/order-system/backlog/order-sheet-dup-index_NOTE_06-07-26.md`).
- Orphan `NoteLine` (shopId null) persistence is proven only by code inspection, not an E2E DB round-trip (backlog: `process/features/order-system/backlog/order-notes-ui-followups_NOTE_06-07-26.md`).
- Print visual fidelity vs. the scan is proven only by agent-probe screenshot review (G9), not an automated visual-regression baseline — a Playwright A4-viewport screenshot baseline is a recommended future hardening step (Phase 05 report, Test Infra Gaps).
- Print semantic-fill shading (Q30) is an accepted known-gap — the additive CSS layer exists in `print.css` but is OFF; ships border-only until the customer confirms colors (backlog: `process/features/order-system/backlog/print-shading-q30_NOTE_06-07-26.md`).
- Server-side PDF export for `/print/**` is deferred — only a test-side `page.pdf()` gate exists; no `/api/print/**` route ships yet (backlog: `process/features/order-system/backlog/print-pdf-fallback_NOTE_06-07-26.md`).
- On-site real-printer mm fidelity is unverified beyond agent-probe screenshot review — Phase 06 delivery should include an on-site test print (Chrome/Edge, printer Scale = 100%) before relying on the layout.
- No CI pipeline configured yet — all gates run locally/manually per phase.
