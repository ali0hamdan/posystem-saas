-- Schema alignment baseline.
--
-- Several pieces of `schema.prisma` were never captured in migration files
-- and only existed in the dev database via `prisma db push`. A fresh
-- PostgreSQL database (e.g. the desktop installer's local cluster) would
-- run all the existing migrations cleanly but then crash at runtime
-- because columns/tables required by services don't exist.
--
-- This migration captures the remaining drift, generated via
--   prisma migrate diff --from-url <fresh-db> --to-schema-datamodel <schema>
-- and adapted to be idempotent so re-applying against a dev database that
-- already has these objects is a no-op.

-- ---------------------------------------------------------------------------
-- New enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentRecordStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- New enum values
-- ---------------------------------------------------------------------------

ALTER TYPE "LicenseClientStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';

ALTER TYPE "LicensePlan" ADD VALUE IF NOT EXISTS 'BUSINESS';
ALTER TYPE "LicensePlan" ADD VALUE IF NOT EXISTS 'LIFETIME_DESKTOP';

ALTER TYPE "LicenseRecordStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
ALTER TYPE "LicenseRecordStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "LicenseRecordStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "LicenseRecordStatus" ADD VALUE IF NOT EXISTS 'LIFETIME';

-- ---------------------------------------------------------------------------
-- License (Subscription model) — billing cycle + subscription lifecycle
-- columns required by SaasClientsService and the desktop owner setup
-- ---------------------------------------------------------------------------

ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "billingCycle" "BillingCycle";
ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "externalSubscriptionId" TEXT;
ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3);
ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
DO $$ BEGIN ALTER TABLE "License" ALTER COLUMN "expiresAt" DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Coupon — datetime widths + FK ON DELETE behavior
-- ---------------------------------------------------------------------------

DO $$ BEGIN ALTER TABLE "Coupon" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3);
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Coupon" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Coupon" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Coupon" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_clientId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Sale" DROP CONSTRAINT "Sale_couponId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_couponId_fkey"
        FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- CustomerLedger — id column type
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    ALTER TABLE "CustomerLedger" DROP CONSTRAINT "CustomerLedger_pkey";
    ALTER TABLE "CustomerLedger" ALTER COLUMN "id" DROP DEFAULT;
    ALTER TABLE "CustomerLedger" ALTER COLUMN "id" SET DATA TYPE TEXT;
    ALTER TABLE "CustomerLedger" ADD CONSTRAINT "CustomerLedger_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- updatedAt default normalisation (Prisma @updatedAt does not want a DB-side
-- default). Wrapped in DO blocks so re-running against an out-of-shape dev
-- database (where some columns haven't been created by prior migrations)
-- is a no-op rather than a hard failure. On a fresh database every column
-- exists at this point and the drops succeed silently.
-- ---------------------------------------------------------------------------

DO $$ BEGIN ALTER TABLE "LicenseClient" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Plan" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Refund" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RefundItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SaaSAdmin" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SaaSAdmin" ALTER COLUMN "lockedUntil" SET DATA TYPE TIMESTAMP(3);
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "StoreSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "User" ALTER COLUMN "lockedUntil" SET DATA TYPE TIMESTAMP(3);
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- LicenseClient — drop legacy soft-delete index (replaced by partial index in schema)
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "LicenseClient_deletedAt_idx";

-- ---------------------------------------------------------------------------
-- PaymentRecord (SaaS billing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "PaymentRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "planId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "BillingCycle" NOT NULL,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'PENDING',
    "paymentProvider" TEXT NOT NULL DEFAULT 'manual',
    "externalPaymentId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentRecord_clientId_idx" ON "PaymentRecord"("clientId");
CREATE INDEX IF NOT EXISTS "PaymentRecord_subscriptionId_idx" ON "PaymentRecord"("subscriptionId");
CREATE INDEX IF NOT EXISTS "PaymentRecord_status_idx" ON "PaymentRecord"("status");
CREATE INDEX IF NOT EXISTS "PaymentRecord_createdAt_idx" ON "PaymentRecord"("createdAt");

DO $$ BEGIN
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_subscriptionId_fkey"
        FOREIGN KEY ("subscriptionId") REFERENCES "License"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "Plan"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Missing indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "DeliveryNote_saleId_idx" ON "DeliveryNote"("saleId");
CREATE INDEX IF NOT EXISTS "DeliveryNote_proformaInvoiceId_idx" ON "DeliveryNote"("proformaInvoiceId");
CREATE INDEX IF NOT EXISTS "DeliveryNoteItem_productId_idx" ON "DeliveryNoteItem"("productId");
CREATE INDEX IF NOT EXISTS "Sale_branchId_createdAt_idx" ON "Sale"("branchId", "createdAt");

-- ---------------------------------------------------------------------------
-- Rename truncated index name from earlier migration
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    ALTER INDEX "CustomerOverdueNotificationLog_clientId_sourceType_sourceId_not"
        RENAME TO "CustomerOverdueNotificationLog_clientId_sourceType_sourceId_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
