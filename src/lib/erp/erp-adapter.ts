// ERP READ-ONLY GUARD — the single choke point every ERP query must pass through.
//
// HARD RULE (erp-dashboards program charter): the customer's ERP database (`db_TCL`) is READ-ONLY.
// No INSERT / UPDATE / DELETE / MERGE / TRUNCATE / DDL / EXEC / stored-procedure call may EVER
// reach it from this application. This module makes a write structurally impossible, not merely
// discouraged. Ported (logic + structure, re-commented in English) from the proven, currently
// shipping sibling implementation at `TCL/server/src/erp/erp-adapter.ts` — never imported as a
// package, never copy-pasted with its Thai comments.
//
// DEFENSE IN DEPTH — 5 layers, none of which is load-bearing alone (decision D3):
//   1. `normalizeSqlForGuard` — comment-strips and literal-masks the statement so keyword and `;`
//      scanning cannot be fooled by text inside a string literal or a `[Update Date]` identifier.
//   2. `assertReadOnlySql` — must be a SINGLE statement, must start with SELECT or WITH, and must
//      contain none of the 19 forbidden keyword rules.
//   3. Parameterized `mssql` requests only — `guardedQuery` binds every param via
//      `request.input(...)`; values are never concatenated into SQL.
//   4. `verifyReadOnlyBoot` — a `HAS_PERMS_BY_NAME` boot probe that REFUSES to serve ERP reads
//      when the connected login holds any write/DDL permission.
//   5. `ApplicationIntent=ReadOnly` on the pool config (see `pool.ts`) — additive.
//
// Plus a compile-time guard: `ErpAdapter` may never grow a write-shaped method (see
// `_AssertNoWriteMethods` below) — such a PR fails `pnpm build`/typecheck.
//
// This module NEVER touches Prisma. ERP tables are never in `prisma/schema.prisma` and ERP reads
// never go through `prisma.$queryRaw` or the `orderstock_app` Prisma pool.

import type { ConnectionPool } from "mssql";
import { ErpForcedDownError, isErpForcedDown } from "./force-down";

/** The ways a statement can fail the read-only guard. */
export type ReadOnlySqlViolation =
  | "EMPTY_STATEMENT"
  | "UNTERMINATED_STRING"
  | "UNTERMINATED_COMMENT"
  | "NOT_SELECT_OR_WITH"
  | "MULTIPLE_STATEMENTS"
  | "FORBIDDEN_KEYWORD";

/** Thrown by `assertReadOnlySql` — the statement never reaches the ERP connection. */
export class ReadOnlySqlViolationError extends Error {
  readonly violation: ReadOnlySqlViolation;
  readonly keyword?: string;

  constructor(violation: ReadOnlySqlViolation, detail: string, keyword?: string) {
    super(
      `[ERP read-only statement guard] rejected SQL: ${detail} (violation=${violation}` +
        (keyword ? `, keyword=${keyword}` : "") +
        ")",
    );
    this.name = "ReadOnlySqlViolationError";
    this.violation = violation;
    this.keyword = keyword;
  }
}

/** Thrown by `verifyReadOnlyBoot` when the connected login can write to the ERP. */
export class ErpWritePermissionError extends Error {
  readonly grantedPermissions: readonly string[];

  constructor(grantedPermissions: readonly string[]) {
    super(
      "[ERP read-only boot probe] refusing to serve ERP reads: the connected login holds " +
        `write/DDL permission(s): ${grantedPermissions.join(", ")}. ` +
        "The ERP connection must use a strictly read-only scoped login (SELECT only).",
    );
    this.name = "ErpWritePermissionError";
    this.grantedPermissions = grantedPermissions;
  }
}

const STRING_PLACEHOLDER = "''";
const IDENT_PLACEHOLDER = '"id"';

/**
 * Strip line and (nestable) block comments, replace the CONTENT of string literals and quoted
 * identifiers with inert placeholders, and collapse whitespace.
 *
 * This is what makes layer 2 trustworthy: keyword and `;` scanning runs on a statement where no
 * literal text or bracketed identifier can smuggle a forbidden word past the denylist, and where
 * a legitimate column named `[Update Date]` cannot false-positive.
 *
 * Exported so it can be unit-tested directly (it is pure).
 */
export function normalizeSqlForGuard(sql: string): string {
  // SSMS-exported .sql files often carry a BOM; strip it so the "must start with SELECT" rule
  // is not tripped by an invisible character.
  const src = sql.charCodeAt(0) === 0xfeff ? sql.slice(1) : sql;
  let out = "";
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    // Line comment `-- ... <EOL>`
    if (ch === "-" && next === "-") {
      i += 2;
      while (i < src.length && src[i] !== "\n") i += 1;
      out += " ";
      continue;
    }

    // Block comment `/* ... */` (T-SQL allows nesting)
    if (ch === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < src.length && depth > 0) {
        if (src[i] === "/" && src[i + 1] === "*") {
          depth += 1;
          i += 2;
        } else if (src[i] === "*" && src[i + 1] === "/") {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      if (depth > 0) {
        throw new ReadOnlySqlViolationError(
          "UNTERMINATED_COMMENT",
          "unterminated block comment /* ... */ — the statement cannot be safely inspected",
        );
      }
      out += " ";
      continue;
    }

    // String literal `'...'` (escaped by doubling: `''`)
    if (ch === "'") {
      i += 1;
      let closed = false;
      while (i < src.length) {
        if (src[i] === "'") {
          if (src[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      if (!closed) {
        throw new ReadOnlySqlViolationError(
          "UNTERMINATED_STRING",
          "unterminated string literal ' ... ' — the statement cannot be safely inspected",
        );
      }
      out += STRING_PLACEHOLDER;
      continue;
    }

    // Quoted identifier `[...]` or `"..."`
    if (ch === "[" || ch === '"') {
      const close = ch === "[" ? "]" : '"';
      i += 1;
      let closed = false;
      while (i < src.length) {
        if (src[i] === close) {
          if (src[i + 1] === close) {
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      if (!closed) {
        throw new ReadOnlySqlViolationError(
          "UNTERMINATED_STRING",
          `unterminated quoted identifier ${ch} ... ${close} — the statement cannot be safely inspected`,
        );
      }
      out += IDENT_PLACEHOLDER;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out.replace(/\s+/g, " ").trim();
}

/**
 * The 19 forbidden keyword rules, ported verbatim in coverage from the sibling implementation
 * (`TCL/server/src/erp/erp-adapter.ts`). Word-boundary matched, case-insensitive.
 *
 * `EXEC/EXECUTE` is one rule covering both spellings — hence 19 rules over 20 spellings.
 */
export const FORBIDDEN_KEYWORDS: ReadonlyArray<{
  label: string;
  pattern: RegExp;
  why: string;
}> = [
  { label: "INSERT", pattern: /\binsert\b/i, why: "adds rows to the ERP" },
  { label: "UPDATE", pattern: /\bupdate\b/i, why: "modifies ERP rows" },
  { label: "DELETE", pattern: /\bdelete\b/i, why: "removes ERP rows" },
  { label: "MERGE", pattern: /\bmerge\b/i, why: "upserts ERP rows" },
  { label: "TRUNCATE", pattern: /\btruncate\b/i, why: "empties an ERP table" },
  { label: "DROP", pattern: /\bdrop\b/i, why: "drops an ERP object" },
  { label: "ALTER", pattern: /\balter\b/i, why: "changes ERP structure" },
  { label: "CREATE", pattern: /\bcreate\b/i, why: "creates an ERP object" },
  { label: "GRANT", pattern: /\bgrant\b/i, why: "changes ERP permissions" },
  { label: "REVOKE", pattern: /\brevoke\b/i, why: "changes ERP permissions" },
  {
    label: "EXEC/EXECUTE",
    pattern: /\bexec(ute)?\b/i,
    why: "calls a stored procedure — many ERP procs write real or temp tables",
  },
  {
    label: "sp_executesql",
    pattern: /\bsp_executesql\b/i,
    why: "runs dynamic SQL, bypassing this guard",
  },
  { label: "xp_cmdshell", pattern: /\bxp_cmdshell\b/i, why: "runs OS-level commands" },
  {
    label: "BULK",
    pattern: /\bbulk\b/i,
    why: "BULK INSERT / OPENROWSET(BULK ...) reads or writes files",
  },
  { label: "OPENROWSET", pattern: /\bopenrowset\b/i, why: "reaches an external data source" },
  { label: "INTO", pattern: /\binto\b/i, why: "SELECT ... INTO creates/writes a new table" },
  { label: "BACKUP", pattern: /\bbackup\b/i, why: "server-level ERP command" },
  { label: "RESTORE", pattern: /\brestore\b/i, why: "server-level ERP command" },
  { label: "SHUTDOWN", pattern: /\bshutdown\b/i, why: "stops the ERP server" },
];

/**
 * LAYER 2 — every SQL string bound for the ERP connection must pass through this function first.
 * Passing returns void; failing throws `ReadOnlySqlViolationError`.
 *
 * Rules: one statement only, starting with SELECT or WITH, containing none of the 19 forbidden
 * keyword rules. `SET NOCOUNT ON`, `DECLARE`, and `EXEC` prefixes are all rejected.
 */
export function assertReadOnlySql(sql: string): void {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw new ReadOnlySqlViolationError("EMPTY_STATEMENT", "the SQL string is empty");
  }

  const normalized = normalizeSqlForGuard(sql);
  if (normalized.length === 0) {
    throw new ReadOnlySqlViolationError(
      "EMPTY_STATEMENT",
      "the SQL contains only comments/whitespace — no actual statement",
    );
  }

  // Must start with SELECT or WITH. Nothing else qualifies.
  if (!/^(select|with)\b/i.test(normalized)) {
    const firstToken = normalized.split(/[\s(;]/, 1)[0];
    throw new ReadOnlySqlViolationError(
      "NOT_SELECT_OR_WITH",
      `a statement must start with SELECT or WITH, but this one starts with "${firstToken}" — ` +
        "if an ERP script is prefixed with SET NOCOUNT ON / DECLARE / EXEC, remove it or rewrite " +
        "the statement as a CTE (WITH ...) first",
      firstToken,
    );
  }

  // Stacked statements: only a single trailing `;` is allowed.
  const withoutTrailingSemicolon = normalized.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    throw new ReadOnlySqlViolationError(
      "MULTIPLE_STATEMENTS",
      "found a mid-statement ';' — that would allow several statements in one round trip " +
        "(only a single trailing ';' closing one statement is allowed)",
    );
  }

  for (const rule of FORBIDDEN_KEYWORDS) {
    if (rule.pattern.test(withoutTrailingSemicolon)) {
      throw new ReadOnlySqlViolationError(
        "FORBIDDEN_KEYWORD",
        `found a keyword forbidden against the ERP: ${rule.label} (${rule.why}) — ` +
          "this application reads the ERP and never writes to it",
        rule.label,
      );
    }
  }
}

/** Values that may be bound as named query parameters. Never concatenate values into SQL. */
export type ErpQueryParam = string | number | boolean | Date | null;
export type ErpQueryParams = Readonly<Record<string, ErpQueryParam>>;

/**
 * The ERP adapter marker interface. Intentionally read-only and intentionally minimal: consumers
 * (Phase 2/3/4 dashboards) call `guardedQuery` directly with their own SELECT files rather than
 * extending this with new methods.
 */
export interface ErpAdapter {
  readonly kind: "erp-read-only";
}

/**
 * COMPILE-TIME GUARD: resolves to `never` if `T` ever gains a write-shaped method name. The
 * assertion below fails typecheck/`pnpm build` if someone adds one to `ErpAdapter`.
 */
type AssertNoWriteMethods<T> = Extract<
  keyof T,
  "insert" | "update" | "delete" | "write" | "save" | "upsert" | "merge" | "exec" | "execute"
> extends never
  ? T
  : never;

// If this line ever errors, a write-shaped method was added to `ErpAdapter` — that is forbidden.
type _NoWriteMethods = AssertNoWriteMethods<ErpAdapter>;
const _noWriteMethodsProof: _NoWriteMethods = { kind: "erp-read-only" };
void _noWriteMethodsProof;

/**
 * THE SINGLE CHOKE POINT. Every ERP read in this application goes through here — there is no other
 * sanctioned path to the ERP connection.
 *
 * Order matters and is structurally enforced: `assertReadOnlySql` runs BEFORE the pool is touched,
 * so a forbidden statement never reaches `pool.request()`.
 *
 * @param pool the read-only ERP connection pool (see `pool.ts`)
 * @param sql  a single SELECT/WITH statement
 * @param params named parameters, bound via `request.input(...)` — never string-concatenated
 */
export async function guardedQuery<T>(
  pool: ConnectionPool,
  sql: string,
  params?: ErpQueryParams,
): Promise<T[]> {
  // erp-dashboards Phase 5 (test-only, additive — see `force-down.ts` and the Registry Change
  // Request in phase 5's report): a simulated-outage toggle, flipped only by a route that cannot
  // exist in production. Default OFF; when on it throws BEFORE the guard and before the pool is
  // touched, so it can never weaken a read-only layer or disturb the live pool.
  if (isErpForcedDown()) {
    throw new ErpForcedDownError();
  }

  // LAYER 2 first — before any contact with the connection pool.
  assertReadOnlySql(sql);

  // LAYER 3 — parameterized request only.
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query<T>(sql);
  return result.recordset ?? [];
}

/**
 * LAYER 4 boot permission probe SQL. Ported from the sibling project's `PERMISSION_PROBE_SQL`.
 * Asks SQL Server what the CONNECTED LOGIN is actually allowed to do, rather than trusting config.
 *
 * NOTE: this statement is infrastructure, not domain data, so it is executed directly rather than
 * through `guardedQuery` — it is itself a pure SELECT, and routing it through the guard would be
 * circular (the guard is what this probe backs up).
 */
export const PERMISSION_PROBE_SQL = `SELECT
  HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'INSERT')       AS can_insert,
  HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'UPDATE')       AS can_update,
  HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'DELETE')       AS can_delete,
  HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER')        AS can_alter,
  HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS can_create_table,
  HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'SELECT')       AS can_select`;

/** Shape of the probe's single result row. */
export interface ErpPermissionRow {
  can_insert: number | null;
  can_update: number | null;
  can_delete: number | null;
  can_alter: number | null;
  can_create_table: number | null;
  can_select: number | null;
}

/** The write/DDL permissions that must all be absent. `can_select` is the only allowed grant. */
const WRITE_PERMISSION_COLUMNS: ReadonlyArray<{ column: keyof ErpPermissionRow; label: string }> = [
  { column: "can_insert", label: "INSERT" },
  { column: "can_update", label: "UPDATE" },
  { column: "can_delete", label: "DELETE" },
  { column: "can_alter", label: "ALTER" },
  { column: "can_create_table", label: "CREATE TABLE" },
];

/**
 * LAYER 4 — run the permission probe and REFUSE to serve ERP reads if the connected login holds
 * any write or DDL permission. Never silently downgrades.
 *
 * @throws ErpWritePermissionError when any write/DDL permission is granted
 * @throws Error when the probe itself cannot be completed (inconclusive — treated as unsafe)
 */
export async function verifyReadOnlyBoot(pool: ConnectionPool): Promise<void> {
  let row: ErpPermissionRow | undefined;
  try {
    const result = await pool.request().query<ErpPermissionRow>(PERMISSION_PROBE_SQL);
    row = result.recordset?.[0];
  } catch (error) {
    throw new Error(
      "[ERP read-only boot probe] could not read the connected login's permissions, so read-only " +
        `access cannot be proven: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!row) {
    throw new Error(
      "[ERP read-only boot probe] the permission probe returned no rows — read-only access cannot " +
        "be proven, refusing to serve ERP reads",
    );
  }

  const granted = WRITE_PERMISSION_COLUMNS.filter((p) => Number(row[p.column]) === 1).map(
    (p) => p.label,
  );

  if (granted.length > 0) {
    throw new ErpWritePermissionError(granted);
  }
}
