import { requireAuth } from "@/lib/auth-guard";
import { parseConnectionString, type DbFields } from "@/lib/connection-string";
import { DbSettingsForm } from "./db-settings-form";

// Phase 06 (B1). ADMIN-only runtime DB-connection settings page. requireAuth("ADMIN") at the top
// (E4/E8) even though proxy.ts already gates /settings/** — the server guard is the real boundary.
export const dynamic = "force-dynamic";

export default async function DbSettingsPage() {
  await requireAuth("ADMIN");

  // Prefill from the CURRENTLY-active DATABASE_URL. The password is NEVER rendered into client HTML
  // (B1) — the form starts with an empty password and the admin re-enters it to save.
  const current = parseConnectionString(process.env.DATABASE_URL ?? "");
  const prefill: DbFields = { ...current, password: "" };

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">ตั้งค่าการเชื่อมต่อฐานข้อมูล</h1>
      <p className="mb-6 text-sm text-zinc-500">
        กรอกข้อมูลการเชื่อมต่อ SQL Server ทดสอบการเชื่อมต่อก่อนบันทึก เมื่อบันทึกแล้วระบบจะรีสตาร์ทเพื่อใช้ค่าใหม่
      </p>
      <DbSettingsForm prefill={prefill} />
    </main>
  );
}
