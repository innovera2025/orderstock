import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "./auth-actions";
import { ROLE_LABELS, type Role } from "@/lib/product-order";

// Auth-aware top nav (C3). Renders nothing when logged out (e.g. the /login page) so the
// login screen stays clean. Shows current user, the admin link for ADMINs, and logout.
export async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  const role = session.user.role;
  const roleLabel = role && role in ROLE_LABELS ? ROLE_LABELS[role as Role] : role;

  return (
    <header className="flex items-center justify-between border-b px-6 py-3 text-sm">
      <nav className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          ออเดอร์สินค้า
        </Link>
        <Link href="/shops" className="text-zinc-600 hover:text-zinc-900">
          ร้านค้า
        </Link>
        <Link href="/products" className="text-zinc-600 hover:text-zinc-900">
          สินค้า
        </Link>
        {role === "ADMIN" && (
          <Link href="/admin/users" className="text-zinc-600 hover:text-zinc-900">
            จัดการผู้ใช้
          </Link>
        )}
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-zinc-500">
          {session.user.name}
          {roleLabel ? ` (${roleLabel})` : ""}
        </span>
        <form action={logout}>
          <button type="submit" className="text-red-600">
            ออกจากระบบ
          </button>
        </form>
      </div>
    </header>
  );
}
