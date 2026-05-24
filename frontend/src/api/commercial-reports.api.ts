import { api } from '@/api/client';

export type ReportDateFilters = {
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  cashierId?: string;
  shiftId?: string;
  categoryId?: string;
  productId?: string;
  page?: number;
  limit?: number;
  daysAhead?: number;
};

function cleanParams(p: ReportDateFilters): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === '') continue;
    out[k] = v;
  }
  return out;
}

export async function fetchSalesSummary(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/sales-summary', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchProfitAndLoss(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/profit-and-loss', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchGrossProfitByProduct(params?: ReportDateFilters & { limit?: number }) {
  const { data } = await api.get<unknown>('/reports/gross-profit-by-product', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchGrossProfitByCategory(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/gross-profit-by-category', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchPaymentMethodsReport(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/payment-methods', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchDiscountsReport(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/discounts', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchStockValuationReport(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/stock-valuation', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchInventoryMovements(params?: ReportDateFilters & { type?: string }) {
  const { data } = await api.get<unknown>('/reports/inventory-movements', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchProductsExpiryReport(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/products-expiry', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchSupplierPurchasesReport(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/supplier-purchases', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchShiftClosingReport(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/shift-closing', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchBranchComparison(params?: ReportDateFilters) {
  const { data } = await api.get<unknown>('/reports/branch-comparison', { params: cleanParams(params ?? {}) });
  return data;
}

export async function fetchCustomerDebtReport(params?: { page?: number; limit?: number }) {
  const { data } = await api.get<unknown>('/reports/customer-debt-report', { params: cleanParams(params ?? {}) });
  return data;
}
