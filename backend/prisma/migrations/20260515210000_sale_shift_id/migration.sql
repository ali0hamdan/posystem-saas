-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "shiftId" TEXT;

-- CreateIndex
CREATE INDEX "Sale_shiftId_idx" ON "Sale"("shiftId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one OPEN shift per cashier (application also enforces)
CREATE UNIQUE INDEX "Shift_one_open_per_cashier_idx" ON "Shift"("cashierId") WHERE ("status" = 'OPEN');
