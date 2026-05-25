-- Repair: add Plan columns that exist in schema but were missing from the original migration.

-- Create PlanType enum if it does not already exist
DO $$ BEGIN
  CREATE TYPE "PlanType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add all missing columns (IF NOT EXISTS makes this idempotent)
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "description"           TEXT,
  ADD COLUMN IF NOT EXISTS "type"                  "PlanType" NOT NULL DEFAULT 'SUBSCRIPTION',
  ADD COLUMN IF NOT EXISTS "monthlyPrice"          DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "yearlyPrice"           DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "oneTimePrice"          DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "currency"              TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "allowsDesktopDownload" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isActive"              BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sortOrder"             INT     NOT NULL DEFAULT 0;
