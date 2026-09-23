-- erp-dashboards Phase 2 — Sales: the UNFILTERED sales-invoice pool total.
--
-- FILENAME IS HISTORICAL. It was `sales-invoice-excluded-total.sql` when this pool was genuinely
-- outside the dashboard's money figure, and the name is kept because renaming a versioned query
-- file churns its TS mirror, its column contract and every importer for zero behavioural gain.
-- Read the name as "the whole-pool total", not as a claim that anything is left out.
--
-- READ-ONLY single statement through `guardedQuery()`. Takes no filter parameters on purpose.
--
-- WHAT CHANGED (sales-invoice-basis, 23-09-26): this money is no longer held back from anything.
-- The customer's own ERP team named `sp_SalesInvoice` as the source of truth for sales, so the
-- SalesInvoiceHdr pool IS the dashboard's primary figure now, and the delivery-order figures moved
-- to the secondary "การส่งมอบ" section. Deliveries carry the goods; invoices carry the money.
--
-- WHY THIS QUERY STILL EXISTS ALONGSIDE `invoice-headers.sql`: this one is UNCONDITIONAL — the
-- whole pool, every date — while `invoice-headers.sql` is bounded by the page's selected date
-- range. Two genuinely different shapes for two different callers: the manual live-reconcile
-- script needs the whole pool to check against the ERP's own reports, the dashboard needs the
-- filtered slice the user is looking at. Both scope on `DocuType = 'SI'`, so the filtered figure
-- is always a subset of this one and the two can never describe different document sets.
SELECT
    COUNT(*) AS InvoiceCount,
    COALESCE(SUM(h.TotalAmount), 0) AS ExcludedTotal
FROM dbo.SalesInvoiceHdr h
WHERE h.DocuType = 'SI';
