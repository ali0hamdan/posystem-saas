-- Plan catalog limits + features; subscription maxUsers snapshot.
ALTER TABLE "Plan" ADD COLUMN "maxUsers" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Plan" ADD COLUMN "maxBranches" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Plan" ADD COLUMN "maxDevices" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Plan" ADD COLUMN "features" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "Plan" SET "maxUsers" = 3, "maxBranches" = 1, "maxDevices" = 2, "features" = '{"inventory": true, "reports": false, "multiBranch": false}'::jsonb WHERE "code" = 'STARTER';
UPDATE "Plan" SET "maxUsers" = 10, "maxBranches" = 3, "maxDevices" = 5, "features" = '{"inventory": true, "reports": true, "multiBranch": true}'::jsonb WHERE "code" = 'PRO';
UPDATE "Plan" SET "maxUsers" = 50, "maxBranches" = 20, "maxDevices" = 20, "features" = '{"inventory": true, "reports": true, "multiBranch": true, "apiAccess": true}'::jsonb WHERE "code" = 'ENTERPRISE';

ALTER TABLE "License" ADD COLUMN "maxUsers" INTEGER NOT NULL DEFAULT 5;

UPDATE "License" AS s
SET "maxUsers" = p."maxUsers"
FROM "Plan" AS p
WHERE s."planId" = p."id";
