export type UserRole = 'OWNER' | 'ADMIN' | 'CASHIER';

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
};

export type BranchSummary = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
  branches: BranchSummary[];
};

export type MeResponse = {
  user: AuthUser;
  branches: BranchSummary[];
};
