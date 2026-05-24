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
  balance: string | number;
  loyaltyPoints: number;
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

export type CreateCustomerBody = {
  name: string;
  phone?: string;
};

export type UpdateCustomerBody = {
  name?: string;
  phone?: string | null;
};

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
