import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export default function NewProductPage() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-6 text-2xl font-bold">เพิ่มสินค้า</h1>
      <ProductForm action={createProduct} submitLabel="บันทึก" />
    </main>
  );
}
