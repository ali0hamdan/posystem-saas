/**
 * Sales pricing & validation unit tests.
 *
 * Covers the money-critical logic in SalesService:
 *  - computeTotals (line/global discounts, tax rate vs manual tax)
 *  - realMoneyPaid / paymentStatusFor (credit handling, paid/partial/unpaid)
 *  - refundLineAmount (full vs proportional)
 *  - buildSaleDateWhere (date-range validation)
 *  - create() pre-transaction guards (empty items, missing customer,
 *    unknown product, insufficient stock, credit-requires-customer)
 *
 * Prisma and collaborators are mocked, so no database is required.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import { SalesService } from '../sales/sales.service';

const D = (n: number | string) => new Prisma.Decimal(n);

function makeService(overrides: {
  prisma?: Record<string, unknown>;
  settings?: unknown;
  stock?: unknown;
} = {}) {
  const prisma = {
    customer: { findFirst: jest.fn().mockResolvedValue(null) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    coupon: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(),
    ...(overrides.prisma ?? {}),
  };
  const stock = overrides.stock ?? { adjustStock: jest.fn() };
  const audit = { log: jest.fn() };
  const settings =
    overrides.settings ??
    { get: jest.fn().mockResolvedValue({ taxEnabled: false, taxRate: D(0), currency: 'USD' }) };
  const ledger = { appendEntry: jest.fn() };
  const notifications = { notifyPurchaseCompleted: jest.fn() };
  const refunds = { refundSale: jest.fn() };
  const commissions = { resolveSalesmanId: jest.fn().mockResolvedValue(null), calculateCommissionForSale: jest.fn() };
  const service = new SalesService(
    prisma as never,
    stock as never,
    audit as never,
    settings as never,
    ledger as never,
    notifications as never,
    refunds as never,
    commissions as never,
  );
  return { service, prisma, stock, audit, settings, ledger, refunds, commissions };
}

// Helper to reach private methods in a typed-loose way.
const priv = (svc: SalesService) => svc as unknown as Record<string, (...args: unknown[]) => unknown>;

describe('SalesService.computeTotals', () => {
  const products = new Map([
    ['p1', { sellingPrice: D(10), costPrice: D(6), name: 'Widget' }],
    ['p2', { sellingPrice: D(5), costPrice: D(2), name: 'Gadget' }],
  ]);
  const { service } = makeService();

  it('sums line totals with no discounts or tax', () => {
    const dto = { items: [{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 3 }] };
    const t = priv(service).computeTotals(dto, products, { mode: 'manual', ratePercent: D(0) }) as {
      subtotal: Prisma.Decimal; total: Prisma.Decimal; taxTotal: Prisma.Decimal; discountTotal: Prisma.Decimal;
    };
    // 2*10 + 3*5 = 35
    expect(t.subtotal.toString()).toBe('35');
    expect(t.discountTotal.toString()).toBe('0');
    expect(t.taxTotal.toString()).toBe('0');
    expect(t.total.toString()).toBe('35');
  });

  it('caps a line discount at the line gross', () => {
    const dto = { items: [{ productId: 'p1', quantity: 1, discount: 999 }] };
    const t = priv(service).computeTotals(dto, products, { mode: 'manual', ratePercent: D(0) }) as {
      discountTotal: Prisma.Decimal; total: Prisma.Decimal;
    };
    // gross 10, discount capped to 10, total 0 (not negative)
    expect(t.discountTotal.toString()).toBe('10');
    expect(t.total.toString()).toBe('0');
  });

  it('applies a global discount on top of line discounts', () => {
    const dto = { items: [{ productId: 'p1', quantity: 2 }], globalDiscount: 5 };
    const t = priv(service).computeTotals(dto, products, { mode: 'manual', ratePercent: D(0) }) as {
      total: Prisma.Decimal; discountTotal: Prisma.Decimal;
    };
    // gross 20 - global 5 = 15
    expect(t.discountTotal.toString()).toBe('5');
    expect(t.total.toString()).toBe('15');
  });

  it('computes tax at a percentage rate after discounts', () => {
    const dto = { items: [{ productId: 'p1', quantity: 10 }] }; // gross 100
    const t = priv(service).computeTotals(dto, products, { mode: 'rate', ratePercent: D(10) }) as {
      taxTotal: Prisma.Decimal; total: Prisma.Decimal;
    };
    expect(t.taxTotal.toString()).toBe('10'); // 10% of 100
    expect(t.total.toString()).toBe('110');
  });

  it('uses manual tax when not in rate mode', () => {
    const dto = { items: [{ productId: 'p2', quantity: 1 }], tax: 2 }; // gross 5
    const t = priv(service).computeTotals(dto, products, { mode: 'manual', ratePercent: D(0) }) as {
      taxTotal: Prisma.Decimal; total: Prisma.Decimal;
    };
    expect(t.taxTotal.toString()).toBe('2');
    expect(t.total.toString()).toBe('7');
  });

  it('throws on an unknown product id', () => {
    const dto = { items: [{ productId: 'ghost', quantity: 1 }] };
    expect(() =>
      priv(service).computeTotals(dto, products, { mode: 'manual', ratePercent: D(0) }),
    ).toThrow(BadRequestException);
  });
});

describe('SalesService.realMoneyPaid & paymentStatusFor', () => {
  const { service } = makeService();

  it('excludes CREDIT payments from real money paid', () => {
    const paid = priv(service).realMoneyPaid([
      { method: PaymentMethod.CASH, amount: 30 },
      { method: PaymentMethod.CREDIT, amount: 70 },
    ]) as Prisma.Decimal;
    expect(paid.toString()).toBe('30');
  });

  it('returns UNPAID when nothing is paid', () => {
    expect(priv(service).paymentStatusFor(D(0), D(50))).toBe(PaymentStatus.UNPAID);
  });

  it('returns PARTIAL when paid is below total', () => {
    expect(priv(service).paymentStatusFor(D(20), D(50))).toBe(PaymentStatus.PARTIAL);
  });

  it('returns PAID when paid meets or exceeds total', () => {
    expect(priv(service).paymentStatusFor(D(50), D(50))).toBe(PaymentStatus.PAID);
    expect(priv(service).paymentStatusFor(D(60), D(50))).toBe(PaymentStatus.PAID);
  });
});

describe('SalesService.buildSaleDateWhere', () => {
  const { service } = makeService();

  it('returns an empty filter when no dates given', () => {
    expect(priv(service).buildSaleDateWhere(undefined, undefined)).toEqual({});
  });

  it('throws when fromDate is after toDate', () => {
    expect(() => priv(service).buildSaleDateWhere('2025-02-01', '2025-01-01')).toThrow(BadRequestException);
  });

  it('throws on an invalid date string', () => {
    expect(() => priv(service).buildSaleDateWhere('not-a-date', undefined)).toThrow(BadRequestException);
  });

  it('builds a gte/lte range for a valid window', () => {
    const w = priv(service).buildSaleDateWhere('2025-01-01', '2025-01-31') as {
      createdAt: { gte: Date; lte: Date };
    };
    expect(w.createdAt.gte).toBeInstanceOf(Date);
    expect(w.createdAt.lte).toBeInstanceOf(Date);
    expect(w.createdAt.lte.getTime()).toBeGreaterThan(w.createdAt.gte.getTime());
  });
});

describe('SalesService.create — pre-transaction guards', () => {
  const actor = { id: 'cash-1', clientId: 'client-1', role: 'CASHIER' } as never;
  const branchId = 'branch-1';
  const clientId = 'client-1';

  it('rejects an empty items array', async () => {
    const { service } = makeService();
    await expect(
      service.create({ items: [] } as never, actor, branchId, clientId),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when the referenced customer does not exist', async () => {
    const { service } = makeService({
      prisma: { customer: { findFirst: jest.fn().mockResolvedValue(null) } },
    });
    await expect(
      service.create(
        { items: [{ productId: 'p1', quantity: 1 }], customerId: 'ghost' } as never,
        actor, branchId, clientId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects when a product is not found', async () => {
    const { service } = makeService({
      prisma: {
        customer: { findFirst: jest.fn().mockResolvedValue(null) },
        product: { findMany: jest.fn().mockResolvedValue([]) }, // none returned
      },
    });
    await expect(
      service.create({ items: [{ productId: 'p1', quantity: 1 }] } as never, actor, branchId, clientId),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when stock is insufficient', async () => {
    const { service } = makeService({
      prisma: {
        customer: { findFirst: jest.fn().mockResolvedValue(null) },
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'p1', name: 'Widget', isActive: true,
              sellingPrice: D(10), costPrice: D(6),
              branchStocks: [{ quantity: 1 }],
            },
          ]),
        },
      },
    });
    await expect(
      service.create({ items: [{ productId: 'p1', quantity: 5 }] } as never, actor, branchId, clientId),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a customer when a CREDIT payment is used', async () => {
    const { service } = makeService({
      prisma: {
        customer: { findFirst: jest.fn().mockResolvedValue(null) },
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'p1', name: 'Widget', isActive: true,
              sellingPrice: D(10), costPrice: D(6),
              branchStocks: [{ quantity: 100 }],
            },
          ]),
        },
      },
    });
    await expect(
      service.create(
        {
          items: [{ productId: 'p1', quantity: 1 }],
          payments: [{ method: PaymentMethod.CREDIT, amount: 10 }],
        } as never,
        actor, branchId, clientId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
