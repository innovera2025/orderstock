---
name: plan:erp-dashboards-phase-00-prerequisites
description: "ERP Dashboards — Phase 0: clear prod-deploy backlog coordination, write the ERP read-only login delivery script, write the KRS/customer question list, correct stale ERP-clone claims, confirm fixture-DB approach"
date: 18-09-26
metadata:
  node_type: memory
  type: plan
  feature: erp-dashboards
  phase: phase-00
---

# Phase 0 — Prerequisites

**Date**: 18-09-26
**Status**: ⏳ PLANNED
**Complexity**: COMPLEX
**Program:** erp-dashboards
**Umbrella plan:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-umbrella_PLAN_18-09-26.md`
**Registry:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-blast-radius-registry.md`
**SPEC (frozen, governs this phase):** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards_SPEC_18-09-26.md`
**Phase status:** ⏳ PLANNED
**Report destination:** `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_REPORT_18-09-26.md`

---

## Overview

Phase 0 of the `erp-dashboards` 6-phase program (see Purpose below for full detail). Direct plan
artifact for a single phase within a phase program; the program-level context and goal are owned by
the umbrella plan and frozen SPEC linked above.

---

## Purpose

Phase 0 is a documentation-and-coordination phase — it writes zero application source code and
opens zero live database connections. Its job is to clear the ground so Phase 1 (ERP Read
Foundation) can start cleanly:

1. Surface and coordinate the ~15-commit-behind production deploy backlog (`fe2df61..HEAD`,
   including the not-yet-run `db/alter-shop-add-location.sql`) so it is a tracked, owner-noted item
   — not silently ignored while a brand-new feature program starts on top of it. Phase 0 does
   **not** deploy anything itself; deploying to the customer's host is always a human/DBA action.
2. Write the delivery script that provisions the dedicated, scoped, read-only ERP login the whole
   program is hard-gated on (`db/create-erp-readonly-login.sql`) — written now, in the same style
   as the existing `db/create-database-and-login.sql` / `db/alter-shop-add-location.sql` delivery
   scripts, but **never run by any agent, at any phase, against db_TCL.**
3. Write the KRS/customer question list — the open questions from the SPEC (sales-basis
   permanence, purchase-total default framing, PO status workflow, production-actual timeline,
   read-only login provisioning timeline) plus the deploy items that need a human decision, in one
   reviewable Thai/English document.
4. Correct two specific stale lines in `process/context/database/all-database.md` and
   `process/context/tests/all-tests.md` that currently describe the *sandbox* `orderstock` Prisma
   DB as "an ERP-shaped clone containing unrelated ERP tables (e.g. `krs_log`)" — this claim is
   now stale/misleading in the context of this program, which is about to build a genuinely
   ERP-shaped **fixture** database on purpose. The correction must not remove the underlying
   technical fact these lines exist to explain (that `prisma migrate dev`'s shadow-diff is unusable
   against that sandbox DB) — it must clarify that the sandbox DB is *not* actually an ERP clone,
   just historically described loosely that way, and point forward to the real ERP-shaped fixture
   DB this program is about to add as a *separate*, deliberately-provisioned database.
5. Confirm, in the phase report, the concrete fixture-DB approach Phase 1 will build against
   (database name, sandbox container, isolation from the Prisma `orderstock` DB) — so Phase 1 does
   not have to re-derive this decision from scratch.

Phase 0 exists in the program sequence because every later phase depends on: (a) a known, stable
deploy state (no silent scope creep from mixing an unrelated deploy backlog into feature work),
(b) a written (not-yet-run) path to the production read-only login the program's hard safety
constraint depends on, (c) accurate context docs so Phase 1's research doesn't inherit a stale
"this sandbox already has an ERP shape" assumption, and (d) an explicit customer-question paper
trail so answers can be slotted in later without blocking PLAN/EXECUTE now (per the SPEC's Open
Questions section, none of these block this program).

---

## Entry Gate

- Umbrella plan and SPEC exist and are frozen (they do — this session created Phase 0 directly from
  them).
- No phase 0-1 dependency — Phase 0 is the program's first phase.

---

## Scope

### In scope
- Documentation, coordination, and one delivery-script artifact (never executed by an agent).
- Corrections to two specific context-doc claims (surgical, not a rewrite).
- Confirming (not building) the fixture-DB approach — Phase 1 owns actually creating
  `db/erp-fixture/*.sql` and the `erp_fixture` sandbox database.
- Adding the initial `erp-dashboards` feature-folder entry to `process/context/all-context.md`'s
  Current Features table.

### Out of scope (explicitly, for this phase)
- Running any SQL against `db_TCL` (delivery-script content only — DBA-run, never agent-run).
- Actually deploying the ~15-commit backlog to the production host (human/ops action on the
  customer's host — Phase 0 documents and coordinates only).
- Any `src/lib/erp/*`, `src/app/(main)/dashboards/**`, or fixture-DDL code — that is Phase 1+.
- Provisioning the real `orderstock_dash` login on the live server — writing the delivery script
  is in scope; running it is a DBA action tracked as USER-RUN, outside this program's phase loop.
- Editing `prisma/schema.prisma` (never touched by this program at any phase — ERP tables are never
  Prisma models).

---

## Touchpoints (exact files — create vs edit)

| Path | Action | Owner rule (per registry) |
|---|---|---|
| `db/create-erp-readonly-login.sql` | CREATE | Phase 0 owned; never re-touched by later phases |
| `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-questions_REF_18-09-26.md` | CREATE | Phase 0 owned |
| `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_REPORT_18-09-26.md` | CREATE (at UPDATE-PROCESS, step 7) | Phase 0 owned |
| `process/context/database/all-database.md` | EDIT — surgical correction near the existing "ERP-shaped clone" sentence (see Step C below) | Phase 0 owns this correction; later phases may APPEND new content elsewhere but must not re-touch this correction |
| `process/context/tests/all-tests.md` | EDIT — surgical correction near the existing "ERP-shaped clone" sentence (see Step C below) | Phase 0 owns this correction; later phases may APPEND new testing-convention entries but must not re-touch this correction |
| `process/context/all-context.md` | EDIT — add ONE new row to the "Current Features" table + a corresponding routing-table mention | Phase 0 owns the initial entry; every later phase's UPDATE-PROCESS step updates its own status line within that same entry |
| Production deploy backlog (`process/general-plans/active/orderstock-deploy_08-07-26/*.md`) | READ ONLY — Phase 0 reads and cites current status; does NOT edit these files (they belong to a different, already-existing plan/program) | Phase 0 does not own these files |

No other file is created or modified by Phase 0. Any additional file need discovered mid-phase must
be raised via `registry_change_requests` in the phase report, not touched inline.

---

## Data / Correction Details (exact text to change)

### C.1 — `process/context/database/all-database.md`

Current stale sentence, near the "Sandbox migration note" paragraph (search for the phrase
`ERP-shaped clone with unrelated ERP tables`):

```
Sandbox migration note: `prisma/migrations/20260713000000_shop_location/migration.sql` is a
hand-authored `ALTER TABLE [dbo].[Shop] ADD [location] NVARCHAR(200)` (the sandbox `orderstock` DB
is an ERP-shaped clone with unrelated ERP tables like `krs_log`, so `prisma migrate dev`'s
shadow-diff is unusable there — see `tests/all-tests.md` Test Infra Gaps for the same finding);
```

**Replace** the parenthetical with a corrected version that (a) removes the inaccurate "ERP-shaped
clone with unrelated ERP tables like `krs_log`" claim about the sandbox `orderstock` DB, (b)
preserves the still-true underlying fact (shadow-diff is unusable against that sandbox DB — this
was independently caused by the DB having been created via hand-authored SQL rather than a full
migration history, not by it containing ERP tables), and (c) forward-references the NEW, genuinely
ERP-shaped `erp_fixture` database this program adds in Phase 1 as a *separate, deliberately
provisioned* database, never to be confused with the `orderstock` sandbox DB. Target replacement
text:

```
Sandbox migration note: `prisma/migrations/20260713000000_shop_location/migration.sql` is a
hand-authored `ALTER TABLE [dbo].[Shop] ADD [location] NVARCHAR(200)` (the sandbox `orderstock` DB
was bootstrapped via hand-authored SQL rather than a full linear migration history, so `prisma
migrate dev`'s shadow-diff is unusable there — see `tests/all-tests.md` Test Infra Gaps for the
same finding; **correction, 18-09-26 (erp-dashboards Phase 0):** earlier context wording described
this sandbox DB as "an ERP-shaped clone with unrelated ERP tables like `krs_log`" — that is
inaccurate; the `orderstock` sandbox DB has never contained ERP tables. A genuinely ERP-shaped
fixture database (`erp_fixture`), separate from this sandbox, is introduced in the
`erp-dashboards` program's Phase 1 — see that phase's report for the fixture-DB pattern);
```

### C.2 — `process/context/tests/all-tests.md`

Current stale sentence (search for `is an ERP-shaped clone containing unrelated ERP tables`), in
the `shop-location-roster_13-07-26` residuals paragraph:

```
Also noted: the sandbox `orderstock` DB is an
ERP-shaped clone containing unrelated ERP tables (e.g. `krs_log`), so `prisma migrate dev`'s
shadow-diff is unusable against it — future schema changes on this sandbox should use a
hand-authored migration file + idempotent sqlcmd ALTER + `prisma generate` instead (see
`database/all-database.md` for the exact pattern this plan used).
```

**Replace** with:

```
Also noted: the sandbox `orderstock` DB was bootstrapped via hand-authored SQL rather than a full
linear migration history, so `prisma migrate dev`'s shadow-diff is unusable against it — future
schema changes on this sandbox should use a hand-authored migration file + idempotent sqlcmd ALTER
+ `prisma generate` instead (see `database/all-database.md` for the exact pattern this plan used).
**Correction, 18-09-26 (erp-dashboards Phase 0):** earlier wording here described this sandbox DB
as "an ERP-shaped clone containing unrelated ERP tables (e.g. `krs_log`)" — that was inaccurate;
this DB has never contained ERP tables. A genuinely ERP-shaped fixture database (`erp_fixture`),
introduced by the `erp-dashboards` program's Phase 1, is a separate, deliberately provisioned
sandbox database and must never be confused with this one.
```

Both edits are single, surgical `Edit` calls (exact-string replacement) — do not rewrite
surrounding paragraphs, do not touch any other sentence in either file, and do not remove the
underlying "shadow-diff is unusable" fact (it remains true and load-bearing for future agents).

### C.3 — `process/context/all-context.md`

Add exactly one new row to the existing "Current Features" table (below the `pguard-redesign` row),
matching the existing table's column shape (`| Feature | Folder | Status |`):

```
| `erp-dashboards` | `process/features/erp-dashboards/` | **IN PROGRESS (started 18-09-26)** — 6-phase program (`erp-dashboards_18-09-26`) adding 3 read-only ERP dashboards (Sales/Purchase/Production) over the customer's shared ERP database `db_TCL`, via a separate guarded `mssql` connection pool (never Prisma). Phase 0 (Prerequisites) in progress. See the umbrella plan for the full charter and hard safety constraints (read-only ERP access, no `sa`/`orderstock_app` login on the ERP pool, money hidden server-side for STAFF). |
```

Also add one line to the "Task Routing Table" (below the existing `order-system` row), matching the
table's existing column shape (`| Task type | Load first | Then load |`):

```
| ERP dashboard / read-only ERP query work | `all-context.md`, `database/all-database.md` | the active phase plan in `process/features/erp-dashboards/active/erp-dashboards_18-09-26/`, plus `erp-dashboards-proposal_REF_18-09-26.md` and `erp-data-dictionary_REF_18-09-26.md` for the tested query patterns |
```

Do not edit the "Scan Metadata" footer or any other section of `all-context.md` in this phase — a
later phase's own UPDATE-PROCESS step updates that footer for its own change.

---

## Implementation Checklist

### Step A — Prod deploy backlog coordination (documentation only, no deploy action)

- [x] A1. Read `process/general-plans/active/orderstock-deploy_08-07-26/orderstock-deploy_PLAN_08-07-26.md`
  and `orderstock-deploy_REPORT_08-07-26.md` (and any sibling `_FEASIBILITY_`/agent-report files in
  that folder) in full. Confirm current status line (`Active — VALIDATED (CONDITIONAL, 0 FAILs) —
  execute-ready` as of this plan's drafting) and read its `## Resume and Execution Handoff` section.
- [x] A2. Run `git log --oneline fe2df61..HEAD | cat` and `git log --oneline fe2df61..HEAD | wc -l`
  to get the exact current commit count and list behind the last known production deployment
  (`fe2df61`, per `orderstock-status-and-inflight` memory). Record the exact count and one-line
  summary of each commit's feature (do not summarize from memory — read the real `git log` output).
- [x] A3. Confirm `db/alter-shop-add-location.sql` has NOT yet been run against `db_TCL` (per
  `process/context/database/all-database.md`'s existing Known Gaps note) — this is the single
  concrete pending DBA-run item blocking a clean deploy.
- [x] A4. Do NOT edit `orderstock-deploy_PLAN_08-07-26.md` or any file in that folder — it is owned
  by a separate, pre-existing plan/program. Phase 0's job is to CITE its current state, not modify
  it.
- [x] A5. Write the coordination note into the erp-dashboards questions doc (Step B) and the phase
  report (Step E): the backlog is "cleared/deferred" in the sense that it is now a tracked,
  owner-noted item — owner = user/customer's ops process (host deploy is USER-RUN, never
  agent-run); the erp-dashboards program does not block on it being deployed, because Phase 0-5 all
  develop against local sandbox/fixture databases, never the live host directly.

### Step B — Write `db/create-erp-readonly-login.sql` (delivery script — NEVER run by an agent)

- [x] B1. Create `db/create-erp-readonly-login.sql` following the exact structural pattern of the
  existing `db/create-database-and-login.sql` (bilingual Thai/English header comment block, a
  top-of-file "DO NOT RUN AGAINST LIVE SERVER without DBA review" warning banner, numbered
  sections, `IF ... IS NULL BEGIN ... END` idempotent guards, `GO` batch separators, a placeholder
  password with an explicit "PLACEHOLDER — do not ship as-is" comment).
- [x] B2. Section 1 — LOGIN: `IF SUSER_ID(N'orderstock_dash') IS NULL BEGIN CREATE LOGIN
  [orderstock_dash] WITH PASSWORD = N'REPLACE_WITH_A_STRONG_PASSWORD', DEFAULT_DATABASE = [db_TCL],
  CHECK_POLICY = ON; END` — use `orderstock_dash` as the login name (matches the umbrella charter's
  named example). Add a comment stating this login must NEVER be the `sa` login or the existing
  `orderstock_app` login (per the umbrella's hard safety constraint) — it is a brand-new, separate,
  read-only-scoped login.
- [x] B3. Section 2 — USER: `USE [db_TCL]; GO IF USER_ID(N'orderstock_dash') IS NULL BEGIN CREATE
  USER [orderstock_dash] FOR LOGIN [orderstock_dash]; END`.
- [x] B4. Section 3 — GRANTS (the actual read-only scoping — this is the security-critical section):
  provide TWO documented options, matching the "least-privilege alternative, commented, pick one"
  pattern already used in `create-database-and-login.sql`'s GRANTS section:
  - **Option A (recommended default, uncommented):** `ALTER ROLE [db_datareader] ADD MEMBER
    [orderstock_dash];` — broad read access to every table in `db_TCL`, including tables the ERP
    read layer never queries. Add a comment noting this is simplest to maintain but broader than
    strictly necessary (it can read every ERP table, not just the ones this program's queries use).
  - **Option B (tighter, commented out, opt-in for the DBA):** an explicit `GRANT SELECT ON
    [dbo].[<TableName>] TO [orderstock_dash];` line for EACH table this program's approved
    architecture actually reads. Enumerate the exact table list by reading
    `erp-dashboards-proposal_REF_18-09-26.md` and `erp-data-dictionary_REF_18-09-26.md` for every
    ERP table named across the Sales/Purchase/Production sections (expected set includes at least:
    `tbl_DOhdr`, `tbl_Dodtl`, `SalesInvoiceHdr`, `PurchaseInvoiceHdr`, `PurchaseOrderHdr`,
    `InventoryFlowDtl`, `InventoryItem`, `tbl_MoHdr`, `tbl_BatchOrder`, `tbl_BatchHdr`,
    `tbl_BatchMRP`, `tbl_BatchPJBal`, `tbl_BatchLot`, `Customer`, `Supplier`,
    `PurchaseReturnHdr`, `SalesReturnHdr` — confirm the complete list against the two REF files
    rather than trusting this list from memory, since Phase 1-4's actual `db/erp-queries/*.sql`
    files will name the definitive final set). Add a comment: "Uncomment this block AND comment out
    Option A above to switch to per-table least-privilege; keep both blocks documented so the DBA
    can choose."
  - Add an explicit comment above both options: "Never grant `db_owner`, `db_datawriter`,
    `EXECUTE`, or any DDL permission to this login, under any circumstance — this login backs a
    read-only dashboard feature, and the application's own boot permission probe (Phase 1) will
    refuse to start if it detects write capability on the connected login."
  - **PLAN-SUPPLEMENT note (research, 18-09-26):** cross-checking the Option B 17-table list
    against Phase 1-4's actual plan text found it is neither the full union of tables those
    phases query, nor a verified-complete superset. Confirmed used but MISSING from the current
    list: `InventoryFlowHdr` (Phase 3, Phase 4), `PurchaseOrderDtl` (Phase 3), `tbl_MoOperDtl`
    (Phase 4), `tbl_CATEGORY` (Phase 2), `tbl_ItemGroup` (Phase 2), `tbl_PoAmend` (Phase 3). Add
    these 6 to Option B's table list when B4 is executed. Flagged as unconfirmed-usage or
    explicitly-avoided (do not remove without DBA confirmation, but do not treat as verified-needed
    either): `tbl_BatchHdr` (0 hits in Phase 1-4 plan text outside this list itself — may be
    extraneous, or intended as `tbl_BatchOrder`/`tbl_BatchLot` family instead), `Customer` and
    `Supplier` (Phase 3 explicitly instructs "do NOT join to a Supplier-name lookup" — display
    `SupplierCode` verbatim — and `CustCode`/`CustName` appear to live directly on header tables
    like `tbl_DOhdr`, not requiring a join to a separate Customer table), `PurchaseReturnHdr`,
    `SalesReturnHdr` (no confirmed reference found in Phase 1-4 plan text as of this research
    pass). Non-blocking: Option A (`db_datareader`, broad) remains the recommended default: add a
    comment in the script noting Option B's list is a best-effort candidate set for the DBA to
    confirm against Phase 1-4's actual `db/erp-queries/*.sql` files at the time Option B is chosen,
    not a verified-complete set as of Phase 0.
- [x] B5. Add a final `PRINT` statement confirming completion, matching
  `create-database-and-login.sql`'s closing `PRINT` line style, naming the login and reminding the
  DBA this is read-only-only.
- [x] B6. Add the same top-of-file "customer's DBA runs this, never an agent" warning banner that
  `db/alter-shop-add-location.sql` uses, adapted for a login-creation script (cite: "this script
  creates a NEW, additive login — it does not touch any existing table, login, or ERP data; it is
  still DBA-run-only per this project's db_TCL guardrails, same as every other delivery script in
  `db/`").
- [x] B7. Do NOT execute this script against any database (sandbox or production) in this phase —
  writing it is the entire deliverable; execution is explicitly USER-RUN (the customer's DBA),
  outside this program's phase loop, gated behind the umbrella's "before any dashboard reaches
  production" hard gate.

### Step C — Correct stale ERP-clone claims (surgical edits)

- [x] C1. Apply the exact replacement from **Data/Correction Details C.1** to
  `process/context/database/all-database.md` via a single `Edit` call (old_string = the exact
  current paragraph text; new_string = the corrected paragraph text given above). Verify with
  `grep -n "erp-dashboards Phase 0" process/context/database/all-database.md` after the edit.
- [x] C2. Apply the exact replacement from **Data/Correction Details C.2** to
  `process/context/tests/all-tests.md` via a single `Edit` call. Verify with
  `grep -n "erp-dashboards Phase 0" process/context/tests/all-tests.md` after the edit.
- [x] C3. Apply the two additions from **Data/Correction Details C.3** to
  `process/context/all-context.md` (Current Features table row + Task Routing Table row) via
  targeted `Edit` calls. Do NOT touch the "Scan Metadata" section or any other part of the file.
- [x] C4. Run `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` after
  all three context edits and confirm exit 0.

### Step D — Write the KRS/customer question list

- [x] D1. Create `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-questions_REF_18-09-26.md`.
  **Correction (VALIDATE, 18-09-26):** the other REF docs in this feature folder
  (`erp-dashboards-proposal_REF_18-09-26.md`, `erp-data-dictionary_REF_18-09-26.md`, etc.) do NOT
  use YAML frontmatter — they use a plain Markdown H1 + `- Date:` / `- Source:` / `- Purpose:`
  bullet header. There is no pre-existing frontmatter convention in this feature folder to "match."
  Use the `vc-context-discovery` references frontmatter schema instead, as a discoverability
  improvement (not because it matches a prior convention): `name: plan:erp-dashboards-questions`,
  `description`, `date: 18-09-26`, `metadata: {node_type: memory, type: references, feature:
  erp-dashboards}` — OR follow the plain-header style of the other REF docs in this folder for
  consistency. Either is acceptable; do not block on this choice.
- [x] D2. Body: a numbered, plain-language (Thai heading + English detail, matching the SPEC's own
  bilingual style) question list covering, at minimum, every item in the SPEC's "Open Questions"
  section (sales-basis permanence, excluded sales-invoice pool disposition, purchase-total default
  framing, PO status workflow source-of-truth, production-actual-output timeline, read-only ERP
  login provisioning timeline) PLUS the deploy-backlog coordination items surfaced in Step A
  (host-deploy scheduling, DBA availability to run `db/alter-shop-add-location.sql` and this
  phase's new `db/create-erp-readonly-login.sql`). For each question: state the question, name the
  owner (user/customer or user/KRS ERP team, per the SPEC), and note that the program does not block
  on an answer (cite the SPEC's own "none require an answer before PLAN begins" framing).
- [x] D3. Do not invent new open questions beyond what the SPEC and Step A already surfaced — this
  document consolidates, it does not expand scope.

### Step E — Confirm the fixture-DB approach (documentation, not implementation)

- [x] E1. In the phase report (Step F), write a `## Fixture Database Approach (confirmed for Phase 1)`
  section stating: (a) database name `erp_fixture`, a SEPARATE database inside the same local
  sandbox SQL Server container (`docker-compose.yml`'s `orderstock-sql` service) used by the
  existing `orderstock` Prisma sandbox DB — same container, different database, so no new Docker
  service is needed; (b) Phase 1 owns creating `db/erp-fixture/*.sql` (DDL + seed) targeting this
  database; (c) the ERP read layer's separate `mssql.ConnectionPool` (Phase 1) points at
  `erp_fixture` in dev/test and would point at the real `db_TCL` (via the dedicated
  `orderstock_dash` login from Step B, once provisioned) in production; (d) this fixture DB is
  NEVER the same connection pool or database as the Prisma `orderstock` sandbox DB — confirming the
  corrected context-doc language from Step C.
- [x] E2. This step does not create `db/erp-fixture/*.sql` or any DDL file — that remains entirely
  Phase 1's owned-paths responsibility per the registry. Phase 0 only records the confirmed
  approach so Phase 1's RESEARCH step can start from a settled decision instead of re-litigating it.

### Step F — Write the phase report and close out

- [x] F1. Write `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_REPORT_18-09-26.md`
  covering: what was done per step (A-E), the exact `git log` commit count/list from A2, the exact
  `grep` verification output from C1/C2, a `## SPEC Gaps` heading (expected: none — Phase 0 has no
  SPEC-testable acceptance criteria of its own; note this explicitly rather than leaving the
  heading unaddressed), and the `## Fixture Database Approach` section from E1.
- [x] F2. Update this phase plan's own `## Phase Loop Progress` checkboxes and `## Resume and
  Execution Handoff` section to reflect completion.
- [ ] F3. Update the umbrella plan's `## Current Execution State` section (overwrite, not append)
  to record Phase 0 complete and the next action (spawn vc-research-agent for Phase 1).
- [ ] F4. Recommend a `vc-git-manager` commit for this phase's changes (delivery script, question
  list, phase report, 3 context-doc edits) before Phase 1 begins, per the umbrella's "commit each
  phase before advancing" hard rule. Keep this commit separate from any unrelated in-flight work.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `grep -n "erp-dashboards Phase 0" process/context/database/all-database.md` exits with ≥1 match | Fully-Automated | N/A — Phase 0 has no SPEC AC of its own; this proves the C.1 correction landed |
| `grep -n "erp-dashboards Phase 0" process/context/tests/all-tests.md` exits with ≥1 match | Fully-Automated | N/A — proves the C.2 correction landed |
| `grep -n "erp-dashboards" process/context/all-context.md` shows both the new Current Features row and Task Routing Table row | Fully-Automated | N/A — proves the C.3 additions landed |
| `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` exits 0 | Fully-Automated | N/A — proves the context edits did not break discovery routing |
| `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` exits 0 | Fully-Automated | N/A — standard regression gate; this phase does not touch agent/skill files, so this should be an unaffected pass |
| `test -f db/create-erp-readonly-login.sql` and manual read confirms: no `db_owner`/`db_datawriter`/`EXECUTE`/DDL grant anywhere in the file, both Option A and Option B grant blocks present, top-of-file DBA-only warning banner present | Hybrid (file-existence is automatable; the "no write-grant anywhere" content check is a manual/agent-probe read since it requires judgment about SQL semantics, not just a grep pattern) | N/A — proves the delivery script never grants write access, directly supporting the umbrella's hard safety constraint on the production ERP login |
| Manual read of `erp-dashboards-questions_REF_18-09-26.md` confirms every SPEC Open Question is represented | Agent-Probe | N/A — judgment call on completeness of the consolidated question list |
| Manual read confirms the phase report's `git log fe2df61..HEAD` commit count matches the real repo state at execution time | Agent-Probe | N/A — the exact count will differ from this plan's drafting-time snapshot (currently ~15 per memory) since more commits may land before EXECUTE runs; the report must record the count AT EXECUTE TIME, not copy this plan's estimate |

**Known gaps (accepted for this phase):** no fully-automated test can verify "the DBA understands
the delivery script" or "the customer answered the question list" — these are inherently
human/ops outcomes tracked in the questions REF doc and the phase report's backlog notes, not gated
behind a test command.

---

## DB-Safety Notes

- This phase never opens a connection to `db_TCL` or any live database. `db/create-erp-readonly-login.sql`
  is authored and reviewed as a text file only.
- This phase never opens a connection to the local sandbox `orderstock` Prisma DB either — no
  schema, seed, or data change of any kind happens in this phase.
- The two context-doc corrections (Step C) are pure Markdown edits — zero code, zero schema, zero
  runtime behavior change.
- Per the umbrella's hard safety constraints: this phase must never (a) run any SQL against
  `db_TCL`, (b) re-run `db/create-database-and-login.sql`, (c) alter `COMPATIBILITY_LEVEL`, or
  (d) propose `sa`/`orderstock_app` for the new read-only login. `db/create-erp-readonly-login.sql`'s
  own content (Step B) is written specifically to make (d) impossible by construction — it creates
  a brand-new login name, never reusing an existing one.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The `git log fe2df61..HEAD` commit count has grown since this plan was drafted (18-09-26) and the "~15 commits" figure in the umbrella is now stale | High (time will have passed by EXECUTE) | Low — informational only | Step A2 explicitly re-derives the real count at EXECUTE time from `git log`, never trusts the plan's drafting-time estimate |
| The exact ERP table list for Option B's per-table `GRANT SELECT` block is incomplete because a later phase's query needs a table not yet named in the current REF docs | Medium | Medium — DBA would need a follow-up grant later if Option B (tighter) is chosen | Comment in the script explicitly says "confirm against Phase 1-4's final `db/erp-queries/*.sql` files"; Option A (broader `db_datareader`) is the recommended default specifically to avoid this trap; either path is documented so the DBA can choose knowingly |
| A future agent misreads "Phase 0 clears the deploy backlog" as license to actually deploy or run migrations against `db_TCL` | Low (explicit scope-out language throughout this plan) | High if misread | This plan states "documents and coordinates only, never deploys" in Purpose, Scope, and Step A explicitly; the umbrella's hard safety constraints are unchanged and still govern |
| Surgical `Edit` calls in Step C fail to match if the exact target strings have drifted since this plan was written (e.g. another agent already touched nearby text) | Low-Medium | Low — Edit tool fails loudly, does not silently corrupt | Step C1/C2 quote the exact current text verbatim (copied from a fresh read at plan-drafting time); if the match fails at EXECUTE time, re-read the file fresh and adapt the edit to the actual current text rather than force it |

---

## Rollback

- Every artifact this phase creates or edits is a documentation/SQL-text file, never executed code
  or a live schema change. Rollback for any Step is `git checkout -- <path>` (or `git revert` after
  commit) — there is no runtime state to unwind.
- `db/create-erp-readonly-login.sql` is inert until a human DBA runs it; rollback (if ever run in
  error) would be a separate hand-authored `DROP USER [orderstock_dash]; DROP LOGIN
  [orderstock_dash];` script — not part of this phase's deliverable, since this phase never runs it.
- Context-doc edits (Step C) are single-paragraph replacements; rollback is reverting the specific
  commit that lands this phase's changes.

---

## Blockers That Would Justify BLOCKED Status

- The exact current text of `process/context/database/all-database.md` or
  `process/context/tests/all-tests.md` has changed enough (beyond the paragraph quoted in C.1/C.2)
  that the surgical edit cannot be applied without risking unrelated content — re-derive the exact
  current text and adapt, do not force a stale match; this alone does not block the whole phase.
- `process/general-plans/active/orderstock-deploy_08-07-26/` no longer exists or has been archived
  to `completed/` by the time this phase executes — if so, read its new location, cite it there
  instead, and note the move in the phase report; this does not block the phase.
- None of the above are expected to actually BLOCK this phase — Phase 0 has no live-system
  dependency and no external approval gate before EXECUTE. If genuinely blocked, document the
  specific reason in the phase report and route per the umbrella's BLOCKED-skipped protocol.

---

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner
loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop — the
umbrella SPEC governs this phase; this phase writes no SPEC of its own).

- [x] 1. RESEARCH — research-agent: read this plan, the umbrella, the registry, the SPEC, and the
  five REF files; re-confirmed the exact current text of the two context-doc paragraphs to correct
  (byte-exact match confirmed); re-confirmed the current `git log fe2df61..HEAD` state (15 commits,
  matching the plan's estimate — no drift); confirmed `orderstock-deploy_08-07-26` still exists at
  its expected path, unmoved. Found one non-blocking supplement item (B4 table-list gap) — see
  Inner Loop Refresh Note below.
- [x] 2. INNOVATE — n/a — mechanical phase, no approach decision needed (research 18-09-26 confirmed
  no genuine open design/architecture choice remains).
- [x] 3. PLAN-SUPPLEMENT — plan-agent applied 2 supplement items (B4 table-list annotation; this
  checkbox-hygiene note) — see Inner Loop Refresh Note below.
- [x] 4. PVL — vc-validate-agent: full V1-V7 re-run this pass (inner-PVL re-validation triggered by
  the same-day Inner Loop Refresh Note per orchestrator instruction) and validate-contract rewritten
  (Status: PASS, generated-by: inner-pvl: phase-0, date 2026-09-18, supersedes the prior outer-pvl
  contract dated the same day) — see `## Validate Contract` below. All findings unchanged from the
  outer-pvl pass; the Step B4 table-list supplement was independently re-verified and found accurate,
  no new gap or CONCERN introduced.
- [x] 5. EXECUTE (done 18-09-26; F3 umbrella rewrite + F4 commit deferred to step 7) — vc-execute-agent: run Steps A-F above in order; per-section test gates (the grep
  and validator commands in Verification Evidence) run immediately after each of Steps C and D, not
  batched to the end
- [x] 6. EVL — orchestrator EVL confirmation run (18-09-26): all 12 Verification Evidence gates
  re-run independently — 10 Fully-Automated/Hybrid rows green, both Agent-Probe rows (question-list
  completeness; real-time commit count = 15) recorded with explicit judgment. `gates_green: true`.
  No fix cycle required. See `phase-00-prerequisites_REPORT_18-09-26.md` §EVL — Independent
  Confirmation Run.
- [x] 7. UPDATE PROCESS — phase report finalized, umbrella `## Current Execution State` rewritten,
  registry Phase 0 entry updated, Tier-1 audits re-run (context-discovery, plan-inventory). Commit
  NOT made by this agent (user has not asked) — commit split recommended in the phase report's
  Closeout Packet item 7. Move-on: spawn vc-research-agent for Phase 1.

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate
Contract` below reads "(placeholder — vc-validate-agent writes this section before EXECUTE)",
orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied /
Execute-agent instructions / Test gates sections is treated as a placeholder.

---

## Inner Loop Refresh Note

**Date:** 18-09-26

**What changed this pass:**
- Step B4 (Option B per-table GRANT SELECT list): added a PLAN-SUPPLEMENT note cross-checking the
  17-table candidate list against Phase 1-4 plan text. 6 tables confirmed used but missing
  (`InventoryFlowHdr`, `PurchaseOrderDtl`, `tbl_MoOperDtl`, `tbl_CATEGORY`, `tbl_ItemGroup`,
  `tbl_PoAmend`) — flagged for execute-agent to add. 5 tables flagged as unconfirmed-usage or
  explicitly-avoided (`tbl_BatchHdr`, `Customer`, `Supplier`, `PurchaseReturnHdr`,
  `SalesReturnHdr`) — not removed, just annotated as best-effort, DBA-confirm-at-choice-time.
  Non-blocking: Option A remains the recommended default, so this does not change AC-P0-1..12 or
  the Validate Contract's Section B feasibility finding.
- Phase Loop Progress checkbox hygiene: Steps 1-3 ticked (RESEARCH complete, INNOVATE marked n/a,
  PLAN-SUPPLEMENT items applied); Step 4 (PVL) checkbox ticked to match the already-existing PASS
  validate-contract (content was complete and dated today — this was a bookkeeping-only fix, no
  contract content changed).

**Does this require PVL re-run?** No new AC, no new gate, no scope change, no blast-radius change —
the B4 annotation is additive documentation inside an existing Touchpoint file, and the checkbox
fix has zero content impact. The existing PASS validate-contract (dated 2026-09-18, same day)
remains current. Orchestrator/V1 should treat this note as informational, not a re-validate
trigger, per the "does this add a new AC, gate, or blast-radius item" test.

---

## Blast Radius

Files created or edited by this phase (mirrors Touchpoints above; owner rules per
`phase-blast-radius-registry.md`):

- `db/create-erp-readonly-login.sql` (new)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/erp-dashboards-questions_REF_18-09-26.md` (new)
- `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_REPORT_18-09-26.md` (new)
- `process/context/database/all-database.md` (surgical edit — one paragraph)
- `process/context/tests/all-tests.md` (surgical edit — one paragraph)
- `process/context/all-context.md` (two additive edits — Current Features row, Task Routing Table row)

No application source file (`src/**`, `prisma/**`, `e2e/**`) is touched by this phase.

---

## Acceptance Criteria

This phase carries no SPEC acceptance criterion of its own (the umbrella SPEC's 18 ACs are all
scoped to Phases 1-5's dashboard behavior). Phase 0's own done-criteria are:

1. `db/create-erp-readonly-login.sql` exists, follows the existing delivery-script pattern, and
   contains no write/DDL grant anywhere in the file (verified by manual read, per Verification
   Evidence below).
2. `erp-dashboards-questions_REF_18-09-26.md` exists and represents every SPEC Open Question plus
   the Step A deploy-coordination items.
3. Both context-doc corrections (C.1, C.2) are applied and verified via `grep`.
4. `process/context/all-context.md`'s Current Features table and Task Routing Table each contain
   the new erp-dashboards row.
5. The phase report is written, including the confirmed Fixture Database Approach section and the
   real (not estimated) `git log fe2df61..HEAD` commit count.
6. `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` and
   `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` both exit 0.

---

## Phase Completion Rules

- **CODE DONE**: Steps A-F implementation checklist items are all checked, the delivery script and
  question-list files exist, both context-doc corrections are applied, and the phase report is
  drafted — but the Fully-Automated/Hybrid gates in Verification Evidence have not yet all been
  independently re-run (EVL not yet done).
- **✅ VERIFIED**: requires CODE DONE PLUS: all Fully-Automated gates in Verification Evidence pass
  under an independent EVL confirmation run (not just execute-agent's own claim), the Hybrid gate
  (manual read of `db/create-erp-readonly-login.sql` confirming no write grant) is recorded, and
  both Agent-Probe rows (question-list completeness, real-time commit count) are recorded with
  explicit judgment notes in the phase report. Do not mark VERIFIED on code-completion alone — this
  phase has no live-system risk, but the same evidence discipline as every other phase in this
  program still applies.
- This phase can never reach VERIFIED while the delivery script contains a write/DDL grant, or while
  either context-doc paragraph still contains the original inaccurate "ERP-shaped clone" wording.

---

## Test Infra Improvement Notes

(none identified yet)

---

## Public Contracts

- None. This phase touches no application code, no API, no schema, no auth surface. The only
  "contract" is documentation accuracy — the two corrected context-doc paragraphs must remain
  truthful for future agents reading them, and the new `db/create-erp-readonly-login.sql` must never
  grant write access under any circumstance.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_PLAN_18-09-26.md`
- Last completed step: Step 7 (UPDATE PROCESS, 18-09-26) — phase report finalized:
  `phase-00-prerequisites_REPORT_18-09-26.md`. Prior: Step 6 (EVL, 18-09-26) — 12/12 gates PASS.
  Prior: Step 5 (EXECUTE, 18-09-26). Prior: Step 4 (PVL) — Gate: PASS, generated-by: inner-pvl:
  phase-0 (18-09-26).
- Phase status: **✅ VERIFIED at agent level** (all gates green under independent EVL). USER-RUN
  items (host deploy, DBA login provisioning, `db/alter-shop-add-location.sql` run, customer
  question answers) remain pending — see the report's USER-RUN Checklist. These do not block
  Phase 1.
- Validate-contract status: PASS (inner-pvl: phase-0, 18-09-26)
- Next step: Phase 0 is closed out. Spawn vc-research-agent for Phase 1
  (`phase-01-erp-read-foundation_PLAN_18-09-26.md`), Step 1 of that phase's own inner loop.
- A fresh agent resuming Phase 1 should: read the umbrella's `## Current Execution State`, read this
  Phase 0 report in full (especially the `## Fixture Database Approach` section and the USER-RUN
  checklist), then begin Phase 1 RESEARCH.

---

## Validate Contract

Status: PASS
Date: 18-09-26
date: 2026-09-18
generated-by: inner-pvl: phase-0
supersedes: 2026-09-18 (outer-pvl) — inner PVL has current evidence

Parallel strategy: sequential
Rationale: 0/7 signals present (single-file-class documentation phase, no schema/API/auth surface,
no new dependency/agent/runtime surface, single owner — Phase 0 executes as one sequential
vc-execute-agent pass, not a fan-out). Unchanged from the outer-pvl pass — the PLAN-SUPPLEMENT
(Step 3, B4 table-list annotation) is additive documentation inside an existing owned file and does
not change the blast radius, package count, or risk class.

Plan updates applied this cycle: none. The one substantive change since the outer-pvl contract
(Step B4's PLAN-SUPPLEMENT: 6 confirmed-missing ERP table names added to Option B's candidate list,
5 tables flagged unconfirmed-usage/explicitly-avoided) was already applied by vc-plan-agent in the
prior PLAN-SUPPLEMENT step (Step 3), before this VALIDATE pass began — see `## Inner Loop Refresh
Note` above. This VALIDATE pass independently re-verified that supplement's claims (see Section B
finding below) rather than re-applying it.

Test gates (C3 5-column table — unchanged from the outer-pvl contract; no AC added, removed, or
altered by the Step B4 supplement, since it only annotates a table candidate list inside an
already-owned Touchpoint file):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-P0-1 | `db/create-erp-readonly-login.sql` exists on disk | Fully-Automated | `test -f db/create-erp-readonly-login.sql` | A |
| AC-P0-2 | Delivery script never grants write/DDL access (`db_owner`/`db_datawriter`/`EXECUTE`/`CREATE`/`ALTER TABLE`/`ALTER DATABASE`) to the new login | Agent-Probe | Manual line-by-line read of `db/create-erp-readonly-login.sql` by execute-agent/vc-tester confirming the only active (non-comment) grant statements are `ALTER ROLE [db_datareader] ADD MEMBER [...]` (Option A) or per-table `GRANT SELECT` (Option B, commented) — a naive `grep -i db_owner` is UNRELIABLE here because the script is required (per B4/B6) to contain the literal words "db_owner"/"db_datawriter"/"EXECUTE" inside its own warning comments, so any automated grep would false-positive on the required warning text itself; judgment is genuinely required to distinguish an active GRANT/ALTER ROLE statement from a comment naming a forbidden term | A |
| AC-P0-3 | Delivery script uses a brand-new login name (`orderstock_dash`), never `sa` or `orderstock_app` | Fully-Automated | `grep -c "orderstock_dash" db/create-erp-readonly-login.sql` returns ≥1 AND `grep -cE "CREATE LOGIN \[(sa\|orderstock_app)\]" db/create-erp-readonly-login.sql` returns 0 | A |
| AC-P0-4 | `process/context/database/all-database.md` stale "ERP-shaped clone" claim corrected | Fully-Automated | `grep -n "erp-dashboards Phase 0" process/context/database/all-database.md` exits with ≥1 match | A |
| AC-P0-5 | `process/context/tests/all-tests.md` stale "ERP-shaped clone" claim corrected | Fully-Automated | `grep -n "erp-dashboards Phase 0" process/context/tests/all-tests.md` exits with ≥1 match | A |
| AC-P0-6 | Corrected paragraphs preserve the true "shadow-diff unusable" fact (no silent fact-deletion) | Fully-Automated | `grep -c "shadow-diff is unusable" process/context/database/all-database.md process/context/tests/all-tests.md` each returns ≥1 | A |
| AC-P0-7 | `process/context/all-context.md` gains the new Current Features row + Task Routing Table row | Fully-Automated | `grep -c "erp-dashboards" process/context/all-context.md` returns ≥2 (one per table) | A |
| AC-P0-8 | Context edits do not break discovery routing | Fully-Automated | `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` exits 0 | A |
| AC-P0-9 | Agent/skill harness unaffected (regression gate; this phase touches no agent/skill file) | Fully-Automated | `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` exits 0 | A |
| AC-P0-10 | Plan artifact stays structurally valid after Phase 0's own edits | Fully-Automated | `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs process/features/erp-dashboards/active/erp-dashboards_18-09-26/phase-00-prerequisites_PLAN_18-09-26.md` — expect 0 failures (pre-existing 3 warnings re: legacy plan-shape notes are informational, not blocking) | A |
| AC-P0-11 | `erp-dashboards-questions_REF_18-09-26.md` represents every SPEC Open Question | Agent-Probe | Manual read confirming all 6 SPEC Open Questions (sales-basis permanence, excluded-invoice-pool disposition, purchase-total default framing, PO-status workflow source-of-truth, production-actual timeline, read-only-login provisioning timeline) plus the Step A deploy-coordination items are represented | A |
| AC-P0-12 | Phase report records the REAL (not plan-drafting-time-estimated) `git log fe2df61..HEAD` commit count | Agent-Probe | Manual comparison of phase report's stated count against a fresh `git log --oneline fe2df61..HEAD \| wc -l` run at EXECUTE time | A |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

Legacy line form (retained so existing validate-contract consumers still parse):
- Delivery script (`db/create-erp-readonly-login.sql`): Fully-automated: `test -f db/create-erp-readonly-login.sql` | Agent-probe: manual read confirming no active write/DDL grant statement anywhere in the file (grep is unreliable — required warning comments contain the same forbidden keywords by design)
- Context-doc corrections (`all-database.md`/`all-tests.md`/`all-context.md`): Fully-automated: `grep -n "erp-dashboards Phase 0"` on each corrected file + `grep -c "erp-dashboards" process/context/all-context.md` (≥2) + `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs`
- Regression: Fully-automated: `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs`
- Question-list completeness / real-time commit count: Agent-probe: manual read against the SPEC's Open Questions section and a fresh `git log` run

Dimension findings:
- Infra fit: PASS — zero runtime/container/port/env surface touched; re-confirmed this pass: `docker-compose.yml`'s `orderstock-sql` service is untouched, no new port/env surface introduced by the Step B4 supplement (it only edits a candidate table-name list inside plan text, not any runtime file).
- Test coverage: PASS — waterfall correctly applied; the one high-risk class present ("permission, secret, or trust-boundary logic" — the new login/grant script) carries at minimum a Hybrid-equivalent gate (file-existence Fully-Automated + content-judgment Agent-Probe), satisfying the High-Risk Class minimum-tier rule. No developed behavior rests on Known-Gap alone (vacuous-green check re-run clear) — every AC-P0-N row above still has a Fully-Automated or Agent-Probe proving test; no AC was added or removed by the Step B4 supplement.
- Breaking changes: PASS — no schema/API/auth/public-contract surface touched; re-verified this pass via fresh `grep`: both C.1 (`all-database.md` line 411) and C.2 (`all-tests.md` line 161) target paragraphs still match the plan's quoted "current text" byte-exact — no drift since the outer-pvl pass.
- Security surface: PASS — STRIDE findings unchanged from the outer-pvl pass (no Spoofing/Tampering/Repudiation/DoS surface added; Information Disclosure is a documented, bounded tradeoff between Option A/B; Elevation of Privilege foreclosed by construction — new login name, no write/DDL grant). The Step B4 supplement does not change this: it only edits which table names appear in the ALREADY-commented, ALREADY-optional Option B block: adding table names to a disabled block cannot itself grant new access.
- Section A (prod deploy backlog coordination) feasibility: PASS — re-independently-verified this pass: `orderstock-deploy_PLAN_08-07-26.md`'s status line still reads byte-exact "Active — VALIDATED (CONDITIONAL, 0 FAILs) — execute-ready"; `git log --oneline fe2df61..HEAD | wc -l` re-run during this inner-PVL pass and returned 15 — still matching the plan's stated estimate exactly, no drift as of 18-09-26. No gaps, no conflicts.
- Section B (`db/create-erp-readonly-login.sql`) feasibility: PASS — the Step B4 PLAN-SUPPLEMENT's cross-check was independently re-verified this pass via targeted `grep -l` scans of Phase 1-4 plan files: all 6 tables flagged as "confirmed used but missing" (`InventoryFlowHdr`, `PurchaseOrderDtl`, `tbl_MoOperDtl`, `tbl_CATEGORY`, `tbl_ItemGroup`, `tbl_PoAmend`) do appear in at least one Phase 1-4 plan file, confirming the supplement's claim is accurate — not invented. Of the 5 tables flagged "unconfirmed-usage or explicitly-avoided," 4 (`tbl_BatchHdr`, `Customer`, `PurchaseReturnHdr`, `SalesReturnHdr`) showed zero hits in Phase 1-4 plan text (consistent with the supplement's own framing), and 1 (`Supplier`) showed exactly one hit — consistent with the supplement's own caveat that Phase 3 explicitly avoids a Supplier-name join but the bare table name can still appear in surrounding prose; this is not a contradiction of the supplement's claim, since the supplement already flagged Supplier as "unconfirmed-usage," not "zero-usage." No new gap found. Highest-risk edit in the whole plan remains this file — mitigation (never-run-by-agent constraint, brand-new login name, explicit banned-grant comment, dual Option A/B pattern) is unchanged and sufficient.
- Section C (context-doc corrections) feasibility: PASS — both C.1 and C.2's quoted "current text" re-verified BYTE-EXACT against the live files this pass (see Breaking changes finding above). No gaps, no conflicts.
- Section D (question list) feasibility: PASS — unchanged from the outer-pvl pass; D1's frontmatter-instruction fix (applied at the outer-pvl pass) remains in the plan text, verified present via `grep -n "Correction (VALIDATE"`.
- Section E (fixture-DB approach) feasibility: PASS — unchanged from the outer-pvl pass; `docker-compose.yml`'s `orderstock-sql` container name re-confirmed present.
- Section F (report/closeout) feasibility: PASS — unchanged from the outer-pvl pass; no gaps, no conflicts.

Regression re-run this pass (both exit 0, unaffected by the Step B4 supplement):
- `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs` — exit 0, 0 failures.
- `node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs` — exit 0, 0 failures, 0 warnings.
- `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>` — exit 0, 0 failures, 3 pre-existing informational warnings (legacy-plan-shape notes), matching AC-P0-10's stated expectation.

Open gaps: none blocking. Two items remain explicit, plan-accepted Known Gaps, unchanged from the
outer-pvl pass (carried forward as known-gap, not CONCERN):
- DBA/customer comprehension of the delivery script and question list, and actual customer answers
  to the question list — inherently human/ops outcomes, tracked in the questions REF doc and phase
  report backlog notes, never gated behind a test command: known-gap: documented as tracked
  ops/customer-response item (not a NEW PLAN REQUIRED item — this is expected, ordinary phase
  residue, not a scope gap).
- The exact `git log fe2df61..HEAD` commit count may still drift between this inner-PVL pass (15,
  re-confirmed 18-09-26) and actual EXECUTE time — the plan's own Risk table and Step A2 already
  require re-deriving the real count at EXECUTE time rather than trusting any cached figure:
  known-gap: self-resolving by the plan's own design, not a defect.

What this coverage does NOT prove:
- AC-P0-1/AC-P0-3 (Fully-Automated) prove the file exists and never reuses `sa`/`orderstock_app` —
  they do NOT prove the SQL is syntactically valid T-SQL (no automated syntax check exists for a
  script this project deliberately never executes; a human DBA's own SSMS/sqlcmd parse is the only
  real syntax gate, and it happens outside this program entirely, at DBA-run time).
- AC-P0-2 (Agent-Probe) proves no ACTIVE write/DDL grant statement is present at VALIDATE/EXECUTE
  review time — it does NOT prove the script will still be correct if a future phase or human hand-
  edits it later without re-running this same manual check (no CI gate re-runs this check
  automatically on every future commit; this is accepted because the registry marks this file as
  "Phase 0 owned, never re-touched by later phases").
- AC-P0-4/AC-P0-5/AC-P0-6 (Fully-Automated grep checks) prove the correction TEXT landed and the
  "shadow-diff unusable" fact wasn't deleted — they do NOT prove the corrected paragraph reads
  grammatically well or is free of an unrelated typo (that is exactly what AC-P0-11-style Agent-
  Probe judgment would catch, but this program does not run a dedicated Agent-Probe pass over the
  two context-doc paragraphs beyond the grep checks; low risk given the exact text was authored and
  verified byte-for-byte during both the outer-pvl and this inner-pvl pass).
- AC-P0-8/AC-P0-9/AC-P0-10 (regression validators) prove the harness/plan-artifact structure is not
  broken by Phase 0's edits — they do NOT prove Phase 1+ will actually find the corrected context
  accurate or sufficient; that is Phase 1's own RESEARCH step's job, per the umbrella's Per-Phase
  Loop.
- AC-P0-11/AC-P0-12 (Agent-Probe) are judgment calls recorded by whichever agent performs EVL — they
  do NOT provide a deterministic pass/fail signal reproducible by a different reviewer with 100%
  certainty; this is the inherent, accepted limit of the Agent-Probe tier per
  `vc-test-coverage-plan`, not a Phase-0-specific gap.
- This inner-pvl pass does NOT prove the Step B4 supplement's table list is exhaustively complete
  for Phase 1-4's FINAL query set — the supplement itself, and this re-verification, are both
  best-effort cross-checks against the CURRENT Phase 1-4 plan text (18-09-26); the plan's own B4
  text already instructs the DBA/execute-agent to confirm the final list against Phase 1-4's actual
  `db/erp-queries/*.sql` files at the time Option B is actually chosen, not to trust either this or
  the outer-pvl pass's snapshot as final.

Gate: PASS (no FAILs, no new CONCERNs; re-validation of an existing PASS after a same-day,
non-scope-changing PLAN-SUPPLEMENT — see Inner Loop Refresh Note)
Accepted by: N/A — Gate is PASS; no CONDITIONAL concerns required user/session acceptance.
