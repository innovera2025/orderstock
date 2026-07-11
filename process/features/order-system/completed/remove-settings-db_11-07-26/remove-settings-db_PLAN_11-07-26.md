---
name: plan:remove-settings-db
description: "Remove the runtime /settings/db DB-connection-switcher page (500s in prod Docker — non-root can't write root-owned dotenv file); DB changes become edit dotenv file + docker restart"
date: 11-07-26
feature: order-system
---

# Remove /settings/db Runtime DB-Connection Page — Plan

Complexity: **SIMPLE** (deletion-only; no schema, no new surface, no runtime behavior change to
the surviving app — `resolve-database-url.ts` already independently reads the env file at boot).

**Date**: 11-07-26
**Status**: ✅ VERIFIED (11-07-26) — code-complete, committed (`cc52c90`). Gates re-confirmed at
UPDATE PROCESS: `pnpm test` → 70/70 green; `grep -rn "settings/db|connection-string|env-write|
phase06-roundtrip" src/ e2e/ scripts/` → zero matches. E2E (30 excl. `[setup]`), lint, and build
were confirmed green in the EXECUTE/EVL session per the commit message; not independently re-run
at UPDATE PROCESS (documentation-only closeout, no sandbox DB brought up this session). Archived
to `process/features/order-system/completed/`.

**Context loaded:** `process/context/all-context.md` (root router) →
`process/context/auth/all-auth.md`, `process/context/database/all-database.md`,
`process/development-protocols/plan-lifecycle.md`, `implementation-standards.md`.

## Overview

The Phase-06 `/settings/db` page let an ADMIN change the DB connection URL at runtime via a form
(fields → build connection string → test-connect → rewrite the env file → restart-to-apply). In the
production Docker deploy the app container runs as a **non-root** user, and the env file is a
**root-owned bind-mount** — the page's write step 500s because the container cannot write that
file. The user has decided this feature is not worth working around: **remove the page entirely**.
Future DB connection changes will be a manual ops action: edit `/opt/orderstock/.env` on the host,
then `docker restart` (or restart the Windows service in the non-Docker path). This is safe because
`src/lib/resolve-database-url.ts` (the actual value the app boots with) is a small, independent,
raw-file reader that does not depend on the page in any way — it already re-reads the env file
fresh on every process start.

## Goals

1. Delete the `/settings/db` route, its server action, its form component, and its dedicated test file.
2. Delete the two libraries that existed ONLY to serve that page: `connection-string.ts` and `env-write.ts` (plus their test files).
3. Delete the now-dead gate script `scripts/phase06-roundtrip-gate.ts` (it only exercised those two libs).
4. Delete `e2e/settings.spec.ts` (all 3 tests are `/settings/db` route-protection probes).
5. Repoint the one sidebar nav item that pointed at `/settings/db` to the surviving `/settings` (establishment/display) page — do not remove the nav item.
6. Update deployment docs so "change the DB connection" is documented as an env-file-edit + restart ops procedure, not an in-app flow.
7. Refresh the small set of context docs that still reference the Phase-06 settings page as a live surface.
8. Leave `resolve-database-url.ts`, `db.ts`, `prisma.config.ts`, and the surviving `/settings` establishment page completely untouched — confirm this explicitly at EXECUTE and EVL.

## Non-Goals

- No schema change, no migration, no DB touch of any kind.
- No change to how the app resolves the DB connection URL at boot (`resolve-database-url.ts` stays exactly as-is other than one comment-wording tweak — see Touchpoints).
- No change to the surviving `/settings` (establishment/display) page, its actions, or `app-settings.ts`.
- No change to `auth.config.ts` route-gating rules — `/settings/*` stays ADMIN-only as a prefix match; only `/settings/db` itself disappears as a route.
- Not adding any new "how do I change the DB" in-app UI. The replacement is a documented manual ops step only.

## Research Findings (verified this session — grep-confirmed, do not re-derive)

**Files to DELETE (verified exclusive to the settings/db surface — no other importers found):**

| File | Notes |
|---|---|
| `src/app/(main)/settings/db/page.tsx` | route entry |
| `src/app/(main)/settings/db/actions.ts` | server action (validate → test-connect → write env file) |
| `src/app/(main)/settings/db/db-settings-form.tsx` | client form |
| `src/app/(main)/settings/db/__tests__/settings-secret-hygiene.test.ts` | 5 tests |
| `src/lib/connection-string.ts` | fields→JDBC builder + validator + masker |
| `src/lib/__tests__/connection-string.test.ts` | 14 tests |
| `src/lib/env-write.ts` | safe env-file rewrite helper |
| `src/lib/__tests__/env-write.test.ts` | 11 tests |
| `scripts/phase06-roundtrip-gate.ts` | Hybrid gate script; only imported `connection-string.ts` + `env-write.ts` — dead once those are gone |
| `e2e/settings.spec.ts` | 3 tests — all `/settings/db` unauth/STAFF/ADMIN route probes |

After deleting the `db/` route folder, if `src/app/(main)/settings/db/__tests__/` becomes an empty
directory it is removed along with its parent (standard `rm -r` of the `db/` folder handles this —
no separate step needed).

**Files that STAY untouched (verified independent — zero import relationship to the deleted set):**

| File | Why it stays |
|---|---|
| `src/lib/resolve-database-url.ts` | Independent raw env-file reader used by `db.ts` AND `prisma.config.ts`. Grep-confirmed: no import of `connection-string.ts` or `env-write.ts`. **One comment-wording note**: its file-header comment mentions "a `/settings/db` restart-apply" as the historical reason the `$`-literal bug existed — reword to describe the manual env-edit + restart flow instead, since the mechanism (raw non-expanding read) and the reason it matters (values may contain `$`) are unchanged and still true for the manual flow. This is a comment-only edit, zero behavior change. |
| `src/lib/db.ts` | Imports only `resolveDatabaseUrl` — untouched. |
| `prisma.config.ts` | Imports only `resolveDatabaseUrl` — untouched. |
| `src/app/(main)/settings/page.tsx` + `settings-panels.tsx` + `actions.ts` + `src/lib/app-settings.ts` | Sibling establishment/display settings page — zero import relationship to `db/**`. |
| `src/auth.config.ts` | Gates `/settings` (prefix) for ADMIN — still correctly protects the surviving `/settings` route after `/settings/db` is deleted. No edit needed. |
| `src/lib/auth-guard.ts`, `src/proxy.ts` | Unrelated. |

**Nav item to repoint (not delete):** `src/app/nav-links.tsx` line ~41:
```
items: [{ href: "/settings/db", label: "ตั้งค่าระบบ", icon: Settings, adminOnly: true }],
```
→ change `href: "/settings/db"` to `href: "/settings"`. Keep `label`, `icon`, `adminOnly` unchanged.

**Expected test-count deltas (grep-verified this session):**
- Unit (Vitest): current baseline **99 tests / 17 files** → **70** after removal (−29 = −14 connection-string, −7 env-write, −5 settings-secret-hygiene, −3 auth-guard-coverage `settings/db` assertions removed from `MODULES`/`ADMIN_MODULES`).
- E2E (Playwright): current baseline **33** → **30** after removal (−3, all in `e2e/settings.spec.ts`).

## Touchpoints

| File | Action |
|---|---|
| `src/app/(main)/settings/db/` (whole folder: page.tsx, actions.ts, db-settings-form.tsx, `__tests__/settings-secret-hygiene.test.ts`) | DELETE |
| `src/lib/connection-string.ts` | DELETE |
| `src/lib/__tests__/connection-string.test.ts` | DELETE |
| `src/lib/env-write.ts` | DELETE |
| `src/lib/__tests__/env-write.test.ts` | DELETE |
| `scripts/phase06-roundtrip-gate.ts` | DELETE |
| `e2e/settings.spec.ts` | DELETE |
| `src/app/nav-links.tsx` | EDIT — repoint one `href` from `/settings/db` to `/settings` |
| `src/lib/resolve-database-url.ts` | EDIT — header comment wording only (mentions of "/settings/db restart-apply" → "manual env-edit + restart"); zero code/behavior change |
| `docs/deployment-guide-docker.md` | EDIT — replace the in-app DB-connection-change section with an env-edit + `docker restart` ops procedure |
| `docs/deployment-guide.md` | EDIT — replace §8 "เปลี่ยนการเชื่อมต่อฐานข้อมูลผ่านหน้าแอป" (lines ~145-153) with a manual env-edit + NSSM-restart procedure; fix the forward-reference at line ~80 ("ดูข้อ 8"); reword the NSSM rationale at lines ~118-133 (auto-restart-on-DB-settings-save framing → auto-restart-on-crash/reboot only, drop the "if not using NSSM, click 'Save and restart'" fallback note at line ~133); reword the lockout-recovery troubleshooting row at line ~182 (references "บันทึกการตั้งค่าฐานข้อมูลผิด" — saving wrong DB settings via the app — no longer possible; reword to a manual env-typo scenario) — **6 distinct references grep-confirmed (V1 re-validate finding), not just the one section named originally** |
| `process/context/all-context.md` | EDIT — remove/adjust the Phase-06 `/settings/db` references in the repo tree and Task Routing sections (leave `resolve-database-url.ts` mentions intact) |
| `process/context/database/all-database.md` | EDIT — check for and adjust any `/settings/db` runtime-switcher references |
| `process/context/auth/all-auth.md` | EDIT — check for and adjust any auth-gating references specific to `/settings/db` (the general `/settings` ADMIN-gate note stays) |
| `process/context/tests/all-tests.md` | EDIT — update test counts/inventory (99→70 unit, 33/34→30 e2e) and remove the deleted test files from any file inventory list |
| `src/lib/__tests__/auth-guard-coverage.test.ts` | EDIT (mandatory — FAIL 1) — remove the `src/app/(main)/settings/db/actions.ts` entry from both the `MODULES` array (~line 48) and the `ADMIN_MODULES` array (~line 56); delete the dedicated `it("settings page ... calls requireAuth(ADMIN)")` test block (~lines 105-114) that `readFileSync`s the deleted `settings/db/page.tsx`. Without this edit `pnpm test` ENOENT-crashes on the deleted files. (V1 re-validate: `readFileSync`/`resolve` imports remain used by 5 other assertions in this file after the deleted block is removed — no unused-import risk.) |
| `src/lib/db.ts:14` | EDIT (comment-only — FAIL 2) — reword the comment mentioning `/settings/db restart-apply` to describe the manual env-edit + restart flow. Zero behavior change; needed so the AC#8 grep gate stays zero-match. |
| `src/lib/resolve-database-url.ts` lines 11, 20, 52 | EDIT (comment-only — FAIL 2, in addition to the header-comment reword already listed above) — these 3 lines mention `env-write.ts` by name; reword to remove the dangling reference while preserving meaning. Zero behavior change. |
| `src/app/(main)/settings/settings-panels.tsx` (~lines 107-123) | EDIT (mandatory — FAIL 3) — remove the live "การเชื่อมต่อฐานข้อมูล" card that renders `<Link href="/settings/db">` with button "เปิดการตั้งค่า"; after deletion this card would be a dead 404 link advertised in the UI. **Also remove the now-unused `import Link from "next/link";` (line 4) — grep-confirmed this card is the file's ONLY `Link` usage; leaving the dangling import fails the lint gate (AC#6, V1 re-validate finding).** |
| `src/app/(main)/settings/page.tsx:6` and `src/app/(main)/settings/actions.ts:9` | EDIT (comment-only — FAIL 3) — reword sibling comments describing `/settings/db` as a live sibling route, since it is now removed. |
| `process/context/uxui/all-uxui.md` | EDIT — check for and adjust any UI/nav references to the `/settings/db` form specifically (the sidebar item repoint should be noted) |

Context-doc edits marked above are listed here for completeness; execute-agent should apply the
code-adjacent ones (all-context.md, database, auth, tests, uxui) directly since they are mechanical
and small. Note `all-context.md` alone has roughly 9 lines of `/settings/db` references spread
across 5 sections (repo tree, Task Routing Table, Current Features, Environment/Config note, and
the order-system feature summary) — execute-agent should grep the whole file for `settings/db`
rather than relying on the single repo-tree line named in Touchpoints. UPDATE PROCESS phase owns
the final holistic context-doc reconciliation pass (any residual/missed references) afterward.

## Public Contracts

None exposed or changed. This plan removes a UI route and its server action — no API contract,
no schema, no external integration surface. The only "contract" that changes is the sidebar nav
target for one Thai label ("ตั้งค่าระบบ"), which now points to `/settings` instead of `/settings/db`.

## Blast Radius

**In scope (files listed above only).** Explicitly OUT of blast radius and must remain byte-for-byte
unchanged (verify via `git diff --stat` at EVL):
- `src/lib/resolve-database-url.ts` (comment-only touch, noted above — verify via diff that only the header comment block changed, no code lines)
- `src/lib/db.ts`, `prisma.config.ts`
- `src/app/(main)/settings/page.tsx`, `settings-panels.tsx`, `actions.ts`, `src/lib/app-settings.ts`
- `src/auth.config.ts`, `src/lib/auth-guard.ts`, `src/proxy.ts`
- All order-entry, print, summary, history surfaces
- The `ordersheet-soft-delete` feature (schema, actions, UI) — completed 11-07-26, must show zero diff
- No schema/migration files touched, no `prisma/schema.prisma` edit, no prod DB interaction

## Implementation Checklist

1. Delete `src/app/(main)/settings/db/` (recursive — includes `page.tsx`, `actions.ts`, `db-settings-form.tsx`, `__tests__/settings-secret-hygiene.test.ts`).
2. Delete `src/lib/connection-string.ts` and `src/lib/__tests__/connection-string.test.ts`.
3. Delete `src/lib/env-write.ts` and `src/lib/__tests__/env-write.test.ts`.
4. Delete `scripts/phase06-roundtrip-gate.ts`.
5. Delete `e2e/settings.spec.ts`.
6. Edit `src/app/nav-links.tsx`: change the `/settings/db` menu item's `href` to `/settings` (keep label/icon/adminOnly).
7. Edit `src/lib/resolve-database-url.ts`: reword the header comment's "/settings/db restart-apply" phrasing to describe the manual env-edit + restart flow. No functional code change — diff must show comment lines only.
8. Run the grep gate (see Verification Evidence #4) to confirm zero dangling references to the deleted modules anywhere in `src/`, `e2e/`, `scripts/`.
9. **(FAIL 1, mandatory)** Edit `src/lib/__tests__/auth-guard-coverage.test.ts`: remove the `src/app/(main)/settings/db/actions.ts` entry from both `MODULES` (~line 48) and `ADMIN_MODULES` (~line 56); delete the `it("settings page ... calls requireAuth(ADMIN)")` test block (~lines 105-114). Without this `pnpm test` ENOENT-crashes on the deleted files.
10. **(FAIL 2, mandatory)** Reword comment-only references to the deleted modules: `src/lib/db.ts:14` (`/settings/db restart-apply` mention) and `src/lib/resolve-database-url.ts` lines 11, 20, 52 (`env-write.ts` mentions) — zero code/behavior change, needed for AC#8 grep gate to return zero matches.
11. **(FAIL 3, mandatory)** Edit `src/app/(main)/settings/settings-panels.tsx` (~lines 107-123): remove the "การเชื่อมต่อฐานข้อมูล" card + `<Link href="/settings/db">` + "เปิดการตั้งค่า" button block. Also remove the now-unused `import Link from "next/link";` (line 4 — grep-confirmed the deleted card is its only usage; leaving it dangling fails `pnpm lint`). Reword the sibling comments in `src/app/(main)/settings/page.tsx:6` and `src/app/(main)/settings/actions.ts:9` that describe `/settings/db` as a live sibling.
12. Edit `docs/deployment-guide-docker.md`: replace the section describing changing the DB connection via the app UI with: edit the DB connection URL in `/opt/orderstock/.env` on the host, then `docker restart orderstock-app-1` (the bind-mounted env file is picked up on the next boot by `resolve-database-url.ts`).
13. **(widened — V1 re-validate finding)** Edit `docs/deployment-guide.md` (6 distinct DB-settings-page references, not just one section): replace §8 "เปลี่ยนการเชื่อมต่อฐานข้อมูลผ่านหน้าแอป" (lines ~145-153) with the manual env-edit + NSSM-restart procedure; fix the §4 forward-reference at line ~80 ("ดูข้อ 8"); reword the §6 NSSM installation rationale at lines ~118-133 — it currently frames NSSM's value around auto-restart-after-DB-settings-save, which no longer exists; reframe around auto-restart-on-crash/reboot only, and drop the "if not using NSSM, click 'Save and restart'" fallback note at line ~133; reword the troubleshooting/lockout-recovery row at line ~182 (currently references saving wrong DB settings via the app — reword to a manual env-typo / restore-from-backup-file scenario). Re-read the full file after editing to confirm no remaining forward/backward references to the removed section.
14. Edit `process/context/all-context.md`: remove `/settings/db` from the repo-tree listing under `settings/` (keep the surviving `/settings` establishment page description); adjust the "Task Routing Table" / feature summary language that currently describes `/settings/db` as a live Phase-06 surface (describe it as removed, DB config now via env-edit + restart).
15. Edit `process/context/database/all-database.md`: adjust any text describing the runtime DB-connection-switcher UI as a still-live feature.
16. Edit `process/context/auth/all-auth.md`: adjust any text specifically calling out `/settings/db` as an ADMIN-gated route (the general `/settings` ADMIN prefix-gate note is unaffected and stays).
17. Edit `process/context/tests/all-tests.md`: update the unit test count (99→70) and file inventory (remove the 3 deleted test files), update e2e count (33/34→30) and spec file list (remove `settings.spec.ts`).
18. Edit `process/context/uxui/all-uxui.md`: adjust any nav/shell description that names `/settings/db` specifically; note the nav-link repoint to `/settings`.
19. Run full test gate suite (see Verification Evidence) and confirm the new floors (70 unit / 30 e2e / lint clean / build clean).

## Dependencies

None external. Sequential-safe — steps 1–8 (delete + grep gate) must complete before steps 9–16
(docs) begin only in the sense that the grep gate confirms nothing else references the deleted
files; docs edits have no code dependency and could technically run in parallel, but doing deletes
first keeps the grep gate meaningful.

## Risks

| Risk | Mitigation |
|---|---|
| Missed importer of `connection-string.ts`/`env-write.ts` outside the delete set | Grep gate (Verification Evidence #4) run AFTER deletion, before declaring done; `pnpm build` (TypeScript) will also hard-fail on any dangling import |
| Nav-link repoint breaks the ADMIN-only gate | No — `auth.config.ts` gates on the `/settings` path PREFIX, `/settings` itself is already a valid ADMIN-protected route (same auth check served the establishment panel already) |
| Docs left inconsistent (some sections still describe the old UI flow) | Explicit per-file docs edits listed in Touchpoints/Checklist (widened at V1 re-validate to cover all 6 grep-confirmed reference points in `deployment-guide.md`, not just the primary section); verify via the widened Verification Evidence grep pattern across `docs/` after edit |
| Test-count floor drift (someone reverts a delete but not its test) | Verification Evidence #1 pins exact expected count (70 unit / 30 e2e), not just "test pass" |
| Unused `Link` import left in `settings-panels.tsx` after card removal fails lint | Explicit checklist item 11 sub-instruction (V1 re-validate finding, grep-confirmed the card is the file's only `Link` usage) |

## Acceptance Criteria

1. `/settings/db` route no longer exists (404 / route not found) and its server action, form component, and dedicated test file are deleted.
2. `src/lib/connection-string.ts` and `src/lib/env-write.ts` (and their test files) are deleted, with zero remaining importers anywhere in the repo.
3. `scripts/phase06-roundtrip-gate.ts` and `e2e/settings.spec.ts` are deleted.
4. Sidebar nav item "ตั้งค่าระบบ" now links to `/settings` (not `/settings/db`) and remains ADMIN-only.
5. `resolve-database-url.ts`, `db.ts`, `prisma.config.ts`, and the surviving `/settings` establishment page show zero functional diff (comment-only touch on `resolve-database-url.ts` permitted).
6. `pnpm test` reports exactly 70 passing tests; `pnpm exec playwright test` reports exactly 30 passing tests EXCLUDING the `[setup]` project (i.e. 30 spec-level tests in the `chromium`/`mobile` projects; the real current baseline is 34 tests total incl. `[setup]` / 33 excl. `[setup]`, so post-removal is 31 incl. `[setup]` / 30 excl. `[setup]` — always count and report using the excl.-`[setup]` convention); `pnpm lint` and `pnpm build` are clean.
7. `docs/deployment-guide-docker.md` and `docs/deployment-guide.md` document the manual env-edit + restart procedure in place of the removed in-app flow, including all cross-references (not just the primary changed section).
8. The grep gate (`settings/db|connection-string|env-write|phase06-roundtrip`) across `src/ e2e/ scripts/` returns zero matches.

## Phase Completion Rules

- This is a single SIMPLE plan (no phase program) — "done" means all 8 Acceptance Criteria above are met and the Verification Evidence table gates are all green.
- Do not mark this plan `VERIFIED` until the EVL confirmation run (independent vc-tester re-run of the exact gate commands) is green — an execute-agent's internal claim of "tests pass" is not sufficient per the EVL gate rule.
- Code-complete but not yet gate-verified status is `CODE DONE`, not `VERIFIED`.

## Validate Contract

Status: PASS
Date: 11-07-26
date: 2026-07-11
generated-by: outer-pvl
supersedes: 11-07-26 (outer-pvl) — outer PVL has current evidence (PVL supplement cycle 2: prior pass BLOCKED on 3 FAILs, all 3 confirmed resolved this cycle; 2 additional gaps found and fixed in plan text this cycle — see Dimension findings)

Parallel strategy: sequential
Rationale: single SIMPLE deletion-only plan, single package, blast radius confined to one Next.js app; re-verification performed directly via targeted grep/read probes rather than a multi-agent fan-out (Simple Mode — self-contained plan, <5 blast-radius packages, no container/infra surface)

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC6-unit | Unit suite drops to exactly 70 tests after deletions + auth-guard-coverage edit, 0 fail | Fully-Automated | `pnpm test` | A |
| AC6-lint | No unused-import/dead-code errors from deletions (incl. the `Link` import in settings-panels.tsx) | Fully-Automated | `pnpm lint` | A |
| AC6-build | TypeScript resolves cleanly; catches any missed reference to a deleted file | Fully-Automated | `pnpm build` | A |
| AC6-e2e | E2E suite drops to exactly 30 tests (excl. `[setup]`) after `e2e/settings.spec.ts` deletion, 0 fail | Hybrid | `pnpm exec playwright test` — precondition: sandbox env-file swap per existing procedure, never touch 43.229.134.162 | A |
| AC8-grep | Zero dangling references to deleted modules in src/e2e/scripts | Fully-Automated | `grep -rn "settings/db\|connection-string\|env-write\|phase06-roundtrip" src/ e2e/ scripts/` | A |
| AC7-docs | Deployment docs fully updated incl. cross-references (widened this cycle) | Fully-Automated | `grep -rn "settings/db\|เชื่อมต่อฐานข้อมูลผ่านหน้าแอป\|ตั้งค่าฐานข้อมูล\|บันทึกการตั้งค่าฐานข้อมูล" docs/` → zero stale matches | B |
| AC5-blast-radius | Untouched-file guardrail holds (only `resolve-database-url.ts` comment-only diff) | Agent-Probe | `git diff --stat -- src/lib/resolve-database-url.ts src/lib/db.ts prisma.config.ts src/app/(main)/settings/page.tsx src/app/(main)/settings/settings-panels.tsx src/app/(main)/settings/actions.ts src/lib/app-settings.ts` | A |

gap-resolution legend:
- A — proven now (gate passes in this cycle, i.e. will be run at EXECUTE/EVL against the actual code change)
- B — fixed in this plan (the AC7-docs gate pattern was widened in this PVL cycle's plan-text update, closing the gap found during re-validation)

C-4 reconciliation: no Known-Gap rows — every developed behavior in this plan's blast radius has a Fully-Automated or Hybrid proving gate; no vacuous-green residual.

Legacy line form (retained so existing validate-contract consumers still parse):
- unit tests: Fully-automated: `pnpm test` (expect 70)
- lint: Fully-automated: `pnpm lint`
- build: Fully-automated: `pnpm build`
- e2e: Hybrid: `pnpm exec playwright test` (expect 30 excl. [setup]) + precondition: sandbox env-file swap, never touch 43.229.134.162
- dangling-reference grep: Fully-automated: `grep -rn "settings/db|connection-string|env-write|phase06-roundtrip" src/ e2e/ scripts/`
- docs staleness grep: Fully-automated: `grep -rn "settings/db|เชื่อมต่อฐานข้อมูลผ่านหน้าแอป|ตั้งค่าฐานข้อมูล|บันทึกการตั้งค่าฐานข้อมูล" docs/`
- blast-radius diff check: Agent-probe: `git diff --stat` on the untouched-file list

Dimension findings:
- Infra fit: PASS — no container/infra/worker/proxy surface touched; deletion-only within one Next.js app.
- Test coverage: PASS — 7-row gate table spans Fully-Automated (5), Hybrid (1), Agent-Probe (1); no Known-Gap rows; all 3 original FAILs now have a corresponding gate.
- Breaking changes: PASS — no schema/API/auth-contract change; `/settings` prefix ADMIN-gate in `auth.config.ts` is untouched and still correctly protects the surviving route; Public Contracts section correctly states none.
- Security surface: PASS — net-reduces attack surface (removes a secret-write endpoint that persisted a DB password to disk); no new trust-boundary or auth logic introduced.
- Section feasibility (whole plan, single section): PASS — mechanical feasibility CONFIRMED via direct grep/read against the live repo (not re-derived from the plan's prior claims): (1) FAIL 1 — `auth-guard-coverage.test.ts` lines 48/56/105-116 exactly match the plan's claimed locations, and the file's `readFileSync`/`resolve` imports remain used by 5 other assertions after the deleted block is removed (no unused-import risk); (2) FAIL 2 — `db.ts:14` and `resolve-database-url.ts` lines 11/20/52 exactly match the plan's claimed `/settings/db`- and `env-write.ts`-mentioning lines; (3) FAIL 3 — `settings-panels.tsx` lines ~107-123 confirmed as the exact dead-link card; the file's `Link` import (line 4) confirmed as having zero other usages, so its removal is required and now added to the checklist. Zero external importers found for `connection-string.ts`/`env-write.ts`/`settings/db/**` outside the delete set (full-repo grep run). Gaps found and fixed in plan text this cycle: `docs/deployment-guide.md` under-scoped (6 references vs. 1 originally named — widened); `settings-panels.tsx` unused-`Link`-import risk (added to checklist). No conflicts found between plan sections or against current file state (line numbers all fresh as of this session, no drift since the file listing above was written). Highest-risk edit: the `settings-panels.tsx` card removal, because it's the one edit combining a JSX-structure change with an import-cleanup requirement — mitigated by the explicit checklist sub-instruction above and by AC6-lint/AC6-build catching any miss.

Open gaps: none unresolved. (2 gaps found this cycle were fixed directly in the plan text — see supersedes note and Test gates gap-resolution B row.)
What this coverage does NOT prove:
- `pnpm test`/`pnpm build`/`pnpm lint`: do not prove the sandbox env-swap procedure itself is followed correctly, or that a real customer's non-Docker/NSSM environment behaves as documented (docs changes are Fully-Automated-grepped for staleness, not functionally executed).
- `pnpm exec playwright test`: does not prove production Docker container behavior (non-root user, root-owned env-file bind-mount) — that was diagnosed via the original incident, not re-probed here, since this plan's fix is removal, not a runtime workaround.
- The AC7-docs grep gate proves the absence of specific stale phrases, not that the replacement prose is well-written or that a human ops reader would successfully execute the manual env-edit + restart procedure — that remains an Agent-Probe-quality judgment call for whoever reviews the doc edit at EXECUTE/EVL, not mechanically gated.
- The Agent-Probe blast-radius diff check proves the named files are untouched (or comment-only), not that no OTHER file outside that explicit list was accidentally touched — `git status`/`git diff --stat` on the full working tree should also be reviewed at EVL as a general hygiene check, though this is not a named gate above.
Gate: PASS (no FAILs, plan updated; 2 additional gaps found during re-validation were fixed directly in the plan text this cycle, closing them before EXECUTE begins)
Accepted by: N/A — Gate is PASS; no CONDITIONAL concerns require acceptance

Failing stub (AC6-unit — informational; this plan trims an existing suite rather than adding new fully-automated behavior, so no new red-first stub is required; listed for completeness per the C3 stub convention):
```
test("unit suite drops to exactly 70 tests after settings/db removal", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: pnpm test reports 70 passing, 0 failing, after all deletions and the auth-guard-coverage.test.ts edit")
})
```

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm test` → exactly 70 tests pass, 0 fail | Fully-Automated | Deleted test files are gone and remaining suite is fully green; no dangling import breaks build-time test collection |
| `pnpm lint` clean | Fully-Automated | No unused-import / dead-code lint errors from the deletion (incl. the `Link` import in `settings-panels.tsx`) |
| `pnpm build` compiles, TypeScript passes | Fully-Automated | Catches any missed reference to a deleted file (TS would fail to resolve the import) — this is the strongest gate against Risk #1 |
| `pnpm exec playwright test` → exactly 30 tests pass, 0 fail (after sandbox env-file swap per existing procedure; never touch 43.229.134.162) | Hybrid | `/settings/db` route no longer exists and no other e2e spec references it; all surviving flows (auth/orders/print/summary-history/mobile) unaffected |
| `grep -rn "settings/db\|connection-string\|env-write\|phase06-roundtrip" src/ e2e/ scripts/` → zero matches (or only expected false positives reviewed manually) | Fully-Automated | No dangling references anywhere in source, e2e, or scripts after deletion |
| `git diff --stat -- src/lib/resolve-database-url.ts src/lib/db.ts prisma.config.ts src/app/\(main\)/settings/page.tsx src/app/\(main\)/settings/settings-panels.tsx src/app/\(main\)/settings/actions.ts src/lib/app-settings.ts` → only `resolve-database-url.ts` shows a diff, and it is comment-only | Agent-Probe | Confirms the "MUST STAY untouched" guardrail held — no accidental edits to the surviving DB-resolution or establishment-settings code paths |
| `grep -rn "settings/db\|เชื่อมต่อฐานข้อมูลผ่านหน้าแอป\|ตั้งค่าฐานข้อมูล\|บันทึกการตั้งค่าฐานข้อมูล" docs/` after edit → zero stale references (widened pattern — V1 re-validate found the narrower 2-term pattern misses `deployment-guide.md` §4/§6/troubleshooting cross-references that don't use the literal §8 heading phrase) | Fully-Automated | Deployment docs fully updated to the manual env-edit+restart procedure, including cross-references outside the primary changed section |

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- **Selected plan file**: this file (`remove-settings-db_PLAN_11-07-26.md`) — single plan, no phase program, no umbrella.
- **VALIDATE**: complete — Gate: PASS (see Validate Contract above). Proceed to EXECUTE.
- **EXECUTE resume point if interrupted**: re-run `grep -rln "settings/db\|connection-string\|env-write\|phase06-roundtrip"` across `src/ e2e/ scripts/` to see which deletions are still pending; check `src/app/nav-links.tsx` for the repointed href to confirm step 6 landed; check `docs/*.md` for stale "หน้าแอป" DB-switcher language to confirm steps 12–13 landed (use the widened grep pattern above, not just the 2-term one).
- **After EXECUTE**: recommend a `vc-git-manager` commit (deletion + nav repoint + docs/context updates — likely one logical commit, `feat(order-system): remove /settings/db runtime DB-connection page`), then UPDATE PROCESS to archive this task folder to `process/features/order-system/completed/`.

## Autonomous Goal Block

```
SESSION GOAL: Remove the /settings/db runtime DB-connection page (removal-only; DB config becomes a manual host-file edit + restart ops procedure)
Charter + umbrella plan: N/A — single plan, no phase program
Autonomy: standard /goal autonomous execution rules (process/development-protocols/orchestration.md Autonomy Mode) — CONDITIONAL findings apply-and-proceed, BLOCKED items go to backlog, irreversible/outward-facing actions without explicit contract instruction hard-stop
Hard stop conditions / safety constraints:
- Never touch the production DB host 43.229.134.162 — all Hybrid/e2e gates run only after the sandbox env-file swap per existing procedure
- resolve-database-url.ts, db.ts, prisma.config.ts, and the surviving /settings establishment page (page.tsx/settings-panels.tsx/actions.ts/app-settings.ts) must show zero functional diff — comment-only touch on resolve-database-url.ts is the sole permitted exception
- No schema/migration/prisma-schema edit of any kind
- The ordersheet-soft-delete feature (completed 11-07-26) must show zero diff
Next phase: EXECUTE: process/features/order-system/active/remove-settings-db_11-07-26/remove-settings-db_PLAN_11-07-26.md
Validate contract: inline in plan (Validate Contract section, Gate: PASS)
Execute start: pnpm test (expect 70) | pnpm lint | pnpm build | pnpm exec playwright test (expect 30 excl. [setup]) | e2e spec: none new (deletion-only) | probe scenario: git diff --stat blast-radius guardrail check | high-risk pack: no
```

---

Next instruction: say **ENTER EXECUTE MODE** to implement this plan (validate-contract: PASS).
