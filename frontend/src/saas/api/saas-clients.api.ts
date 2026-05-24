import { saasApi } from '@/saas/api/saas-client';
import type {
  ActivationCodeRow,
  ClientStatus,
  ClientSubscriptionView,
  CreateActivationCodeResult,
  CreateClientActivationCodeBody,
  CreateSaasClientBody,
  CreateClientUserBody,
  LicensePlanCode,
  ListClientUsersParams,
  PaginatedClients,
  PaginatedClientUsers,
  PatchClientUserBody,
  PatchSaasClientBody,
  SaasClientDetail,
  SaasClientUser,
} from '@/saas/types';

export type ListClientsParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: ClientStatus;
  includeDeleted?: boolean;
};

export async function fetchSaasClients(params?: ListClientsParams): Promise<PaginatedClients> {
  const { data } = await saasApi.get<PaginatedClients>('/saas/clients', { params });
  return data;
}

export async function fetchSaasClient(id: string): Promise<SaasClientDetail> {
  const { data } = await saasApi.get<SaasClientDetail>(`/saas/clients/${id}`);
  return data;
}

export async function createSaasClient(body: CreateSaasClientBody): Promise<SaasClientDetail> {
  const { data } = await saasApi.post<SaasClientDetail>('/saas/clients', body);
  return data;
}

export async function patchSaasClient(id: string, body: PatchSaasClientBody): Promise<SaasClientDetail> {
  const { data } = await saasApi.patch<SaasClientDetail>(`/saas/clients/${id}`, body);
  return data;
}

export async function patchSaasClientStatus(id: string, status: ClientStatus): Promise<SaasClientDetail> {
  const { data } = await saasApi.patch<SaasClientDetail>(`/saas/clients/${id}/status`, { status });
  return data;
}

export async function deleteSaasClient(id: string): Promise<{ id: string; deleted: boolean }> {
  const { data } = await saasApi.delete<{ id: string; deleted: boolean }>(`/saas/clients/${id}`);
  return data;
}

export async function fetchClientSubscription(clientId: string): Promise<ClientSubscriptionView> {
  const { data } = await saasApi.get<ClientSubscriptionView>(`/saas/clients/${clientId}/subscription`);
  return data;
}

export async function renewClientSubscription(
  clientId: string,
  body: { extendDays: number },
): Promise<{ id: string; expiresAt: string; status: string }> {
  const { data } = await saasApi.post(`/saas/clients/${clientId}/renew`, body);
  return data;
}

export async function changeClientPlan(
  clientId: string,
  body: { planCode: LicensePlanCode; graceDays?: number },
): Promise<{ id: string; planCode: LicensePlanCode; maxUsers: number; maxBranches: number; maxDevices: number; graceDays: number }> {
  const { data } = await saasApi.post(`/saas/clients/${clientId}/change-plan`, body);
  return data;
}

export interface PaymentRecord {
  id: string;
  status: string;
  amount: string;
  currency: string;
  billingCycle: string;
  paymentProvider: string;
  paidAt: string | null;
  createdAt: string;
  plan: { code: string; name: string };
}

export async function fetchClientPaymentRecords(clientId: string): Promise<PaymentRecord[]> {
  const { data } = await saasApi.get<PaymentRecord[]>(`/saas/clients/${clientId}/payment-records`);
  return data;
}

export async function suspendClient(clientId: string): Promise<{ id: string; status: string }> {
  const { data } = await saasApi.post(`/saas/clients/${clientId}/suspend`);
  return data;
}

export async function reactivateClient(clientId: string): Promise<{ id: string; status: string }> {
  const { data } = await saasApi.post(`/saas/clients/${clientId}/reactivate`);
  return data;
}

export async function fetchClientActivationCodes(
  clientId: string,
  params?: { page?: number; limit?: number },
): Promise<{ data: ActivationCodeRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { data } = await saasApi.get(`/saas/clients/${clientId}/activation-codes`, { params });
  return data;
}

export async function createClientActivationCode(
  clientId: string,
  body: CreateClientActivationCodeBody,
): Promise<CreateActivationCodeResult> {
  const { data } = await saasApi.post<CreateActivationCodeResult>(`/saas/clients/${clientId}/activation-codes`, body);
  return data;
}

export async function revokeActivationCode(id: string): Promise<{ id: string; status: string; revokedAt: string }> {
  const { data } = await saasApi.patch(`/saas/activation-codes/${id}/revoke`);
  return data;
}

export async function fetchClientUsers(
  clientId: string,
  params?: ListClientUsersParams,
): Promise<PaginatedClientUsers> {
  const { data } = await saasApi.get<PaginatedClientUsers>(`/saas/clients/${clientId}/users`, { params });
  return data;
}

export async function createClientUser(
  clientId: string,
  body: CreateClientUserBody,
): Promise<SaasClientUser> {
  const { data } = await saasApi.post<SaasClientUser>(`/saas/clients/${clientId}/users`, body);
  return data;
}

export async function patchClientUser(
  clientId: string,
  userId: string,
  body: PatchClientUserBody,
): Promise<SaasClientUser> {
  const { data } = await saasApi.patch<SaasClientUser>(
    `/saas/clients/${clientId}/users/${userId}`,
    body,
  );
  return data;
}

export async function patchClientUserPassword(
  clientId: string,
  userId: string,
  password: string,
): Promise<{ id: string; passwordUpdated: boolean }> {
  const { data } = await saasApi.patch<{ id: string; passwordUpdated: boolean }>(
    `/saas/clients/${clientId}/users/${userId}/password`,
    { password },
  );
  return data;
}

export async function patchClientUserStatus(
  clientId: string,
  userId: string,
  isActive: boolean,
): Promise<{ id: string; isActive: boolean }> {
  const { data } = await saasApi.patch<{ id: string; isActive: boolean }>(
    `/saas/clients/${clientId}/users/${userId}/status`,
    { isActive },
  );
  return data;
}

export async function deleteClientUser(
  clientId: string,
  userId: string,
): Promise<{ id: string; deleted: boolean }> {
  const { data } = await saasApi.delete<{ id: string; deleted: boolean }>(`/saas/clients/${clientId}/users/${userId}`);
  return data;
}
