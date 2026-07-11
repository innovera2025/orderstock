import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDatabaseUrl } from "../resolve-database-url";

// DB URL `$`-in-password round-trip fix (validate-contract Goal-1a). `resolveDatabaseUrl()` must
// raw-read the literal `DATABASE_URL` line from the target file with NO dotenv-style expansion, so
// a `$`/`${...}`/`\INST` password round-trips verbatim. It falls back to process.env when the file
// or line is absent, and throws the existing clear error when neither yields a value.
//
// Fixtures are written to mkdtempSync temp dirs and the path is passed via the `envPath` param —
// never the real repo `.env`. All values are obviously-fake placeholders (repo secret-hygiene rule).

let dir: string;
let envPath: string;

// Snapshot/restore process.env.DATABASE_URL so fallback cases are deterministic and isolated.
let savedDbUrl: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "resolve-db-url-"));
  envPath = join(dir, ".env");
  savedDbUrl = process.env.DATABASE_URL;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (savedDbUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = savedDbUrl;
  }
});

describe("resolveDatabaseUrl — verbatim raw read, no `$` expansion (Goal-1a)", () => {
  it("returns a literal `$` in the password unmangled", () => {
    const value = "sqlserver://localhost:1433;database=orderstock;user=sa;password=fake$pass;encrypt=true";
    writeFileSync(envPath, `DATABASE_URL=${value}\n`, "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(value);
  });

  it("returns a brace-wrapped `${p$w}`-shaped value verbatim (no expansion attempted)", () => {
    const value = "sqlserver://localhost:1433;database=orderstock;user=sa;password=fa${ke}pass;encrypt=true";
    writeFileSync(envPath, `DATABASE_URL=${value}\n`, "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(value);
  });

  it("returns a named-instance `host\\INST` value with `$` unmangled", () => {
    const value = "sqlserver://localhost\\SQLEXPRESS:1433;database=orderstock;user=sa;password=fake$1;encrypt=true";
    writeFileSync(envPath, `DATABASE_URL=${value}\n`, "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(value);
  });

  it("strips a surrounding double-quote pair, leaving inner content untouched", () => {
    const inner = "sqlserver://localhost:1433;database=orderstock;user=sa;password=fake$pass;encrypt=true";
    writeFileSync(envPath, `DATABASE_URL="${inner}"\n`, "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(inner);
  });

  it("strips a surrounding single-quote pair, leaving inner content untouched", () => {
    const inner = "sqlserver://localhost:1433;database=orderstock;user=sa;password=fake$pass;encrypt=true";
    writeFileSync(envPath, `DATABASE_URL='${inner}'\n`, "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(inner);
  });

  it("returns the FIRST matching DATABASE_URL line when multiple are present (defensive)", () => {
    const first = "sqlserver://first;password=fake$1";
    const second = "sqlserver://second;password=fake$2";
    writeFileSync(envPath, `DATABASE_URL=${first}\nDATABASE_URL=${second}\n`, "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(first);
  });

  it("parses CRLF line endings correctly, value unmangled", () => {
    const value = "sqlserver://localhost:1433;database=orderstock;user=sa;password=fake$pass;encrypt=true";
    // Surround with other CRLF lines to prove the `/\r?\n/` split isolates the value.
    writeFileSync(envPath, `AUTH_SECRET=k\r\nDATABASE_URL=${value}\r\nAUTH_TRUST_HOST=true\r\n`, "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(value);
  });
});

describe("resolveDatabaseUrl — fallback + throw behavior", () => {
  it("falls back to process.env.DATABASE_URL when the fixture file is missing", () => {
    const fallback = "sqlserver://fallbackhost:1433;database=orderstock;user=sa;password=fallback$x";
    process.env.DATABASE_URL = fallback;
    // envPath points at a file that was never created inside the temp dir.
    expect(resolveDatabaseUrl(join(dir, "does-not-exist.env"))).toBe(fallback);
  });

  it("falls back to process.env.DATABASE_URL when the file has no DATABASE_URL line", () => {
    const fallback = "sqlserver://fallbackhost:1433;database=orderstock;user=sa;password=fallback$y";
    process.env.DATABASE_URL = fallback;
    writeFileSync(envPath, "AUTH_SECRET=k\nAUTH_TRUST_HOST=true\n", "utf8");
    expect(resolveDatabaseUrl(envPath)).toBe(fallback);
  });

  it("throws the clear error when neither the file nor process.env yields a value", () => {
    delete process.env.DATABASE_URL;
    // File absent AND process.env unset.
    expect(() => resolveDatabaseUrl(join(dir, "does-not-exist.env"))).toThrow(
      "DATABASE_URL is not set — cannot construct the Prisma SQL Server adapter.",
    );
  });
});
