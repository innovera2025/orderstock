"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useDrawerOpen, useDrawerVisible, closeDrawer } from "@/lib/sidebar-drawer-store";

// Responsive sidebar shell (responsive-drawer-sidebar plan). Client wrapper owning drawer
// positioning / desktop width-reservation / backdrop / focus / escape / route-close. Receives the
// server-rendered <Nav/> as children (server component passed through a client component — the
// standard RSC "server as children of client" pattern; Nav stays a server component and does its
// own await auth()). Three tiers:
//  - phone (<md): hidden entirely — BottomTabBar is the nav surface (rendered by layout.tsx).
//  - tablet (md to <lg): off-canvas fixed drawer + backdrop, default closed.
//  - desktop (lg+): fixed 216px sidebar in flow, collapsible via the same store.
const DESKTOP_QUERY = "(min-width: 1024px)";

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const open = useDrawerOpen(); // raw tri-state (boolean | null)
  const visible = useDrawerVisible(); // resolved "is it actually visible now"
  const pathname = usePathname();

  // Desktop reserves 216px of flex width unless explicitly collapsed (open === false).
  const reserved = open !== false;

  // Translate classes per Design → CSS class list.
  const translate =
    open === true
      ? "translate-x-0"
      : open === false
        ? "-translate-x-full"
        : "-translate-x-full lg:translate-x-0";

  // Route change → close (skip the initial mount so first paint doesn't fire a no-op).
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    closeDrawer();
  }, [pathname]);

  // Escape closes + returns focus to the hamburger; listener attached only while visible.
  React.useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDrawer();
        document.getElementById("sidebar-hamburger")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  // Focus-on-open (tablet only): move focus into the drawer when it becomes visible, but skip at
  // desktop where the collapse is a layout reflow, not a modal-style reveal (stealing focus there
  // would be surprising).
  React.useEffect(() => {
    if (!visible) return;
    const isDesktop = window.matchMedia?.(DESKTOP_QUERY).matches ?? false;
    if (isDesktop) return;
    const sidebar = document.getElementById("app-sidebar");
    sidebar?.querySelector<HTMLElement>("a")?.focus();
  }, [visible]);

  return (
    <>
      {/* Backdrop — tablet only (md:block lg:hidden); mounts only while visually open so it never
          intercepts clicks when closed. No backdrop at desktop (pure layout reflow). */}
      {visible && (
        <div
          onClick={() => closeDrawer()}
          aria-hidden="true"
          data-testid="sidebar-backdrop"
          className="fixed inset-0 z-40 hidden bg-black/40 transition-opacity duration-200 motion-reduce:transition-none md:block lg:hidden"
        />
      )}

      {/* Width-reservation wrapper — hidden on phone (BottomTabBar instead); reserves 216px at lg
          unless collapsed. */}
      <div
        className={
          "hidden shrink-0 md:block " +
          (reserved ? "lg:w-[216px]" : "lg:w-0 lg:overflow-hidden")
        }
      >
        {/* Transform/position wrapper — fixed off-canvas below lg, static in-flow at lg+. */}
        <div
          className={
            "fixed inset-y-0 left-0 z-50 transition-transform duration-200 " +
            "ease-[cubic-bezier(0.25,0.46,0.45,0.94)] motion-reduce:transition-none " +
            "lg:static lg:z-auto lg:transition-none " +
            translate
          }
        >
          {children}
        </div>
      </div>
    </>
  );
}
