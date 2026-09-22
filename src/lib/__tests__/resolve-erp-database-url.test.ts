import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";

// erp-dashboards Phase 1, gate INFRA-url. Mirrors `resolve-database-url.test.ts` case-for-case,
// keyed on ERP_DATABASE_URL. `resolveErpDatabaseUrl()` must raw-read the literal line with NO
// dotenv-style expansion, so a `$`/`${...}`/`\INST` password round-trips verbatim. It falls back
// to process.env when the file or line is absent, and throws a clear error when neither yields a
// value.
//
// Fixtures are written to mkdtempSync temp dirs and passed via the `envPath` param — never the
// real repo `.env`. All values are obviously-fake placeholders (repo secret-hygiene rule).

let dir: string;
let envPath: string;
let savedErpUrl: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "resolve-erp-url-"));
  envPath = join(dir, ".env");
  savedErpUrl = process.env.ERP_DATABASE_URL;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (savedErpUrl === undefined) {
    delete process.env.ERP_DATABASE_URL;
  } else {
    process.env.ERP_DATABASE_URL = savedErpUrl;
  }
});

describe("resolveErpDatabaseUrl — verbatim raw read, no `$` expansion", () => {
  it("returns a literal `$` in the password unmangled", () => {
    const value =
      "sqlserver://localhost:1433;database=erp_fixture;user=sa;password=fake$pass;encrypt=true";
    writeFileSync(envPath, `ERP_DATABASE_URL=${value}\n`, "utf8");
    expect(resolveErpDatabaseUrl(envPath)).toBe(value);
  });

  it("returns a brace-wrapped `${p$w}`-shaped value verbatim (no expansion attempted)", () => {
    const value =
      "sqlserver://localhost:1433;database=erp_fixture;user=sa;password=fa${ke}pass;encrypt=true";
    writeFileSync(envPath, `ERP_DATABASE_URL=${value}\n`, "utf8");
    expect(resolveErpDatabaseUrl(envPath)).toBe(value);
  });

  it("returns a named-instance `host\\INST` value with `$` unmangled", () => {
    const value =
      "sqlserver://localhost\\SQLEXPRESS:1433;database=erp_fixture;user=sa;password=fake$1;encrypt=true";
    writeFileSync(envPath, `ERP_DATABASE_URL=${value}\n`, "utf8");
    expect(resolveErpDatabaseUrl(envPath)).toBe(value);
  });

  it("strips a surrounding double-quote pair, leaving inner content untouched", () => {
    const inner =
      "sqlserver://localhost:1433;database=erp_fixture;user=sa;password=fake$pass;encrypt=true";
    writeFileSync(envPath, `ERP_DATABASE_URL="${inner}"\n`, "utf8");
    expect(resolveErpDatabaseUrl(envPath)).toBe(inner);
  });

  it("strips a surrounding single-quote pair, leaving inner content untouched", () => {
    const inner =
      "sqlserver://localhost:1433;database=erp_fixture;user=sa;password=fake$pass;encrypt=true";
    writeFileSync(envPath, `ERP_DATABASE_URL='${inner}'\n`, "utf8");
    expect(resolveErpDatabaseUrl(envPath)).toBe(inner);
  });

  it("returns the FIRST matching ERP_DATABASE_URL line when multiple are present (defensive)", () => {
    const first = "sqlserver://first;database=erp_fixture;password=fake$1";
    const second = "sqlserver://second;database=erp_fixture;password=fake$2";
    writeFileSync(envPath, `ERP_DATABASE_URL=${first}\nERP_DATABASE_URL=${second}\n`, "utf8");
    expect(resolveErpDatabaseUrl(envPath)).toBe(first);
  });

  it("parses CRLF line endings correctly, value unmangled", () => {
    const value =
      "sqlserver://localhost:1433;database=erp_fixture;user=sa;password=fake$pass;encrypt=true";
    writeFileSync(
      envPath,
      `AUTH_SECRET=k\r\nERP_DATABASE_URL=${value}\r\nAUTH_TRUST_HOST=true\r\n`,
      "utf8",
    );
    expect(resolveErpDatabaseUrl(envPath)).toBe(value);
  });

  it("does NOT match the plain DATABASE_URL line (key isolation)", () => {
    // A bare `DATABASE_URL=` line must never satisfy the ERP key — the two pools are separate.
    writeFileSync(envPath, `DATABASE_URL=sqlserver://localhost:1433;database=orderstock\n`, "utf8");
    delete process.env.ERP_DATABASE_URL;
    expect(() => resolveErpDatabaseUrl(envPath)).toThrow(/ERP_DATABASE_URL is not set/);
  });
});

describe("resolveErpDatabaseUrl — fallback and failure", () => {
  it("falls back to process.env.ERP_DATABASE_URL when the file is absent", () => {
    const value = "sqlserver://localhost:1433;database=erp_fixture;user=sa;password=fake$env";
    process.env.ERP_DATABASE_URL = value;
    expect(resolveErpDatabaseUrl(join(dir, "does-not-exist.env"))).toBe(value);
  });

  it("falls back to process.env when the file exists but has no ERP_DATABASE_URL line", () => {
    const value = "sqlserver://localhost:1433;database=erp_fixture;user=sa;password=fake$env2";
    writeFileSync(envPath, "AUTH_TRUST_HOST=true\n", "utf8");
    process.env.ERP_DATABASE_URL = value;
    expect(resolveErpDatabaseUrl(envPath)).toBe(value);
  });

  it("throws a clear error when neither the file nor process.env yields a value", () => {
    writeFileSync(envPath, "AUTH_TRUST_HOST=true\n", "utf8");
    delete process.env.ERP_DATABASE_URL;
    expect(() => resolveErpDatabaseUrl(envPath)).toThrow(/ERP_DATABASE_URL is not set/);
  });

  it("treats an empty ERP_DATABASE_URL= line as absent and falls through", () => {
    writeFileSync(envPath, "ERP_DATABASE_URL=\n", "utf8");
    delete process.env.ERP_DATABASE_URL;
    expect(() => resolveErpDatabaseUrl(envPath)).toThrow(/ERP_DATABASE_URL is not set/);
  });
});
