import { auth } from "@/auth";
import { logout } from "./auth-actions";
import { NavLinks } from "./nav-links";
import { ROLE_LABELS, type Role } from "@/lib/product-order";
import { LogOut } from "lucide-react";

// Sidebar shell (Phase 01, C1/C2). SERVER component — keeps the server-side `await auth()`
// read (E-NAV-SPLIT); the client NavLinks child owns active-state highlighting. Renders
// nothing when logged out so /login stays chrome-free.
export async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  const role = session.user.role;
  const roleLabel = role && role in ROLE_LABELS ? ROLE_LABELS[role as Role] : role;
  const name = session.user.name ?? "";
  const initial = name.trim().charAt(0) || "ผ";

  return (
    <aside
      id="app-sidebar"
      className="flex h-full w-[216px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-lg font-bold text-white"
          style={{ background: "linear-gradient(160deg, #1FA971, #0E3B2E)" }}
        >
          ย
        </span>
        <span className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          ออเดอร์สินค้า
        </span>
      </div>

      {/* Menu groups */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavLinks role={role} />
      </div>

      {/* User card + logout */}
      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-3 rounded-[var(--r-md)] px-2 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--green-100)] text-[var(--t-sm)] font-semibold text-[var(--green-800)]">
            {initial}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[var(--t-sm)] font-medium text-[var(--text)]">
              {name}
            </span>
            {roleLabel && (
              <span className="truncate text-[var(--t-xs)] text-[var(--text-muted)]">
                {roleLabel}
              </span>
            )}
          </span>
        </div>
        <form action={logout} className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-[var(--r-md)] px-3 py-2 text-left text-[var(--t-sm)] text-[var(--danger)] transition-colors duration-100 hover:bg-[var(--danger-bg)] outline-none focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]"
          >
            <LogOut size={16} strokeWidth={2} />
            ออกจากระบบ
          </button>
        </form>
      </div>
    </aside>
  );
}
