import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrderGrid, type GridColumn, type GridRow } from "../order-grid";
import { ceToBeDisplay } from "@/lib/be-date";

export const dynamic = "force-dynamic";

// The whole 29-slot roster is always rendered (incl. blank gaps 4/6/20/29). Max seeded slot is 28;
// slot 29 is a trailing blank gap.
const ROSTER_SLOTS = 29;

function normalizeDbDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export default async function OrderSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sheetId = Number(id);
  if (!Number.isInteger(sheetId)) notFound();

  const sheet = await prisma.orderSheet.findUnique({ where: { id: sheetId } });
  if (!sheet) notFound();

  const [shops, variants, orderLines, noteLines] = await Promise.all([
    prisma.shop.findMany({ orderBy: { rosterOrder: "asc" } }),
    prisma.productVariant.findMany({
      where: { printOrder: { not: null } },
      orderBy: { printOrder: "asc" },
      include: { product: { select: { group: true } } },
    }),
    prisma.orderLine.findMany({ where: { sheetId } }),
    prisma.noteLine.findMany({ where: { sheetId } }),
  ]);

  const columns: GridColumn[] = variants.map((v) => ({
    variantId: v.id,
    printOrder: v.printOrder as number,
    name: v.name,
    group: v.product.group,
  }));

  const shopBySlot = new Map(shops.map((s) => [s.rosterOrder, s]));
  const rows: GridRow[] = [];
  for (let slot = 1; slot <= ROSTER_SLOTS; slot++) {
    const shop = shopBySlot.get(slot);
    rows.push({
      rosterOrder: slot,
      shopId: shop?.id ?? null,
      shopName: shop?.name ?? null,
    });
  }

  // Initial cell values: `${shopId}:${variantId}` → qty. Notes: shopId → first note text.
  const initialCells: Record<string, number> = {};
  for (const line of orderLines) {
    initialCells[`${line.shopId}:${line.variantId}`] = line.qty;
  }
  const initialNotes: Record<number, string> = {};
  for (const note of noteLines) {
    if (note.shopId != null && !(note.shopId in initialNotes)) {
      initialNotes[note.shopId] = note.text;
    }
  }

  return (
    <main className="w-full p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">
          ใบออเดอร์ วันที่ {ceToBeDisplay(normalizeDbDate(sheet.date))}
          {sheet.location ? ` — ${sheet.location}` : ""}
        </h1>
        <p className="text-xs text-zinc-500">
          แก้ไขล่าสุด: {ceToBeDisplay(normalizeDbDate(sheet.updatedAt))} ({sheet.updatedAt.toLocaleTimeString("th-TH")})
        </p>
      </div>

      <OrderGrid
        sheetId={sheetId}
        columns={columns}
        rows={rows}
        initialCells={initialCells}
        initialNotes={initialNotes}
      />
    </main>
  );
}
