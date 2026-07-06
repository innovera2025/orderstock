import Link from "next/link";
import { prisma } from "@/lib/db";
import { PRODUCT_GROUP_LABELS, type ProductGroup } from "@/lib/product-order";
import { softDeleteProduct, restoreProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ isOffList: "asc" }, { name: "asc" }],
    include: { _count: { select: { variants: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">สินค้า</h1>
        <Link
          href="/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          เพิ่มสินค้า
        </Link>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2 pr-2">ชื่อสินค้า</th>
            <th className="py-2 pr-2">กลุ่ม</th>
            <th className="py-2 pr-2">ตัวเลือก</th>
            <th className="py-2 pr-2">สถานะ</th>
            <th className="py-2 pr-2 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className={p.active ? "border-b" : "border-b opacity-50"}>
              <td className="py-2 pr-2">
                {p.name}
                {p.isOffList && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    นอกรายการ
                  </span>
                )}
                {p.needsConfirmation && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    รอยืนยัน
                  </span>
                )}
              </td>
              <td className="py-2 pr-2">{PRODUCT_GROUP_LABELS[p.group as ProductGroup]}</td>
              <td className="py-2 pr-2">{p._count.variants}</td>
              <td className="py-2 pr-2">{p.active ? "ใช้งาน" : "ลบแล้ว"}</td>
              <td className="py-2 pr-2 text-right">
                <Link href={`/products/${p.id}/edit`} className="mr-3 text-blue-600">
                  แก้ไข
                </Link>
                {p.active ? (
                  <form
                    action={async () => {
                      "use server";
                      await softDeleteProduct(p.id);
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
                      await restoreProduct(p.id);
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
