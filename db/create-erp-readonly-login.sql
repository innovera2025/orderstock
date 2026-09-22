/* ============================================================================
   orderstock — ERP READ-ONLY login for the ERP Dashboards feature
   สร้าง login แบบ "อ่านอย่างเดียว" สำหรับแดชบอร์ด ERP (ขาย / ซื้อ / ผลิต)
   ----------------------------------------------------------------------------
   Program: erp-dashboards (Phase 0 delivery script, 18-09-26)

   ============================================================================
   *** WARNING — DO NOT RUN AGAINST THE LIVE SERVER WITHOUT DBA REVIEW ***
   *** คำเตือน — ห้ามรันบนเซิร์ฟเวอร์จริงโดยไม่ผ่านการตรวจของ DBA ***
   ----------------------------------------------------------------------------
   * ผู้รันสคริปต์นี้ต้องเป็น DBA ของลูกค้าเท่านั้น — ไม่ใช่ agent/สคริปต์อัตโนมัติ.
     The customer's DBA runs this script — NEVER an agent or automated tool.
   * สคริปต์นี้สร้าง login ใหม่ (เพิ่มเติมเท่านั้น) — ไม่แตะตาราง, login, หรือข้อมูล ERP เดิมใดๆ.
     This script creates a NEW, additive login — it does not touch any existing
     table, login, or ERP data. It is still DBA-run-only per this project's
     db_TCL guardrails, same as every other delivery script in `db/`.
   * [db_TCL] คือฐานข้อมูล ERP/บัญชีที่ใช้งานจริงของลูกค้า (shared live ERP DB).
     Do NOT re-run create-database-and-login.sql, do NOT alter COMPATIBILITY_LEVEL,
     never run prisma migrate reset/dev/deploy or db push against db_TCL.
     See process/context/database/all-database.md
     "Production DB: shared ERP database db_TCL — DANGER guardrails".
   * รันซ้ำได้ (idempotent): มี guard IF ... IS NULL ทุกขั้น.
     Idempotent — every CREATE is guarded; re-running is a harmless no-op
     (ALTER ROLE ... ADD MEMBER on an existing member is also a no-op).

   SECURITY:
   * The CREATE LOGIN password below is a PLACEHOLDER. Replace it with a strong
     password BEFORE running; store the real value only in the app host's `.env`
     (the ERP dashboard connection setting) — never commit it.
   * This login must NEVER be `sa` and NEVER the existing `orderstock_app` login.
     It is a brand-new, separate, read-only-scoped login used ONLY by the ERP
     dashboards' separate read connection pool.

   RUN (in SSMS or sqlcmd, as a sysadmin / securityadmin login):
     sqlcmd -S <server> -U <admin-login> -i create-erp-readonly-login.sql
   ============================================================================ */

/* ------------------------------------------------------------------ 1. LOGIN */
/* Server-level login. Replace the PLACEHOLDER password before running.
   Password policy: CHECK_POLICY = ON enforces the server's Windows complexity rules.
   NOTE: never `sa`, never `orderstock_app` — this is a NEW dedicated login. */
IF SUSER_ID(N'orderstock_dash') IS NULL
BEGIN
    CREATE LOGIN [orderstock_dash]
        WITH PASSWORD = N'REPLACE_WITH_A_STRONG_PASSWORD',  -- PLACEHOLDER — do not ship as-is
             DEFAULT_DATABASE = [db_TCL],
             CHECK_POLICY = ON;
END
GO

/* ------------------------------------------------------------------ 2. USER */
USE [db_TCL];
GO
IF USER_ID(N'orderstock_dash') IS NULL
BEGIN
    CREATE USER [orderstock_dash] FOR LOGIN [orderstock_dash];
END
GO

/* ------------------------------------------------------------------ 3. GRANTS (READ-ONLY) */
/* SECURITY-CRITICAL — READ-ONLY ONLY:
   Never grant db_owner, db_datawriter, EXECUTE, or any DDL permission to this
   login, under any circumstance — this login backs a read-only dashboard
   feature, and the application's own boot permission probe (Phase 1) will
   refuse to start if it detects write capability on the connected login.

   Pick ONE of the two options below. Keep both blocks documented so the DBA can
   choose knowingly. */

/* OPTION A (recommended default — active):
   db_datareader = SELECT on every table/view in [db_TCL]. Simplest to maintain,
   but broader than strictly necessary: it can read every ERP table, not just the
   ones the dashboard queries use. */
ALTER ROLE [db_datareader] ADD MEMBER [orderstock_dash];
GO

/* OPTION B (tighter, per-table least privilege — commented out, opt-in for the DBA):
   Uncomment this block AND comment out Option A above to switch to per-table
   least-privilege; keep both blocks documented so the DBA can choose.

   NOTE: this table list is a BEST-EFFORT CANDIDATE SET as of 18-09-26 (Phase 0),
   not a verified-complete set. Confirm it against the program's final
   db/erp-queries/*.sql files (Phases 1-4) at the time Option B is chosen.
   Tables marked (unconfirmed) have no confirmed use in the Phase 1-4 plans yet —
   keep or drop them per that confirmation.

   -- Sales / ขาย
   GRANT SELECT ON [dbo].[tbl_DOhdr]           TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_Dodtl]           TO [orderstock_dash];
   GRANT SELECT ON [dbo].[SalesInvoiceHdr]     TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_CATEGORY]        TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_ItemGroup]       TO [orderstock_dash];
   GRANT SELECT ON [dbo].[SalesReturnHdr]      TO [orderstock_dash];  -- (unconfirmed)
   GRANT SELECT ON [dbo].[Customer]            TO [orderstock_dash];  -- (unconfirmed)

   -- Purchase / ซื้อ
   GRANT SELECT ON [dbo].[PurchaseInvoiceHdr]  TO [orderstock_dash];
   GRANT SELECT ON [dbo].[PurchaseOrderHdr]    TO [orderstock_dash];
   GRANT SELECT ON [dbo].[PurchaseOrderDtl]    TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_PoAmend]         TO [orderstock_dash];
   GRANT SELECT ON [dbo].[PurchaseReturnHdr]   TO [orderstock_dash];  -- (unconfirmed)
   GRANT SELECT ON [dbo].[Supplier]            TO [orderstock_dash];  -- (unconfirmed)

   -- Inventory / คลังสินค้า
   GRANT SELECT ON [dbo].[InventoryFlowHdr]    TO [orderstock_dash];
   GRANT SELECT ON [dbo].[InventoryFlowDtl]    TO [orderstock_dash];
   GRANT SELECT ON [dbo].[InventoryItem]       TO [orderstock_dash];

   -- Production / ผลิต
   GRANT SELECT ON [dbo].[tbl_MoHdr]           TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_MoOperDtl]       TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_BatchOrder]      TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_BatchMRP]        TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_BatchPJBal]      TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_BatchLot]        TO [orderstock_dash];
   GRANT SELECT ON [dbo].[tbl_BatchHdr]        TO [orderstock_dash];  -- (unconfirmed)
*/
GO

PRINT N'db_TCL: login [orderstock_dash] + user + READ-ONLY grant are ready. This login is read-only — never grant it write or DDL permissions.';
GO
