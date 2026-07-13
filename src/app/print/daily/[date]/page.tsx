import { redirect } from "next/navigation";
import { requireAuth, AuthError } from "@/lib/auth-guard";
import { getSheetForPrint } from "@/lib/get-sheet-for-print";
import { PrintTable } from "../../print-table";
import { PrintControls } from "../../print-controls";

export const dynamic = "force-dynamic";

// Combined daily sheet: the sheet-location's shops (variable row count, displayNo 1..N) in ONE
// table on ONE page. Reads snapshot columns via
// getSheetForPrint (never live names). E1a: requireAuth() is called explicitly — proxy.ts gates
// the route, but a raw request path must still hit the real server-side boundary. E1c: requireAuth
// throws AuthError; we map it to a graceful /login redirect rather than the error boundary.
export default async function DailyPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ location?: string }>;
}) {
  try {
    await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }

  const { date } = await params;
  const { location } = await searchParams;
  const sheet = await getSheetForPrint(date, location ?? null);

  const title = `ใบออเดอร์สินค้า วันที่ ${sheet.dateBE}${
    sheet.location ? ` — ${sheet.location}` : ""
  }`;

  return (
    <>
      <PrintControls />
      {!sheet.found ? (
        <p className="text-sm text-zinc-500">ไม่พบใบออเดอร์ของวันที่นี้</p>
      ) : (
        <PrintTable
          title={title}
          columns={sheet.columns}
          rows={sheet.rows}
          columnTotals={sheet.columnTotals}
          grandTotal={sheet.grandTotal}
          noteTally={sheet.noteTally}
        />
      )}
    </>
  );
}
