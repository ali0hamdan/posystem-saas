import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FnbRecipesService } from './recipes.service';

function make(over: Record<string, any> = {}) {
  const prisma: any = {
    menuItem: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', name: 'Burger' }) },
    product: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
    recipe: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      update: jest.fn().mockResolvedValue({ id: 'r1' }),
      delete: jest.fn(),
    },
    recipeIngredient: { deleteMany: jest.fn(), createMany: jest.fn() },
    ...over,
  };
  prisma.$transaction = jest.fn().mockImplementation((fn: any) => fn(prisma));
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new FnbRecipesService(prisma as never, audit as never), prisma };
}
const user = { id: 'u', clientId: 'c' };

describe('FnbRecipesService', () => {
  it('getForMenuItem 404 for unknown menu item', async () => {
    const { service } = make({ menuItem: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.getForMenuItem('x', 'c')).rejects.toThrow(NotFoundException);
  });

  it('upsert 404 for unknown menu item', async () => {
    const { service } = make({ menuItem: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.upsert('x', { ingredients: [] } as never, user)).rejects.toThrow(NotFoundException);
  });

  it('upsert rejects invalid ingredient product', async () => {
    const { service } = make({ product: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) } });
    await expect(service.upsert('m1', { ingredients: [{ productId: '11111111-1111-1111-1111-111111111111', quantity: 1 }] } as never, user)).rejects.toThrow(BadRequestException);
  });

  it('upsert creates a new recipe with ingredients', async () => {
    const { service, prisma } = make();
    await service.upsert('m1', { yieldQty: 2, ingredients: [{ productId: 'p1', quantity: 3 }] } as never, user);
    expect(prisma.recipe.create).toHaveBeenCalled();
    expect(prisma.recipeIngredient.createMany).toHaveBeenCalled();
  });

  it('remove 404 when no recipe exists', async () => {
    const { service } = make();
    await expect(service.remove('m1', user)).rejects.toThrow(NotFoundException);
  });
});
