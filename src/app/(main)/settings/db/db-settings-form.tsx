"use client";

import { useActionState, useState } from "react";
import {
  saveDbSettings,
  testConnection,
  type DbSettingsState,
} from "./actions";
import { parseConnectionString, type DbFields } from "@/lib/connection-string";

// Phase 06 (B1). Individual-fields form (authoritative) + optional connection-string paste-prefill
// (best-effort, admin-reviewable — NEVER load-bearing). The password field is type="password" and
// starts empty; the current password is NEVER shipped to the client (B1). Two submit paths share
// the same fields: "ทดสอบการเชื่อมต่อ" (testConnection) and "บันทึกและรีสตาร์ท" (saveDbSettings).

interface Props {
  prefill: DbFields;
}

export function DbSettingsForm({ prefill }: Props) {
  const [fields, setFields] = useState<DbFields>(prefill);
  const [paste, setPaste] = useState("");
  const [testState, testAction, testing] = useActionState(
    testConnection,
    {} as DbSettingsState,
  );
  const [saveState, saveAction, saving] = useActionState(
    saveDbSettings,
    {} as DbSettingsState,
  );

  function set<K extends keyof DbFields>(key: K, value: DbFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  // Non-load-bearing paste-prefill: parse the pasted string into the fields for the admin to review.
  function applyPaste() {
    if (!paste.trim()) return;
    const parsed = parseConnectionString(paste);
    // Keep any password the admin already typed if the paste omitted one.
    setFields((f) => ({ ...parsed, password: parsed.password || f.password }));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-md border p-4">
        <h2 className="mb-2 text-sm font-semibold">วางค่า connection string เพื่อเติมอัตโนมัติ (ไม่บังคับ)</h2>
        <p className="mb-2 text-xs text-zinc-500">
          วางสตริง ADO.NET หรือ sqlserver:// เพื่อเติมช่องด้านล่าง จากนั้นตรวจสอบก่อนบันทึก
        </p>
        <div className="flex gap-2">
          <input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            placeholder="Server=host,1433;Database=...;User Id=...;Password=..."
          />
          <button
            type="button"
            onClick={applyPaste}
            className="rounded-md border px-3 py-2 text-sm"
          >
            เติมค่า
          </button>
        </div>
      </section>

      <form className="flex flex-col gap-4 rounded-md border p-4">
        {(testState.error || saveState.error) && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {testState.error || saveState.error}
          </p>
        )}
        {(testState.success || saveState.success) && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
            {saveState.success || testState.success}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span>โฮสต์ (host)</span>
            <input
              name="host"
              value={fields.host}
              onChange={(e) => set("host", e.target.value)}
              className="rounded-md border px-3 py-2"
              required
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-sm">
            <span>พอร์ต (port)</span>
            <input
              name="port"
              value={fields.port ?? ""}
              onChange={(e) => set("port", e.target.value)}
              className="rounded-md border px-3 py-2"
              placeholder="1433"
            />
          </label>
          <label className="flex w-40 flex-col gap-1 text-sm">
            <span>อินสแตนซ์ (instance)</span>
            <input
              name="instance"
              value={fields.instance ?? ""}
              onChange={(e) => set("instance", e.target.value)}
              className="rounded-md border px-3 py-2"
              placeholder="(ไม่บังคับ)"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span>ฐานข้อมูล (database)</span>
            <input
              name="database"
              value={fields.database}
              onChange={(e) => set("database", e.target.value)}
              className="rounded-md border px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span>ผู้ใช้ (user)</span>
            <input
              name="user"
              value={fields.user}
              onChange={(e) => set("user", e.target.value)}
              className="rounded-md border px-3 py-2"
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span>รหัสผ่าน (password)</span>
          <input
            name="password"
            type="password"
            value={fields.password}
            onChange={(e) => set("password", e.target.value)}
            className="rounded-md border px-3 py-2"
            placeholder="ป้อนรหัสผ่านใหม่เพื่อบันทึก"
            autoComplete="new-password"
            required
          />
        </label>

        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              name="encrypt"
              type="checkbox"
              checked={fields.encrypt}
              onChange={(e) => set("encrypt", e.target.checked)}
            />
            <span>encrypt</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              name="trustServerCertificate"
              type="checkbox"
              checked={fields.trustServerCertificate}
              onChange={(e) => set("trustServerCertificate", e.target.checked)}
            />
            <span>trustServerCertificate</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            formAction={testAction}
            disabled={testing || saving}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {testing ? "กำลังทดสอบ…" : "ทดสอบการเชื่อมต่อ"}
          </button>
          <button
            type="submit"
            formAction={saveAction}
            disabled={testing || saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : "บันทึกและรีสตาร์ท"}
          </button>
        </div>
      </form>
    </div>
  );
}
