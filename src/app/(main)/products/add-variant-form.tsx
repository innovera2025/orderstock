"use client";

import { useActionState } from "react";
import { PACK_SIZES, PACK_SIZE_LABELS } from "@/lib/product-order";
import type { ProductActionState } from "./actions";

interface AddVariantFormProps {
  action: (prev: ProductActionState, formData: FormData) => Promise<ProductActionState>;
}

export function AddVariantForm({ action }: AddVariantFormProps) {
  const [state, formAction, pending] = useActionState(action, {} as ProductActionState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error && (
        <p className="w-full rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span>ขนาดบรรจุ</span>
        <select name="packSize" className="rounded-md border px-3 py-2">
          {PACK_SIZES.map((p) => (
            <option key={p} value={p}>
              {p === "NONE" ? "ไม่มีขนาด" : PACK_SIZE_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>ป้าย (รส/สี)</span>
        <input name="labelVariant" className="rounded-md border px-3 py-2" placeholder="เช่น หมู" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>ลำดับพิมพ์ (เว้นว่าง=นอกรายการ)</span>
        <input name="printOrder" type="number" min={1} className="w-40 rounded-md border px-3 py-2" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        เพิ่มตัวเลือก
      </button>
    </form>
  );
}
