---
name: note:phase-05-residuals
description: "erp-dashboards Phase 5 — minor residuals: CSV spreadsheet-rendering fidelity check, export scope on Sales's custom breakdown tables, and the .env.example ERP entries"
date: 22-09-26
metadata:
  node_type: memory
  type: note
  feature: erp-dashboards
  phase: post-program
---

# Backlog: Phase 5 minor residuals

**Priority:** LOW — none block program completion or production go-live on their own.

1. **CSV spreadsheet-rendering fidelity.** The exported CSVs are byte-verified (BOM, CRLF, RFC 4180
   quoting, Thai headers) but never opened in a real Excel/Google Sheets session. USER-RUN: open
   one exported file from each dashboard in the customer's actual spreadsheet app and confirm Thai
   glyphs render correctly.
2. **Export scope excludes Sales's custom breakdown tables.** The six `DashboardDataTable`
   call-site tables (each dashboard's main list + line/detail drilldown) have export buttons. Sales's
   product/customer breakdown cards are custom components, not `DashboardDataTable` instances, and
   have no export button — this matches the plan's stated scope ("each dashboard's main + line/
   detail tables"), but if "every table on all three dashboards" was intended more broadly, this is
   a small follow-up: add `exportHref` wiring (or a new derived-target helper) to those two custom
   components.
3. **`.env.example` never gained the ERP entries** (`ERP_DATABASE_URL` + the optional
   `ERP_ALLOW_WRITE_CAPABLE_LOGIN`/`ERP_TEST_FORCE_DOWN` flags) — the repo's privacy hook blocks
   agent access to `.env*` files. USER-RUN: add these to `.env.example` by hand.
4. **Fixture data is a hand-built approximation of `db_TCL`'s real schema, not a mirror.** The
   seed-idempotency gate proves both seed run orders succeed against the FIXTURE's own schema; it
   cannot prove the live schema matches either seed's column assumptions. Only the live reconcile
   (see the dedicated DBA-login/live-reconcile note) will surface real divergence.
5. **Cross-bundle cache-expiry lesson (recorded for future reference, no action needed):** an
   attempt during Phase 5 to build a shared cache-expiry helper reachable from outside each route's
   own module was rejected — in a production build, each route bundle owns its own in-memory cache
   `Map`, so an external call cannot reach another bundle's cache. Any future cross-route in-memory
   state need must account for this; `force-down.ts`'s in-memory flag works because `guardedQuery`
   itself (not the cache) checks it, and `guardedQuery` is shared code every bundle imports fresh.
