import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockTransferStatus,
  StockMovementType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { CreateStockTransferDto, UpdateStockTransferStatusDto } from './dto/stock-transfer.dto';
import { ListStockTransfersQueryDto } from './dto/list-stock-transfers.query.dto';

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  private async allowedBranchIds(user: SafeUser): Promise<string[] | null> {
    if (user.role === UserRole.OWNER) {
      return null;
    }
    const links = await this.prisma.userBranch.findMany({
      where: { userId: user.id },
      select: { branchId: true },
    });
    return links.map((l) => l.branchId);
  }

  private assertTransferAccess(
    user: SafeUser,
    allowed: string[] | null,
    fromBranchId: string,
    toBranchId: string,
  ): void {
    if (user.role === UserRole.OWNER) {
      return;
    }
    if (!allowed?.length) {
      throw new ForbiddenException({
        message: 'You do not have access to any branch',
        code: 'BRANCH_ACCESS_DENIED',
      });
    }
    const set = new Set(allowed);
    if (!set.has(fromBranchId) || !set.has(toBranchId)) {
      throw new ForbiddenException({
        message: 'You do not have access to both branches on this transfer',
        code: 'TRANSFER_BRANCH_DENIED',
      });
    }
  }

  private assertTransferRead(
    user: SafeUser,
    allowed: string[] | null,
    fromBranchId: string,
    toBranchId: string,
  ): void {
    if (user.role === UserRole.OWNER) {
      return;
    }
    if (!allowed?.length) {
      throw new ForbiddenException({
        message: 'You do not have access to any branch',
        code: 'BRANCH_ACCESS_DENIED',
      });
    }
    const set = new Set(allowed);
    if (!set.has(fromBranchId) && !set.has(toBranchId)) {
      throw new ForbiddenException({
        message: 'You do not have access to this transfer',
        code: 'TRANSFER_READ_DENIED',
      });
    }
  }

  async create(dto: CreateStockTransferDto, user: SafeUser) {
    if (user.role === UserRole.CASHIER) {
      throw new ForbiddenException({
        message: 'Cashiers cannot create stock transfers',
        code: 'TRANSFER_CREATE_DENIED',
      });
    }
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException({
        message: 'Source and destination branch must differ',
        code: 'TRANSFER_SAME_BRANCH',
      });
    }
    const allowed = await this.allowedBranchIds(user);
    this.assertTransferAccess(user, allowed, dto.fromBranchId, dto.toBranchId);

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, clientId: user.clientId },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException({
        message: 'One or more products were not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    for (const p of products) {
      if (!p.isActive) {
        throw new BadRequestException({
          message: `Product inactive: ${p.name}`,
          code: 'PRODUCT_INACTIVE',
        });
      }
    }

    const merged = new Map<string, number>();
    for (const it of dto.items) {
      merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    }
    const lines = [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));

    return this.prisma.stockTransfer.create({
      data: {
        clientId: user.clientId,
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        status: StockTransferStatus.DRAFT,
        note: dto.note?.trim() || null,
        createdById: user.id,
        items: {
          create: lines.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, username: true, role: true } },
      },
    });
  }

  async list(user: SafeUser, query: ListStockTransfersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const allowed = await this.allowedBranchIds(user);

    const where: Prisma.StockTransferWhereInput = {
      clientId: user.clientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromBranchId ? { fromBranchId: query.fromBranchId } : {}),
      ...(query.toBranchId ? { toBranchId: query.toBranchId } : {}),
      ...(allowed
        ? {
            OR: [
              { fromBranchId: { in: allowed } },
              { toBranchId: { in: allowed } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          fromBranch: { select: { id: true, name: true, code: true } },
          toBranch: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, username: true, role: true } },
        },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async findOne(id: string, user: SafeUser) {
    const row = await this.prisma.stockTransfer.findFirst({
      where: { id, clientId: user.clientId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, username: true, role: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Transfer not found', code: 'TRANSFER_NOT_FOUND' });
    }
    const allowed = await this.allowedBranchIds(user);
    this.assertTransferRead(user, allowed, row.fromBranchId, row.toBranchId);
    return row;
  }

  async updateStatus(id: string, dto: UpdateStockTransferStatusDto, user: SafeUser) {
    if (user.role === UserRole.CASHIER) {
      throw new ForbiddenException({
        message: 'Cashiers cannot update stock transfers',
        code: 'TRANSFER_UPDATE_DENIED',
      });
    }
    const next = dto.status;

    return this.prisma.$transaction(async (tx) => {
      const tr = await tx.stockTransfer.findFirst({
        where: { id, clientId: user.clientId },
        include: { items: true },
      });
      if (!tr) {
        throw new NotFoundException({ message: 'Transfer not found', code: 'TRANSFER_NOT_FOUND' });
      }
      const allowed = await this.allowedBranchIds(user);
      this.assertTransferAccess(user, allowed, tr.fromBranchId, tr.toBranchId);

      if (tr.status === StockTransferStatus.CANCELLED || tr.status === StockTransferStatus.RECEIVED) {
        throw new BadRequestException({
          message: 'This transfer can no longer be updated',
          code: 'TRANSFER_FINALIZED',
        });
      }

      if (next === StockTransferStatus.DRAFT) {
        throw new BadRequestException({
          message: 'Cannot set status back to DRAFT',
          code: 'TRANSFER_INVALID_STATUS',
        });
      }

      if (next === StockTransferStatus.SENT) {
        if (tr.status !== StockTransferStatus.DRAFT) {
          throw new BadRequestException({
            message: 'SENT is only allowed from DRAFT',
            code: 'TRANSFER_INVALID_TRANSITION',
          });
        }
        for (const it of tr.items) {
          await this.stockService.adjustStock(
            {
              clientId: tr.clientId,
              branchId: tr.fromBranchId,
              productId: it.productId,
              quantityChange: -it.quantity,
              type: StockMovementType.ADJUSTMENT,
              reason: `Stock transfer sent (${tr.id})`,
              createdById: user.id,
              referenceType: 'stock_transfer',
              referenceId: tr.id,
              allowNegativeStock: false,
            },
            tx,
          );
        }
        return tx.stockTransfer.update({
          where: { id },
          data: { status: StockTransferStatus.SENT },
          include: {
            items: { include: { product: { select: { id: true, name: true, sku: true } } } },
            fromBranch: { select: { id: true, name: true, code: true } },
            toBranch: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, name: true, username: true, role: true } },
          },
        });
      }

      if (next === StockTransferStatus.RECEIVED) {
        if (tr.status !== StockTransferStatus.SENT) {
          throw new BadRequestException({
            message: 'RECEIVED is only allowed from SENT',
            code: 'TRANSFER_INVALID_TRANSITION',
          });
        }
        for (const it of tr.items) {
          await this.stockService.adjustStock(
            {
              clientId: tr.clientId,
              branchId: tr.toBranchId,
              productId: it.productId,
              quantityChange: it.quantity,
              type: StockMovementType.ADJUSTMENT,
              reason: `Stock transfer received (${tr.id})`,
              createdById: user.id,
              referenceType: 'stock_transfer',
              referenceId: tr.id,
              allowNegativeStock: false,
            },
            tx,
          );
        }
        return tx.stockTransfer.update({
          where: { id },
          data: { status: StockTransferStatus.RECEIVED, receivedAt: new Date() },
          include: {
            items: { include: { product: { select: { id: true, name: true, sku: true } } } },
            fromBranch: { select: { id: true, name: true, code: true } },
            toBranch: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, name: true, username: true, role: true } },
          },
        });
      }

      if (next === StockTransferStatus.CANCELLED) {
        if (tr.status === StockTransferStatus.DRAFT) {
          return tx.stockTransfer.update({
            where: { id },
            data: { status: StockTransferStatus.CANCELLED },
            include: {
              items: { include: { product: { select: { id: true, name: true, sku: true } } } },
              fromBranch: { select: { id: true, name: true, code: true } },
              toBranch: { select: { id: true, name: true, code: true } },
              createdBy: { select: { id: true, name: true, username: true, role: true } },
            },
          });
        }
        if (tr.status === StockTransferStatus.SENT) {
          for (const it of tr.items) {
            await this.stockService.adjustStock(
              {
                clientId: tr.clientId,
                branchId: tr.fromBranchId,
                productId: it.productId,
                quantityChange: it.quantity,
                type: StockMovementType.ADJUSTMENT,
                reason: `Stock transfer cancelled — restore source (${tr.id})`,
                createdById: user.id,
                referenceType: 'stock_transfer',
                referenceId: tr.id,
                allowNegativeStock: false,
              },
              tx,
            );
          }
          return tx.stockTransfer.update({
            where: { id },
            data: { status: StockTransferStatus.CANCELLED },
            include: {
              items: { include: { product: { select: { id: true, name: true, sku: true } } } },
              fromBranch: { select: { id: true, name: true, code: true } },
              toBranch: { select: { id: true, name: true, code: true } },
              createdBy: { select: { id: true, name: true, username: true, role: true } },
            },
          });
        }
        throw new BadRequestException({
          message: 'Cannot cancel a transfer in RECEIVED state',
          code: 'TRANSFER_INVALID_TRANSITION',
        });
      }

      throw new BadRequestException({
        message: 'Unsupported status transition',
        code: 'TRANSFER_INVALID_STATUS',
      });
    });
  }
}
