---
phase: phase-02-schema-master-data
date: 2026-07-06
status: COMPLETE
feature: order-system
plan: process/features/order-system/active/phase1-order-system_06-07-26/phase-02-schema-master-data_PLAN_06-07-26.md
---

# Phase 02 — Schema & Master Data — EXECUTE Report (DRAFT — EVL pending)

**Agent:** vc-execute-agent (opus) · **Loop step:** 5 EXECUTE · **Gate:** all 7 validate-contract gates green.
This is the EVL handoff source. EVL (vc-tester) must independently re-run the gates before the phase is promoted to ✅ VERIFIED.

## TL;DR

Full Phase-1 schema designed, migrated to the sandbox SQL Server, seeded (idempotent) from the
canonical form with uncertain names flagged, and wired with shops/products CRUD + a vendor T-SQL
export. All 30 checklist items done; all 7 validate-contract gates green. Five within-contract
deviations logged (the load-bearing one: SQL Server has no Prisma enums → String columns, the F1
accepted alternative). No customer/remote DB touched; no credentials seeded.

## What Was Done

- **Schema (A1–A6):** Extended `prisma/schema.prisma` (HealthCheck retained). Added `Shop`
  (rosterOrder `@unique` append-only, `active` soft-delete, `needsConfirmation`), `Product`
  (`group` String, `isOffList`, soft-delete), `ProductVariant` (`packSize`/`labelVariant`,
  `printOrder Int?` NON-unique, `weightKg`/`pipConversion @db.Decimal(10,3)`, `name` snapshot
  source), `OrderSheet` (`date @db.Date`, `location`), `OrderLine` (`qty Int`,
  `shopNameAtEntry`/`variantNameAtEntry` snapshots), `NoteLine` (nullable `shopId` +
  `productVariantId`, `text @db.NVarChar(Max)`, `qty Int?`, snapshots), `User` (no rows seeded, F6),
  `AppSetting`. ALL OrderLine/NoteLine relations `onDelete/onUpdate: NoAction`.
- **Migrations (B0/B1/B1a):** installed `tsx`; `migrate dev` applied `20260706091411_phase02_full_schema`;
  hand-authored `20260706161957_shop_rosterorder_unique` applied via `migrate deploy`; wired
  `migrations.seed` in `prisma.config.ts` (direct `pnpm tsx prisma/seed.ts` is the primary command).
- **Seed (B2/B3):** `prisma/seed.ts` idempotent (upsert on non-null natural keys), env self-loaded via
  `prisma/load-env.ts` side-effect import (F4). Seeded 20 in-order variants (C3–C22), 8 off-list
  products/variants (printOrder NULL, F3), 25 shops. Uncertain readings flagged `needsConfirmation`.
- **CRUD (C1–C4):** `src/app/shops/**` + `src/app/products/**` server actions + RSC forms + client
  form components, zod validation with Thai messages, soft-delete/restore. `src/lib/variant-validation.ts`
  (printOrder uniqueness over active non-null set, F2, C3). `src/lib/correction-cascade.ts`
  (propagate-then-lock snapshot back-fill, decision 6, C4), wired into shop/product edit actions.
- **Export (D1/D2):** `scripts/export-schema-sql.ts` → `db/create-orderstock-schema.sql` (9 CREATE TABLE,
  offline, DDL-only).
- **Constants:** `src/lib/product-order.ts` — canonical 20-variant print-order contract + PackSize/
  ProductGroup/Role typed unions + Thai label maps.

## Test Gate Outcomes

| Gate | Tier | Command | Result | Key output |
|---|---|---|---|---|
| G-migrate | Hybrid | `npx prisma migrate dev` | PASS | migration applied, exit 0; 7 NoAction FKs, 2 Decimal(10,3), 0 printOrder-unique verified in SQL |
| G-export | Fully-Automated | `pnpm tsx scripts/export-schema-sql.ts` + `grep -c "CREATE TABLE"` | PASS | 9 |
| G-seed | Hybrid | `pnpm tsx prisma/seed.ts` ×2 | PASS | counts stable: 20 in-order / 8 off-list / 25 shops / 13 flagged shops / 18 flagged variants |
| G-printorder | Fully-Automated | `pnpm test` | PASS | 5 tests (variant-validation) |
| G-cascade | Fully-Automated | `pnpm test` | PASS | 2 tests (correction-cascade, both branches) |
| — full suite | — | `pnpm test` / `pnpm lint` / `pnpm build` | PASS | 9/9 tests; lint clean; build compiled, TS passed, 9 routes |
| G-crud | Agent-Probe | data round-trip probe vs sandbox | PASS | create→edit(cascade)→confirm→edit(locked)→printOrder→soft-delete(FK resolves)→restore→cleanup |
| G-seedorder | Agent-Probe | ordered-variant inspection vs REF §3 | PASS | 20 variants match C3–C22 exactly; names flagged not asserted |

## What Was Skipped or Deferred

- **User rows / credentials** — intentionally not seeded (F6); Phase 03 owns the admin seed.
- **Thai collation** — deferred to Phase 06 (decision 3); integer ordering used everywhere.
- **Automated CRUD DB-integration test** — backlogged (below); this phase used agent-probe (F7,
  Playwright not until Phase 05).

## Plan Deviations

All within validate-contract blast radius — see the plan's `## Deviations` section (D1–D5). Summary:
- D1 (load-bearing): Prisma `enum` → `String` columns — SQL Server connector rejects Prisma enums
  entirely; F1's accepted alternative. Values in `src/lib/product-order.ts`, app-enforced via zod.
- D2: `Shop.rosterOrder @unique` + hand-authored migration (migrate dev non-interactive-blocked on the
  advisory warning).
- D3: export flag `--to-schema` (Prisma 7 renamed `--to-schema-datamodel`).
- D4: seed env-load via `prisma/load-env.ts` side-effect import (import hoisting; meets F4).
- D5: added `zod` dependency (decision 5 requires it; was not installed).

No hard-stop-class deviations. No auth/billing/public-API/container/secret changes.

## Test Infra Gaps Found

- Server actions call `redirect()`/`revalidatePath()` (need Next request context) → not directly unit-
  testable; the pure validators/cascade were extracted to `src/lib/` and unit-tested, and the DB round-
  trip was proven via an agent-probe. A headless DB-integration harness is backlogged.
- No sandbox-DB reset/fixture helper yet — recommend adding one at UPDATE-PROCESS and recording it in
  `process/context/tests/all-tests.md`.

## Closeout Packet

- **Selected plan:** `.../phase-02-schema-master-data_PLAN_06-07-26.md`
- **Finished:** all 30 checklist items; all 7 gates green; schema migrated + seeded + CRUD + export.
- **Verified vs unverified:** verified this session by execute-agent (migrate/seed/export/units/build +
  two agent-probes). UNVERIFIED until EVL: independent re-run by vc-tester; real-browser CRUD UI (only
  data-layer round-trip was probed).
- **Cleanup remaining:** EVL independent re-run; UPDATE-PROCESS (context updates for new DB/CRUD
  patterns, archive decision); commit Phase 02 execution changes (separate from process commits) — no
  commit made this session (awaiting user instruction per hard constraint).
- **Follow-up stubs created:** `process/features/order-system/backlog/crud-db-integration-harness_NOTE_06-07-26.md`
- **High-risk evidence pack:** `.../harness/phase-02-verification.json`, `.../harness/phase-02-review-decision.json` (APPROVE, conditional on EVL).
- **CONTEXT_PARTIAL:** none.
- **Best next state:** EVL (vc-tester) independent gate re-run → then UPDATE-PROCESS.

## Forward Preview

### Test Infra Found
- Vitest 3.2.6 real + green (now 3 test files / 9 tests). Sandbox `orderstock-sql` up (compat 150).
- `pnpm tsx` now available (installed this phase) for seed/export/probe scripts.

### Blast Radius Changes
- `prisma/schema.prisma` now holds the full domain (9 models). Phase 03 EXTENDS `User` (auth fields) —
  do not rewrite. `role` is a String column ("ADMIN"|"STAFF"), values in `src/lib/product-order.ts`.
- New shared libs: `src/lib/product-order.ts` (print-order contract + enums-as-constants),
  `src/lib/correction-cascade.ts` (Phase 04 writes snapshots, Phase 05 renders them — MUST reuse this).
- `prisma/seed.ts` EXTENDED by Phase 03 (admin seed) — keep idempotent; add rows, don't rewrite.

### Commands to Stay Green
- `pnpm test` (9 tests) · `pnpm lint` · `pnpm build`
- `pnpm tsx prisma/seed.ts` (idempotent; safe to re-run) · `pnpm tsx scripts/export-schema-sql.ts`
- `npx prisma migrate status` (needs sandbox up) — expect "up to date", 3 migrations.

### Dependency Changes
- Added `tsx` (devDep), `zod` (dep). `prisma.config.ts` gained a `migrations.seed` key.
- No native-build deps added (tsx + zod are pure JS; no `pnpm-workspace.yaml allowBuilds` change needed).

## Open Items For EVL

1. Independently re-run G-migrate (`prisma migrate status`), G-seed (seed ×2 counts stable), G-export
   (grep CREATE TABLE), G-printorder/G-cascade (`pnpm test`), plus `pnpm build`/`pnpm lint`.
2. Confirm no regression to Phase 01 surfaces (health endpoint, HealthCheck model still migrates).
3. Register the backlog CRUD-integration-harness stub in the umbrella if tracked centrally.
4. Seeded Thai names remain `needsConfirmation` — not to be asserted correct; user confirmation absorbs
   via CRUD edit-save + correction-cascade.

---

## EVL HANDOFF SUMMARY (vc-tester, loop step 6, 06-07-26)

Independent re-verification (unconditional re-run — execute evidence treated as unconfirmed). All 7
validate-contract gates re-confirmed independently. Regression vs Phase 01 clean. No customer/remote DB
touched; 9 unrelated containers untouched; dev server started for probes was killed.

### Gate table — independent result vs execute claim

| Gate | Execute claim | Independent EVL result | Evidence |
|---|---|---|---|
| G-migrate (migrate status) | PASS | **PASS** | 3 migrations, schema up to date |
| G-export (vendor SQL) | PASS (9 CREATE TABLE) | **PASS** | db/create-orderstock-schema.sql, 9 CREATE TABLE, no logins/passwords |
| G-seed (idempotent) | PASS (20/8/25/13/18) | **PASS** | re-run counts identical; 0 leftover rows |
| G-seedorder (vs REF C3–C22) | PASS | **PASS** | 20 in-order variants match REF §3 exactly; off-list=8 (NULL); shops=25 rosterOrder ascending; flags 13/18 |
| G-printorder (Vitest) | PASS (5 tests) | **PASS** | pnpm test 9/9 |
| G-cascade (Vitest + live) | PASS | **PASS** | unit + live-DB probe: unconfirmed→propagate(1), confirmed→lock(0), decision 6 proven |
| G-crud (round-trip) | PASS (agent-probe) | **PASS** | independent tsx round-trip create→edit→confirm→edit→soft-delete(FK resolves)→cleanup; count 25→25; + GET /shops,/products 200 render seeded Thai + 'รอยืนยัน' badge |
| full suite (test/lint/build) | PASS | **PASS** | 9/9 tests; lint exit 0; build 9 routes |

### Regression (Phase 01 overlapping surfaces)

| Surface | Result |
|---|---|
| GET /api/health | PASS — 200 `{"ok":true}` |
| Thai font woff2 | PASS — /fonts/Sarabun-400-thai.woff2 200 font/woff2 9880 B |
| HealthCheck model | PASS — unchanged (id + checkedAt); init migration intact |
| pnpm build | PASS — compiles, 9 routes |

### Deviation audit
- **D1** CONFIRMED — `z.enum(PACK_SIZES)` / `z.enum(PRODUCT_GROUPS)` enforce packSize/group app-side (products/actions.ts); ROLES defined (role validation is Phase 03).
- **D2** CONFIRMED — rosterOrder unique-index migration applied; migrate status up to date.

### Verified-status decision
**PROMOTE to ✅ VERIFIED.** Promotion rule satisfied: all 7 gates pass independently AND only documented/accepted
known-gaps remain. **Caveat (honest):** G-crud real-browser UI not exercised (Agent-Probe tier by design;
Playwright lands Phase 05) — data-layer round-trip + HTTP read-path independently confirmed instead. Seeded Thai
names remain `needsConfirmation` (accepted Entry-Gate path, NOT a VERIFIED blocker this phase).

### Open items (all accepted, non-blocking)
- Seeded Thai names pending user confirmation (absorbed via CRUD edit-save + cascade).
- Thai collation deferred to Phase 06 (integer ordering used).
- CRUD automated DB-integration harness backlogged (`crud-db-integration-harness_NOTE_06-07-26.md`).
- Sandbox compat 150; customer target 140/2017 unconfirmed (program known-gap).

EVL HANDOFF SUMMARY:
```yaml
gates_green: [G-migrate, G-export, G-seed, G-seedorder, G-printorder, G-cascade, G-crud, full-suite-test-lint-build]
known_gaps: [thai-names-needsConfirmation-accepted, thai-collation-deferred-phase-06, crud-automated-harness-backlogged, customer-compat-140-unconfirmed]
follow_up_stubs: [crud-db-integration-harness_NOTE_06-07-26.md]
context_partial: []
preliminary_packet_path: none
closeout_classification: CLEAN
```
