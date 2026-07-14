import { createShop } from "../actions";
import { ShopForm } from "../shop-form";
import { getEffectiveLocationOptions } from "@/lib/locations";

// force-dynamic: this route fetches the (managed) location list at request time — without it,
// next build could statically bake in the list and new locations would never appear here.
export const dynamic = "force-dynamic";

export default async function NewShopPage() {
  const locations = await getEffectiveLocationOptions();

  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-6 text-2xl font-bold">เพิ่มร้านค้า</h1>
      <ShopForm action={createShop} locations={locations} submitLabel="บันทึก" />
    </main>
  );
}
