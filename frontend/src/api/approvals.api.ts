import { api } from '@/api/client';

export type RefundApprovalMethod = 'APPROVAL_ID' | 'NFC_CARD' | 'NFC_CARD_AND_PIN';

export type ApprovalValidationBody = {
  method?: RefundApprovalMethod;
  approvalIdCode?: string;
  nfcCardUid?: string;
  approvalPin?: string;
};

export type ApprovalValidationResult = {
  valid: true;
  approver: {
    id: string;
    name: string;
    role: string;
  };
};

export async function validateApproval(body: ApprovalValidationBody): Promise<ApprovalValidationResult> {
  const { data } = await api.post<ApprovalValidationResult>('/approvals/validate', body);
  return data;
}
