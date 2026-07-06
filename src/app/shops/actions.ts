"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, requireAuthState } from "@/lib/auth-guard";
import {
  cascadeShopNameCorrection,
  type CascadeDb,
} from "@/lib/correction-cascade";

// Thai-message zod schema colocated with the action (decision 5).
const shopSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อร้านค้า").max(200, "ชื่อร้านค้ายาวเกินไป"),
  rosterOrder: z.coerce
    .number({ message: "ลำดับต้องเป็นตัวเลข" })
    .int("ลำดับต้องเป็นจำนวนเต็ม")
    .positive("ลำดับต้องมากกว่า 0"),
  needsConfirmation: z.coerce.boolean().optional().default(false),
});

// Prisma-backed cascade DB: back-fill name snapshots on OrderLine + NoteLine.
const cascadeDb: CascadeDb = {
  async backfillShopNameSnapshots(shopId, newName) {
    const [orderLines, noteLines] = await prisma.$transaction([
      prisma.orderLine.updateMany({ where: { shopId }, data: { shopNameAtEntry: newName } }),
      prisma.noteLine.updateMany({ where: { shopId }, data: { shopNameAtEntry: newName } }),
    ]);
    return orderLines.count + noteLines.count;
  },
  async backfillVariantNameSnapshots(variantId, newName) {
    const [orderLines, noteLines] = await prisma.$transaction([
      prisma.orderLine.updateMany({ where: { variantId }, data: { variantNameAtEntry: newName } }),
      prisma.noteLine.updateMany({
        where: { productVariantId: variantId },
        data: { variantNameAtEntry: newName },
      }),
    ]);
    return orderLines.count + noteLines.count;
  },
};

export interface ShopActionState {
  error?: string;
}

export async function createShop(
  _prev: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = shopSchema.safeParse({
    name: formData.get("name"),
    rosterOrder: formData.get("rosterOrder"),
    needsConfirmation: formData.get("needsConfirmation") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const existing = await prisma.shop.findUnique({
    where: { rosterOrder: parsed.data.rosterOrder },
  });
  if (existing) {
    return { error: `ลำดับ ${parsed.data.rosterOrder} ถูกใช้แล้ว` };
  }

  await prisma.shop.create({ data: parsed.data });
  revalidatePath("/shops");
  redirect("/shops");
}

export async function updateShop(
  shopId: number,
  _prev: ShopActionState,
  formData: FormData,
): Promise<ShopActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = shopSchema.safeParse({
    name: formData.get("name"),
    rosterOrder: formData.get("rosterOrder"),
    needsConfirmation: formData.get("needsConfirmation") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const current = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!current) {
    return { error: "ไม่พบร้านค้า" };
  }

  // rosterOrder is APPEND-ONLY/immutable once referenced by any line. Guard the edit.
  if (parsed.data.rosterOrder !== current.rosterOrder) {
    const referenced =
      (await prisma.orderLine.count({ where: { shopId } })) +
      (await prisma.noteLine.count({ where: { shopId } }));
    if (referenced > 0) {
      return { error: "ไม่สามารถแก้ไขลำดับของร้านค้าที่ถูกใช้งานแล้ว" };
    }
    const clash = await prisma.shop.findUnique({
      where: { rosterOrder: parsed.data.rosterOrder },
    });
    if (clash && clash.id !== shopId) {
      return { error: `ลำดับ ${parsed.data.rosterOrder} ถูกใช้แล้ว` };
    }
  }

  // Edit-save clears needsConfirmation once the user confirms the name (decision 4).
  // Whether we clear it: an explicit "confirm" checkbox drives it. If the form leaves
  // needsConfirmation unchecked, treat that as "confirmed".
  const willConfirm = !parsed.data.needsConfirmation;
  const nameChanged = parsed.data.name !== current.name;

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      name: parsed.data.name,
      rosterOrder: parsed.data.rosterOrder,
      needsConfirmation: parsed.data.needsConfirmation,
    },
  });

  // Correction cascade: propagate the name fix to snapshots ONLY while the shop was still
  // needsConfirmation before this edit (locks once confirmed) — decision 6.
  if (nameChanged) {
    await cascadeShopNameCorrection(cascadeDb, shopId, parsed.data.name, current.needsConfirmation);
  }

  void willConfirm;
  revalidatePath("/shops");
  redirect("/shops");
}

export async function softDeleteShop(shopId: number): Promise<void> {
  await requireAuth();
  // SOFT-DELETE only (active=false) — never hard delete; historical FKs must resolve.
  await prisma.shop.update({ where: { id: shopId }, data: { active: false } });
  revalidatePath("/shops");
}

export async function restoreShop(shopId: number): Promise<void> {
  await requireAuth();
  await prisma.shop.update({ where: { id: shopId }, data: { active: true } });
  revalidatePath("/shops");
}
