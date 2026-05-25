-- Customer ledger (accounts receivable audit trail)

DO $$ BEGIN
  CREATE TYPE "CustomerLedgerType" AS ENUM ('SALE_CREDIT', 'PAYMENT', 'ADJUSTMENT', 'REFUND');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CustomerLedger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerId" TEXT NOT NULL,
  "type" "CustomerLedgerType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "balanceAfter" DECIMAL(14,2) NOT NULL,
  "referenceType" VARCHAR(64),
  "referenceId" VARCHAR(64),
  "note" TEXT,
  "receiptNumber" VARCHAR(64),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerLedger_receiptNumber_key" ON "CustomerLedger"("receiptNumber");

CREATE INDEX IF NOT EXISTS "CustomerLedger_customerId_createdAt_idx" ON "CustomerLedger"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerLedger_type_idx" ON "CustomerLedger"("type");
CREATE INDEX IF NOT EXISTS "CustomerLedger_createdAt_idx" ON "CustomerLedger"("createdAt");

DO $$ BEGIN
  ALTER TABLE "CustomerLedger" ADD CONSTRAINT "CustomerLedger_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerLedger" ADD CONSTRAINT "CustomerLedger_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill ledger rows for existing positive balances (opening AR)
INSERT INTO "CustomerLedger" ("id", "customerId", "type", "amount", "balanceAfter", "referenceType", "referenceId", "note", "receiptNumber", "createdById", "createdAt")
SELECT gen_random_uuid(), c."id", 'ADJUSTMENT'::"CustomerLedgerType", c."balance", c."balance", 'migration', 'opening-balance', 'Migrated existing customer balance', NULL,
  COALESCE((SELECT u."id" FROM "User" u WHERE u."role" = 'OWNER' AND u."isActive" = true ORDER BY u."createdAt" ASC LIMIT 1), (SELECT u2."id" FROM "User" u2 WHERE u2."isActive" = true ORDER BY u2."createdAt" ASC LIMIT 1)),
  NOW()
FROM "Customer" c
WHERE c."balance" <> 0
  AND EXISTS (SELECT 1 FROM "User" u WHERE u."isActive" = true);
