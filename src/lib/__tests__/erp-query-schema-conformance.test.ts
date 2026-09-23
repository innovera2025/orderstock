import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { analyseSql } from "../erp-sql-columns";
import { ERP_QUERY_COLUMNS } from "../erp-query-columns";

// THE GATE THAT WOULD HAVE CAUGHT THE 23-09-26 PRODUCTION DEFECT.
//
// WHAT HAPPENED: every ERP dashboard page rendered "ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้" against the
// live `db_TCL`, while `/api/health/erp` reported healthy and the entire local suite was green. The
// queries were not logically wrong — they named columns that DO NOT EXIST on the live tables, so
// SQL Server rejected them outright:
//
//   * `dbo.tbl_DOhdr.IsCancel`          — the live flags are IsApproved/IsClosed/IsComplete/IsCheck/IsAcc
//   * `dbo.InventoryFlowDtl.Qty`        — the live quantity column is MainQuantity
//   * `dbo.InventoryFlowHdr.TransactionDate` — the live flow date is InOutDate
//
// WHY NOTHING CAUGHT IT: the local `erp_fixture` sandbox was hand-built from a PROSE data
// dictionary rather than from the live column list, so it contained the same invented columns. The
// query and the fixture agreed with each other and both disagreed with production. Tests that only
// ever compare code against a fixture can never detect that the fixture itself is the fiction.
//
// WHAT THIS GATE DOES: checks the SQL against `db/erp-schema/live-manifest_23-09-26.json` — a
// metadata-only capture of the REAL columns, read from `sys.columns` on the live server. It is a
// pure text/JSON analysis: no database, no Docker, no network, so it runs in every environment and
// cannot be skipped into uselessness.
//
// Its sibling `erp-fixture-schema-conformance.test.ts` holds the fixture DDL to the same manifest.
// Together: the fixture may not invent a shape, and the queries may not read one.

const ROOT = resolve(__dirname, "../../..");
const MANIFEST = "db/erp-schema/live-manifest_23-09-26.json";
const QUERY_DIR = "db/erp-queries";

type ManifestColumn = { name: string; type: string; nullable: boolean };

const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST), "utf8")) as {
  tables: Record<string, ManifestColumn[]>;
};

/** table -> lowercased column name -> live casing. Lookups are case-insensitive, as SQL Server is. */
const liveColumns = new Map<string, Map<string, string>>(
  Object.entries(manifest.tables).map(([table, columns]) => [
    table,
    new Map(columns.map((c) => [c.name.toLowerCase(), c.name])),
  ]),
);

function listQueryFiles(): string[] {
  const files: string[] = [];
  for (const domain of readdirSync(resolve(ROOT, QUERY_DIR), { withFileTypes: true })) {
    if (!domain.isDirectory()) continue;
    for (const entry of readdirSync(resolve(ROOT, QUERY_DIR, domain.name))) {
      if (entry.endsWith(".sql")) files.push(`${QUERY_DIR}/${domain.name}/${entry}`);
    }
  }
  return files.sort();
}

const queryFiles = listQueryFiles();
const analyses = new Map(
  queryFiles.map((file) => [file, analyseSql(readFileSync(resolve(ROOT, file), "utf8"))]),
);

describe("every dashboard query is covered by the schema gate", () => {
  // Coverage is asserted in BOTH directions so the gate cannot be bypassed by simply adding a new
  // query file and never declaring it — silent non-coverage is how a regression gate dies.
  it("declares a column contract for every .sql file on disk, and no phantom files", () => {
    expect(Object.keys(ERP_QUERY_COLUMNS).sort()).toEqual(queryFiles);
  });

  it("finds a non-trivial number of queries (the file scan itself is not silently empty)", () => {
    expect(queryFiles.length).toBeGreaterThanOrEqual(13);
  });
});

describe("query SQL references only columns that exist on the live ERP", () => {
  for (const file of queryFiles) {
    const analysis = analyses.get(file)!;

    it(`${file}: every qualified column reference exists live`, () => {
      // This check is fully automatic — it needs no declaration and cannot fall out of date.
      // `h.IsCancel` in do-headers.sql failed exactly here.
      const unknown = analysis.refs
        .filter((ref) => !liveColumns.get(ref.table)?.has(ref.column.toLowerCase()))
        .map((ref) => `${ref.raw} -> ${ref.table}.${ref.column}`);
      expect(unknown, `${file} reads columns absent from ${MANIFEST}`).toEqual([]);
    });

    it(`${file}: every table it queries is covered by the manifest`, () => {
      const uncovered = [...analysis.tables].filter((table) => !liveColumns.has(table));
      expect(
        uncovered,
        `${file} queries ${uncovered.join(", ")}, which the manifest does not describe — re-capture the manifest (see db/erp-schema/README.md) before shipping this query`,
      ).toEqual([]);
    });

    it(`${file}: the analyser resolved every reference (nothing skipped silently)`, () => {
      // An unresolved alias or an alias bound to two tables means some reference was NOT checked
      // above. Treating that as "fine" is precisely how a gate becomes vacuous.
      expect(analysis.problems.map((p) => `${p.kind}: ${p.detail}`)).toEqual([]);
    });
  }
});

describe("declared column contracts agree with the live ERP and with the SQL", () => {
  for (const [file, declared] of Object.entries(ERP_QUERY_COLUMNS)) {
    const analysis = analyses.get(file);

    it(`${file}: every declared column exists live`, () => {
      expect(analysis, `${file} is declared but does not exist on disk`).toBeDefined();
      const unknown: string[] = [];
      for (const [table, columns] of Object.entries(declared)) {
        const live = liveColumns.get(table);
        if (!live) {
          unknown.push(`${table} (whole table absent from manifest)`);
          continue;
        }
        for (const column of columns) {
          if (!live.has(column.toLowerCase())) unknown.push(`${table}.${column}`);
        }
      }
      expect(unknown, `${file} declares columns absent from ${MANIFEST}`).toEqual([]);
    });

    it(`${file}: declares exactly the tables the SQL actually queries`, () => {
      expect(Object.keys(declared).sort()).toEqual([...analysis!.tables].sort());
    });

    it(`${file}: declares every column the SQL reads`, () => {
      // Closes the omission hole: the contract cannot be trimmed down to only the safe columns.
      const declaredByTable = new Map(
        Object.entries(declared).map(([table, columns]) => [
          table,
          new Set(columns.map((c) => c.toLowerCase())),
        ]),
      );

      const missing: string[] = [];
      for (const ref of analysis!.refs) {
        if (!declaredByTable.get(ref.table)?.has(ref.column.toLowerCase())) {
          missing.push(`${ref.table}.${ref.column} (read as ${ref.raw})`);
        }
      }

      // Unqualified reads (`SELECT ItemCode ... FROM dbo.InventoryItem` inside a CTE) cannot be
      // attributed to one table by static analysis — `ItemCode` is a real column on several of
      // these tables. They must therefore be declared under SOME table this file queries; the
      // "every declared column exists live" check above keeps that from being a free pass.
      const declaredAnywhere = new Set(
        Object.values(declared).flatMap((columns) => columns.map((c) => c.toLowerCase())),
      );
      for (const bare of analysis!.bareIdentifiers) {
        if (!declaredAnywhere.has(bare.toLowerCase())) {
          missing.push(`${bare} (unqualified read, declared under no table)`);
        }
      }

      expect([...new Set(missing)].sort()).toEqual([]);
    });

    it(`${file}: declares nothing the file never mentions`, () => {
      // The anti-padding check the task calls for: a declared column must genuinely appear as an
      // identifier in the query text. Without this, the contract could be inflated with real-but-
      // unused live column names until the "exists live" check passed by construction, and the
      // declaration would stop describing the file.
      const mentioned = new Set([...analysis!.allIdentifiers].map((w) => w.toLowerCase()));
      const unused: string[] = [];
      for (const [table, columns] of Object.entries(declared)) {
        for (const column of columns) {
          if (!mentioned.has(column.toLowerCase())) unused.push(`${table}.${column}`);
        }
      }
      expect(unused, `${file} declares columns its SQL never mentions`).toEqual([]);
    });
  }
});

describe("the embedded SQL constants cannot escape this gate", () => {
  // `src/lib/{sales,purchase,production}-sql.ts` embed byte-identical copies of these files
  // (the standalone build does not ship `db/`), and those copies are what actually runs. Their
  // byte-identity with the .sql files is asserted by the existing domain test suites; this check
  // makes sure every .sql file that the gate reads is in fact one of the embedded ones, so the two
  // guarantees chain end to end instead of leaving an unembedded, unchecked query in the middle.
  it("every gated .sql file is embedded in a *_SQL_SOURCES list", async () => {
    const [sales, purchase, production] = await Promise.all([
      import("../sales-sql"),
      import("../purchase-sql"),
      import("../production-sql"),
    ]);
    const embedded = [
      ...sales.SALES_SQL_SOURCES,
      ...purchase.PURCHASE_SQL_SOURCES,
      ...production.PRODUCTION_SQL_SOURCES,
    ].map((entry) => entry.file);
    expect([...embedded].sort()).toEqual(queryFiles);
  });
});

describe("the fixture DDL cannot invent columns either", () => {
  // Deliberately overlaps `erp-fixture-schema-conformance.test.ts` (which does a stricter
  // column-for-column diff). The root cause was a fixture that disagreed with production, so the
  // cheapest possible restatement of "no invented fixture column" is worth keeping here too: if
  // the strict test is ever deleted or weakened, this one still fails loudly.
  const schemaSql = readFileSync(resolve(ROOT, "db/erp-fixture/00-schema.sql"), "utf8");
  const blocks = [...schemaSql.matchAll(/CREATE TABLE dbo\.(\w+) \(([\s\S]*?)\n {4}\);/g)];

  it("parses a CREATE TABLE block for every manifest table", () => {
    expect(blocks.map(([, name]) => `dbo.${name}`).sort()).toEqual(
      Object.keys(manifest.tables).sort(),
    );
  });

  for (const [, name, body] of blocks) {
    const table = `dbo.${name}`;
    it(`${table}: no fixture column is absent from the live schema`, () => {
      const live = liveColumns.get(table)!;
      const invented = body
        .split("\n")
        .map((line) => line.trim().replace(/,$/, ""))
        .filter((line) => line.length > 0 && !line.startsWith("CONSTRAINT"))
        .map((line) => line.match(/^(\w+)\s/)?.[1])
        .filter((column): column is string => Boolean(column))
        .filter((column) => !live.has(column.toLowerCase()));
      expect(invented, `${table} defines columns that do not exist on the live server`).toEqual([]);
    });
  }
});
