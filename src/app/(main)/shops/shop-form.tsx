"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ShopActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ShopFormProps {
  action: (prev: ShopActionState, formData: FormData) => Promise<ShopActionState>;
  defaultValues?: {
    name: string;
    location: string | null;
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
        <p className="rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
        <span>ชื่อร้านค้า</span>
        <Input name="name" defaultValue={defaultValues?.name} required />
      </label>

      <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
        <span>สถานที่ (ไม่บังคับ)</span>
        <Input name="location" defaultValue={defaultValues?.location ?? ""} maxLength={200} />
      </label>

      <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
        <span>ลำดับ (roster)</span>
        <Input
          name="rosterOrder"
          type="number"
          min={1}
          defaultValue={defaultValues?.rosterOrder}
          className="font-[var(--font-mono)]"
          required
        />
      </label>

      <label className="flex items-center gap-2 text-[var(--t-sm)] text-[var(--text)]">
        <input
          name="needsConfirmation"
          type="checkbox"
          defaultChecked={defaultValues?.needsConfirmation ?? false}
        />
        <span>ยังไม่ยืนยันชื่อ (รอยืนยัน)</span>
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        <Link
          href="/shops"
          className="inline-flex h-10 items-center rounded-[var(--r-md)] border-[1.5px] border-[var(--border-strong)] px-4 text-[var(--t-sm)] text-[var(--text)]"
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
