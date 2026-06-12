import {
  BusinessType,
  PaymentMethod,
  Prisma,
  RefundApprovalMethod,
  RefundSourceType,
  RefundStatus,
  RefundType,
  RestockAction,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { RefundPrintService } from '../refunds/refund-print.service';
import { SettingsService } from '../settings/settings.service';

const CLIENT_A = 'client-a';
const REFUND_ID = 'refund-1';

function makeSettings(): SettingsService {
  return {
    get: jest.fn().mockResolvedValue({
      storeName: 'Nezhin Store',
      storeAddress: '123 Main St',
      storePhone: '+961 1 234567',
      currency: 'USD',
      receiptFooter: 'Thank you',
      receiptLogo: 'https://example.com/logo.png',
    }),
  } as unknown as SettingsService;
}

function makeBaseRefund(overrides: Record<string, unknown> = {}) {
  return {
    id: REFUND_ID,
    clientId: CLIENT_A,
    branchId: 'branch-1',
    businessType: BusinessType.RETAIL,
    sourceType: RefundSourceType.RETAIL_SALE,
    sourceId: 'sale-1',
    refundNumber: 'RF-001',
    refundType: RefundType.PARTIAL,
    status: RefundStatus.COMPLETED,
    reason: 'Customer return',
    notes: 'Item damaged',
    subtotal: new Prisma.Decimal(100),
    taxRefunded: new Prisma.Decimal(10),
    discountAdjusted: new Prisma.Decimal(5),
    totalRefunded: new Prisma.Decimal(105),
    paymentMethod: PaymentMethod.CASH,
    createdAt: new Date('2026-06-01T10:00:00Z'),
    completedAt: new Date('2026-06-01T10:05:00Z'),
    approvalMethod: RefundApprovalMethod.APPROVAL_ID,
    approvedByApprovalIdCodeSnapshot: 'ALIAHMAD@48291',
    approvedByNfcUidMaskedSnapshot: null,
    approvedAt: new Date('2026-06-01T10:04:00Z'),
    user: { name: 'Cashier One', username: 'cashier1' },
    approvedBy: { name: 'GM Ali', username: 'gmalii' },
    sale: {
      invoiceNumber: 'INV-100',
      customerId: 'cust-1',
      branchId: 'branch-1',
      items: [{ id: 'item-1', quantity: 2 }],
    },
    fnbOrder: null,
    items: [
      {
        id: 'ri-1',
        itemNameSnapshot: 'Widget',
        skuSnapshot: 'WDG-01',
        barcodeSnapshot: '1234567890',
        sourceItemId: 'item-1',
        quantity: 1,
        unitPriceSnapshot: new Prisma.Decimal(50),
        taxRefunded: new Prisma.Decimal(5),
        discountAdjusted: new Prisma.Decimal(2.5),
        amount: new Prisma.Decimal(52.5),
        restockAction: RestockAction.RESTOCK,
        restockQuantity: 1,
        reason: 'Defective unit',
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    ],
    ...overrides,
  };
}

function makePrisma(refundResult: unknown) {
  const mutatingMethods = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
  const prisma: Record<string, Record<string, jest.Mock>> = {
    refund: {
      findFirst: jest.fn().mockResolvedValue(refundResult),
    },
    client: {
      findFirst: jest.fn().mockResolvedValue({
        businessName: 'Acme Retail',
        email: 'store@acme.com',
        phone: '+961 70 000000',
      }),
    },
    branch: {
      findFirst: jest.fn().mockResolvedValue({
        name: 'Downtown',
        address: '456 Branch Ave',
        phone: '+961 71 111111',
      }),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue({
        name: 'Jane Customer',
        companyName: 'Jane Co',
        phone: '+961 76 222222',
        email: 'jane@example.com',
        address: '789 Customer Rd',
        taxNumber: 'TAX-123',
      }),
    },
  };

  for (const model of Object.values(prisma)) {
    for (const method of mutatingMethods) {
      model[method] = jest.fn();
    }
  }

  return prisma;
}

function makeService(refundResult: unknown) {
  const prisma = makePrisma(refundResult);
  const settings = makeSettings();
  const service = new RefundPrintService(prisma as never, settings);
  return { service, prisma, settings };
}

describe('RefundPrintService.getPrintData', () => {
  it('returns print data for refund belonging to current client', async () => {
    const { service, prisma } = makeService(makeBaseRefund());

    const data = await service.getPrintData(CLIENT_A, REFUND_ID);

    expect(prisma.refund.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REFUND_ID, clientId: CLIENT_A },
      }),
    );
    expect(data.refund.id).toBe(REFUND_ID);
    expect(data.refund.refundNumber).toBe('RF-001');
  });

  it('includes business, customer, refund, items, totals, and approval info', async () => {
    const { service } = makeService(makeBaseRefund());

    const data = await service.getPrintData(CLIENT_A, REFUND_ID);

    expect(data.company).toEqual(
      expect.objectContaining({
        businessName: 'Acme Retail',
        storeName: 'Nezhin Store',
        branchName: 'Downtown',
        phone: expect.any(String),
        logoUrl: 'https://example.com/logo.png',
      }),
    );
    expect(data.customer).toEqual(
      expect.objectContaining({
        name: 'Jane Customer',
        companyName: 'Jane Co',
        phone: '+961 76 222222',
        email: 'jane@example.com',
        taxNumber: 'TAX-123',
      }),
    );
    expect(data.refund).toEqual(
      expect.objectContaining({
        refundNumber: 'RF-001',
        refundType: RefundType.PARTIAL,
        status: RefundStatus.COMPLETED,
        sourceType: RefundSourceType.RETAIL_SALE,
        sourceTypeLabel: 'Retail Sale',
        sourceNumber: 'INV-100',
        reason: 'Customer return',
        paymentMethod: PaymentMethod.CASH,
        currency: 'USD',
      }),
    );
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toEqual(
      expect.objectContaining({
        itemName: 'Widget',
        sku: 'WDG-01',
        barcode: '1234567890',
        originalQuantity: 2,
        refundedQuantity: 1,
        restockAction: RestockAction.RESTOCK,
      }),
    );
    expect(data.totals).toEqual({
      subtotalRefunded: '100',
      taxRefunded: '10',
      discountAdjusted: '5',
      totalRefunded: '105',
    });
    expect(data.approval).toEqual(
      expect.objectContaining({
        createdBy: 'Cashier One',
        approvedBy: 'GM Ali',
        approvalMethod: RefundApprovalMethod.APPROVAL_ID,
        approvalMethodLabel: 'Manager Approval ID',
        approvalIdSnapshot: 'ALIAHMAD@48291',
      }),
    );
  });

  it('throws not found when refund belongs to another client', async () => {
    const { service, prisma } = makeService(null);

    await expect(service.getPrintData(CLIENT_A, REFUND_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.refund.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REFUND_ID, clientId: CLIENT_A },
      }),
    );
  });

  it('does not mutate refund, stock, payment, approval, or revenue records', async () => {
    const { service, prisma } = makeService(makeBaseRefund());

    await service.getPrintData(CLIENT_A, REFUND_ID);

    const mutatingMethods = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
    for (const model of Object.values(prisma)) {
      for (const method of mutatingMethods) {
        expect(model[method]).not.toHaveBeenCalled();
      }
    }
    expect(prisma.refund.findFirst).toHaveBeenCalledTimes(1);
  });

  it('uses "Refund Receipt" title for retail sale refunds', async () => {
    const { service } = makeService(
      makeBaseRefund({
        sourceType: RefundSourceType.RETAIL_SALE,
        businessType: BusinessType.RETAIL,
      }),
    );

    const data = await service.getPrintData(CLIENT_A, REFUND_ID);
    expect(data.title).toBe('Refund Receipt');
  });

  it('uses "Refund Receipt" title for F&B order refunds', async () => {
    const { service } = makeService(
      makeBaseRefund({
        sourceType: RefundSourceType.FNB_ORDER,
        businessType: BusinessType.FOOD_BEVERAGE,
        sale: null,
        fnbOrder: {
          orderNumber: 'ORD-55',
          customerId: 'cust-1',
          branchId: 'branch-1',
          items: [{ id: 'fnb-item-1', quantity: 3 }],
        },
      }),
    );

    const data = await service.getPrintData(CLIENT_A, REFUND_ID);
    expect(data.title).toBe('Refund Receipt');
    expect(data.refund.sourceTypeLabel).toBe('F&B Order');
    expect(data.refund.sourceNumber).toBe('ORD-55');
  });

  it('uses "Refund Receipt / Credit Note" title for wholesale invoice refunds', async () => {
    const { service } = makeService(
      makeBaseRefund({
        sourceType: RefundSourceType.WHOLESALE_INVOICE,
        businessType: BusinessType.WHOLESALE,
        sale: {
          invoiceNumber: 'INV-W-900',
          customerId: 'cust-1',
          branchId: 'branch-1',
          items: [],
        },
      }),
    );

    const data = await service.getPrintData(CLIENT_A, REFUND_ID);
    expect(data.title).toBe('Refund Receipt / Credit Note');
    expect(data.refund.sourceTypeLabel).toBe('Wholesale Invoice');
  });
});
