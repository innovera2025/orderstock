// erp-dashboards Phase 5 — how a dashboard table identifies itself to the CSV export route.
//
// DESIGN NOTE (plan Step B4, resolved with ZERO edits to any Phase 2/3/4 file): the export target
// is DERIVED from the two props Phase 1's `DashboardDataTable` already receives — `basePath` and
// `searchParams` — rather than threaded down as a new prop through each dashboard's wrapper
// component. That means no call site in `src/app/(main)/dashboards/**` changes at all, so the
// registry's "explicit non-overlap" list is respected without needing its `page.tsx` exception.
//
// The SAME derivation runs in two places, which is why it lives here and not in either of them:
//   - the shared table, to build the "ส่งออก CSV" href;
//   - the export route, to decide which dataset to serialize.
// One function, so the button and the route can never disagree about what "the current view" is.
//
// Deliberately free of React, Next and DB imports so it is trivially unit-testable. The ONE import
// below (`resolveSalesSection`) is a pure string-in/string-out resolver whose own import chain is
// likewise pure — see the note on the sales branch of `deriveExportTarget`.

import { resolveSalesSection } from "@/app/(main)/dashboards/sales/sales-url";

export type ExportDashboard = "sales" | "purchase" | "production";

/**
 * Which dataset a table represents.
 *
 * WIDENED ADDITIVELY (sales-invoice-basis, 23-09-26): `"list"`/`"lines"` keep their exact existing
 * meaning — the DELIVERY tables on Sales, and the Purchase/Production tables — so no existing
 * consumer changes. The two invoice shapes are new values, not renames.
 */
export type ExportTable = "list" | "lines" | "invoice-list" | "invoice-lines";

export interface ExportTarget {
  dashboard: ExportDashboard;
  table: ExportTable;
  /** The drilldown key carried in the PATH (PO number / MO number). Absent for list exports. */
  key?: string;
}

export const EXPORT_ROUTE = "/api/dashboards/export";

type RawSearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v == null || v === "" ? null : v;
}

/**
 * Work out which dataset a table is showing from its `basePath` + current search params.
 *
 * Returns `null` for any path this phase does not export (so the shared component simply renders
 * no export button rather than linking at a route that would 400).
 */
export function deriveExportTarget(
  basePath: string,
  searchParams: RawSearchParams = {},
): ExportTarget | null {
  const segments = basePath.split("?")[0].split("/").filter((s) => s.length > 0);
  if (segments[0] !== "dashboards") return null;

  const dashboard = segments[1];
  const rest = segments.slice(2);

  if (dashboard === "sales") {
    // Sales keeps its drilldown in the query string (`?doNo=` / `?invoiceNo=`), not the path, and
    // since sales-invoice-basis the page carries TWO sections whose list views share one URL.
    //
    // WHY IMPORT THE RESOLVER RATHER THAN RE-DERIVE IT: once neither drilldown param is present —
    // the plain "show me the list" case — the ONLY signal telling the invoice list apart from the
    // delivery list is `view` itself. Hand-copying `sales-url.ts`'s view/precedence rules here
    // would create a second source of truth with nothing binding the two together; they would drift
    // silently, and the first symptom would be a user downloading the wrong section's rows under
    // the right filename. One resolver, imported — the same discipline `SALES_SQL_SOURCES` applies
    // to SQL text. `resolveSalesSection` is pure (no React/Next/DB anywhere in its import chain),
    // so this module stays as unit-testable as it was.
    const section = resolveSalesSection(searchParams);
    if (section === "invoice") {
      return {
        dashboard: "sales",
        table: one(searchParams.invoiceNo) ? "invoice-lines" : "invoice-list",
      };
    }
    return { dashboard: "sales", table: one(searchParams.doNo) ? "lines" : "list" };
  }
  if (dashboard === "purchase" || dashboard === "production") {
    if (rest.length === 0) return { dashboard, table: "list" };
    if (rest.length === 1) {
      return { dashboard, table: "lines", key: safeDecode(rest[0]) };
    }
    return null;
  }
  return null;
}

/** A malformed percent-escape must not throw inside a render path. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Build the export URL for a target, carrying EVERY current search param through unchanged so the
 * exported file matches exactly the filtered/sorted view on screen (AC14's "current filtered
 * view"). `dashboard`/`table`/`key` are set last so a stray same-named search param cannot spoof
 * the target.
 */
export function buildExportHref(target: ExportTarget, searchParams: RawSearchParams = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  params.set("dashboard", target.dashboard);
  params.set("table", target.table);
  if (target.key != null && target.key !== "") params.set("key", target.key);
  return `${EXPORT_ROUTE}?${params.toString()}`;
}

/** Parse a request's params back into a target. Returns `null` when the pair is not recognised. */
export function parseExportTarget(params: URLSearchParams): ExportTarget | null {
  const dashboard = params.get("dashboard");
  const table = params.get("table");
  if (dashboard !== "sales" && dashboard !== "purchase" && dashboard !== "production") return null;
  if (
    table !== "list" &&
    table !== "lines" &&
    table !== "invoice-list" &&
    table !== "invoice-lines"
  ) {
    return null;
  }
  // The two invoice shapes are SALES-ONLY — no other dashboard has an invoice table to export.
  if ((table === "invoice-list" || table === "invoice-lines") && dashboard !== "sales") return null;
  const key = params.get("key");
  // A `lines` export needs a drilldown key in the PATH — except on Sales, which carries its
  // drilldown in the query string instead. That exemption already applied to `"lines"` and extends
  // unchanged to `"invoice-lines"`: both sales line exports read `doNo`/`invoiceNo` from the query.
  if (table === "lines" && dashboard !== "sales" && (key == null || key === "")) return null;
  return { dashboard, table, ...(key ? { key } : {}) };
}

/** The ASCII filename slug for a target, e.g. `purchase-lines-PO-2608-0001`. */
export function exportSlug(target: ExportTarget): string {
  return [target.dashboard, target.table, target.key].filter(Boolean).join("-");
}
