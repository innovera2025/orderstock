// Shared print fetch (Phase 05, decision 8 + fetch-drift LOAD-BEARING). BOTH print routes
// (combined daily + per-shop) call this. It reads the HISTORICAL snapshot columns
// (`shopNameAtEntry` / `variantNameAtEntry`) written at order-entry time — NEVER the live
// `Shop.name` / `ProductVariant.name`. This is why a shop renamed AFTER a sheet was recorded
// still prints under its original name (Phase-02 decision 6 historical fidelity; gate G4).
//
// The daily view returns ALL 29 roster slots (including the blank gaps 4/6/20/29); the per-shop
// view filters this same result in memory (decision 8) — one fetch, two renderings.
import { prisma } from "@/lib/db";
import { ceToBeDisplay } from "@/lib/be-date";
import {
  computeColumnTotals,
  computeGrandTotal,
  type OrderLineCell,
} from "@/lib/totals";
import { PRODUCT_GROUPS } from "@/lib/product-order";

// The paper form always renders the full 29-slot roster (max seeded slot is 28; slot 29 is a
// trailing blank gap). Mirrors `orders/[id]/page.tsx` ROSTER_SLOTS.
const ROSTER_SLOTS = 29;

export interface PrintColumn {
  printOrder: number;
  /** Column header name: `variantNameAtEntry` if ≥1 OrderLine exists this date, else live name (E1b). */
  name: string;
  /** "GOODS" | "SEASONING" — drives the grouped top-tier header + the C18/C19 heavy divider. */
  group: string;
}

export interface PrintRow {
  rosterOrder: number;
  shopId: number | null;
  /** Snapshot shop name when the shop ordered on this sheet; else live name; null for a blank gap. */
  shopName: string | null;
  /** The per-row หมายเหตุ free text (first note for the shop), or null. */
  note: string | null;
  /** `printOrder` → qty for this row (only in-order cells). */
  cells: Record<number, number>;
}

/** One aggregated footer tally line (off-list products written in the per-row หมายเหตุ column). */
export interface NoteTallyLine {
  text: string;
  /** Summed qty across matching notes, or null when every matching note had no qty (standing reminder). */
  qty: number | null;
}

export interface PrintSheet {
  found: boolean;
  date: Date;
  dateBE: string;
  location: string | null;
  columns: PrintColumn[];
  rows: PrintRow[];
  columnTotals: Record<number, number>;
  grandTotal: number;
  noteTally: NoteTallyLine[];
}

/** Build a UTC-midnight Date for a @db.Date column from a yyyy-mm-dd string (no TZ drift). */
function parseDbDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Build a LOCAL-midnight Date (for BE display, which reads local day/month) from yyyy-mm-dd. */
function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// Standing reminder lines (form-canonical REF §7 tally-list-1) — printed products that appear on
// the form with blank/zero values as recurring reminders, independent of any note entered this day.
const STANDING_REMINDERS: readonly string[] = [
  "รอง(ปี๊บ)",
  "กรวด(กระสอบ)",
  "ดีนิ่ม A เข้ม",
  "รองดำใส 1/2 กก.",
];

/**
 * Fetch one daily order sheet as a print-ready model reading only snapshot columns. Returns
 * `{ found: false, rows: [] }` when no sheet exists for the date (+ optional location).
 */
export async function getSheetForPrint(
  dateStr: string,
  location?: string | null,
): Promise<PrintSheet> {
  const date = parseDbDate(dateStr);

  const sheet = await prisma.orderSheet.findFirst({
    where: { date, active: true, ...(location != null ? { location } : {}) },
    orderBy: { id: "asc" },
  });

  // Live master data is used ONLY for the column-header fallback (E1b) and the roster skeleton —
  // never for row/column snapshot names of recorded cells.
  const [shops, variants] = await Promise.all([
    prisma.shop.findMany({ orderBy: { rosterOrder: "asc" } }),
    prisma.productVariant.findMany({
      where: { printOrder: { not: null } },
      orderBy: { printOrder: "asc" },
      include: { product: { select: { group: true } } },
    }),
  ]);

  const orderLines = sheet
    ? await prisma.orderLine.findMany({ where: { sheetId: sheet.id } })
    : [];
  const noteLines = sheet
    ? await prisma.noteLine.findMany({ where: { sheetId: sheet.id } })
    : [];

  const rosterByShopId = new Map(shops.map((s) => [s.id, s.rosterOrder]));

  // Snapshot shop names: for a shop that ordered on this sheet, use the recorded snapshot; a shop
  // with no orders has no snapshot → fall back to the live name (documented boundary).
  const snapshotShopName = new Map<number, string>();
  for (const line of orderLines) {
    if (!snapshotShopName.has(line.shopId)) snapshotShopName.set(line.shopId, line.shopNameAtEntry);
  }
  for (const note of noteLines) {
    if (note.shopId != null && note.shopNameAtEntry && !snapshotShopName.has(note.shopId)) {
      snapshotShopName.set(note.shopId, note.shopNameAtEntry);
    }
  }

  // Column-header name source (E1b): snapshot variant name when any OrderLine exists for that
  // printOrder on this date, else the live ProductVariant.name (a zero-order column has no snapshot).
  const snapshotVariantName = new Map<number, string>();
  const variantPrintOrderById = new Map(
    variants.map((v) => [v.id, v.printOrder as number]),
  );
  for (const line of orderLines) {
    const printOrder = variantPrintOrderById.get(line.variantId);
    if (printOrder != null && !snapshotVariantName.has(printOrder)) {
      snapshotVariantName.set(printOrder, line.variantNameAtEntry);
    }
  }

  const columns: PrintColumn[] = variants.map((v) => {
    const printOrder = v.printOrder as number;
    return {
      printOrder,
      name: snapshotVariantName.get(printOrder) ?? v.name,
      group: v.product.group,
    };
  });

  // Cells keyed by rosterOrder for the row render; also fed to the totals engine.
  const cellsByRoster = new Map<number, Record<number, number>>();
  const totalsCells: OrderLineCell[] = [];
  for (const line of orderLines) {
    const rosterOrder = rosterByShopId.get(line.shopId);
    const printOrder = variantPrintOrderById.get(line.variantId);
    if (rosterOrder == null || printOrder == null) continue;
    const row = cellsByRoster.get(rosterOrder) ?? {};
    row[printOrder] = (row[printOrder] ?? 0) + line.qty;
    cellsByRoster.set(rosterOrder, row);
    totalsCells.push({ rosterOrder, printOrder, qty: line.qty });
  }

  // First per-row note text (the on-form หมายเหตุ column shows one line per shop row).
  const noteByRoster = new Map<number, string>();
  for (const note of noteLines) {
    if (note.shopId == null) continue;
    const rosterOrder = rosterByShopId.get(note.shopId);
    if (rosterOrder == null) continue;
    if (!noteByRoster.has(rosterOrder)) noteByRoster.set(rosterOrder, note.text);
  }

  const rows: PrintRow[] = [];
  const shopByRoster = new Map(shops.map((s) => [s.rosterOrder, s]));
  for (let slot = 1; slot <= ROSTER_SLOTS; slot++) {
    const shop = shopByRoster.get(slot);
    rows.push({
      rosterOrder: slot,
      shopId: shop?.id ?? null,
      shopName: shop ? snapshotShopName.get(shop.id) ?? shop.name : null,
      note: noteByRoster.get(slot) ?? null,
      cells: cellsByRoster.get(slot) ?? {},
    });
  }

  // Footer tally: aggregate this sheet's NoteLines by text (sum qty; null when all null), then
  // append the standing reminder lines that are not already present.
  const tallyByText = new Map<string, number | null>();
  for (const note of noteLines) {
    const key = note.text.trim();
    const prev = tallyByText.has(key) ? tallyByText.get(key)! : null;
    if (note.qty != null) tallyByText.set(key, (prev ?? 0) + note.qty);
    else if (!tallyByText.has(key)) tallyByText.set(key, null);
  }
  const noteTally: NoteTallyLine[] = [...tallyByText.entries()].map(([text, qty]) => ({ text, qty }));
  for (const reminder of STANDING_REMINDERS) {
    if (!tallyByText.has(reminder)) noteTally.push({ text: reminder, qty: null });
  }

  // Guard the group ordering invariant (GOODS then SEASONING → the heavy C18/C19 divider).
  void PRODUCT_GROUPS;

  return {
    found: Boolean(sheet),
    date,
    dateBE: ceToBeDisplay(parseLocalDate(dateStr)),
    location: sheet?.location ?? location ?? null,
    columns,
    rows,
    columnTotals: computeColumnTotals(totalsCells),
    grandTotal: computeGrandTotal(totalsCells),
    noteTally,
  };
}
