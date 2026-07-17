"use client";

import { useRouter } from "next/navigation";

// Server-side location filter for /shops: a <select> whose change navigates to
// /shops?location=<value> (or /shops for "ทุกสถานที่"). The URL searchParam is the single source
// of truth — the page re-renders server-side with the filtered shop list. No local state.
export function ShopLocationFilter({
  current,
  locations = [],
}: {
  current: string;
  locations?: string[];
}) {
  const router = useRouter();

  return (
    <label className="flex flex-col gap-1.5 text-[var(--t-sm)] text-[var(--text)]">
      <span>สถานที่</span>
      <select
        name="location"
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/shops?location=${encodeURIComponent(v)}` : "/shops");
        }}
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
  );
}
