-- Refund system expansion: unified model for Retail, F&B, and Wholesale

-- New enums
CREATE TYPE "RefundType" AS ENUM ('FULL', 'PARTIAL');
CREATE TYPE "RefundStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RefundSourceType" AS ENUM ('RETAIL_SALE', 'FNB_ORDER', 'WHOLESALE_INVOICE');
CREATE TYPE "RestockAction" AS ENUM ('RESTOCK', 'DAMAGED', 'DISCARD', 'NO_RESTOCK');

-- Extend existing enums
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'REFUND_RESTOCK';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'REFUND_DAMAGED';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'REFUND_DISCARDED';
ALTER TYPE "FnbOrderStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "FnbOrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "DocumentCounterType" ADD VALUE IF NOT EXISTS 'REFUND';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REFUND_COMPLETED';

-- Expand Refund table
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "businessType" "BusinessType";
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "sourceType" "RefundSourceType";
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "fnbOrderId" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "refundNumber" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "refundType" "RefundType";
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "status" "RefundStatus" NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "taxRefunded" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "discountAdjusted" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "refundedToCustomer" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Backfill existing refund rows
UPDATE "Refund" r
SET
  "sourceId" = r."saleId",
  "sourceType" = CASE
    WHEN s."sourceProformaId" IS NOT NULL THEN 'WHOLESALE_INVOICE'::"RefundSourceType"
    ELSE 'RETAIL_SALE'::"RefundSourceType"
  END,
  "refundNumber" = 'RF-LEG-' || UPPER(SUBSTRING(r."id" FROM 1 FOR 8)),
  "refundType" = 'PARTIAL'::"RefundType",
  "subtotal" = r."totalRefunded",
  "completedAt" = r."createdAt",
  "branchId" = s."branchId"
FROM "Sale" s
WHERE s."id" = r."saleId"
  AND r."sourceId" IS NULL;

UPDATE "Refund" SET "sourceId" = "saleId", "sourceType" = 'RETAIL_SALE'::"RefundSourceType",
  "refundNumber" = 'RF-LEG-' || UPPER(SUBSTRING("id" FROM 1 FOR 8)), "refundType" = 'PARTIAL'::"RefundType",
  "subtotal" = "totalRefunded", "completedAt" = "createdAt"
WHERE "sourceId" IS NULL;

-- Make saleId nullable (F&B refunds have no sale)
ALTER TABLE "Refund" ALTER COLUMN "saleId" DROP NOT NULL;

-- Set NOT NULL on required new columns
ALTER TABLE "Refund" ALTER COLUMN "sourceType" SET NOT NULL;
ALTER TABLE "Refund" ALTER COLUMN "sourceId" SET NOT NULL;
ALTER TABLE "Refund" ALTER COLUMN "refundNumber" SET NOT NULL;
ALTER TABLE "Refund" ALTER COLUMN "refundType" SET NOT NULL;

-- Expand RefundItem table
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "sourceItemId" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "fnbOrderItemId" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "menuItemId" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "itemNameSnapshot" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "skuSnapshot" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "barcodeSnapshot" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "unitPriceSnapshot" DECIMAL(14,2);
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "taxRefunded" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "discountAdjusted" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "restockQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "restockAction" "RestockAction" NOT NULL DEFAULT 'RESTOCK';
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RefundItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- The UPDATE target may not appear in JOIN conditions of the FROM clause.
-- Use UPDATE-FROM with comma-separated tables and the join predicates in
-- WHERE so PostgreSQL can parse this against a fresh database (the prior
-- form parses against a dev DB only when "RefundItem" is empty).
UPDATE "RefundItem" AS ri
SET
  "clientId" = r."clientId",
  "sourceItemId" = ri."saleItemId",
  "itemNameSnapshot" = COALESCE(p."name", 'Item'),
  "skuSnapshot" = p."sku",
  "barcodeSnapshot" = p."barcode",
  "unitPriceSnapshot" = si."unitPrice",
  "restockQuantity" = ri."quantity",
  "restockAction" = 'RESTOCK'::"RestockAction"
FROM "Refund" r, "SaleItem" si, "Product" p
WHERE r."id" = ri."refundId"
  AND si."id" = ri."saleItemId"
  AND p."id" = si."productId"
  AND ri."clientId" IS NULL;

UPDATE "RefundItem" SET "sourceItemId" = "saleItemId", "itemNameSnapshot" = 'Item',
  "unitPriceSnapshot" = "amount", "restockQuantity" = "quantity", "restockAction" = 'RESTOCK'::"RestockAction"
WHERE "sourceItemId" IS NULL;

ALTER TABLE "RefundItem" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "RefundItem" ALTER COLUMN "sourceItemId" SET NOT NULL;
ALTER TABLE "RefundItem" ALTER COLUMN "itemNameSnapshot" SET NOT NULL;
ALTER TABLE "RefundItem" ALTER COLUMN "unitPriceSnapshot" SET NOT NULL;

-- Make saleItemId nullable for F&B refund lines
ALTER TABLE "RefundItem" ALTER COLUMN "saleItemId" DROP NOT NULL;

-- Indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_clientId_refundNumber_key" ON "Refund"("clientId", "refundNumber");
CREATE INDEX IF NOT EXISTS "Refund_sourceType_sourceId_idx" ON "Refund"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "Refund_fnbOrderId_idx" ON "Refund"("fnbOrderId");
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status");
CREATE INDEX IF NOT EXISTS "RefundItem_clientId_idx" ON "RefundItem"("clientId");
CREATE INDEX IF NOT EXISTS "RefundItem_fnbOrderItemId_idx" ON "RefundItem"("fnbOrderItemId");
CREATE INDEX IF NOT EXISTS "RefundItem_sourceItemId_idx" ON "RefundItem"("sourceItemId");

-- Foreign keys
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_fnbOrderId_fkey"
  FOREIGN KEY ("fnbOrderId") REFERENCES "FnbOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_fnbOrderItemId_fkey"
  FOREIGN KEY ("fnbOrderItemId") REFERENCES "FnbOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
