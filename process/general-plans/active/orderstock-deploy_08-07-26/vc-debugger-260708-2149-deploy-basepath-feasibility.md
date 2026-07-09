# Feasibility Probe — NextAuth v5 + Next.js 16 under basePath `/orderstock`

**Verdict: VIABLE.** Full VERDICT artifact:
`process/general-plans/active/orderstock-deploy_08-07-26/deploy-basepath_FEASIBILITY_08-07-26.md`

## Summary

Proved empirically (dev-mode login/session/logout flow via curl + a clean production `next
build`) that NextAuth v5 + Next.js 16.2.10 work correctly under `basePath: '/orderstock'`, using
an isolated git worktree + a throwaway DB admin user so the live `:3000` dev server and real
credentials were never touched. All 8 acceptance checks pass with a specific 4-file config.

## Two real bugs found and fixed (empirically, not from docs)

1. **`AUTH_URL` / `authConfig.basePath` must NOT include the `/orderstock` prefix.** Setting
   either one to a basePath-prefixed value causes `/api/auth/*` to fail with
   `[auth][error] UnknownAction: Cannot parse action` (400) — Next.js already strips the basePath
   before the route handler sees the path, so telling Auth.js to strip it again double-strips and
   breaks parsing. Fix: omit `AUTH_URL` (or bare origin only) and never set `authConfig.basePath`.
2. **Root path bypassed the auth gate entirely** (matches Next.js issue #73786). `proxy.ts`'s
   matcher regex didn't match the bare root under basePath — `GET /orderstock` served real
   content to a logged-out request instead of redirecting. Fix: add an explicit `"/"` entry to
   the matcher array.
3. (Related, same fix cycle) `authConfig.pages.signIn` must be `"/orderstock/login"`, not
   `"/login"` — otherwise the redirect `Location` header loses the basePath prefix (404 in prod).

## The exact working config

See the full diff (4 files: `next.config.ts`, `src/auth.config.ts`, `src/proxy.ts`,
`src/app/(main)/db-status.tsx`) plus required env vars in the VERDICT artifact linked above.

## Known-gaps (not settled by this probe)

- `next start` (full prod server) not re-run — only `next build` was confirmed clean.
- Real reverse-proxy hop (nginx/IIS forwarding `/orderstock/*`) not probed.
- Playwright E2E suite not re-run under basePath — will need `baseURL`/path updates.
- `output: "standalone"` not tested (orthogonal packaging concern).

## Repo state

Fully reverted — `git status` clean except the new VERDICT artifact (intentional). Worktree
removed. Throwaway DB user deleted. Live `:3000` dev server auto-restarted once (Next.js restarts
automatically on `next.config.ts` changes — inherent framework behavior, not a manual kill) and is
confirmed healthy post-revert (`/` → 307, `/login` → 200).

## Unresolved Questions

- Should the deploy plan smoke-test `next start` + the real reverse-proxy hop before relying on
  this verdict for production cutover, or is the dev-mode + build-mode evidence here sufficient
  to proceed straight to writing the deploy plan?
