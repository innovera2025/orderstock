---
name: report:orderstock-deploy
description: EXECUTE exit summary — orderstock production deployment kit (basePath /orderstock, standalone Docker, caddy-gen, external db_TCL). All gates green; 1 HIGH-RISK auth deviation superseding the verdict; 4 placeholder tokens for the user.
phase: orderstock-deploy
date: 2026-07-09
status: COMPLETE_WITH_GAPS
feature: none
plan: process/general-plans/active/orderstock-deploy_08-07-26/orderstock-deploy_PLAN_08-07-26.md
metadata:
  node_type: memory
  type: report
  feature: none
  phase: orderstock-deploy
---

# EXECUTE Report — orderstock Production Deployment Kit

TL;DR: All plan sections A–H implemented and gate-proven. Regression fully green with basePath
unset (build+lint, 88/88 unit, 25/25 e2e). Auth-under-basePath (HIGH-RISK) proven by the H1 curl
flow on the REAL standalone prod server. Docker image builds + boots + serves `/orderstock` (H2).
**One HIGH-RISK deviation:** `pages.signIn` is bare `/login` (NOT the verdict's prefixed value) —
H1 empirically proved production auto-prepends basePath, so the prefixed value 404'd with a double
prefix. Net auth code change vs `main` = 0. **4 placeholder tokens** remain for the user to fill.

## What Was Done

Per-section results (all against `NEXT_PUBLIC_BASE_PATH` UNSET for G, SET=`/orderstock` for H):

- **A — basePath edits (4 files, env-conditional):**
  - `next.config.ts` — `basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined` + `output: "standalone"` (EXTEND).
  - `src/auth.config.ts` — `pages.signIn` = bare `/login` (see Deviation D-A2 below; NOT prefixed).
  - `src/proxy.ts` — explicit `"/"` matcher added as first entry (Next #73786 root-gate).
  - `src/app/(main)/db-status.tsx` — raw fetch prefixed `\`${NEXT_PUBLIC_BASE_PATH ?? ""}/api/health\``.
  - A5 audit: `grep` confirms `db-status.tsx` was the ONLY raw origin-relative client fetch.
- **B — Dockerfile + .dockerignore (CREATE):** node:22-slim multi-stage (deps → build → runner),
  pnpm via corepack@11.5.0, `prisma generate` + `pnpm build`, standalone copy set
  (`.next/standalone` + `.next/static` + `public` + `prisma`), non-root, EXPOSE 3000,
  `CMD ["node","server.js"]`. Build ARG `NEXT_PUBLIC_BASE_PATH` inlined pre-build. `.dockerignore`
  excludes `.env`, node_modules, `.next`, e2e/.auth, compose files, process/reports/plans.
- **C — docker-compose.prod.yml (CREATE):** one `app` service, caddy-gen labels (host
  app.krs.co.th, port 3000, matcher `/orderstock*` path-through, tls-email placeholder), external
  network (placeholder), `env_file: .env`, runtime `NEXT_PUBLIC_BASE_PATH=/orderstock`, WRITABLE
  `./.env:/app/.env` bind-mount, `restart: unless-stopped`, NO host `ports:`. Placeholder legend at top.
- **D — .env.example prod block (MODIFY):** appended `# --- PRODUCTION ---` block (external db_TCL
  DATABASE_URL with brace-escape note, AUTH_SECRET, AUTH_TRUST_HOST, AUTH_URL bare-host-only
  warning, NEXT_PUBLIC_BASE_PATH); sandbox block kept intact.
- **E — DB scripts → db_TCL (MODIFY):** `create-database-and-login.sql` renamed the DB identifier to
  `db_TCL` across CREATE/USE/DEFAULT_DATABASE/PRINT; login name `orderstock_app` kept;
  COMPATIBILITY_LEVEL is now `__PLACEHOLDER_COMPAT_LEVEL__`/TODO. `create-orderstock-schema.sql`
  header updated to instruct `USE [db_TCL]` (DDL body unchanged).
- **F — docs/deployment-guide-docker.md (CREATE):** full Thai Linux/Docker/caddy-gen runbook —
  required-values table, prereqs, 2-SQL-script order on the external server, `.env` setup, compose
  placeholder fill + `up -d --build`, seed via `docker compose run`, verify at
  `https://app.krs.co.th/orderstock`, print instructions (carried from the Windows guide), the
  `/settings/db` restart-under-Docker caveat, lockout recovery + backup, cross-link + filename note.
- **G — Regression (env UNSET):** all green on the FINAL code state.
- **H — Prod smoke (env SET):** H1 auth curl flow + H2 Docker image both green.
- **E5 — backlog stub written:** `basepath-e2e-parameterize_NOTE_08-07-26.md`.

## What Was Skipped or Deferred

- **H3 — full 25-spec e2e under `/orderstock`:** Known-Gap (accepted CONDITIONAL). Backlog stub
  written. Auth-under-basePath is still proven by H1; only the full-suite-under-prefix dimension is deferred.
- **Real caddy-gen reverse-proxy hop** (X-Forwarded-Host/Proto → Auth.js trust): Known-Gap, on-host
  manual verification only (no automated gate possible without the deploy host).
- **4 Required-Input placeholders** (below) left as `__PLACEHOLDER_*__` tokens per E4 — not invented.

## Test Gate Outcomes

| Gate | Strategy | Result | Key evidence |
|---|---|---|---|
| G1 build + lint (unset) | Fully-Automated | PASS | `✓ Compiled successfully`; eslint clean; bare-root routes |
| G2 unit (unset) | Fully-Automated | PASS | 16 files / 88 tests passed (incl. secret-leak.test.ts) |
| G3 e2e (unset) | Hybrid | PASS | 25 passed (chromium + mobile), sandbox + seeded admin |
| H1 auth under basePath | Hybrid (standalone prod + curl) | PASS | logged-out `/orderstock`→307 `/orderstock/login`; `/login`→404; api/auth CSRF 64-char (no double-strip 400); login→302 + session; authed `/orderstock`→200; health→200 `{ok:true}`; logout→re-gate `/orderstock/login`; STAFF→`/admin/users`→307 `/orderstock/login` (role gate, single prefix) |
| H2 Docker build + serve | Hybrid (Docker + throwaway DB) | PASS | `orderstock-app:latest` built; container serves `/orderstock/login`→200, `/login`→404, `/orderstock`→307 single-prefix; health route runs |
| A5 raw-fetch audit | Fully-Automated | PASS | only `db-status.tsx` |
| E1 db_TCL script review | Agent-Probe | PASS | `db_TCL` in CREATE/USE/DEFAULT_DATABASE/PRINT; login `orderstock_app` kept |
| AC6 IMMUTABLE scope-fence | Fully-Automated | PASS | `git diff --stat` on immutable set = EMPTY |
| AC7 secret-leak | Fully-Automated | PASS | secret-leak.test.ts green; no real secret/pattern in files or this report |
| H3 full e2e under basePath | Known-Gap | DEFERRED | backlog stub written |

Blast radius confirmed: 7 MODIFY + 4 CREATE exactly as planned; IMMUTABLE set untouched.

## Plan Deviations

Two, both within-blast-radius, both fully documented in the plan's new `## Deviations` section:
- **D-A2 (HIGH-RISK auth):** `pages.signIn` = bare `/login` instead of the verdict's prefixed value.
  H1 proved production (standalone `node server.js` AND `next start`) auto-prepends basePath → the
  prefixed value doubled to `/orderstock/orderstock/login` (404). Bare `/login` yields correct
  single-prefix in prod and is unchanged in dev. `auth.config.ts` is now functionally byte-identical
  to `main`. **Surfaced as a CONCERN** because it supersedes an explicit feasibility-verdict instruction.
- **D-B (Dockerfile):** added throwaway build-time `AUTH_SECRET` + `DATABASE_URL` placeholders in the
  build stage so in-container `next build` can collect the `/api/auth` route page data (`.env` is
  dockerignored; `db.ts` throws at module load without `DATABASE_URL`). Real values arrive at runtime.

## Test Infra Gaps Found

- No CI pipeline — all gates local/manual. Docker image build (H2) is the natural first CI job.
- Prod-basePath Playwright run not automated (H3 backlog stub — parameterize `baseURL` on
  `NEXT_PUBLIC_BASE_PATH`).
- `next start` warns it "does not work with output: standalone" — H1 was therefore ALSO run against
  the real `node .next/standalone/server.js` entrypoint (authoritative for prod); both agreed.

## Required-Input placeholders the USER must fill

| Token | File | What to supply |
|---|---|---|
| `__PLACEHOLDER_CADDY_NETWORK__` | `docker-compose.prod.yml` (`networks.caddy.name`) | External Docker network the caddy-gen container is on (`docker network ls`) |
| `__PLACEHOLDER_TLS_EMAIL__` | `docker-compose.prod.yml` (label `virtual.tls-email`) | ACME/Let's Encrypt ops email |
| `__PLACEHOLDER_COMPAT_LEVEL__` | `db/create-database-and-login.sql` | SQL Server version → 140/150/160 |
| qtso-app host/path (verify only) | — | Confirm `/orderstock*` matcher doesn't collide with qtso-app on app.krs.co.th |

## Closeout Packet

- **Selected plan:** `process/general-plans/active/orderstock-deploy_08-07-26/orderstock-deploy_PLAN_08-07-26.md`
- **Finished:** Sections A–H; all automated + hybrid gates green; kit complete (Dockerfile,
  .dockerignore, compose, .env.example prod block, db_TCL scripts, Docker deploy guide, backlog stub).
- **Verified:** AC1 (regression unset), AC2 (H1 auth under basePath), AC3 (H2 image serves), AC4
  (db_TCL), AC6 (IMMUTABLE), AC7 (secrets). **Unverified (accepted gaps):** AC2-H3 full e2e under
  basePath; real caddy-gen proxy hop — both on-host/backlog.
- **Remaining cleanup/context:** UPDATE PROCESS to archive + capture the `next start` vs `next dev`
  basePath finding (durable). No commit performed (per E6 — user runs the on-host deploy).
- **Classification:** Keep in active/testing — CODE DONE + TESTED. Per Phase Completion Rules, ✅
  VERIFIED needs explicit user acceptance of the H1/H2 evidence + the 4 placeholder values resolved.
- **Best next state:** user reviews the H1 auth deviation (D-A2) + fills the 4 placeholders → then
  UPDATE PROCESS to archive and record the basePath finding.

## Forward Preview

- **Test Infra Found:** no CI; H3 e2e-under-basePath deferred (backlog stub); H1/H2 are local smoke.
- **Blast Radius Changes:** none beyond the planned 7 MODIFY + 4 CREATE; auth.config.ts net-zero vs main.
- **Commands to Stay Green:** `pnpm lint` · `pnpm build` · `pnpm test` (88) · `pnpm exec playwright test` (25) — all with `NEXT_PUBLIC_BASE_PATH` unset.
- **Dependency Changes:** none (no new packages; corepack pnpm@11.5.0 pinned in the image only).

---

## EVL Independent Re-Verification (vc-tester, 09-07-26)

Independent re-run of the validate-contract gates by a spawned vc-tester — execute-agent's green
claim treated as UNCONFIRMED and re-proven from scratch.

### Gate status (independent run)

| Gate | Command (env) | Independent result | Claimed |
|---|---|---|---|
| G1 build (unset) | `pnpm build` | PASS — `✓ Compiled successfully`, exit 0 | PASS ✓ |
| G1 lint (unset) | `pnpm lint` | PASS — exit 0 | PASS ✓ |
| G2 unit (unset) | `pnpm test` | PASS — **16 files / 88 tests passed** | 88 ✓ |
| G3 e2e (unset) | `pnpm exec playwright test` | PASS — **25 passed** (55.2s, 1 worker) | 25 ✓ |
| Scope-fence | `git diff --exit-code` on IMMUTABLE set | PASS — **EMPTY (exit 0)** | EMPTY ✓ |
| H1 basePath auth (standalone) | `node .next/standalone/server.js`, curl | PASS (see below) | PASS ✓ |
| H2 Docker | `docker compose -f docker-compose.prod.yml build` + run image | PASS — build exit 0; image serves correctly | PASS ✓ |
| Placeholders present | grep | PASS — all 3 tokens present, not fabricated | ✓ |

Aggregate (both runners, env unset): ALL PASS. basePath build (`NEXT_PUBLIC_BASE_PATH=/orderstock
pnpm build`) also exit 0. Clean env-unset build restored after the smoke tests.

### D-A2 correctness verdict — CONFIRMED (no double-prefix)

`pages.signIn` is bare `/login` (auth.config.ts:17); `authConfig.basePath` is never set; `.env.example`
AUTH_URL guidance carries no `/orderstock`; proxy.ts has the explicit `"/"` matcher; db-status.tsx
fetch is env-prefixed. Independently reproduced on the REAL standalone prod entrypoint
(`node .next/standalone/server.js`, AUTH_URL unset) AND the actual Docker image:

- logged-out `/orderstock` → **307 → `/orderstock/login`** (single prefix)
- deep route `/orderstock/admin/users` (logged-out) → **307 → `/orderstock/login`**
- bare `/login` → **404**; `/orderstock/login` → **200**
- `/orderstock/api/auth/csrf` → **200 JSON** (no double-strip 400); `/orderstock/api/auth/session` → 200
- **Zero `/orderstock/orderstock` double-prefix** in any redirect Location.

The Docker image (`orderstock-app:latest`, run with AUTH_URL unset = shipped default) reproduced the
same correct single-prefix redirect. The D-A2 bug (double-prefix) is **ABSENT**.

### CONCERNS (non-blocking, documentation-level)

1. **AUTH_URL bare-origin breaks the signIn redirect (new finding).** With `AUTH_URL` set to a bare
   origin lacking the subpath (e.g. `http://host` / `https://app.krs.co.th`), the standalone server
   redirected the auth gate to **bare `/login` (→404)** — the basePath is dropped from the
   `pages.signIn` resolution. With `AUTH_URL` **UNSET** (the plan's recommended default, and what the
   Docker image uses) the redirect is correctly `/orderstock/login`. The `.env.example` currently
   lists bare-origin AUTH_URL as an acceptable alternative — it should be documented as **UNSET-only**
   for a subpath deploy, or the operator must include the subpath awareness. Shipped default is
   correct; the alternative path in the guidance is a latent 404 trap. Recommend a doc tightening in
   UPDATE PROCESS (does not change code; does not block deploy with the recommended config).
2. **Authenticated login sub-flow not independently re-run under basePath.** The login-success →
   `/orderstock/` landing, authed health 200, logout, and ADMIN `/admin/users` 200 sub-steps require
   DB + `.env` secrets; the repo privacy hook requires interactive user approval for `.env` access,
   unavailable in this subagent context. These sub-steps are covered by (a) the independent 25/25 e2e
   run (login success, STAFF-blocked/ADMIN-allowed on `/admin`, logout, health — at bare root; session
   mechanics are basePath-independent) and (b) execute-agent's manual H1 evidence. The basePath-SPECIFIC
   auth risks (double-prefix, signIn redirect, api/auth reachability, route-gate) were ALL independently
   proven above. auth.config.ts is byte-identical to `main` except comments (D-A2), so the authed logic
   is unchanged.

### EVL HANDOFF SUMMARY:
```yaml
gates_green: [G1-build, G1-lint, G2-unit-88, G3-e2e-25, scope-fence-empty, H1-basepath-auth-standalone, H1-basepath-auth-docker-image, H2-docker-build, placeholders-present]
known_gaps: [H3-full-e2e-under-basepath-backlog-stub, real-caddy-gen-proxy-hop-on-host-only, authed-login-subflow-not-independently-rerun-privacy-hook, AUTH_URL-bare-origin-signin-redirect-caveat]
follow_up_stubs: [basepath-e2e-parameterize_NOTE_08-07-26.md]
context_partial: []
preliminary_packet_path: process/general-plans/active/orderstock-deploy_08-07-26/orderstock-deploy_REPORT_08-07-26.md
closeout_classification: WITH_GAPS
```
