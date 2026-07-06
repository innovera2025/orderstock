-- orderstock — vendor SQL Server schema creation script (Phase 02, auto-generated).
-- Generated offline via `prisma migrate diff --from-empty --to-schema`.
-- Does NOT create the database or logins — Phase 06 hand-authors those.
-- Review in SSMS before running against the customer's SQL Server.

BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[HealthCheck] (
    [id] INT NOT NULL IDENTITY(1,1),
    [checkedAt] DATETIME2 NOT NULL CONSTRAINT [HealthCheck_checkedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [HealthCheck_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Shop] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(200) NOT NULL,
    [rosterOrder] INT NOT NULL,
    [needsConfirmation] BIT NOT NULL CONSTRAINT [Shop_needsConfirmation_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [Shop_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Shop_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Shop_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Shop_rosterOrder_key] UNIQUE NONCLUSTERED ([rosterOrder])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(200) NOT NULL,
    [group] NVARCHAR(20) NOT NULL,
    [isOffList] BIT NOT NULL CONSTRAINT [Product_isOffList_df] DEFAULT 0,
    [needsConfirmation] BIT NOT NULL CONSTRAINT [Product_needsConfirmation_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [Product_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Product_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProductVariant] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [packSize] NVARCHAR(20) NOT NULL,
    [labelVariant] NVARCHAR(100),
    [printOrder] INT,
    [weightKg] DECIMAL(10,3),
    [pipConversion] DECIMAL(10,3),
    [needsConfirmation] BIT NOT NULL CONSTRAINT [ProductVariant_needsConfirmation_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [ProductVariant_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductVariant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProductVariant_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OrderSheet] (
    [id] INT NOT NULL IDENTITY(1,1),
    [date] DATE NOT NULL,
    [location] NVARCHAR(200),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OrderSheet_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OrderSheet_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OrderLine] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sheetId] INT NOT NULL,
    [shopId] INT NOT NULL,
    [variantId] INT NOT NULL,
    [qty] INT NOT NULL,
    [shopNameAtEntry] NVARCHAR(200) NOT NULL,
    [variantNameAtEntry] NVARCHAR(200) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OrderLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [OrderLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[NoteLine] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sheetId] INT NOT NULL,
    [shopId] INT,
    [productVariantId] INT,
    [text] NVARCHAR(max) NOT NULL,
    [qty] INT,
    [shopNameAtEntry] NVARCHAR(200),
    [variantNameAtEntry] NVARCHAR(200),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [NoteLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [NoteLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [username] NVARCHAR(100) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(20) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'STAFF',
    [active] BIT NOT NULL CONSTRAINT [User_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_username_key] UNIQUE NONCLUSTERED ([username])
);

-- CreateTable
CREATE TABLE [dbo].[AppSetting] (
    [id] INT NOT NULL IDENTITY(1,1),
    [key] NVARCHAR(100) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AppSetting_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AppSetting_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductVariant_printOrder_idx] ON [dbo].[ProductVariant]([printOrder]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductVariant_productId_idx] ON [dbo].[ProductVariant]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderSheet_date_idx] ON [dbo].[OrderSheet]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderLine_sheetId_idx] ON [dbo].[OrderLine]([sheetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderLine_shopId_idx] ON [dbo].[OrderLine]([shopId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderLine_variantId_idx] ON [dbo].[OrderLine]([variantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [NoteLine_sheetId_idx] ON [dbo].[NoteLine]([sheetId]);

-- AddForeignKey
ALTER TABLE [dbo].[ProductVariant] ADD CONSTRAINT [ProductVariant_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderLine] ADD CONSTRAINT [OrderLine_sheetId_fkey] FOREIGN KEY ([sheetId]) REFERENCES [dbo].[OrderSheet]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderLine] ADD CONSTRAINT [OrderLine_shopId_fkey] FOREIGN KEY ([shopId]) REFERENCES [dbo].[Shop]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderLine] ADD CONSTRAINT [OrderLine_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[NoteLine] ADD CONSTRAINT [NoteLine_sheetId_fkey] FOREIGN KEY ([sheetId]) REFERENCES [dbo].[OrderSheet]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[NoteLine] ADD CONSTRAINT [NoteLine_shopId_fkey] FOREIGN KEY ([shopId]) REFERENCES [dbo].[Shop]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[NoteLine] ADD CONSTRAINT [NoteLine_productVariantId_fkey] FOREIGN KEY ([productVariantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

