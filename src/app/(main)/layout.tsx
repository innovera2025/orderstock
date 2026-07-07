import { Nav } from "../nav";
import { Topbar } from "../topbar";

// (main) route group — the authenticated app shell: sidebar (216px) + topbar (62px) + scrollable
// content. This is a route group (parentheses) so it adds NO URL segment. The `/print` segment
// lives OUTSIDE this group and gets its own no-chrome layout (structural exclusion).
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
      <Nav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
