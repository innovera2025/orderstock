import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OrderMatrix, type GridColumn, type GridRow, type PrintLink } from "../order-matrix";
import { ceToBeDisplay, toDateInputValue } from "@/lib/be-date";
import { buildLocationRoster } from "@/lib/roster";

export const dynamic = "force-dynamic";

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
  // A soft-deleted sheet is treated as "does not exist" — not editable.
  if (!sheet || !sheet.active) notFound();

  const [shops, variants, orderLines, noteLines] = await Promise.all([
    prisma.shop.findMany({ where: { active: true }, orderBy: { rosterOrder: "asc" } }),
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

  // Per-location roster: filter the active shops to this sheet's location (fallback to all active
  // shops when null/no-match), renumbered 1..N via displayNo. Single source of truth = roster.ts.
  const rows: GridRow[] = buildLocationRoster(shops, sheet.location).map((r) => ({
    rosterOrder: r.rosterOrder,
    displayNo: r.displayNo,
    shopId: r.shopId,
    shopName: r.shopName,
  }));

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
        dateLabel={ceToBeDisplay(normalizeDbDate(sheet.date))}
      />
    </main>
  );
}
