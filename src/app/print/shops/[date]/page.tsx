import { redirect } from "next/navigation";
import { requireAuth, AuthError } from "@/lib/auth-guard";
import { getSheetForPrint, type PrintRow } from "@/lib/get-sheet-for-print";
import { computeColumnTotals, computeGrandTotal } from "@/lib/totals";
import { PrintTable } from "../../print-table";
import { PrintControls } from "../../print-controls";

export const dynamic = "force-dynamic";

/** Recompute per-shop totals from a single row's cells (each per-shop page totals only that shop). */
function rowTotals(row: PrintRow) {
  const cells = Object.entries(row.cells).map(([printOrder, qty]) => ({
    rosterOrder: row.rosterOrder,
    printOrder: Number(printOrder),
    qty,
  }));
  return { columnTotals: computeColumnTotals(cells), grandTotal: computeGrandTotal(cells) };
}

// Per-shop sheets: one shop per page (.sheet { break-after: page }) in a SINGLE print job. Reads the
// same snapshot-backed getSheetForPrint result and filters it in memory (decision 8). `?slots=1,2,3`
// selects specific roster slots; without it, every shop that ordered (has a cell or a note) prints.
export default async function ShopsPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ location?: string; slots?: string }>;
}) {
  try {
    await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }

  const { date } = await params;
  const { location, slots } = await searchParams;
  const sheet = await getSheetForPrint(date, location ?? null);

  const selected = slots
    ? new Set(slots.split(",").map((s) => Number(s.trim())).filter(Number.isInteger))
    : null;

  const shopRows = sheet.rows.filter((row) => {
    if (row.shopId == null) return false;
    if (selected) return selected.has(row.rosterOrder);
    return Object.keys(row.cells).length > 0 || row.note != null;
  });

  return (
    <>
      <PrintControls />
      {shopRows.length === 0 ? (
        <p className="text-sm text-zinc-500">ไม่พบร้านค้าที่มีออเดอร์ในวันที่นี้</p>
      ) : (
        shopRows.map((row) => {
          const { columnTotals, grandTotal } = rowTotals(row);
          const title = `${row.shopName ?? ""} — วันที่ ${sheet.dateBE}`;
          return (
            <PrintTable
              key={row.rosterOrder}
              title={title}
              columns={sheet.columns}
              rows={[row]}
              columnTotals={columnTotals}
              grandTotal={grandTotal}
              noteTally={sheet.noteTally}
            />
          );
        })
      )}
    </>
  );
}
