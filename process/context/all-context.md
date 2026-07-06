---
name: all-context
description: Root context router for orderstock — project description, phase-1 scope, planned Next.js + Prisma + SQL Server stack, order-form domain knowledge, and routing to context groups
keywords: orderstock, order form, ใบออเดอร์สินค้า, stock, orders, shops, products, sql server, prisma, nextjs, architecture, stack, routing
metadata:
  read_when: any substantial planning, research, review, or implementation task
---
# orderstock - All Context

Last updated: 2026-07-06

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## Project Description

**orderstock** is a stock-and-order management system (ระบบจัดการสต็อกและออเดอร์สินค้า) for a Thai food-products distribution business. In the user's own words: staff currently record daily customer orders on a paper form ("ใบออเดอร์สินค้า"); this system digitizes that workflow — data is entered into the system following the paper form, and the system must print output that matches the same form layout.

**Users:** business staff, 2 roles — **Admin** and **Staff (พนักงาน)** — with username/password login.

**UI language:** Thai.

### Phase 1 Scope (confirmed with user)

1. **Daily order sheet entry** following the reference document `Scan2026-07-04_170934.pdf` (repo root):
   - Header: date (วันที่), location/branch (สถานที่)
   - Rows = customer shops (ร้านค้า), ~29 per sheet
   - Columns = products split by package size (1 กก. / ½ กก.), e.g. ตีนิ่ม A, ตีนิ่ม, ตีดาว, กรวด, รอง — plus a seasonings column group (เครื่องปรุง: น้ำปลา, น้ำตาล, น้ำมัน, ...)
   - Cell = ordered quantity; per-row free-text notes (หมายเหตุ)
   - Footer: per-column totals + total weight (รวมน้ำหนัก) + aggregated notes
2. **Printing** in two forms, matching the scanned form layout (A4 landscape):
   - combined daily sheet (all shops in one table)
   - per-shop sheet
3. **Master data management** — add/edit shops and products (product list is fairly stable but must be editable).
4. **User login** — Admin / Staff roles.
5. **DB connection settings page** — enter a Connection String at runtime to point the app at the target SQL Server.

### Explicitly Out of Scope (Phase 1)

- **No stock deduction / inventory balance yet** — record orders and print forms only. Stock features come later (the project name anticipates them).

### Database Strategy

- Final target: **customer's SQL Server** (version unconfirmed, assumed mid-range, e.g. 2016–2019). We design the schema **from scratch**; at delivery we hand a SQL creation script to the customer's vendor to run.
- During development: **Sandbox database** first (SQL Server in Docker preferred), switched to the customer DB later via the connection-string settings page.
- Keep the schema compatible with mid-range SQL Server versions (avoid features newer than SQL Server 2016 unless confirmed).

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

**What each `all-{group}.md` must contain:**

- Scope (what the group covers and does NOT cover)
- Read-when rules (when an agent should load this group)
- Quick procedures or decision rules
- Source paths (list of deeper docs in the group)
- Update triggers (when to refresh this group's content)
- Routing to deeper docs within the group

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

<!-- GENERATED:routing -->
| File | Read when |
|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |
| `process/context/planning/all-planning.md` | creating or calibrating an implementation plan |
| `process/context/tests/all-tests.md` | the task involves testing, verification, or test debugging |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `planning/` | `process/context/planning/all-planning.md` | Planning context entrypoint for orderstock — plan-shape calibration (SIMPLE vs COMPLEX), planning conventions, and example plan references |
| `tests/` | `process/context/tests/all-tests.md` | Testing entrypoint for orderstock — planned Vitest + Playwright approach, sandbox SQL Server constraint; no real test setup yet (pre-implementation) |
<!-- /GENERATED:routing -->

## Task Routing Table

| Task type | Load first | Then load |
|---|---|---|
| general repo research | `all-context.md` | — (no code yet; see Planned Architecture below) |
| implementation planning | `all-context.md`, `planning/all-planning.md` | the active plan in `process/general-plans/active/` |
| order-form domain questions | `all-context.md` | `process/features/order-system/active/phase1-order-system_06-07-26/form-canonical_REF_06-07-26.md` (canonical transcription; raw scan at repo root) |
| order-system implementation | `all-context.md` | the umbrella plan + current phase plan in `process/features/order-system/active/phase1-order-system_06-07-26/` |
| test planning or verification | `all-context.md`, `tests/all-tests.md` | — |
| context maintenance | `all-context.md` | run `vc-audit-context` after edits |

## Current Features

| Feature | Folder | Status |
|---|---|---|
| `order-system` | `process/features/order-system/` | Active — phase program `phase1-order-system_06-07-26` (umbrella + 6 phase plans); Phase 01 Foundation is the current phase |

When routing feature-scoped work, pass `Feature: order-system` and the program folder path
`process/features/order-system/active/phase1-order-system_06-07-26/` in the subagent prompt.

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:

- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:

- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `vc-audit-context` skill after every context organization change.

**Expected future groups for this project** (create when code exists): `database/` (Prisma schema, migration/script generation for SQL Server), `auth/` (NextAuth config, role-based access), `uxui/` (Thai UI, print layouts).

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:

- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

## Context Update Protocol

When durable project knowledge changes:

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `vc-audit-context`

---

## Repository Structure

**Current state: no application code yet.** The repo contains only the agent harness, the process/ system, and the reference scan document. The GitHub remote (`https://github.com/innovera2025/orderstock.git`) is empty (no commits pushed yet).

```
orderstock/
  Scan2026-07-04_170934.pdf   -- reference: the paper order form to digitize and print
  CLAUDE.md / AGENTS.md        -- managed protocol files (do not edit per-project)
  .claude/ .codex/ .agents/    -- agent harness (kit v3.2.5)
  process/
    context/                   -- this context system
    general-plans/             -- plans, reports, references
    features/                  -- feature-scoped storage (template only so far)
    development-protocols/     -- RIPER-5 methodology docs
```

### Planned Application Structure (once implementation starts)

Single Next.js app (no monorepo). Expected shape:

```
orderstock/
  src/
    app/                -- Next.js App Router (Thai UI)
      (auth)/login      -- login page
      orders/           -- daily order sheet entry + list
      orders/print      -- print layouts (combined + per-shop, A4 landscape)
      shops/            -- master data: customer shops
      products/         -- master data: products + package sizes
      settings/db       -- connection-string settings page
    lib/                -- shared utilities (db client, auth helpers)
  prisma/
    schema.prisma       -- SQL Server datasource
  scripts/              -- SQL creation script export for the customer's vendor
```

## Technology Stack

**Status: chosen with the user, not yet implemented.** (User asked Claude to pick the stack; no objections raised.)

- **Framework:** Next.js (latest stable, App Router) — web app usable on desktop and mobile, no client install
- **Language:** TypeScript throughout
- **Database:** Microsoft SQL Server via **Prisma ORM**
  - dev: sandbox SQL Server in Docker; production: customer's SQL Server via runtime connection string
- **Auth:** NextAuth (credentials provider, username/password), roles: `ADMIN`, `STAFF`
- **UI:** Thai-language UI; print via browser print layout (A4 landscape) matching the scanned form
- **Package manager:** to be decided at project init (default pnpm)

## Key Patterns and Conventions

(To be populated once code exists. Conventions confirmed so far:)

- UI text in Thai; code, identifiers, and file names in English
- Product package sizes are first-class: the same product is ordered in 1 กก. and ½ กก. units and appears as separate columns on the printed form
- Printed output must visually match `Scan2026-07-04_170934.pdf` — treat the scan as the layout spec
- DB connection must be configurable at runtime (settings page with connection string), not hard-coded in env only

## Environment and Configuration

(Names only; to be created at project init.)

- Database: `DATABASE_URL` (sandbox default; runtime override via settings page)
- Auth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

## Gotchas and Cautions for Agents

- The reference PDF is a **handwritten scan** — product/shop names transcribed from it may contain OCR errors. Confirm exact master-data names with the user before seeding data.
- Thai Buddhist-era dates appear on the form (e.g. 13/3/69 = 2569 BE = 2026 CE). Decide and document date storage (store CE in DB, display BE) during planning.
- SQL Server version at the customer is unconfirmed — keep schema/script compatible with mid-range versions.
- No stock deduction in Phase 1 — do not design inventory-balance features prematurely.

## Open Questions / Outstanding Work

- SQL Server version at the customer site — unconfirmed (assumed mid-range); confirm before finalizing the schema script
- Exact shop names and product list — transcribed from a handwritten scan; must be confirmed/corrected with the user before seeding master data
- Date handling decision (store CE, display Buddhist Era?) — decide during planning
- Project scaffolding (Next.js init, package manager choice) — not started yet; first implementation plan pending

## Scan Metadata

- Generated: 2026-07-06
- HEAD: (no commits yet)
- Mode: fresh
- Package manager: (none yet — no package.json)
