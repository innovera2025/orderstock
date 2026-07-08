"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, BarChart3, Users, type LucideIcon } from "lucide-react";

// Phase 04 mobile shell — the bottom tab bar. Mobile-only (hidden at md+ where the sidebar Nav
// takes over). Three tabs: ร้านค้า (/orders), สรุปยอด (/summary), ผู้ใช้ (/admin/users, ADMIN-only —
// STAFF never sees it, mirroring the server boundary the nav uses). Active tab = #15885B via
// usePathname. Touch targets ≥44px (min-h-12 = 48px). The per-shop entry overlay renders ABOVE
// this bar (higher z-index), so it is visually "hidden" during order entry without a shared signal.
type Tab = { key: string; href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

const TABS: Tab[] = [
  { key: "orders", href: "/orders", label: "ร้านค้า", icon: Store },
  { key: "summary", href: "/summary", label: "สรุปยอด", icon: BarChart3 },
  { key: "users", href: "/admin/users", label: "ผู้ใช้", icon: Users, adminOnly: true },
];

export function BottomTabBar({ role }: { role?: string }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => !t.adminOnly || role === "ADMIN");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg-surface)] px-2 pb-2 pt-1.5 md:hidden"
      aria-label="แถบเมนูล่าง"
    >
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={t.href}
            data-testid={`tab-${t.key}`}
            aria-current={active ? "page" : undefined}
            className={
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--r-md)] text-[11px] font-semibold transition-colors duration-100 " +
              (active ? "text-[#15885B]" : "text-[var(--text-faint)]")
            }
          >
            <Icon size={20} strokeWidth={2} />
            <span className="th">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
