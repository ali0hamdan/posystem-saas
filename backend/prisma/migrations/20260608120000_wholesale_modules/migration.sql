-- Wholesale / B2B extended modules: credit profiles, price lists, delivery notes, approvals.

-- StoreSettings wholesale knobs
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "deliveryNotePrefix" TEXT NOT NULL DEFAULT 'DN';
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "enableCustomerCredit" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "enableDeliveryNotes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "enableApprovalWorkflow" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "allowOverCreditOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "allowOverStockOverride" BOOLEAN NOT NULL DEFAULT false;

-- Document counter type for delivery notes
ALTER TYPE "DocumentCounterType" ADD VALUE IF NOT EXISTS 'DELIVERY_NOTE';

-- Delivery note status
DO $$ BEGIN
  CREATE TYPE "DeliveryNoteStatus" AS ENUM ('DRAFT', 'SENT', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Approval workflow enums
DO $$ BEGIN
  CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalEntityType" AS ENUM ('QUOTATION', 'PROFORMA_INVOICE', 'INVOICE', 'DELIVERY_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CustomerCreditProfile" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
  "isCreditAllowed" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerCreditProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerCreditProfile_customerId_key" ON "CustomerCreditProfile"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerCreditProfile_clientId_idx" ON "CustomerCreditProfile"("clientId");

CREATE TABLE IF NOT EXISTS "PriceList" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PriceList_clientId_name_key" ON "PriceList"("clientId", "name");
CREATE INDEX IF NOT EXISTS "PriceList_clientId_idx" ON "PriceList"("clientId");
CREATE INDEX IF NOT EXISTS "PriceList_isActive_idx" ON "PriceList"("isActive");

CREATE TABLE IF NOT EXISTS "PriceListItem" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "priceListId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "minQuantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PriceListItem_priceListId_productId_minQuantity_key" ON "PriceListItem"("priceListId", "productId", "minQuantity");
CREATE INDEX IF NOT EXISTS "PriceListItem_clientId_idx" ON "PriceListItem"("clientId");
CREATE INDEX IF NOT EXISTS "PriceListItem_productId_idx" ON "PriceListItem"("productId");

CREATE TABLE IF NOT EXISTS "CustomerPriceList" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "priceListId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPriceList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPriceList_clientId_customerId_key" ON "CustomerPriceList"("clientId", "customerId");
CREATE INDEX IF NOT EXISTS "CustomerPriceList_priceListId_idx" ON "CustomerPriceList"("priceListId");

CREATE TABLE IF NOT EXISTS "DeliveryNote" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "saleId" TEXT,
  "proformaInvoiceId" TEXT,
  "deliveryNoteNumber" TEXT NOT NULL,
  "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "driverName" TEXT,
  "vehicleNumber" TEXT,
  "deliveryAddress" TEXT,
  "notes" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryNote_clientId_deliveryNoteNumber_key" ON "DeliveryNote"("clientId", "deliveryNoteNumber");
CREATE INDEX IF NOT EXISTS "DeliveryNote_clientId_idx" ON "DeliveryNote"("clientId");
CREATE INDEX IF NOT EXISTS "DeliveryNote_branchId_idx" ON "DeliveryNote"("branchId");
CREATE INDEX IF NOT EXISTS "DeliveryNote_customerId_idx" ON "DeliveryNote"("customerId");
CREATE INDEX IF NOT EXISTS "DeliveryNote_status_idx" ON "DeliveryNote"("status");

CREATE TABLE IF NOT EXISTS "DeliveryNoteItem" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "deliveryNoteId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "notes" TEXT,
  CONSTRAINT "DeliveryNoteItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryNoteItem_deliveryNoteId_idx" ON "DeliveryNoteItem"("deliveryNoteId");
CREATE INDEX IF NOT EXISTS "DeliveryNoteItem_clientId_idx" ON "DeliveryNoteItem"("clientId");

CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "entityType" "ApprovalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApprovalRequest_clientId_idx" ON "ApprovalRequest"("clientId");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

ALTER TABLE "CustomerCreditProfile" ADD CONSTRAINT "CustomerCreditProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPriceList" ADD CONSTRAINT "CustomerPriceList_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPriceList" ADD CONSTRAINT "CustomerPriceList_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryNoteItem" ADD CONSTRAINT "DeliveryNoteItem_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
