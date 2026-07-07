import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrderMatrix, type GridColumn, type GridRow, type PrintLink } from "../order-matrix";
import { ceToBeDisplay, toDateInputValue } from "@/lib/be-date";

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
      include: { product: { select: { id: true, group: true, name: true } } },
    }),
    prisma.orderLine.findMany({ where: { sheetId } }),
    prisma.noteLine.findMany({ where: { sheetId } }),
  ]);

  const columns: GridColumn[] = variants.map((v) => ({
    variantId: v.id,
    printOrder: v.printOrder as number,
    name: v.name,
    group: v.product.group,
    productId: v.product.id,
    productName: v.product.name,
    packSize: v.packSize,
    labelVariant: v.labelVariant,
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

  const dateParam = toDateInputValue(normalizeDbDate(sheet.date));
  const locSuffix = sheet.location ? `?location=${encodeURIComponent(sheet.location)}` : "";
  const printLinks: PrintLink[] = [
    { href: `/print/daily/${dateParam}${locSuffix}`, label: "พิมพ์รวมทั้งวัน" },
    { href: `/print/shops/${dateParam}${locSuffix}`, label: "พิมพ์แยกร้าน" },
  ];

  return (
    <main className="w-full p-4">
      <div className="mb-4">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">
          ใบออเดอร์ วันที่ {ceToBeDisplay(normalizeDbDate(sheet.date))}
          {sheet.location ? ` — ${sheet.location}` : ""}
        </h1>
        <p className="text-[12px] text-[var(--text-muted)]">
          แก้ไขล่าสุด: {ceToBeDisplay(normalizeDbDate(sheet.updatedAt))} ({sheet.updatedAt.toLocaleTimeString("th-TH")})
        </p>
      </div>

      <OrderMatrix
        sheetId={sheetId}
        columns={columns}
        rows={rows}
        initialCells={initialCells}
        initialNotes={initialNotes}
        printLinks={printLinks}
      />
    </main>
  );
}
