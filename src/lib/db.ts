import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

// Prisma 7 removed the `datasourceUrl` / `datasources` constructor options; the
// Rust-free client requires an explicit driver adapter. `PrismaMssql` accepts a
// JDBC-style `sqlserver://` string (parsed internally) OR a node-mssql config
// object. See db-auth-feasibility_REF §1 (VERIFIED CONFIRMED pattern).
//
// SANDBOX ONLY: DATABASE_URL must point at localhost:1433 (the Docker SQL Server)
// during development — never a customer/remote host (Phase 06 owns the runtime swap).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — cannot construct the Prisma SQL Server adapter.");
}

// The connection binds per PrismaClient instance (owns an mssql connection pool),
// so we keep a module-level singleton and never create per-request clients.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaMssql(connectionString) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
