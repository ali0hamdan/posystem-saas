import type { BusinessType } from '@/types/tenant-context';

export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'GENERAL_MANAGER'
  | 'MANAGER'
  | 'CO_MANAGER'
  | 'CASHIER'
  | 'SALESMAN'
  | 'STOCK_MANAGER'
  | 'WAITER'
  | 'KITCHEN'
  | 'DELIVERY_DRIVER';

export type SubscriptionStatus =
  | 'PENDING_PAYMENT'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'LIFETIME';

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  salesmanIdCode?: string | null;
  subscriptionStatus?: SubscriptionStatus | null;
};

export type BranchSummary = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type ClientSummary = {
  id: string;
  businessName: string;
  businessType: BusinessType;
  status: string;
};

export type SubscriptionSummary = {
  status: SubscriptionStatus;
  planCode: string;
  planName?: string;
  billingCycle: string;
  expiresAt: string | null;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
  permissions?: string[];
  branches: BranchSummary[];
  businessType: BusinessType;
  subscriptionStatus?: SubscriptionStatus | null;
  nextDashboardUrl?: string;
  client?: ClientSummary | null;
  subscription?: SubscriptionSummary | null;
};

export type MeResponse = {
  user: AuthUser;
  permissions?: string[];
  branches: BranchSummary[];
  businessType?: BusinessType;
  subscriptionStatus?: SubscriptionStatus | null;
  nextDashboardUrl?: string;
  client?: ClientSummary | null;
  subscription?: SubscriptionSummary | null;
};
