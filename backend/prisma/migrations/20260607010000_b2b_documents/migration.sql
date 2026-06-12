-- B2B document workflow: Quotation, ProformaInvoice, StockReservation, DocumentCounter.
-- Plus optional Sale back-references and StoreSettings extension. All idempotent.

-- Enums
DO $$ BEGIN
    CREATE TYPE "QuotationStatus" AS ENUM (
        'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED',
        'CONVERTED_TO_PROFORMA', 'CONVERTED_TO_INVOICE', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "ProformaInvoiceStatus" AS ENUM (
        'DRAFT', 'SENT', 'APPROVED', 'CANCELLED', 'CONVERTED_TO_INVOICE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONVERTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "StockReservationSource" AS ENUM ('QUOTATION', 'PROFORMA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentCounterType" AS ENUM ('QUOTATION', 'PROFORMA_INVOICE', 'SALE_INVOICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DocumentCounter
CREATE TABLE IF NOT EXISTS "DocumentCounter" (
    "clientId" TEXT NOT NULL,
    "docType" "DocumentCounterType" NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("clientId", "docType")
);

-- Quotation
CREATE TABLE IF NOT EXISTS "Quotation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "quotationNumber" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "createdById" TEXT NOT NULL,
    "convertedToProformaId" TEXT,
    "convertedToInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_clientId_quotationNumber_key" ON "Quotation"("clientId", "quotationNumber");
CREATE INDEX IF NOT EXISTS "Quotation_clientId_idx" ON "Quotation"("clientId");
CREATE INDEX IF NOT EXISTS "Quotation_branchId_idx" ON "Quotation"("branchId");
CREATE INDEX IF NOT EXISTS "Quotation_customerId_idx" ON "Quotation"("customerId");
CREATE INDEX IF NOT EXISTS "Quotation_status_idx" ON "Quotation"("status");
CREATE INDEX IF NOT EXISTS "Quotation_createdAt_idx" ON "Quotation"("createdAt");
CREATE INDEX IF NOT EXISTS "Quotation_validUntil_idx" ON "Quotation"("validUntil");

-- QuotationItem
CREATE TABLE IF NOT EXISTS "QuotationItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "barcodeSnapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(8,4),
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey"
        FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
CREATE INDEX IF NOT EXISTS "QuotationItem_clientId_idx" ON "QuotationItem"("clientId");
CREATE INDEX IF NOT EXISTS "QuotationItem_productId_idx" ON "QuotationItem"("productId");

-- ProformaInvoice
CREATE TABLE IF NOT EXISTS "ProformaInvoice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "quotationId" TEXT,
    "proformaNumber" TEXT NOT NULL,
    "status" "ProformaInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "reserveStock" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "convertedToInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProformaInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProformaInvoice_clientId_proformaNumber_key" ON "ProformaInvoice"("clientId", "proformaNumber");
CREATE INDEX IF NOT EXISTS "ProformaInvoice_clientId_idx" ON "ProformaInvoice"("clientId");
CREATE INDEX IF NOT EXISTS "ProformaInvoice_branchId_idx" ON "ProformaInvoice"("branchId");
CREATE INDEX IF NOT EXISTS "ProformaInvoice_customerId_idx" ON "ProformaInvoice"("customerId");
CREATE INDEX IF NOT EXISTS "ProformaInvoice_status_idx" ON "ProformaInvoice"("status");
CREATE INDEX IF NOT EXISTS "ProformaInvoice_quotationId_idx" ON "ProformaInvoice"("quotationId");
CREATE INDEX IF NOT EXISTS "ProformaInvoice_createdAt_idx" ON "ProformaInvoice"("createdAt");

-- ProformaInvoiceItem
CREATE TABLE IF NOT EXISTS "ProformaInvoiceItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "proformaInvoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "barcodeSnapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(8,4),
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ProformaInvoiceItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "ProformaInvoiceItem" ADD CONSTRAINT "ProformaInvoiceItem_proformaInvoiceId_fkey"
        FOREIGN KEY ("proformaInvoiceId") REFERENCES "ProformaInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ProformaInvoiceItem_proformaInvoiceId_idx" ON "ProformaInvoiceItem"("proformaInvoiceId");
CREATE INDEX IF NOT EXISTS "ProformaInvoiceItem_clientId_idx" ON "ProformaInvoiceItem"("clientId");
CREATE INDEX IF NOT EXISTS "ProformaInvoiceItem_productId_idx" ON "ProformaInvoiceItem"("productId");

-- StockReservation
CREATE TABLE IF NOT EXISTS "StockReservation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "sourceType" "StockReservationSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockReservation_clientId_idx" ON "StockReservation"("clientId");
CREATE INDEX IF NOT EXISTS "StockReservation_branchId_idx" ON "StockReservation"("branchId");
CREATE INDEX IF NOT EXISTS "StockReservation_productId_idx" ON "StockReservation"("productId");
CREATE INDEX IF NOT EXISTS "StockReservation_sourceType_sourceId_idx" ON "StockReservation"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "StockReservation_status_idx" ON "StockReservation"("status");

-- Sale back-references
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "sourceQuotationId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "sourceProformaId" TEXT;
CREATE INDEX IF NOT EXISTS "Sale_sourceQuotationId_idx" ON "Sale"("sourceQuotationId");
CREATE INDEX IF NOT EXISTS "Sale_sourceProformaId_idx" ON "Sale"("sourceProformaId");

-- StoreSettings extension
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "enableQuotations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "enableProformaInvoices" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "enableStockReservation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "quotationValidityDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "proformaValidityDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "quotationTerms" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "proformaTerms" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "quotationPrefix" TEXT NOT NULL DEFAULT 'Q';
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "proformaPrefix" TEXT NOT NULL DEFAULT 'PI';
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "invoicePrefix" TEXT NOT NULL DEFAULT 'INV';
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "showTaxOnQuotation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "showSignatureArea" BOOLEAN NOT NULL DEFAULT true;
