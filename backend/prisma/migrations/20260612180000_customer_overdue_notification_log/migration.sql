-- CreateTable
CREATE TABLE "CustomerOverdueNotificationLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceType" VARCHAR(32) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL DEFAULT 'CUSTOMER_OVERDUE',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOverdueNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOverdueNotificationLog_clientId_sourceType_sourceId_notificationType_key" ON "CustomerOverdueNotificationLog"("clientId", "sourceType", "sourceId", "notificationType");

-- CreateIndex
CREATE INDEX "CustomerOverdueNotificationLog_clientId_idx" ON "CustomerOverdueNotificationLog"("clientId");

-- CreateIndex
CREATE INDEX "CustomerOverdueNotificationLog_customerId_idx" ON "CustomerOverdueNotificationLog"("customerId");

-- CreateIndex
CREATE INDEX "CustomerOverdueNotificationLog_sourceType_sourceId_idx" ON "CustomerOverdueNotificationLog"("sourceType", "sourceId");
