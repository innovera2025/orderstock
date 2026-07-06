import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads .env when a prisma.config.ts is present.
// Load it explicitly (Node 22+) so DATABASE_URL is available to the Prisma CLI
// (migrate dev / migrate diff / introspect). SANDBOX ONLY — DATABASE_URL must
// point at the Docker SQL Server at localhost:1433, never a customer/remote host.
const envPath = path.join(process.cwd(), ".env");
try {
  process.loadEnvFile(envPath);
} catch {
  // .env is optional in CI; DATABASE_URL may already be in the environment.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // Required for migrate/introspection commands in Prisma 7 (datasource `url` was
  // removed from schema.prisma). SANDBOX ONLY — DATABASE_URL points at localhost:1433.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

