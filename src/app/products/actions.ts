"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, requireAuthState } from "@/lib/auth-guard";
import {
  PACK_SIZES,
  PRODUCT_GROUPS,
  variantDisplayName,
  type PackSize,
} from "@/lib/product-order";
import { isPrintOrderAvailable } from "@/lib/variant-validation";
import {
  cascadeVariantNameCorrection,
  type CascadeDb,
} from "@/lib/correction-cascade";

const cascadeDb: CascadeDb = {
  async backfillShopNameSnapshots(shopId, newName) {
    const [o, n] = await prisma.$transaction([
      prisma.orderLine.updateMany({ where: { shopId }, data: { shopNameAtEntry: newName } }),
      prisma.noteLine.updateMany({ where: { shopId }, data: { shopNameAtEntry: newName } }),
    ]);
    return o.count + n.count;
  },
  async backfillVariantNameSnapshots(variantId, newName) {
    const [o, n] = await prisma.$transaction([
      prisma.orderLine.updateMany({ where: { variantId }, data: { variantNameAtEntry: newName } }),
      prisma.noteLine.updateMany({
        where: { productVariantId: variantId },
        data: { variantNameAtEntry: newName },
      }),
    ]);
    return o.count + n.count;
  },
};

const productSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อสินค้า").max(200, "ชื่อสินค้ายาวเกินไป"),
  group: z.enum(PRODUCT_GROUPS, { message: "กรุณาเลือกกลุ่มสินค้า" }),
  isOffList: z.coerce.boolean().optional().default(false),
  needsConfirmation: z.coerce.boolean().optional().default(false),
});

export interface ProductActionState {
  error?: string;
}

export async function createProduct(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    group: formData.get("group"),
    isOffList: formData.get("isOffList") === "on",
    needsConfirmation: formData.get("needsConfirmation") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  await prisma.product.create({ data: parsed.data });
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(
  productId: number,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    group: formData.get("group"),
    isOffList: formData.get("isOffList") === "on",
    needsConfirmation: formData.get("needsConfirmation") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const current = await prisma.product.findUnique({ where: { id: productId } });
  if (!current) return { error: "ไม่พบสินค้า" };

  await prisma.product.update({ where: { id: productId }, data: parsed.data });

  // A product-name change ripples to each variant's display-name snapshot, but only while
  // that variant is still needsConfirmation (decision 6 lock semantics).
  if (parsed.data.name !== current.name) {
    const variants = await prisma.productVariant.findMany({ where: { productId } });
    for (const v of variants) {
      const newName = variantDisplayName(parsed.data.name, v.packSize as PackSize, v.labelVariant);
      await prisma.productVariant.update({ where: { id: v.id }, data: { name: newName } });
      await cascadeVariantNameCorrection(cascadeDb, v.id, newName, v.needsConfirmation);
    }
  }

  revalidatePath("/products");
  redirect("/products");
}

export async function softDeleteProduct(productId: number): Promise<void> {
  await requireAuth();
  await prisma.product.update({ where: { id: productId }, data: { active: false } });
  revalidatePath("/products");
}

export async function restoreProduct(productId: number): Promise<void> {
  await requireAuth();
  await prisma.product.update({ where: { id: productId }, data: { active: true } });
  revalidatePath("/products");
}

const variantSchema = z.object({
  packSize: z.enum(PACK_SIZES, { message: "กรุณาเลือกขนาดบรรจุ" }),
  labelVariant: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  printOrder: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), {
      message: "ลำดับพิมพ์ต้องเป็นจำนวนเต็มบวกหรือเว้นว่าง",
    }),
});

export async function addVariant(
  productId: number,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const denied = await requireAuthState();
  if (denied) return denied;

  const parsed = variantSchema.safeParse({
    packSize: formData.get("packSize"),
    labelVariant: formData.get("labelVariant"),
    printOrder: formData.get("printOrder"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "ไม่พบสินค้า" };

  // C3: printOrder uniqueness over the ACTIVE non-null variant set (app-level, F2).
  if (parsed.data.printOrder !== null) {
    const all = await prisma.productVariant.findMany({
      select: { id: true, printOrder: true, active: true },
    });
    if (!isPrintOrderAvailable(parsed.data.printOrder, all)) {
      return { error: `ลำดับพิมพ์ ${parsed.data.printOrder} ถูกใช้แล้ว` };
    }
  }

  const name = variantDisplayName(product.name, parsed.data.packSize, parsed.data.labelVariant);
  await prisma.productVariant.create({
    data: {
      productId,
      name,
      packSize: parsed.data.packSize,
      labelVariant: parsed.data.labelVariant,
      printOrder: parsed.data.printOrder,
      needsConfirmation: false,
    },
  });
  revalidatePath(`/products/${productId}/edit`);
  return {};
}

export async function softDeleteVariant(variantId: number, productId: number): Promise<void> {
  await requireAuth();
  await prisma.productVariant.update({ where: { id: variantId }, data: { active: false } });
  revalidatePath(`/products/${productId}/edit`);
}
