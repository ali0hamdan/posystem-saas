-- SaaS client management: notes, support notes, soft delete.
ALTER TABLE "LicenseClient" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "LicenseClient" ADD COLUMN IF NOT EXISTS "supportNotes" TEXT;
ALTER TABLE "LicenseClient" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LicenseClient_deletedAt_idx" ON "LicenseClient"("deletedAt");
