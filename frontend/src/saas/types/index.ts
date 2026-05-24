export type SaasAdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'BILLING';

export type SaasAdmin = {
  id: string;
  email: string;
  name: string;
  role: SaasAdminRole;
};

export type SaasLoginResponse = {
  accessToken: string;
  admin: SaasAdmin;
};

export type SaasMeResponse = {
  admin: SaasAdmin;
};

export type ClientStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'PENDING_PAYMENT';

export type LicensePlanCode = 'STARTER' | 'BUSINESS' | 'PRO' | 'LIFETIME_DESKTOP' | 'ENTERPRISE';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';

export type ActivationCodeStatus = 'UNUSED' | 'USED' | 'EXPIRED' | 'REVOKED';

export type SaasClientSummary = {
  id: string;
  slug: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  status: ClientStatus;
  notes: string | null;
  supportNotes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedClients = {
  data: SaasClientSummary[];
  meta: PaginatedMeta;
};

export type SaasClientDetail = {
  client: SaasClientSummary;
  currentSubscription: {
    id: string;
    status: SubscriptionStatus;
    startsAt: string;
    expiresAt: string;
    maxUsers: number;
    maxBranches: number;
    maxDevices: number;
    graceDays: number;
    planId: string;
  } | null;
  plan: { id: string; code: LicensePlanCode; name: string } | null;
  usersCount: number;
  branchesCount: number;
  devicesCount: number;
  activationCodesCount: number;
  licenseExpiresAt: string | null;
  lastDeviceSyncAt: string | null;
  status: ClientStatus;
};

export type SaasPlan = {
  id: string;
  code: LicensePlanCode;
  name: string;
  description: string | null;
  type: 'SUBSCRIPTION' | 'ONE_TIME';
  monthlyPrice: string | null;
  yearlyPrice: string | null;
  oneTimePrice: string | null;
  currency: string;
  maxUsers: number;
  maxBranches: number;
  maxDevices: number;
  features: Record<string, unknown>;
  allowsDesktopDownload: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientSubscriptionView = {
  clientId: string;
  client: { id: string; businessName: string; status: ClientStatus };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    startsAt: string;
    expiresAt: string;
    graceDays: number;
    maxUsers: number;
    maxBranches: number;
    maxDevices: number;
    plan: { id: string; code: LicensePlanCode; name: string; features: Record<string, unknown> };
  } | null;
  usage: { users: number; branches: number; devicesActive: number };
};

export type ActivationCodeRow = {
  id: string;
  status: ActivationCodeStatus;
  validUntil: string;
  usedCount: number;
  maxUses: number;
  label: string | null;
  maxDevices: number;
  maxBranches: number;
  graceDays: number;
  termDays: number;
  createdAt: string;
  revokedAt: string | null;
  plan: { code: LicensePlanCode; name: string };
};

export type CreateActivationCodeResult = {
  id: string;
  activationCode: string;
  validUntil: string;
  status: ActivationCodeStatus;
  maxUses: number;
};

export type LicenseSubscriptionRow = {
  id: string;
  clientId: string;
  planId: string;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt: string;
  maxUsers: number;
  maxBranches: number;
  maxDevices: number;
  graceDays: number;
  client: { id: string; businessName: string; email: string };
  plan: { id: string; code: LicensePlanCode; name: string };
};

export type LicenseDeviceRow = {
  id: string;
  clientId: string;
  subscriptionId: string;
  deviceId: string;
  deviceName: string | null;
  platform: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  createdAt: string;
  client: { id: string; businessName: string };
  subscription?: {
    id: string;
    status: SubscriptionStatus;
    expiresAt: string;
    plan: { code: LicensePlanCode; name: string };
  };
};

export type CreateSaasClientBody = {
  slug?: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  owner?: {
    username: string;
    password: string;
    name: string;
    email?: string | null;
  };
  subscription?: {
    planCode: LicensePlanCode;
    termDays?: number;
    maxUsers?: number;
    maxBranches?: number;
    maxDevices?: number;
    graceDays?: number;
  };
};

export type PatchSaasClientBody = {
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string | null;
  notes?: string | null;
  supportNotes?: string | null;
};

export type SaasClientUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: 'OWNER' | 'ADMIN' | 'CASHIER';
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type PaginatedClientUsers = {
  data: SaasClientUser[];
  meta: PaginatedMeta;
};

export type ListClientUsersParams = {
  page?: number;
  limit?: number;
  q?: string;
  includeInactive?: boolean;
};

export type CreateClientUserBody = {
  name: string;
  username: string;
  email?: string;
  password: string;
  role: 'OWNER' | 'ADMIN' | 'CASHIER';
  branchId?: string;
  isActive?: boolean;
};

export type PatchClientUserBody = {
  name?: string;
  username?: string;
  email?: string;
  role?: 'OWNER' | 'ADMIN' | 'CASHIER';
  branchId?: string;
  isActive?: boolean;
};

export type CreateSaasPlanBody = {
  code: LicensePlanCode;
  name: string;
  maxUsers: number;
  maxBranches: number;
  maxDevices: number;
  features?: Record<string, boolean>;
};

export type PatchSaasPlanBody = {
  name?: string;
  description?: string | null;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  oneTimePrice?: number | null;
  maxUsers?: number;
  maxBranches?: number;
  maxDevices?: number;
  isActive?: boolean;
  sortOrder?: number;
  allowsDesktopDownload?: boolean;
};

export type CreateClientActivationCodeBody = {
  plan: LicensePlanCode;
  termDays: number;
  maxBranches: number;
  maxDevices: number;
  graceDays: number;
  maxUses: number;
  validDays: number;
  label?: string;
};
