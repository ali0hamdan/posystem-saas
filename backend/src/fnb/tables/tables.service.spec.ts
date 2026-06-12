import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FnbTablesService } from './tables.service';

function makePrisma(over: Record<string, any> = {}) {
  return {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
    diningArea: {
      findFirst: jest.fn().mockResolvedValue({ id: 'area-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => ({ id: 'a1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => ({ id: 'a1', ...data })),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    restaurantTable: {
      findFirst: jest.fn().mockResolvedValue({ id: 't1', clientId: 'c', branchId: 'branch-1', status: 'AVAILABLE', isActive: true }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => ({ id: 't1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => ({ id: 't1', ...data })),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    fnbOrder: { count: jest.fn().mockResolvedValue(0) },
    ...over,
  };
}

function make(over: Record<string, any> = {}) {
  const prisma = makePrisma(over);
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new FnbTablesService(prisma as never, audit as never), prisma };
}

describe('FnbTablesService', () => {
  it('requires the branch header', async () => {
    const { service } = make();
    await expect(service.createTable({ label: 'T1' } as never, 'u', 'c', undefined)).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid branch', async () => {
    const { service } = make({ branch: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.createTable({ label: 'T1' } as never, 'u', 'c', 'bad')).rejects.toThrow(BadRequestException);
  });

  it('creates a table with defaults and tenant/branch scoping', async () => {
    const { service, prisma } = make();
    prisma.restaurantTable.findFirst.mockResolvedValue(null);
    await service.createTable({ label: '  T1  ' } as never, 'u', 'c', 'branch-1');
    const [args] = prisma.restaurantTable.create.mock.calls[0];
    expect(args.data).toMatchObject({ clientId: 'c', branchId: 'branch-1', label: 'T1', seats: 2, status: 'AVAILABLE', isActive: true });
  });

  it('revives a previously deleted table label instead of failing', async () => {
    const { service, prisma } = make();
    prisma.restaurantTable.findFirst.mockResolvedValue({ id: 'old', isActive: false });
    await service.createTable({ label: 'T1' } as never, 'u', 'c', 'branch-1');
    expect(prisma.restaurantTable.update).toHaveBeenCalled();
    expect(prisma.restaurantTable.create).not.toHaveBeenCalled();
  });

  it('rejects a dining area from another branch', async () => {
    const { service } = make({ diningArea: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.createTable({ label: 'T1', diningAreaId: 'a-other' } as never, 'u', 'c', 'branch-1')).rejects.toThrow(BadRequestException);
  });

  it('updateTable returns 404 for a missing/cross-tenant table', async () => {
    const { service } = make({ restaurantTable: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.updateTable('t-x', { seats: 4 } as never, 'u', 'c')).rejects.toThrow(NotFoundException);
  });

  it('setStatus updates the status', async () => {
    const { service, prisma } = make();
    await service.setStatus('t1', 'OCCUPIED', 'u', 'c');
    const [args] = prisma.restaurantTable.update.mock.calls[0];
    expect(args.data).toMatchObject({ status: 'OCCUPIED' });
  });

  it('removeTable hard-deletes when no open orders', async () => {
    const { service, prisma } = make();
    await service.removeTable('t1', 'u', 'c');
    expect(prisma.restaurantTable.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });

  it('removeTable is blocked when the table has open orders', async () => {
    const { service } = make({ fnbOrder: { count: jest.fn().mockResolvedValue(2) } });
    await expect(service.removeTable('t1', 'u', 'c')).rejects.toThrow(BadRequestException);
  });

  it('removeArea is blocked when the area still has tables', async () => {
    const { service } = make();
    const { prisma } = make();
    void prisma;
    // area has 3 tables
    const m = make({ restaurantTable: { ...makePrisma().restaurantTable, count: jest.fn().mockResolvedValue(3) } });
    await expect(m.service.removeArea('a1', 'u', 'c')).rejects.toThrow(BadRequestException);
  });

  it('listTables filters by clientId, branch and status', async () => {
    const { service, prisma } = make();
    await service.listTables('c', 'branch-1', { status: 'OCCUPIED' } as never);
    const [args] = prisma.restaurantTable.findMany.mock.calls[0];
    expect(args.where).toMatchObject({ clientId: 'c', branchId: 'branch-1', status: 'OCCUPIED', isActive: true });
  });

  it('createArea is branch-scoped', async () => {
    const { service, prisma } = make();
    await service.createArea({ name: 'Patio' } as never, 'u', 'c', 'branch-1');
    const [args] = prisma.diningArea.create.mock.calls[0];
    expect(args.data).toMatchObject({ clientId: 'c', branchId: 'branch-1', name: 'Patio' });
  });
});
