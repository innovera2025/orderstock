---
name: plan:phase1-order-system-phase-01-foundation
description: "orderstock Phase 1 — Phase 01: Next.js+TS scaffold, Prisma 7 + adapter-mssql, Docker SQL Server sandbox, Sarabun font, Thai layout shell, DB health check"
date: 06-07-26
metadata:
  node_type: memory
  type: phase-plan
  feature: order-system
  phase: phase-01
---

# Phase 01 — Foundation

**Program:** phase1-order-system
**Umbrella plan:** process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md
**Phase status:** 🧪 TESTING (EXECUTE done 06-07-26; EVL done 06-07-26 — vc-tester independently re-ran all 6 validate-contract gates GREEN, zero mismatch vs execute's claims; cross-checks clean. Still NOT ✅ VERIFIED — ONE open item remains: `.env` file creation blocked by the privacy hook awaiting interactive user approval. Promote to VERIFIED once `.env` is created; the two known-gaps (compat-level, customer SQL version) are accepted and do not block.)
**Report destination:** process/features/order-system/active/phase1-order-system_06-07-26/phase-01-foundation_REPORT_06-07-26.md (flat in the program task folder)

---

## Purpose

Establish the buildable, connectable foundation for the whole program: a Next.js (App Router, TypeScript) app wired to SQL Server via the Prisma 7 driver-adapter (`@prisma/adapter-mssql`), a disposable Docker SQL Server 2022 sandbox (linux/amd64, native on the Intel dev host) at the customer's compatibility level, the self-hosted Sarabun (OFL) Thai font, a base Thai layout shell, and a DB health check. This phase proves the hardest architectural risk early (Prisma 7 removed `datasourceUrl`; the adapter pattern must work) so no later phase discovers it broken.

---

## Entry Gate

- Phase 0 complete (umbrella + all phase plans + blast-radius registry created).
- Docker Desktop able to run the linux/amd64 SQL Server image natively (this dev host is an **Intel x86_64 Mac** — Core i5-1038NG7 — so the image runs natively and Rosetta is correctly absent) OR via Rosetta on Apple-Silicon hosts (portability note only).
- Environment verified ready (RESEARCH): Node v22.22.3, pnpm 11.5.0, corepack 0.34.6, Docker 29.5.2 running, port 1433 free, ~330GB disk. No hard blockers.
- User has confirmed the assumed customer SQL Server compatibility level target (140 for 2017 / 150 for 2019) — or default to 150 and flag as an open question.

---

## Blast Radius

- `package.json`, `pnpm-lock.yaml` — pnpm project + pinned deps: `next@16.2.x`, `prisma@7.8.x`, `@prisma/client@7.8.x`, `@prisma/adapter-mssql@7.8.x`, `mssql@^12`, Tailwind (create-next-app default)
- `next.config.ts` — `serverExternalPackages: ['mssql','tedious']` (Turbopack+adapter safety net; extended for Playwright in Phase 05); Turbopack ON
- `tsconfig.json`, `.env`, `.env.example`, `.gitignore`
- `docker-compose.yml` — `mcr.microsoft.com/mssql/server:2022-latest`, platform linux/amd64, explicit `mem_limit` ~2GB, SA password, port 1433
- `prisma/schema.prisma` — `provider = "sqlserver"` datasource + one minimal model (e.g. `HealthCheck` or a placeholder) to prove migration
- `prisma.config.ts` — JDBC-style URL for CLI (migrate/introspect)
- `src/lib/db.ts` — module-level PrismaClient singleton built with `PrismaMssql` adapter
- `src/lib/fonts.ts` — `next/font/local` Sarabun setup; `public/fonts/Sarabun-*.woff2`
- `src/app/layout.tsx`, `src/app/page.tsx` — Thai base shell
- `src/app/api/health/route.ts` — Route Handler returning DB connectivity (`SELECT 1` via `$queryRaw`)
- `vitest.config.ts`, `src/**/*.test.ts` (one smoke test) — Vitest baseline (added at PVL; establishes the fully-automated tier target for later phases)

Shared-file note: `prisma/schema.prisma` and `src/app/layout.tsx` are extended (not rewritten) by later phases — see umbrella Blast Radius + registry.

---

## Implementation Checklist

### Step A — Project scaffold

- [x] A1. `pnpm create next-app` with App Router + TypeScript + `src/` + Tailwind + **Turbopack ON**; pin **next@16.2.x** (INNOVATE confirmed next-auth@5.0.0-beta.31 compatible with Next 16, and Next 16 avoids the later middleware→proxy.ts migration). **PVL note (E1):** create-next-app installs latest by default — after scaffold, explicitly verify/pin `next@16.2.x` in `package.json`; do not accept a silently-newer major.
- [x] A2. Commit baseline `.gitignore` (node_modules, .next, .env, prisma generated client). **PVL note:** `.env` MUST be gitignored (holds the SA password) — verify before any commit.
- [x] A3. Add base Thai `<html lang="th">` layout shell in `src/app/layout.tsx`.

### Step B — Prisma 7 + adapter-mssql wiring

- [x] B1. Add pinned deps: `prisma@7.8.x`, `@prisma/client@7.8.x`, `@prisma/adapter-mssql@7.8.x`, `mssql@^12`. Set `serverExternalPackages: ['mssql','tedious']` in `next.config.ts` (Turbopack+adapter safety net — `pnpm build` doubles as the empirical Turbopack+adapter check).
- [x] B2. Write `prisma/schema.prisma` with `provider = "sqlserver"` and one minimal model to exercise a migration.
- [x] B3. Write `prisma.config.ts` (or env) holding the JDBC-style `sqlserver://` URL for the Prisma CLI. **PVL note (E3):** host MUST be `localhost:1433` (the Docker sandbox) — never a customer/remote host.
- [x] B4. Write `src/lib/db.ts`: module-level singleton `new PrismaClient({ adapter: new PrismaMssql(<sandbox JDBC string or sql.config>) })`. Do NOT create per-request clients. **PVL note (E4):** if the adapter cannot connect after correct config, capture the exact error and fall back to the node-mssql escape hatch (db-auth REF §6) — do NOT silently retry with per-request clients.

### Step C — Docker sandbox SQL Server

- [x] C1. Write `docker-compose.yml` for `mcr.microsoft.com/mssql/server:2022-latest`, `platform: linux/amd64`, `ACCEPT_EULA=Y`, strong `MSSQL_SA_PASSWORD`, port 1433, and an explicit `mem_limit: 2g`. **PVL-corrected VM state (verified 06-07-26):** the shared Docker VM is 7.75 GiB and currently runs **9** unrelated containers (quotation-system-app/api/postgres, krs-pos-db, wat-smoke-web/api/db/redis, claw-empire) — NOT the 4 previously documented — but total live usage is only ~773 MiB, leaving ~7 GiB free, so the 2 GB SQL Server fits comfortably. Do NOT stop/restart any of the 9 unrelated containers.
- [x] C2. **PVL precheck (E2):** run `docker stats --no-stream` to confirm ≥2 GB headroom, then bring up the container. Check `docker logs` — SQL Server exits silently under memory pressure or on a weak SA password. Create the `orderstock` sandbox DB; `ALTER DATABASE orderstock SET COMPATIBILITY_LEVEL = 150` (or the confirmed customer target 140/150 — see open question E7).
- [x] C3. Run `prisma migrate dev` against the sandbox to create the minimal model.

### Step D — Font + health check

- [x] D1. Bundle Sarabun woff2 files under `public/fonts/`; wire `next/font/local` in `src/lib/fonts.ts`; apply in layout with fallback `Sarabun, 'TH Sarabun New', sans-serif`. **PVL note (E5):** obtain Sarabun OFL 1.1 woff2 from the official OFL release (Google Fonts download / the Cadson Demak OFL source) at build time — bundle self-hosted; NEVER depend on the Google CDN or a customer-PC-installed font at runtime.
- [x] D2. Write `src/app/api/health/route.ts` returning `{ ok: true }` when `SELECT 1` via `$queryRaw` succeeds, `{ ok: false, error }` (500) otherwise. **PVL note (E6):** the error path must return a sanitized message — never echo the raw connection string, SA password, or full stack to the client.
- [x] D3. Add a minimal home page showing app title in Thai + DB status indicator that calls `/api/health`.
- [x] D4. **(added at PVL)** Establish the Vitest baseline so later phases inherit a green fully-automated tier: `pnpm add -D vitest`, add a `"test": "vitest run"` script to `package.json`, add `vitest.config.ts`, and write ONE trivial passing smoke test (e.g. `src/lib/__tests__/smoke.test.ts` asserting a pure helper or `1+1===2`). Record the chosen runner in `process/context/tests/all-tests.md` during UPDATE-PROCESS.

---

## Decisions (from INNOVATE — verdict GO, 5-persona predict passed)

| Decision | Chosen |
|---|---|
| Next.js pin | **16.2.x** — next-auth 5.0.0-beta.31 confirmed compatible; avoids the later middleware→proxy.ts migration |
| SQL image | **mcr.microsoft.com/mssql/server:2022-latest**, keep `platform: linux/amd64` (portability), explicit `mem_limit` ~2GB, COMPATIBILITY_LEVEL 140/150 pending customer confirmation |
| CSS | **Tailwind** (create-next-app default); Phase 05 print CSS stays separate plain CSS (orthogonal) |
| Scaffold | pnpm + `src/` + App Router + TypeScript + **Turbopack ON**; `serverExternalPackages: ['mssql','tedious']` in `next.config.ts` as safety net; `pnpm build` exit gate doubles as the empirical Turbopack+adapter check |
| Version pins | `next@16.2.x`, `prisma@7.8.x`, `@prisma/client@7.8.x`, `@prisma/adapter-mssql@7.8.x`, `mssql@^12`; `next-auth@5.0.0-beta.31` (lands in Phase 03) |

**Downstream ripple recorded:** Next 16 renames `middleware.ts` → `proxy.ts`; db-auth REF §5 still says "middleware". Noted in the umbrella open-questions/risks and the blast-radius registry so Phase 03 RESEARCH picks it up.

---

## Inner Loop Refresh Note

- **Date:** 06-07-26 — inner-loop plan refresh (step 3 PLAN-SUPPLEMENT) after RESEARCH (DONE_WITH_CONCERNS) + INNOVATE (GO).
- **Sections changed:** Purpose (Rosetta wording neutralized), Entry Gate (platform-conditional; Rosetta-install step removed; env matrix added), Blast Radius (version pins, Tailwind, serverExternalPackages, mem_limit), Implementation Checklist A1/B1/C1/C2 (Next 16.2.x, Turbopack, serverExternalPackages, mem_limit, docker-logs check), Blockers (Rosetta-AVX marked inapplicable-on-Intel; shared-VM RAM blocker added), Phase Loop Progress (steps 1–3 ticked), Phase status (→ TESTING), Resume handoff (next = PVL), NEW Decisions section.
- **Key findings folded in:** (1) host is Intel x86_64 (no Rosetta needed); (2) env matrix ready, no hard blockers; (3) shared Docker VM RAM pressure → explicit `mem_limit`; (4) INNOVATE decisions (Next 16.2.x, 2022 image + mem_limit, Tailwind, Turbopack + serverExternalPackages, exact pins).
- **Validate-contract left untouched** (placeholder) — PVL writes it next.
- **Cross-phase ripple:** Next 16 middleware→proxy.ts note propagated to umbrella + registry (Phase 03).

### PVL amendments (06-07-26 — inner-PVL, applied at V6)

- **Blast Radius:** added `vitest.config.ts` + one smoke test (Vitest baseline).
- **Checklist:** added D4 (Vitest baseline); annotated A1 (pin verification), A2 (.env gitignore), B3 (sandbox-only host), B4 (adapter escape hatch), C1 (corrected VM inventory: 9 containers, ~7 GiB free), C2 (docker stats precheck), D1 (Sarabun OFL sourcing), D2 (health-route error sanitization).
- **Verified facts:** Docker 29.5.2 running; VM 7.75 GiB with 9 containers using ~773 MiB (~7 GiB free — 2 GB SQL Server fits); port 1433 free; Node 22.22.3; pnpm 11.5.0.

---

## Test Plan (TDD-first — tier assignments)

TIER ASSIGNMENTS FINALIZED AT PVL — the `process/context/tests/all-tests.md` routing chain was loaded; it confirms **no test runner exists yet (greenfield)** and Vitest is the planned unit/integration runner. Phase 01 establishes the Vitest baseline (D4). No `TIER_ASSIGNMENTS_BLOCKED`.

**Area: build + typecheck (root config)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Fully-automated | App builds and typechecks | `pnpm build` exits 0 | scaffold compiles; Turbopack+adapter safe | runtime DB connectivity |
| Fully-automated | Lint clean | `pnpm lint` exits 0 | style baseline | behavior |
| Fully-automated | Vitest baseline green | `pnpm test` exits 0 | test runner wired; later phases inherit green tier | any real logic (smoke only) |

**Area: Prisma adapter + sandbox DB (high-risk: schema/DB)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Hybrid | Health route returns ok against sandbox | precondition: Docker sandbox up + migrated; `curl localhost:3000/api/health` → `{ok:true}` | Prisma 7 adapter connects to SQL Server | customer prod DB behavior |
| Hybrid | `migrate dev` applies minimal model | precondition: sandbox up; `pnpm prisma migrate dev` exits 0 | migration pipeline works | full schema |

**Area: Thai font render (agent-probe)**

| Tier | Scenario | Command / Steps | Proves | Does NOT prove |
|---|---|---|---|---|
| Agent-probe | Home page renders Thai title in Sarabun | open `/`, visually confirm Sarabun glyphs + tone marks | font bundling works | print fidelity |

High-risk class (schema/DB): minimum tier Hybrid — satisfied by the health-route + migrate gates above.

---

## Exit Gate

```bash
pnpm build               # Expected: exit 0
pnpm lint                # Expected: exit 0
pnpm test                # Expected: exit 0 (Vitest smoke)
pnpm prisma migrate dev  # Expected: minimal model applied to sandbox
curl -s localhost:3000/api/health  # Expected: {"ok":true}
```

- All checklist items checked.
- App boots (`pnpm dev`), connects to the Docker sandbox DB, health endpoint returns `{ok:true}`.
- Sarabun renders Thai text with correct tone-mark stacking.
- Phase report written to the report destination above.

---

## Blockers That Would Justify BLOCKED Status

- Docker sandbox will not start and no config fix works → BLOCKED with the exact `docker logs` evidence. (Note: the Rosetta-AVX crash class from db-auth REF §4 is **inapplicable on this Intel host** — image runs native x86_64; keep as an Apple-Silicon-only portability note.)
- **Container exits silently under memory pressure** — the shared Docker VM (7.75 GiB) runs **9** unrelated containers (verified 06-07-26: quotation-system-app/api/postgres, krs-pos-db, wat-smoke-web/api/db/redis, claw-empire) using only ~773 MiB, so ~7 GiB is free and 2 GB fits. Always check `docker logs`; set `mem_limit: 2g`. Only BLOCKED if the VM genuinely cannot spare ~2GB.
- `@prisma/adapter-mssql` cannot connect after correct config → BLOCKED (this is the core architectural risk; document the failure and the node-mssql escape-hatch fallback from db-auth REF §6).
- Confirmed customer SQL Server version is 2016 (below Prisma's 2017 floor) → surface to user; not a phase-01 blocker but a program risk.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 1. RESEARCH — research-agent: DONE_WITH_CONCERNS — Intel host, env matrix ready, shared-VM RAM risk (findings encoded below)
- [x] 2. INNOVATE — innovate-agent: DONE — verdict GO, 5-persona predict passed; Decision Summary written (see Decisions section)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated; Inner Loop Refresh Note written
- [x] 4. PVL — vc-validate-agent: full V1-V7 done; validate-contract written (Net Gate CONDITIONAL) per example-validate-output.md
- [x] 5. EXECUTE — all 14 checklist items done; all 6 validate-contract gates run GREEN (build/lint/test/migrate/health/font-probe) via inline env. ONE open item: `.env` creation blocked by the privacy hook (needs interactive user approval); contents fully specified in the phase report. Deviations documented in the report (font wiring via explicit @font-face+unicode-range instead of next/font/local; eslint ignores scoped to app source; pnpm allowBuilds).
- [x] 6. EVL — vc-tester independent re-run: ALL 6 gates PASS (build/lint/test/migrate/health/font) with zero mismatch vs execute's claims; cross-checks clean (9 containers untouched, mem_limit=2GiB applied, .env absent, .gitignore covers .env*+node_modules, git status shows only expected app files); regression checkpoint skipped (first phase). EVL HANDOFF SUMMARY written; verification.json updated with evlReRun block. NOT promoted to VERIFIED — `.env` open item remains (privacy-hook, awaits user approval).
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract written (CONDITIONAL).** EXECUTE is gated on explicit user consent (umbrella hard-stop: "Every phase EXECUTE requires explicit user consent unless a standing /goal grants it").

---

## Touchpoints

- `package.json`, `next.config.ts`, `tsconfig.json`, `.env`, `docker-compose.yml`, `vitest.config.ts`
- `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/db.ts`, `src/lib/fonts.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/health/route.ts`, `public/fonts/**`, `src/**/*.test.ts`

---

## Public Contracts

- Establishes the PrismaClient singleton contract (`src/lib/db.ts`) that all later phases import.
- Establishes `/api/health` as the DB-status contract reused by Phase 06 settings validation.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm build` exit 0 | Fully-Automated | DoD #1 (app boots) — proven by: build gate |
| `pnpm lint` exit 0 | Fully-Automated | style baseline — proven by: lint gate |
| `pnpm test` exit 0 | Fully-Automated | test-runner baseline — proven by: Vitest smoke |
| `/api/health` → `{ok:true}` on sandbox | Hybrid | DoD #1 (connects to sandbox DB) — proven by: health-route hybrid gate |
| `prisma migrate dev` applies model | Hybrid | Foundation for DoD #2 (migration pipeline) — proven by: migrate gate |
| Thai title renders in Sarabun | Agent-Probe | Thai-UI constraint — proven by: font agent-probe |

```bash
curl -s localhost:3000/api/health   # Expected: {"ok":true}
```

---

## Test Infra Improvement Notes

- No test runner exists yet (greenfield). Phase 01 establishes the Vitest baseline (D4: `pnpm test` script + one smoke test) so later phases have a fully-automated tier target. Record the chosen runner in `process/context/tests/all-tests.md` during UPDATE-PROCESS.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/order-system/active/phase1-order-system_06-07-26/phase-01-foundation_PLAN_06-07-26.md`
- Last completed step: 4. PVL (validate-contract written — Net Gate CONDITIONAL)
- Validate-contract status: WRITTEN (CONDITIONAL). NEXT STEP is EXECUTE (Step 5) — gated on explicit user consent (ENTER EXECUTE MODE). Sandbox DB only — never touch customer prod.
- Next step: On user consent, spawn vc-execute-agent (opus) for Phase 01, following the validate-contract's Execute-agent instructions E1–E7.

---

## Plan Metadata

**Date**: 06-07-26
**Complexity**: COMPLEX (one phase of the phase1-order-system program)
**Status**: 🧪 TESTING (PVL done; EXECUTE pending user consent)

## Overview

This is a phase plan within the phase1-order-system phase program. Full program context, scope tiers, and the Program Goal Charter live in the umbrella plan (`phase1-order-system-umbrella_PLAN_06-07-26.md`). Program context router: `process/context/all-context.md`. Test routing: `process/context/tests/all-tests.md`. This plan runs the 7-step inner loop `R → I → P → PVL → E → EVL → UP` and does not proceed to EXECUTE until its Validate Contract is written (it now is).

## Phase Completion Rules

This phase is ✅ VERIFIED only when its Exit Gate passes with recorded evidence AND regression checks against overlapping previously-verified surfaces pass AND the validate-contract gates are recorded. Code-only completion is 🔨 CODE DONE, never VERIFIED. Status is not promoted to VERIFIED without user-confirmed / confirmed working evidence.

## Acceptance Criteria

The Exit Gate section above is the acceptance criteria for this phase; each criterion is proven by the mapped gate in the Verification Evidence table. Next Step: this plan has completed VALIDATE (PVL); EXECUTE begins only after explicit user consent (ENTER EXECUTE MODE).

## Execute Anchor Notes

- Primary execute anchor: this phase plan file.
- Supporting phase files: the umbrella plan and the immediately-prior phase's report (read the prior phase report at RESEARCH).

## Validate Contract

Status: CONDITIONAL
Date: 06-07-26
date: 2026-07-06
generated-by: inner-pvl: phase-01

Parallel strategy: sequential
Rationale: 4/7 signals present (S2 schema/DB, S4 phase-program, S6 high-risk schema+container, S7 5+ files) → nominal HIGH, but Phase 01 is a single-context greenfield scaffold whose steps are strictly dependency-ordered (scaffold → Prisma wiring → Docker sandbox → font/health/tests). Parallelism adds no benefit and would risk file collisions on a fresh tree. EXECUTE recommendation: **Sequential** — one vc-execute-agent (opus), steps A→B→C→D in order. (The PVL validation fan-out itself ran as an in-session inline synthesis over 4 Layer-1 dimensions + 4 Layer-2 section probes — read-only, single small plan, no cross-agent talk — rather than spawning 8 subagents for a 13-file scaffold. This was auto-selected; see Accepted by.)

Test gates (C3 5-column table — ADDITIVE; legacy line form retained below):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| build | App builds + typechecks (Turbopack+adapter safe) | Fully-Automated | `pnpm build` exits 0 | A — proven once scaffolded |
| lint | Lint clean | Fully-Automated | `pnpm lint` exits 0 | A |
| test-baseline | Vitest runner wired, smoke green | Fully-Automated | `pnpm test` exits 0 | B — gate added by this plan (D4) |
| health | Health route returns `{ok:true}` against sandbox | Hybrid | precondition: Docker sandbox up+migrated; `curl -s localhost:3000/api/health` → `{"ok":true}` | A |
| migrate | `migrate dev` applies minimal model to sandbox | Hybrid | precondition: sandbox up; `pnpm prisma migrate dev` exits 0 | A |
| font-render | Home page renders Thai title in Sarabun with correct tone-mark stacking | Agent-Probe | open `/`, visually confirm Sarabun glyphs + tone marks; record judgment | A |
| compat-level | Sandbox DB compatibility level matches confirmed customer target | Known-Gap | — (default 150; customer target 140/150 unconfirmed) | D — carried as open question; default 150, flag in phase report |

gap-resolution legend: A — proven now · B — gate added by this plan · C — deferred to named later phase · D — backlog/named residual (keep-active; continue)

C-4 reconciliation: the `strategy:` column carries only the 3 proving strategies (Fully-Automated / Hybrid / Agent-Probe). Known-Gap is a named residual row (gap-resolution D), never a strategy that proves a behavior.

Failing stubs (Fully-Automated rows only — TDD red-first for EXECUTE; NOT written to disk during PVL):

- build gate — command gate, no unit stub (asserted by `pnpm build` exit 0).
- lint gate — command gate, no unit stub (asserted by `pnpm lint` exit 0).
- test-baseline:
```
test("should run the Vitest baseline smoke green", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: Vitest baseline green (pnpm test exits 0)")
})
```

Legacy line form (retained so existing validate-contract consumers still parse):
- build + typecheck: Fully-automated: `pnpm build` exits 0
- lint: Fully-automated: `pnpm lint` exits 0
- vitest baseline: Fully-automated: `pnpm test` exits 0
- health route: Hybrid: `curl -s localhost:3000/api/health` → `{"ok":true}` — precondition: Docker sandbox up + migrated
- migrate: Hybrid: `pnpm prisma migrate dev` exits 0 — precondition: sandbox up
- Thai font render: Agent-probe: open `/`, confirm Sarabun glyphs + tone marks
- compat level: Known-gap: default 150; customer target (140/150) unconfirmed — flag to user

Dimension findings:
- Infra fit: CONCERN — Docker 29.5.2 running, port 1433 free (verified). The plan documented "4 unrelated containers"; reality is **9** (verified 06-07-26) on the 7.75 GiB VM, but live usage is only ~773 MiB (~7 GiB free) so the 2 GB SQL Server fits. Container inventory corrected in C1/Blockers; `docker stats` precheck + `docker logs` check + `mem_limit: 2g` required (E2).
- Test coverage: CONCERN — greenfield, no runner; the "establish Vitest" intent was a note, not a checklist item → promoted to D4 (applied). build/lint/health/migrate gates are realistic; Vitest baseline gives later phases a green fully-automated target.
- Breaking changes: PASS — greenfield, no downstream consumers to break; establishes `db.ts` singleton + `/api/health` contracts (additive, consumed by later phases).
- Security surface: CONCERN — SA password lives in `.env` (must be gitignored, A2); health-route error path must be sanitized — never echo the connection string, SA password, or full stack (E6); sandbox-only host enforced (E3). No auth/PII in Phase 01 (auth is Phase 03). STRIDE otherwise clean for a sandbox scaffold.
- Section A — Project scaffold: PASS — no collision (fresh tree); pin `next@16.2.x` explicitly after create-next-app (E1).
- Section B — Prisma 7 + adapter-mssql: PASS — the core architectural risk; db-auth REF confirms the PrismaMssql driver-adapter pattern (VERIFIED CONFIRMED); module-level singleton correct; node-mssql escape hatch documented (E4).
- Section C — Docker sandbox: CONCERN — memory precheck required (E2) + compat-level open question (E7); highest-risk edit = container silent-exit, mitigated by `mem_limit: 2g` + `docker logs`.
- Section D — Font + health + tests: CONCERN — Sarabun OFL woff2 sourcing was unspecified → added to D1 (E5); health-route error sanitization (E6); Vitest baseline (D4).

Plan updates applied (at V6):
- [x] Added D4 (Vitest baseline: `pnpm add -D vitest`, `pnpm test` script, `vitest.config.ts`, one smoke test) + Exit Gate `pnpm test` line + Verification Evidence row + Blast Radius/Touchpoints entries.
- [x] Corrected the shared-VM container inventory in C1 and Blockers (4 → 9 containers, with verified ~7 GiB free).
- [x] Added Sarabun OFL sourcing detail to D1.
- [x] Annotated A1/A2/B3/B4/C2/D2 with the PVL execute-agent instructions inline.

Execute-agent instructions:
- E1 (Step A entry): after `pnpm create next-app`, verify/pin `next@16.2.x` in `package.json`; do not accept a silently-newer major.
- E2 (Step C, before `docker compose up`): run `docker stats --no-stream` to confirm ≥2 GB headroom; after `up`, run `docker logs` — SQL Server exits silently on a weak SA password or under memory pressure. NEVER stop/restart any of the 9 unrelated containers.
- E3 (Step B): SANDBOX DB ONLY — `prisma.config.ts` and `src/lib/db.ts` must point at `localhost:1433`; never a customer/remote host. HARD STOP if any customer/remote DB is targeted.
- E4 (Step B): if `@prisma/adapter-mssql` fails to connect after correct config, capture the exact error and fall back to the node-mssql escape hatch (db-auth REF §6) — do NOT silently retry with per-request clients.
- E5 (Step D): download Sarabun OFL 1.1 woff2 from the official OFL release; bundle self-hosted under `public/fonts/`; never depend on the Google CDN or a customer-installed font.
- E6 (Step D): the `/api/health` error path must return a sanitized message — never echo the raw connection string, SA password, or full stack to the client.
- E7 (Step C): set `COMPATIBILITY_LEVEL 150` by default; if the customer later confirms 140, re-run and note it. Flag the open question in the phase report.

High-risk pack (vc-risk-evidence-pack):
Required: LIGHT (schema/DB + container/runtime classes are present, BUT this is a greenfield sandbox scaffold — no customer data, no auth, no destructive op on a real DB). Execute-agent must record in the phase report (or `{slug}_{date}/harness/verification.json`): the Exit Gate command outputs (build/lint/test/migrate/health), a one-line risk-gate note "sandbox-only; no customer DB touched", and the `docker logs` clean confirmation. Full 5-artifact adversarial pack is NOT required for Phase 01 (deferred to Phase 03 auth + Phase 06 delivery, which touch real trust boundaries).

Open gaps:
- compat-level: known-gap: customer SQL Server compatibility level (140 vs 150) unconfirmed — default 150, flag to user; not a phase-01 blocker. Carried in umbrella open-questions (db-auth REF Open Questions).
- customer-sql-version: known-gap: exact customer SQL Server version/edition unconfirmed; 2016 would be below Prisma's 2017 floor — program-level risk, carried in umbrella Global Constraints. Not a phase-01 blocker.

What this coverage does NOT prove:
- `pnpm build` / `pnpm lint` / `pnpm test`: prove the scaffold compiles, lints, and the runner is wired — NOT runtime DB connectivity, NOT real business logic (smoke test only).
- health + migrate (Hybrid): prove the Prisma 7 adapter connects to and migrates the **Docker sandbox** SQL Server 2022 — NOT the customer's production DB, NOT any SQL Server 2016/2017/2019 target, NOT the full program schema.
- font-render (Agent-Probe): proves Sarabun glyph + tone-mark rendering on screen — NOT A4 print fidelity (that is Phase 05).
- No coverage proves the runtime connection-string switch (Phase 06) or auth gating (Phase 03) — out of Phase 01 scope.

Backlog artifacts to create during durable capture: none new — the two open gaps are already tracked in the umbrella (db-auth REF Open Questions + Global Constraints); do not duplicate.

Known gaps on record:
- compat-level (default 150; customer confirmation pending) — accepted as a documented open question; not a phase-01 blocker.
- customer SQL Server version (2016 floor risk) — accepted as a program-level risk carried in the umbrella.

Gate: CONDITIONAL (0 FAILs; concerns resolved: 4 plan fixes applied, 7 execute-agent instructions recorded, 2 known-gaps accepted). Proceed to EXECUTE on explicit user consent.

Accepted by: session (autonomous, inner-PVL /goal boundary — user absent per PVL task brief). Accepted concerns by name: infra-fit/container-inventory (corrected + precheck E2), test-coverage/vitest-baseline (D4 applied), security/health-error-sanitization (E6), security/secret-hygiene (.env gitignore A2), section-C/memory-precheck (E2), section-C/compat-level (known-gap E7), section-D/font-sourcing (E5 + D1). AUTO-SELECTED: Menu Option A (Accept + apply fixes) and the inline single-agent fan-out strategy — the user may override before ENTER EXECUTE MODE (e.g. request a full 8-subagent fan-out, or convert any known-gap to a blocker).

EVL evidence requirements (Step 6 — vc-tester must capture):
- `pnpm build` exit 0 (captured output)
- `pnpm lint` exit 0 (captured output)
- `pnpm test` exit 0 (captured output — Vitest smoke)
- `pnpm prisma migrate dev` — minimal model applied to sandbox (captured output)
- `curl -s localhost:3000/api/health` → `{"ok":true}` (captured)
- `docker logs <container>` clean, no silent exit (captured)
- Sarabun Thai render agent-probe judgment recorded (screenshot or written description of glyph + tone-mark correctness)

Autonomous goal block: NOT written to this phase plan (BRANCH B). The umbrella `phase1-order-system-umbrella_PLAN_06-07-26.md` `## Stable Program Goal` governs autonomous execution for the whole program. Reference for latest state: `process/features/order-system/active/phase1-order-system_06-07-26/phase1-order-system-umbrella_PLAN_06-07-26.md`.
