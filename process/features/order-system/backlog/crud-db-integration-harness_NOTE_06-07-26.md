---
name: note:crud-db-integration-harness
description: "Backlog — Vitest DB-integration harness so master-data CRUD round-trips graduate from agent-probe to automated regression before Phase 05"
date: 06-07-26
metadata:
  node_type: memory
  type: backlog-note
  feature: order-system
  phase: phase-02
---

# Backlog: CRUD DB-integration test harness

**Origin:** Phase 02 validate-contract (G-crud, tier Agent-Probe) — Playwright is not installed
until Phase 05, so the create→edit→soft-delete CRUD round-trip was proven this phase by a
manual/agent-driven data probe against the sandbox, not by a repeatable automated test.

**What to build:** A Vitest integration suite that exercises the server-action logic paths
(`src/app/shops/actions.ts`, `src/app/products/actions.ts`) against the disposable Docker
SQL Server sandbox (`orderstock-sql`), with a per-test reset/fixture helper so tests run from
a known state. Cover: shop create → edit (correction-cascade back-fill) → soft-delete →
restore; product create → add-variant (printOrder uniqueness) → soft-delete; and the
decision-6 lock (snapshot not rewritten after `needsConfirmation=false`).

**Why it matters:** Removes the manual step from the CRUD gate and gives a real regression
net before Phase 05 printing depends on this data layer.

**Blocked-by / notes:** server actions call `redirect()`/`revalidatePath()` which need a
Next request context — extract the pure data operations (or use a test harness that mocks the
Next runtime) so they can run headless under Vitest. Also register a reusable sandbox-DB
reset helper and record its command in `process/context/tests/all-tests.md` at UPDATE-PROCESS.

**Priority:** before Phase 05.
