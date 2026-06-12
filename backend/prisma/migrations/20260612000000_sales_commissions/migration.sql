-- CreateEnum
CREATE TYPE "SalesCommissionType" AS ENUM ('PERCENTAGE', 'FIXED_PER_SALE', 'NONE');
CREATE TYPE "CommissionSourceType" AS ENUM ('RETAIL_SALE', 'WHOLESALE_INVOICE');
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'ADJUSTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMISSION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMISSION_PAID';

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionType" "SalesCommissionType" DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,2);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fixedCommissionAmount" DECIMAL(14,2);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionNotes" TEXT;

-- AlterTable Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "salesmanId" TEXT;

CREATE INDEX IF NOT EXISTS "Sale_createdByUserId_idx" ON "Sale"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Sale_salesmanId_idx" ON "Sale"("salesmanId");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable SalesCommission
CREATE TABLE "SalesCommission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT,
    "salesmanId" TEXT NOT NULL,
    "sourceType" "CommissionSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceNumber" TEXT NOT NULL,
    "commissionType" "SalesCommissionType" NOT NULL,
    "commissionRate" DECIMAL(5,2),
    "fixedCommissionAmount" DECIMAL(14,2),
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "refundedBaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustedCommissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "finalCommissionAmount" DECIMAL(14,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesCommission_clientId_sourceType_sourceId_salesmanId_key" ON "SalesCommission"("clientId", "sourceType", "sourceId", "salesmanId");
CREATE INDEX "SalesCommission_clientId_idx" ON "SalesCommission"("clientId");
CREATE INDEX "SalesCommission_salesmanId_idx" ON "SalesCommission"("salesmanId");
CREATE INDEX "SalesCommission_branchId_idx" ON "SalesCommission"("branchId");
CREATE INDEX "SalesCommission_status_idx" ON "SalesCommission"("status");
CREATE INDEX "SalesCommission_calculatedAt_idx" ON "SalesCommission"("calculatedAt");
CREATE INDEX "SalesCommission_sourceType_sourceId_idx" ON "SalesCommission"("sourceType", "sourceId");

ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
