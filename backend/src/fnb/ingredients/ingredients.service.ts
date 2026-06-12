import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { CreateIngredientMovementDto, ListIngredientMovementsQueryDto } from './dto/ingredient.dto';

@Injectable()
export class IngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, clientId, isActive: true }, select: { id: true } });
    if (!b) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  async createMovement(dto: CreateIngredientMovementDto, user: SafeUser, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, clientId: user.clientId },
      select: { id: true, unitType: true },
    });
    if (!product) throw new BadRequestException({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });

    const row = await this.prisma.ingredientMovement.create({
      data: {
        clientId: user.clientId,
        branchId: bid,
        productId: dto.productId,
        type: dto.type,
        quantityChange: new Prisma.Decimal(dto.quantityChange),
        unit: dto.unit?.trim() || product.unitType || null,
        referenceType: dto.referenceType?.trim() || null,
        referenceId: dto.referenceId?.trim() || null,
        note: dto.note?.trim() || null,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'fnb.ingredient.movement.create',
      entity: 'IngredientMovement',
      entityId: row.id,
      newValue: { productId: row.productId, type: row.type, quantityChange: row.quantityChange.toString() },
    });

    return row;
  }

  async listMovements(clientId: string, branchId: string | undefined, query: ListIngredientMovementsQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);

    const where: Prisma.IngredientMovementWhereInput = {
      clientId,
      branchId: bid,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.ingredientMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ingredientMovement.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async stockLevels(clientId: string, branchId: string | undefined) {
    const bid = await this.assertBranch(clientId, branchId);
    const rows = await this.prisma.ingredientMovement.groupBy({
      by: ['productId'],
      where: { clientId, branchId: bid },
      _sum: { quantityChange: true },
    });
    return rows.map((r) => ({
      productId: r.productId,
      currentQuantity: r._sum.quantityChange?.toString() ?? '0',
    }));
  }
}
