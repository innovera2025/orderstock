import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateShop, type ShopActionState } from "../../actions";
import { ShopForm } from "../../shop-form";

export const dynamic = "force-dynamic";

export default async function EditShopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isInteger(shopId)) notFound();

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) notFound();

  // Bind the shop id to the update action (server actions cannot take arbitrary args
  // from the client, so we partially apply it here).
  const boundUpdate = async (
    prev: ShopActionState,
    formData: FormData,
  ): Promise<ShopActionState> => {
    "use server";
    return updateShop(shopId, prev, formData);
  };

  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-6 text-2xl font-bold">แก้ไขร้านค้า</h1>
      <ShopForm
        action={boundUpdate}
        defaultValues={{
          name: shop.name,
          location: shop.location,
          rosterOrder: shop.rosterOrder,
          needsConfirmation: shop.needsConfirmation,
        }}
        submitLabel="บันทึก"
      />
    </main>
  );
}
