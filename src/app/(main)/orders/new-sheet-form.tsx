"use client";

import { useActionState } from "react";
import { createOrderSheet, type OrderSheetActionState } from "./actions";
import { ceToBeDisplay, parseDateInputValue, toDateInputValue } from "@/lib/be-date";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Create a new daily sheet: native CE date input + read-only BE label + "วันนี้" shortcut, plus
// a สถานที่ picker (a <select> of distinct existing shop locations, server-fed). Submit runs
// createOrderSheet (dup-check → redirect to the grid editor); the action still receives a plain
// string, so its zod validation is unchanged in shape.
export function NewSheetForm({ locations = [] }: { locations?: string[] }) {
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
        <p className="w-full rounded-[var(--r-md)] bg-[var(--danger-bg)] px-3 py-2 text-[var(--t-sm)] text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
        <span>วันที่</span>
        <div className="flex items-center gap-2">
          <input
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 font-[var(--font-mono)] text-[var(--text)] outline-none focus-visible:border-[var(--brand-int)] focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]"
            required
          />
          <span
            className="rounded-[var(--r-sm)] bg-[var(--bg-sunken)] px-2 py-1 font-[var(--font-mono)] text-[var(--t-sm)] text-[var(--text-muted)]"
            aria-label="พ.ศ."
          >
            {beLabel}
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={() => setDate(today)}>
            วันนี้
          </Button>
        </div>
      </label>

      <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
        <span>สถานที่ (ไม่บังคับ)</span>
        <select
          name="location"
          defaultValue=""
          className="h-10 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[var(--text)] outline-none focus-visible:border-[var(--brand-int)] focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]"
        >
          <option value="">ทุกสถานที่</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </label>

      <Button type="submit" disabled={pending}>
        เปิดใบออเดอร์
      </Button>
    </form>
  );
}
