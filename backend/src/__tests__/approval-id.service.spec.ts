import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApprovalIdService,
  normalizeNameForApprovalCode,
  REFUND_APPROVAL_ROLES,
} from '../users/approval-id.service';

function makeService(existingCodes: string[] = []) {
  const codes = new Set(existingCodes);
  const prisma = {
    user: {
      findFirst: jest.fn(async ({ where }: { where: { clientId: string; approvalIdCode?: string } }) =>
        where.approvalIdCode && codes.has(where.approvalIdCode) ? { id: 'existing' } : null,
      ),
      update: jest.fn(),
    },
  };
  const service = new ApprovalIdService(prisma as never);
  return { service, prisma, codes };
}

describe('normalizeNameForApprovalCode', () => {
  it('normalizes names to uppercase alphanumeric', () => {
    expect(normalizeNameForApprovalCode('Ali Ahmad')).toBe('ALIAHMAD');
    expect(normalizeNameForApprovalCode('Joe')).toBe('JOE');
    expect(normalizeNameForApprovalCode('General Manager')).toBe('GENERALMANAGER');
    expect(normalizeNameForApprovalCode('  ')).toBe('MANAGER');
  });
});

describe('ApprovalIdService.generateApprovalIdCode', () => {
  it('generates NAME@12345 format', async () => {
    const { service } = makeService();
    const code = await service.generateApprovalIdCode('client-1', 'Ali Ahmad');
    expect(code).toMatch(/^ALIAHMAD@\d{5}$/);
  });

  it('generates different codes when one is taken', async () => {
    const taken = new Set<string>();
    const prisma = {
      user: {
        findFirst: jest.fn(async ({ where }: { where: { approvalIdCode?: string } }) => {
          if (where.approvalIdCode && taken.has(where.approvalIdCode)) return { id: 'existing' };
          return null;
        }),
      },
    };
    const service = new ApprovalIdService(prisma as never);
    taken.add('ALIAHMAD@00000');
    const randomSpy = jest.spyOn(require('crypto'), 'randomInt');
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(1);
    const code = await service.generateApprovalIdCode('client-1', 'Ali Ahmad');
    expect(code).toBe('ALIAHMAD@00001');
    randomSpy.mockRestore();
  });
});

describe('ApprovalIdService.validateApproverForRefund', () => {
  it('requires approval ID', async () => {
    const { service } = makeService();
    await expect(service.validateApproverForRefund('c1', undefined)).rejects.toMatchObject({
      response: { message: 'Approval ID is required.' },
    });
  });

  it('rejects unknown code', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.validateApproverForRefund('c1', 'UNKNOWN@12345')).rejects.toMatchObject({
      response: { message: 'Invalid manager approval ID.' },
    });
  });

  it('rejects inactive manager', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({
      id: 'm1',
      name: 'Ali Ahmad',
      role: UserRole.GENERAL_MANAGER,
      approvalIdCode: 'ALIAHMAD@48291',
      isActive: false,
    } as never);
    await expect(service.validateApproverForRefund('c1', 'ALIAHMAD@48291')).rejects.toMatchObject({
      response: { message: 'This manager is inactive.' },
    });
  });

  it('rejects unauthorized role', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({
      id: 's1',
      name: 'Sales',
      role: UserRole.SALESMAN,
      approvalIdCode: 'SALES@12345',
      isActive: true,
    } as never);
    await expect(service.validateApproverForRefund('c1', 'SALES@12345')).rejects.toMatchObject({
      response: { message: 'This approval ID is not authorized for refunds.' },
    });
  });

  it('accepts active general manager', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({
      id: 'm1',
      name: 'Ali Ahmad',
      role: UserRole.GENERAL_MANAGER,
      approvalIdCode: 'ALIAHMAD@48291',
      isActive: true,
    } as never);
    const row = await service.validateApproverForRefund('c1', 'aliahmad@48291');
    expect(row.approvalIdCode).toBe('ALIAHMAD@48291');
  });
});

describe('ApprovalIdService.lookupApprovalId', () => {
  it('returns minimal info for valid manager', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({
      id: 'm1',
      name: 'Ali Ahmad',
      role: UserRole.CO_MANAGER,
      approvalIdCode: 'ALIAHMAD@48291',
      isActive: true,
    } as never);
    const row = await service.lookupApprovalId('c1', 'ALIAHMAD@48291');
    expect(row).toEqual({
      id: 'm1',
      name: 'Ali Ahmad',
      role: UserRole.CO_MANAGER,
      approvalIdCode: 'ALIAHMAD@48291',
      active: true,
    });
  });

  it('returns 404 for invalid code', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.lookupApprovalId('c1', 'BAD@12345')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ApprovalIdService.regenerateApprovalId', () => {
  it('requires owner', async () => {
    const { service } = makeService();
    await expect(
      service.regenerateApprovalId({ id: 'u1', role: UserRole.GENERAL_MANAGER, clientId: 'c1' } as never, 'm1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only allows GM/CO_MANAGER targets', async () => {
    expect(REFUND_APPROVAL_ROLES).toEqual([UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER]);
  });
});
