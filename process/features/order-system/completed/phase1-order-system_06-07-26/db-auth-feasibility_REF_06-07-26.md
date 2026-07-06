# Database + Auth Feasibility Research — orderstock (as of July 2026)

Scope: Prisma ORM + SQL Server connector, runtime connection strings, SQL script delivery for a vendor DBA, SQL Server 2016–2019 compatibility, Docker sandbox on Apple Silicon, Auth.js/NextAuth for App Router credentials login, and fallback ORMs.

**Bottom line:** Prisma + SQL Server is viable with no blocker, BUT two facts change the standard tutorial architecture: (1) **Prisma 7 (current major, 7.8.0) removed `datasourceUrl`/`datasources` constructor options** — runtime connection strings now go through the `@prisma/adapter-mssql` driver adapter; (2) **SQL Server 2016 is below Prisma's official support floor (2017+)** — the customer's actual version must be confirmed.

---

## 1. Prisma + SQL Server connector: status, connection string format, runtime override

### Current status
- SQL Server support is **GA** (since Prisma 3.0.1, 2021) and remains a first-class provider. ([Prisma blog — SQL Server GA](https://www.prisma.io/blog/prisma-microsoft-sql-server-azure-sql-production-ga), [Prisma SQL Server docs](https://www.prisma.io/docs/orm/overview/databases/sql-server))
- Current Prisma ORM major is **v7**. Verified via npm registry: `@prisma/client` latest = **7.8.0**, published 2026-04-22. Prisma 7.0.0 shipped 2025-11-19 ("Rust-free Prisma Client becomes the default"). ([Prisma changelog 2025-11-19](https://www.prisma.io/changelog/2025-11-19), [Upgrade to Prisma ORM 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7))

### Connection string format: JDBC-style, NOT ADO.NET
Prisma's `sqlserver` provider uses a **JDBC-style** URL — identical to a JDBC SQL Server string minus the `jdbc:` prefix:

```
sqlserver://HOST[:PORT];database=DATABASE;user=USER;password=PASSWORD;encrypt=true
```

- Values containing `: \ = ; / [ ] { }` must be wrapped in curly braces: `password={Pass:Word;}`.
- Named instances supported: `sqlserver://mycomputer\sql2019;...` (or `instanceName=` param).
- `encrypt=true` is the default; `trustServerCertificate=true` available for self-signed certs; `integratedSecurity=true` for Windows auth.
- Sources: [Connection URLs reference](https://www.prisma.io/docs/orm/reference/connection-urls), [Microsoft SQL Server connector docs](https://www.prisma.io/docs/orm/overview/databases/sql-server), [GitHub discussion #6936](https://github.com/prisma/prisma/discussions/6936)

**ADO.NET → Prisma conversion needed.** A customer-provided ADO.NET string like `Server=myhost,1433;Database=OrderStock;User Id=appuser;Password=secret;Encrypt=True;TrustServerCertificate=True` is NOT accepted directly. Mapping table for the settings page:

| ADO.NET key | Prisma JDBC-style equivalent |
|---|---|
| `Server=host,port` / `Data Source=` | `sqlserver://host:port` (comma → colon) |
| `Server=host\INSTANCE` | `sqlserver://host\INSTANCE` or `instanceName=INSTANCE` |
| `Database=` / `Initial Catalog=` | `;database=` |
| `User Id=` / `UID=` | `;user=` |
| `Password=` / `PWD=` | `;password=` (brace-escape special chars) |
| `Encrypt=True/False` | `;encrypt=true/false` |
| `TrustServerCertificate=True` | `;trustServerCertificate=true` |
| `Integrated Security=SSPI/true` | `;integratedSecurity=true` |
| `Connect Timeout=` | `;loginTimeout=` / `;connectTimeout=` |

### Runtime datasource override — the critical Prisma 7 change
- **Prisma 5.2 → 6.x:** `new PrismaClient({ datasourceUrl: "sqlserver://..." })` and `new PrismaClient({ datasources: { db: { url } } })` worked — constructor-time only, never per-query. ([Prisma 5.2.0 release notes](https://github.com/prisma/prisma/releases/tag/5.2.0), [Prisma Client API reference](https://www.prisma.io/docs/orm/v6/reference/prisma-client-reference), [issue #18314](https://github.com/prisma/prisma/issues/18314))
- **Prisma 7: both options were REMOVED.** The Rust-free client requires an explicit **driver adapter** passed to the constructor. ([Upgrade to Prisma ORM 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [issue #28665](https://github.com/prisma/prisma/issues/28665) — "Using engine type 'client' requires either 'adapter' or 'accelerateUrl'")
- The SQL Server adapter is **`@prisma/adapter-mssql`** (npm latest 7.8.0, published 2026-04-22; depends on `mssql` ^12.2.0 — the node-mssql/tedious driver; verified via npm registry).
- **Verified in adapter source code** ([packages/adapter-mssql/src/mssql.ts](https://github.com/prisma/prisma/tree/main/packages/adapter-mssql)): the constructor is
  `constructor(configOrString: sql.config | string, options?: PrismaMssqlOptions)` — it accepts **either** a node-mssql config object **or** a JDBC-style `sqlserver://` string (parsed internally via `parseConnectionString`). Usage from the adapter README:

```ts
import { PrismaMssql } from '@prisma/adapter-mssql'
import { PrismaClient } from '@prisma/client'

// Option A: JDBC-style string (Prisma format)
const adapter = new PrismaMssql(
  'sqlserver://localhost:1433;database=orderstock;user=sa;password=***;encrypt=true'
)
// Option B: mssql config object
// const adapter = new PrismaMssql({ server, port, database, user, password, options: { encrypt, trustServerCertificate } })

const prisma = new PrismaClient({ adapter })
```

**Architecture implication for the runtime settings page:**
- The connection is bound **per PrismaClient instance**, not per request. Creating a client spins up an `mssql` connection pool (v7 defaults: 15s connect timeout, 30s idle timeout), so per-request clients are an anti-pattern.
- Recommended pattern: store the customer string in a config file/env → on settings save, validate by constructing a throwaway `PrismaClient` + `SELECT 1` (`$queryRaw`) → then **swap a module-level singleton** (call `$disconnect()` on the old client) or restart the app. "Per app restart" is the safest; hot singleton-swap is feasible since Prisma 7 makes the connection fully programmatic.
- Because the adapter also accepts an `sql.config` **object**, the settings page can parse the customer's ADO.NET string itself (or via node-mssql's own connection-string support) into a config object — avoiding lossy string-to-string conversion. Also note that the **Prisma CLI (migrate/introspect) still needs the JDBC-style URL** in `prisma.config.ts` / env, separate from the runtime adapter.

---

## 2. Generating a plain .sql schema script for the vendor DBA

Exact command (offline — **no database connection required** for `--from-empty` → `--to-schema`):

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > db/create-orderstock-schema.sql
```

(Older Prisma versions call the flag `--to-schema-datamodel`; Prisma 7 uses `--to-schema` and may need `--config ./prisma.config.ts`. `-o/--output` is available since 5.12.1.)

- Because the schema declares `provider = "sqlserver"`, output is T-SQL DDL (CREATE TABLE, constraints, indexes) that a DBA can review and run in SSMS.
- Sources: [prisma migrate diff reference](https://www.prisma.io/docs/cli/migrate/diff), [Prisma CLI reference](https://www.prisma.io/docs/orm/reference/prisma-cli-reference), [Baseline with SQL Server guide](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases/baseline-your-database-node-sqlserver), [migrate diff / db execute workflows showcase](https://github.com/prisma/prisma/discussions/14101)

**Caveats:**
- The script covers only features Prisma models — no views, triggers, stored procedures, or fine-grained permissions. Fine for this greenfield schema.
- The script **does not create the database itself** — the DBA creates the DB (and login/user with `db_owner` or scoped rights) first, then runs the script inside it.
- Default schema is `dbo`; if the customer DBA uses another schema, it must match the `schema=` parameter in the app's connection string.
- For the dev sandbox, apply the same script with `npx prisma db execute --file ... ` or use normal `prisma migrate dev`, and hand the DBA the concatenated migration SQL. Keep the handed-off script as the single source of truth for production.
- If the app is later upgraded, generate delta scripts the same way (`--from-...` a snapshot of the deployed schema → `--to-schema` the new one).

---

## 3. SQL Server compatibility floor (2016 / 2017 / 2019)

- **Prisma officially supports Microsoft SQL Server 2017 and newer.** SQL Server **2016 is NOT in the supported matrix.** ([Supported databases](https://www.prisma.io/docs/orm/reference/supported-databases) — "Microsoft SQL Server: 2017"; fetched and confirmed July 2026.)
  - It may work in practice (tedious speaks TDS 7.4, which SQL Server 2016 supports), but it is unsupported territory — **confirm the customer's actual version before committing**. 2017 and 2019 are fully supported.
- Connector-level caveats that apply on any 2017–2019 target ([SQL Server connector docs](https://www.prisma.io/docs/orm/overview/databases/sql-server)):
  - No native `Json` Prisma type for SQL Server (store JSON as `NVarChar(Max)` if ever needed; Phase 1 doesn't need it).
  - SQL Server allows only **one NULL per UNIQUE constraint** — relevant if any optional column gets `@unique`.
  - Self-relations / multiple cascade paths require `onDelete: NoAction, onUpdate: NoAction` (SQL Server rejects cyclic cascade paths).
  - Raw-query string params bind as `NVARCHAR(4000)`/`NVARCHAR(MAX)`; `CAST` to `VARCHAR(N)` in raw queries when hitting VARCHAR indexes.
  - Adding/removing `autoincrement()` (IDENTITY) later forces table recreation in migrations.
- Nothing in a plain Phase-1 schema (identities, NVARCHAR, DATETIME2, DECIMAL, FKs, unique indexes) needs anything newer than SQL Server 2016 compatibility level at the T-SQL level — the risk is purely Prisma's official support statement, not the generated DDL.
- Sandbox tip: run the dev database at the customer's compatibility level (`ALTER DATABASE ... SET COMPATIBILITY_LEVEL = 140` for 2017 / `150` for 2019) to keep the handed-off script honest.

---

## 4. Sandbox SQL Server in Docker on Apple Silicon macOS (2025–2026)

- **Do NOT use Azure SQL Edge**: retired **September 30, 2025** (image no longer maintained; it also lacked full SQL Server features). ([Microsoft Lifecycle — Azure SQL Edge](https://learn.microsoft.com/en-us/lifecycle/products/azure-sql-edge), [Azure retirements Sept 2025](https://learn.microsoft.com/en-us/lifecycle/announcements/azure-products-retirement-september-2025))
- **Recommended approach (Microsoft's own guidance):** run the real x86_64 image `mcr.microsoft.com/mssql/server:2022-latest` under **Docker Desktop with "Use Rosetta for x86/amd64 emulation on Apple Silicon" enabled** (Docker Desktop 4.16+, Virtualization framework). Microsoft reports near-native performance for dev use. ([Azure SQL Dev Blog — SQL in containers on macOS](https://devblogs.microsoft.com/azure-sql/development-with-sql-in-containers-on-macos/), [database.guide 2026 install guide](https://database.guide/how-to-install-sql-server-on-a-mac-in-2026/))

```bash
docker run --platform linux/amd64 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='Str0ng!Passw0rd' \
  -p 1433:1433 --name orderstock-sql -d mcr.microsoft.com/mssql/server:2022-latest
```

- **Known pitfalls:**
  - There is still **no official ARM64 mssql image** ([microsoft/mssql-docker issue #802](https://github.com/microsoft/mssql-docker/issues/802) remains open).
  - Rosetta must be installed: `softwareupdate --install-rosetta`.
  - SA password must meet complexity policy or the container exits silently; check `docker logs`.
  - Container needs ≥2 GB RAM.
  - **SQL Server 2025 RTM crashed** under Docker Desktop's Rosetta (missing AVX instructions; `x86_avx_state_ptr` assertion). Fixed in **SQL Server 2025 CU1 (Feb 2026)**; OrbStack also works (its emulator supports AVX). Not relevant if you use the 2022 image. ([Nocentino — SQL Server 2025 Docker Desktop AVX issue](https://www.nocentino.com/posts/2025-11-26-sql-server-2025-docker-desktop-avx-issue/))
  - Version-matching: a `2019-latest` image also runs under Rosetta if you want closer parity with the customer; otherwise use 2022 + a lowered compatibility level (see §3).

---

## 5. Auth.js / NextAuth for App Router credentials login

- **Version reality (verified via npm registry, July 2026):** `next-auth` `latest` = **4.24.14**; `beta` = **5.0.0-beta.31** (published 2026-04-14). **v5 ("Auth.js") is still in beta** — it never shipped a stable 5.0.0 — but it is the version the official authjs.dev docs teach for App Router and is widely used in production. Recommendation: **use `next-auth@5.0.0-beta.x` (pin exact version)**; v4 is the fallback if beta status is unacceptable. ([authjs.dev — Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5), npm registry data)
- **Credentials provider:** configure with an `authorize` callback that looks up the user via Prisma and verifies the password hash. Auth.js's own docs discourage passwords in favor of OAuth/passkeys but explicitly keep the provider supported. ([Credentials provider guide](https://authjs.dev/getting-started/authentication/credentials))
- **Session strategy: JWT is effectively mandatory with Credentials.** "The Credentials provider can only be used if JSON Web Tokens are enabled for sessions. Users authenticated with the Credentials provider are not persisted in the database." If you ever add a database adapter, you must still force `session: { strategy: "jwt" }`. For this app: **no Auth.js adapter needed at all** — the `User` table is your own Prisma model; Auth.js only issues the JWT session cookie. ([NextAuth Credentials docs](https://next-auth.js.org/providers/credentials), [FAQ](https://next-auth.js.org/faq), [discussion #4394](https://github.com/nextauthjs/next-auth/discussions/4394), [session strategies](https://authjs.dev/concepts/session-strategies))
- **Role-based access (ADMIN/STAFF)** ([Auth.js RBAC guide](https://authjs.dev/guides/role-based-access-control)):
  1. `authorize()` returns `{ id, username, role }`.
  2. `jwt` callback: `if (user) token.role = user.role`.
  3. `session` callback: `session.user.role = token.role`.
  4. **Middleware**: export `auth` as middleware (or use the `authorized` callback in config); gate `/admin/**` on `req.auth?.user?.role === "ADMIN"`. JWT strategy means middleware does a signature check only — no DB call.
  5. **Server components / actions**: re-check with `await auth()` before rendering or mutating — middleware is a convenience layer, not the security boundary.
- **Split-config pattern**: keep `auth.config.ts` edge-safe (no Prisma, no bcrypt imports) and put the Credentials provider + Prisma + hash verification in `auth.ts` used by the Node runtime. `authorize()` runs server-side in the Node runtime, so native hashing libs are fine there; never import them into middleware. ([Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5), [LogRocket 2026 auth-library comparison](https://blog.logrocket.com/best-auth-library-nextjs-2026/))
- **Password hashing**: per the [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), **argon2id is the first choice** (e.g. `@node-rs/argon2` or `argon2` npm packages); **bcrypt is acceptable** (work factor ≥10; mind the 72-byte input limit; `bcryptjs` if you want a dependency without native builds). For a low-traffic internal app either is fine; argon2id via `@node-rs/argon2` is the modern default.

---

## 6. Alternatives if Prisma + SQL Server hits a blocker

No blocker found, but the fallback ladder is:

1. **Kysely + built-in `MssqlDialect`** — stable, type-safe SQL builder over `tedious` + `tarn` pooling; connection config is a plain tedious config built at runtime (trivially compatible with a settings page). No schema-diff SQL generation like Prisma's, though — you hand-write migrations. ([Kysely MssqlDialect API](https://kysely-org.github.io/kysely-apidoc/classes/MssqlDialect.html), [Getting started](https://kysely.dev/docs/getting-started))
2. **Drizzle ORM MSSQL** — now exists, but **only in the 1.0.0-beta/rc line** (verified via npm: `drizzle-orm@latest` is still 0.45.2 without MSSQL; MSSQL ships in `1.0.0-beta.2+`, currently at `1.0.0-rc.4`). Watch it, don't bet Phase 1 on it. ([Drizzle MSSQL docs](https://orm.drizzle.team/docs/get-started-mssql), [v1 roadmap](https://orm.drizzle.team/roadmap))
3. **`mssql` (node-mssql) raw** — v12.x, mature, accepts config objects and connection strings; already underneath `@prisma/adapter-mssql`, so it's the escape hatch for any odd query.

---

## Recommended architecture decisions (from these findings)

1. Pin **Prisma 7.x** and build on `@prisma/adapter-mssql` from day one (do not follow pre-7 `datasourceUrl` tutorials).
2. Settings page stores the customer connection string; a small parser converts ADO.NET → `sql.config` object (or JDBC-style string); validation = temp client + `SELECT 1`; apply = singleton swap or app restart. Per-request switching: not supported, not needed.
3. Ship the DBA a reviewed `migrate diff --from-empty --to-schema --script` T-SQL file; keep it in the repo.
4. Dev sandbox: `mssql/server:2022-latest` under Docker Desktop Rosetta; optionally set DB compatibility level to the customer's version.
5. Auth: `next-auth@5 beta` (pinned), Credentials provider, `strategy: "jwt"`, role in token, split config, argon2id or bcrypt hashing in `authorize()`.
6. **Ask the customer for their exact SQL Server version now** — 2016 would put Prisma out of official support.


---

## Load-Bearing Claims (db-auth)

- Current Prisma ORM major version is 7; @prisma/client latest is 7.8.0, published 2026-04-22 (verified via npm registry). — **VERIFIED CONFIRMED**
- Prisma 7 removed the PrismaClient constructor options datasourceUrl and datasources; a driver adapter (or accelerateUrl) must be passed instead. — **VERIFIED CONFIRMED**
- @prisma/adapter-mssql (latest 7.8.0, 2026-04-22) is the official SQL Server driver adapter and wraps the node-mssql package (^12.2.0). — **VERIFIED CONFIRMED**
- The PrismaMssql adapter constructor accepts either a node-mssql sql.config object OR a JDBC-style sqlserver:// connection string: constructor(configOrString: sql.config | string, options?). — **VERIFIED CONFIRMED**
- Prisma's SQL Server connection URL format is JDBC-style (sqlserver://HOST:PORT;database=..;user=..;password=..;encrypt=true), i.e. JDBC minus the jdbc: prefix; ADO.NET-format strings are not accepted directly and require conversion. — **VERIFIED CONFIRMED**
- Runtime datasource override is per-PrismaClient-instance (constructor time), never per-query/per-request; each client owns a connection pool, so the settings page should swap a singleton or restart the app. — **VERIFIED CONFIRMED**
- npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script produces a complete T-SQL creation script for the sqlserver provider and runs offline without a database connection. — **VERIFIED CONFIRMED**
- Prisma's official minimum supported SQL Server version is 2017; SQL Server 2016 is not in the supported matrix. — **VERIFIED CONFIRMED**
- Azure SQL Edge was retired September 30, 2025 and must not be used for a new dev sandbox.
- The recommended 2026 approach for SQL Server on Apple Silicon is the x86_64 image mcr.microsoft.com/mssql/server:2022-latest under Docker Desktop with 'Use Rosetta for x86/amd64 emulation' enabled; Microsoft's own dev blog endorses this with near-native dev performance. No official ARM64 mssql image exists.
- next-auth v5 (Auth.js) is still in beta as of mid-2026: npm latest=4.24.14, beta=5.0.0-beta.31 published 2026-04-14; v5 beta is nonetheless the documented App Router path.
- With the Credentials provider, Auth.js sessions must use the JWT strategy; credentials users/sessions are not persisted via a database adapter.
- Role-based access pattern: put role on the JWT in the jwt callback, expose it in the session callback, gate routes in middleware via req.auth / authorized callback, and re-verify with auth() in server components and server actions.

## Risks

- SQL Server 2016 at the customer would be below Prisma's official support floor (2017+). It would probably work via TDS 7.4 but is unsupported; confirm the real version before committing to Prisma, or keep Kysely as the tested fallback.
- Most Prisma+SQL Server tutorials online target pre-7 APIs (datasourceUrl, schema-file url). Blindly following them will produce code that throws at startup on Prisma 7. The plan must specify the driver-adapter pattern explicitly.
- next-auth v5 is still beta (5.0.0-beta.31). Beta-to-beta upgrades have had breaking changes; pin the exact version and treat upgrades as deliberate tasks. Fallback is stable v4, which has clunkier App Router ergonomics.
- Customer connection strings may include shapes not covered by a naive ADO.NET parser: named instances (host\\INSTANCE), Windows/Integrated auth, non-1433 ports, or passwords with reserved characters (need brace-escaping in the JDBC format). The settings page parser and validation flow must handle or explicitly reject these.
- Runtime connection switching is constructor-level only; a hot singleton swap must handle in-flight requests and call $disconnect() on the old client, or the app should simply require a restart after changing the connection string.
- prisma migrate diff output covers only Prisma-modelable features; if the DBA expects database creation, logins, users, or permissions in the script, those must be authored by hand alongside it.
- The Docker sandbox (SQL Server 2022 under Rosetta) is newer than an assumed 2016-2019 production target; without setting a matching COMPATIBILITY_LEVEL, dev could accidentally rely on newer T-SQL behavior.
- @prisma/adapter-mssql is newer than the classic Rust-engine connector path (adapter GA'd with the Prisma 7 wave); watch its issue tracker for SQL Server edge cases during early implementation.

## Open Questions

- [ ] What is the customer's exact SQL Server version and edition? (Decides whether Prisma is officially supported and which compatibility level the sandbox should emulate.)
- [ ] Will the customer's connection use SQL authentication (user/password) or Windows Integrated Security? Integrated auth from a Node/Linux host is possible via tedious NTLM but should be probed early if required.
- [ ] Does @prisma/adapter-mssql's parseConnectionString accept every JDBC parameter the app might need (schema=, instanceName=, loginTimeout=)? A 30-minute spike against the sandbox should verify the exact parameters the settings page will emit.
- [ ] Can node-mssql's own connection-string parsing be reused to convert the customer's ADO.NET string directly into the sql.config object (avoiding a hand-written parser)? Likely yes, but not verified in this research.
- [ ] Which Next.js major (15 vs 16) will the project pin, and is next-auth 5.0.0-beta.31 fully compatible with it (especially middleware API)? Verify at scaffold time.
- [ ] Does the vendor DBA want a single idempotent creation script, or separate scripts for database creation, login/user provisioning, and schema objects?
