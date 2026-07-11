---
name: plan:db-url-dollar-roundtrip
description: "Fix @next/env dotenv-expand mangling a literal $ in DATABASE_URL after /settings/db restart-apply"
date: 11-07-26
feature: general
---

# DB URL `$`-in-Password Round-Trip Fix — SIMPLE Plan

## Overview

**Date**: 11-07-26
**Status**: ✅ VERIFIED — EXECUTE + EVL complete, committed at 18e4837. Archived by UPDATE PROCESS.
**Complexity**: SIMPLE

Context consulted: `process/context/all-context.md` (routed through `database/all-database.md`
and `auth/all-auth.md` for the `db.ts` singleton pattern and edge/node split) and
`process/context/tests/all-tests.md` (Vitest 3.2.6 baseline, 88 tests / 16 files, sandbox SQL
Server constraint).

`/settings/db` writes a DB connection string to `.env` (`src/lib/env-write.ts`, raw/literal,
unquoted) then `process.exit(0)` to restart-apply. When the password contains `$`, the app
**fails after restart** ("Login failed for user 'sa'").

**Root cause (confirmed empirically this session, do not re-research):** the running Next app
loads `.env` via `@next/env`, which runs **dotenv-expand** — a literal `$` in the value is
expanded/corrupted. `process.loadEnvFile()` (Node 22+, used by `prisma/load-env.ts`→seed,
`prisma.config.ts`→CLI, `scripts/phase06-roundtrip-gate.ts`) does **not** expand, so those
paths already read `$` correctly. Only the `@next/env`-loaded app path (`src/lib/db.ts` at
Next runtime) is broken.

Probes already proved dead ends — do not retry:
- Quoting (single/double/unquoted) does **not** stop `@next/env` expansion.
- Pre-setting `process.env` before Next boots does **not** help — `@next/env` **overrides**
  the pre-set var with its expanded file value.

## Goals

1. The app connects successfully after a `/settings/db` restart-apply even when the saved
   password contains `$` (including brace-wrapped `${...}` and named-instance `\INST` forms).
2. No change to `.env`'s on-disk format (still a human-readable, literal, unquoted line) —
   the deploy guide's manual lockout-recovery edit flow is unaffected.
3. Prisma CLI (`migrate`, `introspect`, `validate`) continues to resolve the same literal value.
4. Zero regression to the 88-test / 16-file Vitest baseline **and** the 25-test Playwright e2e
   baseline — `src/lib/db.ts` is imported (via `src/auth.ts`) by every Prisma-backed route in the
   app, so the e2e suite is the real proof that ordinary (non-`$`) connection strings still work
   through the new read path, not just the pathological `$` case.

## Scope

In scope: `src/lib/db.ts`, `prisma.config.ts`, one new shared helper + its unit tests.
Out of scope: `env-write.ts` write format (unchanged), `/settings/db` UI, schema, seed/CLI env
paths that already work correctly (documented, not touched).

## Chosen Approach (decided this session)

**Raw-read `DATABASE_URL` from `.env`, bypassing dotenv-expand, in the two readers that matter.**

New shared helper `src/lib/resolve-database-url.ts`, exporting
`resolveDatabaseUrl(envPath?: string): string`:

1. Read the target env file if it exists (defaults to `<cwd>/.env`; the optional `envPath`
   parameter mirrors `WriteEnvOptions` in `env-write.ts` and exists ONLY so
   `resolve-database-url.test.ts` can point the function at `mkdtempSync`-created temp
   fixtures — the exact pattern `env-write.test.ts` already uses for `writeDatabaseUrl()` —
   without any `process.chdir()` side effects; production call sites (`db.ts`,
   `prisma.config.ts`) never pass this argument). Find the **first** line matching
   `^DATABASE_URL=`. Take everything after the first `=`. Strip a single matching pair of
   surrounding quotes (`"..."` or `'...'`) if present. Return the result **verbatim** — no
   expansion, no unescaping, no `$`-substitution of any kind. Split file content on `/\r?\n/`
   (mirror `env-write.ts`) so CRLF fixtures parse correctly. Use plain string operations
   (`startsWith`/`slice`), not a broad regex, matching `env-write.ts`'s existing style — avoids
   any regex-complexity risk on pathological input.
2. If the file is absent or no matching line is found, fall back to `process.env.DATABASE_URL`
   (covers the Docker BUILD stage, which sets a placeholder via `ENV`, and CI/inline-env runs
   where there is no `.env` file at all).
3. If neither yields a non-empty value, throw the same clear error `db.ts` already throws
   today (`"DATABASE_URL is not set — cannot construct the Prisma SQL Server adapter."`).
4. **Never log or print the value anywhere in this module** (mirror `env-write.ts`'s existing
   secret-hygiene contract — no `console.log`/`console.error` of the resolved value under any
   branch, including the throw path).

Wire it into the two readers:
- `src/lib/db.ts`: replace `const connectionString = process.env.DATABASE_URL` with
  `const connectionString = resolveDatabaseUrl()`. Singleton + adapter pattern otherwise
  byte-identical. `db.ts` is server-only/Node (never edge) — confirmed this session not
  imported from `src/auth.config.ts` or `src/proxy.ts` (grepped: `db.ts` is imported ONLY by
  `src/auth.ts`, the Node-runtime auth module; the edge-split `auth.config.ts`/`proxy.ts`
  import only the edge-safe config, never Prisma), so adding a `node:fs` read is safe.
- `prisma.config.ts`: replace the `datasource.url: process.env.DATABASE_URL` value with
  `resolveDatabaseUrl()` (imported after the existing `process.loadEnvFile(envPath)` call, which
  can stay as a no-op-safe fallback populator for the `process.env` branch of the helper — do not
  remove it, just stop trusting its output directly for the datasource URL). This makes the CLI
  path use the exact same raw-read logic as the app path instead of two parallel implementations
  that happen to both avoid expansion today.

`env-write.ts`: **no change** to the write format — it already writes the literal value
unquoted. Add one code comment above the `DATABASE_URL=` write line pointing at
`resolveDatabaseUrl()`'s raw-read contract, so a future edit doesn't "helpfully" add quoting or
escaping that the raw-read parser wasn't designed for.

### Rejected alternatives (record, do not redo)

- **(a) Escape `\$` on write + align all Node readers to `@next/env`'s expansion rules.**
  Works for `@next/env` but is fragile (backslash placement, named-instance `\INST` edge cases)
  and produces a less human-readable `.env`, which matters for the deploy guide's manual
  lockout-recovery edit instructions. Rejected.
- **(b) Preload `process.env.DATABASE_URL` before Next boots.** Dead — empirically proven:
  `@next/env` overrides any pre-set env var with its own expanded file value. Rejected.
- **(c) Base64-encode the URL at rest in `.env`.** Bulletproof against expansion but breaks
  human `.env` editing (the documented lockout-recovery flow) and would require deploy-guide
  changes. Rejected — disproportionate for this bug.

## Research: Other `DATABASE_URL` Readers (enumerated, decision recorded per reader)

Grepped this session (`grep -rln DATABASE_URL` across `src/`, `prisma/`, `scripts/`, root
config files, `docker-compose*.yml`, `Dockerfile`, `docs/`) — re-confirmed at VALIDATE, no
readers missed:

| Reader | Loads via | Affected by bug? | Action |
|---|---|---|---|
| `src/lib/db.ts` (app runtime, imported everywhere incl. server actions/pages) | `@next/env` (Next's own env loader) | **YES — this is the bug** | Route through `resolveDatabaseUrl()` (this plan) |
| `prisma.config.ts` (Prisma CLI: migrate/introspect/validate) | own `process.loadEnvFile(envPath)` call, no expansion | No (already correct) | Route through `resolveDatabaseUrl()` too, for consistency/DRY — one raw-read implementation instead of two independent ones that happen to agree today |
| `prisma/load-env.ts` (imported first by `prisma/seed.ts`) | `process.loadEnvFile()`, no expansion | No (already correct) | **Leave as-is.** Node's native loader already raw-reads correctly; do not add helper here — seed only needs `process.env.DATABASE_URL` to be populated once, no re-read logic needed |
| `scripts/phase06-roundtrip-gate.ts` (dev harness) | reads `process.env.DATABASE_URL` after its own env is already loaded via the same Node-native path as the CLI/seed | No (already correct) | Leave as-is |
| `src/app/(main)/settings/db/page.tsx` (prefill on the settings form) | reads `process.env.DATABASE_URL` for display/prefill only, never for a live connection | Cosmetically could show a mangled value if the app is already running under a mangled env (VALIDATE confirmed: the password field is always blanked before render, and host/user/database rarely contain `$`, so this is a low-severity, already-scoped residual) | Leave as-is — not a live-connection path; documented open gap, no action needed this plan |
| `src/lib/env-write.ts` (writer, not a reader) | N/A | N/A | No change (see Chosen Approach) |
| `docker-compose.prod.yml` (`env_file: .env` + `./.env:/app/.env` bind-mount) | Docker Compose's own `env_file` mechanism sets the CONTAINER's baseline `process.env.DATABASE_URL`; separately, the bind-mount makes the real file available at `/app/.env` (matches `WORKDIR /app`, same `process.cwd()` assumption `env-write.ts` already relies on) | Not load-bearing for this fix either way: `resolveDatabaseUrl()` reads the bind-mounted FILE directly and only falls back to `process.env` when the file is absent — since the file is always present in production (bind-mount), the (possibly also `$`-affected) container-level `process.env.DATABASE_URL` is never consulted for the live connection | VALIDATE confirmed this is a design strength, not a gap — no action needed |

Confirmed `db.ts` is never imported by the edge-split auth files (`src/auth.config.ts`,
`src/proxy.ts`) — those only need JWT/session logic, not Prisma. Adding `node:fs` reads to
`db.ts` is safe (Node runtime only, never edge).

## Implementation Checklist

1. Create `src/lib/resolve-database-url.ts` exporting `resolveDatabaseUrl(envPath?: string): string`
   implementing the 4-step contract in "Chosen Approach" above (raw first-`DATABASE_URL=` line read
   from the target file — defaulting to `<cwd>/.env`, optional `envPath` param for test fixtures —
   strip one matching quote pair, verbatim return; fallback to `process.env.DATABASE_URL`; throw
   the existing clear error if neither yields a value; never log the value). Use `node:fs`
   `existsSync`/`readFileSync` (same pattern already used in `env-write.ts`) and `node:path`
   `join(process.cwd(), ".env")` as the default.
2. Create `src/lib/__tests__/resolve-database-url.test.ts` with the fixtures listed under
   "Test Matrix" below. Use `mkdtempSync(join(tmpdir(), "resolve-db-url-"))` for the fixture
   files (same proven pattern as `env-write.test.ts`), pass the temp fixture path explicitly via
   the new `envPath` parameter — never write into the real repo env file, and never use
   real/production-shaped secret values (use clearly-fake placeholders like `fakepass$123`).
3. Edit `src/lib/db.ts`: import `resolveDatabaseUrl` from `./resolve-database-url`; replace the
   `const connectionString = process.env.DATABASE_URL; if (!connectionString) { throw ... }`
   block with `const connectionString = resolveDatabaseUrl();` (the helper owns the throw now —
   remove the now-redundant local throw). Keep the singleton pattern and `PrismaMssql`
   construction otherwise byte-identical.
4. Edit `prisma.config.ts`: import `resolveDatabaseUrl` from `./src/lib/resolve-database-url`
   (confirm relative import resolves correctly from repo root — `prisma.config.ts` is at root,
   helper is under `src/lib/`); replace `datasource: { url: process.env.DATABASE_URL }` with
   `datasource: { url: resolveDatabaseUrl() }`. Keep the existing `process.loadEnvFile(envPath)`
   call above it unchanged (it still populates the `process.env` fallback branch inside the
   helper). Confirm `resolveDatabaseUrl()` does not throw in a CI context where the env file is
   absent but `DATABASE_URL` is inline-set (fallback branch covers this — verified by Test Matrix
   case "Missing fixture file, process.env.DATABASE_URL set").
5. Add a one-line code comment in `src/lib/env-write.ts` immediately above the write-format
   logic (near the `KEY = "DATABASE_URL"` constant or the `writeDatabaseUrl` doc comment),
   pointing at `resolve-database-url.ts`'s raw-read contract so future edits don't add quoting/
   escaping the parser doesn't expect.
6. Run `pnpm test` — confirm baseline (88+ tests, new resolve-database-url tests included, all
   green) and `pnpm lint` clean.
7. Run `pnpm build` — confirm TypeScript compiles (both `db.ts` and `prisma.config.ts` changes
   type-check; `prisma.config.ts` is used by the Prisma CLI, not bundled into the Next build, so
   also separately confirm it runs via step 8).
7b. **[VALIDATE-added]** Bring up `pnpm dev` or `pnpm start` against the sandbox and run
    `pnpm exec playwright test` (25/25 must stay green) — this is the required regression proof
    that `db.ts`'s new `resolveDatabaseUrl()`-based read path still works correctly for the
    CURRENT (non-`$`) sandbox connection string across every Prisma-backed route (login, shops,
    products, admin, orders, print, settings). `db.ts` is imported transitively by every one of
    these via `src/auth.ts`, so unit tests alone (which mostly exercise pure logic, not live
    Prisma calls) do not prove this — see Goal 4.
8. Confirm Prisma CLI still resolves after the `prisma.config.ts` change: run
   `pnpm prisma validate` against the sandbox — must print "The schema at prisma/schema.prisma
   is valid". **[VALIDATE note]** Use `prisma validate`, not `prisma migrate status` — this
   session's VALIDATE run confirmed `migrate status` currently reports a pre-existing "3
   migrations not yet applied" state on this sandbox that is unrelated to this plan (likely a
   Prisma-7 `migrate status` quirk against this container's tracking table); `prisma validate`
   is the clean, low-noise proof that the CLI resolves the datasource URL correctly, which is
   the actual thing this plan needs to prove. If `migrate status` is later found relevant, treat
   its current "not applied" baseline as pre-existing, not a regression this plan caused.
9. Run the end-to-end `$`-password SMOKE test (see "Verification Evidence" below) — this is the
   decisive gate proving the actual bug is fixed, not just that the code compiles.

## Test Matrix — `resolve-database-url.test.ts`

| Case | Fixture env-file content | Expected `resolveDatabaseUrl(envPath)` result |
|---|---|---|
| Literal `$` in password | `DATABASE_URL=sqlserver://localhost:1433;database=orderstock;user=sa;password=fake$pass;encrypt=true` | Exact string above, unmangled |
| Brace-wrapped `${p$w}` shape | `DATABASE_URL=sqlserver://localhost:1433;database=orderstock;user=sa;password=fa${ke}pass;encrypt=true` | Exact string above, verbatim (no expansion attempted) |
| Named-instance `host\INST` | `DATABASE_URL=sqlserver://localhost\SQLEXPRESS:1433;database=orderstock;user=sa;password=fake$1;encrypt=true` | Exact string above, unmangled |
| Surrounding double-quotes | `DATABASE_URL="sqlserver://localhost:1433;...;password=fake$pass;..."` | Same value with the outer quote pair stripped, inner content untouched |
| Surrounding single-quotes | `DATABASE_URL='sqlserver://...;password=fake$pass;...'` | Same, single-quote pair stripped |
| Missing fixture file, `process.env.DATABASE_URL` set | no file; `process.env.DATABASE_URL = "sqlserver://...fallback..."` | Returns the `process.env` value verbatim |
| Missing fixture file AND missing `process.env.DATABASE_URL` | neither present | Throws the clear "DATABASE_URL is not set" error |
| Fixture file exists but has no `DATABASE_URL=` line, `process.env` set | file present, no matching line; `process.env.DATABASE_URL` set | Falls back to `process.env` value |
| Multiple `DATABASE_URL=` lines (defensive) | two lines, first non-comment wins | Returns the FIRST matching line's value |
| CRLF line endings | fixture written with `\r\n` line endings, `$`-containing value | Value parsed correctly, unmangled (proves the `/\r?\n/` split works) |

No real secret values anywhere in the test file — use obviously-fake placeholders (`fake$pass`,
`fake$1`) per repo's secret-hygiene rule. Fixtures use `mkdtempSync` + explicit `envPath` param
(see Implementation Checklist step 2) — never a file named `.env` created directly by an agent
tool call (avoids any unnecessary interactive privacy-hook friction); this is the same pattern
`env-write.test.ts` already uses successfully for `writeDatabaseUrl()`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `resolve-database-url.test.ts` — 10 cases above | Fully-Automated (`pnpm test`) | Goal 1: helper never expands `$`; correct fallback/throw behavior |
| `pnpm test` full suite (88+ baseline, no regressions) | Fully-Automated | Goal 4 (unit half): no collateral breakage across existing 16 test files |
| `pnpm lint` / `pnpm build` | Fully-Automated | Both edited files type-check and lint clean |
| **[VALIDATE-added]** `pnpm exec playwright test` (25/25 baseline, no regressions) | Hybrid (requires sandbox + seeded admin + `pnpm dev`/`pnpm start`) | Goal 4 (e2e half): every Prisma-backed route (login→shops→products→admin→orders→print→settings) still connects correctly through the new `db.ts` read path for a NORMAL (non-`$`) connection string — the load-bearing regression proof for `db.ts`'s blast radius |
| `pnpm prisma validate` against sandbox after `prisma.config.ts` edit | Hybrid (requires local Docker SQL Server sandbox running) | Goal 3: Prisma CLI still resolves DATABASE_URL correctly post-change |
| **`$`-password E2E SMOKE** (decisive gate) — see script sketch below | Hybrid (requires disposable sandbox login + disposable env fixture, agent-run) | Goal 1/2: the actual reported bug ("Login failed for user 'sa'" after restart with a `$` password) is fixed |

**SMOKE test script sketch** (write as a disposable `tsx` script under `scripts/` during EXECUTE,
e.g. `scripts/dollar-password-smoke.ts`, or run inline via a temp script — agent's discretion on
exact file, but the sequence below is mandatory):

1. On the local sandbox container `orderstock-sql`, create a DISPOSABLE SQL login with a password
   containing `$` (e.g. `CREATE LOGIN smoketest WITH PASSWORD = 'Fake$Pass123!'`), granted access
   to a throwaway/temp DB (or reuse `orderstock` with minimal grants — agent's call, but must be
   fully droppable at the end).
2. Write a temp environment-shaped fixture file (NOT the real repo env file — use `mkdtempSync`
   inside the script's own runtime code, same pattern as `env-write.test.ts`/step 2 above; this
   is Node fs I/O performed by the script process itself, not a direct agent tool call, so it
   does not trigger the repo's `.env`-file privacy-approval hook) with `DATABASE_URL` pointing at
   that login, containing the literal `$`.
3. **[VALIDATE-refined]** Reproduce the mangling directly via `dotenv-expand`'s `expand()`
   function (already a transitive dependency of `@next/env` — this is the exact mechanism
   `@next/env` calls internally, confirmed by this session's research) on an in-memory
   `{ parsed: { DATABASE_URL: <the fixture's literal value> } }` object — this is simpler, faster,
   and fully deterministic vs. booting a real `@next/env.loadEnvConfig()`/Next context, and
   precisely isolates the mechanism cited as root cause. Assert the expanded value DIFFERS from
   the literal fixture value (proves the mangling reproduces). Then call
   `resolveDatabaseUrl(fixturePath)` pointed at the same temp fixture and confirm it returns the
   UNMANGLED literal value (prove the raw-read path is correct and diverges from the mangled one).
4. Construct a `PrismaClient` with `PrismaMssql(rawReadValue)` and run `SELECT 1` — must succeed.
   (Negative check: also try `PrismaMssql(mangledValue)` — from step 3's `dotenv-expand` output —
   and confirm it FAILS with a login error — proves the smoke test actually exercises the bug,
   not a no-op.)
5. Teardown: `DROP LOGIN smoketest` (and drop any temp DB/user created), delete the temp fixture
   file/dir. Never touch the external customer server. Never log/print the real or fake password
   value in the report — use `[REDACTED]` or the literal fake string only if already public in
   this plan (`Fake$Pass123!` is a fixture value, not a real secret, so it may appear in the
   disposable script, but do not echo it into the final phase report/evidence pack).

## Blast Radius

- NEW: `src/lib/resolve-database-url.ts`, `src/lib/__tests__/resolve-database-url.test.ts`
- EDIT: `src/lib/db.ts` (one import + one line), `prisma.config.ts` (one import + one line),
  `src/lib/env-write.ts` (one comment, no logic change)
- NO CHANGE: `env-write.ts` write format, `/settings/db` UI/actions, schema, seed/CLI env-loading
  paths (`prisma/load-env.ts`, `scripts/phase06-roundtrip-gate.ts`) — documented as already-correct
- Disposable-only during EXECUTE verification: one temp SQL login + one temp environment-shaped
  fixture file on the local Docker sandbox, both torn down at the end
- **VALIDATE confirmed:** no overlap with the concurrently-active `orderstock-deploy_08-07-26`
  plan (that plan touches `Dockerfile`/basePath/`docker-compose*.yml`; this plan touches
  `db.ts`/`prisma.config.ts`/`env-write.ts` — disjoint file sets)

## Touchpoints

- `src/lib/db.ts` — swap raw `process.env.DATABASE_URL` read for `resolveDatabaseUrl()`
- `prisma.config.ts` — swap `datasource.url` read for `resolveDatabaseUrl()`
- `src/lib/env-write.ts` — add one explanatory comment only, no logic change
- NEW `src/lib/resolve-database-url.ts` + NEW `src/lib/__tests__/resolve-database-url.test.ts`

## Public Contracts

- New export: `resolveDatabaseUrl(envPath?: string): string` from
  `src/lib/resolve-database-url.ts`. No other module's public surface changes (db.ts's `prisma`
  export signature is unchanged; `prisma.config.ts`'s exported config shape is unchanged).

## Acceptance Criteria

1. `resolveDatabaseUrl()` returns the exact literal fixture-file `DATABASE_URL` value (including
   any `$`) with no dotenv-style expansion, verified by all 10 cases in the Test Matrix.
2. `src/lib/db.ts` connects successfully using a `$`-containing password after being loaded
   through `@next/env` (proven by the SMOKE test).
3. `prisma.config.ts` still resolves the same literal value for the Prisma CLI (`pnpm prisma
   validate` succeeds against the sandbox).
4. `pnpm test` stays green at >=88 tests across 17 files (16 existing + 1 new
   `resolve-database-url.test.ts`); `pnpm lint` and `pnpm build` are clean; `pnpm exec
   playwright test` stays green at 25/25 (no regression for normal, non-`$` connection strings
   across every Prisma-backed route).
5. No change to the on-disk env-write format or the `/settings/db` UI/actions.

## Phase Completion Rules

This is a SIMPLE single-plan fix (no phase program). The plan is CODE DONE when Implementation
Checklist items 1–8 pass (including 7b, the Playwright regression). It is VERIFIED only after
item 9 (the `$`-password SMOKE test) passes — that is the decisive gate proving the real-world
bug is fixed, not just that unit tests and the build are green. Do not report VERIFIED without
SMOKE evidence recorded in the phase report.

## Constraints

- Never log/echo/commit real secret values; reports use `[REDACTED]`; do not even quote the
  scanned-for pattern when describing a secret-scan step (recurring repo rule).
- Keep changes minimal and reversible; no schema change; no change to the `/settings/db` UI or
  the env-write write format.
- All SMOKE testing runs against the LOCAL sandbox (`orderstock-sql` container) with a temporary
  `$`-password login — never the external customer server, and never using the current real
  env file's external credentials.
- Before any destructive-adjacent step (`git checkout`/`reset`/`clean`, dropping the temp login),
  confirm scope is exactly the disposable fixture — never touch the real environment file or the
  sandbox's real `sa` login.

## Test Infra Improvement Notes

(none identified yet — existing Vitest setup is sufficient for the new helper; the SMOKE test is
a one-off disposable script, not a permanent addition to the suite, since it requires a live
Docker sandbox and a temp SQL login that shouldn't persist as a CI-run test)

## Open Gaps (accepted, out of this plan's scope)

- `src/app/(main)/settings/db/page.tsx`'s prefill reads `process.env.DATABASE_URL` directly (not
  routed through `resolveDatabaseUrl()`), so it could still cosmetically display a mangled value
  after a `$`-password restart. Accepted as low-severity: the password field is always blanked
  before render, and host/user/database rarely contain `$` in practice. Not fixed by this plan —
  a future hardening plan could route this prefill through `resolveDatabaseUrl()` too if desired.
- ~~`process/context/database/all-database.md` currently states "`src/lib/db.ts` is intentionally
  UNCHANGED by Phase 06...`" — this becomes stale once this plan lands.~~ **Resolved by UPDATE
  PROCESS (11-07-26):** `database/all-database.md` updated to describe `resolveDatabaseUrl()` and
  the dotenv-expand `$` gotcha; `all-context.md` given a one-line pointer.

## Validate Contract

Status: PASS
Date: 11-07-26
date: 2026-07-11
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: Score 1/7 (S7 — 5 touchpoint files incl. 2 new; no multi-package, no schema/auth/API
surface change, single direction, not a phase program, no user-requested depth, no other
high-risk class present). Single-file-scoped SIMPLE plan with 4 sequential edits — one
vc-execute-agent pass, no fan-out needed.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| Goal-1a | `resolveDatabaseUrl()` never expands `$`, correct quote-strip/fallback/throw across 10 cases | Fully-Automated | `pnpm test` → `src/lib/__tests__/resolve-database-url.test.ts` | A |
| Goal-4a | No regression to existing 88-test/16-file Vitest baseline | Fully-Automated | `pnpm test` (full suite) | A |
| Type/lint | `db.ts`/`prisma.config.ts`/new helper type-check and lint clean | Fully-Automated | `pnpm lint` && `pnpm build` | A |
| Goal-4b | No regression to 25-test Playwright baseline for normal (non-`$`) connection strings across every Prisma-backed route | Hybrid — requires sandbox up + seeded admin + `pnpm dev`/`pnpm start` | `pnpm exec playwright test` | A |
| Goal-3 | Prisma CLI resolves the same literal value post-change | Hybrid — requires local Docker SQL Server sandbox running | `pnpm prisma validate` | A |
| Goal-1b/2 | The actual reported bug (`$`-password login failure after restart) is fixed; raw-read diverges from `dotenv-expand`-mangled value; negative check confirms the mangled value fails auth | Hybrid — requires disposable sandbox login + disposable temp env fixture, agent-run | `scripts/dollar-password-smoke.ts` (SMOKE, per Verification Evidence sketch) | A |

gap-resolution legend: A — proven now (gate passes in this cycle).

Legacy line form (retained so existing validate-contract consumers still parse):
- `src/lib/resolve-database-url.ts` unit behavior: Fully-automated: `pnpm test` (10-case matrix)
- Full regression (Vitest): Fully-automated: `pnpm test` (88+ tests / 17 files)
- Type/lint: Fully-automated: `pnpm lint && pnpm build`
- Full regression (Playwright): Hybrid: `pnpm exec playwright test` — precondition: sandbox up,
  seeded admin (`SEED_ADMIN_PASSWORD` in `.env`), dev/start server running
- Prisma CLI resolution: Hybrid: `pnpm prisma validate` — precondition: sandbox up, `.env` present
- `$`-password SMOKE: Hybrid: `scripts/dollar-password-smoke.ts` — precondition: sandbox up,
  disposable SQL login + disposable env fixture created and torn down by the script itself

Dimension findings:
- Infra fit: PASS — `db.ts` confirmed server-only/Node (never imported by the edge-safe
  `auth.config.ts`/`proxy.ts` split); production `docker-compose.prod.yml` bind-mounts the real
  `.env` at `/app/.env` matching `process.cwd()` (`WORKDIR /app`), so the raw-read default path
  is correct in the Docker runtime; Docker BUILD stage sets a `$`-free placeholder via `ENV` (no
  `.env` file in that stage) so the `process.env` fallback branch is exercised correctly, not the
  file-read branch.
- Test coverage: PASS (after this session's 4 refinements applied above: added Playwright
  regression gate 7b, `resolveDatabaseUrl(envPath?)` for clean temp-fixture testability, switched
  the CLI gate command to `prisma validate` to avoid a pre-existing unrelated `migrate status`
  noise finding, and refined the SMOKE test's mangling-reproduction step to call `dotenv-expand`
  directly). All 6 gates in the C3 table are Fully-Automated or Hybrid; no behavior rests on
  Known-Gap.
- Breaking changes: PASS — no schema, auth, or public API change; new export
  `resolveDatabaseUrl(envPath?: string)` is additive; no other module's exported surface changes.
- Security surface: PASS — read path is a fixed, non-user-controlled path (`<cwd>/.env` or an
  explicit test-only param); no path traversal; helper never logs the resolved value (mirrors
  `env-write.ts`); write path (`env-write.ts`'s CR/LF injection guard + `.env.bak` backup) is
  completely unchanged; SMOKE test's temp SQL login and fixture are created/torn down by the
  script's own runtime code (not direct agent tool calls on `.env`-named files), so it never
  triggers the repo's privacy-approval hook and stays within the disposable local sandbox only.
- Section feasibility (single SIMPLE plan, one section): PASS — mechanical feasibility confirmed
  (both edit targets, `db.ts:11` and `prisma.config.ts:20`, grepped this session as unique,
  precisely matchable single occurrences; new file paths confirmed non-existent, no collision).
  Gaps found and fixed in plan (see 4 refinements above). Conflicts found: none — confirmed no
  blast-radius overlap with the concurrently-active `orderstock-deploy_08-07-26` plan. Highest-risk
  edit: the SMOKE test's temp SQL login lifecycle on the shared dev sandbox container — mitigated
  by the plan's existing teardown steps, `docker stats` precondition, and the hard constraint
  against ever touching the external customer server.

Open gaps: `src/app/(main)/settings/db/page.tsx` prefill residual and the `database/all-database.md`
context-doc staleness — both documented above under "Open Gaps (accepted, out of this plan's
scope)"; neither blocks this plan and both are low-severity/non-code-risk.

What this coverage does NOT prove:
- `pnpm test` (resolve-database-url.test.ts) proves the helper's parsing logic in isolation; it
  does NOT prove the live app actually boots correctly with it — that is what gate 7b
  (Playwright) and the SMOKE gate cover instead.
- `pnpm exec playwright test` proves the 25 existing scenarios still pass; it does NOT add new
  coverage for named-instance (`\INST`) or brace-wrapped (`${...}`) password shapes in a live
  running app — those shapes are proven only at the unit level (Test Matrix) and are not
  separately SMOKE-tested end-to-end (the SMOKE test uses a plain `$`-containing password). This
  is an accepted proportionality tradeoff for a SIMPLE plan; if a customer ever reports a
  named-instance+`$` combination failure, extend the SMOKE test then.
- `pnpm prisma validate` proves schema+datasource resolution; it does NOT prove `migrate status`
  is clean on this sandbox (a separate, pre-existing, unrelated finding from this session — see
  Implementation Checklist step 8 note).
- The SMOKE test's negative check proves the specific `dotenv-expand`-mangled string fails auth;
  it does not exhaustively enumerate every possible mangling variant `dotenv-expand` could
  produce across its version history — acceptable since the fix (raw-read) is correct regardless
  of the exact mangled shape.
- No coverage proves Docker Compose's own `env_file:` mechanism does or does not also mangle `$`
  in production (a documented Compose behavior question, not this plan's bug) — VALIDATE
  confirmed this is moot for the actual DB connection either way, since `resolveDatabaseUrl()`
  never consults `process.env.DATABASE_URL` when the bind-mounted file is present (see Research
  table above); it remains a residual only for the (out-of-scope, already-accepted) settings page
  prefill.

Gate: PASS
Accepted by: session — Open Gaps above (settings/db prefill residual, context-doc staleness) are
non-blocking documented residuals, not CONCERNs requiring gate downgrade; all mechanical/test-gate
findings from this VALIDATE session were resolved by direct plan updates (see V6 Plan Updates
list) rather than carried as execute-agent judgment calls.

## Resume and Execution Handoff

- **Selected plan file:** this file
  (`process/general-plans/active/db-url-dollar-roundtrip_11-07-26/db-url-dollar-roundtrip_PLAN_11-07-26.md`)
- **Next phase:** EXECUTE (`ENTER EXECUTE MODE`) — VALIDATE complete, Gate: PASS.
- **If resuming after compaction:** re-read this file's "Chosen Approach" and "Research" sections
  before touching any code — the root cause and rejected alternatives are already fully
  researched; do not re-investigate `@next/env` vs `process.loadEnvFile` behavior from scratch.
  This file's "Validate Contract" section is the executable contract — follow its Test gates
  table and the 4 VALIDATE-added refinements (step 7b, `envPath` param, `prisma validate` over
  `migrate status`, `dotenv-expand`-direct SMOKE reproduction) exactly as written into the
  Implementation Checklist / Verification Evidence above.
- **Docker/local sandbox precondition:** `orderstock-sql` container must be running (confirmed
  up, "Up 5 days", 1.06GiB/2GiB used at VALIDATE time) for steps 7b–9 of the Implementation
  Checklist (Playwright + Prisma CLI validate + SMOKE test). Run `docker stats --no-stream` first
  per repo convention (9 unrelated containers share the Docker Desktop VM — never stop/restart
  any of them).
- **Baseline confirmed at VALIDATE:** `pnpm test` → 88/88 passing across 16 files;
  `pnpm prisma validate` → schema valid. `pnpm prisma migrate status` currently shows a
  pre-existing, unrelated "3 migrations not applied" state on this sandbox — see Implementation
  Checklist step 8 note; do not treat this as a regression this plan caused.

## Open Questions

None — root cause, chosen approach, and rejected alternatives were fully resolved via empirical
research this session before planning began. VALIDATE (this session) added 4 concrete
refinements directly into the plan text (see Implementation Checklist, Verification Evidence,
and Validate Contract above) — no open questions remain before EXECUTE.

---

Plan + Validate Contract complete (Gate: PASS). Say **'ENTER EXECUTE MODE'** to begin
implementation.

## Autonomous Goal Block

```
SESSION GOAL: Fix @next/env dotenv-expand mangling a literal `$` in DATABASE_URL after a
/settings/db restart-apply, so the app reconnects successfully when the saved SQL Server
password contains `$`.
Charter + umbrella plan: N/A — single SIMPLE plan, no phase program.
Autonomy: standard /goal autonomous execution rules apply (see
process/development-protocols/orchestration.md §Autonomous /goal Phase Program Execution) —
CONDITIONAL findings during EXECUTE/EVL get fixed and continue; BLOCKED items go to backlog
with a note; irreversible/outward-facing actions without explicit contract instruction are a
hard stop.
Hard stop conditions / safety constraints:
- Never point DATABASE_URL at the external customer server (43.229.134.162 or any non-localhost
  host) during any test, probe, or SMOKE step — sandbox-only (`orderstock-sql`, localhost:1433).
- Never log, print, or commit a real secret value; SMOKE test uses only disposable fixture values
  (e.g. `Fake$Pass123!`) and redacts anything else.
- Never modify the on-disk `.env` write format or the `/settings/db` UI/actions — out of scope.
- Before any destructive-adjacent step (dropping the temp SQL login, deleting the temp fixture),
  confirm scope is exactly the disposable SMOKE artifacts — never the real `.env` or the
  sandbox's real `sa` login.
- Do not stop/restart any of the other 9 containers sharing the Docker Desktop VM.
Next phase: EXECUTE — `ENTER EXECUTE MODE` for this plan file.
Validate contract: inline in this plan file (`## Validate Contract` section above), Gate: PASS.
Execute start: `pnpm test` (Fully-Automated, incl. new resolve-database-url.test.ts) | `pnpm lint
&& pnpm build` (Fully-Automated) | `pnpm exec playwright test` (Hybrid, 25/25) | `pnpm prisma
validate` (Hybrid) | `scripts/dollar-password-smoke.ts` (Hybrid, decisive SMOKE gate) — high-risk
pack: no (no auth/billing/schema/public-API/deploy-runtime/secret-boundary class touched; only a
DB-connection-string READ-path fix, write path unchanged).
```
