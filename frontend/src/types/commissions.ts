export type CommissionSourceType = 'RETAIL_SALE' | 'WHOLESALE_INVOICE';
export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' | 'ADJUSTED';
export type SalesCommissionType = 'PERCENTAGE' | 'FIXED_PER_SALE' | 'NONE';

export type SalesCommission = {
  id: string;
  clientId: string;
  branchId: string | null;
  salesmanId: string;
  sourceType: CommissionSourceType;
  sourceId: string;
  sourceNumber: string;
  commissionType: SalesCommissionType;
  commissionRate: string | number | null;
  fixedCommissionAmount: string | number | null;
  baseAmount: string | number;
  commissionAmount: string | number;
  refundedBaseAmount: string | number;
  adjustedCommissionAmount: string | number;
  finalCommissionAmount: string | number;
  status: CommissionStatus;
  calculatedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  salesman?: { id: string; name: string; username: string; role: string };
  branch?: { id: string; name: string; code: string | null } | null;
};

export type CommissionsSummary = {
  pending: string;
  approved: string;
  paid: string;
  totalSalesBase: string;
  totalAdjustments: string;
  count: number;
};

export type PaginatedCommissionsResponse = {
  data: SalesCommission[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type ListCommissionsParams = {
  page?: number;
  limit?: number;
  salesmanId?: string;
  branchId?: string;
  status?: CommissionStatus;
  sourceType?: CommissionSourceType;
  fromDate?: string;
  toDate?: string;
};

export type UpdateCommissionSettingsBody = {
  commissionEnabled?: boolean;
  commissionType?: SalesCommissionType;
  commissionRate?: number;
  fixedCommissionAmount?: number;
  commissionNotes?: string | null;
};

export type UserCommissionSettings = {
  id: string;
  name: string;
  username: string;
  role: string;
  commissionEnabled: boolean;
  commissionType: SalesCommissionType | null;
  commissionRate: string | number | null;
  fixedCommissionAmount: string | number | null;
  commissionNotes: string | null;
};
