"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toast } from "@/components/ui/toast";
import { useDrawerVisible, toggleDrawer } from "@/lib/sidebar-drawer-store";

// Topbar (Phase 01, C3). Left = page title derived from the route; right = TH/EN toggle
// (EN → "ยังไม่รองรับ EN" toast, TH-only for now), dark-mode toggle, and an EMPTY per-page
// action slot placeholder (E-CONTROLS — existing orders save/print controls are NOT moved
// here this phase; that is Phase 02).
const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/orders", title: "ออเดอร์รายวัน" },
  { prefix: "/summary", title: "สรุปยอดผลิต" },
  { prefix: "/history", title: "ประวัติออเดอร์" },
  { prefix: "/shops", title: "จัดการร้านค้า" },
  { prefix: "/products", title: "จัดการสินค้า" },
  { prefix: "/admin/users", title: "ผู้ใช้" },
  { prefix: "/settings", title: "ตั้งค่าระบบ" },
];

function titleFor(pathname: string): string {
  const match = TITLES.find((t) => pathname === t.prefix || pathname.startsWith(t.prefix + "/"));
  return match?.title ?? "ระบบจัดการออเดอร์สินค้า";
}

export function Topbar() {
  const pathname = usePathname();
  const [toastOpen, setToastOpen] = React.useState(false);
  const drawerVisible = useDrawerVisible();

  return (
    <header className="flex h-[62px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-6">
      <div className="flex items-center gap-2">
        {/* Sidebar toggle — hidden on phone (BottomTabBar is the phone nav); shown at md+ to drive
            the tablet drawer and the desktop fixed-sidebar collapse (same store). */}
        <button
          id="sidebar-hamburger"
          type="button"
          onClick={() => toggleDrawer()}
          aria-label="เปิด/ปิดเมนู"
          aria-controls="app-sidebar"
          aria-expanded={drawerVisible}
          className="hidden h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-100 hover:bg-[var(--bg-sunken)] hover:text-[var(--text)] outline-none focus-visible:shadow-[0_0_0_4px_var(--focus-ring)] md:inline-flex"
        >
          {drawerVisible ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
        </button>
        <h1 className="th text-[var(--t-lg)] font-semibold text-[var(--text-strong)]">
          {titleFor(pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Per-page action slot (empty placeholder — Phase 02 fills it). */}
        <div id="topbar-actions" className="flex items-center gap-2" />

        {/* TH/EN toggle — TH only for now. */}
        <button
          type="button"
          onClick={() => setToastOpen(true)}
          aria-label="สลับภาษา"
          className="inline-flex h-9 items-center rounded-[var(--r-md)] px-3 text-[var(--t-sm)] font-medium text-[var(--text-muted)] transition-colors duration-100 hover:bg-[var(--bg-sunken)] hover:text-[var(--text)] outline-none focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]"
        >
          TH / EN
        </button>

        <ThemeToggle />
      </div>

      <Toast open={toastOpen} message="ยังไม่รองรับ EN" onDone={() => setToastOpen(false)} />
    </header>
  );
}
