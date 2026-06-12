import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BusinessType,
  CommissionSourceType,
  CommissionStatus,
  PaymentStatus,
  Prisma,
  SaleStatus,
  SalesCommissionType,
  UserRole,
} from '@prisma/client';
import { SalesCommissionService } from '../commissions/sales-commission.service';
import { PERMISSIONS } from '../permissions/permission.types';

const D = (n: number | string) => new Prisma.Decimal(n);

function makeService(overrides: { prisma?: Record<string, unknown>; permissions?: Record<string, unknown> } = {}) {
  const prisma = {
    user: { findFirst: jest.fn(), update: jest.fn() },
    sale: { findFirst: jest.fn() },
    salesCommission: { upsert: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    ...(overrides.prisma ?? {}),
  };
  const permissions = {
    hasPermission: jest.fn((role: UserRole, perm: string) => {
      if (role === UserRole.OWNER) return true;
      if (role === UserRole.SALESMAN && perm === PERMISSIONS.COMMISSIONS_VIEW_OWN) return true;
      return false;
    }),
    hasAnyPermission: jest.fn(),
    ...(overrides.permissions ?? {}),
  };
  const salesmanId = {
    lookupActiveSalesman: jest.fn(),
    generateSalesmanIdCode: jest.fn(),
    ensureSalesmanHasCode: jest.fn(),
    searchActiveSalesmen: jest.fn(),
    regenerateSalesmanId: jest.fn(),
  };
  const service = new SalesCommissionService(prisma as never, permissions as never, salesmanId as never);
  return { service, prisma, permissions, salesmanId };
}

describe('SalesCommissionService.computeRefundAdjustment', () => {
  const { service } = makeService();

  it('reduces percentage commission proportionally on partial refund', () => {
    const result = service.computeRefundAdjustment(
      SalesCommissionType.PERCENTAGE,
      D(1000),
      D(50),
      D(200),
    );
    expect(result.adjusted.toString()).toBe('10');
    expect(result.final.toString()).toBe('40');
  });

  it('cancels fixed commission on full refund', () => {
    const result = service.computeRefundAdjustment(
      SalesCommissionType.FIXED_PER_SALE,
      D(100),
      D(5),
      D(100),
    );
    expect(result.adjusted.toString()).toBe('5');
    expect(result.final.toString()).toBe('0');
  });

  it('keeps fixed commission on partial refund', () => {
    const result = service.computeRefundAdjustment(
      SalesCommissionType.FIXED_PER_SALE,
      D(100),
      D(5),
      D(20),
    );
    expect(result.adjusted.toString()).toBe('0');
    expect(result.final.toString()).toBe('5');
  });
});

describe('SalesCommissionService.resolveSalesmanForSale', () => {
  it('requires salesman id code for cashier', async () => {
    const { service } = makeService();
    await expect(
      service.resolveSalesmanForSale(
        { id: 'cashier', role: UserRole.CASHIER, clientId: 'c1' } as never,
        'c1',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves cashier sale from salesman id code', async () => {
    const { service, salesmanId } = makeService();
    salesmanId.lookupActiveSalesman.mockResolvedValue({ id: 's1', name: 'Ali', salesmanIdCode: 'ALIAHMAD-4821' });
    const id = await service.resolveSalesmanForSale(
      { id: 'cashier', role: UserRole.CASHIER, clientId: 'c1' } as never,
      'c1',
      { salesmanIdCode: 'ALIAHMAD-4821' },
    );
    expect(id).toBe('s1');
  });
});

describe('SalesCommissionService.resolveSalesmanId', () => {
  it('assigns salesman to self for SALESMAN role', async () => {
    const { service } = makeService();
    const id = await service.resolveSalesmanId(
      'other-id',
      { id: 'self-id', role: UserRole.SALESMAN, clientId: 'c1' } as never,
      'c1',
    );
    expect(id).toBe('self-id');
  });

  it('requires salesman id for cashier without assignment', async () => {
    const { service } = makeService();
    await expect(
      service.resolveSalesmanId(
        undefined,
        { id: 'cashier', role: UserRole.CASHIER, clientId: 'c1' } as never,
        'c1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SalesCommissionService.calculateCommissionForSale', () => {
  it('creates 5% commission for paid retail sale', async () => {
    const { service, prisma } = makeService();
    prisma.sale.findFirst.mockResolvedValue({
      id: 'sale-1',
      clientId: 'c1',
      branchId: 'b1',
      invoiceNumber: 'INV-1',
      status: SaleStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      salesmanId: 's1',
      sourceQuotationId: null,
      sourceProformaId: null,
      subtotal: D(1000),
      discountTotal: D(0),
      taxTotal: D(0),
      total: D(1000),
      client: { businessType: BusinessType.RETAIL },
      refunds: [],
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 's1',
      commissionEnabled: true,
      commissionType: SalesCommissionType.PERCENTAGE,
      commissionRate: D(5),
      fixedCommissionAmount: null,
    });
    prisma.salesCommission.upsert.mockResolvedValue({});

    await service.calculateCommissionForSale('sale-1', 'c1');

    expect(prisma.salesCommission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceType: CommissionSourceType.RETAIL_SALE,
          commissionAmount: D(50),
          finalCommissionAmount: D(50),
          status: CommissionStatus.PENDING,
        }),
      }),
    );
  });

  it('skips commission when sale is unpaid', async () => {
    const { service, prisma } = makeService();
    prisma.sale.findFirst.mockResolvedValue({
      id: 'sale-1',
      paymentStatus: PaymentStatus.UNPAID,
      status: SaleStatus.COMPLETED,
      salesmanId: 's1',
      client: { businessType: BusinessType.RETAIL },
      refunds: [],
    });

    await service.calculateCommissionForSale('sale-1', 'c1');
    expect(prisma.salesCommission.upsert).not.toHaveBeenCalled();
  });
});
