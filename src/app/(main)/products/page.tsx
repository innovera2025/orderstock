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
        <h1 className="text-[var(--t-2xl)] font-semibold text-[var(--text-strong)]">สินค้า</h1>
        <Link
          href="/products/new"
          className="inline-flex h-10 items-center rounded-[var(--r-md)] bg-[var(--brand-int)] px-4 text-[var(--t-sm)] font-medium text-[var(--text-on-brand)] hover:bg-[var(--brand-int-hover)]"
        >
          เพิ่มสินค้า
        </Link>
      </div>

      <table className="w-full border-collapse text-[var(--t-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
            <th className="py-2 pr-2 font-medium">ชื่อสินค้า</th>
            <th className="py-2 pr-2 font-medium">กลุ่ม</th>
            <th className="py-2 pr-2 font-medium">ตัวเลือก</th>
            <th className="py-2 pr-2 font-medium">สถานะ</th>
            <th className="py-2 pr-2 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              className={
                p.active
                  ? "border-b border-[var(--border)]"
                  : "border-b border-[var(--border)] opacity-50"
              }
            >
              <td className="py-2 pr-2 text-[var(--text)]">
                {p.name}
                {p.isOffList && (
                  <span className="ml-2 rounded-[var(--r-sm)] bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[var(--t-xs)] text-[var(--text-muted)]">
                    นอกรายการ
                  </span>
                )}
                {p.needsConfirmation && (
                  <span className="ml-2 rounded-[var(--r-sm)] bg-[var(--warning-bg)] px-1.5 py-0.5 text-[var(--t-xs)] text-[var(--warning)]">
                    รอยืนยัน
                  </span>
                )}
              </td>
              <td className="py-2 pr-2 text-[var(--text-muted)]">{PRODUCT_GROUP_LABELS[p.group as ProductGroup]}</td>
              <td className="py-2 pr-2 font-[var(--font-mono)] text-[var(--text-muted)]">{p._count.variants}</td>
              <td className="py-2 pr-2 text-[var(--text-muted)]">{p.active ? "ใช้งาน" : "ลบแล้ว"}</td>
              <td className="py-2 pr-2 text-right">
                <Link href={`/products/${p.id}/edit`} className="mr-3 text-[var(--brand-int)] hover:underline">
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
                    <button type="submit" className="text-[var(--danger)]">
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
