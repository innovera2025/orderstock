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
  locations?: string[];
  submitLabel: string;
}

export function ShopForm({ action, defaultValues, locations = [], submitLabel }: ShopFormProps) {
  const [state, formAction, pending] = useActionState(action, {} as ShopActionState);

  const current = defaultValues?.location ?? "";
  // Defensively surface the shop's CURRENT location even if it was deleted from the managed list,
  // so an existing value is never silently reset to "ไม่ระบุ" on save.
  const options =
    current !== "" && !locations.includes(current) ? [...locations, current] : locations;

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
        <select
          name="location"
          defaultValue={current}
          className="h-10 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[var(--text)] outline-none focus-visible:border-[var(--brand-int)] focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]"
        >
          <option value="">ไม่ระบุ</option>
          {options.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
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
