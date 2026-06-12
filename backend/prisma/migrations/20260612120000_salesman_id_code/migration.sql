-- Add unique Salesman ID code per client (nullable for non-salesman roles).
ALTER TABLE "User" ADD COLUMN "salesmanIdCode" TEXT;

CREATE UNIQUE INDEX "User_clientId_salesmanIdCode_key" ON "User"("clientId", "salesmanIdCode");
