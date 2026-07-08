import { auth } from "@/auth";
import { Nav } from "../nav";
import { Topbar } from "../topbar";
import { BottomTabBar } from "@/components/bottom-tab-bar";

// (main) route group — the authenticated app shell: sidebar (216px) + topbar (62px) + scrollable
// content. This is a route group (parentheses) so it adds NO URL segment. The `/print` segment
// lives OUTSIDE this group and gets its own no-chrome layout (structural exclusion).
//
// Phase 04 responsive shell: the sidebar Nav shows at md+ only; below md a fixed bottom tab bar
// (mobile-only, ADMIN-gated ผู้ใช้ tab) replaces it. NO `(mobile)/` route group — same routes,
// CSS-breakpoint shell swap. `main` gets bottom padding on mobile so the fixed tab bar never
// covers page content.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
      <div className="hidden shrink-0 md:block">
        <Nav />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>
      <BottomTabBar role={role} />
    </div>
  );
}
