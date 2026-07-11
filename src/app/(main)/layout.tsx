import { auth } from "@/auth";
import { Nav } from "../nav";
import { Topbar } from "../topbar";
import { SidebarShell } from "./sidebar-shell";
import { BottomTabBar } from "@/components/bottom-tab-bar";

// (main) route group — the authenticated app shell: sidebar (216px) + topbar (62px) + scrollable
// content. This is a route group (parentheses) so it adds NO URL segment. The `/print` segment
// lives OUTSIDE this group and gets its own no-chrome layout (structural exclusion).
//
// Responsive shell (3 tiers, via SidebarShell): phone (<md) uses the fixed bottom tab bar only;
// tablet (md–<lg) uses an off-canvas drawer + hamburger; desktop (lg+) uses the fixed 216px sidebar
// with a functional hamburger collapse. NO `(mobile)/` route group — same routes, CSS-breakpoint +
// client-state shell swap. `main` gets bottom padding on mobile so the fixed tab bar never covers
// page content.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
      <SidebarShell>
        <Nav />
      </SidebarShell>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>
      <BottomTabBar role={role} />
    </div>
  );
}
