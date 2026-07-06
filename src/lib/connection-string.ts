// Phase 06 (A1). Build a JDBC-style `sqlserver://` DATABASE_URL from individual settings-page
// fields, plus a best-effort (NON-load-bearing) paste-prefill parser and a password masker.
//
// Prisma's `sqlserver` provider uses a JDBC-style URL (db-auth-feasibility_REF §1):
//   sqlserver://HOST[:PORT];database=DB;user=USER;password=PWD;encrypt=true;trustServerCertificate=true
// Values containing reserved chars ( : \ = ; / [ ] { } ) must be brace-wrapped: password={Pa:ss;word}.
// Named instances use a backslash: sqlserver://HOST\INSTANCE;...
//
// SECURITY: this module NEVER logs the password. The builder output is a secret; callers must
// treat it like one (env-write.ts writes it, never console.log).

export interface DbFields {
  host: string;
  port?: string;
  instance?: string;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

// Reserved characters that force brace-wrapping in a JDBC-style value (Prisma connection-URL rules).
const RESERVED = /[:\\=;/[\]{}]/;

/** Brace-wrap a value only when it contains a reserved char (matches Prisma's escaping rule). */
function escapeValue(value: string): string {
  return RESERVED.test(value) ? `{${value}}` : value;
}

/**
 * Build a JDBC-style `sqlserver://` DATABASE_URL from fields. A named `instance` takes precedence
 * over `port` (SQL Server resolves the port via the browser service). The password is brace-escaped
 * when it contains reserved chars.
 */
export function buildDatabaseUrl(fields: DbFields): string {
  const host = fields.host.trim();
  const instance = fields.instance?.trim();
  const port = fields.port?.trim();

  let authority = `sqlserver://${host}`;
  if (instance) {
    authority += `\\${instance}`;
  } else if (port) {
    authority += `:${port}`;
  }

  const params = [
    `database=${escapeValue(fields.database.trim())}`,
    `user=${escapeValue(fields.user.trim())}`,
    `password=${escapeValue(fields.password)}`,
    `encrypt=${fields.encrypt ? "true" : "false"}`,
    `trustServerCertificate=${fields.trustServerCertificate ? "true" : "false"}`,
  ];

  return `${authority};${params.join(";")}`;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Validate required fields (host, database, user, password) + a numeric port when present. */
export function validateDbFields(fields: DbFields): ValidationResult {
  if (!fields.host?.trim()) return { ok: false, error: "กรุณากรอกโฮสต์ (host)" };
  if (!fields.database?.trim()) return { ok: false, error: "กรุณากรอกชื่อฐานข้อมูล (database)" };
  if (!fields.user?.trim()) return { ok: false, error: "กรุณากรอกชื่อผู้ใช้ (user)" };
  if (!fields.password) return { ok: false, error: "กรุณากรอกรหัสผ่าน (password)" };
  const port = fields.port?.trim();
  if (port && !/^\d+$/.test(port)) return { ok: false, error: "พอร์ต (port) ต้องเป็นตัวเลข" };
  return { ok: true };
}

/**
 * Best-effort paste-prefill parser (NON-load-bearing — the admin reviews every field before save).
 * Accepts both an ADO.NET string (`Server=host,port;Database=...;User Id=...`) and a JDBC-style
 * `sqlserver://host:port;database=...` string. Unknown keys are ignored. NEVER throws.
 */
export function parseConnectionString(input: string): DbFields {
  const fields: DbFields = {
    host: "",
    port: "",
    instance: "",
    database: "",
    user: "",
    password: "",
    encrypt: true,
    trustServerCertificate: false,
  };
  if (!input?.trim()) return fields;

  let rest = input.trim();

  // Strip a JDBC-style `sqlserver://` authority into host/port/instance first.
  const jdbc = rest.match(/^sqlserver:\/\/([^;]+)(;.*)?$/i);
  if (jdbc) {
    applyServer(fields, jdbc[1] ?? "");
    rest = jdbc[2] ?? "";
  }

  for (const segment of rest.split(";")) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim().toLowerCase();
    let value = segment.slice(eq + 1).trim();
    // Unwrap a brace-escaped value.
    if (value.startsWith("{") && value.endsWith("}")) value = value.slice(1, -1);

    switch (key) {
      case "server":
      case "data source":
      case "address":
      case "addr":
      case "network address":
        applyServer(fields, value);
        break;
      case "database":
      case "initial catalog":
        fields.database = value;
        break;
      case "user":
      case "user id":
      case "uid":
        fields.user = value;
        break;
      case "password":
      case "pwd":
        fields.password = value;
        break;
      case "instancename":
        if (value) fields.instance = value;
        break;
      case "encrypt":
        fields.encrypt = /^(true|yes|1)$/i.test(value);
        break;
      case "trustservercertificate":
        fields.trustServerCertificate = /^(true|yes|1)$/i.test(value);
        break;
    }
  }
  return fields;
}

/** Split a `host,port` / `host:port` / `host\instance` server value into fields. */
function applyServer(fields: DbFields, raw: string): void {
  let server = raw.trim();
  // Named instance: host\INSTANCE
  const bs = server.indexOf("\\");
  if (bs !== -1) {
    fields.instance = server.slice(bs + 1).trim();
    server = server.slice(0, bs).trim();
  }
  // Port: host,port (ADO.NET) or host:port (JDBC)
  const portMatch = server.match(/^(.*?)[,:](\d+)$/);
  if (portMatch) {
    fields.host = (portMatch[1] ?? "").trim();
    fields.port = portMatch[2] ?? "";
  } else {
    fields.host = server;
  }
}

/** Fixed-length mask — never reveals length or content of the plaintext password. */
export function maskPassword(password: string): string {
  return password ? "********" : "";
}
