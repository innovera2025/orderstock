import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// erp-dashboards Phase 5, Step A0.3 — the fixture-seed ORDER-INDEPENDENCE regression gate.
//
// SCHEMA-CONFORMANCE CONTRACT (23-09-26 rebuild): the fixture's table SHAPES are no longer this
// file's — or any seed file's — business. Every ERP table is created ONCE by
// `db/erp-fixture/00-schema.sql`, which is GENERATED from `db/erp-schema/live-manifest_23-09-26.json`
// (captured from `sys.columns` on live db_TCL, metadata only). A fixture may hold FEWER ROWS than
// production; it may not hold a DIFFERENT SHAPE.
//
// THE BUG CLASS THIS GATE PINS DOWN: `purchase-seed.sql` and `production-seed.sql` both seed the
// SHARED `dbo.InventoryFlowHdr` / `dbo.InventoryFlowDtl` tables. They each used to CREATE those
// tables with their own narrower shape and then patch the other domain's columns back on with
// `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD`, so whichever seed ran FIRST decided the schema
// — and the patch-up columns `DocuNo`/`WarehouseCode` did not exist in production at all (as
// `TransactionDate`/`Qty` did not, and `material-issues.sql` read those, so the drilldown compiled
// locally and failed on db_TCL). Both files now create nothing; the assertions below re-prove that
// the shared tables carry the LIVE column union and that both domains' rows land regardless of the
// order the seeds are applied in.
//
// HOW: both orders are applied to THROWAWAY databases (never `erp_fixture` itself, and never
// anything outside the local `orderstock-sql` sandbox container), then dropped. Each order is
// applied TWICE to prove re-runnability as well as order-independence.
//
// The SA password is only ever dereferenced INSIDE the container (`"$MSSQL_SA_PASSWORD"` is passed
// to the container's own shell), so it never enters this process, this file, or any log line.
//
// Self-skips — loudly — when Docker or the sandbox container is unavailable, matching every other
// infrastructure-dependent gate in this repo.

const ROOT = resolve(__dirname, "../../..");
const CONTAINER = "orderstock-sql";
const SQLCMD = "/opt/mssql-tools18/bin/sqlcmd";

const SEED_FILES = {
  schema: "db/erp-fixture/00-schema.sql",
  base: "db/erp-fixture/01-seed.sql",
  sales: "db/erp-fixture/sales-seed.sql",
  purchase: "db/erp-fixture/purchase-seed.sql",
  production: "db/erp-fixture/production-seed.sql",
} as const;

function dockerAvailable(): boolean {
  try {
    const out = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").some((name) => name.trim() === CONTAINER);
  } catch {
    return false;
  }
}

const sandboxUp = dockerAvailable();
if (!sandboxUp) {
  console.warn(
    `[erp-fixture-seed-idempotency] SKIPPED — the local ${CONTAINER} sandbox container is not ` +
      "running. Start it and re-run to exercise the seed order-independence regression gate.",
  );
}

/**
 * Run a SQL script inside the sandbox container.
 *
 * `-b` makes sqlcmd exit non-zero on the first SQL error, so a silent "Invalid column name" cannot
 * pass as success. Throws (failing the test) with sqlcmd's own output on any error.
 */
function runSql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "bash",
      "-c",
      `${SQLCMD} -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -b -i /dev/stdin`,
    ],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
  );
}

/** Retarget a fixture script at a throwaway database, leaving everything else byte-identical. */
function retarget(file: string, database: string): string {
  return readFileSync(resolve(ROOT, file), "utf8")
    .replace(/CREATE DATABASE erp_fixture;/g, `CREATE DATABASE ${database};`)
    .replace(/name = 'erp_fixture'/g, `name = '${database}'`)
    .replace(/USE erp_fixture;/g, `USE ${database};`);
}

const created: string[] = [];

function dropDatabase(database: string): void {
  try {
    runSql(
      `IF EXISTS (SELECT 1 FROM sys.databases WHERE name = '${database}')\n` +
        `BEGIN\n  ALTER DATABASE ${database} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;\n` +
        `  DROP DATABASE ${database};\nEND\nGO\n`,
    );
  } catch {
    // A leftover throwaway database is harmless; never fail the suite on cleanup.
  }
}

afterAll(() => {
  for (const database of created) dropDatabase(database);
});

/** Apply base schema + base seed + the two domain seeds in the given order. */
function applyAll(
  database: string,
  order: readonly ("sales" | "purchase" | "production")[],
): void {
  runSql(retarget(SEED_FILES.schema, database));
  runSql(retarget(SEED_FILES.base, database));
  for (const domain of order) runSql(retarget(SEED_FILES[domain], database));
}

describe.skipIf(!sandboxUp)("erp_fixture seeds are order-independent and idempotent", () => {
  const ORDERS = [
    {
      name: "sales-purchase-production",
      database: "erp_fixture_idem_pp",
      order: ["sales", "purchase", "production"],
    },
    {
      name: "production-purchase-sales",
      database: "erp_fixture_idem_rp",
      order: ["production", "purchase", "sales"],
    },
  ] as const;

  for (const { name, database, order } of ORDERS) {
    it(`applies cleanly in ${name} order, twice`, () => {
      created.push(database);
      dropDatabase(database);

      expect(() => applyAll(database, order)).not.toThrow();
      // Re-running must be a no-op, not an error — the seeds are the delivery mechanism and get
      // re-applied whenever a developer refreshes the sandbox.
      expect(() => applyAll(database, order)).not.toThrow();
    }, 180_000);

    it(`ends with the FULL live column union on the shared InventoryFlow tables (${name})`, () => {
      const result = runSql(
        `USE ${database};\nSET NOCOUNT ON;\n` +
          "SELECT c.name FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id " +
          "JOIN sys.schemas s ON s.schema_id = t.schema_id " +
          "WHERE s.name = 'dbo' AND t.name IN ('InventoryFlowHdr','InventoryFlowDtl') " +
          "ORDER BY c.name;\nGO\n",
      );

      // Purchase's family (sp_Popending: VoucherNo/InOutDate/MainQuantity/Approved/PONo) AND
      // Production's family (MainUnits/MONo/ReasonName) must BOTH be present regardless of order.
      // Every name below is a REAL live db_TCL column — check any addition against
      // db/erp-schema/live-manifest_23-09-26.json first. `DocuNo` and `WarehouseCode` used to be
      // asserted here and were fixture inventions; they are deliberately gone.
      for (const column of [
        "VoucherNo",
        "InOutDate",
        "MainQuantity",
        "Approved",
        "PONo",
        "MainUnits",
        "MONo",
        "ReasonName",
      ]) {
        expect(result, `${name}: column ${column} must exist on the shared InventoryFlow tables`)
          .toContain(column);
      }
    }, 120_000);

    it(`seeds both domains' rows regardless of order (${name})`, () => {
      const result = runSql(
        `USE ${database};\nSET NOCOUNT ON;\n` +
          "SELECT 'poNo=' + CAST(COUNT(*) AS NVARCHAR(20)) FROM dbo.InventoryFlowDtl WHERE PONo IS NOT NULL;\n" +
          "SELECT 'moNo=' + CAST(COUNT(*) AS NVARCHAR(20)) FROM dbo.InventoryFlowDtl WHERE MONo IS NOT NULL;\nGO\n",
      );
      const poNo = Number(result.match(/poNo=(\d+)/)?.[1] ?? 0);
      const moNo = Number(result.match(/moNo=(\d+)/)?.[1] ?? 0);
      expect(poNo, `${name}: purchase receipt rows must be present`).toBeGreaterThan(0);
      expect(moNo, `${name}: production material-issue rows must be present`).toBeGreaterThan(0);
    }, 120_000);
  }
});
