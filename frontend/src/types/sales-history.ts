import type { UserRole } from '@/types/auth';

export type SalePaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export type SaleLifecycleStatus = 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';

export type SaleListCustomer = { id: string; name: string; phone: string | null };
export type SaleListCashier = { id: string; username: string; name: string; role: UserRole };
export type SaleListSalesman = {
  id: string;
  name: string;
  username: string;
  salesmanIdCode: string | null;
};

export type SaleListRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  total: string | number;
  paymentStatus: SalePaymentStatus;
  status: SaleLifecycleStatus;
  customer: SaleListCustomer | null;
  cashier: SaleListCashier;
  salesman?: SaleListSalesman | null;
  _count?: { items: number; payments: number };
};

export type PaginatedSalesResponse = {
  data: SaleListRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type SaleFilterUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
};

export type SaleDetailProduct = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unitType: string;
};

export type SaleDetailItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string | number;
  discount: string | number;
  total: string | number;
  product: SaleDetailProduct;
};

export type SaleDetailPayment = {
  id: string;
  method: string;
  amount: string | number;
};

export type SaleDetailRefundItem = {
  saleItemId: string;
  quantity: number;
  amount: string | number;
};

export type SaleDetailRefund = {
  id: string;
  reason: string;
  totalRefunded: string | number;
  createdAt: string;
  items: SaleDetailRefundItem[];
  user: { id: string; name: string; username: string; role: UserRole };
};

export type SaleDetail = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  subtotal: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  total: string | number;
  paymentStatus: SalePaymentStatus;
  status: SaleLifecycleStatus;
  customer: SaleListCustomer | null;
  cashier: SaleListCashier;
  items: SaleDetailItem[];
  payments: SaleDetailPayment[];
  refunds: SaleDetailRefund[];
};

export type ListSalesParams = {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  cashierId?: string;
  paymentStatus?: SalePaymentStatus;
  status?: SaleLifecycleStatus;
};

export type CreateRefundBody = {
  reason: string;
  approvalIdCode?: string;
  nfcCardUid?: string;
  approvalPin?: string;
  full?: boolean;
  items?: { saleItemId: string; quantity: number }[];
};
