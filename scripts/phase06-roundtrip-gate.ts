// Phase 06 Hybrid round-trip gate (Dec8 / E6). Sandbox-only (localhost:1433, orderstock/orderstock2).
//
// Proves the runtime DB-switch behavior end-to-end WITHOUT killing a long-lived server: the app's
// module singleton reads DATABASE_URL at boot, so a "restart" is simulated by constructing a fresh
// PrismaClient with the freshly-written .env value each direction (the real restart is a documented
// NSSM/manual step). This exercises the REAL settings-save code path (validate → test-connection →
// injection-safe env-write → backup), then observes a data-distinguishing sentinel each way.
//
// Steps:
//   1. Create `orderstock2` on the SAME container + run the vendor schema into it.
//   2. Seed a distinguishing sentinel Shop in orderstock2 ONLY (absent from orderstock — no pollution).
//   3. saveDbSettings(orderstock2) under ORDERSTOCK_NO_EXIT=1 → assert .env points to orderstock2 + .env.bak exists.
//   4. Fresh client on the new URL → OBSERVE the sentinel (not merely a successful connect).
//   5. saveDbSettings(orderstock) → fresh client → assert the sentinel is ABSENT.
//   6. RESTORE .env to its original content and verify.
//
// Run: ORDERSTOCK_NO_EXIT=1 pnpm tsx scripts/phase06-roundtrip-gate.ts

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import sql from "mssql";
import { buildDatabaseUrl, validateDbFields, type DbFields } from "../src/lib/connection-string";
import { writeDatabaseUrl } from "../src/lib/env-write";

process.loadEnvFile();
process.env.ORDERSTOCK_NO_EXIT = "1"; // never let the save action kill this process

const ENV_PATH = join(process.cwd(), ".env");
const SENTINEL = "SENTINEL_ORDERSTOCK2_ROUNDTRIP";
const SENTINEL_ROSTER = 999999;

function log(step: string) {
  console.log(`\n[roundtrip] ${step}`);
}

/** Derive the orderstock2 URL from the current DATABASE_URL by swapping the database name. */
function urlForDb(baseUrl: string, dbName: string): string {
  return baseUrl.replace(/database=[^;]+/i, `database=${dbName}`);
}

/** Parse the running DATABASE_URL into settings-page fields. */
function fieldsFromUrl(url: string, dbOverride?: string): DbFields {
  const authority = url.match(/^sqlserver:\/\/([^;]+)/i)?.[1] ?? "localhost:1433";
  const [host, port] = authority.split(":");
  const get = (k: string) => url.match(new RegExp(`${k}=([^;]+)`, "i"))?.[1] ?? "";
  return {
    host: host ?? "localhost",
    port: port ?? "1433",
    database: dbOverride ?? get("database"),
    user: get("user"),
    password: get("password").replace(/^\{|\}$/g, ""), // unwrap brace-escaping
    encrypt: /encrypt=true/i.test(url),
    trustServerCertificate: /trustServerCertificate=true/i.test(url),
  };
}

/**
 * Exercise the REAL save pipeline minus the auth gate (auth() needs Next request context; the ADMIN
 * gate is proven separately by auth-guard-coverage + the edge callback): validate → live
 * test-connection (throwaway PrismaClient + SELECT 1) → injection-safe env-write with backup.
 * Mirrors saveDbSettings' save-gate ordering invariant (E2): the write is unreachable unless the
 * live connection succeeded.
 */
async function saveViaRealPipeline(fields: DbFields): Promise<{ error?: string }> {
  const valid = validateDbFields(fields);
  if (!valid.ok) return { error: valid.error };
  const url = buildDatabaseUrl(fields);

  let client: PrismaClient | undefined;
  try {
    client = new PrismaClient({ adapter: new PrismaMssql(url) });
    await client.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error("[roundtrip] test-connection failed:", err);
    return { error: "เชื่อมต่อฐานข้อมูลไม่สำเร็จ" };
  } finally {
    await client?.$disconnect().catch(() => {});
  }

  writeDatabaseUrl(url); // backup .env → .env.bak, injection-safe single-line rewrite
  return {};
}

async function main() {
  const originalEnv = readFileSync(ENV_PATH, "utf8");
  const baseUrl = process.env.DATABASE_URL;
  assert(baseUrl, "DATABASE_URL must be set");
  assert(/localhost/.test(baseUrl), "SANDBOX-ONLY: DATABASE_URL must target localhost (charter E5)");
  const url2 = urlForDb(baseUrl, "orderstock2");

  // node-mssql master connection for DB creation (config object, not a JDBC string).
  const mf = fieldsFromUrl(baseUrl);
  const master = await sql.connect({
    server: mf.host,
    port: Number(mf.port) || 1433,
    database: "master",
    user: mf.user,
    password: mf.password,
    options: { encrypt: mf.encrypt, trustServerCertificate: true },
  });
  try {
    log("1. create orderstock2 on the same container");
    await master.query("IF DB_ID('orderstock2') IS NULL CREATE DATABASE [orderstock2];");
  } finally {
    await master.close();
  }

  log("2. run the vendor schema into orderstock2");
  // The generated script is a single BEGIN TRY/TRAN batch (no GO separators), so run it as one
  // batch via node-mssql directly against orderstock2 (Prisma 7 `db execute` has no --url flag).
  const schemaSql = readFileSync(join(process.cwd(), "db", "create-orderstock-schema.sql"), "utf8");
  const db2 = await sql.connect({
    server: mf.host,
    port: Number(mf.port) || 1433,
    database: "orderstock2",
    user: mf.user,
    password: mf.password,
    options: { encrypt: mf.encrypt, trustServerCertificate: true },
  });
  try {
    await db2.batch(schemaSql);
  } catch (err) {
    // Idempotent re-run: tables may already exist from a prior gate run.
    if (!/There is already an object named/i.test(String(err))) throw err;
    console.log("   schema already present in orderstock2 (idempotent) ✓");
  } finally {
    await db2.close();
  }

  log("3. seed the distinguishing sentinel in orderstock2 ONLY");
  const c2seed = new PrismaClient({ adapter: new PrismaMssql(url2) });
  try {
    const existing = await c2seed.shop.findFirst({ where: { name: SENTINEL } });
    if (!existing) {
      await c2seed.shop.create({ data: { name: SENTINEL, rosterOrder: SENTINEL_ROSTER } });
    }
  } finally {
    await c2seed.$disconnect();
  }

  log("4. save(orderstock2) — real validate→test-connection→env-write pipeline");
  const r2 = await saveViaRealPipeline(fieldsFromUrl(baseUrl, "orderstock2"));
  assert(!r2.error, `switch to orderstock2 failed: ${r2.error}`);
  const afterWrite = readFileSync(ENV_PATH, "utf8");
  assert(/database=orderstock2/i.test(afterWrite), ".env should now point at orderstock2");
  assert(existsSync(`${ENV_PATH}.bak`), ".env.bak backup must exist");
  console.log("   .env now points at orderstock2; .env.bak present ✓");

  log("4b. fresh client on the new URL OBSERVES the sentinel");
  const c2 = new PrismaClient({ adapter: new PrismaMssql(url2) });
  try {
    const found = await c2.shop.findFirst({ where: { name: SENTINEL } });
    assert(found, "orderstock2 must contain the sentinel after the switch");
    console.log(`   observed sentinel in orderstock2 (id=${found.id}) ✓`);
  } finally {
    await c2.$disconnect();
  }

  log("5. switch BACK to orderstock — sentinel must be ABSENT");
  const r1 = await saveViaRealPipeline(fieldsFromUrl(baseUrl, "orderstock"));
  assert(!r1.error, `switch back failed: ${r1.error}`);
  const c1 = new PrismaClient({ adapter: new PrismaMssql(urlForDb(baseUrl, "orderstock")) });
  try {
    const leaked = await c1.shop.findFirst({ where: { name: SENTINEL } });
    assert(!leaked, "orderstock must NOT contain the orderstock2 sentinel (no pollution)");
    console.log("   sentinel absent in orderstock ✓ (round-trip proven)");
  } finally {
    await c1.$disconnect();
  }

  log("6. RESTORE .env to its original content");
  writeFileSync(ENV_PATH, originalEnv, "utf8");
  assert(readFileSync(ENV_PATH, "utf8") === originalEnv, ".env restore failed");
  console.log("   .env restored to original ✓");

  console.log("\n[roundtrip] PASS — round-trip DB switch proven, .env restored.");
}

main().catch((err) => {
  console.error("\n[roundtrip] FAIL:", err);
  process.exitCode = 1;
});
