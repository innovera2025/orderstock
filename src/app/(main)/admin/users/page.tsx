import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { CreateUserForm } from "./create-user-form";
import { UserRow } from "./user-row";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // B2/E8: re-check ADMIN server-side even though proxy.ts already gates /admin/**.
  const me = await requireAuth("ADMIN");

  const users = await prisma.user.findMany({
    // NEVER select passwordHash into anything client-bound (E6).
    select: { id: true, username: true, role: true, active: true },
    orderBy: { username: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <h1 className="mb-6 text-[var(--t-2xl)] font-semibold text-[var(--text-strong)]">จัดการผู้ใช้</h1>

      <div className="mb-8">
        <CreateUserForm />
      </div>

      <table className="w-full border-collapse text-[var(--t-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
            <th className="py-2 pr-2 font-medium">ชื่อผู้ใช้</th>
            <th className="py-2 pr-2 font-medium">บทบาท</th>
            <th className="py-2 pr-2 font-medium">รีเซ็ตรหัสผ่าน</th>
            <th className="py-2 pr-2 font-medium">สถานะ</th>
            <th className="py-2 pr-2 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === me.id} />
          ))}
        </tbody>
      </table>
    </main>
  );
}
