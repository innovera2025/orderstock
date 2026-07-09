---
name: note:basepath-e2e-parameterize
description: Backlog test-building stub — parameterize Playwright e2e to run the 25-spec suite under NEXT_PUBLIC_BASE_PATH=/orderstock (H3 residual known-gap)
date: 08-07-26
metadata:
  node_type: memory
  type: note
  feature: none
---

# Backlog: parameterize Playwright e2e to run under `/orderstock` (H3 residual)

## Why this exists

The `orderstock-deploy` plan (VALIDATE gate CONDITIONAL) ships an env-conditional Next.js
`basePath: /orderstock`. Regression safety with the var **unset** is fully proven (88 unit +
25 e2e green). Auth correctness **under** basePath is proven by the H1 curl smoke (login /
root-gate / `/login` 404 / health / logout / ADMIN gate on `next start`).

**Residual known-gap (H3):** the full 25-spec Playwright suite has NOT been run under
`NEXT_PUBLIC_BASE_PATH=/orderstock`. The specs hardcode root-relative paths (`/login`,
`/admin/users`, `/orders/...`) and the `mobile` project baseURL is bare-root, so they would
404 under the subpath without changes. This is deferred, not fixed, per the plan's Phase
Completion Rules (kept CONDITIONAL for the full-suite-under-prefix dimension).

## The fix (when picked up)

1. **`playwright.config.ts`** — derive `use.baseURL` from `NEXT_PUBLIC_BASE_PATH`, e.g.
   `` `http://localhost:${PORT}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}` ``. Start the
   `webServer` with the same env so `pnpm start` serves under the prefix.
2. **Specs** — switch absolute `page.goto("/login")` etc. to relative navigation (drop the
   leading `/` or rely on `baseURL`), and audit any hardcoded `expect(page).toHaveURL("/...")`
   assertions to tolerate the prefix (or assert on `baseURL`-relative paths).
3. **auth.setup.ts fixtures** — ensure the storage-state login flow navigates under the prefix.
4. Run the suite twice in CI: once with the var unset (bare root — current green) and once
   with `NEXT_PUBLIC_BASE_PATH=/orderstock`, both must pass.

## Second residual (documented, not automatable here)

The real **caddy-gen reverse-proxy hop** (X-Forwarded-Host/Proto → Auth.js host trust) has no
automated gate — it requires the actual deploy host + running caddy-gen. Verified only by the
on-host H1/H2 smoke + the deploy-guide checklist (`docs/deployment-guide-docker.md`).

## Related

- Plan: `orderstock-deploy_PLAN_08-07-26.md` (Section H3, Verification Evidence, Validate Contract)
- Feasibility: `deploy-basepath_FEASIBILITY_08-07-26.md` (known-gap 3 — Playwright not re-run under basePath)
