import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  SalesmanIdService,
  normalizeSalesmanNameForCode,
} from '../users/salesman-id.service';

function makeService(existingCodes: string[] = []) {
  const codes = new Set(existingCodes);
  const prisma = {
    user: {
      findFirst: jest.fn(async ({ where }: { where: { clientId: string; salesmanIdCode?: string } }) =>
        where.salesmanIdCode && codes.has(where.salesmanIdCode) ? { id: 'existing' } : null,
      ),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new SalesmanIdService(prisma as never);
  return { service, prisma, codes };
}

describe('normalizeSalesmanNameForCode', () => {
  it('normalizes names to uppercase alphanumeric', () => {
    expect(normalizeSalesmanNameForCode('Ali Ahmad')).toBe('ALIAHMAD');
    expect(normalizeSalesmanNameForCode('Joe')).toBe('JOE');
    expect(normalizeSalesmanNameForCode('  ')).toBe('SALESMAN');
  });
});

describe('SalesmanIdService.generateSalesmanIdCode', () => {
  it('generates NAME-#### format', async () => {
    const { service } = makeService();
    const code = await service.generateSalesmanIdCode('client-1', 'Ali Ahmad');
    expect(code).toMatch(/^ALIAHMAD-\d{4}$/);
  });

  it('generates different codes for same name when one is taken', async () => {
    const taken = new Set<string>();
    const prisma = {
      user: {
        findFirst: jest.fn(async ({ where }: { where: { salesmanIdCode?: string } }) => {
          if (where.salesmanIdCode && taken.has(where.salesmanIdCode)) return { id: 'existing' };
          return null;
        }),
      },
    };
    const service = new SalesmanIdService(prisma as never);
    taken.add('ALIAHMAD-0000');
    const randomSpy = jest.spyOn(require('crypto'), 'randomInt');
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(1);
    const code = await service.generateSalesmanIdCode('client-1', 'Ali Ahmad');
    expect(code).toBe('ALIAHMAD-0001');
    randomSpy.mockRestore();
  });
});

describe('SalesmanIdService.lookupActiveSalesman', () => {
  it('rejects unknown code', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.lookupActiveSalesman('c1', 'UNKNOWN-1234')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns active salesman', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({
      id: 's1',
      name: 'Ali Ahmad',
      salesmanIdCode: 'ALIAHMAD-4821',
      isActive: true,
    } as never);
    const row = await service.lookupActiveSalesman('c1', 'aliahmad-4821');
    expect(row.salesmanIdCode).toBe('ALIAHMAD-4821');
  });
});

describe('SalesmanIdService.regenerateSalesmanId', () => {
  it('requires owner or general manager', async () => {
    const { service } = makeService();
    await expect(
      service.regenerateSalesmanId({ id: 'u1', role: UserRole.CASHIER, clientId: 'c1' } as never, 's1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
