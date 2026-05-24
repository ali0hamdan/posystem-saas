export type ReceiptPaperSize = 'MM58' | 'MM80';

export type StoreSettings = {
  id: string;
  storeName: string;
  storePhone: string | null;
  storeAddress: string | null;
  receiptFooter: string | null;
  taxEnabled: boolean;
  taxRate: string | number;
  currency: string;
  lowStockDefault: number;
  receiptLogo: string | null;
  receiptPaperSize: ReceiptPaperSize;
  receiptAutoPrint: boolean;
  receiptCopies: number;
  receiptShowLogo: boolean;
  receiptPrinterName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatchStoreSettingsBody = Partial<{
  storeName: string;
  storePhone: string | null;
  storeAddress: string | null;
  receiptFooter: string | null;
  taxEnabled: boolean;
  taxRate: number;
  currency: string;
  lowStockDefault: number;
  receiptLogo: string | null;
  receiptPaperSize: ReceiptPaperSize;
  receiptAutoPrint: boolean;
  receiptCopies: number;
  receiptShowLogo: boolean;
  receiptPrinterName: string | null;
}>;
