import path from "node:path";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/resolve-database-url";

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
  // Route through the same raw-read resolver as the app (`src/lib/db.ts`) so the CLI and app
  // resolve one identical literal value. The `process.loadEnvFile(envPath)` call above still
  // populates the `process.env` fallback branch inside the resolver (e.g. CI with no `.env` file).
  datasource: {
    url: resolveDatabaseUrl(),
  },
  // Seed wiring (Phase 02, decision 4). NOTE: the PRIMARY documented seed command is the
  // DIRECT run `pnpm tsx prisma/seed.ts` — Prisma 7 `prisma db seed` is unreliable due to
  // upstream bugs #27769/#27773. This key is kept for completeness/tooling parity only.
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});

