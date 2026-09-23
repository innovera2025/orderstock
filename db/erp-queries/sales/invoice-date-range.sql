-- ช่วงข้อมูล — Sales (invoice basis): what the ERP ACTUALLY holds, regardless of the page's filter.
--
-- READ-ONLY: a single SELECT statement, executed ONLY through `guardedQuery()`.
--
-- TAKES NO PARAMETERS ON PURPOSE, exactly like `do-date-range.sql`: this feeds the data-range
-- notice, which answers "how much sales-invoice history does the ERP have?" — NOT "what did my
-- current filter select?". Binding the page's @from/@to here would make the notice merely restate
-- the filter the user just set.
--
-- LIVE COLUMN NAMES: the date is `VoucherDate` — there is no `InvDate`/`InvoiceDate` column on
-- `dbo.SalesInvoiceHdr`. `DocuType = 'SI'` scopes it to the same pool every other invoice query
-- reports, so the notice and the figures can never describe different document sets.
--
-- MIN/MAX over a date column ignore NULLs and return NULL for an empty table; the app renders that
-- as "range not known" rather than inventing a date.
SELECT
    COUNT(*) AS DocCount,
    MIN(h.VoucherDate) AS FirstDate,
    MAX(h.VoucherDate) AS LastDate
FROM dbo.SalesInvoiceHdr h
WHERE h.DocuType = 'SI';
