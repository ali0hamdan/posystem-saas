/**
 * Tenant Isolation Unit Tests
 *
 * Verifies that every service that touches client-owned data filters by
 * the authenticated user's clientId, so that no client can ever read or
 * mutate another client's records.
 *
 * Strategy: mock PrismaService to return null/[] when the WHERE clause
 * does NOT match — exactly what the database would do when the record
 * belongs to a different tenant.  Each test then asserts that the service
 * throws NotFoundException (or ForbiddenException) rather than leaking data.
 */

import { NotFoundException, BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIENT_A = 'client-a-uuid';
const CLIENT_B = 'client-b-uuid';

/** A minimal SafeUser for tenant A */
function makeUser(overrides: Partial<{
  id: string; clientId: string; role: string; branchId: string | null;
}> = {}) {
  return {
    id: 'user-a',
    clientId: CLIENT_A,
    role: 'OWNER',
    branchId: null,
    username: 'owner_a',
    name: 'Owner A',
    isActive: true,
    email: 'owner@client-a.test',
    loginAttempts: 0,
    lockedUntil: null,
    refreshTokenHash: null,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as import('../auth/types/safe-user.type').SafeUser;
}

/** Prisma mock that returns null for findFirst/findUnique (simulates cross-tenant miss) */
function makePrismaMock(overrides: Record<string, unknown> = {}) {
  const base = {
    sale: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    category: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    branch: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    coupon: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    expense: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    stockTransfer: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    supplier: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    shift: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    stockMovement: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    purchaseOrder: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(base)),
    ...overrides,
  };
  return base;
}

// ---------------------------------------------------------------------------
// Sales — cross-tenant data leak was the critical finding
// ---------------------------------------------------------------------------

describe('Sales Service — tenant isolation', () => {
  let service: import('../sales/sales.service').SalesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    // Dynamically import to avoid circular dependency issues in unit test context
    const { SalesService } = await import('../sales/sales.service');
    service = new SalesService(
      prisma as never,
      { adjustStock: jest.fn() } as never,
      { log: jest.fn() } as never,
      { get: jest.fn().mockResolvedValue({ taxRate: 0, currency: 'USD' }) } as never,
      { recordSale: jest.fn(), recordRefund: jest.fn() } as never,
    );
  });

  it('findOne: returns NotFoundException when sale belongs to another tenant', async () => {
    // prisma.sale.findFirst returns null → record owned by CLIENT_B not visible to CLIENT_A user
    prisma.sale.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('sale-from-client-b', makeUser(), 'branch-a'),
    ).rejects.toThrow(NotFoundException);
  });

  it('findOne: passes clientId in WHERE clause', async () => {
    prisma.sale.findFirst.mockResolvedValue(null);
    const user = makeUser({ clientId: CLIENT_A });

    await expect(service.findOne('any-id', user, 'branch-a')).rejects.toThrow(NotFoundException);

    const [whereArg] = prisma.sale.findFirst.mock.calls[0];
    expect(whereArg.where).toMatchObject({ id: 'any-id', clientId: CLIENT_A });
  });

  it('findAll: passes clientId in WHERE clause', async () => {
    const user = makeUser({ clientId: CLIENT_A, role: 'ADMIN' });
    prisma.sale.findMany.mockResolvedValue([]);
    prisma.sale.count.mockResolvedValue(0);

    await service.findAll(user, { page: 1, limit: 20 } as never, 'branch-a');

    const [args] = prisma.sale.findMany.mock.calls[0];
    expect(args.where).toMatchObject({ clientId: CLIENT_A });
  });

  it('createRefund: returns NotFoundException for sale from another tenant', async () => {
    prisma.sale.findFirst.mockResolvedValue(null);

    await expect(
      service.createRefund('sale-from-client-b', { reason: 'test', full: true } as never, makeUser()),
    ).rejects.toThrow(NotFoundException);
  });

  it('createRefund: passes clientId in initial sale lookup', async () => {
    prisma.sale.findFirst.mockResolvedValue(null);
    const user = makeUser({ clientId: CLIENT_A });

    await expect(
      service.createRefund('any-sale', { reason: 'r', full: true } as never, user),
    ).rejects.toThrow(NotFoundException);

    const [whereArg] = prisma.sale.findFirst.mock.calls[0];
    expect(whereArg.where).toMatchObject({ id: 'any-sale', clientId: CLIENT_A });
  });
});

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

describe('Coupons Service — tenant isolation', () => {
  let service: import('../coupons/coupons.service').CouponsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const { CouponsService } = await import('../coupons/coupons.service');
    service = new CouponsService(prisma as never);
  });

  it('update: updateMany includes clientId in WHERE', async () => {
    const user = makeUser({ clientId: CLIENT_A });
    prisma.coupon.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.update(user, 'coupon-b', {})).rejects.toThrow(NotFoundException);

    const [args] = prisma.coupon.updateMany.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'coupon-b', clientId: CLIENT_A });
  });

  it('remove: deleteMany includes clientId in WHERE', async () => {
    const user = makeUser({ clientId: CLIENT_A });
    prisma.coupon.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(user, 'coupon-b')).rejects.toThrow(NotFoundException);

    const [args] = prisma.coupon.deleteMany.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'coupon-b', clientId: CLIENT_A });
  });
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

describe('Expenses Service — tenant isolation', () => {
  let service: import('../expenses/expenses.service').ExpensesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const { ExpensesService } = await import('../expenses/expenses.service');
    service = new ExpensesService(prisma as never, { log: jest.fn() } as never);
  });

  it('findOne: returns NotFoundException when expense belongs to another tenant', async () => {
    prisma.expense.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('expense-from-b', makeUser()),
    ).rejects.toThrow(NotFoundException);

    const [args] = prisma.expense.findFirst.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'expense-from-b', clientId: CLIENT_A });
  });

  it('remove: deleteMany includes clientId in WHERE', async () => {
    // Simulate findFirst returning the record (passes ownership check),
    // then deleteMany removes it only if clientId matches.
    prisma.expense.findFirst.mockResolvedValue({
      id: 'expense-x',
      clientId: CLIENT_A,
      title: 'test',
      amount: { toString: () => '10' },
      createdById: 'user-a',
      shiftId: null,
    });
    prisma.expense.deleteMany.mockResolvedValue({ count: 1 });

    await service.remove('expense-x', makeUser());

    const [args] = prisma.expense.deleteMany.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'expense-x', clientId: CLIENT_A });
  });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

describe('Products Service — tenant isolation', () => {
  let service: import('../products/products.service').ProductsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock({
      branchStock: { findMany: jest.fn().mockResolvedValue([]) },
      stockMovement: { create: jest.fn() },
    });
    const { ProductsService } = await import('../products/products.service');
    service = new ProductsService(
      prisma as never,
      { log: jest.fn() } as never,
      { adjustStock: jest.fn() } as never,
      { get: jest.fn().mockResolvedValue({ taxRate: 0, currency: 'USD' }) } as never,
    );
  });

  it('findOne: passes clientId so cross-tenant access returns 404', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('product-from-b', 'OWNER' as never, '' as never, CLIENT_A),
    ).rejects.toThrow(NotFoundException);

    const [args] = prisma.product.findFirst.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'product-from-b', clientId: CLIENT_A });
  });
});

// ---------------------------------------------------------------------------
// Stock Transfers
// ---------------------------------------------------------------------------

describe('Stock Transfers Service — tenant isolation', () => {
  let service: import('../stock-transfers/stock-transfers.service').StockTransfersService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock({ userBranch: { findMany: jest.fn().mockResolvedValue([]) } });
    const { StockTransfersService } = await import('../stock-transfers/stock-transfers.service');
    service = new StockTransfersService(prisma as never, { adjustStock: jest.fn() } as never);
  });

  it('findOne: returns NotFoundException when transfer belongs to another tenant', async () => {
    prisma.stockTransfer.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('transfer-from-b', makeUser()),
    ).rejects.toThrow(NotFoundException);

    const [args] = prisma.stockTransfer.findFirst.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'transfer-from-b', clientId: CLIENT_A });
  });
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

describe('Customers Service — tenant isolation', () => {
  let service: import('../customers/customers.service').CustomersService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock({
      customerLedger: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    });
    const { CustomersService } = await import('../customers/customers.service');
    service = new CustomersService(prisma as never, { log: jest.fn() } as never);
  });

  it('findOne: passes clientId so cross-tenant access returns 404', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(service.findOne('cust-from-b', CLIENT_A)).rejects.toThrow(NotFoundException);

    const [args] = prisma.customer.findFirst.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'cust-from-b', clientId: CLIENT_A });
  });
});

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

describe('Suppliers Service — tenant isolation', () => {
  let service: import('../suppliers/suppliers.service').SuppliersService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const { SuppliersService } = await import('../suppliers/suppliers.service');
    service = new SuppliersService(prisma as never, { log: jest.fn() } as never);
  });

  it('findOne: passes clientId so cross-tenant access returns 404', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);

    await expect(service.findOne('supplier-from-b', CLIENT_A)).rejects.toThrow(NotFoundException);

    const [args] = prisma.supplier.findFirst.mock.calls[0];
    expect(args.where).toMatchObject({ id: 'supplier-from-b', clientId: CLIENT_A });
  });
});
