-- CreateEnum
CREATE TYPE "RefundApprovalMethod" AS ENUM ('APPROVAL_ID', 'NFC_CARD', 'NFC_CARD_AND_PIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "nfcCardUid" TEXT;
ALTER TABLE "User" ADD COLUMN "nfcEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "approvalPinHash" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN "refundApprovalMethod" "RefundApprovalMethod" NOT NULL DEFAULT 'APPROVAL_ID';

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN "approvalMethod" "RefundApprovalMethod";
ALTER TABLE "Refund" ADD COLUMN "approvedByNfcUidHashSnapshot" TEXT;
ALTER TABLE "Refund" ADD COLUMN "approvedByNfcUidMaskedSnapshot" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_clientId_nfcCardUid_key" ON "User"("clientId", "nfcCardUid");
