import { api } from '@/api/client';
import type {
  CustomerCreditSummaryResponse,
  CustomerDebtsReportResponse,
  CustomerPaymentHistoryResponse,
  DailySalesResponse,
  DashboardResponse,
  PaginatedLowStockResponse,
} from '@/types/reports';

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>('/reports/dashboard');
  return data;
}

export type DailySalesParams = {
  fromDate?: string;
  toDate?: string;
  cashierId?: string;
  shiftId?: string;
  branchId?: string;
};

export async function fetchDailySales(params?: DailySalesParams): Promise<DailySalesResponse> {
  const { data } = await api.get<DailySalesResponse>('/reports/daily-sales', { params });
  return data;
}

export type LowStockParams = {
  page?: number;
  limit?: number;
  branchId?: string;
};

export async function fetchLowStock(params?: LowStockParams): Promise<PaginatedLowStockResponse> {
  const { data } = await api.get<PaginatedLowStockResponse>('/reports/low-stock', { params });
  return data;
}

export async function fetchCustomerCreditSummary(): Promise<CustomerCreditSummaryResponse> {
  const { data } = await api.get<CustomerCreditSummaryResponse>('/reports/customer-credit/summary');
  return data;
}

export type CustomerDebtsParams = { page?: number; limit?: number };

export async function fetchCustomerDebtsReport(
  params?: CustomerDebtsParams,
): Promise<CustomerDebtsReportResponse> {
  const { data } = await api.get<CustomerDebtsReportResponse>('/reports/customer-debts', { params });
  return data;
}

export type CustomerPaymentHistoryParams = {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  customerId?: string;
  branchId?: string;
};

export async function fetchCustomerPaymentHistory(
  params?: CustomerPaymentHistoryParams,
): Promise<CustomerPaymentHistoryResponse> {
  const { data } = await api.get<CustomerPaymentHistoryResponse>('/reports/customer-payment-history', {
    params,
  });
  return data;
}

export type CashierPerformanceParams = {
  fromDate?: string;
  toDate?: string;
  cashierId?: string;
  shiftId?: string;
  branchId?: string;
};

export async function fetchCashierPerformance(params?: CashierPerformanceParams): Promise<unknown> {
  const { data } = await api.get('/reports/cashier-performance', { params });
  return data;
}

export type RefundsReportParams = {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  userId?: string;
  cashierId?: string;
  shiftId?: string;
  branchId?: string;
};

export async function fetchRefundsReport(params?: RefundsReportParams): Promise<unknown> {
  const { data } = await api.get('/reports/refunds', { params });
  return data;
}
