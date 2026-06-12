import type { PaginatedResponse } from '@/types/paginated';

export type CustomerLedgerType =
  | 'SALE_CREDIT'
  | 'PAYMENT'
  | 'ADJUSTMENT'
  | 'REFUND';

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  companyName: string | null;
  taxNumber: string | null;
  notes: string | null;
  isActive: boolean;
  balance: string | number;
  loyaltyPoints: number;
  creditLimit: string | null;
  paymentTermsDays: number | null;
  isCreditAllowed: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerLedgerEntry = {
  id: string;
  customerId: string;
  type: CustomerLedgerType;
  amount: string | number;
  balanceAfter: string | number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  receiptNumber: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; username: string; role: string };
};

export type PaginatedCustomers = PaginatedResponse<CustomerRow>;
export type PaginatedLedger = PaginatedResponse<CustomerLedgerEntry>;

export type CustomerFormBody = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  companyName?: string;
  taxNumber?: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  notes?: string;
  isActive?: boolean;
};

export type CreateCustomerBody = CustomerFormBody;

export type UpdateCustomerBody = Partial<{
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  companyName: string | null;
  taxNumber: string | null;
  paymentTermsDays: number;
  creditLimit: number;
  notes: string | null;
  isActive: boolean;
}>;

export type CustomerPaymentBody = {
  amount: number;
  note?: string;
};

export type CustomerPaymentResult = {
  receiptNumber: string;
  amountApplied: string;
  customer: CustomerRow;
};

export type AdjustCustomerBalanceBody = {
  amount: number;
  reason: string;
  note?: string;
};
