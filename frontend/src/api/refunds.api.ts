import { api } from '@/api/client';
import type { RefundApprovalMethod } from '@/types/store-settings';

export type RefundSourceType = 'RETAIL_SALE' | 'FNB_ORDER' | 'WHOLESALE_INVOICE';
export type RestockAction = 'RESTOCK' | 'DAMAGED' | 'DISCARD' | 'NO_RESTOCK';

export interface RefundableItem {
  sourceItemId: string;
  name: string;
  sku?: string | null;
  soldQuantity: number;
  alreadyRefunded: number;
  remainingRefundable: number;
  unitPrice: string;
  lineTotal: string;
  defaultRestockAction?: RestockAction;
}

export interface RefundableTransaction {
  sourceType: RefundSourceType;
  sourceId: string;
  sourceNumber: string;
  status: string;
  total: string;
  paidAmount: string;
  totalRefunded: string;
  remainingRefundableAmount: string;
  items: RefundableItem[];
  customer?: { id: string; name: string; phone: string | null } | null;
}

export interface RefundLineInput {
  sourceItemId: string;
  quantity: number;
  restockAction?: RestockAction;
}

export interface CreateRefundBody {
  sourceType: RefundSourceType;
  sourceId: string;
  reason: string;
  approvalIdCode?: string;
  nfcCardUid?: string;
  approvalPin?: string;
  full?: boolean;
  notes?: string;
  paymentMethod?: string;
  items?: RefundLineInput[];
}

export interface RefundRecord {
  id: string;
  refundNumber: string;
  sourceType: RefundSourceType;
  sourceId: string;
  refundType: string;
  status: string;
  reason: string;
  totalRefunded: string | number;
  createdAt: string;
  approvedAt?: string | null;
  approvalMethod?: RefundApprovalMethod | null;
  approvedByApprovalIdCodeSnapshot?: string | null;
  approvedByNfcUidMaskedSnapshot?: string | null;
  user: { id: string; name: string; username: string };
  approvedBy?: { id: string; name: string; username: string; role: string } | null;
  sale?: { invoiceNumber: string } | null;
  fnbOrder?: { orderNumber: string } | null;
  items: {
    itemNameSnapshot: string;
    quantity: number;
    amount: string | number;
    restockAction: RestockAction;
  }[];
}

export async function fetchRefundable(
  sourceType: RefundSourceType,
  sourceId: string,
): Promise<RefundableTransaction> {
  const { data } = await api.get<RefundableTransaction>(
    `/refunds/refundable/${sourceType}/${sourceId}`,
  );
  return data;
}

export async function previewRefund(body: Omit<CreateRefundBody, 'reason'> & { reason?: string }) {
  const { data } = await api.post('/refunds/preview', body);
  return data;
}

export async function createRefund(body: CreateRefundBody): Promise<RefundRecord> {
  const { data } = await api.post<RefundRecord>('/refunds', body);
  return data;
}

export async function fetchRefunds(params?: {
  page?: number;
  limit?: number;
  sourceType?: RefundSourceType;
}) {
  const { data } = await api.get<{ data: RefundRecord[]; meta: unknown }>('/refunds', { params });
  return data;
}

export async function fetchRefund(id: string): Promise<RefundRecord> {
  const { data } = await api.get<RefundRecord>(`/refunds/${id}`);
  return data;
}

export interface RefundPrintData {
  title: string;
  subtitle: string;
  company: {
    businessName: string;
    storeName: string;
    branchName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxNumber: string | null;
    logoUrl: string | null;
  };
  customer: {
    name: string | null;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxNumber: string | null;
  } | null;
  refund: {
    id: string;
    refundNumber: string;
    refundType: string;
    status: string;
    sourceType: RefundSourceType;
    sourceTypeLabel: string;
    sourceNumber: string;
    reason: string;
    notes: string | null;
    createdAt: string;
    completedAt: string | null;
    paymentMethod: string | null;
    currency: string;
  };
  items: {
    lineNumber: number;
    itemName: string;
    sku: string | null;
    barcode: string | null;
    originalQuantity: number | null;
    refundedQuantity: number;
    unitPrice: string;
    taxRefunded: string;
    discountAdjusted: string;
    lineAmount: string;
    restockAction: RestockAction;
    restockQuantity: number;
    reason: string | null;
  }[];
  totals: {
    subtotalRefunded: string;
    taxRefunded: string;
    discountAdjusted: string;
    totalRefunded: string;
  };
  approval: {
    createdBy: string;
    approvedBy: string | null;
    approvalMethod: RefundApprovalMethod | null;
    approvalMethodLabel: string | null;
    approvalIdSnapshot: string | null;
    nfcUidMasked: string | null;
    approvedAt: string | null;
  };
  footerText: string | null;
}

export async function fetchRefundPrintData(id: string): Promise<RefundPrintData> {
  const { data } = await api.get<RefundPrintData>(`/refunds/${id}/print-data`);
  return data;
}
