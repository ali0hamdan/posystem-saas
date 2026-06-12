import { api } from '@/api/client';



export type WholesaleDashboardData = {

  note: string;

  operational: {

    todaySales: string;

    todayProfit: string;

    todayOrdersCount: number;

    lowStockCount: number;

    totalProducts: number;

    totalCustomers: number;

    purchaseOrdersPending: number;

    stockMovementsToday: number;

  };

  cards: {

    totalQuotedValue: string;

    pendingQuotations: number;

    acceptedQuotations: number;

    proformaInvoicesPending: number;

    officialInvoicesUnpaid: number;

    officialInvoicesUnpaidValue: string;

    customerOutstandingDebt: string;

    customersWithDebt: number;

    stockReservedUnits: number;

    stockReservedLines: number;

    expiringQuotations: number;

    deliveriesPending: number;

    overdueInvoices: number;

  };

  recentQuotations: {

    id: string;

    quotationNumber: string;

    status: string;

    total: string;

    validUntil: string | null;

    createdAt: string;

    customerId: string | null;

    customerName: string | null;

  }[];

  recentProformas: {

    id: string;

    proformaNumber: string;

    status: string;

    total: string;

    validUntil: string | null;

    createdAt: string;

    customerId: string | null;

    customerName: string | null;

  }[];

  topCustomers: {

    customerId: string;

    customerName: string;

    orderCount: number;

    totalValue: string;

  }[];

  recentInvoices: {

    id: string;

    invoiceNumber: string;

    total: string;

    paymentStatus: string;

    createdAt: string;

    customerName: string | null;

  }[];

  lowStockProducts: {

    productId: string;

    name: string;

    quantity: number;

    minStock: number;

  }[];

  topCustomersByBalance: {

    customerId: string;

    customerName: string;

    balance: string;

  }[];

  recentStockMovements: {

    id: string;

    type: string;

    quantity: number;

    createdAt: string;

    productName: string;

  }[];

};



export async function fetchWholesaleDashboard(): Promise<WholesaleDashboardData> {

  const { data } = await api.get<WholesaleDashboardData>('/wholesale/reports/dashboard');

  return data;

}

