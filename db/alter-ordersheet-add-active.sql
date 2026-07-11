-- ============================================================================================
-- orderstock — เพิ่มคอลัมน์ soft-delete `active` ให้ตาราง OrderSheet บนฐานข้อมูล db_TCL
-- Add the soft-delete `active` column to the OrderSheet table on the live db_TCL database.
--
-- ⚠ วิธีใช้ / USAGE:
--   * รันสคริปต์นี้ครั้งเดียวบน db_TCL (ผ่าน DBA ของลูกค้า) *ก่อน* หรือ *พร้อมกับ* การดีพลอยโค้ดใหม่
--     Run ONCE on db_TCL (by the customer's DBA) BEFORE or ATOMICALLY WITH deploying the new app code.
--     ถ้าดีพลอยโค้ดก่อนรันสคริปต์นี้ ทุกคิวรี OrderSheet จะ error เพราะ Prisma คาดว่าคอลัมน์ active มีอยู่แล้ว.
--   * ปลอดภัยกับข้อมูลจริง: NOT NULL + DEFAULT 1 เติมค่าให้แถวเดิมทั้งหมดเป็น active=1 (มองเห็นได้ตามปกติ) ในคำสั่งเดียว.
--     Safe against live data: NOT NULL + DEFAULT 1 backfills all existing rows to active=1 in one statement.
--   * มี guard ให้รันซ้ำได้แบบ no-op (idempotent). Idempotent — re-running is a harmless no-op.
--   * ขอบเขต: แตะเฉพาะตาราง OrderSheet ของ orderstock เท่านั้น — ห้ามแตะตาราง ERP อื่นใน db_TCL.
--     Scope: touches ONLY orderstock's own OrderSheet table — never the customer's ERP tables.
--
-- ⚠ ห้ามเด็ดขาด / NEVER: อย่ารัน prisma migrate reset/dev/deploy หรือ db push กับ db_TCL —
--   คำสั่งเหล่านั้นจะลบตารางทั้งหมดในฐานข้อมูล ERP ของลูกค้า. This script is the ONLY sanctioned
--   schema change path for db_TCL (see process/context/database/all-database.md §DANGER guardrails).
--   ปลอดภัยกับ COMPATIBILITY_LEVEL 130 (SQL Server 2019 ของ server จริง) — ไม่ใช้ฟีเจอร์ที่ผูกกับ compat level.
-- ============================================================================================

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'[dbo].[OrderSheet]') AND name = 'active'
)
BEGIN
  ALTER TABLE [dbo].[OrderSheet]
    ADD [active] BIT NOT NULL CONSTRAINT [DF_OrderSheet_active] DEFAULT 1;
END
