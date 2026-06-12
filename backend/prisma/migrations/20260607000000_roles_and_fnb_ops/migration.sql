-- AlterEnum: extend UserRole with F&B and Manager roles (additive, safe)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'WAITER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'KITCHEN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DELIVERY_DRIVER';

-- CreateEnum: F&B operations
DO $$ BEGIN
    CREATE TYPE "WasteType" AS ENUM ('INGREDIENT', 'MENU_ITEM', 'PRODUCT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "WasteReason" AS ENUM ('EXPIRED', 'DAMAGED', 'SPILL', 'PREP_ERROR', 'CUSTOMER_RETURN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "IngredientMovementType" AS ENUM ('PURCHASE', 'RECIPE_CONSUME', 'WASTE', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable: Waste
CREATE TABLE IF NOT EXISTS "Waste" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "WasteType" NOT NULL,
    "reason" "WasteReason" NOT NULL,
    "productId" TEXT,
    "menuItemId" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,
    "estimatedCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waste_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Waste_clientId_idx" ON "Waste"("clientId");
CREATE INDEX IF NOT EXISTS "Waste_branchId_idx" ON "Waste"("branchId");
CREATE INDEX IF NOT EXISTS "Waste_createdAt_idx" ON "Waste"("createdAt");
CREATE INDEX IF NOT EXISTS "Waste_type_idx" ON "Waste"("type");

-- CreateTable: DeliveryAssignment
CREATE TABLE IF NOT EXISTS "DeliveryAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryAssignment_orderId_key" ON "DeliveryAssignment"("orderId");
CREATE INDEX IF NOT EXISTS "DeliveryAssignment_clientId_idx" ON "DeliveryAssignment"("clientId");
CREATE INDEX IF NOT EXISTS "DeliveryAssignment_branchId_idx" ON "DeliveryAssignment"("branchId");
CREATE INDEX IF NOT EXISTS "DeliveryAssignment_status_idx" ON "DeliveryAssignment"("status");
CREATE INDEX IF NOT EXISTS "DeliveryAssignment_driverId_idx" ON "DeliveryAssignment"("driverId");
CREATE INDEX IF NOT EXISTS "DeliveryAssignment_createdAt_idx" ON "DeliveryAssignment"("createdAt");

-- CreateTable: IngredientMovement
CREATE TABLE IF NOT EXISTS "IngredientMovement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "IngredientMovementType" NOT NULL,
    "quantityChange" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IngredientMovement_clientId_idx" ON "IngredientMovement"("clientId");
CREATE INDEX IF NOT EXISTS "IngredientMovement_branchId_idx" ON "IngredientMovement"("branchId");
CREATE INDEX IF NOT EXISTS "IngredientMovement_productId_idx" ON "IngredientMovement"("productId");
CREATE INDEX IF NOT EXISTS "IngredientMovement_createdAt_idx" ON "IngredientMovement"("createdAt");
CREATE INDEX IF NOT EXISTS "IngredientMovement_type_idx" ON "IngredientMovement"("type");
