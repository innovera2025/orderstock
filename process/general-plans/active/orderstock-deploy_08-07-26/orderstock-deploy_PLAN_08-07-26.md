---
name: plan:orderstock-deploy
description: Production deployment kit for orderstock — basePath /orderstock subpath, external SQL Server db_TCL, caddy-gen routing, Docker prod build + deploy guide
date: 08-07-26
feature: none
phase: "SIMPLE"
---

# orderstock — Production Deployment Kit (subpath `/orderstock`, external `db_TCL`, caddy-gen)

**Date**: 08-07-26
**Status**: Active — VALIDATED (CONDITIONAL, 0 FAILs) — execute-ready
**Complexity**: SIMPLE (single deployment effort; HIGH-RISK auth surface → validate-ready)
**Context:** read `process/context/all-context.md` (router) → then `process/context/auth/all-auth.md`,
`process/context/database/all-database.md`, and `process/context/tests/all-tests.md` before EXECUTE.

TL;DR: Package orderstock for production behind `app.krs.co.th/orderstock` using an env-conditional
Next.js `basePath`, an `output: "standalone"` multi-stage Docker image, a caddy-gen-labelled prod
compose file (no host-port publish, writable `.env` bind-mount), external SQL Server `db_TCL`, and a
new Linux/Docker/caddy-gen deploy guide. HIGH-RISK: touches the NextAuth v5 auth surface. Every
basePath edit is copied verbatim from the VIABLE feasibility verdict and made env-conditional so the
existing 88 unit + 25 e2e gates stay byte-unaffected when `NEXT_PUBLIC_BASE_PATH` is unset.

---

## Overview

orderstock currently runs only against the local Docker sandbox with no basePath and no production
packaging. The customer will host it at the **subpath** `app.krs.co.th/orderstock` (host port 3000 is
already taken by `qtso-app`), routed by an existing **caddy-gen** reverse proxy via container labels
(no host-port publish), pointed at a **customer-managed external SQL Server** whose database is named
**`db_TCL`**. This plan produces the deployment kit: verified basePath code edits, a production
Dockerfile, a production compose file, an updated `.env.example` prod block, updated DB bootstrap
scripts (renamed to `db_TCL`), and a new Docker/caddy-gen deployment guide. It does not change any
application behavior, schema, or the order/print/totals logic.

### Source of truth for basePath edits

`process/general-plans/active/orderstock-deploy_08-07-26/deploy-basepath_FEASIBILITY_08-07-26.md`
(verdict: **VIABLE**). The exact 4-file working diff and the 2 empirically-found bugs are encoded
verbatim below. Where this plan and the original task brief disagree, the verdict wins:

- **Task brief said `src/auth.config.ts` is "likely UNCHANGED — confirm from verdict."** The verdict
  (bug #3, verdict lines 92-95) proves `authConfig.pages.signIn` **MUST** become the basePath-prefixed
  value or an unauthenticated deep-route hit redirects to a 404. Therefore `src/auth.config.ts` **IS**
  in the MODIFY blast radius (env-conditional). The verdict's "do NOT add `authConfig.basePath`" rule
  still holds — only `pages.signIn` changes.

## Goal

- Ship a reproducible production deployment kit that serves orderstock correctly at
  `https://app.krs.co.th/orderstock` behind caddy-gen, against external SQL Server `db_TCL`.
- Preserve full auth correctness under basePath (login, root-path gate, ADMIN role gate, logout,
  auth-API reachability, basePath-prefixed redirects) exactly as proven by the feasibility probe.
- Keep dev + all 88 unit / 25 e2e gates byte-unaffected when `NEXT_PUBLIC_BASE_PATH` is unset
  (regression-safe by construction).

## Scope

**In scope:** basePath code edits (A), production Dockerfile + `.dockerignore` (B), prod compose
with caddy-gen labels (C), `.env.example` prod block (D), DB scripts renamed to `db_TCL` (E), Docker
deploy guide (F), regression + prod smoke gates (G/H).

**Out of scope (do NOT touch):** `saveOrderSheet`/`createOrderSheet` payload, `src/lib/totals.ts`,
`src/lib/order-save.ts`, `src/lib/order-payload.ts`, print sheet render, `test-fixtures/sheet-13-03-69.json`
(the 446 fixture), `prisma/schema.prisma`, any order-entry/print/summary/history UI. No new app
feature, no schema change, no auth logic change beyond the single `pages.signIn` prefix.

---

## Touchpoints

| # | Path | Kind | What changes |
|---|---|---|---|
| T1 | `next.config.ts` | MODIFY | add env-conditional `basePath` + `output: "standalone"` (extend, keep `serverExternalPackages`) |
| T2 | `src/auth.config.ts` | MODIFY | `pages.signIn` → env-conditional basePath-prefixed value (NO `authConfig.basePath`) |
| T3 | `src/proxy.ts` | MODIFY | add explicit `"/"` matcher entry (Next #73786 root-gate bypass) |
| T4 | `src/app/(main)/db-status.tsx` | MODIFY | prefix raw `fetch("/api/health")` with `NEXT_PUBLIC_BASE_PATH` |
| T5 | `.env.example` | MODIFY | add production block (external `db_TCL`, `NEXT_PUBLIC_BASE_PATH`, `AUTH_URL` bare host) |
| T6 | `db/create-database-and-login.sql` | MODIFY | rename `orderstock` DB → `db_TCL` (CREATE/USE/grants), keep COMPATIBILITY_LEVEL TODO |
| T7 | `db/create-orderstock-schema.sql` | MODIFY | run-against note updated to `USE [db_TCL]` (DDL body unchanged) |
| T8 | `Dockerfile` | CREATE | node:22-slim multi-stage standalone build |
| T9 | `.dockerignore` | CREATE | exclude node_modules, .env, .next, e2e artifacts, git |
| T10 | `docker-compose.prod.yml` | CREATE | caddy-gen labels, external network, writable `.env` bind-mount, no host ports |
| T11 | `docs/deployment-guide-docker.md` | CREATE | Linux/Docker/caddy-gen deploy guide (cross-links the Windows guide) |

---

## Public Contracts

- **HTTP surface:** all app routes move from origin-relative to `/orderstock/*`. The bare origin and
  any non-`/orderstock` path are NOT served by this container (caddy-gen matcher `/orderstock*`).
- **Auth contract (unchanged semantics, prefixed URLs):** login page `/orderstock/login`; auth API
  `/orderstock/api/auth/*`; health `/orderstock/api/health`; ADMIN gate on `/admin/**` + `/settings/**`
  (pathname is basePath-stripped inside the `authorized` callback — no basePath logic added there).
- **Env contract (build + runtime):**
  - `NEXT_PUBLIC_BASE_PATH` — build-time inlined (`NEXT_PUBLIC_*`), MUST be passed as a Docker
    **build ARG** AND present at runtime; prod value `/orderstock`. Unset ⇒ app serves at bare `/`.
  - `AUTH_TRUST_HOST=true` — required (self-hosted).
  - `AUTH_URL` — UNSET (recommended, proxy forwards Host/X-Forwarded-*) OR **bare origin only**
    (`https://app.krs.co.th`). NEVER include `/orderstock` or `/api/auth` (reproduces the
    `UnknownAction: Cannot parse action` 400).
  - `AUTH_SECRET`, `DATABASE_URL` (external `db_TCL`).
- **Settings-page restart contract:** `/settings/db` save calls `process.exit(0)`; the compose
  `restart: unless-stopped` policy + writable `.env` bind-mount make the container auto-restart and
  re-read the new `DATABASE_URL` at boot. `.env.bak` must survive on the host (bind-mount, not a copy).

---

## Blast Radius

**MODIFY (7):** `next.config.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/app/(main)/db-status.tsx`,
`.env.example`, `db/create-database-and-login.sql`, `db/create-orderstock-schema.sql` (note-only).

**CREATE (4):** `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`, `docs/deployment-guide-docker.md`.

**IMMUTABLE — do NOT touch:** `src/app/(main)/orders/actions.ts` (`saveOrderSheet`/`createOrderSheet`
payload), `src/lib/totals.ts`, `src/lib/order-save.ts`, `src/lib/order-payload.ts`, print render
(`src/app/print/**`, `src/styles/print.css`), `test-fixtures/sheet-13-03-69.json`, `prisma/schema.prisma`,
all order/summary/history/mobile UI, `src/auth.ts` (Node provider config), `src/lib/auth-guard.ts`.

**Auth-surface reviewer note (HIGH-RISK):** T2 + T3 are the auth-critical edits. T3's explicit `"/"`
matcher closes a real security hole (root path bypassing the gate under basePath), not a cosmetic
redirect — it is mandatory, not optional. The edge `authorized` callback body is unchanged.

---

## Implementation Checklist

### Section A — basePath code edits (4 verified files, env-conditional)

> Encode the verdict diff VERBATIM but make each edit env-conditional on `NEXT_PUBLIC_BASE_PATH` so
> that with the var UNSET, dev + all 88 unit + 25 e2e gates are byte-unaffected (regression-safe).

- **A1. `next.config.ts`** — EXTEND (do not rewrite). Add two keys alongside the existing
  `serverExternalPackages`:
  - `basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined` (unset ⇒ `undefined` ⇒ bare `/`)
  - `output: "standalone"` (self-contained server for the Docker image; orthogonal to basePath)
- **A2. `src/auth.config.ts`** — change ONLY `pages.signIn`:
  `pages: { signIn: \`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login\` }`
  (unset ⇒ `/login`, identical to today; prod ⇒ `/orderstock/login`). Do **NOT** add
  `authConfig.basePath`. Leave the `authorized` callback body unchanged (pathname is already
  basePath-stripped by Next before the callback).
- **A3. `src/proxy.ts`** — add `"/"` as the FIRST entry of the `config.matcher` array, keeping the
  existing negative-lookahead pattern as the second entry. Harmless when basePath is unset (root is
  already gated); required under basePath (Next #73786).
- **A4. `src/app/(main)/db-status.tsx`** — change the one raw fetch to
  `fetch(\`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/health\`)`. This is the ONLY raw client
  `fetch()` in the app (verified in the probe — login/logout are server actions); no other client
  fetch needs treatment.
- **A5.** Confirm no other basePath-sensitive raw fetches were introduced since the probe:
  `grep -rn "fetch(\"/" src/app` and `grep -rn "fetch(\`/" src/app` → expect only `db-status.tsx`.
  If a new one exists, apply the same prefix and note it.

### Section B — Production Dockerfile + `.dockerignore` (NEW)

- **B1. `Dockerfile`** — `node:22-slim` multi-stage:
  - `deps` stage: enable pnpm via corepack; copy `package.json` + `pnpm-lock.yaml`;
    `pnpm install --frozen-lockfile`.
  - `build` stage: copy source; `pnpm exec prisma generate` (Prisma 7 driver-adapter is **pure-JS**,
    node-mssql/tedious — NO query-engine binary to fetch, only the generated client); accept
    `ARG NEXT_PUBLIC_BASE_PATH` and export it to env BEFORE `pnpm build` (it is inlined at build time);
    `pnpm build` (produces `.next/standalone` + `.next/static`).
  - `runner` stage: `node:22-slim`, non-root user, copy the standalone set:
    `.next/standalone` → `/app`, `.next/static` → `/app/.next/static`, `public` → `/app/public`.
    Also copy `prisma/` (schema + `seed.ts`) and the deps needed to run
    `pnpm tsx prisma/seed.ts` on demand — OR document seeding via `docker compose run` against the
    build image (see F). `EXPOSE 3000`; `ENV PORT=3000 HOSTNAME=0.0.0.0`;
    `CMD ["node", "server.js"]` (standalone entrypoint).
  - Confirm `serverExternalPackages: ["mssql","tedious"]` keeps mssql/tedious out of the bundle so the
    standalone `node_modules` trace includes them at runtime.
- **B2. `.dockerignore`** — exclude: `node_modules`, `.next`, `.git`, `.env`, `.env.*`, `e2e/.auth`,
  `test-results`, `playwright-report`, `*.log`, `docker-compose*.yml`, `db/*.bak`. Do NOT exclude
  `prisma/` or `public/`.

### Section C — Production compose (NEW, `/opt/orderstock`)

- **C1. `docker-compose.prod.yml`** — one `app` service:
  - `build: { context: ., dockerfile: Dockerfile, args: { NEXT_PUBLIC_BASE_PATH: "/orderstock" } }`.
  - caddy-gen labels (values are PLACEHOLDERS pending Required-Input): `virtual.host=app.krs.co.th`,
    `virtual.port=3000`, `virtual.proxy.matcher=/orderstock*` (path-through — caddy-gen must forward
    the `/orderstock` prefix unchanged; the app owns the prefix, do NOT strip it), `virtual.tls-email=<PLACEHOLDER>`.
  - Join the existing caddy-gen **external** network: `networks: [ <PLACEHOLDER-caddy-net> ]` with a
    top-level `networks: { <PLACEHOLDER-caddy-net>: { external: true } }`.
  - `env_file: [.env]`; ALSO set `NEXT_PUBLIC_BASE_PATH=/orderstock` in `environment:` for runtime
    (build ARG covers build-time inlining; runtime env covers server-side reads).
  - **Writable `.env` bind-mount:** `volumes: [ ./.env:/app/.env ]` so the `/settings/db` rewrite +
    `.env.bak` persist on the host and survive restarts.
  - `restart: unless-stopped` (so the settings-page `process.exit(0)` auto-restarts and re-applies).
  - **NO `ports:` block** — host 3000 is taken by `qtso-app`; all ingress is via caddy-gen labels.
  - Verify matcher precedence against `qtso-app`'s own caddy-gen host/path (Required-Input Q4) so the
    `/orderstock` route is not shadowed.

### Section D — `.env.example` production block (MODIFY)

- **D1.** Append a clearly-fenced `# --- PRODUCTION (app.krs.co.th/orderstock) ---` block below the
  existing sandbox block (keep the sandbox block intact). Include, with brace-escaping guidance for
  reserved password chars (`: \ = ; / [ ] { }`):
  - `DATABASE_URL="sqlserver://<EXTERNAL-HOST>:1433;database=db_TCL;user=orderstock_app;password={...};encrypt=true;trustServerCertificate=true"`
    (external server; `database=db_TCL`).
  - `AUTH_SECRET="<openssl rand -base64 32>"`
  - `AUTH_TRUST_HOST=true`
  - `AUTH_URL` — commented out by default with a note: leave UNSET when caddy-gen forwards
    Host/X-Forwarded-*; if set, use the **bare origin** `https://app.krs.co.th` ONLY (never
    `/orderstock`, never `/api/auth`).
  - `NEXT_PUBLIC_BASE_PATH=/orderstock`
  - Note: `MSSQL_SA_PASSWORD` / sandbox `DATABASE_URL` are DEV-ONLY; production uses the external DB.

### Section E — DB scripts → `db_TCL` (MODIFY)

- **E1. `db/create-database-and-login.sql`** — replace every `orderstock` **database** identifier with
  `db_TCL`: `DB_ID(N'db_TCL')`, `CREATE DATABASE [db_TCL] COLLATE Thai_CI_AS`, the
  `COMPATIBILITY_LEVEL` ALTER-DATABASE TODO block targets `[db_TCL]`, `DEFAULT_DATABASE = [db_TCL]`,
  `USE [db_TCL]`, and the final `PRINT`. Keep the **login/user name** `orderstock_app` (app identity,
  unrelated to DB name) unless Required-Input says otherwise. Keep the COMPATIBILITY_LEVEL TODO —
  resolve to the confirmed value once Required-Input Q3 is answered (140=2017 / 150=2019 / 160=2022).
- **E2. `db/create-orderstock-schema.sql`** — DDL body is auto-generated and unchanged; update ONLY
  the header run-order comment to say the schema must be run **WITH `[db_TCL]` selected (`USE [db_TCL]`)**.
  (Filename kept as-is to avoid churn; note the DB-name/file-name mismatch in the deploy guide.)

### Section F — Docker deploy guide (NEW `docs/deployment-guide-docker.md`)

- **F1.** Author a Thai-language Linux/Docker/caddy-gen deployment guide, mirroring the Windows guide's
  section shape, covering in order:
  1. Prereqs (Docker + Docker Compose on the host; the running caddy-gen proxy + its external network;
     access to the external SQL Server).
  2. Run the 2 SQL scripts on the external server (as sysadmin): `create-database-and-login.sql`
     (creates `db_TCL` + login + grants; **set the real login password + COMPATIBILITY_LEVEL first**),
     then `create-orderstock-schema.sql` with `USE [db_TCL]`.
  3. `.env` setup on the host at `/opt/orderstock/.env`: generate `AUTH_SECRET`
     (`openssl rand -base64 32`), set `DATABASE_URL` to the external `db_TCL`, `AUTH_TRUST_HOST=true`,
     `NEXT_PUBLIC_BASE_PATH=/orderstock`, leave `AUTH_URL` unset.
  4. Set the compose network name + tls-email + caddy labels (from Required-Input), then
     `docker compose -f docker-compose.prod.yml up -d --build`.
  5. Seed the initial admin: `docker compose -f docker-compose.prod.yml run --rm -e SEED_ADMIN_PASSWORD=... app pnpm tsx prisma/seed.ts`
     (out-of-band password delivery; change after first login).
  6. Verify at `https://app.krs.co.th/orderstock` — logged-out lands on `/orderstock/login`; health
     indicator green.
  7. Print instructions — carry over verbatim from the Windows guide §9 (Chrome/Edge, Scale = 100%,
     A4 landscape, on-site test print before relying on layout).
  8. `/settings/db` runtime DB-switch caveat under Docker: the writable `.env` bind-mount +
     `restart: unless-stopped` make `process.exit(0)` auto-restart the container to apply; document
     the manual `docker compose ... up -d` fallback and that `.env.bak` lives on the host.
  9. Lockout recovery + backup (external SQL Server backup is the customer DBA's responsibility; note it).
  10. Cross-link `docs/deployment-guide.md` (Windows/NSSM alternative) and note the
      `create-orderstock-schema.sql` filename vs `db_TCL` DB-name mismatch.

### Section G — Regression safety (env-conditional proof)

- **G1.** With `NEXT_PUBLIC_BASE_PATH` UNSET: `pnpm build` succeeds and `pnpm lint` clean.
- **G2.** With `NEXT_PUBLIC_BASE_PATH` UNSET: `pnpm test` → 88/88 unit tests green (no change).
- **G3.** With `NEXT_PUBLIC_BASE_PATH` UNSET: `pnpm exec playwright test` → 25/25 e2e green (sandbox up +
  seeded admin). Playwright specs keep root-relative paths and are unaffected because basePath is unset
  in CI/local. (Prod-basePath e2e is a documented known-gap — see H3 + Test Infra Notes.)

### Section H — Production smoke gates (probe known-gaps closed at EXECUTE)

- **H1. `next start` under basePath (closes verdict known-gap 1).** `NEXT_PUBLIC_BASE_PATH=/orderstock pnpm build`
  then `NEXT_PUBLIC_BASE_PATH=/orderstock pnpm start`; drive via curl: logged-out `GET /orderstock/`
  → 302/redirect to `/orderstock/login`; `GET /login` → 404; POST valid creds → session + lands
  `/orderstock/`; `GET /orderstock/api/health` authenticated → `{"ok":true}`; logout → `/orderstock/login`.
  (The probe proved this in `next dev` + `next build`; `next start` was not re-run — this gate closes it.)
- **H2. Docker image builds + boots + serves basePath.** `docker compose -f docker-compose.prod.yml build`
  succeeds; the standalone image boots and serves `/orderstock` (against a throwaway/sandbox DB, not the
  customer DB). Do NOT point the smoke test at the customer's external SQL Server.
- **H3. Prod-basePath e2e (KNOWN-GAP, manual).** Full Playwright run under basePath requires `baseURL`
  + internal-path edits to the 25 specs; deferred as a documented manual gate + backlog note (not run
  in this plan). Record in the phase report.

---

## Acceptance Criteria

Testable, observable conditions that define "done":

1. **AC1 — Regression-safe (basePath unset):** `pnpm build` + `pnpm lint` clean AND `pnpm test` → 88/88
   AND `pnpm exec playwright test` → 25/25, all with `NEXT_PUBLIC_BASE_PATH` unset (Section G).
2. **AC2 — Auth correct under basePath:** the H1 curl flow passes all 5 checks (root-gate redirect,
   `/login` 404, login lands `/orderstock/`, authenticated health 200, logout → `/orderstock/login`).
3. **AC3 — Deployable image:** `docker compose -f docker-compose.prod.yml build` succeeds and the
   standalone image boots and serves `/orderstock` against a throwaway DB (H2).
4. **AC4 — External DB bootstrap:** `create-database-and-login.sql` creates `db_TCL` (not `orderstock`);
   `create-orderstock-schema.sql` header instructs `USE [db_TCL]`; COMPATIBILITY_LEVEL TODO present.
5. **AC5 — Kit completeness:** `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml` (caddy-gen labels,
   no host ports, writable `.env` bind-mount, `restart: unless-stopped`), `.env.example` prod block, and
   `docs/deployment-guide-docker.md` all exist and are internally consistent.
6. **AC6 — No IMMUTABLE surface touched:** git diff shows zero changes to the order/print/totals/schema
   files listed under Blast Radius → IMMUTABLE.
7. **AC7 — No secret leakage:** no real secret value (or scanned-for pattern) appears in any committed
   file, guide, or report.

## Phase Completion Rules

Single-phase plan; completion is honest-status-gated:

- **CODE DONE** — Sections A–F written, AC5/AC6 satisfied by inspection. Not yet VERIFIED.
- **CODE DONE + TESTED** — AC1 (G1–G3), AC2 (H1), AC3 (H2), AC4, AC7 all green with recorded evidence.
- **✅ VERIFIED** — requires the above PLUS explicit user confirmation that the production smoke evidence
  (H1/H2) is acceptable and the Required-Input placeholders (C/E/F) are resolved with real values. Do NOT
  mark VERIFIED on code-completion alone; H3 (full prod-basePath e2e) remains an accepted Known-Gap and
  keeps the full-suite-under-basePath dimension CONDITIONAL, backed by a backlog stub.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| G1 `pnpm build` + `pnpm lint` clean (basePath unset) | Fully-Automated | AC1 — code compiles; regression-safe when unset |
| G2 `pnpm test` 88/88 (basePath unset) | Fully-Automated | AC1 — unit suite byte-unaffected by env-conditional edits |
| G3 `pnpm exec playwright test` 25/25 (basePath unset) | Hybrid (sandbox + seeded admin) | AC1 — E2E suite byte-unaffected; existing behavior preserved |
| H1 `next start` basePath curl flow (login/root-gate/404/health/logout) | Hybrid (sandbox, curl) | AC2 — auth correctness under basePath in a real prod server (closes verdict gap 1) |
| H2 `docker compose build` + boot + serve `/orderstock` | Hybrid (Docker + throwaway DB) | AC3 — standalone image is deployable and serves the subpath |
| H3 Prod-basePath full e2e | Known-Gap (manual) | Deferred — backlog stub; keeps full-suite-under-basePath dimension CONDITIONAL |
| A5 raw-fetch audit (`grep`) | Fully-Automated | AC2 — only `db-status.tsx` needs the basePath fetch prefix |
| E1 DB script targets `db_TCL` | Agent-Probe (script review) | AC4 — bootstrap creates `db_TCL`, not `orderstock` |
| AC6 git-diff IMMUTABLE check | Fully-Automated (`git diff --stat`) | AC6 — no order/print/totals/schema surface touched |
| AC7 secret-leak scan (`pnpm test` `secret-leak.test.ts` + review) | Fully-Automated | AC7 — no committed secret / scanned-for pattern |

Auth surface (T2/T3) is HIGH-RISK → minimum Hybrid coverage satisfied by H1 (login/gate/logout under
basePath). H3 (full e2e under basePath) is the residual Known-Gap; its behavior is NOT declared PASS on
Known-Gap alone — H1 provides the proving Hybrid gate for the auth-under-basePath criterion, and H3 is
recorded as a backlog stub with the gate kept CONDITIONAL for the full-suite dimension.

Post-phase testing routes through `process/context/tests/all-tests.md` (default verification order:
build+lint → `pnpm test` → sandbox-dependent gates → e2e).

---

## Test Infra Improvement Notes

- Prod-basePath Playwright run is not automated. Recommended future hardening: parameterize
  `playwright.config.ts` `baseURL` on `NEXT_PUBLIC_BASE_PATH` and make specs use relative navigation so
  the same 25 specs run under both bare-root and `/orderstock`. Backlog stub to write at EXECUTE:
  `basepath-e2e-parameterize_NOTE_08-07-26.md`.
- No CI pipeline exists; all gates are local/manual. The Docker image build (H2) is a natural first CI
  job candidate.
- The real caddy-gen reverse-proxy hop (X-Forwarded-Host/Proto → Auth.js host trust) is not covered by
  any automated gate — verified only by the on-host H1/H2 smoke + the deploy-guide checklist.

---

## Resume and Execution Handoff

- **Selected plan (single):** this file. No phase program.
- **Start at Section A** (code edits) → B/C/D/E/F (kit artifacts) → G (regression, basePath unset) →
  H (prod smoke, basePath set). Sections A–F are independent file writes; G must run with the var
  UNSET; H with the var SET to `/orderstock`.
- **HIGH-RISK auth surface:** T2 + T3. Manual-first evidence expected for H1 (auth-under-basePath curl
  flow) before treating the auth edits as ready.
- **Do NOT** point H1/H2 at the customer's external SQL Server — use the local sandbox or a throwaway DB.
- **Required-Input (below) blocks only C/E/F finalization**, not A/B/D or G. If Required-Input is
  unavailable at EXECUTE, write PLACEHOLDER tokens in C/E/F and flag them; do not invent values.
- Validator to run on this artifact:
  `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this file>`.

---

## Required Input (blockers for C/E/F finalization — how to obtain each)

1. **caddy-gen external Docker network name** — run `docker network ls` on the deploy host; pick the
   network the caddy-gen container is attached to (`docker inspect <caddy-gen-container>`). Fills the
   `networks:` placeholder in `docker-compose.prod.yml` (C1).
2. **TLS / ACME email** — the customer's ops email for Let's Encrypt cert issuance. Fills
   `virtual.tls-email` label (C1) and the guide (F1 step 4).
3. **External SQL Server version** → sets `COMPATIBILITY_LEVEL` (140=2017 / 150=2019 / 160=2022) in
   `create-database-and-login.sql` (E1). Obtain via `SELECT @@VERSION` / `SERVERPROPERTY('ProductVersion')`
   from the customer DBA. Prisma 7 floor is 2017 (level ≥ 140).
4. **`qtso-app` caddy-gen host + path** — to confirm `/orderstock` matcher precedence does not collide
   with the co-hosted app on `app.krs.co.th`. Inspect `qtso-app`'s compose labels
   (`docker inspect qtso-app` / its compose file). Informs the `virtual.proxy.matcher` precedence note (C1).

---

## Risks

- **R1 — Auth double-strip regression (HIGH).** Any accidental `authConfig.basePath` or `/orderstock`-
  suffixed `AUTH_URL` reproduces the `UnknownAction: Cannot parse action` 400. Mitigation: verdict rule
  encoded in D1 + T2; H1 curl gate catches it.
- **R2 — Root-path auth bypass (HIGH, security).** Omitting the explicit `"/"` matcher lets `GET /orderstock`
  serve content unauthenticated (Next #73786). Mitigation: A3 mandatory; H1 asserts logged-out root → login.
- **R3 — `NEXT_PUBLIC_BASE_PATH` build/runtime mismatch.** The client fetch prefix is baked at build time;
  if the build ARG and runtime env diverge, `/api/health` breaks. Mitigation: C1 sets both ARG and
  runtime env to the same value; D1 documents it.
- **R4 — `.env` bind-mount loss.** If `.env` is COPY'd into the image instead of bind-mounted, the
  `/settings/db` rewrite is lost on restart. Mitigation: C1 writable bind-mount + `.dockerignore` excludes
  `.env` from the image (B2).
- **R5 — caddy-gen matcher collision with `qtso-app`.** Mitigation: Required-Input Q4 + precedence note.
- **R6 — DB-name vs file-name mismatch** (`create-orderstock-schema.sql` runs against `db_TCL`).
  Mitigation: header comment (E2) + guide note (F1 step 10).

## Security (STRIDE — auth + secrets surface)

- **Tampering/Elevation:** T3 root-gate fix is the primary control; edge `authorized` callback unchanged;
  `requireAuth`/`requireAuthState` server guards remain the real boundary (untouched).
- **Info disclosure:** `AUTH_SECRET`, `DATABASE_URL` live only in the host `.env` (bind-mounted, gitignored,
  excluded from the image via `.dockerignore`). The deploy guide and any report must NOT quote real secret
  values or the scanned-for patterns (repo-wide durable rule). `/api/health` + `/settings/db` already
  sanitize errors (unchanged).
- **Spoofing:** `AUTH_TRUST_HOST=true` trusts caddy-gen's forwarded host — acceptable because caddy-gen is
  the sole ingress and sets X-Forwarded-* itself; documented in F1.

---

## Validate Contract

Status: CONDITIONAL
Date: 08-07-26
date: 2026-07-08
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: 1/7 signals (S6 high-risk auth) — single-file-at-a-time edits with a hard gate ordering (A→F edits, then G with env unset, then H with env set). No independent fan-out benefit; EXECUTE is one opus agent.

Net gate: CONDITIONAL — 0 FAILs, 2 accepted known-gaps. Every basePath edit matches the VIABLE verdict verbatim (env-conditional wrapper maps to the proven config when set and to today's proven-green config when unset — both endpoints proven). The HIGH-RISK auth-under-basePath criterion is proved by the H1 Hybrid gate (NOT by known-gap). CONDITIONAL is forced only by the vacuous-green ban: the full-e2e-suite-under-basePath dimension rests on H3 (Known-Gap, manual) alone.

### Test gates (C3 5-column)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 / G1 | code compiles + lints; edits are no-ops when basePath unset | Fully-Automated | `pnpm build` exit 0 + `pnpm lint` clean, `NEXT_PUBLIC_BASE_PATH` UNSET | A — proven at EXECUTE |
| AC1 / G2 | 88 unit tests byte-unaffected by env-conditional edits | Fully-Automated | `pnpm test` → 88/88, env UNSET | A — proven at EXECUTE |
| AC1 / G3 | 25 e2e pass unchanged (bare-root) | Hybrid | `pnpm exec playwright test` → 25/25, env UNSET; precondition: sandbox up + seeded admin | A — proven at EXECUTE |
| AC2 / H1 | auth correct under basePath (root-gate redirect, `/login` 404, login lands `/orderstock/`, health 200, logout→`/orderstock/login`, ADMIN gate) | Hybrid | `NEXT_PUBLIC_BASE_PATH=/orderstock pnpm build && … pnpm start`; curl the 5-step flow; precondition: sandbox up + seeded admin | A — proven at EXECUTE (HIGH-RISK Hybrid-minimum) |
| AC3 / H2 | standalone Docker image builds, boots, serves `/orderstock` | Hybrid | `docker compose -f docker-compose.prod.yml build` exit 0 + boot + `GET /orderstock` served; precondition: throwaway/sandbox DB (NEVER customer DB) | A — proven at EXECUTE |
| AC2 / A5 | `db-status.tsx` is the only raw client fetch needing the prefix | Fully-Automated | `grep -rn 'fetch("/' src/app` + `grep -rn 'fetch(\`/' src/app` → only `db-status.tsx` | A — proven at EXECUTE |
| AC4 / E1 | DB bootstrap creates `db_TCL` (not `orderstock`); COMPATIBILITY_LEVEL TODO present | Agent-Probe | script review: `db_TCL` in CREATE/USE/DEFAULT_DATABASE/grants/PRINT; login name `orderstock_app` kept | A — proven at EXECUTE |
| AC6 | no IMMUTABLE order/print/totals/schema surface touched | Fully-Automated | `git diff --stat` shows zero changes to the IMMUTABLE Blast-Radius file list | A — proven at EXECUTE |
| AC7 | no committed secret / scanned-for pattern | Fully-Automated | `pnpm test` `secret-leak.test.ts` green + guide/report review | A — proven at EXECUTE |
| AC2 / H3 | full 25-spec e2e suite passes UNDER `/orderstock` | Known-Gap | requires `playwright.config.ts` baseURL + per-spec internal-path rewrites (out of this plan's scope) | D — backlog stub `basepath-e2e-parameterize_NOTE_08-07-26.md`; CONDITIONAL for full-suite dimension |
| — | real caddy-gen reverse-proxy hop (X-Forwarded-Host/Proto → Auth.js host trust) | Known-Gap | requires the actual deploy host + running caddy-gen; verified only by on-host H1/H2 smoke + deploy-guide checklist | D — documented residual; on-host manual verification |

gap-resolution legend: A — proven now · B — gate added by this plan · C — deferred to named later phase · D — backlog test-building stub (named residual).

C-4 reconciliation: `strategy:` carries only the 3 proving strategies (Fully-Automated / Hybrid / Agent-Probe). Known-Gap is a named residual (gap-resolution D), never a proving strategy.

Legacy line form (retained for existing consumers):
- Regression (unset): Fully-Automated — `pnpm build` + `pnpm lint`; Fully-Automated — `pnpm test` 88/88; Hybrid — `pnpm exec playwright test` 25/25 (precondition: sandbox + seeded admin).
- basePath auth smoke: Hybrid — `NEXT_PUBLIC_BASE_PATH=/orderstock pnpm build && pnpm start` + curl H1 5-step flow (precondition: sandbox + seeded admin).
- Docker build: Hybrid — `docker compose -f docker-compose.prod.yml build` + boot + serve `/orderstock` (precondition: throwaway DB).
- Scope check: Fully-Automated — `git diff --stat` IMMUTABLE list unchanged.
- DB script: Agent-Probe — `create-database-and-login.sql` targets `db_TCL`.
- Full e2e under basePath: known-gap: documented as backlog stub (`basepath-e2e-parameterize_NOTE_08-07-26.md`).
- Real proxy hop: known-gap: documented — on-host smoke only.

### Dimension findings

- Infra fit: PASS — Dockerfile standalone copy set correct (`.next/standalone`+`.next/static`+`public`), Prisma 7 driver-adapter is pure-JS (no query-engine binary), `serverExternalPackages` keeps mssql/tedious external, non-root, EXPOSE 3000. Compose: no host `ports:` (3000 taken by qtso-app), caddy-gen labels, external network, writable `./.env:/app/.env` bind-mount + `restart: unless-stopped` correctly encode the `/settings/db` `process.exit(0)` apply-on-restart contract.
- Test coverage: CONCERN — regression proof (G1–G3, env unset), auth smoke (H1), Docker build (H2) all have Fully-Auto/Hybrid gates. Residual: full e2e under basePath (H3) is Known-Gap (backlog stub); real caddy-gen proxy hop has no automated gate (on-host smoke only). HIGH-RISK auth criterion is NOT vacuously green — H1 proves it.
- Breaking changes: PASS — HTTP surface moves to `/orderstock/*` by design (documented Public Contract). Env-conditional wrapper means bare-root behavior is byte-identical to today when `NEXT_PUBLIC_BASE_PATH` unset. IMMUTABLE app-logic set (saveOrderSheet payload, totals.ts, order-save.ts, order-payload.ts, print, 446 fixture, schema.prisma) confirmed untouched by all 11 touchpoints; AC6 gates it.
- Security surface: PASS — T3 explicit `"/"` matcher closes the Next #73786 root-path auth-bypass (real hole, mandatory). No `authConfig.basePath` + no `/orderstock`-suffixed `AUTH_URL` (avoids the double-strip 400) encoded in T2/D1/R1. Secrets host-`.env`-only (gitignored, `.dockerignore`-excluded); AC7 secret-leak gate. `requireAuth` server boundary untouched.
- Section A (basePath edits) feasibility: PASS — all 4 edit targets verified present + uniquely matchable on disk: `next.config.ts` has `serverExternalPackages` (EXTEND target, no basePath yet); `auth.config.ts` line 10 `pages: { signIn: "/login" }`; `proxy.ts` matcher array (single negative-lookahead entry); `db-status.tsx` line 13 `fetch("/api/health")` (the sole raw fetch). Edits match the verdict verbatim.
- Section B–C (Docker/compose) feasibility: PASS — `Dockerfile`/`.dockerignore`/`docker-compose.prod.yml` do not exist (clean CREATE, no collision). Highest-risk edit: build-ARG vs runtime-env parity for `NEXT_PUBLIC_BASE_PATH` (R3) — C1 sets both to `/orderstock`.
- Section E (DB scripts) feasibility: PASS — `create-database-and-login.sql` currently references `orderstock` DB across CREATE/ALTER/DEFAULT_DATABASE/USE/PRINT (all matchable for the `db_TCL` rename); COMPATIBILITY_LEVEL 140/150 TODO present; login name `orderstock_app` kept. `.env.example` + `docs/deployment-guide.md` exist (MODIFY / cross-link targets).

Open gaps:
- Full 25-spec Playwright e2e UNDER `/orderstock`: known-gap: documented as backlog stub `basepath-e2e-parameterize_NOTE_08-07-26.md` (written at EXECUTE). Auth-under-basePath is still proven by the H1 Hybrid gate; only the full-suite-under-prefix dimension is deferred.
- Real caddy-gen reverse-proxy hop (X-Forwarded-Host/Proto → Auth.js trust): known-gap: documented — no automated gate; verified by on-host H1/H2 smoke + deploy-guide checklist.
- Required-Input (4 placeholders): caddy-gen network name, TLS/ACME email, external SQL Server version (→ COMPATIBILITY_LEVEL), qtso-app caddy host/path (matcher precedence). NOT a gap in A/B/D/G — blocks only C/E/F finalization. C/E/F ship with explicit PLACEHOLDER tokens at EXECUTE; do not invent values.

What this coverage does NOT prove:
- G1/G2/G3 (env unset) prove ONLY bare-root regression safety — they do NOT exercise any `/orderstock` behavior (basePath is unset in these runs).
- H1 proves auth correctness under basePath on the bare Next.js `next start` server via curl — it does NOT prove the real caddy-gen reverse-proxy hop, and does NOT run the full 25-spec e2e suite under the prefix (that is H3/Known-Gap).
- H2 proves the image builds/boots/serves `/orderstock` against a throwaway DB — it does NOT prove connectivity to the customer's external SQL Server (explicitly forbidden in smoke) and does NOT prove caddy-gen label routing (no live caddy-gen in the smoke).
- E1 script review proves the `db_TCL` identifiers are present — it does NOT prove the script runs on the customer's actual SQL Server version (COMPATIBILITY_LEVEL unconfirmed until Required-Input Q3).
- AC6 git-diff proves no IMMUTABLE file changed — it does NOT re-prove order/print/totals runtime behavior (relies on the unchanged-file invariant).

Gate: CONDITIONAL (0 FAILs; 2 named known-gaps with backlog stub + on-host manual verification; HIGH-RISK auth core proven by H1 Hybrid; user accepted the documented gaps under autonomous execution)
Accepted by: session (autonomous, /goal execution) — accepted concerns: (1) full-e2e-suite-under-basePath = Known-Gap H3, backlog stub `basepath-e2e-parameterize_NOTE_08-07-26.md`; (2) real caddy-gen reverse-proxy hop = Known-Gap, on-host smoke only. Basis: the plan's own Phase Completion Rules pre-declare H3 as an accepted Known-Gap keeping the full-suite dimension CONDITIONAL. Both residuals require infra/host access outside this repo's scope — no plan-supplement can resolve them; a supplement cycle would be a no-op.

### Execute-agent instructions

- E1 — Encode each Section-A basePath edit env-conditionally EXACTLY as A1–A4 specify (`|| undefined` for basePath, `?? ""` for the two string prefixes). Never hardcode `/orderstock`. Never add `authConfig.basePath`. Never set `AUTH_URL` with a `/orderstock` or `/api/auth` suffix. Trigger: Section A entry.
- E2 — Run G (regression) with `NEXT_PUBLIC_BASE_PATH` UNSET and H (smoke) with it SET to `/orderstock`. Do not mix. Trigger: Section G/H entry.
- E3 — Point H1/H2 at the local sandbox or a throwaway DB ONLY. Never at the customer's external SQL Server. Trigger: Section H entry.
- E4 — If Required-Input (caddy net / TLS email / SQL version / qtso path) is unavailable, write explicit PLACEHOLDER tokens in C/E/F and flag them in the phase report. Do not invent values. This blocks only C/E/F finalization, not A/B/D/G. Trigger: Section C/E/F entry.
- E5 — Write the backlog stub `basepath-e2e-parameterize_NOTE_08-07-26.md` (H3 residual) during EXECUTE. Trigger: Section H3.
- E6 — No commit/push in EXECUTE. The on-host deploy is run by the USER (no SSH here). EXECUTE produces repo artifacts + local smoke evidence only.
- E7 — HIGH-RISK auth surface (T2/T3): produce manual-first H1 evidence (the 5-step curl flow output, secrets redacted) before treating the auth edits as ready. No report/guide may quote a real secret value or the scanned-for pattern.

---

## Autonomous Goal Block

```
SESSION GOAL: Ship the orderstock production deployment kit — env-conditional Next.js basePath /orderstock, standalone Docker image, caddy-gen prod compose, external SQL Server db_TCL bootstrap, and a Thai Docker/caddy-gen deploy guide. Config/deploy change only; zero app-logic change.
Charter + umbrella plan: N/A — single plan (process/general-plans/active/orderstock-deploy_08-07-26/orderstock-deploy_PLAN_08-07-26.md)
Autonomy: autonomous execution — auto-select conservative options; no user gates except hard stops. No commit/push in EXECUTE; the on-host deploy is run by the USER (no SSH available here). EXECUTE produces repo artifacts + local smoke evidence only.
Hard stop conditions / safety constraints:
- Never point H1/H2 smoke tests at the customer's external SQL Server — sandbox or throwaway DB only.
- Never hardcode basePath, never add authConfig.basePath, never suffix AUTH_URL with /orderstock or /api/auth (reproduces the UnknownAction 400).
- Never touch the IMMUTABLE app-logic set (saveOrderSheet payload, totals.ts, order-save.ts, order-payload.ts, print render, 446 fixture, schema.prisma).
- Never quote a real secret value or the scanned-for pattern in any file, guide, or report.
- If Required-Input (caddy net name / TLS email / SQL version / qtso path) is missing, write PLACEHOLDER tokens — never invent values.
Next phase: EXECUTE: process/general-plans/active/orderstock-deploy_08-07-26/orderstock-deploy_PLAN_08-07-26.md
Validate contract: inline in plan (## Validate Contract — Gate: CONDITIONAL, 0 FAILs)
Execute start: Section A (4 env-conditional basePath edits) → B/C/D/E/F (kit artifacts, PLACEHOLDER where Required-Input missing) → G (regression, NEXT_PUBLIC_BASE_PATH UNSET: pnpm build+lint, pnpm test 88/88, pnpm exec playwright test 25/25) → H (prod smoke, NEXT_PUBLIC_BASE_PATH=/orderstock: H1 curl auth flow, H2 docker compose build+serve). High-risk pack: yes (auth surface T2/T3 — manual-first H1 evidence).
```

---

## Deviations

**D-A2 (HIGH-RISK auth, within-blast-radius T2) — `pages.signIn` is bare `/login`, NOT the
env-conditional basePath prefix the plan/verdict mandated.**

- **Planned (A2 / verdict bug #3):** `pages: { signIn: \`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login\` }`
  (→ `/orderstock/login` in prod), based on the feasibility probe's `next dev` finding that a bare
  `/login` loses the prefix and 404s.
- **Implemented:** `pages: { signIn: "/login" }` (functionally identical to the pre-existing repo code).
- **Why:** The H1 smoke gate (this plan's purpose — closing the `next start` known-gap) empirically
  proved on the REAL prod entrypoint (standalone `node server.js` AND `next start`) that NextAuth's
  edge middleware **auto-prepends** the Next.js basePath to `pages.signIn` in production. The
  prefixed value therefore doubled to `/orderstock/orderstock/login` (404). The verdict's finding
  was `next dev`-only; production behaves oppositely. Bare `/login` yields the correct single-prefix
  `/orderstock/login` in prod and stays `/login` when basePath is unset (dev/e2e). Proven by the H1
  curl flow (logged-out root → `/orderstock/login`; deep-route gate → `/orderstock/login`; login →
  `/orderstock/`; logout → `/orderstock/login`; STAFF role-gate → `/orderstock/login`).
- **Impact:** Auth is MORE correct in production than the plan's prescription. `auth.config.ts` is
  now functionally byte-identical to `main` (only added comments) — regression risk nil; the full
  88 unit + 25 e2e suite is green on the final code with env unset. Net auth code change vs main = 0.
- **Class:** within-blast-radius (auth.config.ts = T2, explicitly in the validate-contract). Not a
  hard-stop deviation. Surfaced as a CONCERN because it supersedes an explicit verdict instruction.

**D-B (within-blast-radius, Dockerfile CREATE) — build-time throwaway env placeholders added.**
`next build` in-container collects page data for `/api/auth/[...nextauth]` → imports `db.ts`, which
throws at module load when `DATABASE_URL` is unset (and NextAuth needs `AUTH_SECRET`). Since `.env`
is (correctly) dockerignored, the build failed. Fix: added throwaway `ENV AUTH_SECRET` +
`ENV DATABASE_URL` **in the build stage only** (obvious non-secret placeholders; real values arrive
at runtime via `env_file: .env`). Standard containerized-Next+Auth pattern, inside the CREATE
artifact. Proven by the successful H2 image build + boot + serve.

## Next Step

VALIDATED — Gate: CONDITIONAL (0 FAILs). This plan is execute-ready. The two CONDITIONAL residuals
(full e2e under basePath = H3 Known-Gap with backlog stub; real caddy-gen proxy hop = on-host smoke
only) are accepted, named, and require infra outside this repo. Say **ENTER EXECUTE MODE** to
implement, or supply the 4 Required-Input values first to finalize Sections C/E/F without placeholders.
