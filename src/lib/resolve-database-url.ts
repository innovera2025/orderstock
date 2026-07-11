// DB URL `$`-in-password round-trip fix. The single raw-read resolver for `DATABASE_URL`,
// used by BOTH `src/lib/db.ts` (Next app runtime) AND `prisma.config.ts` (Prisma CLI).
//
// WHY THIS EXISTS: the Next app loads `.env` via `@next/env`, which runs dotenv-expand — a
// literal `$` in the value gets expanded/corrupted, so a saved SQL Server password containing
// `$` breaks the connection after a `/settings/db` restart-apply ("Login failed for user 'sa'").
// `process.loadEnvFile()` (Node 22+) does NOT expand, but the app path never uses it. This
// helper raw-reads the value straight from the file, bypassing any expansion, so the literal
// value (including `$`, `${...}`, and named-instance `\INST` forms) round-trips verbatim.
//
// CONTRACT (mirrors `env-write.ts`'s raw/literal/unquoted write format — do NOT add unescaping):
//  1. Read the target env file (defaults to `<cwd>/.env`; `envPath` param is for test fixtures
//     only — production call sites never pass it). Take the FIRST `^DATABASE_URL=` line, strip a
//     single matching pair of surrounding quotes, return the rest VERBATIM (no expansion, no
//     unescaping, no `$`-substitution).
//  2. If the file is absent or has no matching line, fall back to `process.env.DATABASE_URL`
//     (covers the Docker BUILD stage's `ENV` placeholder and CI/inline-env runs with no `.env`).
//  3. If neither yields a non-empty value, throw the same clear error `db.ts` threw before.
//  4. NEVER log/print the resolved value anywhere in this module (secret-hygiene, mirrors
//     `env-write.ts`).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const KEY = "DATABASE_URL";
const KEY_PREFIX = `${KEY}=`;

/** Strip a single matching pair of surrounding quotes (`"..."` or `'...'`), if present. */
function stripOneQuotePair(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Resolve the literal `DATABASE_URL` value without dotenv-style expansion.
 *
 * @param envPath Optional path to the env file to read (test-only; defaults to `<cwd>/.env`).
 * @returns the literal connection string, verbatim.
 * @throws if neither the file nor `process.env.DATABASE_URL` yields a non-empty value.
 */
export function resolveDatabaseUrl(envPath?: string): string {
  const targetPath = envPath ?? join(process.cwd(), ".env");

  if (existsSync(targetPath)) {
    const content = readFileSync(targetPath, "utf8");
    // Mirror `env-write.ts`'s `/\r?\n/` split so CRLF fixtures parse correctly.
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith(KEY_PREFIX)) {
        // Take everything after the FIRST `=` (the value itself may contain `=`).
        const rawValue = line.slice(KEY_PREFIX.length);
        const value = stripOneQuotePair(rawValue);
        if (value.length > 0) {
          return value;
        }
      }
    }
  }

  // Fallback: the file is absent or has no non-empty DATABASE_URL line.
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  throw new Error("DATABASE_URL is not set — cannot construct the Prisma SQL Server adapter.");
}
