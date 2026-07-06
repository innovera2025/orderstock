"use client";

import { useActionState } from "react";
import { authenticate, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(authenticate, {} as LoginState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>ชื่อผู้ใช้</span>
        <input
          name="username"
          autoComplete="username"
          className="rounded-md border px-3 py-2"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>รหัสผ่าน</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="rounded-md border px-3 py-2"
          required
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
