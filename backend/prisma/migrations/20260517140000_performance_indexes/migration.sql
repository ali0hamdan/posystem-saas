-- Composite indexes for common list/report queries (see schema.prisma).

CREATE INDEX "Sale_cashierId_createdAt_idx" ON "Sale"("cashierId", "createdAt");
CREATE INDEX "Sale_createdAt_status_idx" ON "Sale"("createdAt", "status");
CREATE INDEX "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");
