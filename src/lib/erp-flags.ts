// Coercion for the ERP's boolean-ish flag columns.
//
// THE TRAP: not one flag column in this ERP is a SQL `BIT`. `IsCancel`, `IsClosed`, `IsApproved`,
// `IsCheck`, `IsComplete`, `IsRecPo`, `Approved` — every single one is `TINYINT` on the live server
// (see `db/erp-schema/live-manifest_*.json`). The `mssql` driver maps TINYINT to a JavaScript
// NUMBER, not a boolean, so `header.IsRecPo === true` is ALWAYS false against real data, silently,
// with no error anywhere.
//
// It stayed invisible until 23-09-26 because the hand-built `erp_fixture` sandbox declared those
// columns as `BIT` — the driver then returned real booleans, `=== true` worked, and the local
// suite was green while production would have mis-derived every status. Rebuilding the fixture from
// the live manifest is what exposed it. Same root cause as the missing-column defect: code written
// against an imagined schema.
//
// Use these helpers for EVERY flag column read out of the ERP. Never compare a raw flag with
// `=== true`.

/** What a flag column can arrive as: TINYINT (number), BIT (boolean), or NULL. */
export type ErpFlag = boolean | number | null | undefined;

/**
 * `ISNULL(flag, 0) = 1` in TypeScript — the ERP's own semantic for an unset flag.
 *
 * Matches the SQL comparison exactly (`= 1`) rather than truthiness, so a stray TINYINT 2 is not
 * silently promoted to true.
 */
export function erpFlag(value: ErpFlag): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  return false;
}

/**
 * Coerce to boolean but PRESERVE NULL, for the columns where NULL is meaningful.
 *
 * `PurchaseOrderHdr.IsClosed` is NULL on every open PO. The ISNULL decision belongs to the status
 * derivation (and to its unit test), not to this layer — flattening NULL to false here would hide
 * that decision from the place that documents it.
 */
export function erpFlagOrNull(value: ErpFlag): boolean | null {
  if (value === null || value === undefined) return null;
  return erpFlag(value);
}
