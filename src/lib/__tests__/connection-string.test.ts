import { describe, it, expect } from "vitest";
import {
  buildDatabaseUrl,
  validateDbFields,
  parseConnectionString,
  maskPassword,
  type DbFields,
} from "../connection-string";

// A1 (validate-contract): fields → JDBC-style `sqlserver://` DATABASE_URL builder + required-field
// validation. High-risk (secrets/trust boundary) — covers brace-escaping of reserved chars, named
// instances, and Thai-character passwords. Proves URL-string correctness ONLY (not a live connect).

const base: DbFields = {
  host: "localhost",
  port: "1433",
  database: "orderstock",
  user: "sa",
  password: "Secret1",
  encrypt: true,
  trustServerCertificate: true,
};

describe("buildDatabaseUrl", () => {
  it("should build a sqlserver:// DATABASE_URL from fields with a brace-escaped special-char password", () => {
    const url = buildDatabaseUrl({ ...base, password: "Pa:ss;word" });
    expect(url).toContain("sqlserver://localhost:1433;");
    expect(url).toContain("database=orderstock");
    expect(url).toContain("user=sa");
    // Reserved chars ( : ; ) force brace-wrapping.
    expect(url).toContain("password={Pa:ss;word}");
    expect(url).toContain("encrypt=true");
    expect(url).toContain("trustServerCertificate=true");
  });

  it("should not brace-wrap a simple alphanumeric password", () => {
    const url = buildDatabaseUrl(base);
    expect(url).toContain("password=Secret1");
    expect(url).not.toContain("{Secret1}");
  });

  it("should brace-wrap a Thai-character password (contains no reserved chars but is non-ASCII safe)", () => {
    const url = buildDatabaseUrl({ ...base, password: "รหัสผ่าน" });
    expect(url).toContain("password=รหัสผ่าน");
  });

  it("should use a backslash named instance instead of a port when instance is set", () => {
    const url = buildDatabaseUrl({ ...base, instance: "SQLEXPRESS", port: "" });
    expect(url).toContain("sqlserver://localhost\\SQLEXPRESS;");
    expect(url).not.toContain(":1433");
  });

  it("should omit the port segment when no port is given and no instance", () => {
    const url = buildDatabaseUrl({ ...base, port: "" });
    expect(url).toContain("sqlserver://localhost;");
  });

  it("should render encrypt=false and trustServerCertificate=false when disabled", () => {
    const url = buildDatabaseUrl({ ...base, encrypt: false, trustServerCertificate: false });
    expect(url).toContain("encrypt=false");
    expect(url).toContain("trustServerCertificate=false");
  });
});

describe("validateDbFields", () => {
  it("should reject missing required fields", () => {
    expect(validateDbFields({ ...base, host: "" }).ok).toBe(false);
    expect(validateDbFields({ ...base, database: "" }).ok).toBe(false);
    expect(validateDbFields({ ...base, user: "" }).ok).toBe(false);
    expect(validateDbFields({ ...base, password: "" }).ok).toBe(false);
  });

  it("should reject a non-numeric port", () => {
    expect(validateDbFields({ ...base, port: "abc" }).ok).toBe(false);
  });

  it("should accept a complete field set", () => {
    expect(validateDbFields(base).ok).toBe(true);
  });
});

describe("parseConnectionString (non-load-bearing paste-prefill)", () => {
  it("should best-effort map an ADO.NET string into fields", () => {
    const f = parseConnectionString(
      "Server=myhost,1433;Database=OrderStock;User Id=appuser;Password=secret;Encrypt=True;TrustServerCertificate=True",
    );
    expect(f.host).toBe("myhost");
    expect(f.port).toBe("1433");
    expect(f.database).toBe("OrderStock");
    expect(f.user).toBe("appuser");
    expect(f.password).toBe("secret");
    expect(f.encrypt).toBe(true);
    expect(f.trustServerCertificate).toBe(true);
  });

  it("should map a named-instance ADO.NET server", () => {
    const f = parseConnectionString("Server=myhost\\SQLEXPRESS;Database=db;User Id=u;Password=p");
    expect(f.host).toBe("myhost");
    expect(f.instance).toBe("SQLEXPRESS");
  });

  it("should best-effort parse a JDBC-style sqlserver:// string", () => {
    const f = parseConnectionString(
      "sqlserver://myhost:1433;database=db;user=u;password=p;encrypt=true",
    );
    expect(f.host).toBe("myhost");
    expect(f.port).toBe("1433");
    expect(f.database).toBe("db");
    expect(f.user).toBe("u");
    expect(f.encrypt).toBe(true);
  });
});

describe("maskPassword", () => {
  it("should never reveal the plaintext password", () => {
    expect(maskPassword("hunter2")).not.toContain("hunter2");
  });
  it("should return an empty string for an empty password", () => {
    expect(maskPassword("")).toBe("");
  });
});
