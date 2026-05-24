-- Multi-tenant SaaS: Plan, SaaSAdmin, tenant columns, subscription plan FK, store settings PK change.
--
-- TODO(multi-tenant-migration-review):
-- 1) If you had multiple LicenseClient rows, verify slug assignment and that all POS rows were backfilled to the correct clientId.
-- 2) Confirm StoreSettings row 'default' was the only row before PK change.
-- 3) After deploy, rotate SaaS admin password (SEED_SAAS_ADMIN_PASSWORD) and remove dev defaults in production.

-- ---------------------------------------------------------------------------
-- Plan (billing tiers)
-- ---------------------------------------------------------------------------
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" "LicensePlan" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

INSERT INTO "Plan" ("id", "code", "name", "createdAt", "updatedAt") VALUES
  ('p0000000-0000-4000-a000-000000000001', 'STARTER', 'Starter', NOW(), NOW()),
  ('p0000000-0000-4000-a000-000000000002', 'PRO', 'Pro', NOW(), NOW()),
  ('p0000000-0000-4000-a000-000000000003', 'ENTERPRISE', 'Enterprise', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- SaaS platform admins (separate from store User)
-- ---------------------------------------------------------------------------
CREATE TABLE "SaaSAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaaSAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaaSAdmin_email_key" ON "SaaSAdmin"("email");

-- ---------------------------------------------------------------------------
-- LicenseClient → Client (table name unchanged): slug + updatedAt
-- ---------------------------------------------------------------------------
ALTER TABLE "LicenseClient" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "LicenseClient" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LicenseClient" SET "slug" = 'default' WHERE "slug" IS NULL AND "id" = (
  SELECT "id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1
);
UPDATE "LicenseClient" SET "slug" = 'tenant-' || "id" WHERE "slug" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "LicenseClient_slug_key" ON "LicenseClient"("slug");
ALTER TABLE "LicenseClient" ALTER COLUMN "slug" SET NOT NULL;

INSERT INTO "LicenseClient" ("id","businessName","ownerName","email","phone","status","createdAt","slug","updatedAt")
SELECT 'c0000000-0000-4000-8000-000000000001', 'Default tenant', 'Owner', 'tenant@localhost', NULL, 'ACTIVE', NOW(), 'default', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LicenseClient" LIMIT 1);

-- ---------------------------------------------------------------------------
-- License → Subscription: planId replaces enum column "plan"
-- ---------------------------------------------------------------------------
ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "planId" TEXT;

UPDATE "License" l
SET "planId" = p."id"
FROM "Plan" p
WHERE l."plan" = p."code" AND (l."planId" IS NULL OR l."planId" = '');

UPDATE "License" SET "planId" = 'p0000000-0000-4000-a000-000000000003' WHERE "planId" IS NULL;

ALTER TABLE "License" ALTER COLUMN "planId" SET NOT NULL;

ALTER TABLE "License" DROP COLUMN IF EXISTS "plan";

ALTER TABLE "License" ADD CONSTRAINT "License_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- LicenseActivationCode: planId + optional SaaS creator
-- ---------------------------------------------------------------------------
ALTER TABLE "LicenseActivationCode" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "LicenseActivationCode" ADD COLUMN IF NOT EXISTS "createdBySaaSAdminId" TEXT;

UPDATE "LicenseActivationCode" ac
SET "planId" = p."id"
FROM "Plan" p
WHERE ac."plan" = p."code" AND ac."planId" IS NULL;

UPDATE "LicenseActivationCode" SET "planId" = 'p0000000-0000-4000-a000-000000000001' WHERE "planId" IS NULL;

ALTER TABLE "LicenseActivationCode" ALTER COLUMN "planId" SET NOT NULL;

ALTER TABLE "LicenseActivationCode" DROP COLUMN IF EXISTS "plan";

ALTER TABLE "LicenseActivationCode" ADD CONSTRAINT "LicenseActivationCode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LicenseActivationCode" ADD CONSTRAINT "LicenseActivationCode_createdBySaaSAdminId_fkey" FOREIGN KEY ("createdBySaaSAdminId") REFERENCES "SaaSAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Tenant id helper: first LicenseClient by createdAt
-- ---------------------------------------------------------------------------
-- Branch
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Branch" b
SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1)
WHERE b."clientId" IS NULL;

ALTER TABLE "Branch" ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Branch_code_key";
CREATE UNIQUE INDEX "Branch_clientId_code_key" ON "Branch"("clientId", "code");
CREATE INDEX IF NOT EXISTS "Branch_clientId_idx" ON "Branch"("clientId");

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "User" u
SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1)
WHERE u."clientId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "User_username_key";
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_clientId_username_key" ON "User"("clientId", "username");
CREATE INDEX "User_clientId_idx" ON "User"("clientId");
CREATE INDEX "User_clientId_email_idx" ON "User"("clientId", "email");

-- Category
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Category" c
SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1)
WHERE c."clientId" IS NULL;

ALTER TABLE "Category" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Category" ADD CONSTRAINT "Category_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Category_clientId_idx" ON "Category"("clientId");

-- Supplier
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Supplier" s
SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1)
WHERE s."clientId" IS NULL;

ALTER TABLE "Supplier" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Supplier_clientId_idx" ON "Supplier"("clientId");

-- Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Product" p
SET "clientId" = c."clientId"
FROM "Category" c
WHERE p."categoryId" = c."id" AND p."clientId" IS NULL;

UPDATE "Product" p
SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1)
WHERE p."clientId" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Product_barcode_key";
DROP INDEX IF EXISTS "Product_sku_key";
CREATE UNIQUE INDEX "Product_clientId_barcode_key" ON "Product"("clientId", "barcode");
CREATE UNIQUE INDEX "Product_clientId_sku_key" ON "Product"("clientId", "sku");
CREATE INDEX "Product_clientId_idx" ON "Product"("clientId");

-- Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Customer" cu
SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1)
WHERE cu."clientId" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Customer_clientId_idx" ON "Customer"("clientId");

-- CustomerLedger
ALTER TABLE "CustomerLedger" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "CustomerLedger" cl
SET "clientId" = cu."clientId"
FROM "Customer" cu
WHERE cl."customerId" = cu."id" AND cl."clientId" IS NULL;

ALTER TABLE "CustomerLedger" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "CustomerLedger" ADD CONSTRAINT "CustomerLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CustomerLedger_clientId_idx" ON "CustomerLedger"("clientId");

-- Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Sale" s
SET "clientId" = b."clientId"
FROM "Branch" b
WHERE s."branchId" = b."id" AND s."clientId" IS NULL;

ALTER TABLE "Sale" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Sale_invoiceNumber_key";
CREATE UNIQUE INDEX "Sale_clientId_invoiceNumber_key" ON "Sale"("clientId", "invoiceNumber");
CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");

-- StockMovement
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "StockMovement" sm
SET "clientId" = b."clientId"
FROM "Branch" b
WHERE sm."branchId" = b."id" AND sm."clientId" IS NULL;

ALTER TABLE "StockMovement" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "StockMovement_clientId_idx" ON "StockMovement"("clientId");

-- PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "PurchaseOrder" po
SET "clientId" = b."clientId"
FROM "Branch" b
WHERE po."branchId" = b."id" AND po."clientId" IS NULL;

ALTER TABLE "PurchaseOrder" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "PurchaseOrder_clientId_idx" ON "PurchaseOrder"("clientId");

-- Refund
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Refund" r
SET "clientId" = s."clientId"
FROM "Sale" s
WHERE r."saleId" = s."id" AND r."clientId" IS NULL;

ALTER TABLE "Refund" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Refund_clientId_idx" ON "Refund"("clientId");

-- Shift
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Shift" sh
SET "clientId" = b."clientId"
FROM "Branch" b
WHERE sh."branchId" = b."id" AND sh."clientId" IS NULL;

ALTER TABLE "Shift" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Shift_clientId_idx" ON "Shift"("clientId");

-- Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "Expense" e
SET "clientId" = u."clientId"
FROM "User" u
WHERE e."createdById" = u."id" AND e."clientId" IS NULL;

ALTER TABLE "Expense" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Expense_clientId_idx" ON "Expense"("clientId");

-- StockTransfer
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "StockTransfer" st
SET "clientId" = b."clientId"
FROM "Branch" b
WHERE st."fromBranchId" = b."id" AND st."clientId" IS NULL;

ALTER TABLE "StockTransfer" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "StockTransfer_clientId_idx" ON "StockTransfer"("clientId");

-- AuditLog (nullable clientId for pre-migration / SaaS rows)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "AuditLog" a
SET "clientId" = u."clientId"
FROM "User" u
WHERE a."userId" = u."id" AND a."clientId" IS NULL;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AuditLog_clientId_idx" ON "AuditLog"("clientId");

-- StoreSettings: PK becomes clientId
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

UPDATE "StoreSettings" ss
SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1)
WHERE ss."id" = 'default' AND ss."clientId" IS NULL;

UPDATE "StoreSettings" SET "clientId" = (SELECT lc."id" FROM "LicenseClient" lc ORDER BY lc."createdAt" ASC LIMIT 1) WHERE "clientId" IS NULL;

ALTER TABLE "StoreSettings" DROP CONSTRAINT IF EXISTS "StoreSettings_pkey";
ALTER TABLE "StoreSettings" DROP COLUMN IF EXISTS "id";
ALTER TABLE "StoreSettings" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("clientId");
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
