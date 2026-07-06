// Vendor T-SQL schema export (Phase 02, D1). Wraps `prisma migrate diff` to produce a
// standalone CREATE-TABLE DDL script the customer's DBA can review in SSMS. OFFLINE — no
// DB connection is needed (`--from-empty` diffs against nothing).
//
// The output does NOT create the database or logins — Phase 06 hand-authors those.
// Run: `pnpm tsx scripts/export-schema-sql.ts`

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "db");
const OUT_FILE = path.join(OUT_DIR, "create-orderstock-schema.sql");

function main(): void {
  // `migrate diff --from-empty --to-schema <schema> --script` renders the full schema as a
  // forward DDL script without touching any database. (Prisma 7 renamed the old
  // `--to-schema-datamodel` flag to `--to-schema`.)
  const ddl = execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      path.join("prisma", "schema.prisma"),
      "--script",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const header =
    "-- orderstock — vendor SQL Server schema creation script (Phase 02, auto-generated).\n" +
    "-- Generated offline via `prisma migrate diff --from-empty --to-schema`.\n" +
    "-- Does NOT create the database or logins — Phase 06 hand-authors those.\n" +
    "-- Review in SSMS before running against the customer's SQL Server.\n\n";
  writeFileSync(OUT_FILE, header + ddl, "utf8");

  const tableCount = (ddl.match(/CREATE TABLE/gi) ?? []).length;
  console.log(`Wrote ${OUT_FILE} (${tableCount} CREATE TABLE statements).`);
}

main();
