-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RETAIL', 'FOOD_BEVERAGE', 'HYBRID');

-- AlterTable
ALTER TABLE "LicenseClient" ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'RETAIL';
