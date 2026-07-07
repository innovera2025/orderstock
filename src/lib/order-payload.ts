// Pure payload builder (Phase 02, LOAD-BEARING). The single source of truth for turning the
// order-matrix client state into the EXACT set of hidden-input entries the UNCHANGED
// saveOrderSheet action parses. Both the matrix's hidden-input renderer and the payload unit
// test import this — so the wire format can never silently drift from the tested contract.
//
// Emission rules (byte-identical to the retired Order Pad):
//   cell:{shopId}:{variantId} = trimmed qty   ONLY when Number.isInteger(qty) && qty > 0
//   note:{shopId}             = RAW text       ONLY when text.trim() !== ""
// (weight/peep are transient UI-only and are NEVER emitted.)

export interface OrderPayloadEntry {
  /** Hidden-input `name` — `cell:{shopId}:{variantId}` or `note:{shopId}`. */
  name: string;
  /** Hidden-input `value` — trimmed qty string, or the RAW (untrimmed) note text. */
  value: string;
}

/** True when `raw` parses to a positive integer piece count (matches the server's cell guard). */
function isPositiveIntQty(raw: string | undefined): boolean {
  if (raw == null) return false;
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0;
}

/**
 * Build the ordered set of `cell:`/`note:` hidden-input entries from matrix state.
 *
 * @param cells keyed `${shopId}:${variantId}` → raw qty string
 * @param notes keyed shopId → raw note text
 */
export function buildOrderPayload(
  cells: Record<string, string>,
  notes: Record<number | string, string>,
): OrderPayloadEntry[] {
  const entries: OrderPayloadEntry[] = [];

  for (const [key, raw] of Object.entries(cells)) {
    if (!isPositiveIntQty(raw)) continue;
    entries.push({ name: `cell:${key}`, value: raw.trim() });
  }

  for (const [shopId, text] of Object.entries(notes)) {
    if (text.trim() === "") continue;
    entries.push({ name: `note:${shopId}`, value: text });
  }

  return entries;
}
