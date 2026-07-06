"use client";

import { useActionState } from "react";
import { createOrderSheet, type OrderSheetActionState } from "./actions";
import { ceToBeDisplay, parseDateInputValue, toDateInputValue } from "@/lib/be-date";
import { useState } from "react";

// Create a new daily sheet: native CE date input + read-only BE label + "วันนี้" shortcut, plus
// an optional สถานที่. Submit runs createOrderSheet (dup-check → redirect to the grid editor).
export function NewSheetForm() {
  const [state, formAction, pending] = useActionState(
    createOrderSheet,
    {} as OrderSheetActionState,
  );
  const today = toDateInputValue(new Date());
  const [date, setDate] = useState(today);

  const beLabel = date ? ceToBeDisplay(parseDateInputValue(date)) : "";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error && (
        <p className="w-full rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>วันที่</span>
        <div className="flex items-center gap-2">
          <input
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border px-3 py-2"
            required
          />
          <span className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-700" aria-label="พ.ศ.">
            {beLabel}
          </span>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="rounded-md border px-2 py-2 text-sm"
          >
            วันนี้
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>สถานที่ (ไม่บังคับ)</span>
        <input name="location" className="rounded-md border px-3 py-2" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        เปิดใบออเดอร์
      </button>
    </form>
  );
}
