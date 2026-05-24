-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "costPriceAtSale" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "SaleItem" si
SET "costPriceAtSale" = p."costPrice"
FROM "Product" p
WHERE si."productId" = p."id";
