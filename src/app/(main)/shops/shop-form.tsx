"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ShopActionState } from "./actions";

interface ShopFormProps {
  action: (prev: ShopActionState, formData: FormData) => Promise<ShopActionState>;
  defaultValues?: {
    name: string;
    rosterOrder: number;
    needsConfirmation: boolean;
  };
  submitLabel: string;
}

export function ShopForm({ action, defaultValues, submitLabel }: ShopFormProps) {
  const [state, formAction, pending] = useActionState(action, {} as ShopActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>ชื่อร้านค้า</span>
        <input
          name="name"
          defaultValue={defaultValues?.name}
          className="rounded-md border px-3 py-2"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>ลำดับ (roster)</span>
        <input
          name="rosterOrder"
          type="number"
          min={1}
          defaultValue={defaultValues?.rosterOrder}
          className="rounded-md border px-3 py-2"
          required
        />
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
        <Link href="/shops" className="rounded-md border px-4 py-2 text-sm">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
