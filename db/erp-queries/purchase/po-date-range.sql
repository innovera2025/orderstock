-- ช่วงข้อมูล — Purchase: what the ERP ACTUALLY holds, regardless of the page's date filter.
--
-- READ-ONLY: a single SELECT statement, executed ONLY through `guardedQuery()`. No parameters, on
-- purpose — the notice describes the ERP's real data range, not the current filter selection.
--
-- WHICH DATE, AND WHY. This dashboard reads two bases: purchase orders (PurchaseOrderHdr.PODate)
-- and purchase invoices (PurchaseInvoiceHdr.VoucherDate). The notice reports the PURCHASE-ORDER
-- range and the purchase-order count, and says so out loud in the UI text ("ใบสั่งซื้อ N ใบ") —
-- the PO is the document this page lists, the document the drilldown route opens, and the document
-- whose number the user recognises. Reporting one unlabelled range spanning two different document
-- types would be the dishonest option; naming the document type we report is the honest one.
--
-- COUNTS EVERY PO, cancelled ones included: a cancelled order is still a document the ERP holds.
-- The money KPIs exclude cancelled orders — that is a KPI rule, not a data-range rule.
SELECT
    COUNT(*) AS DocCount,
    MIN(h.PODate) AS FirstDate,
    MAX(h.PODate) AS LastDate
FROM dbo.PurchaseOrderHdr h;
