-- ============================================================================================
-- ERP-SHAPED FIXTURE DATABASE — LOCAL SANDBOX ONLY — ALL DDL FOR EVERY ERP TABLE WE READ
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script CREATEs a database and tables. It is a disposable local dev/test fixture, run
-- ONLY against the local `orderstock-sql` Docker container (localhost:1433). The customer's ERP
-- database db_TCL is strictly read-only to this project; no DDL, no writes, ever.
--
-- It is also deliberately NOT part of prisma/migrations: `erp_fixture` is a SEPARATE database
-- from the Prisma-managed `orderstock` sandbox database, and no ERP table ever enters
-- prisma/schema.prisma.
--
-- ============================================================================================
-- GENERATED FROM THE LIVE SCHEMA — DO NOT HAND-EDIT COLUMN LISTS
-- ============================================================================================
-- Every CREATE TABLE below is generated from `db/erp-schema/live-manifest_23-09-26.json`, which
-- was captured from `sys.columns`/`sys.types` on the live db_TCL server (metadata only — no row
-- data was ever read). Column NAMES, TYPES and NULLABILITY therefore mirror production exactly,
-- column-for-column, in live ordinal order.
--
-- WHY (root cause this file exists to kill, 23-09-26): the previous fixture was hand-built from a
-- PROSE data dictionary, so it modelled columns production does not have (`tbl_DOhdr.IsCancel`,
-- `SalesInvoiceHdr.InvoiceNo/InvoiceDate/CustCode`, `InventoryFlowHdr.DocuNo/WarehouseCode`) and
-- omitted columns production does (`tbl_Dodtl.Slno/Units/Description`, every table's `RowOrder`).
-- Every dashboard gate passed against that invented schema and then failed on db_TCL with
-- "Invalid column name" — which is why every dashboard page rendered the ERP-unavailable message.
-- A fixture may hold FEWER ROWS than production; it may not hold a DIFFERENT SHAPE.
--
-- A SECOND root cause fixed here: `purchase-seed.sql` and `production-seed.sql` each used to
-- CREATE the SHARED `dbo.InventoryFlowHdr`/`dbo.InventoryFlowDtl` tables with their own narrower,
-- mutually incompatible shape, so whichever seed ran first decided the schema. ALL DDL now lives
-- in this one file; the domain seeds are pure row-seeds and create nothing.
--
-- TYPE MAPPING: the only deviation from the manifest is the deprecated `text` type, emitted as
-- `NVARCHAR(MAX)` (its documented modern replacement, and a superset for every read our SQL does).
-- No query in this repo reads a `text` column.
--
-- PRIMARY KEYS are the fixture's own uniqueness contract, not captured live (the manifest is
-- columns-only). Each is a subset of that table's live NOT NULL columns, and is exactly the key
-- each seed's `WHERE NOT EXISTS (...)` idempotency guard tests.
--
-- TO REGENERATE after refreshing the manifest: re-derive the CREATE TABLE blocks from the manifest
-- rather than editing them by hand (see db/erp-schema/README.md).
--
-- Apply (from the repo root, with the sandbox container running) — FIRST, before any seed:
--   docker exec -i orderstock-sql /opt/mssql-tools18/bin/sqlcmd \
--     -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -b -i /dev/stdin < db/erp-fixture/00-schema.sql
--
-- Drop and recreate freely: DROP DATABASE erp_fixture;  (local sandbox only)
-- Idempotent: safe to re-run; every CREATE is `IF NOT EXISTS`-guarded.
--
-- NOTE ON PRE-EXISTING SANDBOXES: a sandbox created before 23-09-26 holds the OLD hand-built
-- shapes, and `IF NOT EXISTS` will leave them alone. Drop the database once and re-apply.
-- ============================================================================================

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'erp_fixture')
BEGIN
    CREATE DATABASE erp_fixture;
END
GO

USE erp_fixture;
GO

-- dbo.InventoryItem — 102 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryItem'
)
BEGIN
    CREATE TABLE dbo.InventoryItem (
        Roworder             INT           NOT NULL,
        ItemCode             NVARCHAR(50)  NOT NULL,
        ItemGRP              NVARCHAR(10)  NULL,
        Runno                INT           NULL,
        Dept                 NVARCHAR(10)  NULL,
        AssetOrItem          NVARCHAR(20)  NULL,
        ItemName             NVARCHAR(200) NULL,
        Description          NVARCHAR(200) NULL,
        ItemNameEng          NVARCHAR(200) NULL,
        CustRefCode          NVARCHAR(50)  NULL,
        PartCode_OLD         NVARCHAR(50)  NULL,
        PartName_OLD         NVARCHAR(200) NULL,
        IsActive             TINYINT       NULL,
        IsStock              TINYINT       NULL,
        IsRevised            TINYINT       NULL,
        ItemType             NVARCHAR(10)  NULL,
        ItemTypename         NVARCHAR(80)  NULL,
        ItemUsedAs           TINYINT       NULL,
        IsSource             NVARCHAR(3)   NULL,
        IsWIP                TINYINT       NULL,
        ItemStatus           NVARCHAR(50)  NULL,
        ForItemCode          NVARCHAR(50)  NULL,
        ForItemName          NVARCHAR(150) NULL,
        BalStock             MONEY         NULL,
        PendingQTY           MONEY         NULL,
        Shelf                NVARCHAR(50)  NULL,
        ItemProcess          NVARCHAR(35)  NULL,
        CATEGORY             NVARCHAR(50)  NULL,
        BASEMODEL            NVARCHAR(80)  NULL,
        ItemPROJECT          NVARCHAR(50)  NULL,
        MATERIAL             NVARCHAR(80)  NULL,
        THICKNESS            NVARCHAR(50)  NULL,
        WEIGHT               MONEY         NULL,
        Lenght               NUMERIC(18,2) NULL,
        TYPE                 NVARCHAR(50)  NULL,
        SECTIONTYPE          NVARCHAR(50)  NULL,
        MainUnits            NVARCHAR(10)  NULL,
        PackUnits            NVARCHAR(10)  NULL,
        PartMoldNo           NVARCHAR(50)  NULL,
        PartMoldName         NVARCHAR(150) NULL,
        ColorPattern         NVARCHAR(50)  NULL,
        QCJUDGMENT           NVARCHAR(50)  NULL,
        QTYPR                MONEY         NULL,
        QTYPO                MONEY         NULL,
        MinStock             DECIMAL(18,2) NULL,
        MaxStock             DECIMAL(18,2) NULL,
        MOQ                  DECIMAL(18,2) NULL,
        PackPerCarton        DECIMAL(18,2) NULL,
        LastPurDate          DATETIME      NULL,
        LastPurPrice         MONEY         NULL,
        LastPurDis           MONEY         NULL,
        Popen                MONEY         NULL,
        LastSaledate         DATETIME      NULL,
        LastSalePrice        MONEY         NULL,
        LastSaleDis          MONEY         NULL,
        SoPen                MONEY         NULL,
        ConvertRate          DECIMAL(18,2) NULL,
        EngRemark            NVARCHAR(200) NULL,
        ProDuctORG           NVARCHAR(50)  NULL,
        PurchaseDebitAccount NVARCHAR(20)  NULL,
        SalesCreditAccount   NVARCHAR(20)  NULL,
        CostofSaleAccount    NVARCHAR(20)  NULL,
        PeriodBeginAccount   NVARCHAR(20)  NULL,
        PeriodEndAccount     NVARCHAR(20)  NULL,
        Depreciationaccount  NVARCHAR(20)  NULL,
        M3                   DECIMAL(18,4) NULL,
        NW                   DECIMAL(18,4) NULL,
        GW                   DECIMAL(18,4) NULL,
        LotNumber            NVARCHAR(50)  NULL,
        Grade                NVARCHAR(5)   NULL,
        PurchaseDate         DATETIME      NULL,
        PurchaseValue        MONEY         NULL,
        DefaultPrice         MONEY         NULL,
        InspecLevel          NVARCHAR(20)  NULL,
        AcceptLevel          NUMERIC(18,2) NULL,
        RatioAQL             NVARCHAR(20)  NULL,
        ToleanceRange        NVARCHAR(20)  NULL,
        ToleanceRatio        NUMERIC(18,2) NULL,
        InspecDept           NVARCHAR(50)  NULL,
        PartTYPE             TINYINT       NULL,
        Stdtime              NVARCHAR(10)  NULL,
        Leadtime             DECIMAL(18,2) NULL,
        ItemVat              NVARCHAR(15)  NULL,
        CostType             NVARCHAR(15)  NULL,
        IsService            TINYINT       NULL,
        PictureName          NVARCHAR(150) NULL,
        DrawingName          NVARCHAR(150) NULL,
        Saleprice1           MONEY         NULL,
        Saleprice2           MONEY         NULL,
        Saleprice3           MONEY         NULL,
        Saleprice4           MONEY         NULL,
        Saleprice5           MONEY         NULL,
        ispursale            TINYINT       NULL,
        StdRM                DECIMAL(18,2) NULL,
        StdLB                DECIMAL(18,2) NULL,
        StdOH                DECIMAL(18,2) NULL,
        StdCOST              DECIMAL(18,2) NULL,
        BarCodePack          NVARCHAR(50)  NULL,
        BarCodeUnits         NVARCHAR(50)  NULL,
        EntryBy              NVARCHAR(30)  NULL,
        EntryDate            DATETIME      NULL,
        TransNum             INT           NULL,
        CONSTRAINT PK_InventoryItem PRIMARY KEY (Roworder, ItemCode)
    );
END
GO

-- dbo.tbl_DOhdr — 51 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_DOhdr'
)
BEGIN
    CREATE TABLE dbo.tbl_DOhdr (
        RowOrder            INT           NOT NULL,
        TransactionNo       INT           NOT NULL,
        DoNo                NVARCHAR(20)  NULL,
        Dodate              DATETIME      NULL,
        IsApproved          TINYINT       NULL,
        IsApprovedBy        NVARCHAR(20)  NULL,
        IsApprovedDate      DATETIME      NULL,
        IsClosed            TINYINT       NULL,
        IsClosedBy          NVARCHAR(20)  NULL,
        IsClosedDate        DATETIME      NULL,
        IsComplete          TINYINT       NULL,
        IsCompleteBy        NVARCHAR(20)  NULL,
        IsCompleteDate      DATETIME      NULL,
        IsCheck             TINYINT       NULL,
        IsCheckBy           NVARCHAR(20)  NULL,
        IsCheckDate         DATETIME      NULL,
        IsAcc               TINYINT       NULL,
        IsAccBy             NVARCHAR(20)  NULL,
        IsAccDate           DATETIME      NULL,
        Revised             TINYINT       NULL,
        DoType              NVARCHAR(50)  NULL,
        DeliveryDate        DATETIME      NULL,
        CustomerPo          NVARCHAR(50)  NULL,
        CarNumber           NVARCHAR(50)  NULL,
        CustCode            NVARCHAR(20)  NULL,
        CustName            NVARCHAR(100) NULL,
        BillingAddress      NVARCHAR(200) NULL,
        ShippingAddress     NVARCHAR(200) NULL,
        DlvCode             NCHAR(10)     NULL,
        RemarkS             NVARCHAR(100) NULL,
        AttachPict          NVARCHAR(250) NULL,
        ApprBy              NVARCHAR(20)  NULL,
        GenOSL              TINYINT       NULL,
        OsLno               NVARCHAR(20)  NULL,
        DocuNw              NVARCHAR(20)  NULL,
        SalesInvoiceNo      NVARCHAR(20)  NULL,
        SalesInvoiceTrNo    INT           NULL,
        SalesInvoiceDate    DATETIME      NULL,
        VatType             TINYINT       NULL,
        EntryBy             NVARCHAR(20)  NULL,
        EntryDate           DATETIME      NULL,
        TotalAmount         DECIMAL(18,2) NULL,
        Discount            DECIMAL(18,2) NULL,
        DiscountAmount      DECIMAL(18,2) NULL,
        TotalDiscountAmount DECIMAL(18,2) NULL,
        AdvancePay          DECIMAL(18,2) NULL,
        VAT                 DECIMAL(18,2) NULL,
        VATAmount           DECIMAL(18,2) NULL,
        TotalActualAmount   DECIMAL(18,2) NULL,
        Paymentinday        NVARCHAR(10)  NULL,
        DueDate             DATETIME      NULL,
        CONSTRAINT PK_tbl_DOhdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.tbl_Dodtl — 25 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_Dodtl'
)
BEGIN
    CREATE TABLE dbo.tbl_Dodtl (
        RowOrder        INT           NOT NULL,
        TransactionNo   INT           NOT NULL,
        Slno            NUMERIC(18,0) NOT NULL,
        Itemcode        NVARCHAR(50)  NULL,
        Description     NVARCHAR(180) NULL,
        ItemModel       NVARCHAR(180) NULL,
        PartNoCust      NVARCHAR(50)  NULL,
        PartNameCust    NVARCHAR(150) NULL,
        DescCust        NVARCHAR(150) NULL,
        SoNo            NVARCHAR(20)  NULL,
        SOTrNo          NUMERIC(18,0) NULL,
        SOline          NUMERIC(18,0) NULL,
        SOstock         NVARCHAR(20)  NULL,
        PoCust          NVARCHAR(50)  NULL,
        DeliveryDueDate DATETIME      NULL,
        Qty             NUMERIC(18,2) NULL,
        Nw              REAL          NULL,
        TotalNw         REAL          NULL,
        Saleprice       MONEY         NULL,
        Units           NVARCHAR(10)  NULL,
        IncludeVat      TINYINT       NULL,
        Warehouse       NVARCHAR(30)  NULL,
        DiscountPercent NUMERIC(18,2) NULL,
        DiscountAmount  NUMERIC(18,2) NULL,
        Amount          NUMERIC(18,2) NULL,
        CONSTRAINT PK_tbl_Dodtl PRIMARY KEY (TransactionNo, Slno)
    );
END
GO

-- dbo.SalesInvoiceHdr — 151 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'SalesInvoiceHdr'
)
BEGIN
    CREATE TABLE dbo.SalesInvoiceHdr (
        RowOrder                   INT           NOT NULL,
        TransactionNo              DECIMAL(18,0) NOT NULL,
        InvoiceType                NVARCHAR(10)  NULL,
        SaleType                   NVARCHAR(10)  NULL,
        ItemType                   NVARCHAR(20)  NULL,
        TransactionTypeI           TINYINT       NULL,
        TransactionTypeT           TINYINT       NULL,
        CompanyCode                NVARCHAR(10)  NULL,
        DeptCode                   NVARCHAR(20)  NULL,
        Department                 NVARCHAR(50)  NULL,
        VoucherNo                  NVARCHAR(20)  NULL,
        VoucherDate                DATETIME      NULL,
        DocuType                   NVARCHAR(10)  NOT NULL,
        CustomDate                 DATETIME      NULL,
        CustOrSuppCode             NVARCHAR(15)  NULL,
        CustOrSuppName             NVARCHAR(100) NULL,
        Address                    NVARCHAR(MAX) NULL,
        DeliveryAddress            NVARCHAR(MAX) NULL,
        DueDate                    DATETIME      NULL,
        Paymentinday               NVARCHAR(10)  NULL,
        CreditLimit                MONEY         NULL,
        AccountCode                NVARCHAR(20)  NULL,
        IsVAT                      TINYINT       NULL,
        IsClosed                   TINYINT       NULL,
        IsPaid                     TINYINT       NULL,
        Agent                      NVARCHAR(20)  NULL,
        AgentCommission            MONEY         NULL,
        AgentComAmount             MONEY         NULL,
        SalePerson                 NVARCHAR(20)  NULL,
        SaleName                   NVARCHAR(50)  NULL,
        SaleCommission             MONEY         NULL,
        SaleComAmount              MONEY         NULL,
        IsAutoStock                TINYINT       NULL,
        Warehouse                  NVARCHAR(30)  NULL,
        FlowNo                     NVARCHAR(20)  NULL,
        FlowTrNo                   DECIMAL(18,0) NULL,
        DocumentType               NVARCHAR(20)  NULL,
        TransportDocNo             NVARCHAR(20)  NULL,
        TransportDocDate           DATETIME      NULL,
        PackingListNo              NVARCHAR(20)  NULL,
        PackingListTrNo            DECIMAL(18,0) NULL,
        Currency                   NVARCHAR(20)  NULL,
        ExchangeRate               DECIMAL(18,4) NULL,
        TermsofPayment             NVARCHAR(200) NULL,
        AccountsDescription        NVARCHAR(100) NULL,
        Invoiceof                  NVARCHAR(50)  NULL,
        Shipper                    NVARCHAR(20)  NULL,
        ShipperName                NVARCHAR(100) NULL,
        ShipperAddress             NVARCHAR(MAX) NULL,
        Consignee                  NVARCHAR(200) NULL,
        BookingNo                  NVARCHAR(50)  NULL,
        ContainerNo                NVARCHAR(50)  NULL,
        FeederPlaceofReceipt       NVARCHAR(30)  NULL,
        VesselFlight               NVARCHAR(30)  NULL,
        VesselFlightVoyNo          NVARCHAR(30)  NULL,
        VesselFlightPortofLoading  NVARCHAR(30)  NULL,
        Sailingonorabout           DATETIME      NULL,
        InvoiceFrom                NVARCHAR(30)  NULL,
        InvoiceTo                  NVARCHAR(30)  NULL,
        TermsandCondition          NVARCHAR(150) NULL,
        TotalPackage               NVARCHAR(50)  NULL,
        CaseMarks                  NVARCHAR(MAX) NULL,
        PriceTerms                 NVARCHAR(10)  NULL,
        PriceTermsFrom             NVARCHAR(50)  NULL,
        InsuranceCharge            MONEY         NULL,
        FreightCharge              MONEY         NULL,
        DocCharge                  MONEY         NULL,
        ClaimText                  NVARCHAR(30)  NULL,
        ClaimValue                 MONEY         NULL,
        SampleText                 NVARCHAR(30)  NULL,
        SampleValue                MONEY         NULL,
        TotalCountry               NVARCHAR(30)  NULL,
        ChargeAccount              NVARCHAR(20)  NULL,
        TotalAmount                DECIMAL(18,2) NULL,
        AdditionalCharge           NVARCHAR(30)  NULL,
        AdditionalChargeAmount     MONEY         NULL,
        ChargeOrDiscountAccount    NVARCHAR(20)  NULL,
        DiscountPercent            REAL          NULL,
        DiscountAmount             DECIMAL(18,2) NULL,
        DiscountDescription        NVARCHAR(100) NULL,
        DiscountJnl                DECIMAL(18,0) NULL,
        SubTotalAmnt               DECIMAL(18,2) NULL,
        DepositAmount              DECIMAL(18,2) NULL,
        VATForValue                DECIMAL(18,2) NULL,
        VATPercent                 REAL          NULL,
        VATAmount                  DECIMAL(18,2) NULL,
        VATJnl                     DECIMAL(18,0) NULL,
        AmountDue                  DECIMAL(18,2) NULL,
        AmountDueBht               DECIMAL(18,2) NULL,
        TotalMainQty               REAL          NULL,
        TotalSecondQty             REAL          NULL,
        ARAPJnl                    DECIMAL(18,0) NULL,
        ReceiptPaymentAmt          DECIMAL(18,2) NULL,
        ReceiptPaymentAmtBht       DECIMAL(18,2) NULL,
        ReceiptPaymentAmtBefore    DECIMAL(18,2) NULL,
        ReceiptPaymentAmtBhtBefore DECIMAL(18,2) NULL,
        ReferenceNo                NVARCHAR(50)  NULL,
        Remarks                    NVARCHAR(MAX) NULL,
        CountryofOrigin            NVARCHAR(30)  NULL,
        SalesZone                  NVARCHAR(30)  NULL,
        TotalCartons               DECIMAL(18,2) NULL,
        TotalPerMainUnit           DECIMAL(18,2) NULL,
        TotalNW                    DECIMAL(18,4) NULL,
        TotalGW                    DECIMAL(18,4) NULL,
        TotalCUM                   DECIMAL(18,4) NULL,
        NoticeDone                 TINYINT       NULL,
        NoticeDate                 DATETIME      NULL,
        NoticeNumber               NVARCHAR(30)  NULL,
        ChequeDate                 DATETIME      NULL,
        IsActual                   TINYINT       NULL,
        IsBank                     TINYINT       NULL,
        IsCustom                   TINYINT       NULL,
        TotalCQ                    DECIMAL(18,2) NULL,
        TotalTF                    DECIMAL(18,2) NULL,
        TotalREC                   DECIMAL(18,2) NULL,
        OthExp                     DECIMAL(18,2) NULL,
        Interest                   DECIMAL(18,2) NULL,
        BankFree                   DECIMAL(18,2) NULL,
        TotalDR                    DECIMAL(18,2) NULL,
        CashValue                  DECIMAL(18,2) NULL,
        OthRec                     DECIMAL(18,2) NULL,
        TaxAccount                 NVARCHAR(20)  NULL,
        TaxPercen                  DECIMAL(18,2) NULL,
        WithHoldValue              DECIMAL(18,2) NULL,
        CqValue                    DECIMAL(18,2) NULL,
        TransFerValue              DECIMAL(18,2) NULL,
        TotalCR                    DECIMAL(18,2) NULL,
        IsUndueVAT                 TINYINT       NULL,
        AttachFile                 NVARCHAR(100) NULL,
        SoNo                       NVARCHAR(20)  NULL,
        CustPoNo                   NVARCHAR(50)  NULL,
        CustPoDate                 DATETIME      NULL,
        CheckRate                  TINYINT       NULL,
        Rate                       REAL          NULL,
        Specification              NVARCHAR(50)  NULL,
        ShippedBy                  NVARCHAR(50)  NULL,
        ShippedFrom                NVARCHAR(50)  NULL,
        ShippedTo                  NVARCHAR(50)  NULL,
        ShipTo                     NVARCHAR(50)  NULL,
        PerMss                     NVARCHAR(50)  NULL,
        PerMssTo                   NVARCHAR(50)  NULL,
        FOBtext                    NVARCHAR(50)  NULL,
        IsApproved                 TINYINT       NULL,
        IsApprovedBy               NVARCHAR(30)  NULL,
        IsApprovedDate             DATETIME      NULL,
        BranchCode                 NVARCHAR(10)  NULL,
        BranchName                 NVARCHAR(50)  NULL,
        PoNo                       NVARCHAR(50)  NULL,
        IVStatus                   NVARCHAR(50)  NULL,
        EntryBy                    NVARCHAR(30)  NULL,
        EntryDate                  DATETIME      NULL,
        CONSTRAINT PK_SalesInvoiceHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.SalesInvoiceDtl — 58 columns. Column NAMES/ORDER are a verified live `sys.columns` read
-- (23-09-26); TYPES/NULLABILITY are inferred from sibling live tables — see this manifest's
-- `partialCaptureNotes`. Generated from the manifest, never hand-edited.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'SalesInvoiceDtl'
)
BEGIN
    CREATE TABLE dbo.SalesInvoiceDtl (
        RowOrder         INT            NOT NULL,
        TransactionNo    DECIMAL(18,0)  NOT NULL,
        ItemOrder        INT            NULL,
        ItemCode         NVARCHAR(50)   NULL,
        ItemSubCode      NVARCHAR(50)   NULL,
        Description      NVARCHAR(100)  NULL,
        MainQuantity     DECIMAL(18,2)  NULL,
        MainUnits        NVARCHAR(20)   NULL,
        ConvertRate      DECIMAL(18,4)  NULL,
        SecondQuantity   DECIMAL(18,2)  NULL,
        SecondUnits      NVARCHAR(20)   NULL,
        SourceType       NVARCHAR(20)   NULL,
        OrderNo          NVARCHAR(20)   NULL,
        OrderTrNo        DECIMAL(18,0)  NULL,
        CustPONo         NVARCHAR(50)   NULL,
        ItemType         NVARCHAR(20)   NULL,
        Material         NVARCHAR(80)   NULL,
        ItemRefCode      NVARCHAR(50)   NULL,
        AccountCode      NVARCHAR(20)   NULL,
        AccountName      NVARCHAR(100)  NULL,
        CustOrSuppCode   NVARCHAR(15)   NULL,
        OEMNo            NVARCHAR(30)   NULL,
        OTNNo            NVARCHAR(30)   NULL,
        Model            NVARCHAR(30)   NULL,
        Year             NVARCHAR(20)   NULL,
        Currency         NVARCHAR(20)   NULL,
        UnitPrice        DECIMAL(18,4)  NULL,
        DiscountPercent  DECIMAL(18,2)  NULL,
        DiscountAmount   DECIMAL(18,2)  NULL,
        Amount           DECIMAL(18,2)  NULL,
        AmountBaht       DECIMAL(18,2)  NULL,
        QtyCnt           DECIMAL(18,2)  NULL,
        Carton           DECIMAL(18,2)  NULL,
        NW               DECIMAL(18,4)  NULL,
        GW               DECIMAL(18,4)  NULL,
        Cum              DECIMAL(18,4)  NULL,
        CumTTL           DECIMAL(18,4)  NULL,
        TotalNw          DECIMAL(18,4)  NULL,
        TotalGw          DECIMAL(18,4)  NULL,
        InventoryJnl     NVARCHAR(20)   NULL,
        RevenueJnl       NVARCHAR(20)   NULL,
        CostOfSaleJnl    NVARCHAR(20)   NULL,
        ForItemCode      NVARCHAR(50)   NULL,
        ReturnQty        DECIMAL(18,2)  NULL,
        IsPrintActual    TINYINT        NULL,
        IsPrintBank      TINYINT        NULL,
        IsPrintCustom    TINYINT        NULL,
        Notes            NVARCHAR(MAX)  NULL,
        SecondUnitPrice  DECIMAL(18,4)  NULL,
        OurCode          NVARCHAR(50)   NULL,
        FlowNo           NVARCHAR(20)   NULL,
        FlowTrNo         DECIMAL(18,0)  NULL,
        JobNo            NVARCHAR(20)   NULL,
        JobTrNo          DECIMAL(18,0)  NULL,
        MAI_REPORT       NVARCHAR(50)   NULL,
        PackingNo        NVARCHAR(20)   NULL,
        PackingTrNo      DECIMAL(18,0)  NULL,
        NoRatePrice      TINYINT        NULL,
        CONSTRAINT PK_SalesInvoiceDtl PRIMARY KEY (RowOrder)
    );
END
GO

-- dbo.PurchaseOrderHdr — 122 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'PurchaseOrderHdr'
)
BEGIN
    CREATE TABLE dbo.PurchaseOrderHdr (
        RowOrder             INT           NOT NULL,
        TransactionNo        DECIMAL(18,0) NOT NULL,
        TransactionType      TINYINT       NULL,
        IsClosed             TINYINT       NULL,
        CloseNote            NVARCHAR(100) NULL,
        IsAutoUse            TINYINT       NULL,
        FlowNo               NVARCHAR(20)  NULL,
        FlowTrNo             DECIMAL(18,0) NULL,
        IsReviewed           TINYINT       NULL,
        IsThisPeriod         TINYINT       NULL,
        PurchaseType         NVARCHAR(20)  NULL,
        IsPurchase           TINYINT       NULL,
        Revised              TINYINT       NULL,
        AssetFor             NVARCHAR(20)  NULL,
        CompanyCode          NVARCHAR(10)  NULL,
        Department           NVARCHAR(50)  NULL,
        PONumber             NVARCHAR(20)  NULL,
        PODate               DATETIME      NULL,
        QuotationNo          NVARCHAR(20)  NULL,
        SupplierCode         NVARCHAR(20)  NULL,
        SupplierName         NVARCHAR(100) NULL,
        SupplierAddress      NVARCHAR(MAX) NULL,
        DeliveryAddress      NVARCHAR(MAX) NULL,
        SelectAddr           NVARCHAR(20)  NULL,
        ContaxName           NVARCHAR(200) NULL,
        PaymentTerm          NVARCHAR(30)  NULL,
        PriceTerm            NVARCHAR(30)  NULL,
        PaymentInDays        NVARCHAR(10)  NULL,
        Currency             NVARCHAR(20)  NULL,
        ExchangeRate         DECIMAL(18,4) NULL,
        VatType              INT           NULL,
        Total                MONEY         NULL,
        DiscountPercent      REAL          NULL,
        DiscountAmount       MONEY         NULL,
        SubTotal             MONEY         NULL,
        VatBeforValue        MONEY         NULL,
        VATPercent           REAL          NULL,
        VATAmount            MONEY         NULL,
        TotalAmount          MONEY         NULL,
        DueDateHdr           DATETIME      NULL,
        PriceFrom            NVARCHAR(50)  NULL,
        Invoiceof            NVARCHAR(50)  NULL,
        AdditionCharge       NVARCHAR(50)  NULL,
        AdditionChargeAmount MONEY         NULL,
        IsIncludeVAT         TINYINT       NULL,
        IsPO                 TINYINT       NULL,
        IsInternal           TINYINT       NULL,
        StartedDate          DATETIME      NULL,
        StartedNote          NVARCHAR(50)  NULL,
        CompletedDate        DATETIME      NULL,
        CompletedNote        NVARCHAR(50)  NULL,
        FirstAmendmentDate   DATETIME      NULL,
        SecondAmendmentDate  DATETIME      NULL,
        WOFor                NVARCHAR(10)  NULL,
        MONo                 NVARCHAR(20)  NULL,
        MOTrNo               DECIMAL(18,0) NULL,
        EONo                 NVARCHAR(20)  NULL,
        EOTrNo               DECIMAL(18,0) NULL,
        ProjectNo            NVARCHAR(20)  NULL,
        ProjectTrNo          DECIMAL(18,0) NULL,
        ProblemNo            NVARCHAR(20)  NULL,
        ProblemTrNo          DECIMAL(18,0) NULL,
        RFD                  NVARCHAR(20)  NULL,
        RFDTrNo              DECIMAL(18,0) NULL,
        PreJobNo             NVARCHAR(20)  NULL,
        PreJobTrNo           DECIMAL(18,0) NULL,
        ProcessCode          NVARCHAR(40)  NULL,
        IsMIS                NVARCHAR(10)  NULL,
        Processing           NVARCHAR(50)  NULL,
        MoldInfo             NVARCHAR(50)  NULL,
        QCInfo               NVARCHAR(50)  NULL,
        QCTestScheme         NVARCHAR(50)  NULL,
        ProjectName          NVARCHAR(50)  NULL,
        DeliveryDate         DATETIME      NULL,
        Manager              NVARCHAR(50)  NULL,
        objective            NVARCHAR(50)  NULL,
        gaindescription      NVARCHAR(50)  NULL,
        budget               NVARCHAR(50)  NULL,
        MaterialBudget       MONEY         NULL,
        MachineBudget        MONEY         NULL,
        ToolsBudget          MONEY         NULL,
        LaborBudget          MONEY         NULL,
        StartedDate_Act      DATETIME      NULL,
        CompletedDate_Act    DATETIME      NULL,
        AccountClosed        TINYINT       NULL,
        Apv                  TINYINT       NULL,
        IsExpense            TINYINT       NULL,
        ExpenseValue         DECIMAL(18,2) NULL,
        Remarks              NVARCHAR(MAX) NULL,
        EntryExpenseName     NVARCHAR(50)  NULL,
        EntryExpenseDate     DATETIME      NULL,
        IsApproved           TINYINT       NULL,
        Appr_By              NVARCHAR(30)  NULL,
        Appr_Date            DATETIME      NULL,
        IsCheck              TINYINT       NULL,
        Check_by             NVARCHAR(30)  NULL,
        Check_Date           DATETIME      NULL,
        IsComplete           TINYINT       NULL,
        Complete_By          NVARCHAR(30)  NULL,
        Complete_Date        DATETIME      NULL,
        IsCancel             TINYINT       NULL,
        Cancel_By            NVARCHAR(30)  NULL,
        Cancel_Date          DATETIME      NULL,
        IsRecPo              TINYINT       NULL,
        Recpo_By             NVARCHAR(30)  NULL,
        Recpo_Date           DATETIME      NULL,
        Status               NVARCHAR(50)  NULL,
        MonthClosed          NVARCHAR(50)  NULL,
        Poautoclosed         NVARCHAR(50)  NULL,
        Poautodate           DATETIME      NULL,
        Revision             NVARCHAR(5)   NULL,
        IsContract           TINYINT       NULL,
        AttachFile           NVARCHAR(250) NULL,
        AttachFile1          NVARCHAR(250) NULL,
        AttachFile2          NVARCHAR(250) NULL,
        AttachFile3          NVARCHAR(250) NULL,
        TypeOfPR             NVARCHAR(20)  NULL,
        TotalFOB             DECIMAL(18,2) NULL,
        FreightCharge        DECIMAL(18,2) NULL,
        InsuranceCharge      DECIMAL(18,2) NULL,
        EntryBy              NVARCHAR(20)  NULL,
        EntryDate            DATETIME      NULL,
        CONSTRAINT PK_PurchaseOrderHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.PurchaseOrderDtl — 49 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'PurchaseOrderDtl'
)
BEGIN
    CREATE TABLE dbo.PurchaseOrderDtl (
        RowOrder           INT           NOT NULL,
        TransactionNo      DECIMAL(18,0) NOT NULL,
        Number             SMALLINT      NOT NULL,
        ItemCode           NVARCHAR(50)  NULL,
        ItemSubCode        NVARCHAR(50)  NULL,
        Description        NVARCHAR(100) NULL,
        OEMNo              NVARCHAR(30)  NULL,
        Model              NVARCHAR(30)  NULL,
        OrderType          NVARCHAR(15)  NULL,
        PrSLno             INT           NULL,
        PRNo               NVARCHAR(20)  NULL,
        PRTrNo             DECIMAL(18,0) NULL,
        ProcessCode        NVARCHAR(35)  NULL,
        DueDate            DATETIME      NULL,
        MainQuantity       DECIMAL(18,2) NULL,
        MainUnits          NVARCHAR(20)  NULL,
        ConvertRate        DECIMAL(18,4) NULL,
        SecondQuantity     DECIMAL(18,2) NULL,
        SecondUnits        NVARCHAR(20)  NULL,
        MainUnitPrice      DECIMAL(18,4) NULL,
        SecondUnitPrice    DECIMAL(18,4) NULL,
        DiscountPercent    DECIMAL(18,2) NULL,
        DiscountAmount     DECIMAL(18,2) NULL,
        TotalPrice         DECIMAL(18,2) NULL,
        ActualQty          REAL          NULL,
        Notes              NVARCHAR(MAX) NULL,
        Notes2             NVARCHAR(MAX) NULL,
        DiNo               NVARCHAR(20)  NULL,
        DiTrNo             NUMERIC(18,0) NULL,
        QtyReceive         REAL          NULL,
        InvoiceQty         REAL          NULL,
        ItemYear           NVARCHAR(10)  NULL,
        UnitPriceWithVAT   MONEY         NULL,
        SecondPriceWithVAT MONEY         NULL,
        AmountWithVAT      MONEY         NULL,
        ExpectedDamage     REAL          NULL,
        OldPurchasePrice   MONEY         NULL,
        FactoryNo          NVARCHAR(50)  NULL,
        popno              NVARCHAR(15)  NULL,
        MinPrice           MONEY         NULL,
        ReasonBuy          NVARCHAR(MAX) NULL,
        LastPrice          MONEY         NULL,
        MONo               NVARCHAR(20)  NULL,
        Cycletime          DECIMAL(18,2) NULL,
        Cavity             INT           NULL,
        FlagRed            TINYINT       NULL,
        FlagSale           TINYINT       NULL,
        LstPurPrice        DECIMAL(18,2) NULL,
        RemarkDTL          NVARCHAR(200) NULL,
        CONSTRAINT PK_PurchaseOrderDtl PRIMARY KEY (TransactionNo, Number)
    );
END
GO

-- dbo.PurchaseInvoiceHdr — 101 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'PurchaseInvoiceHdr'
)
BEGIN
    CREATE TABLE dbo.PurchaseInvoiceHdr (
        Roworder                   INT           NOT NULL,
        TransactionNo              DECIMAL(18,0) NOT NULL,
        InvoiceType                NVARCHAR(20)  NULL,
        PurchaseType               NVARCHAR(20)  NULL,
        ItemType                   NVARCHAR(20)  NULL,
        TransactionType            TINYINT       NULL,
        CompanyCode                NVARCHAR(10)  NULL,
        DeptCode                   NVARCHAR(10)  NULL,
        Department                 NVARCHAR(50)  NULL,
        VoucherNo                  NVARCHAR(20)  NULL,
        VoucherDate                DATETIME      NULL,
        PvNo                       NVARCHAR(20)  NULL,
        PvDate                     DATETIME      NULL,
        DocuType                   NVARCHAR(10)  NULL,
        CustOrSuppCode             NVARCHAR(20)  NULL,
        CustOrSuppName             NVARCHAR(100) NULL,
        Address                    NVARCHAR(MAX) NULL,
        DueDate                    DATETIME      NULL,
        AccountCode                NVARCHAR(20)  NULL,
        Currency                   NVARCHAR(20)  NULL,
        ExchangeRate               DECIMAL(18,4) NULL,
        VatType                    TINYINT       NULL,
        IsFreeVAT                  TINYINT       NULL,
        IsClosed                   TINYINT       NULL,
        IsPaid                     TINYINT       NULL,
        IsUndueVAT                 TINYINT       NULL,
        IsIncludeVAT               TINYINT       NULL,
        ActualInvoiceNo            NVARCHAR(50)  NULL,
        ActualInvoiceDate          DATETIME      NULL,
        IsAutoStock                TINYINT       NULL,
        Warehouse                  NVARCHAR(20)  NULL,
        FlowNo                     NVARCHAR(20)  NULL,
        FlowTrNo                   DECIMAL(18,0) NULL,
        TermsofPayment             NUMERIC(18,0) NULL,
        AccountsDescription        NVARCHAR(100) NULL,
        DeliveryAddress            NVARCHAR(200) NULL,
        TotalAmount                MONEY         NULL,
        ChargeOrDiscountAccount    NVARCHAR(20)  NULL,
        DiscountPercent            REAL          NULL,
        DiscountAmount             DECIMAL(18,2) NULL,
        DiscountDescription        NVARCHAR(100) NULL,
        DiscountJnl                DECIMAL(18,0) NULL,
        DepositAmount              DECIMAL(18,2) NULL,
        ValueForVAT                DECIMAL(18,2) NULL,
        ValueForUndueVAT           DECIMAL(18,2) NULL,
        VATPercent                 REAL          NULL,
        VATAmount                  DECIMAL(18,2) NULL,
        UndueVATAmount             DECIMAL(18,2) NULL,
        VATJnl                     DECIMAL(18,0) NULL,
        AmountDue                  DECIMAL(18,2) NULL,
        AmountDueBht               DECIMAL(18,2) NULL,
        TotalDuty                  DECIMAL(18,2) NULL,
        TotalCIFBht                DECIMAL(18,2) NULL,
        TotalMainQty               DECIMAL(18,2) NULL,
        TotalSecondQty             DECIMAL(18,2) NULL,
        ARAPJnl                    DECIMAL(18,0) NULL,
        ReceiptPaymentAmt          DECIMAL(18,2) NULL,
        ReceiptPaymentAmtBht       DECIMAL(18,2) NULL,
        ReceiptPaymentAmtBefore    DECIMAL(18,2) NULL,
        ReceiptPaymentAmtBhtBefore DECIMAL(18,2) NULL,
        NoticeDone                 TINYINT       NULL,
        NoticeDate                 DATETIME      NULL,
        NoticeNumber               NVARCHAR(20)  NULL,
        ChequeDate                 DATETIME      NULL,
        AdditionalCharge           DECIMAL(18,2) NULL,
        AdditionalChargeAmount     DECIMAL(18,2) NULL,
        RefAccount                 NVARCHAR(20)  NULL,
        PriceTerms                 NVARCHAR(3)   NULL,
        PriceTermsFrom             NVARCHAR(50)  NULL,
        ImportDuty                 DECIMAL(18,2) NULL,
        InsuranceCharge            DECIMAL(18,2) NULL,
        FreightCharge              DECIMAL(18,2) NULL,
        InsuranceChargeAccount     NVARCHAR(20)  NULL,
        FreightChargeAccount       NVARCHAR(20)  NULL,
        VatPaymentAccount          NVARCHAR(20)  NULL,
        DutyAccount                NVARCHAR(20)  NULL,
        ShippingForInvoice         DECIMAL(18,0) NULL,
        ShippingCode               NVARCHAR(20)  NULL,
        Remarks                    NVARCHAR(200) NULL,
        TotalCQ                    DECIMAL(18,2) NULL,
        TotalTF                    DECIMAL(18,2) NULL,
        TotalPAY                   DECIMAL(18,2) NULL,
        OthExp                     DECIMAL(18,2) NULL,
        BankFree                   DECIMAL(18,2) NULL,
        Interest                   DECIMAL(18,2) NULL,
        TotalDR                    DECIMAL(18,2) NULL,
        CashValue                  DECIMAL(18,2) NULL,
        OthRec                     DECIMAL(18,2) NULL,
        DisReceive                 DECIMAL(18,2) NULL,
        Gpexchange                 DECIMAL(18,2) NULL,
        TaxAccount                 NVARCHAR(20)  NULL,
        TaxPercen                  DECIMAL(18,2) NULL,
        WithHoldValue              DECIMAL(18,2) NULL,
        CqValue                    DECIMAL(18,2) NULL,
        TransFerValue              DECIMAL(18,2) NULL,
        TotalCR                    DECIMAL(18,2) NULL,
        AttachFile                 NVARCHAR(100) NULL,
        BranchCode                 NVARCHAR(10)  NULL,
        BranchName                 NVARCHAR(50)  NULL,
        EntryBy                    NVARCHAR(20)  NULL,
        EntryDate                  DATETIME      NULL,
        CONSTRAINT PK_PurchaseInvoiceHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.InventoryFlowHdr — 75 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryFlowHdr'
)
BEGIN
    CREATE TABLE dbo.InventoryFlowHdr (
        Roworder            INT           NOT NULL,
        TransactionNo       INT           NOT NULL,
        IsStock             TINYINT       NOT NULL,
        TransactionType     TINYINT       NULL,
        Approved            TINYINT       NULL,
        ApprovedBy          NVARCHAR(20)  NULL,
        ApprovedDate        DATETIME      NULL,
        IsAssetForm         TINYINT       NULL,
        AssetOrItem         NVARCHAR(20)  NULL,
        IsClosed            TINYINT       NULL,
        IsClosedBy          NVARCHAR(20)  NULL,
        IsClosedDate        DATETIME      NULL,
        IsAutoUse           TINYINT       NULL,
        IncludeVat          TINYINT       NULL,
        InOutDate           DATETIME      NULL,
        InOut               SMALLINT      NULL,
        ReasonIndex         TINYINT       NULL,
        ReasonName          NVARCHAR(50)  NULL,
        CompanyCode         NVARCHAR(50)  NULL,
        DeptCode            NVARCHAR(10)  NULL,
        Department          NVARCHAR(50)  NULL,
        Warehouse           NVARCHAR(30)  NULL,
        WhName              NVARCHAR(50)  NULL,
        VoucherNo           NVARCHAR(20)  NULL,
        SalesInvoiceTrNo    DECIMAL(18,0) NULL,
        SalesInvoiceNo      NVARCHAR(20)  NULL,
        SalesInvoiceDate    DATETIME      NULL,
        Currency            NVARCHAR(20)  NULL,
        ExchangeRate        DECIMAL(18,4) NULL,
        PurchaseType        NVARCHAR(50)  NULL,
        PurINVNo            NVARCHAR(50)  NULL,
        PurINVDate          DATETIME      NULL,
        SalesReturnTrNo     DECIMAL(18,0) NULL,
        SalesReturnNo       NVARCHAR(20)  NULL,
        SalesReturnDate     DATETIME      NULL,
        CustOrSupCode       NVARCHAR(20)  NULL,
        CustOrSupName       NVARCHAR(180) NULL,
        CustOrSupAddress    NVARCHAR(MAX) NULL,
        PurchaseInvoiceTrNo DECIMAL(18,0) NULL,
        PurchaseInvoiceNo   NVARCHAR(20)  NULL,
        PurchaseInvoiceDate DATETIME      NULL,
        ImportNo            NVARCHAR(20)  NULL,
        ImportDate          DATETIME      NULL,
        PurchaseReturnTrNo  DECIMAL(18,0) NULL,
        PurchaseReturnNo    NVARCHAR(20)  NULL,
        PurchaseReturnDate  DATETIME      NULL,
        VoucherNoRef        NVARCHAR(20)  NULL,
        VoucherTrNoRef      DECIMAL(18,0) NULL,
        NetValue            MONEY         NULL,
        DiscountPercent     REAL          NULL,
        DiscountAmount      MONEY         NULL,
        GoodsValue          MONEY         NULL,
        VatType             TINYINT       NULL,
        VATPercent          REAL          NULL,
        VATAmount           MONEY         NULL,
        TotalAmount         MONEY         NULL,
        Remark              NVARCHAR(MAX) NULL,
        Status              NVARCHAR(10)  NULL,
        RequestBy           NVARCHAR(20)  NULL,
        IsCheck             TINYINT       NULL,
        IsCheckBy           NVARCHAR(20)  NULL,
        IsCheckDate         DATETIME      NULL,
        IsApproved          TINYINT       NULL,
        IsApprovedBy        NVARCHAR(20)  NULL,
        IsApprovedDate      DATETIME      NULL,
        IpcCostType         TINYINT       NULL,
        IpcCostCAL          NVARCHAR(50)  NULL,
        IpcCALVALUE         MONEY         NULL,
        ModelNo             NVARCHAR(50)  NULL,
        ModelName           NVARCHAR(150) NULL,
        LotNo               NVARCHAR(50)  NULL,
        LotDate             DATETIME      NULL,
        LotQty              NUMERIC(18,0) NULL,
        EntryBy             NVARCHAR(20)  NULL,
        EntryDate           DATETIME      NULL,
        CONSTRAINT PK_InventoryFlowHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.InventoryFlowDtl — 71 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryFlowDtl'
)
BEGIN
    CREATE TABLE dbo.InventoryFlowDtl (
        RowOrder             INT           NOT NULL,
        TransactionNo        INT           NOT NULL,
        Number               DECIMAL(18,0) NOT NULL,
        TransactionType      TINYINT       NULL,
        IsAssetForm          TINYINT       NULL,
        IsStock              TINYINT       NULL,
        IsClosed             TINYINT       NULL,
        Approved             TINYINT       NULL,
        InOutDate            DATETIME      NULL,
        InOut                SMALLINT      NULL,
        ReasonIndex          TINYINT       NULL,
        ReasonName           NVARCHAR(50)  NULL,
        CompanyCode          NVARCHAR(15)  NULL,
        Warehouse            NVARCHAR(30)  NULL,
        WarehouseIn          NVARCHAR(30)  NULL,
        WhName               NVARCHAR(50)  NULL,
        Department           NVARCHAR(50)  NULL,
        VoucherNo            NVARCHAR(20)  NULL,
        ItemCode             NVARCHAR(50)  NULL,
        Description          NVARCHAR(100) NULL,
        Location             NVARCHAR(50)  NULL,
        SONo                 NVARCHAR(20)  NULL,
        SOTrNo               DECIMAL(18,0) NULL,
        PONo                 NVARCHAR(20)  NULL,
        POTrNo               DECIMAL(18,0) NULL,
        POSlno               DECIMAL(18,0) NULL,
        ForItemCode          NVARCHAR(50)  NULL,
        InputitemCode        NVARCHAR(50)  NULL,
        LotNo                NVARCHAR(50)  NULL,
        OperNum              NUMERIC(10,0) NULL,
        MONo                 NVARCHAR(50)  NULL,
        MOTrNo               DECIMAL(18,0) NULL,
        MOQTY                DECIMAL(18,2) NULL,
        NGQTY                DECIMAL(18,2) NULL,
        ProcessCode          NVARCHAR(25)  NULL,
        MainQuantity         DECIMAL(18,2) NULL,
        MainUnits            NVARCHAR(20)  NULL,
        ConvertRate          DECIMAL(18,2) NULL,
        SecondQuantity       DECIMAL(18,2) NULL,
        SecondUnits          NVARCHAR(20)  NULL,
        UnitPrice            DECIMAL(18,4) NULL,
        SecondUnitPrice      DECIMAL(18,4) NULL,
        TotalPrice           DECIMAL(18,4) NULL,
        UnitPriceBaht        DECIMAL(18,4) NULL,
        SecondUnitPriceBaht  DECIMAL(18,4) NULL,
        DiscountPercen       DECIMAL(18,4) NULL,
        DiscountAmount       DECIMAL(18,4) NULL,
        SecondDiscountAmount DECIMAL(18,4) NULL,
        TotalPriceBaht       DECIMAL(18,4) NULL,
        SecondTotalPrice     DECIMAL(18,4) NULL,
        SecondTotalPriceBaht DECIMAL(18,4) NULL,
        DocType              NVARCHAR(2)   NULL,
        RefVoucherNo         NVARCHAR(20)  NULL,
        RefTrno              DECIMAL(18,0) NULL,
        IMno                 NVARCHAR(20)  NULL,
        IMTrno               DECIMAL(18,0) NULL,
        Reason               NVARCHAR(100) NULL,
        Section              NVARCHAR(20)  NULL,
        BomQty               MONEY         NULL,
        PickQTY              MONEY         NULL,
        BalQTY               MONEY         NULL,
        IssueQTY             MONEY         NULL,
        IssueAccuQTY         MONEY         NULL,
        IssueBy              NVARCHAR(20)  NULL,
        RecQTY               MONEY         NULL,
        RecAccuQTY           MONEY         NULL,
        RecBy                NVARCHAR(20)  NULL,
        RemarkDTL            NVARCHAR(150) NULL,
        UserReq              NVARCHAR(50)  NULL,
        JobNo                NVARCHAR(20)  NULL,
        SNno                 NVARCHAR(150) NULL,
        CONSTRAINT PK_InventoryFlowDtl PRIMARY KEY (TransactionNo, RowOrder)
    );
END
GO

-- dbo.tbl_MoHdr — 36 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_MoHdr'
)
BEGIN
    CREATE TABLE dbo.tbl_MoHdr (
        RowOrder       INT           NOT NULL,
        TransactionNo  INT           NOT NULL,
        MoNumBer       NVARCHAR(20)  NOT NULL,
        Modate         DATETIME      NULL,
        Approved       TINYINT       NULL,
        IsClosed       TINYINT       NULL,
        IsCancel       TINYINT       NULL,
        Motype         NVARCHAR(10)  NULL,
        MoProcessCode  NVARCHAR(20)  NULL,
        MoProcess      NVARCHAR(50)  NULL,
        ProcessCode    NVARCHAR(50)  NULL,
        ProcessName    NVARCHAR(150) NULL,
        MoDuedate      DATETIME      NULL,
        FgCode         NVARCHAR(50)  NULL,
        ModelFg        NVARCHAR(150) NULL,
        SoNo           NVARCHAR(25)  NULL,
        LotNo          NVARCHAR(50)  NULL,
        Lotdate        DATETIME      NULL,
        LotQty         DECIMAL(18,2) NULL,
        OutPutItem     NVARCHAR(50)  NULL,
        OutputItemDesc NVARCHAR(200) NULL,
        Regqty         DECIMAL(18,2) NULL,
        Prodqty        DECIMAL(18,2) NULL,
        ItemUnit       NVARCHAR(20)  NULL,
        CustName       NVARCHAR(150) NULL,
        Remark         NVARCHAR(MAX) NULL,
        RMcost         DECIMAL(18,2) NULL,
        LBcost         DECIMAL(18,2) NULL,
        DepreCost      DECIMAL(18,2) NULL,
        DOHcost        DECIMAL(18,2) NULL,
        OHcost         DECIMAL(18,2) NULL,
        UnitPrice      DECIMAL(18,2) NULL,
        MOwork         NVARCHAR(10)  NULL,
        AutoGen        TINYINT       NULL,
        EntryBy        NVARCHAR(20)  NULL,
        Entrydate      DATETIME      NULL,
        CONSTRAINT PK_tbl_MoHdr PRIMARY KEY (TransactionNo)
    );
END
GO

-- dbo.tbl_BatchOrder — 26 columns, generated verbatim from the live manifest.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_BatchOrder'
)
BEGIN
    CREATE TABLE dbo.tbl_BatchOrder (
        BatchNo     NVARCHAR(20)  NOT NULL,
        SoNo        NCHAR(20)     NULL,
        FgCode      NCHAR(50)     NULL,
        LotNo       NCHAR(80)     NULL,
        ItemCode    NCHAR(50)     NULL,
        Desp        NCHAR(100)    NULL,
        PlanQty     NUMERIC(18,2) NULL,
        Prodqty     NUMERIC(18,4) NULL,
        Unit        NCHAR(10)     NULL,
        OnhandMRP   NUMERIC(18,2) NULL,
        Reserve     NUMERIC(18,2) NULL,
        OnhandSHELF NUMERIC(18,2) NULL,
        SoPen       NUMERIC(18,2) NULL,
        Jobpen      NUMERIC(18,2) NULL,
        ShouldProd  NUMERIC(18,4) NULL,
        Wantdate    DATETIME      NULL,
        CustName    NCHAR(100)    NULL,
        Monum       NCHAR(20)     NULL,
        MoTrNo      NUMERIC(7,0)  NULL,
        OrmNo       NCHAR(20)     NULL,
        IMONo       NCHAR(20)     NULL,
        Remark      NCHAR(100)    NULL,
        IsMPS       TINYINT       NULL,
        PlanType    NCHAR(2)      NULL,
        Leadtime    REAL          NULL,
        ReleaseDate DATETIME      NULL,
        CONSTRAINT PK_tbl_BatchOrder PRIMARY KEY (BatchNo)
    );
END
GO

-- dbo.tbl_ItemGroup — 12 columns, generated verbatim from the live manifest.
-- The ERP's own product-category master: ICCode is the code stored on InventoryItem.ItemGRP, and
-- Description is the Thai label the Sales category pie now reads instead of an app-side hardcode.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'tbl_ItemGroup'
)
BEGIN
    CREATE TABLE dbo.tbl_ItemGroup (
        RowOrder         INT           NOT NULL,
        ICCode           NVARCHAR(10)  NULL,
        Description      NVARCHAR(80)  NULL,
        AssetOrItem      NVARCHAR(20)  NULL,
        AccCode          NVARCHAR(20)  NULL,
        AccName          NVARCHAR(100) NULL,
        AccDePre         NVARCHAR(20)  NULL,
        DePreName        NVARCHAR(100) NULL,
        AccAcumDepre     NVARCHAR(20)  NULL,
        AccAcumDepreName NVARCHAR(100) NULL,
        EntryBy          NVARCHAR(20)  NULL,
        EntryDate        DATETIME      NULL,
        CONSTRAINT PK_tbl_ItemGroup PRIMARY KEY (RowOrder)
    );
END
GO
