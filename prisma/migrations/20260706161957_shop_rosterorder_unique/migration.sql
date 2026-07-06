-- Replace the non-unique rosterOrder index with a UNIQUE constraint (one shop per roster slot).
DROP INDEX [Shop_rosterOrder_idx] ON [dbo].[Shop];

CREATE UNIQUE INDEX [Shop_rosterOrder_key] ON [dbo].[Shop]([rosterOrder]);
