import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { resolveDatabaseUrl } from "./resolve-database-url";

// Prisma 7 removed the `datasourceUrl` / `datasources` constructor options; the
// Rust-free client requires an explicit driver adapter. `PrismaMssql` accepts a
// JDBC-style `sqlserver://` string (parsed internally) OR a node-mssql config
// object. See db-auth-feasibility_REF §1 (VERIFIED CONFIRMED pattern).
//
// SANDBOX ONLY: DATABASE_URL must point at localhost:1433 (the Docker SQL Server)
// during development — never a customer/remote host. The production connection is
// changed by editing the env file on the host and restarting the app.
//
// Raw-read the literal value (bypassing `@next/env`'s dotenv-expand) so a saved password
// containing `$` round-trips verbatim after a manual env-file edit + restart. `resolveDatabaseUrl()`
// owns the "not set" throw. `db.ts` is server-only/Node (imported only by `src/auth.ts`, never by
// the edge-split `auth.config.ts`/`proxy.ts`), so the helper's `node:fs` read is safe here.
const connectionString = resolveDatabaseUrl();

// The connection binds per PrismaClient instance (owns an mssql connection pool),
// so we keep a module-level singleton and never create per-request clients.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaMssql(connectionString) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
