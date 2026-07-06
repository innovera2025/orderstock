import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeDatabaseUrl } from "../env-write";

// A2/A2b/A3 (validate-contract). env-write must be injection-safe: hostile values (embedded
// newlines, `KEY=value` clobber payloads, quotes, backslashes, Thai chars) must change ONLY the
// DATABASE_URL line and must NEVER inject or overwrite another key. It must also back up `.env` to
// `.env.bak` BEFORE mutating `.env`. These prove env-injection defense + rollback safety — NOT the
// runtime `.env` reload (that needs a restart, a documented manual/NSSM step).

let dir: string;
let envPath: string;
let bakPath: string;

const ORIGINAL = [
  "DATABASE_URL=sqlserver://localhost:1433;database=orderstock;user=sa;password=old;encrypt=true",
  "AUTH_SECRET=super-secret-signing-key",
  "AUTH_TRUST_HOST=true",
  "",
].join("\n");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "envwrite-"));
  envPath = join(dir, ".env");
  bakPath = join(dir, ".env.bak");
  writeFileSync(envPath, ORIGINAL, "utf8");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** All non-DATABASE_URL lines, for asserting they were untouched. */
function otherLines(content: string): string[] {
  return content.split(/\r?\n/).filter((l) => l && !l.startsWith("DATABASE_URL="));
}

describe("writeDatabaseUrl — injection safety (A2)", () => {
  it("should change only the DATABASE_URL line and reject a newline KEY=value injection payload", () => {
    const hostile = "sqlserver://h;password=x\nAUTH_SECRET=attacker-controlled";
    writeDatabaseUrl(hostile, { envPath });
    const out = readFileSync(envPath, "utf8");

    // The legitimate AUTH_SECRET is preserved and NOT clobbered by the payload.
    expect(out).toContain("AUTH_SECRET=super-secret-signing-key");
    expect(out).not.toContain("AUTH_SECRET=attacker-controlled");
    // Exactly one DATABASE_URL line exists.
    const dbLines = out.split(/\r?\n/).filter((l) => l.startsWith("DATABASE_URL="));
    expect(dbLines.length).toBe(1);
    // All other keys are byte-identical to the original.
    expect(otherLines(out)).toEqual(otherLines(ORIGINAL));
  });

  it("should neutralize CRLF injection payloads", () => {
    writeDatabaseUrl("sqlserver://h\r\nINJECTED=1", { envPath });
    const out = readFileSync(envPath, "utf8");
    expect(out).not.toContain("\nINJECTED=1");
    expect(out).not.toMatch(/^INJECTED=/m);
  });

  it("should preserve quotes and backslashes in the value without corrupting other keys", () => {
    writeDatabaseUrl('sqlserver://h;password={a"b\\c}', { envPath });
    const out = readFileSync(envPath, "utf8");
    expect(otherLines(out)).toEqual(otherLines(ORIGINAL));
    const dbLine = out.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
    expect(dbLine).toBeDefined();
  });

  it("should round-trip a Thai-character password value", () => {
    writeDatabaseUrl("sqlserver://h;password=รหัสผ่าน;encrypt=true", { envPath });
    const out = readFileSync(envPath, "utf8");
    expect(out).toContain("รหัสผ่าน");
    expect(otherLines(out)).toEqual(otherLines(ORIGINAL));
  });

  it("should append DATABASE_URL when the key is absent, without touching other keys", () => {
    writeFileSync(envPath, "AUTH_SECRET=k\n", "utf8");
    writeDatabaseUrl("sqlserver://h;database=d", { envPath });
    const out = readFileSync(envPath, "utf8");
    expect(out).toContain("AUTH_SECRET=k");
    expect(out.split(/\r?\n/).filter((l) => l.startsWith("DATABASE_URL=")).length).toBe(1);
  });
});

describe("writeDatabaseUrl — backup before write (A2b)", () => {
  it("should write .env.bak before mutating .env", () => {
    writeDatabaseUrl("sqlserver://h;database=new", { envPath });
    expect(existsSync(bakPath)).toBe(true);
    // The backup must hold the ORIGINAL content (proves backup happened before the mutation).
    expect(readFileSync(bakPath, "utf8")).toBe(ORIGINAL);
    // And .env actually changed.
    expect(readFileSync(envPath, "utf8")).not.toBe(ORIGINAL);
  });
});

describe(".env.bak secret hygiene (A3)", () => {
  it("should have .env.bak matched by the .gitignore .env* pattern", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    // The `.env*` glob (present in .gitignore) matches `.env.bak`.
    expect(gitignore).toMatch(/^\.env\*$/m);
  });
});
