"use client";

import { useActionState } from "react";
import { authenticate, type LoginState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Login form — real NextAuth credentials flow (login/actions.ts UNCHANGED). Selectors preserved:
// name="username", name="password", button[type="submit"], and the generic anti-enumeration error.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(authenticate, {} as LoginState);
  const devAutofill = process.env.NODE_ENV !== "production";

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {state.error && (
        <p className="rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
        <span>ชื่อผู้ใช้</span>
        <Input
          name="username"
          autoComplete="username"
          defaultValue={devAutofill ? "admin" : undefined}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
        <span>รหัสผ่าน</span>
        <Input name="password" type="password" autoComplete="current-password" required />
      </label>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
