import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-guard";
import { CSV_ROW_CAP, csvFilename, csvHeaders, renderCsv } from "@/lib/erp/csv-export";
import { exportSlug, parseExportTarget } from "@/lib/erp/dashboard-export-target";
import { UnknownExportTargetError, loadExportDataset } from "./export-datasets";

// CSV export for every ERP dashboard table — /api/dashboards/export (erp-dashboards Phase 5).
//
// ONE route for all six tables (Sales list/lines, Purchase list/lines, Production list/lines).
// DECISION (plan Step A1, shared-route-with-delegation): a single handler keeps `requireAuth()`,
// the money gate, the row cap, the BOM and the `Content-Disposition` convention in ONE place. Three
// separate routes would mean three copies of each, and a future money-gate fix applied to two of
// them. `export-datasets.ts` holds the per-dashboard delegation.
//
// AUTH (AC14): `requireAuth()` with no role — BOTH Admin and Staff may export. The role gate is on
// the MONEY COLUMNS INSIDE the file, not on access to the export itself.
//
// MONEY (AC9): `canSeeMoney` is computed here, server-side, from the fresh DB-backed session, and
// re-applied at serialization time. It is NOT inherited from whatever the page happened to render —
// an export that trusted a client-supplied flag would be the obvious bypass.
//
// READ-ONLY: every dataset branch calls the dashboard's existing data function, which reaches the
// ERP only through Phase 1's `guardedQuery()`. This route opens no connection of its own.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
  const canSeeMoney = user.role === "ADMIN";

  const url = new URL(request.url);
  const target = parseExportTarget(url.searchParams);
  if (!target) {
    return NextResponse.json(
      { error: "ไม่รู้จักตารางที่ขอส่งออก (dashboard/table ไม่ถูกต้อง)" },
      { status: 400 },
    );
  }

  let dataset;
  try {
    dataset = await loadExportDataset(target, url.searchParams, canSeeMoney);
  } catch (error) {
    // An unwired `dashboard:table` pair is a BAD REQUEST, not a server fault — and never a reason
    // to serve some other dashboard's rows under this dashboard's filename.
    if (error instanceof UnknownExportTargetError) {
      return NextResponse.json(
        { error: "ไม่รู้จักตารางที่ขอส่งออก (dashboard/table ไม่ถูกต้อง)" },
        { status: 400 },
      );
    }
    // Never echo the driver error to the client — it can carry host and login detail.
    console.error(
      "[dashboards/export] ERP read failed; no CSV produced.",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "ไม่สามารถอ่านข้อมูลจากระบบ ERP ได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 503 },
    );
  }

  const rendered = renderCsv(dataset, CSV_ROW_CAP);
  const filename = csvFilename(exportSlug(target), new Date().toISOString().slice(0, 10));

  return new NextResponse(rendered.body, {
    status: 200,
    headers: {
      ...csvHeaders(filename, rendered),
      // Mirrors the on-screen degrade banner: the file may be last-known-good data.
      "X-Export-Stale": dataset.stale ? "1" : "0",
    },
  });
}
