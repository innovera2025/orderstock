---
name: plan:phase1-order-system-phase-02-schema-master-data
description: "orderstock Phase 1 — Phase 02: full schema, migrations, shops/products CRUD, seed from canonical form, vendor SQL-script export"
date: 06-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: order-system
  phase: phase-02
---

# Phase 02 — Schema & Master Data

**Program:** phase1-order-system
**Umbrella plan:** process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
**Phase status:** ✅ VERIFIED (06-07-26 — EXECUTE DONE; EVL independent re-run confirmed all 7 gates + Phase-01 regression; only accepted known-gaps remain. Residual: real-browser CRUD UI deferred to Phase 05 Playwright; seeded Thai names needsConfirmation = accepted Entry-Gate path. UPDATE PROCESS + commit remain.)
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-02-schema-master-data_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Design and migrate the full Phase-1 database schema and build master-data management. Model the domain the canonical form implies: shops, products with package-size/flavor variants carrying a fixed print-column order and a product group (สินค้า / เครื่องปรุง), order sheets, order lines, users, and app settings. Provide shops/products CRUD pages, a seed script derived from the canonical form data (with uncertain names flagged pending user confirmation), and the vendor SQL-script export pipeline.

---

## Entry Gate

- Phase 01 exit gate passed (app boots, connects to sandbox, health green). **PVL re-verified 06-07-26:** Phase 01 status ✅ VERIFIED; sandbox `orderstock-sql` container Up; 10 running containers (9 unrelated — never touch).
- **Code inventory (RESEARCH, re-verified at PVL):** `prisma/schema.prisma` currently holds ONLY `HealthCheck` — EXTEND it, never rewrite. Reuse the `src/lib/db.ts` singleton (do NOT build new clients; it throws if `DATABASE_URL` unset). `prisma.config.ts` exists, loads `.env` via `process.loadEnvFile`, but has NO `migrations.seed` key yet (add it — decision 4). `.env` exists (privacy-guarded). Only migration on disk: `20260706074539_init_healthcheck`. No `scripts/` or `db/` dir yet. **`tsx` is NOT a devDependency** — install it (checklist B0) since exit gates use `pnpm tsx ...`.
- ~31 uncertain master-data readings pending user confirmation (packet delivered; answers may arrive mid-phase). Seed proceeds with `needsConfirmation=true` for unanswered items (NOT a hard block). **Late-answer absorption path:** a CRUD edit-save on the flagged entity clears `needsConfirmation` AND fires the shared `correction-cascade.ts` back-fill (typo fixes propagate to snapshots while still unconfirmed; locked once confirmed). Late answers are absorbed by editing the seeded row, NOT by blocking the phase.
- Date-handling decision confirmed: store CE, display Buddhist Era (see umbrella + all-context gotchas; display applies Phase 04+).

---

## Product-Variant Print-Order Contract (from RESEARCH — LOAD-BEARING; Phases 04/05 consume this)

20 data columns C3–C22 in fixed print order = 14 base products. Group `สินค้า` = C3–C18 (16 cols); group `เครื่องปรุง` = C19–C22 (4 cols). `packSize` ∈ {`1KG`,`HALF_KG`,`NONE`} (LABELS — see PVL fix F1 for the ASCII enum-identifier requirement: DB enum members are `KG_1`/`HALF_KG`/`NONE`, Thai/display labels held separately). Qty values are always positive INTEGERS (½ กก. is a pack-size LABEL, not 0.5 qty) → `OrderLine.qty Int`. `weightKg`/`pipConversion` are `Decimal` nullable (values unknown until user answers Q22).

| printOrder | Col | Base product | packSize / label | group |
|---|---|---|---|---|
| 1 | C3 | ดีนิ่ม A | NONE | สินค้า |
| 2 | C4 | ดีลานนิ่ม | 1KG | สินค้า |
| 3 | C5 | ดีลานนิ่ม | HALF_KG | สินค้า |
| 4 | C6 | ดีลาน | 1KG | สินค้า |
| 5 | C7 | ดีลาน | HALF_KG | สินค้า |
| 6 | C8 | กรวด | NONE | สินค้า |
| 7 | C9 | กรวดเหลือง | NONE | สินค้า |
| 8 | C10 | รอง | 1KG | สินค้า |
| 9 | C11 | รอง | HALF_KG | สินค้า |
| 10 | C12 | แบะแซ | 1KG | สินค้า |
| 11 | C13 | แบะแซ | HALF_KG | สินค้า |
| 12 | C14 | สารส้ม | NONE | สินค้า |
| 13 | C15 | ปูนแดง | NONE | สินค้า |
| 14 | C16 | ปูนแดง (กป) | NONE | สินค้า |
| 15 | C17 | เลอรส | หมู | สินค้า |
| 16 | C18 | เลอรส | ไก่ | สินค้า |
| 17 | C19 | น้ำปลา | น้ำเงิน | เครื่องปรุง |
| 18 | C20 | น้ำตาล | แดง | เครื่องปรุง |
| 19 | C21 | ส้มแว่น | เขียว | เครื่องปรุง |
| 20 | C22 | ส้มบด | ส้ม | เครื่องปรุง |

(Names in this table are the form's typeset readings; the ~31 uncertain-reading flags apply — seed with `needsConfirmation` where flagged. Source: form-canonical_REF §3/§5.)

---

## Decisions (from INNOVATE — verdict GO)

| # | Decision | Chosen |
|---|---|---|
| 1 | Off-list note products | Hybrid: `NoteLine` keeps free text + qty AND an optional NULLABLE `productVariantId` FK. Known recurring off-list items become real Product/Variant rows (flagged off-list, `printOrder` NULL); ambiguous ones stay text-only. |
| 2 | Sheet rows | No 29-slot placeholder table, no live reconstruction. `Shop.rosterOrder` is APPEND-ONLY/immutable once referenced by any sheet (never renumber; new shops get higher values). `NoteLine.shop` FK nullable for orphan remarks (row 20). |
| 3 | Thai collation | SKIP now — integer ordering (`printOrder`/`rosterOrder`) everywhere; admin lists accept code-point sort. Real collation decision DEFERRED to Phase 06 delivery (customer server collation unknown). Documented as a known-gap. |
| 4 | Seed wiring | BOTH: `migrations.seed` in `prisma.config.ts` + direct `tsx prisma/seed.ts` as the PRIMARY documented command (exit gate uses the direct run; upstream bugs #27769/#27773 make `prisma db seed` unreliable). Seed is IDEMPOTENT (upsert on natural keys). `needsConfirmation` cleared automatically by a CRUD edit-save. |
| 5 | CRUD shape | Server actions + RSC forms; zod validation colocated per action (Thai error messages); printOrder-uniqueness via a zod-backed action (C3) — **app-level, NOT a DB `@unique` on nullable printOrder** (see PVL fix F2). SOFT-DELETE (`active Boolean`) on Shop/Product — never hard delete (historical FKs must resolve). |
| 6 | Historical fidelity (LOAD-BEARING — ripples to Phases 04/05) | FK + denormalized name-snapshot columns (`shopNameAtEntry`, `variantNameAtEntry`) on `OrderLine`/`NoteLine`, written at line-create time. Correction cascade: ONE shared function back-fills snapshots ONLY while the referenced entity still has `needsConfirmation=true` (typo fixes propagate); once confirmed → LOCKED, later renames do NOT rewrite history. Phase 05 prints from snapshots, never live names. |

---

## PVL Fixes Applied (06-07-26 — folded in from the validate-contract)

These are the plan-text fixes the PVL applied. Full rationale in the `## Validate Contract` below.

- **F1 — Enum identifiers must be ASCII.** Prisma enum members must match `[A-Za-z_][A-Za-z0-9_]*`. `1KG` (leading digit) and Thai literals (สินค้า/เครื่องปรุง) are INVALID enum identifiers. Use `enum PackSize { KG_1, HALF_KG, NONE }` and `enum ProductGroup { GOODS, SEASONING }` (comment the Thai reading beside each member); hold Thai display text in a UI label map. Alternative accepted: store packSize/group as `String`. Do NOT emit `1KG` or Thai as an enum literal.
- **F2 — printOrder is NOT a DB `@unique` on a nullable column.** SQL Server allows only ONE NULL per UNIQUE constraint; off-list variants carry `printOrder = NULL`, so a plain `@unique`/`@@unique` including printOrder would reject the 2nd off-list row. Enforce printOrder uniqueness at the APP layer (decision 5, C3 zod-backed action) over the ACTIVE non-null set. If a DB guarantee is wanted, use a filtered unique index authored in raw SQL (`WHERE printOrder IS NOT NULL`), NOT a Prisma `@unique`.
- **F3 — Seed natural key for off-list rows cannot be printOrder (it is NULL).** Idempotent upsert `where` for the 20 in-order variants may use `(productId, printOrder)`; off-list variants (printOrder NULL) MUST upsert on a different non-null natural key — `(productName, packSize, labelVariant)` or a deterministic seed slug. Do not target a NULL column in an upsert `where`.
- **F4 — seed.ts must load env itself.** `pnpm tsx prisma/seed.ts` does NOT pass through `prisma.config.ts`, so `.env` is NOT auto-loaded and `db.ts` throws on missing `DATABASE_URL`. Add `process.loadEnvFile()` (Node 22+) at the top of `prisma/seed.ts`, OR run via `node --env-file=.env`. Document the exact working command in the exit gate.
- **F5 — Decimal precision is explicit.** `weightKg`/`pipConversion` use `@db.Decimal(p,s)` (e.g. `@db.Decimal(10,3)`) so the generated T-SQL is deterministic for the DBA; nullable, values unknown until Q22 — precision choice documented as revisitable.
- **F6 — No User credentials seeded in Phase 02.** The `User` model is defined here (so the export script is complete) but NO User rows / passwords are seeded — Phase 03 owns the admin seed. Prevents a default/plaintext credential landing in the sandbox.
- **F7 — CRUD e2e is manual/agent-probe, not Playwright.** Playwright is not installed until Phase 05. The CRUD round-trip hybrid gate is a manual/agent-driven flow against the sandbox; automatable slices (server-action validators, printOrder-uniqueness, correction-cascade) get Vitest units.

---

## Inner Loop Refresh Note

- **Date:** 06-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after RESEARCH (DONE_WITH_CONCERNS) + INNOVATE (GO).
- **Sections changed:** Entry Gate (code inventory: HealthCheck-only schema, singleton reuse, no migrations.seed key, tsx missing), Blast Radius (NoteLine FK, snapshot columns, prisma.config.ts, tsx devDep), Implementation Checklist (B0 install tsx; A1/A2/A3 rosterOrder-immutable + NoteLine nullable + snapshot columns + qty Int; B1/B2 dual seed wiring + idempotent upsert; C1/C2 server-actions + soft-delete; correction-cascade item), Blockers (Prisma seed-bug note), NEW Product-Variant Print-Order Contract table, NEW Decisions section, Phase Loop Progress (steps 1–3 ticked), status → TESTING, Resume handoff (next = PVL).
- **Key findings folded in:** current code inventory + tsx-missing; Prisma 7 seed mechanism change (migrations.seed + bugs #27769/#27773); 20-column printOrder contract; sheet facts (29 slots, orphan row 20 → nullable NoteLine.shop, integer qty); SQL Server NVARCHAR/one-NULL-per-UNIQUE/NoAction/@db.Date; INNOVATE decisions 1–6.
- **Validate-contract:** WRITTEN 06-07-26 (PVL step 4) — CONDITIONAL, generated-by inner-pvl: phase-02. Placeholder replaced.
- **Cross-phase ripple:** Historical-fidelity snapshot columns (`shopNameAtEntry`, `variantNameAtEntry`) — Phases 04/05 MUST write/render from snapshots, not live names. Propagated to umbrella + registry.

---

## Blast Radius

- `prisma/schema.prisma` — full models (EXTEND HealthCheck, do NOT rewrite): `Shop` (rosterOrder immutable-once-referenced, active soft-delete), `Product`, `ProductVariant` (printOrder, packSize enum `KG_1`/`HALF_KG`/`NONE`, group enum `GOODS`/`SEASONING`, labelVariant, weightKg/pipConversion `@db.Decimal`?), `OrderSheet`, `OrderLine` (qty Int, `shopNameAtEntry`/`variantNameAtEntry` snapshots), `NoteLine` (off-list remark + qty, nullable shop FK, nullable productVariantId FK, snapshot cols), `User`, `AppSetting`
- `prisma/migrations/**` — generated migrations
- `prisma/seed.ts` — IDEMPOTENT seed (loads env; upsert on non-null natural keys): shops + 20 product-variants in fixed print order + known off-list note products, uncertain names flagged `needsConfirmation=true`
- `prisma.config.ts` — add `migrations.seed` key (EXTEND, from Phase 01)
- `package.json` — add `tsx` devDependency
- `src/lib/correction-cascade.ts` — shared snapshot back-fill function (propagates only while needsConfirmation=true) + Vitest unit
- `scripts/export-schema-sql.ts` — wraps `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
- `src/app/shops/**` — list/create/edit/delete shops
- `src/app/products/**` — list/create/edit products + variants (packSize, group, printOrder)
- `src/lib/product-order.ts` — canonical print-column order constant (20 variants, C3–C22)

---

## Implementation Checklist

### Step A — Schema design

- [x] A1. Model `Product` (name, `group` enum `ProductGroup { GOODS, SEASONING }` — ASCII members, Thai สินค้า/เครื่องปรุง as commented display labels) + `ProductVariant` (product FK, `packSize` enum `PackSize { KG_1, HALF_KG, NONE }` — ASCII members, NEVER `1KG`; labelVariant String e.g. หมู/ไก่/น้ำเงิน, printOrder Int nullable — **NOT `@unique`** (F2), weightKg `@db.Decimal(10,3)?`, pipConversion `@db.Decimal(10,3)?`) — capture the 20 print columns as variants in fixed order. (PVL F1, F2, F5)
- [x] A2. Model `Shop` (name, needsConfirmation bool, active bool [soft-delete], rosterOrder int — APPEND-ONLY/immutable once referenced by any sheet).
- [x] A3. Model `OrderSheet` (date CE, `@db.Date`, location/สถานที่) + `OrderLine` (sheet FK, shop FK, variant FK, qty **Int**, `shopNameAtEntry`/`variantNameAtEntry` snapshot cols written at create time) + `NoteLine` (sheet FK, **nullable** shop FK for row-20 orphan, **nullable** productVariantId FK, text, qty Int nullable, snapshot cols). Set `onDelete: NoAction, onUpdate: NoAction` on ALL OrderLine/NoteLine relations (Sheet/Shop/Variant) — SQL Server rejects multiple/cyclic cascade paths (F-cascade / REF §3).
- [x] A4. Model `User` (username unique, passwordHash, role enum `Role { ADMIN, STAFF }`) — created here so the export script is complete; auth logic AND admin seed land in Phase 03. **Do NOT seed any User rows here** (F6).
- [x] A5. Model `AppSetting` (key unique, value) for the runtime connection string + misc settings. (Value may hold a connection string in Phase 06 — secret-handling is Phase 06's concern; Phase 02 writes no secrets here.)
- [x] A6. Respect SQL Server 2017+ constraints from db-auth REF §3: one NULL per UNIQUE (→ F2 printOrder); NoAction on self/cyclic cascade (→ A3); no native Json (use NVarChar(Max) if ever needed — Phase 1 does not).

### Step B — Migrations + seed

- [x] B0. Add `tsx` as a devDependency (`pnpm add -D tsx`) — exit gates run `pnpm tsx ...` and it is not yet installed.
- [x] B1. `pnpm prisma migrate dev` to apply the full schema to the sandbox (EXTEND HealthCheck, never rewrite). Verify the migrate exits 0 — this is the load-bearing proof that F1/F2/F5/cascade choices are valid on SQL Server.
- [x] B1a. Wire seed BOTH ways: add `migrations.seed` to `prisma.config.ts` AND document `pnpm tsx prisma/seed.ts` as the PRIMARY command (Prisma bugs #27769/#27773 make `prisma db seed` unreliable).
- [x] B2. Write IDEMPOTENT `prisma/seed.ts`: (a) FIRST line loads env — `process.loadEnvFile()` (Node 22+) OR run via `node --env-file=.env` (F4); (b) upsert the 20 in-order variants on natural key `(productName, printOrder)`; (c) off-list note products (ดีขาว 1กก/½กก, ลานนิ่ม(ใส), พริกแดง, รอง 5กก. etc. per REF §7/§10) as real off-list Product/Variant rows (printOrder NULL) upserted on a NON-NULL natural key `(productName, packSize, labelVariant)` — NEVER on the NULL printOrder column (F3); (d) shops from REF §4 with `needsConfirmation=true` on uncertain readings.
- [x] B2-note. Uncertain names must be visibly flagged, NOT silently seeded as fact.
- [x] B3. Run seed; verify counts (20 in-order variants, ~29 shop slots). Run seed a SECOND time and assert counts unchanged (idempotency proof).

### Step C — Master-data CRUD

- [x] C1. Shops pages: list, create, edit, **soft-delete** (`active=false`, never hard delete) — server actions + RSC forms, zod validation with Thai error messages.
- [x] C2. Products pages: list, create/edit product + variants (packSize, group, printOrder, weightKg, pipConversion) — server actions + soft-delete.
- [x] C3. Validate printOrder uniqueness within the ACTIVE non-null variant set via a zod-backed action (APP-level, F2). Provide a Vitest unit for this validator.
- [x] C4. Edit-save clears `needsConfirmation`; wire the shared `correction-cascade.ts` so a name fix back-fills OrderLine/NoteLine snapshots ONLY while the entity is still `needsConfirmation=true` (locked once confirmed). Provide a Vitest unit covering both branches (unconfirmed → propagates; confirmed → locked).

### Step D — Vendor SQL export

- [x] D1. `scripts/export-schema-sql.ts` runs `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` → `db/create-orderstock-schema.sql` (offline, no DB needed). Create the `db/` dir if missing.
- [x] D2. Confirm the output is valid T-SQL DDL reviewable in SSMS; note it does NOT create the DB or logins (Phase 06 hand-authors those).

---

## Test Plan (TDD-first — tier assignments)

Test context loaded at PVL: `process/context/tests/all-tests.md` (Vitest 3.2.6 real + green; Playwright NOT until Phase 05; sandbox `orderstock-sql` for DB gates; commands `pnpm test`/`pnpm build`/`pnpm lint`/`pnpm prisma migrate ...`). Existing test discovered: `src/lib/__tests__/smoke.test.ts`.

**Area: schema + migrations (high-risk: schema/migration)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Full schema migrates to sandbox (proves F1/F2/F5/cascade valid on SQL Server) | precondition: sandbox `orderstock-sql` up; `pnpm prisma migrate dev` exits 0 | schema valid on SQL Server incl. enum identifiers, no illegal cascade, no multi-NULL unique | customer prod DB / compat 140 |
| Fully-automated | Vendor SQL script generates | `pnpm tsx scripts/export-schema-sql.ts` then `grep -c "CREATE TABLE" db/create-orderstock-schema.sql` > 0 | offline export works | DBA-run correctness |

**Area: seed (high-risk: data write / idempotency)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Seed loads + is idempotent | precondition: sandbox up + schema migrated; `pnpm tsx prisma/seed.ts` twice, counts stable (20 in-order variants, ~29 shops) | env-loading (F4), upsert natural keys incl. off-list NULL printOrder (F3), no dup rows | name-reading correctness (user must confirm) |
| Agent-probe | Seeded variants match print order | inspect variant list ordered by printOrder vs form-canonical REF §3 C3–C22 | seed print-order fidelity | uncertain-name truth |

**Area: master-data CRUD + logic (high-risk: public data write)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | printOrder uniqueness enforced over active non-null set | Vitest unit on the zod-backed validator: `pnpm test` exits 0 | ordering integrity (F2 app-level) | DB-level guarantee |
| Fully-automated | correction-cascade propagates only while needsConfirmation | Vitest unit both branches: `pnpm test` exits 0 | snapshot lock semantics (decision 6) | live UI |
| Hybrid | Create→edit→soft-delete a shop + a product-variant e2e | precondition: sandbox up + `pnpm dev`; MANUAL / agent-driven browser flow (Playwright NOT installed until Phase 05) | CRUD round-trips to DB, soft-delete keeps FKs resolvable | print layout |

High-risk (schema/migration + data write): minimum Hybrid — satisfied by migrate + seed + CRUD gates. No high-risk area is left at known-gap.

---

## Exit Gate

```bash
pnpm prisma migrate dev            # Expected: full schema applied, exits 0 (proves F1/F2/F5/cascade)
pnpm tsx prisma/seed.ts && pnpm tsx prisma/seed.ts   # Expected: idempotent; counts stable (env loaded per F4)
pnpm tsx scripts/export-schema-sql.ts && grep -c "CREATE TABLE" db/create-orderstock-schema.sql  # Expected: >0
pnpm test                          # Expected: printOrder-uniqueness + correction-cascade units green
# Manual/agent-driven (no Playwright yet): create + edit + soft-delete a shop and a product-variant on the sandbox
```

- Shops/products CRUD works e2e on the sandbox.
- `migrate diff --script` produces a valid T-SQL file.
- Seed loads canonical form data with uncertain names flagged; seed is idempotent.
- printOrder-uniqueness and correction-cascade units green.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- User has not confirmed uncertain master-data names AND is unavailable → seed with `needsConfirmation=true` and continue (NOT a hard block); document in report.
- SQL Server rejects a schema construct (cyclic cascade, multi-NULL unique, illegal enum literal) → apply PVL fixes F1/F2 + NoAction per REF §3; only BLOCKED if unresolvable after those.
- `prisma db seed` fails due to upstream bugs #27769/#27773 → use the direct `pnpm tsx prisma/seed.ts` command (already the documented primary); NOT a block.
- Phase 01 foundation not actually green → dependency BLOCKED. (Re-verified green at PVL — not blocked.)

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE_WITH_CONCERNS — code inventory (HealthCheck-only, tsx missing, no migrations.seed), Prisma 7 seed change, printOrder contract, sheet facts, SQL Server constraints (encoded above)
- [x] 2. INNOVATE — innovate-agent: DONE — verdict GO; Decision Summary (decisions 1–6) written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: full V1–V7 run 06-07-26; Net Gate CONDITIONAL; validate-contract written (7 fixes folded in, 2 accepted known-gaps). EXECUTE gated on explicit user consent (umbrella hard constraint).
- [x] 5. EXECUTE — DONE 06-07-26 (vc-execute-agent, opus). All 30 checklist items done; all 7 validate-contract gates green (G-migrate, G-export, G-seed, G-printorder, G-cascade, G-crud, G-seedorder). One within-contract deviation logged (enum→String, F1 accepted alternative). Report + harness evidence written. EVL independent re-run pending.
- [x] 6. EVL — DONE 06-07-26 (vc-tester). All 7 validate-contract gates re-confirmed INDEPENDENTLY (unconditional re-run); Phase-01 regression clean (health 200, font woff2 200, HealthCheck untouched, build 9 routes); D1/D2 deviations audited & confirmed; harness/phase-02-verification.json updated with evlConfirmation; EVL HANDOFF SUMMARY written. Verdict: PROMOTE to VERIFIED (caveat: G-crud real-browser UI is Agent-Probe tier, Playwright Phase 05; seeded names needsConfirmation = accepted Entry-Gate path).
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract written — EXECUTE may proceed on explicit user consent (ENTER EXECUTE MODE).**

---

## Deviations (EXECUTE, 06-07-26 — all within validate-contract blast radius)

- **D1 — Prisma `enum` → `String` columns (WITHIN CONTRACT, F1 accepted alternative).** The SQL Server connector does NOT support Prisma `enum` types at all (`prisma validate` error P1012: "the current connector does not support enums"). The plan's primary choice (ASCII enum members) is impossible on this connector; F1 explicitly offers "Alternative accepted: store packSize/group as `String`." Applied: `packSize`/`group`/`role` are `@db.NVarChar(20)` String columns holding the ASCII values `KG_1`/`HALF_KG`/`NONE`, `GOODS`/`SEASONING`, `ADMIN`/`STAFF`. Allowed values are the single source of truth in `src/lib/product-order.ts` (typed unions + label maps) and enforced at the app layer via zod. Impact: none on downstream contract — Phases 04/05 read the same ASCII values; Thai display via the label map. No user gate (within-contract, AS2 alternative).
- **D2 — `Shop.rosterOrder` given `@unique` + hand-authored migration (WITHIN BLAST RADIUS).** rosterOrder is a natural key (one shop per roster slot) needed for the idempotent seed upsert; added `@unique` (non-null column, so SQL Server one-NULL rule is not violated). `prisma migrate dev` is non-interactive-blocked on the constraint-add advisory warning in this environment, so the migration (`20260706161957_shop_rosterorder_unique`: drop non-unique index, create unique index) was hand-authored and applied via `prisma migrate deploy`. Same pipeline, same result.
- **D3 — `scripts/export-schema-sql.ts` uses `--to-schema` not `--to-schema-datamodel` (WITHIN BLAST RADIUS).** Prisma 7 removed the `--to-schema-datamodel` flag named in the plan; the current flag is `--to-schema`. Script updated accordingly; offline export produces 9 CREATE TABLE.
- **D4 — seed env-load via `prisma/load-env.ts` side-effect import (WITHIN CONTRACT, F4).** A plain `process.loadEnvFile()` statement in `seed.ts` runs AFTER the hoisted `db.ts` import (ES import hoisting), so `db.ts` threw on missing DATABASE_URL. Fixed by extracting env-load into a side-effect module imported FIRST (imports execute in source order). This is the F4 requirement met via the cleanest mechanism.
- **D5 — added `zod` dependency (WITHIN BLAST RADIUS).** Decision 5 specifies "zod validation colocated per action" but zod was not yet installed. Added `zod` (pure JS, no native build script needed).

---

## Touchpoints

- `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`
- `scripts/export-schema-sql.ts`, `db/create-orderstock-schema.sql`
- `src/app/shops/**`, `src/app/products/**`, `src/lib/product-order.ts`, `src/lib/correction-cascade.ts`

---

## Public Contracts

- Defines the `ProductVariant.printOrder` contract (20 columns, C3–C22) consumed by Phases 04 and 05.
- Defines the vendor T-SQL script contract reproduced/hand-augmented in Phase 06.
- Extends `prisma/schema.prisma` from Phase 01 (extend HealthCheck, do not rewrite).
- **Cross-phase (LOAD-BEARING):** `OrderLine.shopNameAtEntry` / `OrderLine.variantNameAtEntry` (and NoteLine equivalents) are historical snapshots — Phases 04 (write) and 05 (render) MUST use them, never live names.
- **Enum contract (PVL F1):** `PackSize { KG_1, HALF_KG, NONE }` and `ProductGroup { GOODS, SEASONING }` are ASCII enum identifiers; Thai display text is a UI-layer label map — consumers in Phases 04/05 read the enum members, not Thai literals.
- **Accepted sequencing risk:** Phase 02 CRUD pages are temporarily UNGUARDED until Phase 03 adds auth/middleware (already accepted in the umbrella — sandbox-only, no external exposure).

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Full schema migrates to sandbox | Hybrid | DoD #2 (schema on SQL Server) — proven by: migrate hybrid gate |
| Vendor T-SQL script generated | Fully-Automated | DoD #2 (vendor script export) — proven by: export-sql gate |
| Seed idempotent + env-loaded | Hybrid | DoD #2 (master data seed) — proven by: seed hybrid gate (run twice) |
| printOrder uniqueness / correction-cascade | Fully-Automated | DoD #2/#4 (data integrity, historical fidelity) — proven by: Vitest units |
| Shop CRUD round-trips | Hybrid | DoD #2 (master data mgmt) — proven by: CRUD manual/agent hybrid gate |
| Seeded variants match print order | Agent-Probe | DoD #4/#5 (print-order fidelity) — proven by: seed agent-probe |

```bash
pnpm tsx scripts/export-schema-sql.ts && grep -c "CREATE TABLE" db/create-orderstock-schema.sql  # Expected: >0
```

---

## Test Infra Improvement Notes

- Add a reusable sandbox-DB fixture/reset helper so hybrid CRUD + seed-idempotency tests run from a known state. Record the command in `process/context/tests/all-tests.md` at UPDATE-PROCESS.
- Register a backlog stub for a Vitest DB-integration harness (server actions against sandbox) so the CRUD round-trip can graduate from manual to automated before Phase 05 Playwright lands.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-02-schema-master-data_PLAN_06-07-26.md`
- Last completed step: 4. PVL (validate-contract written — CONDITIONAL)
- Validate-contract status: WRITTEN (CONDITIONAL, inner-pvl: phase-02). NEXT STEP is EXECUTE (Step 5), gated on explicit user consent (ENTER EXECUTE MODE) per umbrella hard constraint.
- Next step: On explicit user consent, spawn vc-execute-agent (opus) per this plan + the validate-contract Execute-agent instructions E1–E9. Sandbox DB only; never touch a customer/remote DB; do not stop/restart the 9 unrelated Docker containers. Uncertain-name answers may arrive mid-phase; seed with needsConfirmation until then.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: ✅ VERIFIED (06-07-26 — EVL independent re-run confirmed all 7 gates + regression; UPDATE PROCESS + commit remain)

## Overview

This is a phase plan within the phase1-order-system phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`phase1-order-system-umbrella_PLAN_06-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written (now written — EXECUTE gated on user consent).

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan has completed VALIDATE (PVL); ENTER EXECUTE MODE only on explicit user consent.

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

Status: CONDITIONAL
Date: 06-07-26
date: 2026-07-06
generated-by: inner-pvl: phase-02

Parallel strategy: sequential
Rationale: 4/7 signals (S2 schema surface, S4 phase-program, S6 high-risk schema/migration, S7 5+ files). Dominant signal S6. EXECUTE is a strictly ordered pipeline (schema → migrate → seed → CRUD → export) with hard step dependencies and no independent parallel workstreams — a single vc-execute-agent (opus) is the correct fit; the higher-tier strategies (workflow / agent-team) add coordination overhead with no parallelism to exploit in one cohesive schema phase.

### Test gates (C3 5-column table)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| G-migrate | Full schema migrates to SQL Server sandbox (enum ids, no illegal cascade, no multi-NULL unique valid) | Hybrid | `pnpm prisma migrate dev` exits 0 (precondition: `orderstock-sql` up) | A — proven at EXECUTE by the migrate gate |
| G-export | Vendor T-SQL DDL script generates offline | Fully-Automated | `pnpm tsx scripts/export-schema-sql.ts && grep -c "CREATE TABLE" db/create-orderstock-schema.sql` > 0 | A |
| G-seed | Seed loads + is idempotent, env self-loaded, off-list NULL-printOrder upsert works | Hybrid | `pnpm tsx prisma/seed.ts` run twice, counts stable (precondition: schema migrated) | A |
| G-printorder | printOrder uniqueness enforced over active non-null set (app-level) | Fully-Automated | `pnpm test` — Vitest unit on zod validator exits 0 | B — unit added by C3 in this plan |
| G-cascade | correction-cascade back-fills only while needsConfirmation=true, locks after | Fully-Automated | `pnpm test` — Vitest unit both branches exits 0 | B — unit added by C4 in this plan |
| G-crud | Shop + product-variant create→edit→soft-delete round-trips on sandbox | Agent-Probe | Manual/agent-driven browser flow against `pnpm dev` (Playwright not installed until Phase 05) | C — deferred to manual probe; automated DB-integration harness backlogged |
| G-seedorder | Seeded variants match C3–C22 print order | Agent-Probe | Inspect variant list ordered by printOrder vs form-canonical REF §3 | C — human/agent judgment; uncertain names flagged not asserted |

gap-resolution legend: A proven now/at-EXECUTE · B gate added by this plan · C deferred/named residual · D backlog stub.

C-4 reconciliation: the `strategy` column carries only the 3 proving strategies (Fully-Automated / Hybrid / Agent-Probe). No Known-Gap is used as a strategy; the two accepted residuals are carried in Known gaps below.

Legacy line form (retained for existing consumers):
- schema+migrations: Hybrid — `pnpm prisma migrate dev` exits 0 (precondition: sandbox up)
- vendor export: Fully-automated — `pnpm tsx scripts/export-schema-sql.ts` + `grep -c "CREATE TABLE" ... > 0`
- seed: Hybrid — `pnpm tsx prisma/seed.ts` twice, counts stable (precondition: schema migrated)
- printOrder-uniqueness + correction-cascade: Fully-automated — `pnpm test`
- CRUD round-trip: agent-probe — manual/agent browser flow (Playwright deferred to Phase 05)

**Failing stub (G-printorder):**
test("should reject a duplicate printOrder within the active non-null variant set", () => { throw new Error("NOT IMPLEMENTED — TDD stub: printOrder uniqueness enforced over active non-null set") })

**Failing stub (G-cascade):**
test("should back-fill snapshots only while needsConfirmation=true and lock after confirm", () => { throw new Error("NOT IMPLEMENTED — TDD stub: correction-cascade propagate-then-lock") })

### Plan updates applied (folded into the checklist above)

- [x] F1 — Enum identifiers forced ASCII (`PackSize { KG_1, HALF_KG, NONE }`, `ProductGroup { GOODS, SEASONING }`); Thai as display label map. (A1, A4)
- [x] F2 — printOrder is nullable and NOT a DB `@unique`; uniqueness enforced app-level over the active set. (A1, C3)
- [x] F3 — off-list variants (printOrder NULL) upsert on non-null natural key `(productName, packSize, labelVariant)`. (B2)
- [x] F4 — `prisma/seed.ts` self-loads env (`process.loadEnvFile()` / `node --env-file=.env`). (B2, exit gate)
- [x] F5 — `weightKg`/`pipConversion` use explicit `@db.Decimal(10,3)?`. (A1)
- [x] F6 — no User rows/credentials seeded in Phase 02 (Phase 03 owns admin seed). (A4)
- [x] F7 — CRUD e2e re-tiered to manual/agent-probe (Playwright not until Phase 05); automatable logic gets Vitest units. (Test Plan, C3, C4)
- [x] cascade — NoAction on all OrderLine/NoteLine relations to avoid SQL Server multi/cyclic cascade rejection. (A3)

### Execute-agent instructions

- E1 (Step A entry): EXTEND `prisma/schema.prisma` — the file currently holds ONLY `HealthCheck`. Never rewrite it; add models below it. Reuse `src/lib/db.ts` singleton; do NOT construct new PrismaClients.
- E2 (A1): Do NOT emit `1KG` or Thai text as enum literals. Use `PackSize { KG_1, HALF_KG, NONE }` and `ProductGroup { GOODS, SEASONING }`; if you prefer, store packSize/group as `String` instead — but never an invalid enum identifier.
- E3 (A1/C3): `printOrder` is `Int?` and NOT `@unique`/`@@unique`. Enforce uniqueness in the zod-backed action over active non-null variants. A DB guarantee, if wanted, is a raw filtered index (`WHERE printOrder IS NOT NULL`), never a Prisma `@unique`.
- E4 (A3): Set `onDelete: NoAction, onUpdate: NoAction` on every OrderLine and NoteLine relation (Sheet/Shop/Variant). If `migrate dev` errors with a cascade-path message, this is the cause.
- E5 (B2): `prisma/seed.ts` FIRST statement loads env (`process.loadEnvFile()` on Node 22+) OR run it as `node --env-file=.env prisma/seed.ts`. Without this, `db.ts` throws `DATABASE_URL is not set`. Upsert off-list rows on `(productName, packSize, labelVariant)`, never on the NULL printOrder.
- E6 (B3): Run the seed TWICE and confirm counts are unchanged — this is the idempotency proof; record both runs' counts in the report.
- E7 (A4/B2): Do NOT seed any `User` row or password in this phase. Phase 03 owns the admin seed.
- E8 (D1): Create the `db/` directory if absent before writing `db/create-orderstock-schema.sql`. The export is offline (no DB connection needed).
- E9 (safety, all steps): Sandbox `orderstock-sql` DB ONLY. Never connect to / mutate a customer or remote DB. Do not stop, restart, or `docker rm` the 9 unrelated containers sharing the Docker VM. Run `docker stats --no-stream` to confirm ≥2 GiB headroom before bringing the sandbox up if it is down. No git commit/push without explicit user instruction.

### Auto-selected decisions (recorded for user override before EXECUTE)

The user was not at the keyboard during PVL; the conservative option was auto-selected for each. Override any before consenting to EXECUTE.

- AS1: Net gate accepted as CONDITIONAL (fixes folded in as plan text + execute-agent instructions; no return to PLAN). Alternative: user may request a plan-supplement cycle instead.
- AS2: Enum strategy = ASCII enum members (F1). Alternative: `String` columns for packSize/group.
- AS3: printOrder uniqueness = app-level only (F2). Alternative: add a raw filtered unique index.
- AS4: CRUD round-trip = manual/agent-probe this phase (F7). Alternative: install a Vitest DB-integration harness now (backlogged as the default deferral).
- AS5: Decimal precision = `@db.Decimal(10,3)` (F5). Alternative: revise once Q22 answered.

### High-risk pack

Required: recommended (schema/data-migration high-risk class). Manual-first per `vc-risk-evidence-pack`. At EXECUTE closeout, record in `.../harness/`:
- `verification.json` — migrate/seed/export/test gate steps + results (happy path + one boundary: second seed run, and an intentional duplicate-printOrder rejection).
- `review-decision.json` — APPROVE/REJECT with rationale after gates green.
Not a blocking hook; if absent at closeout, say so explicitly rather than implying the schema is proven.

### Backlog artifacts to create during durable capture

- `crud-db-integration-harness_NOTE_06-07-26.md` (process/features/order-system/backlog/) — Vitest harness running server actions against the sandbox so the CRUD round-trip graduates from manual to automated before Phase 05.

### Dimension findings

- Infra fit: CONCERN — sandbox up, Prisma/adapter correct, tsx-add (B0) and migrations.seed-add (B1a) correctly planned; seed direct-run env-loading gap fixed (F4). Otherwise ready.
- Test coverage: CONCERN — Vitest real; migrate/export/seed gates realistic; CRUD e2e re-tiered off Playwright (not installed until Phase 05, F7); added printOrder + correction-cascade Vitest units and seed-idempotency re-run.
- Breaking changes: CONCERN — schema is additive (extends HealthCheck); SQL Server pitfalls surfaced and mitigated: one-NULL-per-UNIQUE on nullable printOrder (F2), multi/cyclic cascade paths (NoAction, A3), invalid enum literals `1KG`/Thai (F1), Decimal precision (F5). All proven-at-EXECUTE by the migrate hybrid gate.
- Security surface: CONCERN (accepted) — unguarded CRUD until Phase 03 is an accepted umbrella risk (sandbox-only, no external exposure); no User credentials seeded here (F6); seed data is business master-data, not PII/secrets; vendor SQL export is DDL-only (no credentials). STRIDE otherwise clean.
- Section A (Schema design): CONCERN — enum-identifier + printOrder-unique + cascade fixes applied; highest-risk edit = the FK cascade graph (mitigated by NoAction).
- Section B (Migrations + seed): CONCERN — env self-load + off-list non-null natural key fixes applied; highest-risk edit = idempotent off-list upsert.
- Section C (Master-data CRUD): CONCERN — correction-cascade needs the propagate-then-lock unit; unguarded until Phase 03 (accepted).
- Section D (Vendor SQL export): PASS — offline `migrate diff --script` VERIFIED; only nit = mkdir `db/` (E8).

Totals: 0 FAILs / 7 CONCERNs (all resolved as plan-fixes + execute-agent instructions) / 1 PASS section. → Net Gate CONDITIONAL.

### Open gaps

- Thai collation deferred to Phase 06 (decision 3): known-gap — customer server collation unknown; integer ordering used everywhere in Phase 1. Documented, not blocking.
- Uncertain ~31 master-data name readings: seeded with `needsConfirmation=true`; corrected via CRUD edit → correction-cascade when the user answers. Not blocking.
- CRUD round-trip automated coverage: deferred to the backlog DB-integration harness (before Phase 05).

### What This Coverage Does NOT Prove

- G-migrate (`prisma migrate dev`): proves the schema is valid on the sandbox SQL Server (compat 150); does NOT prove it on the customer's target compat level (140/2017 unconfirmed — program known-gap) nor on a real customer DB.
- G-export (`grep CREATE TABLE`): proves a non-empty T-SQL DDL file is produced offline; does NOT prove the DBA can run it, nor that DB/login creation (Phase 06 hand-authored) is included.
- G-seed (double-run counts): proves idempotency + env-loading + off-list upsert; does NOT prove the seeded Thai names are correct (user confirmation pending) nor real-form fidelity beyond count/order.
- G-printorder / G-cascade (Vitest units): prove the validator and snapshot-lock LOGIC in isolation; do NOT prove the wired server-action UI path or DB-level enforcement.
- G-crud (manual/agent probe): proves a human/agent observed a round-trip; does NOT provide a repeatable automated regression until the backlog DB-integration harness lands.
- G-seedorder (agent-probe): proves ordering judgment against the REF; does NOT assert uncertain-name truth.

### Known gaps on record

- Thai collation → deferred to Phase 06 (decision 3); rationale: customer collation unknown; accepted by session (autonomous PVL, user override available).
- CRUD automated round-trip → backlog `crud-db-integration-harness_NOTE_06-07-26.md`; rationale: Playwright not until Phase 05; manual/agent probe covers this phase.

### Accepted by

Accepted by: session (autonomous, /goal-style PVL; user not at keyboard) — accepted concerns: F1 enum-identifiers, F2 printOrder-app-uniqueness, F3 off-list-natural-key, F4 seed-env-load, F5 decimal-precision, F6 no-seeded-credentials, F7 CRUD-manual-tier. Accepted known-gaps: Thai-collation-deferred-Phase-06, CRUD-automated-round-trip-backlogged. All auto-selections (AS1–AS5) are open for explicit user override before ENTER EXECUTE MODE. EXECUTE remains gated on explicit user consent per the umbrella hard constraint.
