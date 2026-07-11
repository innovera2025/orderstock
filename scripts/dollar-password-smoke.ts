/**
 * DB URL `$`-in-password round-trip SMOKE (disposable, dev-only). NOT part of the Vitest suite —
 * requires a live sandbox and is run by hand during EXECUTE/EVL.
 *
 * Proves the decisive mechanism of the fix WITHOUT mutating any DB:
 *   (A) Reproduce the exact mangling: load a temp `.env` fixture (literal `$` password) through
 *       `@next/env`'s `loadEnvConfig` (the same loader the Next app uses, which runs dotenv-expand)
 *       and observe that `process.env.DATABASE_URL` comes back MANGLED (!= the literal fixture value).
 *   (B) Prove the fix: `resolveDatabaseUrl(fixturePath)` raw-reads the SAME fixture and returns the
 *       literal value VERBATIM — diverging from the mangled value.
 *
 * The optional live-connect leg (create a disposable `$`-password SQL login, connect with the raw
 * value = success, connect with the mangled value = login failure) is gated behind SMOKE_LIVE=1 so
 * this script is safe to run with zero sandbox writes by default. All values are fake fixtures;
 * nothing real or secret is printed.
 *
 * Usage:
 *   pnpm tsx scripts/dollar-password-smoke.ts            # deterministic proof only (no DB writes)
 *   SMOKE_LIVE=1 pnpm tsx scripts/dollar-password-smoke.ts   # + live disposable-login connect proof
 */
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

const require = createRequire(import.meta.url);

// A fixture password with a literal `$` that dotenv-expand will treat as a `$VAR` reference.
const FIXTURE_PASSWORD = "Fake$Pass123!";
const FIXTURE_URL = `sqlserver://localhost:1433;database=orderstock;user=smoketest_dollar;password=${FIXTURE_PASSWORD};encrypt=true;trustServerCertificate=true`;

function reproduceNextEnvMangling(fixtureDir: string): string {
  // `@next/env` is a transitive dep; load it via require (it is not a declared direct dep).
  const nextEnv = require("@next/env") as {
    loadEnvConfig: (
      dir: string,
      dev?: boolean,
      logger?: unknown,
      forceReload?: boolean,
    ) => { combinedEnv: Record<string, string | undefined> };
  };
  const before = process.env.DATABASE_URL;
  try {
    // Silence @next/env's info logging; forceReload=true so it re-reads our fixture dir.
    const silentLogger = { info: () => {}, error: () => {}, warn: () => {} };
    const { combinedEnv } = nextEnv.loadEnvConfig(fixtureDir, false, silentLogger, true);
    return combinedEnv.DATABASE_URL ?? "";
  } finally {
    // Restore whatever DATABASE_URL was in the ambient env (loadEnvConfig mutates process.env).
    if (before === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = before;
  }
}

async function liveConnectProof(rawValue: string, mangledValue: string): Promise<void> {
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  const { PrismaMssql } = require("@prisma/adapter-mssql") as typeof import("@prisma/adapter-mssql");

  // Admin (sa) connection from the current sandbox .env — used to create/drop the disposable login.
  const adminUrl = resolveDatabaseUrl();
  if (!adminUrl.includes("localhost")) {
    throw new Error("SAFETY: sandbox admin URL is not localhost — refusing live SMOKE.");
  }
  const admin = new PrismaClient({ adapter: new PrismaMssql(adminUrl) });
  const LOGIN = "smoketest_dollar";
  try {
    await admin.$executeRawUnsafe(
      `IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '${LOGIN}') CREATE LOGIN [${LOGIN}] WITH PASSWORD = '${FIXTURE_PASSWORD}', CHECK_POLICY = OFF;`,
    );
    await admin.$executeRawUnsafe(
      `IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '${LOGIN}') CREATE USER [${LOGIN}] FOR LOGIN [${LOGIN}];`,
    );

    // Positive: raw value connects.
    const good = new PrismaClient({ adapter: new PrismaMssql(rawValue) });
    await good.$queryRawUnsafe("SELECT 1 AS ok");
    await good.$disconnect();
    console.log("live-connect: raw-read value CONNECTED (SELECT 1 ok)");

    // Negative: mangled value fails auth.
    let mangledFailed = false;
    const bad = new PrismaClient({ adapter: new PrismaMssql(mangledValue) });
    try {
      await bad.$queryRawUnsafe("SELECT 1 AS ok");
    } catch {
      mangledFailed = true;
    } finally {
      await bad.$disconnect().catch(() => {});
    }
    if (!mangledFailed) throw new Error("SMOKE FAIL: mangled value unexpectedly connected");
    console.log("live-connect: dotenv-mangled value FAILED auth (as expected)");
  } finally {
    await admin.$executeRawUnsafe(
      `IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '${LOGIN}') DROP USER [${LOGIN}];`,
    ).catch(() => {});
    await admin.$executeRawUnsafe(
      `IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '${LOGIN}') DROP LOGIN [${LOGIN}];`,
    ).catch(() => {});
    await admin.$disconnect().catch(() => {});
    console.log("live-connect: disposable login torn down");
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "dollar-smoke-"));
  const fixturePath = join(dir, ".env");
  writeFileSync(fixturePath, `DATABASE_URL=${FIXTURE_URL}\n`, "utf8");

  try {
    // (A) reproduce the mangling
    const mangled = reproduceNextEnvMangling(dir);
    const manglingReproduced = mangled !== FIXTURE_URL;
    console.log("(A) @next/env mangled the literal value:", manglingReproduced);
    if (!manglingReproduced) {
      throw new Error(
        "SMOKE FAIL: @next/env did NOT mangle the literal $ value — root-cause assumption not reproduced in this env.",
      );
    }

    // (B) prove resolveDatabaseUrl returns the literal, diverging from the mangled value
    const rawRead = resolveDatabaseUrl(fixturePath);
    const resolverCorrect = rawRead === FIXTURE_URL;
    const divergesFromMangled = rawRead !== mangled;
    console.log("(B) resolveDatabaseUrl returned the literal value:", resolverCorrect);
    console.log("(B) resolveDatabaseUrl diverges from the mangled value:", divergesFromMangled);
    if (!resolverCorrect || !divergesFromMangled) {
      throw new Error("SMOKE FAIL: resolveDatabaseUrl did not return the unmangled literal value.");
    }

    console.log("DETERMINISTIC SMOKE: PASS (mangling reproduced; raw-read returns literal, diverging).");

    if (process.env.SMOKE_LIVE === "1") {
      await liveConnectProof(rawRead, mangled);
      console.log("LIVE SMOKE: PASS.");
    } else {
      console.log("LIVE SMOKE: skipped (set SMOKE_LIVE=1 to run the disposable-login connect proof).");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
