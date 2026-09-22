// The separate, READ-ONLY ERP connection pool (erp-dashboards Phase 1, decisions D1/D3).
//
// This is a SECOND, completely independent `mssql.ConnectionPool`, distinct from Prisma's
// `PrismaMssql` adapter pool in `src/lib/db.ts`. ERP reads never travel over the Prisma pool and
// ERP tables never enter `prisma/schema.prisma`. `mssql@^12.2.0` is already a dependency (pulled in
// by `@prisma/adapter-mssql`) and already externalized in `next.config.ts`'s
// `serverExternalPackages: ["mssql", "tedious"]` — this file adds no new dependency.
//
// LAYER 5 of the read-only defense: `options.readOnlyIntent = true` sets the connection's
// ApplicationIntent to ReadOnly. On a non-AlwaysOn server this is a documented no-op; it is
// additive hardening, never load-bearing alone.
//
// SECRET HYGIENE: this module never logs the resolved connection string or any part of it.

import { ConnectionPool, type config as MssqlConfig } from "mssql";
import { resolveErpDatabaseUrl } from "./resolve-erp-database-url";
import { verifyReadOnlyBoot, ErpWritePermissionError } from "./erp-adapter";

/**
 * Parse a JDBC-style `sqlserver://host:port;key=value;...` string into node-mssql's config shape.
 *
 * WHY: `mssql`'s `ConnectionPool` accepts either an ADO.NET-style connection string or a config
 * object — it does NOT natively understand the JDBC `sqlserver://` form that Prisma uses. To keep
 * ONE env-var format across the app (`DATABASE_URL` and `ERP_DATABASE_URL` look alike), this small
 * parser converts the JDBC form into the config object. Kept deliberately minimal: host, port,
 * database, user, password, encrypt, trustServerCertificate. Anything else is ignored.
 *
 * Exported for unit testing. Never logs the input or output.
 */
export function parseJdbcSqlServerUrl(url: string): MssqlConfig {
  const withoutScheme = url.startsWith("sqlserver://") ? url.slice("sqlserver://".length) : url;

  const parts = withoutScheme.split(";");
  const hostPart = parts[0] ?? "";
  const props = new Map<string, string>();
  for (const segment of parts.slice(1)) {
    if (segment.length === 0) continue;
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    props.set(segment.slice(0, eq).trim().toLowerCase(), segment.slice(eq + 1));
  }

  // `host:port` — the host itself may contain a named-instance suffix (`localhost\SQLEXPRESS`).
  const colon = hostPart.lastIndexOf(":");
  const server = colon === -1 ? hostPart : hostPart.slice(0, colon);
  const portText = colon === -1 ? "" : hostPart.slice(colon + 1);
  const port = portText.length > 0 ? Number(portText) : 1433;

  if (server.length === 0) {
    throw new Error("ERP_DATABASE_URL is malformed — no server host found before the first ';'.");
  }
  if (!Number.isFinite(port)) {
    throw new Error("ERP_DATABASE_URL is malformed — the port is not a number.");
  }

  const database = props.get("database");
  if (!database) {
    throw new Error("ERP_DATABASE_URL is malformed — a `database=` property is required.");
  }

  const isTrue = (value: string | undefined, fallback: boolean): boolean =>
    value === undefined ? fallback : value.trim().toLowerCase() === "true";

  return {
    server,
    port,
    database,
    user: props.get("user"),
    password: props.get("password"),
    options: {
      encrypt: isTrue(props.get("encrypt"), true),
      trustServerCertificate: isTrue(props.get("trustservercertificate"), false),
      // LAYER 5 — ApplicationIntent=ReadOnly.
      readOnlyIntent: true,
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
  };
}

/**
 * Should the boot permission probe (layer 4) run?
 *
 * In production: always. Locally the fixture database is reached with the sandbox `sa` login,
 * which legitimately HAS write permissions — running the probe there would (correctly) refuse to
 * start and block all local dev. So locally it is opt-in via `ERP_VERIFY_BOOT_PROBE=1`.
 *
 * The refusal LOGIC itself is proven unconditionally by the mocked unit tests in
 * `src/lib/__tests__/erp-adapter.test.ts` — the gate below only controls whether it runs against
 * the live local fixture connection.
 */
export function shouldVerifyBootProbe(
  env: { NODE_ENV?: string; ERP_VERIFY_BOOT_PROBE?: string } = process.env,
): boolean {
  if (env.ERP_VERIFY_BOOT_PROBE === "1") return true;
  return env.NODE_ENV === "production";
}

/**
 * CHARTER EXCEPTION (recorded 2026-09-22, approved by the repo owner) — opt-in only.
 *
 * `ERP_ALLOW_WRITE_CAPABLE_LOGIN=1` lets the ERP pool boot on a login that still holds write
 * permissions (e.g. the app's existing `sa` connection to db_TCL) while the DBA-provisioned
 * scoped read-only login from `db/create-erp-readonly-login.sql` is still pending.
 *
 * ONLY the exact string `"1"` enables it. Absent, empty, `"0"`, `"true"` — anything else — keeps
 * today's fail-closed behaviour in EVERY environment, production included.
 *
 * What this relaxes: WHICH LOGIN may back the pool. What it never relaxes: the read-only
 * guarantee itself. Layers 1-3 and 5 (`assertReadOnlySql` denylist, single `guardedQuery` choke
 * point, no-write-method compile guard, parameterized requests, `ApplicationIntent=ReadOnly`) are
 * untouched, and the boot probe STILL RUNS and still reports what it found — it only stops
 * throwing, and warns loudly instead.
 *
 * See `process/context/database/all-database.md` → "ERP Read Layer" → charter exception record.
 */
export function allowsWriteCapableLogin(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ERP_ALLOW_WRITE_CAPABLE_LOGIN === "1";
}

/** What the boot probe concluded about the login currently backing the ERP pool. */
export interface ErpReadOnlyLoginState {
  /**
   * `false` ONLY when the probe found write permissions and boot proceeded anyway because the
   * opt-in switch was on. `true` otherwise (probe passed, or probe not run in local dev).
   */
  readOnlyLogin: boolean;
  /** Present only when `readOnlyLogin` is false. Credential-free by construction. */
  warning?: string;
}

// Set ONCE per pool creation (never per query), read by `/api/health/erp`.
let readOnlyLoginState: ErpReadOnlyLoginState = { readOnlyLogin: true };

/** Current boot-probe conclusion. Used by `/api/health/erp` so ops can see it without logs. */
export function erpReadOnlyLoginState(): ErpReadOnlyLoginState {
  return readOnlyLoginState;
}

/** Test-only: restore the default state between cases. */
export function resetErpReadOnlyLoginState(): void {
  readOnlyLoginState = { readOnlyLogin: true };
}

/** Build the loud, credential-free warning. Built from permission LABELS only — never config. */
export function buildWriteCapableLoginWarning(grantedPermissions: readonly string[]): string {
  return (
    "[ERP read-only boot probe] WARNING — the ERP connection is running on a WRITE-CAPABLE login. " +
    `The connected login holds: ${grantedPermissions.join(", ")}. ` +
    "Booting anyway because ERP_ALLOW_WRITE_CAPABLE_LOGIN=1 (an explicit, recorded, temporary " +
    "exception). Database-level write protection is NOT in force; only the application-level " +
    "read-only guard is. Remediate: have the DBA run db/create-erp-readonly-login.sql, point " +
    "ERP_DATABASE_URL at that scoped read-only login, then unset ERP_ALLOW_WRITE_CAPABLE_LOGIN. " +
    "คำเตือน: การเชื่อมต่อ ERP ใช้บัญชีที่ยังเขียนฐานข้อมูลได้ — ระบบยังอ่านอย่างเดียว แต่ควรเปลี่ยนไปใช้บัญชีอ่านอย่างเดียวโดยเร็ว"
  );
}

/**
 * Run the layer-4 boot probe, applying the opt-in exception above.
 *
 * - Probe passes (read-only login) → resolves, nothing logged, state stays `readOnlyLogin: true`.
 * - Probe finds write permissions + switch OFF → rethrows (unchanged fail-closed behaviour).
 * - Probe finds write permissions + switch ON → resolves, logs EXACTLY ONE credential-free
 *   warning, state becomes `{ readOnlyLogin: false, warning }`.
 * - Probe is inconclusive (connection/shape error) → always rethrows; the switch never covers an
 *   unproven permission set.
 *
 * Dependencies are injectable so this is unit-testable without a real SQL Server.
 */
export async function runBootProbeWithOptIn(
  pool: ConnectionPool,
  deps: {
    verify?: (pool: ConnectionPool) => Promise<void>;
    env?: Record<string, string | undefined>;
    warn?: (message: string) => void;
  } = {},
): Promise<void> {
  const verify = deps.verify ?? verifyReadOnlyBoot;
  const env = deps.env ?? process.env;
  const warn = deps.warn ?? ((message: string) => console.warn(message));

  try {
    await verify(pool);
    readOnlyLoginState = { readOnlyLogin: true };
  } catch (error) {
    // Only a PROVEN write-capable permission set is covered by the exception. Any other failure
    // (probe errored, probe returned no rows) stays fail-closed.
    if (!(error instanceof ErpWritePermissionError) || !allowsWriteCapableLogin(env)) {
      throw error;
    }
    const warning = buildWriteCapableLoginWarning(error.grantedPermissions);
    readOnlyLoginState = { readOnlyLogin: false, warning };
    warn(warning);
  }
}

// Module-level singleton behind the same `globalThis` dev-hot-reload cache as `src/lib/db.ts`,
// so Next's dev fast-refresh does not leak a new connection pool on every edit.
const globalForErp = globalThis as unknown as {
  erpPool?: ConnectionPool;
  erpPoolConnect?: Promise<ConnectionPool>;
};

/**
 * Build the pool LAZILY (on first ERP read), never at module load.
 *
 * Deliberate: `ERP_DATABASE_URL` is only needed by ERP dashboard routes. Constructing the pool
 * at import time would make a missing/blank ERP URL crash the whole app — including every
 * non-ERP page — which is the opposite of the degrade requirement.
 */
function getOrCreatePool(): ConnectionPool {
  if (!globalForErp.erpPool) {
    globalForErp.erpPool = new ConnectionPool(parseJdbcSqlServerUrl(resolveErpDatabaseUrl()));
  }
  return globalForErp.erpPool;
}

/**
 * Connect the ERP pool once (idempotent) and, when enabled, run the layer-4 read-only boot probe.
 * Every ERP consumer awaits this before calling `guardedQuery`.
 *
 * If the boot probe fails, the rejection propagates — the app refuses to serve ERP reads rather
 * than silently downgrading to an unverified connection.
 */
export function getErpPool(): Promise<ConnectionPool> {
  if (!globalForErp.erpPoolConnect) {
    globalForErp.erpPoolConnect = (async () => {
      const pool = getOrCreatePool();
      if (!pool.connected && !pool.connecting) {
        await pool.connect();
      }
      if (shouldVerifyBootProbe()) {
        // Runs ONCE per pool creation — never per query.
        await runBootProbeWithOptIn(pool);
      }
      return pool;
    })().catch((error) => {
      // Allow a later request to retry a transient connection failure.
      globalForErp.erpPoolConnect = undefined;
      globalForErp.erpPool = undefined;
      throw error;
    });
  }
  return globalForErp.erpPoolConnect;
}
