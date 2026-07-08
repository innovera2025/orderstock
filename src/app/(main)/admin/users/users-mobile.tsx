"use client";

import { useActionState, useState } from "react";
import {
  editRole,
  resetPassword,
  deactivateUser,
  activateUser,
  type UserActionState,
} from "./actions";
import { CreateUserForm } from "./create-user-form";
import { ROLES, ROLE_LABELS } from "@/lib/product-order";
import { logout } from "@/app/auth-actions";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import type { UserRowData } from "./user-row";

// Phase 04 — mobile responsive card list for /admin/users (md:hidden; the desktop table stays at
// md+). Reuses the SAME server actions as the desktop table (editRole/resetPassword/de-/activate)
// plus CreateUserForm rendered inside the shared Modal primitive. ADMIN-only (page-level
// requireAuth("ADMIN") is the real boundary — this UI is cosmetic).

function UserMobileCard({ user, isSelf }: { user: UserRowData; isSelf: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState(editRole, {} as UserActionState);
  const [resetState, resetAction, resetPending] = useActionState(
    resetPassword,
    {} as UserActionState,
  );
  const initials = user.username.trim().slice(0, 2);

  return (
    <div
      className={
        "flex flex-col gap-2.5 border-b border-[#EDF1EF] px-4 py-3 last:border-b-0 " +
        (user.active ? "" : "opacity-60")
      }
    >
      <div className="flex items-center gap-3">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[var(--green-100)] text-[12.5px] font-bold text-[var(--green-800)]">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13.5px] font-semibold text-[var(--text)]">{user.username}</span>
            {isSelf && (
              <span className="rounded-[var(--r-full)] bg-[#E9F8F1] px-1.5 py-px text-[9.5px] font-semibold text-[#0E5238]">
                คุณ
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--text-faint)]">
            {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role} ·{" "}
            {user.active ? "ใช้งาน" : "ถูกระงับ"}
          </div>
        </div>
        {/* Activate / deactivate — never suspend your own account. */}
        {user.active ? (
          isSelf ? (
            <span className="text-[12px] text-[var(--text-faint)]" title="ไม่สามารถระงับบัญชีตนเองได้">
              ระงับ
            </span>
          ) : (
            <form action={deactivateUser.bind(null, user.id)}>
              <button
                type="submit"
                className="h-[34px] rounded-[var(--r-md)] border-[1.5px] border-[var(--border-strong)] px-3 text-[12px] font-semibold text-[var(--danger)]"
              >
                ระงับ
              </button>
            </form>
          )
        ) : (
          <form action={activateUser.bind(null, user.id)}>
            <button
              type="submit"
              className="h-[34px] rounded-[var(--r-md)] border-[1.5px] border-[var(--border-strong)] px-3 text-[12px] font-semibold text-[var(--success)]"
            >
              เปิดใช้
            </button>
          </form>
        )}
      </div>

      {/* Role chips. */}
      <form action={roleAction} className="flex items-center gap-1.5">
        <input type="hidden" name="userId" value={user.id} />
        {ROLES.map((r) => {
          const active = user.role === r;
          return (
            <button
              key={r}
              type="submit"
              name="role"
              value={r}
              disabled={rolePending || active}
              className={
                "rounded-[var(--r-full)] border px-3 py-1 text-[11px] font-medium " +
                (active
                  ? "border-transparent bg-[var(--brand-int)] text-[var(--text-on-brand)]"
                  : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)]")
              }
            >
              {ROLE_LABELS[r]}
            </button>
          );
        })}
      </form>
      {roleState.error && <p className="text-[11px] text-[var(--danger)]">{roleState.error}</p>}

      {/* Reset password. */}
      <form action={resetAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={user.id} />
        <Input
          name="password"
          type="text"
          placeholder="รหัสผ่านใหม่"
          minLength={8}
          className="h-9 flex-1"
          required
        />
        <button
          type="submit"
          disabled={resetPending}
          className="text-[12px] font-semibold text-[var(--brand-int)] disabled:opacity-50"
        >
          รีเซ็ต
        </button>
      </form>
      {resetState.error && <p className="text-[11px] text-[var(--danger)]">{resetState.error}</p>}
      {resetState.success && (
        <p className="text-[11px] text-[var(--success)]">{resetState.success}</p>
      )}
    </div>
  );
}

export function UsersMobile({ users, meId }: { users: UserRowData[]; meId: number }) {
  const [addOpen, setAddOpen] = useState(false);
  const activeCount = users.filter((u) => u.active).length;

  return (
    <div className="md:hidden">
      {/* Green header + add button. */}
      <div className="flex items-center gap-2.5 bg-[#0E3B2E] px-[18px] pb-3.5 pt-3 text-white">
        <div className="flex-1">
          <div className="text-[16px] font-bold">ผู้ใช้ระบบ</div>
          <div className="text-[11.5px] text-[#97E0C2]">
            {users.length} บัญชี · ใช้งาน {activeCount}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="h-9 rounded-[var(--r-md)] bg-[var(--brand-int)] px-3.5 text-[12.5px] font-semibold text-[var(--text-on-brand)]"
        >
          + เพิ่ม
        </button>
      </div>

      {/* Card list. */}
      <div className="mx-3.5 my-3 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
        {users.map((u) => (
          <UserMobileCard key={u.id} user={u} isSelf={u.id === meId} />
        ))}
      </div>

      {/* Logout (mobile-only — the sidebar logout is hidden below md). */}
      <div className="mx-3.5 mb-4">
        <form action={logout}>
          <button
            type="submit"
            className="min-h-11 w-full rounded-[var(--r-md)] border-[1.5px] border-[rgba(229,72,77,.35)] bg-[var(--bg-surface)] text-[13.5px] font-semibold text-[var(--danger)]"
          >
            ออกจากระบบ
          </button>
        </form>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)}>
        <CreateUserForm />
      </Modal>
    </div>
  );
}
