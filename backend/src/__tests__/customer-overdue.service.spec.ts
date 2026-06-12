import {
  NotificationType,
  PaymentStatus,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { CustomerOverdueService } from '../notifications/customer-overdue.service';
import { NotificationService } from '../notifications/notification.service';

const MS_PER_DAY = 86_400_000;

function makePrisma(over: Record<string, unknown> = {}) {
  return {
    client: { findMany: jest.fn().mockResolvedValue([]) },
    sale: { findMany: jest.fn().mockResolvedValue([]) },
    customerOverdueNotificationLog: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    ...over,
  };
}

describe('CustomerOverdueService', () => {
  const notifications = {
    notifyCustomerOverdue: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not include sales with future due dates', async () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const prisma = makePrisma({
      sale: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sale-1',
            clientId: 'c1',
            customerId: 'cust-1',
            invoiceNumber: 'INV-001',
            createdAt: new Date(now.getTime() - 5 * MS_PER_DAY),
            total: new Prisma.Decimal(100),
            paymentStatus: PaymentStatus.UNPAID,
            status: SaleStatus.COMPLETED,
            payments: [],
            customer: {
              name: 'Acme',
              phone: null,
              email: null,
              creditProfile: { paymentTermsDays: 30 },
            },
            branch: { name: 'Main' },
          },
        ]),
      },
    });

    const service = new CustomerOverdueService(prisma as never, notifications);
    const result = await service.findOverdueSales('c1', 30, now);
    expect(result).toHaveLength(0);
  });

  it('includes overdue unpaid sales with balance due', async () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const prisma = makePrisma({
      sale: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sale-1',
            clientId: 'c1',
            customerId: 'cust-1',
            invoiceNumber: 'INV-002',
            createdAt: new Date('2026-06-01T12:00:00Z'),
            total: new Prisma.Decimal(250),
            paymentStatus: PaymentStatus.PARTIAL,
            status: SaleStatus.COMPLETED,
            payments: [{ amount: new Prisma.Decimal(50) }],
            customer: {
              name: 'Beta Corp',
              phone: '+123',
              email: 'a@b.com',
              creditProfile: { paymentTermsDays: 30 },
            },
            branch: { name: 'Branch A' },
          },
        ]),
      },
    });

    const service = new CustomerOverdueService(prisma as never, notifications);
    const result = await service.findOverdueSales('c1', 30, now);

    expect(result).toHaveLength(1);
    expect(result[0].invoiceNumber).toBe('INV-002');
    expect(result[0].amountDue.toString()).toBe('200');
    expect(result[0].daysOverdue).toBeGreaterThan(0);
  });

  it('skips sales already logged for CUSTOMER_OVERDUE', async () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const prisma = makePrisma({
      sale: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sale-dup',
            clientId: 'c1',
            customerId: 'cust-1',
            invoiceNumber: 'INV-003',
            createdAt: new Date('2026-06-01T12:00:00Z'),
            total: new Prisma.Decimal(100),
            paymentStatus: PaymentStatus.UNPAID,
            status: SaleStatus.COMPLETED,
            payments: [],
            customer: {
              name: 'Dup',
              phone: null,
              email: null,
              creditProfile: null,
            },
            branch: null,
          },
        ]),
      },
      customerOverdueNotificationLog: {
        findMany: jest.fn().mockResolvedValue([{ sourceId: 'sale-dup' }]),
        create: jest.fn(),
      },
    });

    const service = new CustomerOverdueService(prisma as never, notifications);
    const result = await service.findOverdueSales('c1', 30, now);
    expect(result).toHaveLength(0);
  });

  it('runCustomerOverdueCheck sends notification once and dedupes', async () => {
    const now = new Date();
    const createdAt = new Date(now.getTime() - 45 * MS_PER_DAY);

    const overdueSale = {
      id: 'sale-send',
      clientId: 'c1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-004',
      createdAt,
      total: new Prisma.Decimal(80),
      paymentStatus: PaymentStatus.UNPAID,
      status: SaleStatus.COMPLETED,
      payments: [],
      customer: {
        name: 'Send Co',
        phone: null,
        email: null,
        creditProfile: { paymentTermsDays: 30 },
      },
      branch: { name: 'HQ' },
    };

    const prisma = makePrisma({
      client: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1',
            storeSettings: {
              emailNotificationsEnabled: true,
              notifyCustomerOverdue: true,
              defaultPaymentTermsDays: 30,
            },
          },
        ]),
      },
      sale: { findMany: jest.fn().mockResolvedValue([overdueSale]) },
      customerOverdueNotificationLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    });

    const service = new CustomerOverdueService(prisma as never, notifications);
    const sent = await service.runCustomerOverdueCheck();

    expect(sent).toBe(1);
    expect(prisma.customerOverdueNotificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: 'c1',
        customerId: 'cust-1',
        sourceType: 'SALE',
        sourceId: 'sale-send',
        notificationType: NotificationType.CUSTOMER_OVERDUE,
      }),
    });
    expect(notifications.notifyCustomerOverdue).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'c1',
        customerName: 'Send Co',
        invoiceNumber: 'INV-004',
      }),
    );
  });

  it('does not send when client notifyCustomerOverdue is disabled', async () => {
    const prisma = makePrisma({
      client: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1',
            storeSettings: {
              emailNotificationsEnabled: true,
              notifyCustomerOverdue: false,
              defaultPaymentTermsDays: 30,
            },
          },
        ]),
      },
    });

    const service = new CustomerOverdueService(prisma as never, notifications);
    const sent = await service.runCustomerOverdueCheck();
    expect(sent).toBe(0);
    expect(prisma.sale.findMany).not.toHaveBeenCalled();
  });
});
