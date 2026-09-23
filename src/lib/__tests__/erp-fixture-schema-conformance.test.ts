import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The mechanical guardrail against the root cause of the 23-09-26 production defect.
//
// WHAT WENT WRONG: the local `erp_fixture` sandbox was hand-built from a PROSE data dictionary
// instead of from the live column list. It therefore modelled columns production does not have
// (`tbl_DOhdr.IsCancel`, `SalesInvoiceHdr.InvoiceNo/InvoiceDate/CustCode`,
// `InventoryFlowHdr.DocuNo/WarehouseCode`) and omitted columns production does
// (`tbl_Dodtl.Slno/Units`, every table's `RowOrder`). Every dashboard gate passed against that
// invented schema, and then every dashboard page failed on db_TCL with "Invalid column name" —
// rendering "ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้" for the customer.
//
// WHAT THIS GATE DOES: asserts `db/erp-fixture/00-schema.sql` still matches
// `db/erp-schema/live-manifest_23-09-26.json` COLUMN-FOR-COLUMN — same names, same order, same
// types, same nullability. It is a pure text/JSON comparison: no database, no Docker, no network,
// so it runs everywhere and can never be skipped into uselessness.
//
// A fixture may hold FEWER ROWS than production. It may not hold a DIFFERENT SHAPE.
//
// IF THIS FAILS: do NOT hand-edit the CREATE TABLE block to match. Re-capture the manifest from
// the live server's `sys.columns` (see db/erp-schema/README.md) and regenerate the DDL from it.

const ROOT = resolve(__dirname, "../../..");
const MANIFEST = "db/erp-schema/live-manifest_23-09-26.json";
const SCHEMA = "db/erp-fixture/00-schema.sql";

/** The only sanctioned deviation: `text` is deprecated and unusable; NVARCHAR(MAX) supersedes it. */
function expectedSqlType(manifestType: string): string {
  return (manifestType === "text" ? "nvarchar(max)" : manifestType).toUpperCase();
}

type Column = { name: string; type: string; nullable: boolean };

/** Parse the generated `CREATE TABLE dbo.X (...)` blocks out of the fixture DDL. */
function parseFixtureTables(sql: string): Map<string, Column[]> {
  const tables = new Map<string, Column[]>();
  const blocks = sql.matchAll(/CREATE TABLE dbo\.(\w+) \(([\s\S]*?)\n {4}\);/g);
  for (const [, name, body] of blocks) {
    const columns: Column[] = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");
      if (!line || line.startsWith("CONSTRAINT")) continue;
      const m = line.match(/^(\w+)\s+([A-Z]+(?:\([\w,\s]+\))?)\s+(NOT NULL|NULL)$/);
      expect(m, `${name}: unparseable column definition ${JSON.stringify(line)}`).not.toBeNull();
      columns.push({ name: m![1], type: m![2], nullable: m![3] === "NULL" });
    }
    tables.set(`dbo.${name}`, columns);
  }
  return tables;
}

const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST), "utf8")) as {
  tables: Record<string, Column[]>;
};
const fixture = parseFixtureTables(readFileSync(resolve(ROOT, SCHEMA), "utf8"));

describe("erp_fixture DDL conforms to the live db_TCL schema manifest", () => {
  it("models every table the live manifest covers, and no invented extras", () => {
    expect([...fixture.keys()].sort()).toEqual(Object.keys(manifest.tables).sort());
  });

  for (const [table, liveColumns] of Object.entries(manifest.tables)) {
    it(`${table} matches live column-for-column`, () => {
      const actual = fixture.get(table);
      expect(actual, `${table} is missing from ${SCHEMA}`).toBeDefined();

      // Compare whole shapes at once so a failure prints the full diff, not just the first column.
      expect(actual).toEqual(
        liveColumns.map((c) => ({
          name: c.name,
          type: expectedSqlType(c.type),
          nullable: c.nullable,
        })),
      );
    });
  }
});

describe("fixture seeds own rows only — never table shapes", () => {
  // The second root cause: purchase-seed.sql and production-seed.sql each used to CREATE the
  // SHARED InventoryFlow tables with their own incompatible shape, so whichever ran first decided
  // the schema. All DDL now lives in 00-schema.sql; a seed that creates or alters a table has
  // re-opened that hazard.
  for (const seed of [
    "db/erp-fixture/01-seed.sql",
    "db/erp-fixture/sales-seed.sql",
    "db/erp-fixture/purchase-seed.sql",
    "db/erp-fixture/production-seed.sql",
  ]) {
    it(`${seed} contains no CREATE TABLE or ALTER TABLE`, () => {
      // Strip `--` comments: the files legitimately DESCRIBE the old DDL in their headers.
      const code = readFileSync(resolve(ROOT, seed), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");
      expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    });
  }
});
