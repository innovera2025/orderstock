import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";

const ADMIN_STATE = resolve(__dirname, ".auth/admin.json");
const STAFF_STATE = resolve(__dirname, ".auth/staff.json");

// DoD#3-redirect: unauthenticated request to a protected route → redirect to /login.
test.describe("route protection (DoD#3-redirect)", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no session

  test("unauthenticated user hitting /shops is redirected to /login", async ({ page }) => {
    await page.goto("/shops");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user hitting /admin/users is redirected to /login", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });
});

// SEC-enum: bad-username and bad-password both yield the SAME generic Thai error.
test.describe("login error is generic (SEC-enum)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const GENERIC = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";

  test("no-such-user and wrong-password show identical error text", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="username"]', "no_such_user_xyz");
    await page.fill('input[name="password"]', "whatever123");
    await page.click('button[type="submit"]');
    await expect(page.getByText(GENERIC)).toBeVisible();

    await page.goto("/login");
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "definitely-wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByText(GENERIC)).toBeVisible();
  });
});

// DoD#3-login: credentials login issues a JWT session (admin lands on / and sees nav/logout).
test.describe("login issues a session (DoD#3-login)", () => {
  test.use({ storageState: ADMIN_STATE });

  test("admin storage state is authenticated on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
  });
});

// DoD#3-rolegate: STAFF blocked from /admin/**; ADMIN allowed.
test.describe("role gating (DoD#3-rolegate)", () => {
  test("STAFF is blocked from /admin/users", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STAFF_STATE });
    const page = await ctx.newPage();
    await page.goto("/admin/users");
    // authorized() returns false for non-ADMIN on /admin → NextAuth redirects to /login.
    await expect(page).not.toHaveURL(/\/admin\/users/);
    await ctx.close();
  });

  test("ADMIN is allowed on /admin/users", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await ctx.newPage();
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole("heading", { name: "จัดการผู้ใช้" })).toBeVisible();
    await ctx.close();
  });
});

// AC4 (ordersheet-soft-delete): the /orders per-row delete button is ADMIN-only. STAFF sees no
// delete button (server-side action is additionally ADMIN-gated — proven by the P4 unit test).
test.describe("soft-delete button is ADMIN-only (AC4)", () => {
  const DEL_LOCATION = "E2E-DEL-AUTH";
  let sheetId = 0;

  test.beforeAll(async () => {
    const stale = await prisma.orderSheet.findMany({
      where: { location: DEL_LOCATION },
      select: { id: true },
    });
    const ids = stale.map((s) => s.id);
    if (ids.length) await prisma.orderSheet.deleteMany({ where: { id: { in: ids } } });
    const sheet = await prisma.orderSheet.create({
      data: { date: new Date(Date.UTC(2026, 2, 20)), location: DEL_LOCATION },
    });
    sheetId = sheet.id;
  });
  test.afterAll(async () => {
    await prisma.orderSheet.deleteMany({ where: { location: DEL_LOCATION } });
    await prisma.$disconnect();
  });

  test("STAFF sees NO delete button on the /orders row", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STAFF_STATE });
    const page = await ctx.newPage();
    await page.goto("/orders");
    await expect(page.getByTestId(`sheet-row-${sheetId}`)).toBeVisible();
    await expect(
      page.getByTestId(`sheet-row-${sheetId}`).getByRole("button", { name: "ลบ" }),
    ).toHaveCount(0);
    await ctx.close();
  });

  test("ADMIN sees the delete button on the /orders row", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await ctx.newPage();
    await page.goto("/orders");
    await expect(page.getByTestId(`sheet-row-${sheetId}`)).toBeVisible();
    await expect(
      page.getByTestId(`sheet-row-${sheetId}`).getByRole("button", { name: "ลบ" }),
    ).toHaveCount(1);
    await ctx.close();
  });
});
