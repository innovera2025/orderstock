"use client";

import { useActionState } from "react";
import { createUser, type UserActionState } from "./actions";
import { ROLES, ROLE_LABELS } from "@/lib/product-order";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, {} as UserActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <h2 className="text-lg font-semibold">เพิ่มผู้ใช้ใหม่</h2>

      {state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span>ชื่อผู้ใช้</span>
          <input name="username" className="rounded-md border px-3 py-2" required minLength={3} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span>รหัสผ่านเริ่มต้น</span>
          <input
            name="password"
            type="text"
            className="rounded-md border px-3 py-2"
            required
            minLength={8}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>บทบาท</span>
          <select name="role" className="rounded-md border px-3 py-2" defaultValue="STAFF">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก…" : "สร้างผู้ใช้"}
      </button>
    </form>
  );
}
