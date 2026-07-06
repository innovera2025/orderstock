// Phase 06 (A2/A2b). Safe rewrite of the `DATABASE_URL` line in `.env` — the single source of
// truth read by BOTH `src/lib/db.ts` AND `prisma.config.ts` (no CLI/app divergence).
//
// SECURITY (E1):
//  - injection-safe: the written value is stripped of CR/LF so an embedded `\nKEY=value` payload
//    can never inject or clobber another key. Only the DATABASE_URL line is touched; all other
//    lines are preserved byte-for-byte.
//  - backup-before-write (A2b): `.env` is copied to `.env.bak` BEFORE `.env` is mutated, so a bad
//    save is a one-command rollback (`cp .env.bak .env`). `.env.bak` is gitignored by `.env*` (A3).
//  - NEVER logs the value (it is a secret).

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface WriteEnvOptions {
  /** Absolute path to the target `.env` (defaults to `<cwd>/.env`). */
  envPath?: string;
}

const KEY = "DATABASE_URL";

/**
 * Truncate the value at the first CR/LF and drop everything after it. A legitimate JDBC-style
 * connection string never contains a newline, so this is loss-free for valid input; for hostile
 * input it discards the entire injection payload (never concatenates it onto the value).
 */
function sanitizeValue(value: string): string {
  return value.split(/[\r\n]/)[0] ?? "";
}

/**
 * Rewrite ONLY the `DATABASE_URL` line of `.env`, preserving every other line. Backs up `.env` to
 * `.env.bak` before mutating. Appends the key if absent. Returns the path written.
 */
export function writeDatabaseUrl(rawValue: string, options: WriteEnvOptions = {}): string {
  const envPath = options.envPath ?? join(process.cwd(), ".env");
  const bakPath = `${envPath}.bak`;
  const value = sanitizeValue(rawValue);

  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  // A2b: back up BEFORE mutating (only when there is an existing file to protect).
  if (existsSync(envPath)) {
    copyFileSync(envPath, bakPath);
  }

  const newline = `${KEY}=${value}`;
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];

  let replaced = false;
  const rewritten = lines.map((line) => {
    if (line.startsWith(`${KEY}=`)) {
      replaced = true;
      return newline;
    }
    return line;
  });

  if (!replaced) {
    // Insert before a trailing empty line if present, else append.
    if (rewritten.length > 0 && rewritten[rewritten.length - 1] === "") {
      rewritten.splice(rewritten.length - 1, 0, newline);
    } else {
      rewritten.push(newline);
    }
  }

  writeFileSync(envPath, rewritten.join("\n"), "utf8");
  return envPath;
}
