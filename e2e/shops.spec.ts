import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";

// shop-location-filter plan hybrid gate: /shops now renders a "สถานที่" column (shop.location ?? "-")
// and a location filter <select> that server-filters the list via ?location=. Two active shops are
// assigned DISTINCT unique locations; the column shows both, the filter narrows to one, and
// "ทุกสถานที่" restores all. Unique FILT- locations isolate each run and guarantee the values appear
// as <select> options (getEffectiveLocationOptions surfaces distinct active-shop locations).
test.use({ storageState: "e2e/.auth/staff.json" });

const ts = Date.now();
const locA = `SHOPFILT-${ts}-A`;
const locB = `SHOPFILT-${ts}-B`;
const SHOP_A = 22;
const SHOP_B = 23;

let shopAId: number;
let shopBId: number;
let shopAOrig: { location: string | null; active: boolean };
let shopBOrig: { location: string | null; active: boolean };

test.beforeAll(async () => {
  const a = await prisma.shop.findUnique({ where: { rosterOrder: SHOP_A } });
  const b = await prisma.shop.findUnique({ where: { rosterOrder: SHOP_B } });
  expect(a && b, "seeded shops at roster slots 22 and 23").toBeTruthy();
  shopAId = a!.id;
  shopBId = b!.id;
  shopAOrig = { location: a!.location, active: a!.active };
  shopBOrig = { location: b!.location, active: b!.active };
  await prisma.shop.update({ where: { id: shopAId }, data: { location: locA, active: true } });
  await prisma.shop.update({ where: { id: shopBId }, data: { location: locB, active: true } });
});

test.afterAll(async () => {
  await prisma.shop.update({ where: { id: shopAId }, data: shopAOrig });
  await prisma.shop.update({ where: { id: shopBId }, data: shopBOrig });
  await prisma.$disconnect();
});

test("สถานที่ column renders + the filter narrows the shop list; ทุกสถานที่ restores all", async ({
  page,
}) => {
  // Unfiltered: both location values render in the สถานที่ column.
  await page.goto("/shops");
  await expect(page.getByRole("cell", { name: locA, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: locB, exact: true })).toBeVisible();

  // Filter by locA → URL carries ?location=, only shop A's location cell remains.
  await page.selectOption('select[name="location"]', locA);
  await page.waitForURL(/\/shops\?location=/);
  await expect(page.getByRole("cell", { name: locA, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: locB, exact: true })).toHaveCount(0);

  // Reset to ทุกสถานที่ (value "") → bare /shops, both visible again.
  await page.selectOption('select[name="location"]', "");
  await page.waitForURL(/\/shops$/);
  await expect(page.getByRole("cell", { name: locA, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: locB, exact: true })).toBeVisible();
});
