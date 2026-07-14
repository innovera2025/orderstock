"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  BarChart3,
  History,
  Store,
  MapPin,
  Package,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

// Client half of the sidebar nav (E-NAV-SPLIT). The server shell (nav.tsx) reads the session
// + role and passes `role` here; this component owns only the active-link highlighting via
// usePathname. Active = --green-50 bg + --green-800 text.
type Item = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "ปฏิบัติการ",
    items: [
      { href: "/orders", label: "ออเดอร์รายวัน", icon: ClipboardList },
      { href: "/summary", label: "สรุปยอดผลิต", icon: BarChart3 },
      { href: "/history", label: "ประวัติออเดอร์", icon: History },
    ],
  },
  {
    label: "ข้อมูลหลัก",
    items: [
      { href: "/shops", label: "จัดการร้านค้า", icon: Store },
      { href: "/locations", label: "จัดการสถานที่", icon: MapPin },
      { href: "/products", label: "จัดการสินค้า", icon: Package },
      { href: "/admin/users", label: "ผู้ใช้", icon: Users, adminOnly: true },
    ],
  },
  {
    label: "ระบบ",
    items: [{ href: "/settings", label: "ตั้งค่าระบบ", icon: Settings, adminOnly: true }],
  },
];

export function NavLinks({ role }: { role?: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const items = group.items.filter((it) => !it.adminOnly || role === "ADMIN");
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-3 text-[var(--t-2xs)] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              {group.label}
            </span>
            {items.map((it) => {
              const active =
                pathname === it.href || pathname.startsWith(it.href + "/");
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2 text-[var(--t-sm)] transition-colors duration-100 " +
                    (active
                      ? "bg-[var(--green-50)] font-medium text-[var(--green-800)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text)]")
                  }
                >
                  <Icon size={18} strokeWidth={2} className="shrink-0" />
                  <span className="th">{it.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
