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
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-02-schema-master-data_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Design and migrate the full Phase-1 database schema and build master-data management. Model the domain the canonical form implies: shops, products with package-size/flavor variants carrying a fixed print-column order and a product group (สินค้า / เครื่องปรุง), order sheets, order lines, users, and app settings. Provide shops/products CRUD pages, a seed script derived from the canonical form data (with uncertain names flagged pending user confirmation), and the vendor SQL-script export pipeline.

---

## Entry Gate

- Phase 01 exit gate passed (app boots, connects to sandbox, health green).
- User has confirmed (or explicitly deferred) the ~30 uncertain master-data name readings from `form-canonical_REF_06-07-26.md` §4 (shops) and §3/§5 (product variants). Uncertain names are seeded with a `needsConfirmation` flag if not yet confirmed.
- Date-handling decision confirmed: store CE, display Buddhist Era (see umbrella + all-context gotchas).

---

## Blast Radius

- `prisma/schema.prisma` — full models: `Shop`, `Product`, `ProductVariant` (printOrder, packSize, group, label), `OrderSheet`, `OrderLine`, `NoteLine` (off-list remark + qty), `User`, `AppSetting`
- `prisma/migrations/**` — generated migrations
- `prisma/seed.ts` — seed shops + 20 product-variants in fixed print order + off-list note products, uncertain names flagged
- `scripts/export-schema-sql.ts` — wraps `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
- `src/app/shops/**` — list/create/edit/delete shops
- `src/app/products/**` — list/create/edit products + variants (packSize, group, printOrder)
- `src/lib/product-order.ts` — canonical print-column order constant (20 variants, C3–C22)

---

## Implementation Checklist

### Step A — Schema design

- [ ] A1. Model `Product` (name, group enum สินค้า/เครื่องปรุง) + `ProductVariant` (product FK, packSize e.g. `1KG`/`HALF_KG`/`NONE`, labelVariant e.g. หมู/ไก่/น้ำเงิน, printOrder int, weightKg decimal nullable, pipConversion decimal nullable) — capture the 20 print columns as variants in fixed order.
- [ ] A2. Model `Shop` (name, needsConfirmation bool, active bool, rosterOrder int).
- [ ] A3. Model `OrderSheet` (date CE, location/สถานที่) + `OrderLine` (sheet FK, shop FK nullable for row-20 orphan, variant FK, qty int) + `NoteLine` (sheet FK, shop FK nullable, text, qty nullable).
- [ ] A4. Model `User` (username unique, passwordHash, role enum ADMIN/STAFF) — created here so the export script is complete; auth logic lands in Phase 03.
- [ ] A5. Model `AppSetting` (key unique, value) for the runtime connection string + misc settings.
- [ ] A6. Respect SQL Server 2017+ constraints from db-auth REF §3: one NULL per UNIQUE; NoAction on self/cyclic cascade; no native Json (use NVarChar(Max) if ever needed — Phase 1 does not).

### Step B — Migrations + seed

- [ ] B1. `prisma migrate dev` to apply the full schema to the sandbox.
- [ ] B2. Write `prisma/seed.ts`: 20 product-variants in the exact print order from `product-order.ts` (form-canonical REF §3); off-list note products (ดีขาว 1กก/½กก, ลานนิ่ม(ใส), พริกแดง, รอง 5กก. etc. per REF §7/§10); shops from REF §4 with `needsConfirmation=true` on the uncertain readings.
- [ ] B2-note. Uncertain names must be visibly flagged, NOT silently seeded as fact.
- [ ] B3. Run seed; verify counts (20 variants, ~29 shop slots).

### Step C — Master-data CRUD

- [ ] C1. Shops pages: list, create, edit, soft-delete (Thai UI).
- [ ] C2. Products pages: list, create/edit product + its variants (packSize, group, printOrder, weightKg, pipConversion).
- [ ] C3. Validate printOrder uniqueness within the active variant set.

### Step D — Vendor SQL export

- [ ] D1. `scripts/export-schema-sql.ts` runs `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` → `db/create-orderstock-schema.sql` (offline, no DB needed).
- [ ] D2. Confirm the output is valid T-SQL DDL reviewable in SSMS; note it does NOT create the DB or logins (Phase 06 hand-authors those).

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`.

**Area: schema + migrations (high-risk: schema/migration)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Full schema migrates to sandbox | precondition: sandbox up; `pnpm prisma migrate dev` exits 0 | schema valid on SQL Server | prod DB |
| Fully-automated | Vendor SQL script generates | `pnpm tsx scripts/export-schema-sql.ts` → non-empty T-SQL file, `CREATE TABLE` present | offline export works | DBA-run correctness |

**Area: master-data CRUD (high-risk: public data write)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Create→edit→delete a shop e2e | precondition: sandbox up; Playwright/manual flow | CRUD round-trips to DB | print layout |
| Fully-automated | printOrder uniqueness enforced | Vitest unit on validator | ordering integrity | UI |
| Agent-probe | Seeded variants match print order | inspect list vs form-canonical REF §3 | seed correctness | — |

High-risk (schema/migration): minimum Hybrid — satisfied by migrate + CRUD gates.

---

## Exit Gate

```bash
pnpm prisma migrate dev            # Expected: full schema applied
pnpm tsx scripts/export-schema-sql.ts && grep -c "CREATE TABLE" db/create-orderstock-schema.sql  # Expected: >0
# Manual/Playwright: create + edit + delete a shop and a product-variant on the sandbox
```

- Shops/products CRUD works e2e on the sandbox.
- `migrate diff --script` produces a valid T-SQL file.
- Seed loads canonical form data with uncertain names flagged.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- User has not confirmed uncertain master-data names AND is unavailable → seed with `needsConfirmation=true` and continue (NOT a hard block); document in report.
- SQL Server rejects a schema construct (cyclic cascade) → adjust to NoAction per REF §3; only BLOCKED if unresolvable.
- Phase 01 foundation not actually green → dependency BLOCKED.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per example-validate-output.md
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.**

---

## Touchpoints

- `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`
- `scripts/export-schema-sql.ts`, `db/create-orderstock-schema.sql`
- `src/app/shops/**`, `src/app/products/**`, `src/lib/product-order.ts`

---

## Public Contracts

- Defines the `ProductVariant.printOrder` contract (20 columns, C3–C22) consumed by Phases 04 and 05.
- Defines the vendor T-SQL script contract reproduced/hand-augmented in Phase 06.
- Extends `prisma/schema.prisma` from Phase 01 (extend, do not rewrite).

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Full schema migrates to sandbox | Hybrid | DoD #2 (schema on SQL Server) — proven by: migrate hybrid gate |
| Vendor T-SQL script generated | Fully-Automated | DoD #2 (vendor script export) — proven by: export-sql gate |
| Shop CRUD round-trips | Hybrid | DoD #2 (master data mgmt) — proven by: CRUD hybrid gate |
| Seeded variants match print order | Agent-Probe | DoD #4/#5 (print-order fidelity) — proven by: seed agent-probe |

```bash
pnpm tsx scripts/export-schema-sql.ts && grep -c "CREATE TABLE" db/create-orderstock-schema.sql  # Expected: >0
```

---

## Test Infra Improvement Notes

- Add a reusable sandbox-DB fixture/reset helper so hybrid CRUD tests run from a known state. Record the command in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-02-schema-master-data_PLAN_06-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). Confirm uncertain names with user first. Sandbox DB only.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: ⏳ PLANNED

## Overview

This is a phase plan within the phase1-order-system phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`phase1-order-system-umbrella_PLAN_06-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written.

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan enters the RIPER-5 VALIDATE (PVL) step before EXECUTE (ENTER EXECUTE MODE only after the contract is written).

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
