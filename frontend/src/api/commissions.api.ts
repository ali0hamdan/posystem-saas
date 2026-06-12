import { api } from '@/api/client';
import type {
  CommissionsSummary,
  ListCommissionsParams,
  PaginatedCommissionsResponse,
  SalesCommission,
  UpdateCommissionSettingsBody,
  UserCommissionSettings,
} from '@/types/commissions';

export async function fetchCommissions(params?: ListCommissionsParams): Promise<PaginatedCommissionsResponse> {
  const { data } = await api.get<PaginatedCommissionsResponse>('/commissions', { params });
  return data;
}

export async function fetchCommissionSummary(params?: ListCommissionsParams): Promise<CommissionsSummary> {
  const { data } = await api.get<CommissionsSummary>('/commissions/summary', { params });
  return data;
}

export async function fetchCommission(id: string): Promise<SalesCommission> {
  const { data } = await api.get<SalesCommission>(`/commissions/${id}`);
  return data;
}

export async function approveCommission(id: string): Promise<SalesCommission> {
  const { data } = await api.patch<SalesCommission>(`/commissions/${id}/approve`);
  return data;
}

export async function markCommissionPaid(id: string): Promise<SalesCommission> {
  const { data } = await api.patch<SalesCommission>(`/commissions/${id}/mark-paid`);
  return data;
}

export async function cancelCommission(id: string): Promise<SalesCommission> {
  const { data } = await api.patch<SalesCommission>(`/commissions/${id}/cancel`);
  return data;
}

export async function updateUserCommissionSettings(
  userId: string,
  body: UpdateCommissionSettingsBody,
): Promise<UserCommissionSettings> {
  const { data } = await api.patch<UserCommissionSettings>(`/users/${userId}/commission-settings`, body);
  return data;
}
