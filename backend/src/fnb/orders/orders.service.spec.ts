import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FnbOrdersService } from './orders.service';

const Dec = (n: number) => new Prisma.Decimal(n);

function make(over: Record<string, any> = {}) {
  const prisma: any = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'b' }) },
    restaurantTable: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }), update: jest.fn() },
    menuItem: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', name: 'Latte', price: Dec(4) }) },
    modifier: { findMany: jest.fn().mockResolvedValue([]) },
    fnbOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'o1', clientId: 'c', branchId: 'b', status: 'OPEN', tableId: 't1' }),
      create: jest.fn().mockResolvedValue({ id: 'o1', orderNumber: 'ORD-X', type: 'DINE_IN', status: 'OPEN', branchId: 'b', tableId: 't1' }),
      update: jest.fn(),
    },
    fnbOrderItem: {
      create: jest.fn().mockImplementation(({ data }: any) => ({ id: 'i1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'i1', unitPrice: Dec(4), modifiersTotal: Dec(0) }),
      update: jest.fn(), delete: jest.fn(), updateMany: jest.fn(),
    },
    kitchenTicket: { create: jest.fn() },
    recipe: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  };
  prisma.$transaction = jest.fn().mockImplementation((fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.resolve(fn)));
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const settings = { get: jest.fn().mockResolvedValue({ taxEnabled: false, taxRate: Dec(0) }) };
  const stock = { adjustStock: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notifyPurchaseCompleted: jest.fn().mockResolvedValue(undefined) };
  const service = new FnbOrdersService(prisma as never, audit as never, settings as never, stock as never, notifications as never);
  return { service, prisma, stock };
}
const user = { id: 'u', clientId: 'c' };

describe('FnbOrdersService', () => {
  it('dine-in order requires a table', async () => {
    const { service } = make();
    await expect(service.open({ type: 'DINE_IN' } as never, user, 'b')).rejects.toThrow(BadRequestException);
  });

  it('opening a dine-in order marks the table occupied', async () => {
    const { service, prisma } = make();
    await service.open({ type: 'DINE_IN', tableId: 't1' } as never, user, 'b');
    const call = prisma.restaurantTable.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: 'OCCUPIED' });
  });

  it('addItem computes lineTotal = (price + modifiers) * qty', async () => {
    const { service, prisma } = make();
    await service.addItem('o1', { menuItemId: 'm1', quantity: 2 } as never, user);
    const data = prisma.fnbOrderItem.create.mock.calls[0][0].data;
    expect(D(data.lineTotal)).toBe('8');
    expect(D(data.unitPrice)).toBe('4');
    function D(x: any) { return x.toString(); }
  });

  it('addItem rejects an unknown menu item', async () => {
    const { service } = make({ menuItem: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.addItem('o1', { menuItemId: 'x' } as never, user)).rejects.toThrow(BadRequestException);
  });

  it('sendToKitchen rejects when nothing is pending', async () => {
    const { service } = make();
    await expect(service.sendToKitchen('o1', user)).rejects.toThrow(BadRequestException);
  });

  it('settle completes the order and frees the table', async () => {
    const { service, prisma } = make({
      fnbOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'o1', clientId: 'c', branchId: 'b', status: 'SENT', tableId: 't1' }),
        update: jest.fn(),
      },
    });
    await service.settle('o1', { paymentMethod: 'CASH' } as never, user);
    const orderUpd = prisma.fnbOrder.update.mock.calls.find((c: any) => c[0].data.status === 'COMPLETED');
    expect(orderUpd).toBeTruthy();
    const tableUpd = prisma.restaurantTable.update.mock.calls.find((c: any) => c[0].data.status === 'AVAILABLE');
    expect(tableUpd).toBeTruthy();
  });

  it('settle deducts recipe ingredients from stock', async () => {
    const { service, stock } = make({
      fnbOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'o1', clientId: 'c', branchId: 'b', status: 'SERVED', tableId: null, orderNumber: 'ORD-9', items: [{ menuItemId: 'm1', quantity: 2, status: 'SERVED' }] }),
        update: jest.fn(),
      },
      recipe: { findMany: jest.fn().mockResolvedValue([{ menuItemId: 'm1', ingredients: [{ productId: 'p1', quantity: 1.5 }] }]) },
    });
    await service.settle('o1', {} as never, user);
    const call = stock.adjustStock.mock.calls.find((c: any) => c[0].productId === 'p1');
    expect(call).toBeTruthy();
    expect(call[0].quantityChange).toBe(-3);
  });
});
