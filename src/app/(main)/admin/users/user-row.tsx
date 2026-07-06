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

export interface UserRowData {
  id: number;
  username: string;
  role: string;
  active: boolean;
}

export function UserRow({ user }: { user: UserRowData }) {
  const [roleState, roleAction, rolePending] = useActionState(editRole, {} as UserActionState);
  const [resetState, resetAction, resetPending] = useActionState(
    resetPassword,
    {} as UserActionState,
  );

  return (
    <tr className={user.active ? "border-b align-top" : "border-b align-top opacity-50"}>
      <td className="py-2 pr-2">{user.username}</td>

      {/* Role edit */}
      <td className="py-2 pr-2">
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <select name="role" defaultValue={user.role} className="rounded-md border px-2 py-1">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={rolePending} className="text-blue-600 disabled:opacity-50">
            บันทึก
          </button>
        </form>
        {roleState.error && <p className="text-xs text-red-600">{roleState.error}</p>}
        {roleState.success && <p className="text-xs text-green-600">{roleState.success}</p>}
      </td>

      {/* Reset password */}
      <td className="py-2 pr-2">
        <form action={resetAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <input
            name="password"
            type="text"
            placeholder="รหัสผ่านใหม่"
            minLength={8}
            className="w-32 rounded-md border px-2 py-1"
            required
          />
          <button type="submit" disabled={resetPending} className="text-blue-600 disabled:opacity-50">
            รีเซ็ต
          </button>
        </form>
        {resetState.error && <p className="text-xs text-red-600">{resetState.error}</p>}
        {resetState.success && <p className="text-xs text-green-600">{resetState.success}</p>}
      </td>

      {/* Status */}
      <td className="py-2 pr-2">{user.active ? "ใช้งาน" : "ถูกระงับ"}</td>

      {/* Activate / deactivate */}
      <td className="py-2 pr-2 text-right">
        {user.active ? (
          <form action={deactivateUser.bind(null, user.id)} className="inline">
            <button type="submit" className="text-red-600">
              ระงับ
            </button>
          </form>
        ) : (
          <form action={activateUser.bind(null, user.id)} className="inline">
            <button type="submit" className="text-green-600">
              เปิดใช้งาน
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}
