import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";
import { LOCATIONS_KEY } from "../src/lib/locations-core";

// Phase 02 hybrid gates — the 20-column MATRIX replaces the Order Pad. Cells are driven directly by
// their testid `cell-{rosterOrder}-{printOrder}` (the matrix maps rosterOrder→shopId, printOrder→
// variantId under the hood and emits the SAME cell:/note: payload saveOrderSheet parses).
// D1: enter the full 13/3/69 fixture through the matrix → save → reload → totals persist (446).
// D2: rename a CONFIRMED shop → re-save → the pre-existing cell's snapshot is UNCHANGED
//     (preserve-on-resave end-to-end).
test.use({ storageState: "e2e/.auth/staff.json" });

interface Fixture {
  date: string;
  cells: { rosterOrder: number; printOrder: number; qty: number }[];
  expectedColumnTotals: Record<string, number>;
  expectedGrandTotal: number;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

/** UTC-midnight Date for a @db.Date column (matches createOrderSheet's toDbDate). */
function toDbDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// The สถานที่ picker is now a <select> of distinct existing shop locations (shop-location-roster):
// `location` must be an existing option ("ยิ่งเจริญ") or "" (ทุกสถานที่ → null, full-roster fallback).
// Arbitrary free-text isolation strings are no longer possible — tests isolate by a unique DATE.
// The location <select> is now URL-driven (shop-location-filter plan): its value comes from the
// ?location= searchParam (selectedLocation prop) and is submitted on create. So set the location by
// navigating with the param rather than via selectOption (which triggers its own navigation and
// would race the submit). location="" → bare /orders (ทุกสถานที่ → null).
async function openSheet(page: import("@playwright/test").Page, isoDate: string, location = "") {
  await page.goto(location ? `/orders?location=${encodeURIComponent(location)}` : "/orders");
  await page.fill('input[name="date"]', isoDate);
  await page.click('button:has-text("เปิดใบออเดอร์")');
  await page.waitForURL(/\/orders\/\d+$/);
}

/** Matrix cell entry: fill the numeric input identified by its row/column testid. */
async function enterCell(
  page: import("@playwright/test").Page,
  rosterOrder: number,
  printOrder: number,
  qty: number,
) {
  await page.getByTestId(`cell-${rosterOrder}-${printOrder}`).fill(String(qty));
}

test("D1: enter the 13/3/69 fixture, save, reload — column totals + grand 446 persist", async ({
  page,
}) => {
  await openSheet(page, fixture.date, "ยิ่งเจริญ");

  for (const cell of fixture.cells) {
    await enterCell(page, cell.rosterOrder, cell.printOrder, cell.qty);
  }

  // Live grand total reflects the entered grid before saving.
  await expect(page.getByTestId("grand-total")).toHaveText("446");

  await page.click('button:has-text("บันทึก")');
  await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

  // Reload — values rehydrate from the DB and totals recompute.
  await page.reload();
  await expect(page.getByTestId("grand-total")).toHaveText("446");

  // Spot-check a few persisted per-column footer totals (always in the DOM).
  await expect(page.getByTestId("total-4")).toHaveText("137");
  await expect(page.getByTestId("total-8")).toHaveText("82");
  await expect(page.getByTestId("total-2")).toHaveText("99");
});

test("D2: rename a confirmed shop, re-save — pre-existing cell snapshot is preserved", async ({
  page,
}) => {
  // Use roster slot 26 (confirmed shop, NOT in the D1 fixture) so this flow is independent.
  const slot = 26;
  const shop = await prisma.shop.findUnique({ where: { rosterOrder: slot } });
  expect(shop, "seeded shop at roster slot 26").toBeTruthy();
  const originalName = shop!.name;

  // 1. Fresh sheet, enter one cell for the confirmed shop (printOrder 1), save → snapshot = originalName.
  await openSheet(page, "2026-03-14");
  const sheetUrl = page.url();
  const sheetId = Number(sheetUrl.match(/\/orders\/(\d+)$/)![1]);
  await enterCell(page, slot, 1, 7);
  await page.click('button:has-text("บันทึก")');
  await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

  const afterFirstSave = await prisma.orderLine.findFirst({
    where: { sheetId, shopId: shop!.id },
  });
  expect(afterFirstSave?.shopNameAtEntry).toBe(originalName);

  // 2. Rename the shop, keeping it CONFIRMED (needsConfirmation stays off → cascade is LOCKED).
  const renamed = `${originalName} TEST`;
  await page.goto(`/shops/${shop!.id}/edit`);
  await page.fill('input[name="name"]', renamed);
  const confirmCb = page.locator('input[name="needsConfirmation"]');
  if (await confirmCb.isChecked()) await confirmCb.uncheck();
  await page.click('button:has-text("บันทึก")');
  await page.waitForURL(/\/shops$/);

  // 3. Re-open the sheet and re-save (delete-and-recreate).
  await page.goto(sheetUrl);
  await page.click('button:has-text("บันทึก")');
  await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

  // 4. The snapshot must still be the ORIGINAL name (carry-forward), even though the live shop
  //    name is now the renamed value. A naive re-derive would have written the renamed value.
  const afterResave = await prisma.orderLine.findFirst({
    where: { sheetId, shopId: shop!.id },
  });
  expect(afterResave?.shopNameAtEntry).toBe(originalName);
  const liveShop = await prisma.shop.findUnique({ where: { id: shop!.id } });
  expect(liveShop?.name).toBe(renamed);

  // Cleanup: restore the original shop name so the sandbox stays close to the seed.
  await prisma.shop.update({ where: { id: shop!.id }, data: { name: originalName } });
  await prisma.$disconnect();
});

// G4 (shop-location-roster): a sheet whose location matches N shops shows exactly those shops,
// visibly renumbered 1..N via displayNo, and a shop assigned a DIFFERENT location is ABSENT — while
// cell entry still targets the correct shop by the UNCHANGED global rosterOrder-keyed testid.
test("G4: per-location roster shows only that location's shops, displayNo 1..N, others absent", async ({
  page,
}) => {
  // Move roster slot 28 to a DIFFERENT location so it must drop out of the ยิ่งเจริญ roster.
  const moved = await prisma.shop.findUnique({ where: { rosterOrder: 28 } });
  expect(moved, "seeded shop at roster slot 28").toBeTruthy();
  await prisma.shop.update({ where: { id: moved!.id }, data: { location: "คลอง 2" } });
  try {
    await openSheet(page, "2026-03-20", "ยิ่งเจริญ");

    // A ยิ่งเจริญ shop (slot 1) is present; the moved shop (slot 28, now คลอง 2) is ABSENT.
    await expect(page.getByTestId("cell-1-2")).toHaveCount(1);
    await expect(page.getByTestId("cell-28-2")).toHaveCount(0);

    // displayNo renumbering: rosterOrder 1 → displayNo "1"; rosterOrder 5 (4th roster slot: 1,2,3,5)
    // → displayNo "4" — the visible number differs from the gapped global rosterOrder.
    await expect(page.getByTestId("rownum-1")).toHaveText("1");
    await expect(page.getByTestId("rownum-5")).toHaveText("4");

    // Cell entry still keys on the global rosterOrder testid (unchanged save path).
    await page.getByTestId("cell-1-2").fill("3");
    await page.click('button:has-text("บันทึก")');
    await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();
  } finally {
    // Restore slot 28 to ยิ่งเจริญ so the sandbox stays close to the seed.
    await prisma.shop.update({ where: { id: moved!.id }, data: { location: "ยิ่งเจริญ" } });
    await prisma.$disconnect();
  }
});

// G5 (shop-location-roster): a legacy/null-location sheet falls back to the FULL active-shop list
// (no location restriction) — proven directly, not via the canonical fixture.
test("G5: null-location sheet falls back to the full active-shop roster", async ({ page }) => {
  // "" = ทุกสถานที่ → location null → fallback roster = every active shop (incl. slot 28).
  await openSheet(page, "2026-03-21", "");
  await expect(page.getByTestId("cell-1-2")).toHaveCount(1);
  await expect(page.getByTestId("cell-28-2")).toHaveCount(1);
  // Full-roster renumber: rosterOrder 5 is the 4th active slot → displayNo "4".
  await expect(page.getByTestId("rownum-5")).toHaveText("4");
});

// shop-location-filter plan hybrid gate: the /orders สถานที่ <select> now does double duty — it
// filters the sheet list below via ?location= (URL is the single source of truth) AND still submits
// the currently-selected location on create. Two active sheets with DISTINCT locations are created
// directly; selecting one location narrows the list to that sheet, "ทุกสถานที่" restores both.
test.describe("shop-location-filter: /orders list filters by the selected location", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });

  const ts = Date.now();
  const locA = `FILT-${ts}-A`;
  const locB = `FILT-${ts}-B`;
  // Spare shops made active with the two distinct locations so both appear as <select> options
  // (getEffectiveLocationOptions surfaces distinct active-shop locations).
  const SHOP_A = 21;
  const SHOP_B = 24;
  let shopAOrig: { location: string | null; active: boolean };
  let shopBOrig: { location: string | null; active: boolean };
  let sheetAId: number;
  let sheetBId: number;

  test.beforeAll(async () => {
    const a = await prisma.shop.findUnique({ where: { rosterOrder: SHOP_A } });
    const b = await prisma.shop.findUnique({ where: { rosterOrder: SHOP_B } });
    expect(a && b, "seeded shops at roster slots 21 and 24").toBeTruthy();
    shopAOrig = { location: a!.location, active: a!.active };
    shopBOrig = { location: b!.location, active: b!.active };
    await prisma.shop.update({ where: { id: a!.id }, data: { location: locA, active: true } });
    await prisma.shop.update({ where: { id: b!.id }, data: { location: locB, active: true } });

    const sheetA = await prisma.orderSheet.create({
      data: { date: toDbDate("2026-03-22"), location: locA, active: true },
    });
    const sheetB = await prisma.orderSheet.create({
      data: { date: toDbDate("2026-03-23"), location: locB, active: true },
    });
    sheetAId = sheetA.id;
    sheetBId = sheetB.id;
  });

  test.afterAll(async () => {
    await prisma.orderSheet.deleteMany({ where: { id: { in: [sheetAId, sheetBId] } } });
    const a = await prisma.shop.findUnique({ where: { rosterOrder: SHOP_A } });
    const b = await prisma.shop.findUnique({ where: { rosterOrder: SHOP_B } });
    if (a) await prisma.shop.update({ where: { id: a.id }, data: shopAOrig });
    if (b) await prisma.shop.update({ where: { id: b.id }, data: shopBOrig });
    await prisma.$disconnect();
  });

  test("selecting a location narrows the sheet list; ทุกสถานที่ restores all", async ({ page }) => {
    // Unfiltered: both sheets visible.
    await page.goto("/orders");
    await expect(page.getByTestId(`sheet-row-${sheetAId}`)).toBeVisible();
    await expect(page.getByTestId(`sheet-row-${sheetBId}`)).toBeVisible();

    // Select locB → URL carries ?location=, only sheet B remains.
    await page.selectOption('select[name="location"]', locB);
    await page.waitForURL(/\/orders\?location=/);
    await expect(page.getByTestId(`sheet-row-${sheetBId}`)).toBeVisible();
    await expect(page.getByTestId(`sheet-row-${sheetAId}`)).toHaveCount(0);

    // Reset to ทุกสถานที่ (value "") → bare /orders, both visible again.
    await page.selectOption('select[name="location"]', "");
    await page.waitForURL(/\/orders$/);
    await expect(page.getByTestId(`sheet-row-${sheetAId}`)).toBeVisible();
    await expect(page.getByTestId(`sheet-row-${sheetBId}`)).toBeVisible();
  });
});

// location-management plan hybrid gate: the full managed-list ↔ shop wiring loop —
// create a location on /locations → it appears as a shop-form <select> option → assign it to a
// shop → rename it on /locations → the shop's location follows the rename (cascade) → delete while
// still in use is BLOCKED with the Thai error → unassign the shop → delete now succeeds and the row
// disappears. A unique TESTLOC- prefixed name isolates each run; a best-effort afterEach/afterAll
// purges the test location from the managed list and restores the shop even if an assertion throws.
test.describe("location-management: create → assign → rename-cascade → delete-guard → delete", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });

  const PREFIX = "TESTLOC-";
  let shopId: number;
  let originalLoc: string | null;

  test.beforeAll(async () => {
    const shop = await prisma.shop.findUnique({ where: { rosterOrder: 27 } });
    expect(shop, "seeded shop at roster slot 27").toBeTruthy();
    shopId = shop!.id;
    originalLoc = shop!.location;
  });

  async function purge() {
    const row = await prisma.appSetting.findUnique({ where: { key: LOCATIONS_KEY } });
    if (row) {
      let list: string[] = [];
      try {
        const p = JSON.parse(row.value);
        if (Array.isArray(p)) list = p.filter((x): x is string => typeof x === "string");
      } catch {
        /* malformed — leave as empty, will be overwritten below only if it had TESTLOC entries */
      }
      const cleaned = list.filter((l) => !l.startsWith(PREFIX));
      if (cleaned.length !== list.length) {
        await prisma.appSetting.update({
          where: { key: LOCATIONS_KEY },
          data: { value: JSON.stringify(cleaned) },
        });
      }
    }
    if (shopId != null) {
      const s = await prisma.shop.findUnique({ where: { id: shopId } });
      if (s && s.location?.startsWith(PREFIX)) {
        await prisma.shop.update({ where: { id: shopId }, data: { location: originalLoc } });
      }
    }
  }

  test.afterEach(async () => {
    await purge();
  });
  test.afterAll(async () => {
    await purge();
    await prisma.$disconnect();
  });

  test("full managed-list loop: create, select-wiring, rename cascade, delete-in-use guard, delete", async ({
    page,
  }) => {
    const ts = Date.now();
    const loc = `${PREFIX}${ts}`;
    const renamed = `${PREFIX}${ts}-R`;

    // 1. Create a new location on /locations.
    await page.goto("/locations");
    await page.fill('input[name="name"]', loc);
    await page.click('button:has-text("เพิ่ม")');
    await expect(page.getByTestId(`location-row-${loc}`)).toBeVisible();

    // 2. It appears as a shop-form <select> option; assign it to the shop.
    await page.goto(`/shops/${shopId}/edit`);
    await expect(page.locator(`select[name="location"] option[value="${loc}"]`)).toHaveCount(1);
    await page.selectOption('select[name="location"]', loc);
    await page.click('button:has-text("บันทึก")');
    await page.waitForURL(/\/shops$/);
    expect((await prisma.shop.findUnique({ where: { id: shopId } }))?.location).toBe(loc);

    // 3. Rename on /locations → the shop's location follows (cascade).
    await page.goto("/locations");
    const row = page.getByTestId(`location-row-${loc}`);
    await row.getByRole("button", { name: "แก้ไข" }).click();
    await row.locator('input[name="newName"]').fill(renamed);
    await row.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByTestId(`location-row-${renamed}`)).toBeVisible();
    expect((await prisma.shop.findUnique({ where: { id: shopId } }))?.location).toBe(renamed);

    // 4. Delete while still in use → blocked with the Thai error, list unchanged.
    const inUseRow = page.getByTestId(`location-row-${renamed}`);
    await inUseRow.getByRole("button", { name: "ลบ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "ลบ" }).click();
    await expect(dialog.getByText(/ยังมีร้านค้าใช้สถานที่นี้อยู่/)).toBeVisible();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(page.getByTestId(`location-row-${renamed}`)).toBeVisible();

    // 5. Unassign the shop, then delete succeeds and the row disappears.
    await page.goto(`/shops/${shopId}/edit`);
    await page.selectOption('select[name="location"]', originalLoc ?? "");
    await page.click('button:has-text("บันทึก")');
    await page.waitForURL(/\/shops$/);

    await page.goto("/locations");
    const freeRow = page.getByTestId(`location-row-${renamed}`);
    await freeRow.getByRole("button", { name: "ลบ" }).click();
    const dialog2 = page.getByRole("dialog");
    await dialog2.getByRole("button", { name: "ลบ" }).click();
    await expect(page.getByTestId(`location-row-${renamed}`)).toHaveCount(0);
  });
});

// location-management code-review fixes (location-management plan, fix cycle):
//   Fix C — createLocationAction surfaces a Thai duplicate error instead of a silent no-op.
//   Fix B — deleteLocationAction blocks while a SOFT-DELETED shop still references the location.
//   Finding #6 — shop-form defensively keeps a shop's current location even when it is neither in
//     the managed list nor in getEffectiveLocationOptions (soft-deleted shop → excluded there).
// TESTLOC- prefixed names isolate each run; purge restores the shop + prunes the managed list.
test.describe("location-management fixes: duplicate feedback, soft-delete guard, form fallback", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });

  const PREFIX = "TESTLOC-FIX-";
  let shopId: number;
  let originalLoc: string | null;
  let originalActive: boolean;

  test.beforeAll(async () => {
    const shop = await prisma.shop.findUnique({ where: { rosterOrder: 25 } });
    expect(shop, "seeded shop at roster slot 25").toBeTruthy();
    shopId = shop!.id;
    originalLoc = shop!.location;
    originalActive = shop!.active;
  });

  async function purge() {
    const row = await prisma.appSetting.findUnique({ where: { key: LOCATIONS_KEY } });
    if (row) {
      let list: string[] = [];
      try {
        const p = JSON.parse(row.value);
        if (Array.isArray(p)) list = p.filter((x): x is string => typeof x === "string");
      } catch {
        /* malformed — leave as empty */
      }
      const cleaned = list.filter((l) => !l.startsWith(PREFIX));
      if (cleaned.length !== list.length) {
        await prisma.appSetting.update({
          where: { key: LOCATIONS_KEY },
          data: { value: JSON.stringify(cleaned) },
        });
      }
    }
    if (shopId != null) {
      // Always restore the shop to its seeded location + active state.
      await prisma.shop.update({
        where: { id: shopId },
        data: { location: originalLoc, active: originalActive },
      });
    }
  }

  test.afterEach(async () => {
    await purge();
  });
  test.afterAll(async () => {
    await purge();
    await prisma.$disconnect();
  });

  test("Fix C: creating an already-existing location surfaces the Thai duplicate error, list unchanged", async ({
    page,
  }) => {
    const loc = `${PREFIX}${Date.now()}`;

    await page.goto("/locations");
    await page.fill('input[name="name"]', loc);
    await page.click('button:has-text("เพิ่ม")');
    await expect(page.getByTestId(`location-row-${loc}`)).toBeVisible();

    // Attempt to create the same name again → duplicate error, still exactly one row.
    await page.fill('input[name="name"]', loc);
    await page.click('button:has-text("เพิ่ม")');
    await expect(page.getByText("มีสถานที่นี้อยู่แล้ว")).toBeVisible();
    await expect(page.getByTestId(`location-row-${loc}`)).toHaveCount(1);
  });

  test("Fix B: delete is blocked when the ONLY referencing shop is soft-deleted", async ({
    page,
  }) => {
    const loc = `${PREFIX}${Date.now()}`;

    // Create the location + assign it to the shop, then soft-delete the shop (via prisma).
    await page.goto("/locations");
    await page.fill('input[name="name"]', loc);
    await page.click('button:has-text("เพิ่ม")');
    await expect(page.getByTestId(`location-row-${loc}`)).toBeVisible();

    await prisma.shop.update({
      where: { id: shopId },
      data: { location: loc, active: false },
    });

    // Attempt to delete the location → blocked because a soft-deleted shop still references it.
    await page.goto("/locations");
    const row = page.getByTestId(`location-row-${loc}`);
    await row.getByRole("button", { name: "ลบ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "ลบ" }).click();
    await expect(dialog.getByText(/ยังมีร้านค้าใช้สถานที่นี้อยู่/)).toBeVisible();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(page.getByTestId(`location-row-${loc}`)).toBeVisible();
  });

  test("Finding #6: shop-form keeps a soft-deleted shop's current location even if unmanaged", async ({
    page,
  }) => {
    const ghost = `${PREFIX}${Date.now()}-GHOST`;

    // Ghost location: set directly on the shop, NOT added to the managed list, and soft-delete the
    // shop so getEffectiveLocationOptions (active:true only) excludes it. Only the shop-form's own
    // defensive fallback can surface it as a <select> option.
    await prisma.shop.update({
      where: { id: shopId },
      data: { location: ghost, active: false },
    });

    await page.goto(`/shops/${shopId}/edit`);
    const option = page.locator(`select[name="location"] option[value="${ghost}"]`);
    await expect(option).toHaveCount(1);
    await expect(page.locator('select[name="location"]')).toHaveValue(ghost);
  });
});

// ADMIN-only soft-delete gates (ordersheet-soft-delete plan). The delete button + confirm modal are
// ADMIN-only, so this block runs under the admin storage state. Each test uses a dedicated
// date+location so it is isolated; afterAll drops every DEL-* sheet (lines + notes + sheet).
test.describe("ADMIN soft-delete of an OrderSheet", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  // Isolation is now by unique DATE (the location picker is a <select> of real locations only, so
  // free-text isolation tags are gone). Each DEL test owns one date; cleanup drops those dates.
  const DEL_DATES = ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19"];

  async function dropByDate(isoDate: string) {
    const sheets = await prisma.orderSheet.findMany({
      where: { date: toDbDate(isoDate) },
      select: { id: true },
    });
    const ids = sheets.map((s) => s.id);
    if (ids.length) {
      await prisma.orderLine.deleteMany({ where: { sheetId: { in: ids } } });
      await prisma.noteLine.deleteMany({ where: { sheetId: { in: ids } } });
      await prisma.orderSheet.deleteMany({ where: { id: { in: ids } } });
    }
  }

  test.beforeAll(async () => {
    for (const d of DEL_DATES) await dropByDate(d);
  });
  test.afterAll(async () => {
    for (const d of DEL_DATES) await dropByDate(d);
    await prisma.$disconnect();
  });

  test("AC1+AC2: soft-delete via the modal removes the row; lines retained with active=false", async ({
    page,
  }) => {
    await openSheet(page, "2026-03-16");
    const sheetId = Number(page.url().match(/\/orders\/(\d+)$/)![1]);
    // Enter one cell so the sheet has an OrderLine to prove retention.
    await enterCell(page, 1, 2, 5);
    await page.click('button:has-text("บันทึก")');
    await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

    // Delete via the confirm modal (NO native confirm()).
    await page.goto("/orders");
    await expect(page.getByTestId(`sheet-row-${sheetId}`)).toBeVisible();
    await page.getByTestId(`sheet-row-${sheetId}`).getByRole("button", { name: "ลบ" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "ลบ" }).click();

    // Row disappears from the list (revalidatePath refresh — no manual reload).
    await expect(page.getByTestId(`sheet-row-${sheetId}`)).toHaveCount(0);

    // DB: sheet soft-deleted, OrderLine rows NOT hard-deleted.
    const sheet = await prisma.orderSheet.findUnique({ where: { id: sheetId } });
    expect(sheet?.active).toBe(false);
    const lineCount = await prisma.orderLine.count({ where: { sheetId } });
    expect(lineCount).toBeGreaterThan(0);
  });

  test("AC3d: a soft-deleted sheet's editor route 404s", async ({ page }) => {
    await openSheet(page, "2026-03-17");
    const sheetId = Number(page.url().match(/\/orders\/(\d+)$/)![1]);
    await prisma.orderSheet.update({ where: { id: sheetId }, data: { active: false } });

    const resp = await page.goto(`/orders/${sheetId}`);
    expect(resp?.status()).toBe(404);
  });

  test("AC7 (P2): re-opening a date+location whose prior sheet was soft-deleted creates a fresh sheet", async ({
    page,
  }) => {
    await openSheet(page, "2026-03-18");
    const firstId = Number(page.url().match(/\/orders\/(\d+)$/)![1]);
    await prisma.orderSheet.update({ where: { id: firstId }, data: { active: false } });

    // Same date+location again → must create a genuinely NEW sheet, not redirect to the 404-ing one.
    await openSheet(page, "2026-03-18");
    const secondId = Number(page.url().match(/\/orders\/(\d+)$/)![1]);
    expect(secondId).not.toBe(firstId);
    // The new sheet's editor loads (not a 404).
    const resp = await page.goto(`/orders/${secondId}`);
    expect(resp?.status()).toBe(200);
  });

  test("AC8 (P3): the editor is unreachable for a soft-deleted sheet and its lines stay frozen", async ({
    page,
  }) => {
    // The UI can never reach saveOrderSheet for a soft-deleted sheet (the editor 404s first — proven
    // here) and the P3 server guard rejects a raw POST against a deleted id (source-asserted, since a
    // Next server action cannot be invoked by a raw fetch without its encrypted action id). Together
    // these prove a soft-deleted sheet's lines can never be mutated post-delete.
    await openSheet(page, "2026-03-19");
    const sheetId = Number(page.url().match(/\/orders\/(\d+)$/)![1]);
    await enterCell(page, 1, 2, 4);
    await page.click('button:has-text("บันทึก")');
    await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();
    const before = await prisma.orderLine.count({ where: { sheetId } });
    expect(before).toBeGreaterThan(0);

    await prisma.orderSheet.update({ where: { id: sheetId }, data: { active: false } });

    // Editor unreachable → save UI cannot be reached.
    const resp = await page.goto(`/orders/${sheetId}`);
    expect(resp?.status()).toBe(404);
    // Lines are unchanged (nothing written).
    const after = await prisma.orderLine.count({ where: { sheetId } });
    expect(after).toBe(before);
  });
});
