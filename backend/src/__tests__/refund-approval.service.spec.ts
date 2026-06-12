import { RefundApprovalMethod, UserRole } from '@prisma/client';
import { RefundApprovalService } from '../approvals/refund-approval.service';
import { ApprovalIdService } from '../users/approval-id.service';

function makeService(overrides?: {
  refundApprovalMethod?: RefundApprovalMethod;
  user?: Record<string, unknown> | null;
}) {
  const prisma = {
    storeSettings: {
      findUnique: jest.fn(async () => ({
        refundApprovalMethod: overrides?.refundApprovalMethod ?? RefundApprovalMethod.APPROVAL_ID,
      })),
    },
    user: {
      findFirst: jest.fn(async () => overrides?.user ?? null),
    },
  };
  const approvalId = {
    validateApproverForRefund: jest.fn(async () => ({
      id: 'gm1',
      name: 'Ali Ahmad',
      role: UserRole.GENERAL_MANAGER,
      approvalIdCode: 'ALIAHMAD@48291',
      isActive: true,
    })),
  } as unknown as ApprovalIdService;
  const service = new RefundApprovalService(prisma as never, approvalId);
  return { service, prisma, approvalId };
}

describe('RefundApprovalService.validateForRefund', () => {
  it('uses approval ID when method is APPROVAL_ID', async () => {
    const { service, approvalId } = makeService();
    const result = await service.validateForRefund('c1', { approvalIdCode: 'ALIAHMAD@48291' });
    expect(result.approvalMethod).toBe(RefundApprovalMethod.APPROVAL_ID);
    expect(approvalId.validateApproverForRefund).toHaveBeenCalled();
  });

  it('requires NFC card for NFC_CARD method', async () => {
    const { service } = makeService({ refundApprovalMethod: RefundApprovalMethod.NFC_CARD });
    await expect(service.validateForRefund('c1', {})).rejects.toMatchObject({
      response: { message: 'NFC card is required.' },
    });
  });

  it('validates NFC card approver', async () => {
    const { service } = makeService({
      refundApprovalMethod: RefundApprovalMethod.NFC_CARD,
      user: {
        id: 'gm1',
        name: 'Ali Ahmad',
        role: UserRole.GENERAL_MANAGER,
        approvalIdCode: 'ALIAHMAD@48291',
        nfcCardUid: '04A3917B221890',
        nfcEnabled: true,
        approvalPinHash: null,
        isActive: true,
      },
    });
    const result = await service.validateForRefund('c1', { nfcCardUid: '04A3917B221890' });
    expect(result.approvalMethod).toBe(RefundApprovalMethod.NFC_CARD);
    expect(result.approvedByNfcUidMaskedSnapshot).toBe('NFC card ending in 1890');
  });
});

describe('RefundApprovalService.validateApproval', () => {
  it('returns approver summary without sensitive fields', async () => {
    const { service } = makeService({
      refundApprovalMethod: RefundApprovalMethod.NFC_CARD,
      user: {
        id: 'gm1',
        name: 'Ali Ahmad',
        role: UserRole.GENERAL_MANAGER,
        approvalIdCode: 'ALIAHMAD@48291',
        nfcCardUid: '04A3917B221890',
        nfcEnabled: true,
        approvalPinHash: null,
        isActive: true,
      },
    });
    const result = await service.validateApproval('c1', {
      method: RefundApprovalMethod.NFC_CARD,
      nfcCardUid: '04A3917B221890',
    });
    expect(result.valid).toBe(true);
    expect(result.approver.name).toBe('Ali Ahmad');
  });
});
