-- F&B orders baseline.
--
-- These enums and tables exist in `schema.prisma` but were never written
-- to a migration file. The next migration (`20260611210000_refund_system`)
-- references `FnbOrderStatus`, `FnbOrder`, and `FnbOrderItem`, so a fresh
-- PostgreSQL database aborts with:
--
--   ERROR: type "FnbOrderStatus" does not exist
--
-- This migration backfills the missing F&B infrastructure. Every CREATE
-- uses the `IF NOT EXISTS` / `DO $$ EXCEPTION WHEN duplicate_object`
-- pattern so it is safe to run against dev databases that already have
-- the objects (created earlier via `prisma db push`).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "FnbOrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `PARTIALLY_REFUNDED` and `REFUNDED` are deliberately omitted here — the
-- following refund_system migration adds them via `ALTER TYPE ... ADD VALUE
-- IF NOT EXISTS`. Keeping the baseline minimal matches the original schema
-- evolution order.
DO $$ BEGIN
    CREATE TYPE "FnbOrderStatus" AS ENUM ('OPEN', 'SENT', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "FnbOrderItemStatus" AS ENUM ('PENDING', 'SENT', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "KitchenTicketStatus" AS ENUM ('QUEUED', 'PREPARING', 'READY', 'BUMPED', 'RECALLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "DiningArea" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningArea_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DiningArea_clientId_idx" ON "DiningArea"("clientId");
CREATE INDEX IF NOT EXISTS "DiningArea_branchId_idx" ON "DiningArea"("branchId");

CREATE TABLE IF NOT EXISTS "RestaurantTable" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "diningAreaId" TEXT,
    "label" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 2,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "posX" INTEGER,
    "posY" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_clientId_branchId_label_key"
    ON "RestaurantTable"("clientId", "branchId", "label");
CREATE INDEX IF NOT EXISTS "RestaurantTable_clientId_idx" ON "RestaurantTable"("clientId");
CREATE INDEX IF NOT EXISTS "RestaurantTable_branchId_idx" ON "RestaurantTable"("branchId");
CREATE INDEX IF NOT EXISTS "RestaurantTable_status_idx" ON "RestaurantTable"("status");

CREATE TABLE IF NOT EXISTS "MenuItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categoryId" TEXT,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "imageUrl" TEXT,
    "prepStation" TEXT DEFAULT 'KITCHEN',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MenuItem_clientId_idx" ON "MenuItem"("clientId");
CREATE INDEX IF NOT EXISTS "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
CREATE INDEX IF NOT EXISTS "MenuItem_isActive_idx" ON "MenuItem"("isActive");

CREATE TABLE IF NOT EXISTS "ModifierGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModifierGroup_clientId_idx" ON "ModifierGroup"("clientId");

CREATE TABLE IF NOT EXISTS "Modifier" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Modifier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Modifier_clientId_idx" ON "Modifier"("clientId");
CREATE INDEX IF NOT EXISTS "Modifier_groupId_idx" ON "Modifier"("groupId");

CREATE TABLE IF NOT EXISTS "MenuItemModifierGroup" (
    "menuItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("menuItemId", "modifierGroupId")
);
CREATE INDEX IF NOT EXISTS "MenuItemModifierGroup_modifierGroupId_idx"
    ON "MenuItemModifierGroup"("modifierGroupId");

CREATE TABLE IF NOT EXISTS "FnbOrder" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "type" "FnbOrderType" NOT NULL DEFAULT 'DINE_IN',
    "status" "FnbOrderStatus" NOT NULL DEFAULT 'OPEN',
    "tableId" TEXT,
    "customerId" TEXT,
    "serverId" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "saleId" TEXT,
    "notes" TEXT,
    "deliveryAddress" TEXT,
    "deliveryPhone" TEXT,
    "driverName" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FnbOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FnbOrder_clientId_orderNumber_key"
    ON "FnbOrder"("clientId", "orderNumber");
CREATE INDEX IF NOT EXISTS "FnbOrder_clientId_idx" ON "FnbOrder"("clientId");
CREATE INDEX IF NOT EXISTS "FnbOrder_branchId_idx" ON "FnbOrder"("branchId");
CREATE INDEX IF NOT EXISTS "FnbOrder_status_idx" ON "FnbOrder"("status");
CREATE INDEX IF NOT EXISTS "FnbOrder_tableId_idx" ON "FnbOrder"("tableId");

CREATE TABLE IF NOT EXISTS "FnbOrderItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "modifiersTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "status" "FnbOrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FnbOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FnbOrderItem_orderId_idx" ON "FnbOrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "FnbOrderItem_clientId_idx" ON "FnbOrderItem"("clientId");

CREATE TABLE IF NOT EXISTS "FnbOrderItemModifier" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "modifierId" TEXT,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "FnbOrderItemModifier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FnbOrderItemModifier_orderItemId_idx"
    ON "FnbOrderItemModifier"("orderItemId");

CREATE TABLE IF NOT EXISTS "KitchenTicket" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "station" TEXT DEFAULT 'KITCHEN',
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bumpedAt" TIMESTAMP(3),

    CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KitchenTicket_clientId_idx" ON "KitchenTicket"("clientId");
CREATE INDEX IF NOT EXISTS "KitchenTicket_branchId_idx" ON "KitchenTicket"("branchId");
CREATE INDEX IF NOT EXISTS "KitchenTicket_orderId_idx" ON "KitchenTicket"("orderId");
CREATE INDEX IF NOT EXISTS "KitchenTicket_status_idx" ON "KitchenTicket"("status");

CREATE TABLE IF NOT EXISTS "KitchenTicketItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "FnbOrderItemStatus" NOT NULL DEFAULT 'SENT',

    CONSTRAINT "KitchenTicketItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KitchenTicketItem_ticketId_idx"
    ON "KitchenTicketItem"("ticketId");
CREATE INDEX IF NOT EXISTS "KitchenTicketItem_orderItemId_idx"
    ON "KitchenTicketItem"("orderItemId");

CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "partySize" INTEGER NOT NULL DEFAULT 2,
    "reservedAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 90,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Reservation_clientId_idx" ON "Reservation"("clientId");
CREATE INDEX IF NOT EXISTS "Reservation_branchId_idx" ON "Reservation"("branchId");
CREATE INDEX IF NOT EXISTS "Reservation_reservedAt_idx" ON "Reservation"("reservedAt");
CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"("status");

CREATE TABLE IF NOT EXISTS "Recipe" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "yieldQty" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Recipe_menuItemId_key" ON "Recipe"("menuItemId");
CREATE INDEX IF NOT EXISTS "Recipe_clientId_idx" ON "Recipe"("clientId");

CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");
CREATE INDEX IF NOT EXISTS "RecipeIngredient_productId_idx" ON "RecipeIngredient"("productId");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_diningAreaId_fkey"
        FOREIGN KEY ("diningAreaId") REFERENCES "DiningArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey"
        FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_modifierGroupId_fkey"
        FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FnbOrder" ADD CONSTRAINT "FnbOrder_tableId_fkey"
        FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FnbOrderItem" ADD CONSTRAINT "FnbOrderItem_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "FnbOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FnbOrderItem" ADD CONSTRAINT "FnbOrderItem_menuItemId_fkey"
        FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FnbOrderItemModifier" ADD CONSTRAINT "FnbOrderItemModifier_orderItemId_fkey"
        FOREIGN KEY ("orderItemId") REFERENCES "FnbOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "FnbOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_ticketId_fkey"
        FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_orderItemId_fkey"
        FOREIGN KEY ("orderItemId") REFERENCES "FnbOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey"
        FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_menuItemId_fkey"
        FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey"
        FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
