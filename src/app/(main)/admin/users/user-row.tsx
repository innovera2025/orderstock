"use client";

import { useActionState } from "react";
import {
  editRole,
  resetPassword,
  deactivateUser,
  activateUser,
  type UserActionState,
} from "./actions";
import { ROLES, ROLE_LABELS } from "@/lib/product-order";
import { Input } from "@/components/ui/input";

export interface UserRowData {
  id: number;
  username: string;
  role: string;
  active: boolean;
}

export function UserRow({ user, isSelf = false }: { user: UserRowData; isSelf?: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState(editRole, {} as UserActionState);
  const [resetState, resetAction, resetPending] = useActionState(
    resetPassword,
    {} as UserActionState,
  );

  return (
    <tr
      className={
        user.active
          ? "border-b border-[var(--border)] align-top"
          : "border-b border-[var(--border)] align-top opacity-50"
      }
    >
      <td className="py-2 pr-2 text-[var(--text)]">{user.username}</td>

      {/* Role edit — two chips (ADMIN / STAFF); the active role is filled. */}
      <td className="py-2 pr-2">
        <form action={roleAction} className="flex items-center gap-1.5">
          <input type="hidden" name="userId" value={user.id} />
          {ROLES.map((r) => {
            const isActive = user.role === r;
            return (
              <button
                key={r}
                type="submit"
                name="role"
                value={r}
                disabled={rolePending || isActive}
                className={
                  "rounded-[var(--r-full)] border px-3 py-1 text-[var(--t-xs)] font-medium transition-colors " +
                  (isActive
                    ? "border-transparent bg-[var(--brand-int)] text-[var(--text-on-brand)]"
                    : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-sunken)]")
                }
              >
                {ROLE_LABELS[r]}
              </button>
            );
          })}
        </form>
        {roleState.error && <p className="text-[var(--t-xs)] text-[var(--danger)]">{roleState.error}</p>}
        {roleState.success && <p className="text-[var(--t-xs)] text-[var(--success)]">{roleState.success}</p>}
      </td>

      {/* Reset password */}
      <td className="py-2 pr-2">
        <form action={resetAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <Input
            name="password"
            type="text"
            placeholder="รหัสผ่านใหม่"
            minLength={8}
            className="h-9 w-32"
            required
          />
          <button type="submit" disabled={resetPending} className="text-[var(--brand-int)] disabled:opacity-50">
            รีเซ็ต
          </button>
        </form>
        {resetState.error && <p className="text-[var(--t-xs)] text-[var(--danger)]">{resetState.error}</p>}
        {resetState.success && <p className="text-[var(--t-xs)] text-[var(--success)]">{resetState.success}</p>}
      </td>

      {/* Status */}
      <td className="py-2 pr-2 text-[var(--text-muted)]">{user.active ? "ใช้งาน" : "ถูกระงับ"}</td>

      {/* Activate / deactivate — never suspend your own account (self-suspend disabled). */}
      <td className="py-2 pr-2 text-right">
        {user.active ? (
          isSelf ? (
            <span className="text-[var(--text-faint)]" title="ไม่สามารถระงับบัญชีตนเองได้">
              ระงับ
            </span>
          ) : (
            <form action={deactivateUser.bind(null, user.id)} className="inline">
              <button type="submit" className="text-[var(--danger)]">
                ระงับ
              </button>
            </form>
          )
        ) : (
          <form action={activateUser.bind(null, user.id)} className="inline">
            <button type="submit" className="text-[var(--brand-int)]">
              เปิดใช้งาน
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}
