-- erp-dashboards Phase 2 — Sales: the RECONCILIATION FOOTNOTE query.
--
-- READ-ONLY single statement through `guardedQuery()`. Takes no filter parameters on purpose: the
-- footnote discloses the WHOLE excluded pool, not a date-sliced slice of it, so a narrow filter can
-- never make the excluded figure look smaller than it is.
--
-- WHY THIS EXISTS: this dashboard's sales total is built on the DELIVERY-ORDER basis
-- (tbl_DOhdr/tbl_Dodtl). A separate, larger pool of sales-invoice value lives in SalesInvoiceHdr
-- (DocuType='SI') and is deliberately NOT part of that total. The umbrella charter forbids silently
-- dropping a larger real number, so the dashboard names this amount out loud directly under the
-- money tile. These rows are NEVER added to any dashboard figure — they are disclosure only.
SELECT
    COUNT(*) AS InvoiceCount,
    COALESCE(SUM(h.TotalAmount), 0) AS ExcludedTotal
FROM dbo.SalesInvoiceHdr h
WHERE h.DocuType = 'SI';
