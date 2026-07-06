---
name: all-tests
description: Testing entrypoint for orderstock — planned Vitest + Playwright approach, sandbox SQL Server constraint; no real test setup yet (pre-implementation)
keywords: tests, testing, vitest, playwright, e2e, unit, integration, verification, coverage, sandbox, sql server
metadata:
  read_when: the task involves testing, verification, or test debugging
---

# orderstock - All Tests

Last updated: 2026-07-06

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:

- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

Do not load the whole `process/context/tests/` folder by default. Start here, then drill down.

---

## How This File Works

This is the `all-tests.md` entrypoint for the `tests/` context group. It follows the `all-*.md` routing convention:

1. Agents read `all-context.md` first and get routed here for testing tasks
2. This file gives quick decision rules and commands
3. For deeper details, agents follow the routing table below to specific docs

---

## Current Status

**No application code and no test setup exist yet.** The project is pre-implementation (see `process/context/all-context.md`). This file records the *planned* testing approach; update it with real commands when the app is scaffolded.

## Planned Testing Approach

Stack will be Next.js (TypeScript) + Prisma + SQL Server (see all-context.md):

- **Unit/integration:** Vitest — form calculation logic (per-column totals, total weight), master-data validation, date conversion (BE↔CE)
- **E2E:** Playwright — login flow, order entry, print page rendering (combined + per-shop)
- **Database:** integration tests against the sandbox SQL Server (Docker); never against the customer DB

## Quick Routing

(No deeper test docs yet. Add routing entries here as they are created.)

## Default Verification Order

Unless the task clearly needs a different path:

1. run the narrowest existing automated test
2. use unit/integration tests before browser tests
3. use end-to-end tests only when the real UI is the thing being verified

## Commands

| Package | Runner | Command |
|---|---|---|
| (none yet — populate at project init) | | |

## Debugging Quick Reference

(Populate when the test setup exists. Known constraint: DB-dependent tests need the sandbox SQL Server container running.)

## Known Gaps

- Entire test setup pending — the application has not been scaffolded yet.
