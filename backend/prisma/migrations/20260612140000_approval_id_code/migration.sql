-- AlterTable
ALTER TABLE "User" ADD COLUMN "approvalIdCode" TEXT;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN "approvedByApprovalIdCodeSnapshot" TEXT;
ALTER TABLE "Refund" ADD COLUMN "approvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_clientId_approvalIdCode_key" ON "User"("clientId", "approvalIdCode");
