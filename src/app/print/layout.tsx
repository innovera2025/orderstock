import "@/styles/print.css";

// Dedicated NO-NAV layout for the /print segment (Phase 05 decision 7). This is STRUCTURAL
// exclusion — the app top nav lives in the (main) route group, which /print is not part of, so
// the nav is never rendered into the DOM here (not merely hidden with @media print). Print pages
// still call requireAuth() explicitly (E1a): proxy.ts gates the page route, requireAuth is the
// real server-side boundary.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-canvas">{children}</div>;
}
