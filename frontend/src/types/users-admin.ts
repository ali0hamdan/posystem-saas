import type { UserRole } from '@/types/auth';

export type AdminUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedUsersResponse = {
  data: AdminUser[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type CreateUserBody = {
  name: string;
  username: string;
  password: string;
  role: UserRole;
  email?: string;
};

export type UpdateUserBody = {
  name?: string;
  username?: string;
  role?: UserRole;
  email?: string | null;
};

export type UpdateUserPasswordBody = {
  newPassword: string;
};

export type UpdateUserStatusBody = {
  isActive: boolean;
};
