import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { CreateUserForm } from "./create-user-form";
import { UserRow } from "./user-row";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // B2/E8: re-check ADMIN server-side even though proxy.ts already gates /admin/**.
  await requireAuth("ADMIN");

  const users = await prisma.user.findMany({
    // NEVER select passwordHash into anything client-bound (E6).
    select: { id: true, username: true, role: true, active: true },
    orderBy: { username: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">จัดการผู้ใช้</h1>

      <div className="mb-8">
        <CreateUserForm />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2 pr-2">ชื่อผู้ใช้</th>
            <th className="py-2 pr-2">บทบาท</th>
            <th className="py-2 pr-2">รีเซ็ตรหัสผ่าน</th>
            <th className="py-2 pr-2">สถานะ</th>
            <th className="py-2 pr-2 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </tbody>
      </table>
    </main>
  );
}
