-- Optional per-product expiry for near-expiry / expiry reporting.
ALTER TABLE "Product" ADD COLUMN "expiryDate" TIMESTAMP(3);
CREATE INDEX "Product_expiryDate_idx" ON "Product" ("expiryDate");
