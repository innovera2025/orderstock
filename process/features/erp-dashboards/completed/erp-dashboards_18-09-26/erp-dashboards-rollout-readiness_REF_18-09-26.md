---
name: reference:erp-dashboards-rollout-readiness
description: "ERP Dashboards — production rollout readiness checklist: what remains before the dashboards can be enabled for real customer use, split into USER-RUN/ops items and agent-actionable items"
date: 22-09-26
metadata:
  node_type: memory
  type: references
  feature: erp-dashboards
  phase: phase-05
---

# ERP Dashboards — Production Rollout Readiness

**Written by:** Phase 5 (Hardening, Export & Rollout), Step I1
**Program:** erp-dashboards
**Umbrella:** `erp-dashboards-umbrella_PLAN_18-09-26.md`
**Status of this checklist:** current as of 22-09-26

---

## TL;DR

The code is complete and green against the local `erp_fixture` sandbox. **One item hard-gates
go-live: the scoped read-only ERP login does not exist yet.** Everything else on this list is
either done, or a verification step a human performs after deployment.

Nothing on this list is agent-actionable against `db_TCL`. By program charter, every action that
touches the customer's live database is performed by a human (DBA or ops).

---

## 1. HARD GATE — must be closed before go-live

| # | Item | Owner | Status |
|---|---|---|---|
| 1.1 | DBA runs `db/create-erp-readonly-login.sql` on the customer's SQL Server to create the scoped, SELECT-only ERP login | Customer DBA | ⛔ **NOT DONE** — blocks go-live |
| 1.2 | `ERP_DATABASE_URL` in the host `.env` is repointed at that read-only login | Ops | ⛔ blocked by 1.1 |
| 1.3 | `ERP_ALLOW_WRITE_CAPABLE_LOGIN` is REMOVED from the host `.env` | Ops | ⛔ blocked by 1.2 |
| 1.4 | `/api/health/erp` reports `"readOnlyLogin": true` and the boot log carries no write-capable warning | Ops | ⛔ blocked by 1.3 |

**Why this gates go-live.** Until 1.1–1.4 are done, the ERP connection runs on a login that still
holds INSERT/UPDATE/DELETE/ALTER/CREATE permission on the customer's live ERP database. The
application's own read-only guard is fully in force (single `guardedQuery` choke point, SELECT/WITH
only, 19-rule denylist, parameterized requests, `ApplicationIntent=ReadOnly`, compile-time
no-write-method guard) — but **database-level** write protection is not. That is an explicitly
recorded, temporary, user-approved exception, not the intended end state.

Procedure: `docs/deployment-guide-docker.md` §12.2 and §12.3.

---

## 2. USER-RUN / ops items (not agent-actionable, by charter)

| # | Item | Owner | Status |
|---|---|---|---|
| 2.1 | Run the manual live reconcile against real `db_TCL` and record the output | Ops / analyst | ⚪ pending — script delivered, never run |
| 2.2 | Compare the reconcile output against the ERP's own printed reports (`sp_PurchaseInvoiceMonth`, `sp_Popending`, the MO listing) and sign off | Business owner | ⚪ pending, depends on 2.1 |
| 2.3 | Open an exported CSV in the customer's actual Excel/Google Sheets and confirm Thai renders correctly | Ops | ⚪ pending — headless tests assert the bytes, not the spreadsheet rendering |
| 2.4 | Confirm a real STAFF user sees no money anywhere (screen and CSV) on the deployed instance | Business owner | ⚪ pending |
| 2.5 | Confirm `ERP_TEST_FORCE_DOWN` is NOT set on the production host | Ops | ⚪ pending — it is only ever set when running the test suite |
| 2.6 | Add `ERP_DATABASE_URL` (and the optional ERP flags) to `.env.example` | Ops / maintainer | ⚪ **not done by Phase 5** — the repo's privacy hook blocks agent access to `.env*` files; must be added by a human |

**How to run 2.1** — read-only, refuses to run without explicit consent, never reads `.env`:

```bash
ERP_RECONCILE_CONFIRM=1 \
ERP_DATABASE_URL='sqlserver://HOST:1433;database=db_TCL;user=USER;password=PASS;encrypt=true;trustServerCertificate=true' \
pnpm tsx scripts/erp-reconcile.ts --from 2026-08-01 --to 2026-09-30 \
  --expect-purchase-invoice <from sp_PurchaseInvoiceMonth> \
  --expect-purchase-po      <from the PO listing>
```

A non-zero difference is **not automatically a defect** — the Sales dashboard deliberately excludes
a wider invoice pool and discloses it on screen. Read the difference against each dashboard's own
disclosure note before concluding anything.

---

## 3. Done — delivered and verified against the fixture sandbox

| # | Item | Evidence |
|---|---|---|
| 3.1 | Read-only ERP layer: single `guardedQuery` choke point, 19-rule SELECT-only denylist, boot permission probe, compile-time no-write-method guard, `ApplicationIntent=ReadOnly`, separate connection pool | Phase 1 report; `pnpm test -- erp-adapter` |
| 3.2 | Three dashboards (`/dashboards/sales`, `/dashboards/purchase`, `/dashboards/production`) | Phase 2/3/4 reports |
| 3.3 | Money visibility gated server-side on every screen AND every export, all three dashboards | `pnpm test -- dashboards-money-audit`; `e2e/dashboards-export.spec.ts` |
| 3.4 | CSV export on all six dashboard tables — UTF-8 BOM, Thai headers, BE dates, 5,000-row cap with a visible truncation notice, ASCII filename, STAFF files carry no money column | `e2e/dashboards-export.spec.ts`; bytes inspected by hand for all six role/dashboard combinations |
| 3.5 | Graceful degrade: all three dashboards serve last-known-good data behind "ข้อมูลอาจไม่ล่าสุด" under a forced outage, never an error or blank page | `e2e/dashboards-degraded-mode.spec.ts` |
| 3.6 | Pilot banner "ข้อมูลนำร่อง" present on every dashboard and drilldown, both roles | `e2e/dashboards-degraded-mode.spec.ts` |
| 3.7 | No shipped ERP query contains a write/DDL keyword; every one passes the real runtime guard | `pnpm test -- dashboards-money-audit` (AC17 sweep over all 13 files) |
| 3.8 | Fixture seeds apply cleanly in either order, twice | `pnpm test -- erp-fixture-seed-idempotency` |
| 3.9 | Manual live-reconcile script written, with refusal gates and run instructions | `src/lib/erp/live-reconcile-script.ts`; `scripts/erp-reconcile.ts`; guide §12.6 |
| 3.10 | Deployment documentation for the ERP dashboards | `docs/deployment-guide-docker.md` §12 |

---

## 4. Known gaps carried into production (accepted, documented)

| # | Gap | Why it is accepted | Closes when |
|---|---|---|---|
| 4.1 | The boot permission probe has never been exercised against the REAL scoped read-only login | The login does not exist yet. Simulating one would prove nothing about the real server's actual permission grants. The probe's LOGIC is fully proven by unit tests and in fixture mode. | Item 1.1 is done — then the probe runs for real on first boot |
| 4.2 | No live reconcile has ever been run against `db_TCL` | Agents are forbidden from touching the live database; this is USER-RUN by design, and the SPEC explicitly rules out an automated reconciliation job | Item 2.1 is done |
| 4.3 | CSV rendering fidelity inside a real spreadsheet app is untested | Not reproducible in a headless run. The tests assert the BOM bytes and the Thai header content, which is what determines the rendering. | Item 2.3 is done |
| 4.4 | Fixture data is a hand-built approximation of the live schema, not a mirror | It is a sandbox by design; the live schema is read-only to this project | Item 2.1 surfaces any real divergence |
| 4.5 | No phone entry point into the dashboards | SPEC Out Of Scope: no 4th bottom-tab-bar entry. The dashboards remain reachable on a phone by URL and render responsively. | A future scope decision |
| 4.6 | App-wide white-on-green button contrast is ~3.0:1 | A cross-cutting accessibility concern affecting the whole app, not this program's surface | A dedicated accessibility pass |

---

## 5. Hard safety constraints — compliance statement

Cross-referenced against the umbrella plan's Hard Safety Constraints:

| Constraint | Complied? | Evidence |
|---|---|---|
| The ERP is READ-ONLY — SELECT/WITH only, through `guardedQuery` | ✅ | AC17 sweep: all 13 shipped queries pass the real guard; no write/DDL keyword anywhere in `db/erp-queries/**` |
| Never Prisma / `$queryRaw` against ERP tables | ✅ | Asserted mechanically for every ERP module including the new export route |
| No ERP models in `prisma/schema.prisma` | ✅ | Unchanged this phase |
| Never write to `db_TCL` | ✅ | Nothing in this program can write; the reconcile script cannot call a procedure either (EXEC is on the denylist) |
| Never run the DBA login script from an agent session | ✅ | Not run; delivered as a script for the DBA (item 1.1) |
| Local sandbox only for tests | ✅ | Every automated gate runs against `erp_fixture`; throwaway databases are created and dropped inside the local container |
| Money gated server-side to ADMIN, on screen AND in exports | ✅ | Cross-dashboard audit + export e2e + hand-inspected bytes |
| Never sum quantities across units | ✅ | Every quantity column in every export ships with its own unit column |
| No chart dependency | ✅ | No dependency added by this phase at all (`package.json` untouched) |
| Buddhist-era dates | ✅ | Every date cell in every export renders through `ceToBeDisplay()`; asserted by both the unit and e2e gates |

---

## 6. Recommended go-live sequence

1. DBA runs `db/create-erp-readonly-login.sql` (item 1.1).
2. Ops repoints `ERP_DATABASE_URL`, removes `ERP_ALLOW_WRITE_CAPABLE_LOGIN`, restarts (1.2–1.3).
3. Ops confirms `/api/health/erp` reports `"readOnlyLogin": true` (1.4).
4. Analyst runs the manual reconcile and compares against the ERP's own reports (2.1–2.2).
5. Business owner signs off on the numbers, the STAFF money gate, and the CSV in Excel (2.3–2.4).
6. Only then announce the dashboards to end users. The "ข้อมูลนำร่อง" pilot banner stays until the
   business owner decides the pilot is over — removing it is a separate, deliberate decision.
