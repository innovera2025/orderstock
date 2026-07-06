import Link from "next/link";
import { prisma } from "@/lib/db";
import { softDeleteShop, restoreShop } from "./actions";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const shops = await prisma.shop.findMany({ orderBy: { rosterOrder: "asc" } });

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ร้านค้า</h1>
        <Link
          href="/shops/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          เพิ่มร้านค้า
        </Link>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2 pr-2">ลำดับ</th>
            <th className="py-2 pr-2">ชื่อร้านค้า</th>
            <th className="py-2 pr-2">สถานะ</th>
            <th className="py-2 pr-2 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.id} className={shop.active ? "border-b" : "border-b opacity-50"}>
              <td className="py-2 pr-2">{shop.rosterOrder}</td>
              <td className="py-2 pr-2">
                {shop.name}
                {shop.needsConfirmation && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    รอยืนยัน
                  </span>
                )}
              </td>
              <td className="py-2 pr-2">{shop.active ? "ใช้งาน" : "ลบแล้ว"}</td>
              <td className="py-2 pr-2 text-right">
                <Link href={`/shops/${shop.id}/edit`} className="mr-3 text-blue-600">
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
                    <button type="submit" className="text-red-600">
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
                    <button type="submit" className="text-green-600">
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
