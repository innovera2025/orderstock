import { test, expect } from "@playwright/test";

// responsive-drawer-sidebar plan — DESKTOP-tier gates (Decision 1: the ☰ hamburger genuinely
// collapses/reopens the fixed sidebar and content reclaims the 216px). Runs under the existing
// `chromium` project (default ~1280×720 = desktop tier, lg+); no new project needed, so it is NOT
// in the chromium testIgnore list. No backdrop must ever appear at desktop.
//
// Collapse detection note: at desktop the collapse reclaims space by clamping the sidebar's flex
// reservation wrapper to width 0 + overflow-hidden (the aside is clipped, not moved to a negative
// x). So the robust signal is the MAIN content column widening — not the aside's bounding x.
test.use({ storageState: "e2e/.auth/admin.json" });

/** Bounding-box x of the sidebar aside (~0 when the fixed sidebar is in flow at desktop). */
async function sidebarX(page: import("@playwright/test").Page): Promise<number> {
  const box = await page.locator("#app-sidebar").boundingBox();
  return box?.x ?? Number.NEGATIVE_INFINITY;
}

/** Width of the layout content column (the OUTER <main>, first match — the page renders its own). */
async function mainWidth(page: import("@playwright/test").Page): Promise<number> {
  const box = await page.locator("main").first().boundingBox();
  return box?.width ?? 0;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/orders");
});

test("sidebar is visible by default at desktop width; ☰ shows expanded", async ({ page }) => {
  expect(await sidebarX(page)).toBeGreaterThanOrEqual(0);
  const box = await page.locator("#app-sidebar").boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(200); // ~216px fixed sidebar in flow
  await expect(page.locator("#sidebar-hamburger")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("sidebar-backdrop")).toBeHidden();
});

test("☰ collapses the fixed sidebar, content reclaims the 216px, no backdrop appears", async ({
  page,
}) => {
  const widthOpen = await mainWidth(page);

  await page.locator("#sidebar-hamburger").click();

  await expect(page.locator("#sidebar-hamburger")).toHaveAttribute("aria-expanded", "false");
  // Main content grows by roughly the reclaimed sidebar width (216px).
  await expect.poll(() => mainWidth(page)).toBeGreaterThan(widthOpen + 150);
  // No backdrop at desktop at any point.
  await expect(page.getByTestId("sidebar-backdrop")).toBeHidden();
});

test("clicking ☰ again reopens the sidebar", async ({ page }) => {
  const widthOpen = await mainWidth(page);

  await page.locator("#sidebar-hamburger").click();
  await expect.poll(() => mainWidth(page)).toBeGreaterThan(widthOpen + 150);

  await page.locator("#sidebar-hamburger").click();

  await expect.poll(() => mainWidth(page)).toBeLessThan(widthOpen + 150);
  await expect(page.locator("#sidebar-hamburger")).toHaveAttribute("aria-expanded", "true");
  expect(await sidebarX(page)).toBeGreaterThanOrEqual(0);
});
