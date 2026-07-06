---
name: plan:phase1-order-system-phase-06-db-settings-delivery
description: "orderstock Phase 1 — Phase 06: runtime connection-string settings page (ADO.NET→adapter, test-connection, singleton swap) + delivery packaging"
date: 06-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: order-system
  phase: phase-06
---

# Phase 06 — DB Settings & Delivery

**Program:** phase1-order-system
**Umbrella plan:** process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-06-db-settings-delivery_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Deliver the runtime DB configuration and the customer handoff package. Build a settings page that accepts the customer's ADO.NET connection string, converts/validates it to a Prisma 7 adapter config (`@prisma/adapter-mssql`), tests the connection (`SELECT 1`), and applies it via module-level singleton swap (`$disconnect()` old client) or app restart — handling named instances, ports, and special-character escaping. Then package delivery: the final vendor T-SQL schema script, a hand-authored DB-creation/login/permission script, and a deployment guide for the customer's Windows environment. This is a HIGH-RISK auth/secrets + delivery surface — STRIDE scan required, and the customer prod-DB safety boundary is retired ONLY at this gate.

---

## Entry Gate

- Phase 02 exit gate passed (schema + vendor SQL export pipeline).
- Phase 05 exit gate passed (app is functionally complete and printable).
- A SECOND disposable sandbox DB is available to prove switching (still NOT the customer's real prod DB unless the user explicitly authorizes the delivery test).

---

## Blast Radius

- `src/app/settings/db/**` — ADMIN-only settings page: connection-string input, test-connection button, save/apply
- `src/lib/connection-string.ts` — ADO.NET → `sql.config` object / JDBC-style string parser (mapping table from db-auth REF §1); brace-escaping; named-instance + port handling
- `src/lib/db.ts` — extend the singleton to support runtime swap (from Phase 01; extend, not rewrite)
- `db/create-orderstock-schema.sql` — final vendor schema script (regenerated from Phase 02 pipeline)
- `db/create-database-and-login.sql` — hand-authored DB + login + permission script (Prisma does NOT generate this)
- `docs/deployment-guide.md` — customer Windows deployment guide

---

## Implementation Checklist

### Step A — Connection-string parser

- [ ] A1. `src/lib/connection-string.ts`: parse ADO.NET keys → adapter config per db-auth REF §1 table (`Server=host,port`→`host:port`; `Server=host\INSTANCE`→instanceName; `Database`→database; `User Id`→user; `Password`→password brace-escaped; `Encrypt`, `TrustServerCertificate`, `Integrated Security`, `Connect Timeout`).
- [ ] A2. Prefer producing an `sql.config` OBJECT (avoids lossy string round-trip); validate required fields.

### Step B — Settings page + apply

- [ ] B1. ADMIN-only `src/app/settings/db` page: input current string (stored in `AppSetting`), test-connection button → construct throwaway `PrismaClient` + `SELECT 1` via `$queryRaw`, report ok/error.
- [ ] B2. Save applies via singleton swap: `$disconnect()` old client, build new `PrismaMssql` adapter client (or trigger documented app restart). Per-request switching is NOT supported and NOT needed (db-auth REF §1).
- [ ] B3. Persist the string securely in `AppSetting`; never log the password; mask in UI.

### Step C — Delivery package

- [ ] C1. Regenerate `db/create-orderstock-schema.sql` via the Phase 02 export pipeline (final schema).
- [ ] C2. Hand-author `db/create-database-and-login.sql`: `CREATE DATABASE`, login/user, `db_owner` or scoped rights, `COMPATIBILITY_LEVEL` matching the confirmed customer version (Prisma's script does NOT do this — db-auth REF §2).
- [ ] C3. Write `docs/deployment-guide.md`: prerequisites, run order (DB+login script first, then schema script), connection-string entry via settings page, Chrome/Edge print guidance (Scale 100%, untick headers/footers), Sarabun bundled, backup guidance.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS PROVISIONAL — RESEARCH must load the test routing chain + discover existing tests before PVL; else `TIER_ASSIGNMENTS_BLOCKED`. STRIDE scan (vc-security) required for the secrets/connection surface.

**Area: connection-string parser (high-risk: secrets/trust boundary)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | ADO.NET → adapter config mapping (host,port; instance; escaping) | Vitest on `connection-string.ts` incl. special-char passwords, named instance | conversion correctness | live connect |
| Fully-automated | Password never appears in logs | Vitest asserts masked output | secret hygiene | runtime |

**Area: runtime DB switch (high-risk: DB config)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Switch sandbox → second sandbox DB via settings page | precondition: two sandbox DBs; enter string, test, apply; confirm app reads second DB | runtime switch works | customer prod |
| Hybrid | Test-connection reports failure on bad string | enter invalid string; expect clear error, no crash | validation robustness | — |
| Agent-probe | Deployment guide is complete + runnable in order | review `docs/deployment-guide.md` vs checklist | delivery readiness | customer env |

High-risk (secrets/DB config): minimum Hybrid — satisfied by switch + failure gates. Known-Gap not permitted for the switch behavior.

---

## Exit Gate

```bash
pnpm test   # Expected: parser + masking unit tests green
# Hybrid: enter a second sandbox DB string in the settings page, test-connect, apply; confirm the app
#   now reads/writes the second DB (switch works)
pnpm tsx scripts/export-schema-sql.ts   # Expected: final vendor schema script regenerated
```

- Switching sandbox → a second DB via the settings page works.
- Delivery package produced: `db/create-orderstock-schema.sql`, `db/create-database-and-login.sql`, `docs/deployment-guide.md`.
- Phase report written.

---

## Blockers That Would Justify BLOCKED Status

- Singleton hot-swap proves unreliable → fall back to documented app-restart flow (db-auth REF §1 says "per app restart is safest") — document, NOT a hard block.
- Customer SQL Server version still unconfirmed → the login/compat script cannot be finalized to the exact target; ship with the assumed level and a clearly-flagged TODO — surface to user.
- Any request to test against the customer's REAL prod DB without explicit user authorization → HARD STOP (safety boundary).

---

## Phase Loop Progress

7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7 + STRIDE scan; validate-contract written per example-validate-output.md
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.**

---

## Touchpoints

- `src/app/settings/db/**`, `src/lib/connection-string.ts`, `src/lib/db.ts`
- `db/create-orderstock-schema.sql`, `db/create-database-and-login.sql`, `docs/deployment-guide.md`

---

## Public Contracts

- Establishes the runtime connection-string contract (customer ADO.NET string accepted at the settings page) — must remain stable post-delivery.
- The two SQL scripts + deployment guide are the delivery contract with the customer's DBA.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| ADO.NET→adapter mapping unit | Fully-Automated | DoD #6 (accept customer string) — proven by: parser unit gate |
| Password masked in logs | Fully-Automated | Secrets safety — proven by: masking unit gate |
| Switch sandbox → second DB via settings | Hybrid | DoD #6 (runtime DB switch) — proven by: switch hybrid gate |
| Deployment package complete | Agent-Probe | DoD #6 (delivery packaging) — proven by: guide agent-probe |

```bash
# Expected: after applying a second sandbox connection string, the app reads the second DB
```

---

## Test Infra Improvement Notes

- Add a second named Docker sandbox DB to the compose/test setup so the runtime-switch hybrid test has a real target. Record the two-DB setup in `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-06-db-settings-delivery_PLAN_06-07-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next step: Spawn vc-research-agent for RESEARCH (Step 1). Secrets/DB-config surface — vc-security STRIDE scan required at PVL. Customer prod DB stays OFF-LIMITS unless the user explicitly authorizes the delivery test.

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
