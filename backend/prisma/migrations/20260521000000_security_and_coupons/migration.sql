-- Security: account lockout & refresh tokens on User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "loginAttempts"    INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;

-- Security: account lockout & TOTP on SaaSAdmin
ALTER TABLE "SaaSAdmin"
  ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "totpSecret"    TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabled"   BOOLEAN   NOT NULL DEFAULT FALSE;

-- Coupons: new enum type
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED');

-- Coupons: new table
CREATE TABLE "Coupon" (
  "id"             TEXT        NOT NULL,
  "clientId"       TEXT        NOT NULL,
  "code"           VARCHAR(64) NOT NULL,
  "type"           "CouponType" NOT NULL,
  "value"          DECIMAL(14,2) NOT NULL,
  "minOrderAmount" DECIMAL(14,2),
  "maxUses"        INTEGER,
  "usedCount"      INTEGER     NOT NULL DEFAULT 0,
  "expiresAt"      TIMESTAMP,
  "isActive"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP   NOT NULL DEFAULT NOW(),

  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Coupon_clientId_code_key" UNIQUE ("clientId", "code"),
  CONSTRAINT "Coupon_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE
);

CREATE INDEX "Coupon_clientId_idx"  ON "Coupon"("clientId");
CREATE INDEX "Coupon_isActive_idx"  ON "Coupon"("isActive");
CREATE INDEX "Coupon_expiresAt_idx" ON "Coupon"("expiresAt");

-- Sales: coupon tracking columns
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "couponId"       TEXT,
  ADD COLUMN IF NOT EXISTS "couponCode"     VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "couponDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL;
