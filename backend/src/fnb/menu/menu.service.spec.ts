import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FnbMenuService } from './menu.service';

function make(over: Record<string, any> = {}) {
  const prisma: any = {
    menuItem: {
      findFirst: jest.fn().mockResolvedValue({ id: 'mi1', clientId: 'c' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'mi1' }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => ({ id: 'mi1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => ({ id: 'mi1', ...data })),
    },
    modifierGroup: {
      findFirst: jest.fn().mockResolvedValue({ id: 'g1', clientId: 'c' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'g1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation(({ data }: any) => ({ id: 'g1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => ({ id: 'g1', ...data })),
    },
    modifier: { deleteMany: jest.fn(), create: jest.fn() },
    menuItemModifierGroup: { deleteMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
    ...over,
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new FnbMenuService(prisma as never, audit as never), prisma };
}

describe('FnbMenuService', () => {
  it('createItem persists tenant id, price and default station', async () => {
    const { service, prisma } = make();
    await service.createItem({ name: '  Latte ', price: 4.5 } as never, 'u', 'c');
    const [args] = prisma.menuItem.create.mock.calls[0];
    expect(args.data).toMatchObject({ clientId: 'c', name: 'Latte', price: 4.5, prepStation: 'KITCHEN', isAvailable: true });
  });

  it('createItem rejects unknown modifier groups', async () => {
    const { service } = make({ modifierGroup: { count: jest.fn().mockResolvedValue(0) } });
    await expect(
      service.createItem({ name: 'X', price: 1, modifierGroupIds: ['11111111-1111-1111-1111-111111111111'] } as never, 'u', 'c'),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateItem returns 404 for a cross-tenant item', async () => {
    const { service } = make({ menuItem: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.updateItem('x', { price: 2 } as never, 'u', 'c')).rejects.toThrow(NotFoundException);
  });

  it('removeItem soft-deletes', async () => {
    const { service, prisma } = make();
    await service.removeItem('mi1', 'u', 'c');
    const [args] = prisma.menuItem.update.mock.calls[0];
    expect(args.data).toMatchObject({ isActive: false });
  });

  it('createGroup creates nested modifiers', async () => {
    const { service, prisma } = make();
    await service.createGroup({ name: 'Size', modifiers: [{ name: 'Large', priceDelta: 1 }] } as never, 'u', 'c');
    const [args] = prisma.modifierGroup.create.mock.calls[0];
    expect(args.data).toMatchObject({ clientId: 'c', name: 'Size' });
    expect(args.data.modifiers.create[0]).toMatchObject({ name: 'Large', priceDelta: 1, clientId: 'c' });
  });

  it('listItems filters by clientId and active by default', async () => {
    const { service, prisma } = make();
    await service.listItems('c', {} as never);
    const [args] = prisma.menuItem.findMany.mock.calls[0];
    expect(args.where).toMatchObject({ clientId: 'c', isActive: true });
  });
});
