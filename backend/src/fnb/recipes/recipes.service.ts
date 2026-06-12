import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { UpsertRecipeDto } from './dto/recipe.dto';

@Injectable()
export class FnbRecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(clientId: string) {
    return this.prisma.recipe.findMany({
      where: { clientId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { menuItem: { select: { id: true, name: true } }, _count: { select: { ingredients: true } } },
    });
  }

  async getForMenuItem(menuItemId: string, clientId: string) {
    const menuItem = await this.prisma.menuItem.findFirst({ where: { id: menuItemId, clientId }, select: { id: true, name: true } });
    if (!menuItem) throw new NotFoundException({ message: 'Menu item not found', code: 'MENU_ITEM_NOT_FOUND' });
    const recipe = await this.prisma.recipe.findFirst({ where: { menuItemId, clientId }, include: { ingredients: true } });
    const productIds = recipe?.ingredients.map((i) => i.productId) ?? [];
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds }, clientId }, select: { id: true, name: true, unitType: true } })
      : [];
    const pMap = new Map(products.map((p) => [p.id, p]));
    return {
      menuItem,
      recipe: recipe
        ? { ...recipe, ingredients: recipe.ingredients.map((i) => ({ ...i, product: pMap.get(i.productId) ?? null })) }
        : null,
    };
  }

  async upsert(menuItemId: string, dto: UpsertRecipeDto, user: { id: string; clientId: string }) {
    const menuItem = await this.prisma.menuItem.findFirst({ where: { id: menuItemId, clientId: user.clientId }, select: { id: true } });
    if (!menuItem) throw new NotFoundException({ message: 'Menu item not found', code: 'MENU_ITEM_NOT_FOUND' });

    const productIds = [...new Set(dto.ingredients.map((i) => i.productId))];
    if (productIds.length) {
      const count = await this.prisma.product.count({ where: { id: { in: productIds }, clientId: user.clientId } });
      if (count !== productIds.length) throw new BadRequestException({ message: 'One or more ingredients are invalid', code: 'INVALID_PRODUCT' });
    }

    const existing = await this.prisma.recipe.findFirst({ where: { menuItemId, clientId: user.clientId } });
    await this.prisma.$transaction(async (tx) => {
      let recipeId: string;
      if (existing) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
        const r = await tx.recipe.update({ where: { id: existing.id }, data: { yieldQty: dto.yieldQty ?? 1, notes: dto.notes?.trim() ?? null, isActive: true } });
        recipeId = r.id;
      } else {
        const r = await tx.recipe.create({ data: { clientId: user.clientId, menuItemId, yieldQty: dto.yieldQty ?? 1, notes: dto.notes?.trim() ?? null } });
        recipeId = r.id;
      }
      if (dto.ingredients.length) {
        await tx.recipeIngredient.createMany({
          data: dto.ingredients.map((i) => ({ recipeId, productId: i.productId, quantity: i.quantity, unit: i.unit?.trim() || null })),
        });
      }
    });

    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.recipe.upsert', entity: 'Recipe', entityId: menuItemId, newValue: { ingredients: dto.ingredients.length } });
    return this.getForMenuItem(menuItemId, user.clientId);
  }

  async remove(menuItemId: string, user: { id: string; clientId: string }) {
    const existing = await this.prisma.recipe.findFirst({ where: { menuItemId, clientId: user.clientId } });
    if (!existing) throw new NotFoundException({ message: 'Recipe not found', code: 'RECIPE_NOT_FOUND' });
    await this.prisma.recipe.delete({ where: { id: existing.id } });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.recipe.delete', entity: 'Recipe', entityId: existing.id });
    return { deleted: true };
  }
}
