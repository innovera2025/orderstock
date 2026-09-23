-- ช่วงข้อมูล — Sales: what the ERP ACTUALLY holds, regardless of the page's date filter.
--
-- READ-ONLY: a single SELECT statement, executed ONLY through `guardedQuery()`.
--
-- TAKES NO PARAMETERS ON PURPOSE. This feeds the data-range notice at the top of the dashboard,
-- which answers "how much delivery-order history does the ERP have?" — NOT "what did my current
-- filter select?". Binding the page's @from/@to here would make the notice merely restate the
-- filter the user just set, which is the useless behaviour it replaces. Same reasoning, and the
-- same deliberate lack of filters, as `sales-invoice-excluded-total.sql`.
--
-- COUNTS EVERY HEADER, including ones the current status filter would hide: the notice describes
-- the data that exists, so dropping rows here would understate the real range.
--
-- MIN/MAX over a date column ignore NULLs and return NULL for an empty table; the app renders that
-- as "range not known" rather than inventing a date.
SELECT
    COUNT(*) AS DocCount,
    MIN(h.Dodate) AS FirstDate,
    MAX(h.Dodate) AS LastDate
FROM dbo.tbl_DOhdr h;
