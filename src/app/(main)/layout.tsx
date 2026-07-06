import { Nav } from "../nav";

// (main) route group — the authenticated app shell WITH the top nav. This is a route group
// (parentheses), so it adds NO URL segment: /orders, /shops, /products, /admin, / all keep
// their paths. The `/print` segment lives OUTSIDE this group and gets its own no-nav layout
// (structural exclusion, not print-only CSS hiding — Phase 05 decision 7).
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
