import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

// Phase 06 (EVL fix-cycle) — runtime auth probe for the ADMIN-only DB-settings page. Mirrors the
// /admin/users role-gate: the edge `authorized()` callback ADMIN-gates /settings and NextAuth
// redirects a non-ADMIN / unauth request to /login. Server-side requireAuth("ADMIN") is the real
// boundary; this proves the runtime redirect the static auth-guard-coverage gate cannot.

const ADMIN_STATE = resolve(__dirname, ".auth/admin.json");
const STAFF_STATE = resolve(__dirname, ".auth/staff.json");

test.describe("settings/db route protection (Phase 06)", () => {
  test("unauthenticated user hitting /settings/db is redirected to /login", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/settings/db");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test("STAFF is blocked from /settings/db", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STAFF_STATE });
    const page = await ctx.newPage();
    await page.goto("/settings/db");
    // authorized() returns false for non-ADMIN on /settings → NextAuth redirects away (to /login).
    await expect(page).not.toHaveURL(/\/settings\/db/);
    await ctx.close();
  });

  test("ADMIN is allowed on /settings/db", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await ctx.newPage();
    await page.goto("/settings/db");
    await expect(page).toHaveURL(/\/settings\/db/);
    await expect(page.getByRole("heading", { name: "ตั้งค่าการเชื่อมต่อฐานข้อมูล" })).toBeVisible();
    await ctx.close();
  });
});
