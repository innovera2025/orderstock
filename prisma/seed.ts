// orderstock — Phase 02 master-data seed. IDEMPOTENT (upsert on non-null natural keys).
//
// F4: `pnpm tsx prisma/seed.ts` does NOT pass through prisma.config.ts, so .env is NOT
// auto-loaded and src/lib/db.ts would throw on a missing DATABASE_URL. `./load-env` is a
// side-effect module imported FIRST so env is populated before the db.ts import runs
// (import hoisting means a plain loadEnvFile() statement here would be too late).
import "./load-env";
import { prisma } from "../src/lib/db";
import {
  PRINT_VARIANTS,
  variantDisplayName,
  type PackSize,
  type ProductGroup,
} from "../src/lib/product-order";

// A recurring off-list note product (decision 1) — real Product/Variant rows with
// printOrder = NULL, upserted on the non-null natural key (productName, packSize,
// labelVariant) per F3. All transcribed readings are uncertain → needsConfirmation.
interface OffListItem {
  productName: string;
  group: ProductGroup;
  packSize: PackSize;
  labelVariant: string | null;
}

// Known off-list items from form-canonical_REF §7/§10 (footer tally + per-row remarks).
const OFF_LIST_ITEMS: OffListItem[] = [
  { productName: "ดีขาว 1 กก.", group: "GOODS", packSize: "NONE", labelVariant: null },
  { productName: "ดีขาว 1/2 กก.", group: "GOODS", packSize: "NONE", labelVariant: null },
  { productName: "ลานนิ่ม (ใส) 1 กก.", group: "GOODS", packSize: "NONE", labelVariant: null },
  { productName: "ดีนิ่ม (A) 1/2 กก.", group: "GOODS", packSize: "NONE", labelVariant: null },
  { productName: "พริกแดง 10 กก.", group: "GOODS", packSize: "NONE", labelVariant: null },
  { productName: "รอง 5 กก.", group: "GOODS", packSize: "NONE", labelVariant: null },
  { productName: "ดีนิ่ม A เข้ม", group: "GOODS", packSize: "NONE", labelVariant: null },
  { productName: "รองดำใส 1/2 กก.", group: "GOODS", packSize: "NONE", labelVariant: null },
];

// The 29-slot roster (form-canonical_REF §4). Only NAMED rows are seeded; empty rows
// (4, 6, 20, 29) are preserved as gaps in rosterOrder (append-only / immutable). Names use
// the REF's canonical intended readings; uncertain readings are flagged needsConfirmation.
interface ShopSeed {
  rosterOrder: number;
  name: string;
  needsConfirmation: boolean;
}

const SHOPS: ShopSeed[] = [
  { rosterOrder: 1, name: "เจ๊เปียก", needsConfirmation: true },
  { rosterOrder: 2, name: "เจ๊เกียง", needsConfirmation: true },
  { rosterOrder: 3, name: "ตาใสของชำ", needsConfirmation: true },
  { rosterOrder: 5, name: "เฮียเล็ก", needsConfirmation: false },
  { rosterOrder: 7, name: "สุนทร", needsConfirmation: false },
  { rosterOrder: 8, name: "สิริพร ของชำ", needsConfirmation: false },
  { rosterOrder: 9, name: "ป้าอ้อย ของชำ", needsConfirmation: false },
  { rosterOrder: 10, name: "ประทุมนิเยาะห์", needsConfirmation: true },
  { rosterOrder: 11, name: "แหม่มหมายเส้น", needsConfirmation: true },
  { rosterOrder: 12, name: "เฮียโอภาส", needsConfirmation: false },
  { rosterOrder: 13, name: "พูลทรัพย์", needsConfirmation: false },
  { rosterOrder: 14, name: "แหนมป้าพยอม", needsConfirmation: true },
  { rosterOrder: 15, name: "เจ๊เอ็ง", needsConfirmation: true },
  { rosterOrder: 16, name: "กิ่งแก้ว", needsConfirmation: true },
  { rosterOrder: 17, name: "แก้วข้าวสาร", needsConfirmation: false },
  { rosterOrder: 18, name: "กรรณิกา คลอง 2", needsConfirmation: true },
  { rosterOrder: 19, name: "ร้านชำตลาดนานาเจริญ", needsConfirmation: false },
  { rosterOrder: 21, name: "สมชาย คำภา", needsConfirmation: true },
  { rosterOrder: 22, name: "พร นานาเจริญ", needsConfirmation: false },
  { rosterOrder: 23, name: "ธนกฤต บรรจุภัณฑ์", needsConfirmation: true },
  { rosterOrder: 24, name: "สมยศ นานาเจริญ", needsConfirmation: false },
  { rosterOrder: 25, name: "กรีนเฟรชฟู้ดส์", needsConfirmation: false },
  { rosterOrder: 26, name: "อาร์เอ็นเค ฟู้ดส์", needsConfirmation: false },
  { rosterOrder: 27, name: "บิ๊กแบงค์", needsConfirmation: true },
  { rosterOrder: 28, name: "เลอรส", needsConfirmation: true },
];

// Upsert one Product by (name, isOffList) and return its id. Products are grouped so the
// 20 in-order variants share a product row (e.g. ดีลานนิ่ม has KG_1 + HALF_KG variants).
async function upsertProduct(
  name: string,
  group: ProductGroup,
  isOffList: boolean,
  needsConfirmation: boolean,
): Promise<number> {
  // No DB unique on (name, isOffList) — emulate an idempotent upsert via find-then-write.
  const existing = await prisma.product.findFirst({ where: { name, isOffList } });
  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: { group, needsConfirmation },
    });
    return existing.id;
  }
  const created = await prisma.product.create({
    data: { name, group, isOffList, needsConfirmation },
  });
  return created.id;
}

// Idempotent variant upsert on the non-null natural key (productId, packSize, labelVariant)
// — NEVER on printOrder (NULL for off-list, F3).
async function upsertVariant(args: {
  productId: number;
  name: string;
  packSize: PackSize;
  labelVariant: string | null;
  printOrder: number | null;
  needsConfirmation: boolean;
}): Promise<void> {
  const { productId, name, packSize, labelVariant, printOrder, needsConfirmation } = args;
  const existing = await prisma.productVariant.findFirst({
    where: { productId, packSize, labelVariant },
  });
  if (existing) {
    await prisma.productVariant.update({
      where: { id: existing.id },
      data: { name, printOrder, needsConfirmation },
    });
    return;
  }
  await prisma.productVariant.create({
    data: { productId, name, packSize, labelVariant, printOrder, needsConfirmation },
  });
}

async function main(): Promise<void> {
  // 1. The 20 in-order product-variants (C3–C22) in fixed print order.
  for (const v of PRINT_VARIANTS) {
    const productId = await upsertProduct(v.productName, v.group, false, v.needsConfirmation);
    await upsertVariant({
      productId,
      name: variantDisplayName(v.productName, v.packSize, v.labelVariant),
      packSize: v.packSize,
      labelVariant: v.labelVariant,
      printOrder: v.printOrder,
      needsConfirmation: v.needsConfirmation,
    });
  }

  // 2. Known off-list note products (printOrder NULL, upsert on non-null natural key, F3).
  for (const item of OFF_LIST_ITEMS) {
    const productId = await upsertProduct(item.productName, item.group, true, true);
    await upsertVariant({
      productId,
      name: variantDisplayName(item.productName, item.packSize, item.labelVariant),
      packSize: item.packSize,
      labelVariant: item.labelVariant,
      printOrder: null,
      needsConfirmation: true,
    });
  }

  // 3. Shops (upsert on the natural key rosterOrder — immutable/append-only).
  for (const s of SHOPS) {
    await prisma.shop.upsert({
      where: { rosterOrder: s.rosterOrder },
      update: { name: s.name, needsConfirmation: s.needsConfirmation },
      create: { rosterOrder: s.rosterOrder, name: s.name, needsConfirmation: s.needsConfirmation },
    });
  }

  // Report counts (used by the idempotency gate).
  const [inOrderVariants, offListVariants, shopCount, flaggedShops, flaggedVariants] =
    await Promise.all([
      prisma.productVariant.count({ where: { printOrder: { not: null } } }),
      prisma.productVariant.count({ where: { printOrder: null } }),
      prisma.shop.count(),
      prisma.shop.count({ where: { needsConfirmation: true } }),
      prisma.productVariant.count({ where: { needsConfirmation: true } }),
    ]);

  console.log(
    JSON.stringify(
      {
        inOrderVariants,
        offListVariants,
        shops: shopCount,
        flaggedShops,
        flaggedVariants,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
