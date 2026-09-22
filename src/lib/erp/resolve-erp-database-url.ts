// ERP read-only connection-string resolver. Mirrors `src/lib/resolve-database-url.ts` exactly,
// keyed on `ERP_DATABASE_URL` instead of `DATABASE_URL` (erp-dashboards Phase 1, decision D2).
//
// WHY THIS EXISTS: the Next app loads `.env` via `@next/env`, which runs dotenv-expand — a
// literal `$` in the value gets expanded/corrupted, so a SQL Server password containing `$`
// breaks the connection after a manual env-file edit + restart. This helper raw-reads the value
// straight from the file, bypassing any expansion, so the literal value (including `$`,
// `${...}`, and named-instance `\INST` forms) round-trips verbatim.
//
// CONTRACT (identical to resolveDatabaseUrl, different key — do NOT add unescaping):
//  1. Read the env file (defaults to `<cwd>/.env`; `envPath` is for test fixtures only). Take the
//     FIRST `^ERP_DATABASE_URL=` line, strip a single matching pair of surrounding quotes, return
//     the rest VERBATIM (no expansion, no unescaping, no `$`-substitution).
//  2. If the file is absent or has no matching line, fall back to `process.env.ERP_DATABASE_URL`.
//  3. If neither yields a non-empty value, throw a clear error.
//  4. NEVER log/print the resolved value anywhere in this module (secret-hygiene).
//
// READ-ONLY NOTE: the value this resolves must always point at a read-only-scoped ERP login.
// In dev it points at the LOCAL sandbox `erp_fixture` database; in production at db_TCL with the
// DBA-provisioned scoped read-only login — never `sa`, never `orderstock_app`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const KEY = "ERP_DATABASE_URL";
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
 * Resolve the literal `ERP_DATABASE_URL` value without dotenv-style expansion.
 *
 * @param envPath Optional path to the env file to read (test-only; defaults to `<cwd>/.env`).
 * @returns the literal connection string, verbatim.
 * @throws if neither the file nor `process.env.ERP_DATABASE_URL` yields a non-empty value.
 */
export function resolveErpDatabaseUrl(envPath?: string): string {
  const filePath = envPath ?? join(process.cwd(), ".env");

  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf8");
    // Split on `/\r?\n/` so CRLF fixtures parse correctly.
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

  const fromEnv = process.env.ERP_DATABASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  throw new Error(
    "ERP_DATABASE_URL is not set — cannot open the read-only ERP connection pool.",
  );
}
