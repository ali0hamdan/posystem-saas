import { api } from '@/api/client';
import type {
  AdjustCustomerBalanceBody,
  CreateCustomerBody,
  CustomerPaymentBody,
  CustomerPaymentResult,
  CustomerRow,
  PaginatedCustomers,
  PaginatedLedger,
  UpdateCustomerBody,
} from '@/types/customers';

export type ListCustomersParams = {
  q?: string;
  page?: number;
  limit?: number;
};

export async function fetchCustomers(params?: ListCustomersParams): Promise<PaginatedCustomers> {
  const { data } = await api.get<PaginatedCustomers>('/customers', { params });
  return data;
}

export async function fetchCustomer(id: string): Promise<CustomerRow> {
  const { data } = await api.get<CustomerRow>(`/customers/${id}`);
  return data;
}

export async function createCustomer(body: CreateCustomerBody): Promise<CustomerRow> {
  const { data } = await api.post<CustomerRow>('/customers', body);
  return data;
}

export async function updateCustomer(id: string, body: UpdateCustomerBody): Promise<CustomerRow> {
  const { data } = await api.patch<CustomerRow>(`/customers/${id}`, body);
  return data;
}

export type LedgerParams = { page?: number; limit?: number };

export async function fetchCustomerLedger(id: string, params?: LedgerParams): Promise<PaginatedLedger> {
  const { data } = await api.get<PaginatedLedger>(`/customers/${id}/ledger`, { params });
  return data;
}

export async function recordCustomerPayment(
  id: string,
  body: CustomerPaymentBody,
): Promise<CustomerPaymentResult> {
  const { data } = await api.post<CustomerPaymentResult>(`/customers/${id}/payment`, body);
  return data;
}

export async function adjustCustomerBalance(
  id: string,
  body: AdjustCustomerBalanceBody,
): Promise<CustomerRow> {
  const { data } = await api.post<CustomerRow>(`/customers/${id}/adjust-balance`, body);
  return data;
}
