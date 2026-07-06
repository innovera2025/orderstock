---
name: context:all-tests
description: Testing entrypoint for orderstock — Vitest 3.2.6 (24 tests/7 files) and Playwright E2E (7 tests, installed Phase 03) both real and wired, sandbox SQL Server constraint
keywords: tests, testing, vitest, playwright, e2e, unit, integration, verification, coverage, sandbox, sql server, health check, build, lint, storage state, fixtures
related: [context:all-database, context:all-auth]
metadata:
  read_when: the task involves testing, verification, or test debugging
---

# orderstock - All Tests

Last updated: 2026-07-06 (Phase 03 closeout)

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

**Real, wired, and passing as of Phase 03 (Auth).** Vitest 3.2.6 is installed and green with 24 tests across 7 files. Playwright `@playwright/test@1.61.1` is installed (first-time E2E setup, Phase 03 — brought forward from the originally-planned Phase 05) and green with 7 tests. A Docker SQL Server 2022 sandbox provides the DB-dependent gates. Phases 04-06 add their own test coverage as they land — this file's Commands table below is the baseline; update it per-phase as new gates are established.

## Testing Approach

Stack: Next.js 16.2.10 (TypeScript) + Prisma 7 + `@prisma/adapter-mssql` + SQL Server (see `all-context.md`):

- **Unit/integration:** Vitest 3.2.6 — `src/lib/__tests__/*.test.ts`. 7 files / 24 tests as of Phase 03: `smoke.test.ts` (baseline), `variant-validation.test.ts` (5 — printOrder uniqueness over the active non-null set), `correction-cascade.test.ts` (2 — propagate-while-unconfirmed / lock-after-confirm branches), `password.test.ts` (4 — bcryptjs hash/verify round-trip, wrong password, 72-byte limit), `login-attempts.test.ts` (5 — lockout BLOCK/RESET/EXPIRE), `auth-guard-coverage.test.ts` (4 — grep-style assertion that every shop/product/admin action calls `requireAuth`), `secret-leak.test.ts` (2 — no committed plaintext secret in tracked files). Later phases add coverage for form calculation logic (per-column totals, total weight) and date conversion (BE↔CE).
- **DB-level testing pattern (Phase 02):** pure logic (validators, cascade back-fill decision) is extracted to `src/lib/` and Vitest-unit-tested in isolation via the `CascadeDb` adapter interface (see `database/all-database.md`) — no live DB needed for these units. The actual DB round-trip (CRUD create→edit→soft-delete) is proven via an **agent-probe** against the sandbox, not an automated test, because server actions call `redirect()`/`revalidatePath()` (need Next request context). A headless CRUD DB-integration harness is still backlogged — see `process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md` — now that Playwright is installed, this could alternatively be proven via a Playwright-driven CRUD flow instead of a Vitest harness; re-evaluate before building it.
- **E2E (Phase 03, installed):** Playwright — `e2e/auth.spec.ts` (7 tests: login success, STAFF blocked / ADMIN allowed on `/admin`, logged-out redirect to `/login`, generic-error-on-bad-credentials for both bad-username and bad-password). `e2e/auth.setup.ts` produces reusable ADMIN + STAFF storage-state fixtures reused by Phases 04-06 (see `auth/all-auth.md` for the reuse pattern). Needs: dev server (Playwright's `webServer: pnpm start` boots/reuses it), sandbox up, and a seeded admin (`pnpm tsx prisma/seed.ts` + `SEED_ADMIN_PASSWORD` in `.env` — Playwright loads `.env` via `process.loadEnvFile()`, Node 22).
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
| root | Playwright | `pnpm exec playwright test` | Yes — needs sandbox up + seeded admin (`SEED_ADMIN_PASSWORD` in `.env`); `webServer` auto-starts `pnpm start` |
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

- CRUD DB-integration harness for shops/products round-trips is still an agent-probe, not automated (backlog note above) — Playwright is now available and could close this gap; re-evaluate before Phase 05.
- No audit log for auth events (Phase 1 scope, accepted known-gap — see `auth/all-auth.md`).
- Real logic coverage for order-entry calculation (totals, date conversion) lands with Phase 04.
- No CI pipeline configured yet — all gates run locally/manually per phase.
