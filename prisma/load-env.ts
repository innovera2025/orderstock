// Side-effect module: load .env BEFORE any module that reads DATABASE_URL is imported.
// ES module imports are hoisted and execute in source order, so importing this FIRST in
// seed.ts guarantees env is populated before src/lib/db.ts runs (F4). A plain
// `process.loadEnvFile()` statement in seed.ts would run AFTER the hoisted db.ts import
// and be too late. Node 22+ provides process.loadEnvFile().
// SANDBOX ONLY — DATABASE_URL must point at localhost:1433, never a customer/remote host.
try {
  process.loadEnvFile();
} catch {
  // .env optional if DATABASE_URL is already in the environment (e.g. inline on the CLI).
}

export {};
