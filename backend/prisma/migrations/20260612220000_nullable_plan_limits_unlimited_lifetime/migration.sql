-- Null = unlimited for plan/subscription/activation-code limits
-- (used by Desktop Lifetime one-time plans). Existing rows keep their values.
ALTER TABLE "Plan" ALTER COLUMN "maxUsers" DROP NOT NULL;
ALTER TABLE "Plan" ALTER COLUMN "maxBranches" DROP NOT NULL;
ALTER TABLE "Plan" ALTER COLUMN "maxDevices" DROP NOT NULL;

ALTER TABLE "License" ALTER COLUMN "maxUsers" DROP NOT NULL;
ALTER TABLE "License" ALTER COLUMN "maxBranches" DROP NOT NULL;
ALTER TABLE "License" ALTER COLUMN "maxDevices" DROP NOT NULL;

ALTER TABLE "LicenseActivationCode" ALTER COLUMN "maxBranches" DROP NOT NULL;
ALTER TABLE "LicenseActivationCode" ALTER COLUMN "maxDevices" DROP NOT NULL;
