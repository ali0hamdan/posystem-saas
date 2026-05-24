export type PaymentMethod = 'CASH' | 'CARD' | 'CREDIT' | 'MIXED';

export type SaleItemLine = {
  productId: string;
  quantity: number;
  discount?: number;
};

export type SalePaymentRow = {
  method: 'CASH' | 'CARD' | 'CREDIT';
  amount: number;
};

export type CreateSaleBody = {
  customerId?: string;
  items: SaleItemLine[];
  payments?: SalePaymentRow[];
  couponCode?: string;
  globalDiscount?: number;
  tax?: number;
};

export type CreatedSaleProduct = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
};

export type CreatedSaleItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string | number;
  discount: string | number;
  total: string | number;
  product: CreatedSaleProduct;
};

export type CreatedSalePayment = {
  id: string;
  method: string;
  amount: string | number;
};

export type CreatedSale = {
  id: string;
  invoiceNumber: string;
  subtotal: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  total: string | number;
  paymentStatus: string;
  createdAt: string;
  items: CreatedSaleItem[];
  payments: CreatedSalePayment[];
  cashier?: { id: string; name: string; username: string; role: string };
  branch?: { name: string } | null;
};
