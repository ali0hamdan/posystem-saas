export type DashboardRecentSale = {
  id: string;
  invoiceNumber: string;
  total: string | number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  cashier: { id: string; name: string; username: string };
  customer: { id: string; name: string } | null;
};

export type DashboardBestProduct = {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: string;
};

export type DashboardResponse = {
  todaySales: string;
  todayProfit: string;
  todayOrdersCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalProducts: number;
  totalCustomers: number;
  unpaidSalesTotal: string;
  recentSales: DashboardRecentSale[];
  bestSellingProducts: DashboardBestProduct[];
};

export type DailySalesPoint = {
  date: string;
  ordersCount: number;
  revenue: string;
  profit: string;
};

export type DailySalesResponse = {
  data: DailySalesPoint[];
  meta: {
    fromDate: string;
    toDate: string;
    cashierId: string | null;
    shiftId: string | null;
  };
};

export type LowStockProductRow = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  minStock: number;
  costPrice: string | number;
  sellingPrice: string | number;
};

export type PaginatedLowStockResponse = {
  data: LowStockProductRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type CustomerCreditSummaryResponse = {
  totalDebt: string;
  debtorCount: number;
};

export type CustomerDebtLeaderRow = {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
};

export type CustomerDebtsReportResponse = {
  data: CustomerDebtLeaderRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type CustomerPaymentHistoryRow = {
  id: string;
  customerId: string;
  type: string;
  amount: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  receiptNumber: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string | null };
  createdBy: { id: string; name: string; username: string };
};

export type CustomerPaymentHistoryResponse = {
  data: CustomerPaymentHistoryRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    fromDate: string;
    toDate: string;
    customerId: string | null;
  };
};
