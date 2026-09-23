// The live-schema contract each dashboard query depends on: for every `db/erp-queries/**/*.sql`
// file, the exact `dbo.<Table>.<Column>` set it reads.
//
// WHY A HAND-DECLARED LIST AND NOT PURE PARSING: `src/lib/erp-sql-columns.ts` resolves every
// QUALIFIED reference (`h.IsClosed`) automatically, and the gate checks those against the live
// manifest with zero help from this file. What it cannot resolve is an UNQUALIFIED read — the
// `SELECT ItemCode, Description, MainUnits FROM dbo.InventoryItem` inside a `CanonicalItem` CTE.
// A bare `ItemCode` is a real column on InventoryItem, tbl_Dodtl and InventoryFlowDtl alike, so no
// amount of regex can say which table a given file meant without implementing SQL scope rules.
// Guessing would make the gate lie. Declaring is honest, reviewable, and — critically — CHECKED
// FROM BOTH SIDES by `erp-query-schema-conformance.test.ts`:
//
//   * every column declared here must exist on the live table (so the list cannot invent columns);
//   * every column the SQL actually reads must be declared here (so the list cannot omit columns);
//   * every column declared here must appear as an identifier in its query file (so the list
//     cannot be padded with harmless-looking filler to make the first check pass).
//
// Those three together mean this list cannot drift from the SQL without a test failing, and cannot
// drift from production without a test failing.
//
// CASING mirrors the live server exactly — note `tbl_Dodtl.Itemcode` (lowercase `c`) next to
// `InventoryItem.ItemCode`. Comparison is case-insensitive, as SQL Server's identifiers are; the
// casing here is documentation of what the live schema really looks like.
//
// WHEN YOU CHANGE A QUERY: update its entry here in the same edit. If the column is not in
// `db/erp-schema/live-manifest_*.json`, it does not exist in production — no matter what the data
// dictionary says. That mistake took every dashboard page down on 23-09-26.

/** `db/erp-queries/...` path -> table -> columns that file reads from that table. */
export const ERP_QUERY_COLUMNS: Record<string, Record<string, readonly string[]>> = {
  // ---- sales ----------------------------------------------------------------------------------
  "db/erp-queries/sales/do-headers.sql": {
    "dbo.tbl_DOhdr": [
      "TransactionNo", "DoNo", "Dodate", "CustCode", "CustName",
      // Delivery status is derived from these three. There is NO `IsCancel` on this table — that
      // invented column is the exact defect this gate exists to prevent.
      "IsClosed", "IsApproved", "IsCheck",
    ],
    "dbo.tbl_Dodtl": ["TransactionNo", "Itemcode", "Saleprice", "Amount"],
    "dbo.InventoryItem": ["ItemCode", "ItemGRP", "Roworder"],
  },
  "db/erp-queries/sales/do-lines.sql": {
    "dbo.tbl_DOhdr": [
      "TransactionNo", "DoNo", "Dodate", "CustCode", "CustName",
      "IsClosed", "IsApproved", "IsCheck",
    ],
    "dbo.tbl_Dodtl": ["TransactionNo", "RowOrder", "Itemcode", "Qty", "Saleprice", "Amount"],
    "dbo.InventoryItem": ["ItemCode", "Description", "MainUnits", "ItemGRP", "Roworder"],
    // The ERP's own category master — the label source for the Sales category pie. ICCode is the
    // code stored on InventoryItem.ItemGRP; Description is the Thai group name.
    "dbo.tbl_ItemGroup": ["ICCode", "Description"],
  },
  "db/erp-queries/sales/do-by-customer.sql": {
    "dbo.tbl_DOhdr": [
      "TransactionNo", "DoNo", "Dodate", "CustCode", "CustName",
      "IsClosed", "IsApproved", "IsCheck",
    ],
    "dbo.tbl_Dodtl": ["TransactionNo", "Itemcode", "Qty", "Amount"],
    "dbo.InventoryItem": ["ItemCode", "Description", "MainUnits", "ItemGRP", "Roworder"],
  },
  "db/erp-queries/sales/do-by-product.sql": {
    "dbo.tbl_DOhdr": [
      "TransactionNo", "DoNo", "Dodate", "CustCode", "CustName",
      "IsClosed", "IsApproved", "IsCheck",
    ],
    "dbo.tbl_Dodtl": ["TransactionNo", "Itemcode", "Qty", "Amount"],
    "dbo.InventoryItem": ["ItemCode", "Description", "MainUnits", "ItemGRP", "Roworder"],
  },
  "db/erp-queries/sales/sales-invoice-excluded-total.sql": {
    "dbo.SalesInvoiceHdr": ["DocuType", "TotalAmount"],
  },

  // ---- purchase -------------------------------------------------------------------------------
  "db/erp-queries/purchase/po-list.sql": {
    // Unlike tbl_DOhdr, PurchaseOrderHdr really does carry IsCancel — which is why the gate checks
    // per table rather than blanket-banning a column name.
    "dbo.PurchaseOrderHdr": [
      "TransactionNo", "PONumber", "PODate", "SupplierCode", "TotalAmount",
      "IsCancel", "IsClosed", "IsApproved", "IsCheck", "IsComplete", "IsRecPo",
    ],
  },
  "db/erp-queries/purchase/po-lines.sql": {
    "dbo.PurchaseOrderDtl": [
      "TransactionNo", "Number", "ItemCode", "MainUnits", "MainQuantity", "MainUnitPrice",
      "TotalPrice",
    ],
    "dbo.PurchaseOrderHdr": ["TransactionNo", "PONumber", "PODate"],
  },
  "db/erp-queries/purchase/po-received.sql": {
    "dbo.InventoryFlowHdr": ["TransactionNo", "VoucherNo", "Approved", "IsClosed"],
    "dbo.InventoryFlowDtl": ["TransactionNo", "VoucherNo", "PONo", "ItemCode", "MainQuantity"],
  },
  "db/erp-queries/purchase/supplier-breakdown.sql": {
    "dbo.PurchaseOrderHdr": ["SupplierCode", "PODate", "TotalAmount", "IsCancel"],
  },
  "db/erp-queries/purchase/total-invoice-basis.sql": {
    "dbo.PurchaseInvoiceHdr": [
      "TransactionNo", "VoucherNo", "VoucherDate", "CustOrSuppCode", "DocuType", "PurchaseType",
      "TotalAmount", "IsClosed",
    ],
  },
  "db/erp-queries/purchase/total-po-committed-basis.sql": {
    "dbo.PurchaseOrderHdr": ["SupplierCode", "PODate", "TotalAmount", "IsCancel"],
  },

  // ---- production -----------------------------------------------------------------------------
  "db/erp-queries/production/mo-list.sql": {
    "dbo.tbl_MoHdr": [
      "TransactionNo", "MoNumBer", "Modate", "FgCode", "Prodqty", "LotQty",
      "Approved", "IsClosed", "IsCancel",
    ],
    "dbo.InventoryFlowDtl": ["MONo", "ReasonName"],
    "dbo.InventoryItem": ["ItemCode", "Description", "MainUnits", "Roworder"],
  },
  "db/erp-queries/production/material-issues.sql": {
    // `Qty` and `TransactionDate` were the invented names here: the real columns are
    // InventoryFlowDtl.MainQuantity and InventoryFlowHdr.InOutDate.
    "dbo.InventoryFlowDtl": [
      "TransactionNo", "ItemCode", "MainQuantity", "MainUnits", "MONo", "ReasonName",
    ],
    "dbo.InventoryFlowHdr": ["TransactionNo", "InOutDate"],
    "dbo.InventoryItem": ["ItemCode", "Description", "MainUnits", "Roworder"],
  },
};
