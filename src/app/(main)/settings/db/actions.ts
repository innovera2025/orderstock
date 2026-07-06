"use server";

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { requireAuthState } from "@/lib/auth-guard";
import { buildDatabaseUrl, validateDbFields, type DbFields } from "@/lib/connection-string";
import { writeDatabaseUrl } from "@/lib/env-write";

// Phase 06 (B1-B3). ADMIN-only runtime DB-connection settings. EVERY action re-checks
// requireAuthState("ADMIN") (E4/E8) — proxy.ts gates the PAGE, but a raw server-action POST from a
// STAFF user must also be rejected here (the server guard is the real boundary).
//
// SAVE-GATE INVARIANT (E2): the env-write + process.exit path is UNREACHABLE unless test-connection
// returned ok — a bad string never reaches the write, so process.exit never fires on a bad string.
//
// INFO-DISCLOSURE (E3): test-connection returns a FIXED Thai error and NEVER echoes the connection
// string / host / user / password to the client (the raw error is logged server-side only, like
// /api/health).

export interface DbSettingsState {
  error?: string;
  success?: string;
  tested?: boolean;
}

// Fixed, sanitized Thai failure message — must never contain any submitted secret/host detail (E3).
const CONNECT_FAIL_MESSAGE = "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลการเชื่อมต่อ";

function readFields(formData: FormData): DbFields {
  return {
    host: String(formData.get("host") ?? ""),
    port: String(formData.get("port") ?? ""),
    instance: String(formData.get("instance") ?? ""),
    database: String(formData.get("database") ?? ""),
    user: String(formData.get("user") ?? ""),
    password: String(formData.get("password") ?? ""),
    encrypt: formData.get("encrypt") === "on" || formData.get("encrypt") === "true",
    trustServerCertificate:
      formData.get("trustServerCertificate") === "on" ||
      formData.get("trustServerCertificate") === "true",
  };
}

/**
 * Attempt a throwaway connection with the candidate URL: construct a disposable PrismaClient
 * (adapter) → `SELECT 1` → `$disconnect`. Returns ok/false. NEVER surfaces the raw error or any
 * secret to the caller (logged server-side only, E3).
 */
async function tryConnect(databaseUrl: string): Promise<boolean> {
  let client: PrismaClient | undefined;
  try {
    client = new PrismaClient({ adapter: new PrismaMssql(databaseUrl) });
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    // Log server-side only — never returned to the client (mirror /api/health).
    console.error("[settings/db] test-connection failed:", error);
    return false;
  } finally {
    await client?.$disconnect().catch(() => {});
  }
}

/** B2: validate + test-connect the submitted fields; sanitized Thai result. No `.env` write. */
export async function testConnection(
  _prev: DbSettingsState,
  formData: FormData,
): Promise<DbSettingsState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return denied;

  const fields = readFields(formData);
  const valid = validateDbFields(fields);
  if (!valid.ok) return { error: valid.error };

  const url = buildDatabaseUrl(fields);
  const ok = await tryConnect(url);
  if (!ok) return { error: CONNECT_FAIL_MESSAGE };
  return { success: "เชื่อมต่อฐานข้อมูลสำเร็จ", tested: true };
}

/**
 * B3: validate → test-connection → (ONLY if ok) env-write (backup + injection-safe) → restart.
 * process.exit is gated for tests (E2/B3): skipped under NODE_ENV==="test" or ORDERSTOCK_NO_EXIT=1,
 * so the Hybrid gate can drive save up-to-and-including the `.env` write without killing the server.
 * Under NSSM the service auto-restarts (~2-5s); a manual-restart fallback is documented in the guide.
 */
export async function saveDbSettings(
  _prev: DbSettingsState,
  formData: FormData,
): Promise<DbSettingsState> {
  const denied = await requireAuthState("ADMIN");
  if (denied) return denied;

  const fields = readFields(formData);
  const valid = validateDbFields(fields);
  if (!valid.ok) return { error: valid.error };

  const url = buildDatabaseUrl(fields);

  // SAVE-GATE INVARIANT (E2): the write below is unreachable unless this returns ok.
  const ok = await tryConnect(url);
  if (!ok) return { error: CONNECT_FAIL_MESSAGE };

  writeDatabaseUrl(url);

  // Gate the restart so tests (and the Hybrid gate) can exercise the write without dying.
  if (process.env.NODE_ENV !== "test" && process.env.ORDERSTOCK_NO_EXIT !== "1") {
    // NSSM (or any process supervisor) restarts the service; db.ts re-reads DATABASE_URL at boot.
    process.exit(0);
  }

  return { success: "บันทึกแล้ว กำลังรีสตาร์ท...", tested: true };
}
