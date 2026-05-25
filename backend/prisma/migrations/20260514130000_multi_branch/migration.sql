-- Multi-branch migration: creates Branch, backfills stock and FKs, then drops legacy Product columns.

DO $$ BEGIN
  CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Branch" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Branch_code_key" ON "Branch"("code");
CREATE INDEX IF NOT EXISTS "Branch_isActive_idx" ON "Branch"("isActive");
CREATE INDEX IF NOT EXISTS "Branch_name_idx" ON "Branch"("name");

INSERT INTO "Branch" ("id", "name", "code", "address", "phone", "isActive", "createdAt", "updatedAt")
SELECT 'a0000000-0000-4000-a000-000000000001', 'Main', 'MAIN', NULL, NULL, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Branch" WHERE "code" = 'MAIN');
CREATE TABLE "UserBranch" (
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("userId","branchId"),
  CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");

INSERT INTO "UserBranch" ("userId", "branchId")
SELECT u."id", 'a0000000-0000-4000-a000-000000000001'
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "UserBranch" ub WHERE ub."userId" = u."id" AND ub."branchId" = 'a0000000-0000-4000-a000-000000000001'
);

CREATE TABLE "BranchStock" (
  "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "minStock" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BranchStock_pkey" PRIMARY KEY ("branchId","productId"),
  CONSTRAINT "BranchStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BranchStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BranchStock_productId_idx" ON "BranchStock"("productId");

INSERT INTO "BranchStock" ("branchId", "productId", "quantity", "minStock")
SELECT 'a0000000-0000-4000-a000-000000000001', p."id", p."quantity", p."minStock"
FROM "Product" p;

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "Sale" SET "branchId" = 'a0000000-0000-4000-a000-000000000001' WHERE "branchId" IS NULL;
ALTER TABLE "Sale" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_branchId_fkey";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Sale_branchId_idx" ON "Sale"("branchId");

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "StockMovement" SET "branchId" = 'a0000000-0000-4000-a000-000000000001' WHERE "branchId" IS NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_branchId_fkey";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "StockMovement_branchId_idx" ON "StockMovement"("branchId");

ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "Shift" SET "branchId" = 'a0000000-0000-4000-a000-000000000001' WHERE "branchId" IS NULL;
ALTER TABLE "Shift" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_branchId_fkey";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Shift_branchId_idx" ON "Shift"("branchId");

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "PurchaseOrder" SET "branchId" = 'a0000000-0000-4000-a000-000000000001' WHERE "branchId" IS NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_branchId_fkey";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "PurchaseOrder_branchId_idx" ON "PurchaseOrder"("branchId");

CREATE TABLE "StockTransfer" (
  "id" TEXT NOT NULL,
  "fromBranchId" TEXT NOT NULL,
  "toBranchId" TEXT NOT NULL,
  "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3),
  CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StockTransfer_fromBranchId_idx" ON "StockTransfer"("fromBranchId");
CREATE INDEX "StockTransfer_toBranchId_idx" ON "StockTransfer"("toBranchId");
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");
CREATE INDEX "StockTransfer_createdAt_idx" ON "StockTransfer"("createdAt");

CREATE TABLE "StockTransferItem" (
  "id" TEXT NOT NULL,
  "stockTransferId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransferItem_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StockTransferItem_stockTransferId_idx" ON "StockTransferItem"("stockTransferId");
CREATE INDEX "StockTransferItem_productId_idx" ON "StockTransferItem"("productId");

ALTER TABLE "Product" DROP COLUMN IF EXISTS "quantity";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "minStock";
