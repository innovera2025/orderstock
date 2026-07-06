---
phase: phase-01-foundation
date: 2026-07-06
status: COMPLETE_WITH_GAPS
feature: order-system
plan: process/features/order-system/active/phase1-order-system_06-07-26/phase-01-foundation_PLAN_06-07-26.md
---

# Phase 01 — Foundation — EXECUTE Report (DRAFT for EVL)

TL;DR: All 14 checklist items implemented; all 6 validate-contract gates GREEN
(build / lint / test / migrate / health / font-probe), proven against the disposable
Docker SQL Server 2022 sandbox. The Prisma 7 `@prisma/adapter-mssql` driver-adapter
pattern — the program's hardest architectural risk — is confirmed working end-to-end.
ONE open item: the `.env` file could not be written because the privacy hook requires
interactive user approval; every gate was instead proven with inline env vars, and the
exact `.env` contents are specified below.

## What Was Done

- **Step A — scaffold:** `pnpm create next-app` (App Router, TS, src/, Tailwind, Turbopack,
  ESLint) scaffolded to a temp dir and merged into the repo root without disturbing existing
  harness files. Next pinned at **16.2.10** (within 16.2.x; E1 satisfied). `.gitignore` merged
  additively; `.env*` is gitignored (A2). Thai `<html lang="th">` shell with Thai `<title>`.
- **Step B — Prisma 7 + adapter:** added `@prisma/client@7.8.0`, `@prisma/adapter-mssql@7.8.0`,
  `mssql@12.7.0`, `prisma@7.8.0`. `next.config.ts` sets `serverExternalPackages: ['mssql','tedious']`.
  `prisma/schema.prisma` = `provider="sqlserver"` + minimal `HealthCheck` model (Prisma 7: `url`
  removed from the datasource block; moved to `prisma.config.ts` `datasource.url`). `src/lib/db.ts`
  = module-level singleton `new PrismaClient({ adapter: new PrismaMssql(connectionString) })`,
  sandbox-only (localhost:1433), throws if `DATABASE_URL` missing (E3/E4 satisfied).
- **Step C — Docker sandbox:** `docker-compose.yml` for `mcr.microsoft.com/mssql/server:2022-latest`,
  `platform: linux/amd64`, `mem_limit: 2g`, port 1433. E2 precheck: VM had ~6.7 GiB available.
  Container came up, "SQL Server is now ready for client connections" in ~6s, no silent exit. Created
  DB `orderstock` at `COMPATIBILITY_LEVEL 150` (E7 default). The 9 unrelated containers were never
  touched. `prisma migrate dev` applied migration `20260706074539_init_healthcheck`.
- **Step D — font + health + tests:** self-hosted Sarabun (OFL) woff2 (thai+latin, weights 400/600/700)
  under `public/fonts/`; wired via explicit `@font-face` + `unicode-range` in `src/app/fonts.css`
  (see Deviations). `src/lib/fonts.ts` owns the family stack. `src/app/api/health/route.ts` returns
  `{ok:true}` on `SELECT 1` success, sanitized `{ok:false,error}` + 500 otherwise (E6). Home page
  (`page.tsx`) + client `db-status.tsx` show the Thai title and a DB-status indicator. Vitest baseline:
  `vitest.config.ts` + `src/lib/__tests__/smoke.test.ts` (TDD red-first confirmed, then green).

## What Was Skipped or Deferred

- **`.env` file** — NOT written. The privacy hook blocks Write to `.env` and requires interactive
  user approval that the agent cannot self-grant. All gates were proven with inline
  `DATABASE_URL` / `MSSQL_SA_PASSWORD` env vars. Required for a plain `pnpm dev` / `docker compose up`.
- **compat-level 140 vs 150** — defaulted to 150 (E7); customer target unconfirmed (known-gap, carried).

## Test Gate Outcomes

| Gate | Strategy | Command | Result |
|---|---|---|---|
| build | Fully-Automated | `pnpm build` | PASS (exit 0; Turbopack+adapter safe; /api/health dynamic) |
| lint | Fully-Automated | `pnpm lint` | PASS (exit 0; ignores scoped to app source) |
| test-baseline | Fully-Automated | `pnpm test` | PASS (exit 0; 2 tests; red-first then green) |
| migrate | Hybrid | `npx prisma migrate dev` | PASS (init_healthcheck applied; DB in sync) |
| health | Hybrid | `curl -s localhost:3000/api/health` | PASS (`{"ok":true}` HTTP 200) |
| font-render | Agent-Probe | `curl /` + `/fonts/*.woff2` | PASS (Thai title in DOM; Sarabun thai woff2 200 font/woff2; @font-face in compiled CSS; pixel-level human confirm deferred to EVL) |
| compat-level | Known-Gap | — | Default 150; customer 140/150 unconfirmed (carried) |

## Plan Deviations (all within-blast-radius; none hard-stop class)

1. **Font wiring — explicit `@font-face`+`unicode-range` (`src/app/fonts.css`) instead of
   `next/font/local`.** Google ships Thai and Latin as SEPARATE subset woff2 per weight;
   `next/font/local`'s `src` array cannot assign per-subset `unicode-range`, so two same-weight faces
   would override each other and break either Thai or Latin. Same files (`public/fonts/**`,
   `src/lib/fonts.ts`, `src/app/layout.tsx`), same self-hosted approach, same fallback stack
   (`'Sarabun','TH Sarabun New',sans-serif`). Implementation-detail deviation.
2. **`eslint.config.mjs` ignores** extended to exclude `.claude/ .codex/ .agents/ process/
   src/generated/` — the pre-existing agent harness `.cjs` files are not app source. eslint config is
   in the scaffold-config blast radius. Lint gate now covers app code only.
3. **`pnpm-workspace.yaml` `allowBuilds`** — pnpm 11.5 requires explicit build approval for
   `@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`, `sharp`, `unrs-resolver`. Tooling detail
   within the package.json/lockfile blast radius; without it `pnpm test`'s deps-check fails.
4. **`src/app/db-status.tsx`** (client component) added for D3's "DB status indicator" — implied by
   D3, within the `src/app` blast radius.

## Test Infra Gaps Found

- No prior test runner (greenfield). Vitest baseline established (D4). Record the runner + commands in
  `process/context/tests/all-tests.md` during UPDATE-PROCESS.

## Closeout Packet

- Selected plan: `.../phase-01-foundation_PLAN_06-07-26.md`
- Finished: all 14 checklist items; 6/6 gates green (via inline env).
- Verified: build/lint/test/migrate/health/font-probe. Unverified: pixel-level Thai render (human/EVL);
  plain `pnpm dev` boot without inline env (needs `.env`).
- Remaining cleanup: create `.env` (user approval); EVL re-run of gates; UPDATE-PROCESS (context + commit).
- Risk pack: `harness/verification.json` (LIGHT; sandbox-only).
- Best next state: **Keep in active/testing** — resolve `.env`, then EVL, then UPDATE-PROCESS.

## Required `.env` contents (create after user approval)

```
DATABASE_URL="sqlserver://localhost:1433;database=orderstock;user=sa;password=CHANGE_ME_Strong!Passw0rd;encrypt=true;trustServerCertificate=true"
MSSQL_SA_PASSWORD="CHANGE_ME_Strong!Passw0rd"
```
(`.env.example` with placeholder values is already committed-safe on disk.)

## Forward Preview

### Test Infra Found
Vitest 3.2.6 wired (`pnpm test` → `vitest run`, `vitest.config.ts`, node env, `src/**/*.test.ts`).
Playwright (E2E) planned for Phase 05. Sandbox SQL Server required for hybrid/DB gates.

### Blast Radius Changes
Phase 01 established: `src/lib/db.ts` (PrismaClient singleton — Phase 06 extends for runtime swap),
`/api/health` contract (Phase 06 settings validation), `prisma/schema.prisma` (Phases 02/03 EXTEND —
never rewrite the `HealthCheck` model / datasource), `src/app/layout.tsx` (Phases 03/04 extend).

### Commands to Stay Green
`pnpm build` · `pnpm lint` · `pnpm test` · (sandbox up) `npx prisma migrate dev` ·
`curl -s localhost:3000/api/health`. Sandbox: `MSSQL_SA_PASSWORD=... docker compose up -d`.

### Dependency Changes
Added: next@16.2.10, react@19.2.4, @prisma/client@7.8.0, @prisma/adapter-mssql@7.8.0, prisma@7.8.0,
mssql@12.7.0, vitest@3.2.6, tailwindcss@4. pnpm `allowBuilds` approves the 6 native build scripts.
Next 16 renames `middleware.ts`→`proxy.ts` — Phase 03 RESEARCH must reconcile (carried in umbrella).

---

## EVL Independent Re-Verification (step 6 — vc-tester, 06-07-26)

Unconditional independent re-run. Execute's "all gates green" was treated as an unconfirmed
hypothesis and every gate was re-run from scratch. **Result: all 6 gates PASS independently —
zero mismatch vs execute's claims.**

| Gate | Command (my run) | Execute claim | My independent result | Verdict |
|---|---|---|---|---|
| build | `pnpm build` (inline DATABASE_URL) | PASS exit 0 | exit 0; Next 16.2.10 Turbopack; TypeScript clean; `/` static, `/api/health` dynamic | ✅ PASS (match) |
| lint | `pnpm lint` | PASS exit 0 | exit 0; no eslint output | ✅ PASS (match) |
| test | `pnpm test` | PASS exit 0 (2 tests) | exit 0; vitest 3.2.6; 1 file / 2 tests pass | ✅ PASS (match) |
| migrate | `npx prisma migrate status` (inline env) | PASS (init applied, in sync) | exit 0; "Database schema is up to date!"; 1 migration `init_healthcheck` | ✅ PASS (match) |
| health | `curl -s localhost:3000/api/health` (pnpm start, sandbox up) | PASS `{"ok":true}` 200 | `{"ok":true}` HTTP 200 | ✅ PASS (match) |
| font-render | `curl /` + `curl /fonts/*.woff2` | PASS (Thai in DOM, woff2 200) | root 200, `lang="th"`, 289 Thai chars incl. title `ระบบจัดการออเดอร์สินค้า`; Sarabun-400-thai/latin.woff2 serve 200 `font/woff2`; 6 `@font-face` + 8 `unicode-range` in `src/app/fonts.css` wired via `globals.css @import`; pixel-level human confirm still deferred | ✅ PASS (match) |

**Cross-checks (all clean):**
- 9 unrelated containers all Up and untouched; `orderstock-sql` Up ~7 min.
- `docker inspect HostConfig.Memory` = 2147483648 = **exactly 2 GiB** — `mem_limit` applied.
- `docker logs` clean: orderstock DB at COMPATIBILITY_LEVEL 150; prisma shadow DBs cycled+dropped cleanly; no silent exit.
- `.env` still **absent** (privacy hook) — not accidentally created.
- `.gitignore` covers `.env*` (line 40) and `/node_modules` (line 10).
- `git status`: only expected new app files + plan/registry/report edits; no harness/process damage.
- `pnpm start` server started for probes, then killed cleanly (no stray process left).

**Regression checkpoint:** skipped — Phase 01 is the first phase; no previously-verified surfaces exist.

**Verified-status decision:** kept 🧪 TESTING (NOT promoted to ✅ VERIFIED). Every gate passes
independently, but the `.env` open item is beyond the two documented known-gaps, so per the EVL
promotion rule the phase stays TESTING until `.env` is created with user approval.

EVL HANDOFF SUMMARY:
```yaml
gates_green: [build, lint, test, migrate, health, font-render]
known_gaps: [compat-level-140-vs-150-unconfirmed, customer-sql-version-2016-floor-risk, env-file-not-created-privacy-hook-awaiting-user-approval]
follow_up_stubs: none
context_partial: []
preliminary_packet_path: process/features/order-system/active/phase1-order-system_06-07-26/phase-01-foundation_REPORT_06-07-26.md
closeout_classification: WITH_GAPS
```
