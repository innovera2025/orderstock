// erp-dashboards Phase 4 — the single source of truth for what `db/erp-fixture/production-seed.sql`
// contains. Imported by every Production gate so a seed change updates one place, not three.

export const PRODUCTION_FIXTURE_EXPECTED = {
  /** Full seeded window. */
  from: "2026-08-01",
  to: "2026-09-30",
  /** Rows the dashboard shows (cancelled MOs are excluded by the query). */
  liveMoCount: 11,
  /** Rows physically present, including the 1 cancelled MO. */
  seededMoCount: 12,
  cancelledMoNumber: "MO-2608-0012",
  /** Status distribution across the 11 live MOs. */
  statusCounts: { pending: 5, approved: 4, closed: 2 } as Record<string, number>,
  /** Planned quantity per unit — NEVER summed together. */
  plannedQtyByUnit: [
    { unit: "KG", qty: 4761 },
    { unit: "BAG", qty: 180 },
    { unit: "-", qty: 80 },
  ],
  /** The documented NULL-LotQty MO: planned quantity falls back to Prodqty (17). */
  nullLotQtyMo: { moNumber: "MO-2609-0001", plannedQty: 17, materialIssueLines: 7 },
  /** Its MONo values are whitespace-padded in InventoryFlowDtl — the TRIM-guard case. */
  paddedMonoMo: { moNumber: "MO-2608-0007", materialIssueLines: 2 },
  /** An MO with zero linked issues — the common case in real data. */
  zeroIssueMo: "MO-2608-0004",
  /** MOs carrying >= 1 linked raw-material issue. */
  moWithIssueCount: 2,
  /** September-only slice, to prove the date filter is a real bound. */
  septemberMoCount: 3,
  pageSize: 10,
} as const;
