"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PRODUCT_GROUPS, PRODUCT_GROUP_LABELS } from "@/lib/product-order";
import type { ProductActionState } from "./actions";

interface ProductFormProps {
  action: (prev: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  defaultValues?: {
    name: string;
    group: string;
    isOffList: boolean;
    needsConfirmation: boolean;
  };
  submitLabel: string;
}

export function ProductForm({ action, defaultValues, submitLabel }: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, {} as ProductActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>ชื่อสินค้า</span>
        <input
          name="name"
          defaultValue={defaultValues?.name}
          className="rounded-md border px-3 py-2"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>กลุ่มสินค้า</span>
        <select
          name="group"
          defaultValue={defaultValues?.group ?? PRODUCT_GROUPS[0]}
          className="rounded-md border px-3 py-2"
        >
          {PRODUCT_GROUPS.map((g) => (
            <option key={g} value={g}>
              {PRODUCT_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input name="isOffList" type="checkbox" defaultChecked={defaultValues?.isOffList ?? false} />
        <span>สินค้านอกรายการ (off-list)</span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          name="needsConfirmation"
          type="checkbox"
          defaultChecked={defaultValues?.needsConfirmation ?? false}
        />
        <span>ยังไม่ยืนยันชื่อ (รอยืนยัน)</span>
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <Link href="/products" className="rounded-md border px-4 py-2 text-sm">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
