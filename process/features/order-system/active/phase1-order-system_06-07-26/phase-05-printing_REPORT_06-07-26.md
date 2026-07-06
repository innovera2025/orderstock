---
phase: phase-05-printing
date: 2026-07-06
status: COMPLETE
feature: order-system
plan: process/features/order-system/active/phase1-order-system_06-07-26/phase-05-printing_PLAN_06-07-26.md
---

# Phase 05 — Printing — Execution Report (DRAFT for EVL)

**TL;DR:** All A/B/C/E checklist items implemented. New print routes (`/print/daily/[date]`,
`/print/shops/[date]`) render the scan-faithful A4-landscape form at true mm from a NEW
snapshot-only fetch (`getSheetForPrint`). vitest 41/41 (incl. 2 new print-page requireAuth gates),
build ✓, lint ✓, playwright 16/16 (9 regression + 7 new print gates G1–G8). Agent-probe visual =
GO (faithful; one header-legibility caveat). Server-side PDF fallback deferred to backlog per
decision 6. Two accepted known-gaps unchanged (Q30 shading OFF; Q22 weight values blank). One
documented within-blast-radius deviation: a `(main)` route group added to structurally exclude the
nav from `/print` (URLs unchanged). Status: COMPLETE (code-done; awaiting independent EVL re-run).

## What Was Done

**Step A — shared fetch + auth + no-nav layout**
- `src/lib/get-sheet-for-print.ts` — NEW `getSheetForPrint(date, location?)`. Reads ONLY the
  snapshot columns (`shopNameAtEntry`/`variantNameAtEntry`) — never the live `/orders/[id]` names.
  Daily returns all 29 roster slots incl. blank gaps; per-shop filters this in memory. Column
  headers use `variantNameAtEntry` when ≥1 OrderLine exists for that printOrder, else live name
  (E1b). Totals via `totals.ts`. Footer note-tally aggregates NoteLines + standing reminder lines.
- `src/app/print/layout.tsx` — dedicated NO-NAV layout for `/print`; imports `print.css`.
- Both print pages call `requireAuth()` explicitly (E1a) and map `AuthError → redirect("/login")`
  (E1c graceful in-page redirect; proxy.ts is the first-line matcher).

**Step B — mm print layout**
- `src/app/print/print-table.tsx` — pure server render of one form: 24-physical-column table
  (2 lead + 20 data + 2 หมายเหตุ) via an explicit mm `<colgroup>` emitted by the ROUTE (E2);
  3-tier header; **totals row = LAST tbody row (never `<tfoot>`)**; footer tally + weight block.
- `src/components/sheet-header.tsx` — EXTENDED additively (E2): optional `subLabel` (3rd tier),
  per-column `className` (the heavy สินค้า/เครื่องปรุง C18/C19 seam, inherited by the group cell),
  and `trailingColSpan` (หมายเหตุ spans text + qty strip). All default-OFF → the Phase-04 orders
  grid renders byte-identically (proven by the unchanged orders D1/D2 e2e + 41/41 unit).
- `src/styles/print.css` — `@page { size: A4 landscape; margin: 8mm }`, mm column widths
  (7.1/28.8/9.8×16/6.8×4/23.8/8.9 = 252.6mm), dotted interior + solid outer/band borders, heavy
  seam, `thead{table-header-group}`/`tr{break-inside:avoid}`, on-screen preview at 297mm. Semantic
  fills (header cream / totals salmon / footer green) prepared as an ADDITIVE, COMMENTED-OUT layer
  (decision 1; OFF until Q30). Sarabun inherited from the global body font.

**Step C — per-shop + fallback disposition**
- `src/app/print/shops/[date]/page.tsx` — one `.sheet { break-after: page }` per selected shop
  (single print job); `?slots=` selects roster slots, else every shop that ordered. Per-shop totals
  recomputed from that shop's cells.
- `src/app/print/print-controls.tsx` — on-screen พิมพ์ button + Thai dialog-settings hint (hidden
  in `@media print`).
- C2: server-side PDF DEFERRED — `process/features/order-system/backlog/print-pdf-fallback_NOTE_06-07-26.md`
  written with escalation triggers. Gate uses a TEST-SIDE `page.pdf()` only.
- `src/app/(main)/orders/[id]/page.tsx` — EXTENDED with พิมพ์รวมทั้งวัน / พิมพ์แยกร้าน links.

**Step E — PVL-supplement items:** E1 (header name source, E1b) ✓; E2 (colgroup in route,
sheet-header additive-only) ✓; E3 (print e2e self-seeds on a dedicated date+location) ✓; E4
(snapshot-render isolation + RESTORE-in-finally) ✓; E5 (weight labels blank-not-zero) ✓; E6
(auth-guard page-grep + unauth→/login e2e) ✓.

**Backlog:** `print-pdf-fallback_NOTE`, `print-shading-q30_NOTE` written (weight-factors_NOTE pre-exists).

## What Was Skipped or Deferred

- **Server-side `/api/print/**` PDF route + `next.config.ts` serverExternalPackages** — deferred to
  backlog (decision 6; no confirmed escalation trigger). Chromium PDF pipeline proven via test-side
  `page.pdf()` (G7).
- **Q30 shading fills** — border-only default shipped; additive CSS layer prepared and OFF.
- **Q22 weight values** — รวมน้ำหนัก/ปี๊บ labels render in position, values BLANK (never fabricated 0).

## Test Gate Outcomes

| Gate | Command | Result | Key lines |
|---|---|---|---|
| G6 print-page requireAuth | `pnpm test` | PASS | 41/41; 2 new print-page grep gates green |
| Full unit suite (regression) | `pnpm test` | PASS | 41/41 (was 39; +2) |
| Lint | `pnpm lint` | PASS | 0 errors, 0 warnings |
| Build | `pnpm build` | PASS | /print/daily/[date], /print/shops/[date] emitted; all prior URLs unchanged |
| G1 colgroup 24 + data 20 | `playwright print.spec` | PASS | col=24, data-col=20, tier2 th=20 |
| G2 29 rows + 3 tiers + 446 | `playwright print.spec` | PASS | rows=29, thead tr=3, pgrand=446, ptotal 4/8/2/17=137/82/99/38, ptotal-1 blank |
| G3 @page A4 landscape | `playwright print.spec` | PASS | CSSPageRule contains a4+landscape |
| G4 snapshot-render | `playwright print.spec` | PASS | rename live shop → print shows original snapshot; renamed absent; restored in finally |
| G5 per-shop .sheet + break | `playwright print.spec` | PASS | .sheet=3 for slots=1,2,3; break-after=page |
| G7 test-side page.pdf | `playwright print.spec` | PASS | %PDF- magic bytes, >1KB, preferCSSPageSize |
| G8 unauth → /login | `playwright print.spec` | PASS | logged-out /print/daily redirects to /login |
| Full E2E (regression) | `pnpm exec playwright test` | PASS | 16/16 (9 prior incl. auth + orders D1/D2 + 7 new) |
| G9 visual vs scan | agent-probe screenshot | GO (with caveat) | `harness/phase-05/daily-print-a4.png` |

**Agent-probe (G9) observations:** the rendered daily sheet matches the scan structure — 3-tier
header, สินค้า/เครื่องปรุง groups with the heavy C18/C19 seam, 29 rows with blank gaps, totals row
`99 14 137 21 39 4 82 2 … 38 10` with **446** in the หมายเหตุ cell (exact match), footer tally lists
+ standing reminders, and รวมน้ำหนัก/ปี๊บ labels with BLANK values. Thai tone marks shape correctly
(Sarabun/HarfBuzz). **Caveat:** at the narrow 6.8–9.8mm data-column widths some Thai header names
visually truncate on screen; on paper at 7.5pt this is expected to be legible but is an on-site
test-print risk already flagged in the plan. No shading (border-only default) per decision 1.

## Plan Deviations

1. **`(main)` route group added for structural no-nav on `/print` (within-blast-radius).** The plan's
   blast radius listed only `src/app/print/layout.tsx` for the no-nav layout, but a nested layout
   cannot remove a parent layout's `<Nav/>`. The idiomatic Next.js fix is a route group: moved
   `page.tsx`, `db-status.tsx`, `orders/`, `shops/`, `products/`, `admin/` into `src/app/(main)/`
   (which renders `<Nav/>`), and removed `<Nav/>` from root `src/app/layout.tsx`. **Route groups add
   NO URL segment** — every existing URL is unchanged (verified: build route table + all 9 prior
   e2e green). This is structural exclusion, not `@media print` CSS hiding (plan requirement). It
   touches the SHARED `src/app/layout.tsx` and relocates prior-phase route folders, but changes NO
   route logic and NO auth boundary (`proxy.ts` and `requireAuth` untouched). Not a hard-stop class
   (no auth/schema/API/container behavior change). Documented; continued under consent.
2. **`auth-guard-coverage.test.ts` MODULES paths updated to `src/app/(main)/…`** — required
   consequence of deviation 1 (the action files moved with their route folders). Behavior identical.
3. **3rd-tier `subLabel` sourced from `PRINT_VARIANTS` pack-size/flavor** (tier 2 keeps the
   snapshot/live full name per E1b). This is a rendering choice to produce a genuine 3-tier header;
   within blast radius, no gate affected.

No hard-stop-class deviations. No auth/billing/schema/public-API/container/secret changes.

## Test Infra Gaps Found

- None new. The self-seeding print spec (E3) + restore-in-finally isolation (E4) keep the shared
  workers:1 sandbox clean. Recommended future hardening: a Playwright A4-viewport screenshot
  BASELINE for visual-regression (currently agent-probe only) — see plan "Test Infra Improvement Notes".

## Closeout Packet

- **Selected plan:** `process/features/order-system/active/phase1-order-system_06-07-26/phase-05-printing_PLAN_06-07-26.md`
- **Finished:** all A/B/C/E items; snapshot-only print fetch; mm A4 form matching the scan (incl. 446
  totals row + heavy seam + 3-tier header); per-shop pagination; explicit requireAuth + unauth
  redirect; weight labels blank-not-zero; server PDF deferred to backlog with note.
- **Verified:** all fully-automated + hybrid gates green locally (unit + build + lint + 16 e2e) +
  agent-probe visual GO. **Unverified until EVL:** independent re-run by vc-tester; real-printer mm
  fidelity (on-site); customer answers to Q30/Q22.
- **Cleanup remaining:** none in code; sandbox `orderstock-sql` left running; seeded print rows are
  removed in `afterAll`/`finally`; no git commit (per instruction).
- **Best next state:** `Keep in active/testing` → hand to EVL (vc-tester) to independently re-run the
  validate-contract gates, then UPDATE PROCESS.

## Forward Preview

### Test Infra Found
- Self-seeding-via-prisma + restore-in-finally is the reusable isolation pattern for any spec that
  mutates shared master data (mirrors Phase-04 D2). Phase 06 specs can reuse it.
- Test-side `page.pdf({preferCSSPageSize:true})` after `document.fonts.ready` is the proven Chromium
  PDF gate shape if the server-side fallback is ever adopted.

### Blast Radius Changes
- New: `src/app/print/**` (layout, daily, shops, print-table, print-controls),
  `src/lib/get-sheet-for-print.ts`, `src/styles/print.css`, `src/app/(main)/layout.tsx`,
  `e2e/print.spec.ts`, 2 backlog notes.
- Moved: `page.tsx`,`db-status.tsx`,`orders/`,`shops/`,`products/`,`admin/` → `src/app/(main)/`.
- Extended: `src/components/sheet-header.tsx` (additive props), root `src/app/layout.tsx` (Nav
  removed), `src/app/(main)/orders/[id]/page.tsx` (print links),
  `src/lib/__tests__/auth-guard-coverage.test.ts` ((main) paths + print-page grep).

### Commands to Stay Green
```bash
pnpm test                         # 41/41
pnpm build && pnpm lint           # ✓
pnpm exec playwright test         # 16/16 (sandbox up + seeded; webServer auto-starts pnpm start)
```

### Dependency Changes
- None. No new npm dependencies; no schema migration; no next.config change (PDF fallback deferred).

## Follow-up stubs created
- `process/features/order-system/backlog/print-pdf-fallback_NOTE_06-07-26.md` — server-side PDF route (deferred; escalation triggers listed).
- `process/features/order-system/backlog/print-shading-q30_NOTE_06-07-26.md` — semantic fills gated on customer Q30 (additive CSS ready).
- (pre-existing) `process/features/order-system/backlog/weight-factors_NOTE_06-07-26.md` — Q22 weight factors (values blank until then).

## CONTEXT_PARTIAL items
- None.

---

## EVL HANDOFF SUMMARY (vc-tester independent re-run — 2026-07-06)

Independent EVL confirmation sweep (exact validate-contract gates, NOT diff-aware). Prior
execute-agent evidence treated as unconfirmed and re-run unconditionally. **Every gate green
independently.**

**Gate table (independent vs claimed):**

| Gate | Command / Strategy | Claimed | Independent observed | Status |
|---|---|---|---|---|
| vitest | `pnpm test` | 41/41 | 41 passed (10 files) | PASS |
| lint | `pnpm lint` | clean | 0 errors 0 warnings | PASS |
| build | `pnpm build` | URLs unchanged | route table: all prior URLs unchanged (no `(main)` segment) + 2 new `/print` routes | PASS |
| playwright | `pnpm exec playwright test` | 16/16 | 16 passed (9 regression + G1–G8) | PASS |
| migrate status | `npx prisma migrate status` | — | 3 migrations, schema up to date | PASS |
| G1 colgroup | Fully-Automated | 24+20 | col=24, data=20 | PASS |
| G2 rows/totals | Fully-Automated | 29+446 | 29 rows, 3-tier, totals-last-tbody, 446 | PASS |
| G3 @page | Fully-Automated | A4 landscape | rule present | PASS |
| G4 snapshot | Fully-Automated | old-snapshot + restore | old name shown; DB has 0 `RENAMED` shops post-run (restore genuine) | PASS |
| G5 per-shop | Fully-Automated | .sheet==shops | count + break-after page | PASS |
| G6 print-page auth | Fully-Automated | requireAuth grep | asserts `(main)/` modules + print pages | PASS |
| G7 test-side pdf | Hybrid | valid A4 PDF | %PDF magic + A4 landscape | PASS |
| G8 unauth redirect | Hybrid | /print → /login | logged-out redirect | PASS |
| G9 visual | Agent-Probe | GO | screenshot re-reviewed: 3-tier, 29 rows w/ gaps, totals 99/14/137/21/39/4/82/2…38/10…446 exact, weight labels BLANK, no nav chrome | GO |

**Route-group deviation audit (highest priority) — PASS:**
- URL preservation: build route table proves `/`, `/admin/users`, `/orders`, `/orders/[id]`,
  `/products`(+`/[id]/edit`,`/new`), `/shops`(+`/[id]/edit`,`/new`), `/login`, `/api/health` are
  ALL unchanged — no `(main)` segment leaks into any URL. Route groups add no URL segment (verified).
- proxy.ts matcher still guards everything except `login|api/auth|api/health|_next|fonts|static` —
  `/print/**` guarded (G8 runtime unauth→/login green), `/api/health` public.
- `auth-guard-coverage.test.ts` genuinely re-points MODULES to `src/app/(main)/…` AND greps the print
  pages under `src/app/print/…` (E6 not silently dropped). Orders D1/D2 + auth role-gating regression
  all green under the move — no route logic or auth boundary changed.

**Print probes — PASS:** colgroup 24, 29 rows + totals-last-tbody (446), Thai renders, no nav chrome
(agent-probe DOM + screenshot); per-shop `.sheet`/break-after (G5); weight footer labels present with
BLANK values (not "0"); G4 snapshot restore-in-finally verified against live DB (0 pollution).

**Regression — PASS:** migrate status clean; fonts woff2 present (6 Sarabun); secret-leak 2/2;
master-data counts stable (25 shops / 28 variants / 2 users); health route present (covered indirectly
by the live-server e2e run). Unrelated Docker containers (9) untouched; `.env` gitignored.

**Verified decision: ✅ VERIFIED.** All validate-contract gates independently green; route-group
deviation preserves every URL and the auth boundary; DB unpolluted. Only remaining items are documented
known-gaps (Q30 shading, Q22 weight values — external customer questions) and on-site real-printer mm
fidelity — the plan classifies these as delivery-time known-gaps, NOT promotion blockers.

```yaml
gates_green: [vitest-41, lint, build, playwright-16, migrate-status, G1, G2, G3, G4, G5, G6, G7, G8, G9-probe]
known_gaps: [Q30-shading-values, Q22-weight-values, on-site-printer-mm-fidelity]
follow_up_stubs: [print-pdf-fallback_NOTE, print-shading-q30_NOTE, weight-factors_NOTE]
context_partial: []
preliminary_packet_path: process/features/order-system/active/phase1-order-system_06-07-26/phase-05-printing_REPORT_06-07-26.md
closeout_classification: WITH_GAPS
```

