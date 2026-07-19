import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEffectiveLocationOptions } from "@/lib/locations";
import { perLocationDisplayNo, sortShopsForDisplay } from "@/lib/roster";
import { softDeleteShop, restoreShop } from "./actions";
import { ShopLocationFilter } from "./shop-location-filter";

export const dynamic = "force-dynamic";

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location } = await searchParams;

  const [allShops, locations] = await Promise.all([
    prisma.shop.findMany({ orderBy: { rosterOrder: "asc" } }),
    getEffectiveLocationOptions(),
  ]);

  // Per-location 1..N number is computed over ACTIVE shops only (inactive shops never appear on the
  // order sheet, so they get no number → rendered "-"). rosterOrder stays the React key / identity.
  const activeShops = allShops.filter((s) => s.active);
  const displayNoMap = perLocationDisplayNo(activeShops);

  // Filtering now happens in JS (not a DB `where`) so the display-number map is computed over the
  // full active-shop scope regardless of the current filter. Unfiltered → group by location; filtered
  // → that location's shops in the query's existing rosterOrder-asc order.
  const shops = location
    ? allShops.filter((s) => s.location === location)
    : sortShopsForDisplay(allShops);

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[var(--t-2xl)] font-semibold text-[var(--text-strong)]">ร้านค้า</h1>
        <Link
          href="/shops/new"
          className="inline-flex h-10 items-center rounded-[var(--r-md)] bg-[var(--brand-int)] px-4 text-[var(--t-sm)] font-medium text-[var(--text-on-brand)] hover:bg-[var(--brand-int-hover)]"
        >
          เพิ่มร้านค้า
        </Link>
      </div>

      <div className="mb-6">
        <ShopLocationFilter current={location ?? ""} locations={locations} />
      </div>

      <table className="w-full border-collapse text-[var(--t-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
            <th className="py-2 pr-2 font-medium">ลำดับ</th>
            <th className="py-2 pr-2 font-medium">ชื่อร้านค้า</th>
            <th className="py-2 pr-2 font-medium">สถานที่</th>
            <th className="py-2 pr-2 font-medium">สถานะ</th>
            <th className="py-2 pr-2 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr
              key={shop.id}
              className={
                shop.active
                  ? "border-b border-[var(--border)]"
                  : "border-b border-[var(--border)] opacity-50"
              }
            >
              <td className="py-2 pr-2 font-[var(--font-mono)] text-[var(--text-muted)]">{shop.active ? (displayNoMap.get(shop.id) ?? "-") : "-"}</td>
              <td className="py-2 pr-2 text-[var(--text)]">
                {shop.name}
              </td>
              <td className="py-2 pr-2 text-[var(--text-muted)]">{shop.location ?? "-"}</td>
              <td className="py-2 pr-2 text-[var(--text-muted)]">{shop.active ? "ใช้งาน" : "ลบแล้ว"}</td>
              <td className="py-2 pr-2 text-right">
                <Link href={`/shops/${shop.id}/edit`} className="mr-3 text-[var(--brand-int)] hover:underline">
                  แก้ไข
                </Link>
                {shop.active ? (
                  <form
                    action={async () => {
                      "use server";
                      await softDeleteShop(shop.id);
                    }}
                    className="inline"
                  >
                    <button type="submit" className="text-[var(--danger)]">
                      ลบ
                    </button>
                  </form>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await restoreShop(shop.id);
                    }}
                    className="inline"
                  >
                    <button type="submit" className="text-[var(--brand-int)]">
                      กู้คืน
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
