-- Receipt / thermal printer settings
CREATE TYPE "ReceiptPaperSize" AS ENUM ('MM58', 'MM80');

ALTER TABLE "StoreSettings" ADD COLUMN "receiptPaperSize" "ReceiptPaperSize" NOT NULL DEFAULT 'MM80';
ALTER TABLE "StoreSettings" ADD COLUMN "receiptAutoPrint" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "receiptCopies" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StoreSettings" ADD COLUMN "receiptShowLogo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "receiptPrinterName" TEXT;
