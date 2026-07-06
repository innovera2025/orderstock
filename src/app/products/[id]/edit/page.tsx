import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PACK_SIZE_LABELS, type PackSize } from "@/lib/product-order";
import {
  updateProduct,
  addVariant,
  softDeleteVariant,
  type ProductActionState,
} from "../../actions";
import { ProductForm } from "../../product-form";
import { AddVariantForm } from "../../add-variant-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { orderBy: [{ printOrder: "asc" }, { id: "asc" }] } },
  });
  if (!product) notFound();

  const boundUpdate = async (
    prev: ProductActionState,
    formData: FormData,
  ): Promise<ProductActionState> => {
    "use server";
    return updateProduct(productId, prev, formData);
  };

  const boundAddVariant = async (
    prev: ProductActionState,
    formData: FormData,
  ): Promise<ProductActionState> => {
    "use server";
    return addVariant(productId, prev, formData);
  };

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">แก้ไขสินค้า</h1>
      <ProductForm
        action={boundUpdate}
        defaultValues={{
          name: product.name,
          group: product.group,
          isOffList: product.isOffList,
          needsConfirmation: product.needsConfirmation,
        }}
        submitLabel="บันทึก"
      />

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">ตัวเลือกสินค้า (variants)</h2>
        <table className="mb-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              <th className="py-2 pr-2">ชื่อ</th>
              <th className="py-2 pr-2">ขนาด</th>
              <th className="py-2 pr-2">ลำดับพิมพ์</th>
              <th className="py-2 pr-2">สถานะ</th>
              <th className="py-2 pr-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => (
              <tr key={v.id} className={v.active ? "border-b" : "border-b opacity-50"}>
                <td className="py-2 pr-2">{v.name}</td>
                <td className="py-2 pr-2">
                  {v.packSize === "NONE" ? "-" : PACK_SIZE_LABELS[v.packSize as PackSize]}
                  {v.labelVariant ? ` ${v.labelVariant}` : ""}
                </td>
                <td className="py-2 pr-2">{v.printOrder ?? "นอกรายการ"}</td>
                <td className="py-2 pr-2">{v.active ? "ใช้งาน" : "ลบแล้ว"}</td>
                <td className="py-2 pr-2 text-right">
                  {v.active && (
                    <form
                      action={async () => {
                        "use server";
                        await softDeleteVariant(v.id, productId);
                      }}
                      className="inline"
                    >
                      <button type="submit" className="text-red-600">
                        ลบ
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddVariantForm action={boundAddVariant} />
      </section>
    </main>
  );
}
