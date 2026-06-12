-- AlterEnum: new management roles (work across all business types)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GENERAL_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CO_MANAGER';

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'LOW_STOCK',
  'PASSWORD_RESET',
  'PURCHASE_COMPLETED',
  'SUBSCRIPTION_EXPIRING_48H',
  'SUBSCRIPTION_EXPIRING_24H',
  'WELCOME_MESSAGE',
  'USER_CREATED',
  'STOCK_ADDED',
  'SUBSCRIPTION_RENEWED_INVOICE',
  'PAYMENT_RECEIVED',
  'CUSTOMER_OVERDUE',
  'OFFICIAL_INVOICE_CREATED',
  'DEVICE_ACTIVATED',
  'LARGE_STOCK_ADJUSTMENT',
  'QUOTATION_ACCEPTED'
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sendToOwner" BOOLEAN NOT NULL DEFAULT true,
    "sendToGeneralManager" BOOLEAN NOT NULL DEFAULT true,
    "sendToCoManager" BOOLEAN NOT NULL DEFAULT false,
    "selectedUserIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionNotificationLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_clientId_notificationType_key" ON "NotificationPreference"("clientId", "notificationType");
CREATE INDEX "NotificationPreference_clientId_idx" ON "NotificationPreference"("clientId");
CREATE UNIQUE INDEX "SubscriptionNotificationLog_subscriptionId_notificationType_key" ON "SubscriptionNotificationLog"("subscriptionId", "notificationType");
CREATE INDEX "SubscriptionNotificationLog_clientId_idx" ON "SubscriptionNotificationLog"("clientId");
CREATE INDEX "SubscriptionNotificationLog_subscriptionId_idx" ON "SubscriptionNotificationLog"("subscriptionId");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "LicenseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
