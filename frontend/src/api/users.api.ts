import { api } from '@/api/client';
import type {
  AdminUser,
  CreateUserBody,
  PaginatedUsersResponse,
  UpdateUserBody,
  UpdateUserPasswordBody,
  UpdateUserStatusBody,
} from '@/types/users-admin';

export type ListUsersParams = {
  page?: number;
  limit?: number;
};

export async function fetchUsers(params?: ListUsersParams): Promise<PaginatedUsersResponse> {
  const { data } = await api.get<PaginatedUsersResponse>('/users', { params });
  return data;
}

export async function createUser(body: CreateUserBody): Promise<AdminUser> {
  const { data } = await api.post<AdminUser>('/users', body);
  return data;
}

export async function updateUser(id: string, body: UpdateUserBody): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${id}`, body);
  return data;
}

export async function updateUserPassword(id: string, body: UpdateUserPasswordBody): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${id}/password`, body);
  return data;
}

export async function updateUserStatus(id: string, body: UpdateUserStatusBody): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${id}/status`, body);
  return data;
}

export type SalesmanLookup = {
  id: string;
  name: string;
  salesmanIdCode: string;
  isActive: boolean;
};

export async function lookupSalesman(code: string): Promise<SalesmanLookup> {
  const { data } = await api.get<SalesmanLookup>('/users/salesmen/lookup', {
    params: { code: code.trim().toUpperCase() },
  });
  return data;
}

export async function searchSalesmen(search?: string): Promise<SalesmanLookup[]> {
  const { data } = await api.get<SalesmanLookup[]>('/users/salesmen', {
    params: search ? { search } : undefined,
  });
  return data;
}

export async function regenerateSalesmanId(userId: string): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${userId}/regenerate-salesman-id`);
  return data;
}

export type ApprovalLookup = {
  id: string;
  name: string;
  role: string;
  approvalIdCode: string;
  active: boolean;
};

export async function lookupApprovalId(code: string): Promise<ApprovalLookup> {
  const { data } = await api.get<ApprovalLookup>('/users/approval-lookup', {
    params: { code: code.trim().toUpperCase() },
  });
  return data;
}

export async function regenerateApprovalId(userId: string): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${userId}/regenerate-approval-id`);
  return data;
}

export async function registerNfcCard(userId: string, nfcCardUid: string): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${userId}/nfc/register`, { nfcCardUid });
  return data;
}

export async function removeNfcCard(userId: string): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${userId}/nfc/remove`);
  return data;
}

export async function setNfcEnabled(userId: string, nfcEnabled: boolean): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${userId}/nfc/enabled`, { nfcEnabled });
  return data;
}

export async function setApprovalPin(userId: string, pin: string): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${userId}/approval-pin`, { pin });
  return data;
}
