// CE↔BE date helpers (Phase 04, decision 4). Dates are STORED as CE (OrderSheet.date @db.Date)
// and DISPLAYED in Buddhist Era. Buddhist year = CE + 543. We use Intl `th-TH-u-ca-buddhist` to
// derive the BE year so the conversion is locale-correct rather than a hand-rolled +543. The
// native `input[type=date]` control only ever shows/returns CE (yyyy-mm-dd).

const beYearFormatter = new Intl.DateTimeFormat("en-US-u-ca-buddhist", {
  year: "numeric",
  timeZone: "UTC",
});

export interface BeParts {
  day: number;
  /** 1-based month. */
  month: number;
  /** Full Buddhist-era year, e.g. 2569. */
  yearBE: number;
  /** 2-digit Buddhist-era year string, e.g. "69". */
  yearBE2: string;
}

/**
 * Derive Buddhist-era display parts from a CE date. Uses the local calendar day/month (matching
 * what the user picked in the native CE date input) and the Intl Buddhist calendar for the year.
 */
export function ceToBeParts(date: Date): BeParts {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  // Format the year from a UTC-noon instant of the same calendar day to avoid TZ edge drift.
  const utcNoon = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  // Intl formats the Buddhist year with a " BE" era suffix (e.g. "2569 BE"); pull the year part
  // out of formatToParts and keep only its digits so Number() parses cleanly.
  const yearPart = beYearFormatter.formatToParts(utcNoon).find((p) => p.type === "year")?.value ?? "";
  const yearBE = Number(yearPart.replace(/\D/g, ""));
  const yearBE2 = String(yearBE).slice(-2);
  return { day, month, yearBE, yearBE2 };
}

/** Thai short display: d/m/yy in Buddhist Era (e.g. 13/3/69). */
export function ceToBeDisplay(date: Date): string {
  const { day, month, yearBE2 } = ceToBeParts(date);
  return `${day}/${month}/${yearBE2}`;
}

/** Format a CE date as a native date-input value (yyyy-mm-dd, local calendar day). */
export function toDateInputValue(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a native date-input value (yyyy-mm-dd) into a stable LOCAL calendar date (no TZ drift). */
export function parseDateInputValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
