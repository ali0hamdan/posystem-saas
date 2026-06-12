-- Business-type-specific Desktop Lifetime plans.
-- 1) New LicensePlan enum values (one per POS business vertical).
ALTER TYPE "LicensePlan" ADD VALUE IF NOT EXISTS 'RETAIL_DESKTOP_LIFETIME';
ALTER TYPE "LicensePlan" ADD VALUE IF NOT EXISTS 'FNB_DESKTOP_LIFETIME';
ALTER TYPE "LicensePlan" ADD VALUE IF NOT EXISTS 'WHOLESALE_DESKTOP_LIFETIME';
ALTER TYPE "LicensePlan" ADD VALUE IF NOT EXISTS 'HYBRID_DESKTOP_LIFETIME';

-- 2) Optional business-type scoping on Plan (null = available to all types).
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "businessType" "BusinessType";
