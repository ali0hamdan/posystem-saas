/**
 * Stock adjustment unit tests for StockService.runAdjustment (via adjustStock).
 * A mock "db" (transactional client) is injected so logic runs without a DB.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { StockService } from '../stock/stock.service';

function makeDb(opts: { branch?: unknown; product?: unknown; stockRow?: unknown } = {}) {
  const branch = 'branch' in opts ? opts.branch : { id: 'branch-1' };
  const product = 'product' in opts ? opts.product : { id: 'p1', name: 'Widget' };
  const stockRow = 'stockRow' in opts ? opts.stockRow : { quantity: 10, minStock: 2 };
  const branchStockUpdate = jest.fn().mockResolvedValue({ quantity: 0, minStock: 0 });
  const stockMovementCreate = jest.fn().mockResolvedValue({ id: 'mv-1' });
  const db = {
    branch: { findFirst: jest.fn().mockResolvedValue(branch) },
    product: { findFirst: jest.fn().mockResolvedValue(product) },
    branchStock: { findUnique: jest.fn().mockResolvedValue(stockRow), update: branchStockUpdate },
    stockMovement: { create: stockMovementCreate },
  };
  return { db, branchStockUpdate, stockMovementCreate };
}

const baseParams = {
  clientId: 'client-1', branchId: 'branch-1', productId: 'p1',
  quantityChange: -3, type: StockMovementType.SALE, reason: 'Sale INV-1', createdById: 'user-1',
};

describe('StockService.adjustStock (runAdjustment)', () => {
  let service: StockService;
  beforeEach(() => {
    service = new StockService({} as never, { notifyLowStock: jest.fn() } as never);
  });

  it('throws when the branch is not found', async () => {
    const { db } = makeDb({ branch: null });
    await expect(service.adjustStock(baseParams, db as never)).rejects.toThrow(NotFoundException);
  });

  it('rejects a zero quantity change', async () => {
    const { db } = makeDb();
    await expect(service.adjustStock({ ...baseParams, quantityChange: 0 }, db as never)).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty reason', async () => {
    const { db } = makeDb();
    await expect(service.adjustStock({ ...baseParams, reason: '   ' }, db as never)).rejects.toThrow(BadRequestException);
  });

  it('throws when the product is not found', async () => {
    const { db } = makeDb({ product: null });
    await expect(service.adjustStock(baseParams, db as never)).rejects.toThrow(NotFoundException);
  });

  it('throws when there is no stock row for the branch/product', async () => {
    const { db } = makeDb({ stockRow: null });
    await expect(service.adjustStock(baseParams, db as never)).rejects.toThrow(NotFoundException);
  });

  it('rejects an adjustment that would drive stock negative', async () => {
    const { db } = makeDb({ stockRow: { quantity: 1, minStock: 0 } });
    await expect(service.adjustStock({ ...baseParams, quantityChange: -5 }, db as never)).rejects.toThrow(BadRequestException);
  });

  it('allows negative stock when allowNegativeStock is true', async () => {
    const { db, branchStockUpdate } = makeDb({ stockRow: { quantity: 1, minStock: 0 } });
    branchStockUpdate.mockResolvedValue({ quantity: -4, minStock: 0 });
    const res = await service.adjustStock({ ...baseParams, quantityChange: -5, allowNegativeStock: true }, db as never);
    expect(res.quantity).toBe(-4);
  });

  it('decrements stock and records the movement with correct before/after', async () => {
    const { db, branchStockUpdate, stockMovementCreate } = makeDb({ stockRow: { quantity: 10, minStock: 2 } });
    branchStockUpdate.mockResolvedValue({ quantity: 7, minStock: 2 });
    const res = await service.adjustStock(baseParams, db as never);
    const [updateArgs] = branchStockUpdate.mock.calls[0];
    expect(updateArgs.data).toMatchObject({ quantity: 7 });
    const [moveArgs] = stockMovementCreate.mock.calls[0];
    expect(moveArgs.data).toMatchObject({ previousQuantity: 10, newQuantity: 7, quantityChange: -3, clientId: 'client-1' });
    expect(res.quantity).toBe(7);
    expect(res.minStock).toBe(2);
  });

  it('increments stock for a positive change (e.g. a return)', async () => {
    const { db, branchStockUpdate } = makeDb({ stockRow: { quantity: 4, minStock: 2 } });
    branchStockUpdate.mockResolvedValue({ quantity: 9, minStock: 2 });
    const res = await service.adjustStock({ ...baseParams, quantityChange: 5, type: StockMovementType.RETURN }, db as never);
    const [updateArgs] = branchStockUpdate.mock.calls[0];
    expect(updateArgs.data).toMatchObject({ quantity: 9 });
    expect(res.quantity).toBe(9);
  });
});
