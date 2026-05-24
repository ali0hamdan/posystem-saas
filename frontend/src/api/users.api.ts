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
