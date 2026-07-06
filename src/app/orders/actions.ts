"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthState } from "@/lib/auth-guard";
import { mergeSnapshots, type IncomingCell } from "@/lib/order-save";

// Order-entry server actions (Phase 04). ALL actions call requireAuthState — proxy.ts gates pages
// only; a raw POST bypasses page routing, so this is the real boundary (auth/all-auth.md). Each
// domain owns its ActionState; this merges the { error } shape from requireAuthState.

export interface OrderSheetActionState {
  error?: string;
  ok?: boolean;
  savedAt?: string;
}

const newSheetSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันที่ให้ถูกต้อง"),
  location: z
    .string()
    .trim()
    .max(200, "สถานที่ยาวเกินไป")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

/** Build a UTC-midnight Date for a @db.Date column from a yyyy-mm-dd input (no TZ drift). */
function toDbDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Create a new daily order sheet (date + optional สถานที่). App-level duplicate check runs INSIDE
 * the same transaction as the create (OrderSheet has NO DB unique on date+location, decision 3);
 * on conflict we redirect to the existing sheet instead of creating a second one.
 */
export async function createOrderSheet(
  _prev: OrderSheetActionState,
  formData: FormData,
): Promise<OrderSheetActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = newSheetSchema.safeParse({
    date: formData.get("date"),
    location: formData.get("location"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const date = toDbDate(parsed.data.date);
  const location = parsed.data.location;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.orderSheet.findFirst({ where: { date, location } });
    if (existing) return { id: existing.id, existed: true };
    const created = await tx.orderSheet.create({ data: { date, location } });
    return { id: created.id, existed: false };
  });

  revalidatePath("/orders");
  // Redirect to the grid editor (existing or brand-new). "เปิดชีตนี้" on a duplicate.
  redirect(`/orders/${result.id}`);
}

/**
 * Whole-sheet save (decision 2). Delete-and-recreate lines inside one transaction, PRESERVING the
 * historical snapshot text for cells that already existed (Phase-02 correction-cascade lock).
 * REQUIRED order (SQL Server NoAction FKs — no cascade): read existing rows FIRST → explicitly
 * delete child OrderLine/NoteLine → re-insert carrying forward snapshots (fresh only for new
 * cells) → keep the SAME OrderSheet row (bump updatedAt).
 */
export async function saveOrderSheet(
  sheetId: number,
  _prev: OrderSheetActionState,
  formData: FormData,
): Promise<OrderSheetActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const sheet = await prisma.orderSheet.findUnique({ where: { id: sheetId } });
  if (!sheet) return { error: "ไม่พบใบออเดอร์" };

  // Parse grid cells (cell:{shopId}:{variantId}) and note rows (note:{shopId}).
  const incoming: IncomingCell[] = [];
  const noteEntries: { shopId: number; text: string }[] = [];
  for (const [rawKey, rawVal] of formData.entries()) {
    if (typeof rawVal !== "string") continue;
    if (rawKey.startsWith("cell:")) {
      const [, shopId, variantId] = rawKey.split(":");
      const trimmed = rawVal.trim();
      if (trimmed === "") continue; // blank = omit line (never qty 0)
      const qty = Number(trimmed);
      if (!Number.isInteger(qty) || qty <= 0) {
        return { error: "จำนวนต้องเป็นจำนวนเต็มบวก" };
      }
      incoming.push({ shopId: Number(shopId), variantId: Number(variantId), qty });
    } else if (rawKey.startsWith("note:")) {
      const [, shopId] = rawKey.split(":");
      const text = rawVal.trim();
      if (text === "") continue;
      noteEntries.push({ shopId: Number(shopId), text });
    }
  }

  // Live master-data names (fresh snapshots for brand-new cells) + off-list variants (note match).
  const [shops, variants] = await Promise.all([
    prisma.shop.findMany({ select: { id: true, name: true } }),
    prisma.productVariant.findMany({ select: { id: true, name: true, printOrder: true } }),
  ]);
  const liveShopNames = new Map(shops.map((s) => [s.id, s.name]));
  const liveVariantNames = new Map(variants.map((v) => [v.id, v.name]));
  const offListByName = new Map(
    variants.filter((v) => v.printOrder === null).map((v) => [v.name.trim(), v]),
  );

  await prisma.$transaction(async (tx) => {
    // (1) Read existing lines FIRST — capture their snapshot text before deleting.
    const [existingLines, existingNotes] = await Promise.all([
      tx.orderLine.findMany({ where: { sheetId } }),
      tx.noteLine.findMany({ where: { sheetId } }),
    ]);

    // (2) Explicitly delete children — NoAction FKs, never rely on cascade.
    await tx.orderLine.deleteMany({ where: { sheetId } });
    await tx.noteLine.deleteMany({ where: { sheetId } });

    // (3a) OrderLine cells — carry forward snapshots for pre-existing (shopId+variantId) cells.
    const merged = mergeSnapshots(
      existingLines.map((l) => ({
        shopId: l.shopId,
        variantId: l.variantId,
        shopNameAtEntry: l.shopNameAtEntry,
        variantNameAtEntry: l.variantNameAtEntry,
      })),
      incoming,
      { shopNames: liveShopNames, variantNames: liveVariantNames },
    );
    if (merged.length > 0) {
      await tx.orderLine.createMany({ data: merged.map((m) => ({ sheetId, ...m })) });
    }

    // (3b) NoteLines — auto-resolve exact-text match to an off-list variant (set productVariantId
    // AND keep the raw text, decision 5). Carry forward the shop-name snapshot for a note that
    // already existed (same shopId+text) so a rename does not rewrite note history either.
    const existingNoteByKey = new Map(
      existingNotes.map((n) => [`${n.shopId}:${n.text}`, n]),
    );
    for (const note of noteEntries) {
      const match = offListByName.get(note.text.trim());
      const prior = existingNoteByKey.get(`${note.shopId}:${note.text}`);
      await tx.noteLine.create({
        data: {
          sheetId,
          shopId: note.shopId,
          text: note.text,
          productVariantId: match?.id ?? null,
          shopNameAtEntry: prior?.shopNameAtEntry ?? liveShopNames.get(note.shopId) ?? null,
          variantNameAtEntry: prior?.variantNameAtEntry ?? match?.name ?? null,
        },
      });
    }

    // (4) Keep the SAME OrderSheet row; bump updatedAt (last-write-wins accepted, decision 2).
    await tx.orderSheet.update({ where: { id: sheetId }, data: { updatedAt: new Date() } });
  });

  revalidatePath(`/orders/${sheetId}`);
  revalidatePath("/orders");
  return { ok: true, savedAt: new Date().toISOString() };
}
