import { createShop } from "../actions";
import { ShopForm } from "../shop-form";

export default function NewShopPage() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-6 text-2xl font-bold">เพิ่มร้านค้า</h1>
      <ShopForm action={createShop} submitLabel="บันทึก" />
    </main>
  );
}
