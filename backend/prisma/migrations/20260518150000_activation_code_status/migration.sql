-- Activation code lifecycle + device platform for POS activation.
CREATE TYPE "ActivationCodeStatus" AS ENUM ('UNUSED', 'USED', 'EXPIRED', 'REVOKED');

ALTER TABLE "LicenseActivationCode" ADD COLUMN "status" "ActivationCodeStatus" NOT NULL DEFAULT 'UNUSED';
ALTER TABLE "LicenseActivationCode" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "LicenseActivationCode" ADD COLUMN "revokedBySaaSAdminId" TEXT;

CREATE INDEX "LicenseActivationCode_status_idx" ON "LicenseActivationCode"("status");

UPDATE "LicenseActivationCode" SET "status" = 'USED' WHERE "usedCount" >= "maxUses";
UPDATE "LicenseActivationCode" SET "status" = 'EXPIRED' WHERE "status" = 'UNUSED' AND "validUntil" < NOW();

ALTER TABLE "LicenseDevice" ADD COLUMN "platform" TEXT;

ALTER TABLE "LicenseActivationCode" ADD CONSTRAINT "LicenseActivationCode_revokedBySaaSAdminId_fkey"
  FOREIGN KEY ("revokedBySaaSAdminId") REFERENCES "SaaSAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recreate FK for creator relation name consistency (Prisma @@map table SaaSAdmin)
-- Existing FK on createdBySaaSAdminId should remain; only add revokedBy FK above.
