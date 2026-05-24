-- Licensing: clients, licenses, devices, activation codes

CREATE TYPE "LicenseClientStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "LicensePlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');
CREATE TYPE "LicenseRecordStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

CREATE TABLE "LicenseClient" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "LicenseClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicenseClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "plan" "LicensePlan" NOT NULL,
    "status" "LicenseRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxBranches" INTEGER NOT NULL DEFAULT 1,
    "maxDevices" INTEGER NOT NULL DEFAULT 3,
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseDevice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicenseDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseActivationCode" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "lookupHash" TEXT NOT NULL,
    "plan" "LicensePlan" NOT NULL,
    "maxBranches" INTEGER NOT NULL,
    "maxDevices" INTEGER NOT NULL,
    "graceDays" INTEGER NOT NULL,
    "termDays" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicenseActivationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LicenseActivationCode_lookupHash_key" ON "LicenseActivationCode"("lookupHash");

CREATE UNIQUE INDEX "LicenseDevice_clientId_deviceId_key" ON "LicenseDevice"("clientId", "deviceId");

CREATE INDEX "License_clientId_idx" ON "License"("clientId");
CREATE INDEX "License_status_idx" ON "License"("status");
CREATE INDEX "LicenseDevice_licenseId_idx" ON "LicenseDevice"("licenseId");
CREATE INDEX "LicenseActivationCode_clientId_idx" ON "LicenseActivationCode"("clientId");
CREATE INDEX "LicenseActivationCode_validUntil_idx" ON "LicenseActivationCode"("validUntil");

ALTER TABLE "License" ADD CONSTRAINT "License_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseDevice" ADD CONSTRAINT "LicenseDevice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseDevice" ADD CONSTRAINT "LicenseDevice_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseActivationCode" ADD CONSTRAINT "LicenseActivationCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
