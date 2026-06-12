import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { CreateWasteDto, ListWasteQueryDto } from './dto/waste.dto';

@Injectable()
export class WasteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) {
      throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    }
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, clientId, isActive: true }, select: { id: true } });
    if (!b) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  async create(dto: CreateWasteDto, user: SafeUser, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);

    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, clientId: user.clientId },
        select: { id: true },
      });
      if (!product) throw new BadRequestException({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    }
    if (dto.menuItemId) {
      const menu = await this.prisma.menuItem.findFirst({
        where: { id: dto.menuItemId, clientId: user.clientId },
        select: { id: true },
      });
      if (!menu) throw new BadRequestException({ message: 'Menu item not found', code: 'MENU_ITEM_NOT_FOUND' });
    }

    const row = await this.prisma.waste.create({
      data: {
        clientId: user.clientId,
        branchId: bid,
        type: dto.type,
        reason: dto.reason,
        productId: dto.productId ?? null,
        menuItemId: dto.menuItemId ?? null,
        quantity: new Prisma.Decimal(dto.quantity),
        unit: dto.unit?.trim() || null,
        estimatedCost: dto.estimatedCost != null ? new Prisma.Decimal(dto.estimatedCost) : new Prisma.Decimal(0),
        note: dto.note?.trim() || null,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'fnb.waste.create',
      entity: 'Waste',
      entityId: row.id,
      newValue: { type: row.type, reason: row.reason, quantity: row.quantity.toString() },
    });

    return row;
  }

  async list(clientId: string, branchId: string | undefined, query: ListWasteQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);

    const where: Prisma.WasteWhereInput = {
      clientId,
      branchId: bid,
      ...(query.type ? { type: query.type } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
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
      this.prisma.waste.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.waste.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async remove(id: string, user: SafeUser) {
    const existing = await this.prisma.waste.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!existing) throw new NotFoundException({ message: 'Waste entry not found', code: 'WASTE_NOT_FOUND' });

    await this.prisma.waste.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'fnb.waste.delete',
      entity: 'Waste',
      entityId: id,
      oldValue: { type: existing.type, reason: existing.reason, quantity: existing.quantity.toString() },
    });
    return { success: true };
  }
}
