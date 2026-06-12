import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Product,
  StockMovement,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements.query.dto';
import { ListByProductQueryDto } from './dto/list-by-product.query.dto';

export type AdjustStockParams = {
  clientId: string;
  branchId: string;
  productId: string;
  quantityChange: number;
  type: StockMovementType;
  reason: string;
  createdById: string;
  referenceType?: string | null;
  referenceId?: string | null;
  allowNegativeStock?: boolean;
};

type StockDb = Pick<PrismaService, 'product' | 'stockMovement' | 'branchStock' | 'branch'>;

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async adjustStock(
    params: AdjustStockParams,
    db?: StockDb,
  ): Promise<{ product: Product; movement: StockMovement; quantity: number; minStock: number }> {
    const result = db
      ? await this.runAdjustment(db, params)
      : await this.prisma.$transaction((tx) => this.runAdjustment(tx, params));

    void this.runPostAdjustmentNotifications(params, result).catch((err) =>
      this.logger.warn(`Stock notification failed: ${(err as Error).message}`),
    );
    return result;
  }

  private async runPostAdjustmentNotifications(
    params: AdjustStockParams,
    result: { product: Product; movement: StockMovement; quantity: number; minStock: number },
  ): Promise<void> {
    const { previousQuantity } = result.movement;
    const { quantity: newQuantity, minStock } = result;

    const crossedBelowThreshold = newQuantity <= minStock && previousQuantity > minStock;
    const stockIncreased =
      params.quantityChange > 0 &&
      (params.type === StockMovementType.PURCHASE || params.type === StockMovementType.ADJUSTMENT);

    if (!crossedBelowThreshold && !stockIncreased) return;

    const [branch, creator] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: params.branchId, clientId: params.clientId },
        select: { name: true },
      }),
      stockIncreased
        ? this.prisma.user.findFirst({
            where: { id: params.createdById, clientId: params.clientId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    const branchName = branch?.name ?? 'Main';

    if (crossedBelowThreshold) {
      await this.notifications.notifyLowStock({
        clientId: params.clientId,
        productName: result.product.name,
        sku: result.product.sku,
        currentStock: newQuantity,
        minStock,
        branchName,
        productId: result.product.id,
      });
    }

    if (stockIncreased) {
      await this.notifications.notifyStockAdded({
        clientId: params.clientId,
        productName: result.product.name,
        sku: result.product.sku,
        quantityAdded: params.quantityChange,
        oldStock: previousQuantity,
        newStock: newQuantity,
        branchName,
        reason: params.reason,
        createdByName: creator?.name ?? null,
      });
    }
  }

  async findAll(clientId: string, query: ListStockMovementsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      clientId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...this.buildDateRangeFilter(query.fromDate, query.toDate),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
            },
          },
          createdBy: {
            select: { id: true, username: true, name: true, role: true },
          },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findByProduct(clientId: string, branchId: string, productId: string, query: ListByProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const product = await this.prisma.product.findFirst({
      where: { id: productId, clientId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const where: Prisma.StockMovementWhereInput = { clientId, productId, branchId };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, username: true, name: true, role: true },
          },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private buildDateRangeFilter(
    fromDate?: string,
    toDate?: string,
  ): Prisma.StockMovementWhereInput {
    if (!fromDate && !toDate) {
      return {};
    }
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new BadRequestException({
          message: 'Invalid fromDate or toDate',
          code: 'INVALID_DATE_RANGE',
        });
      }
      if (from > to) {
        throw new BadRequestException({
          message: 'fromDate must be before or equal to toDate',
          code: 'INVALID_DATE_RANGE',
        });
      }
      const toEnd = new Date(to);
      toEnd.setUTCHours(23, 59, 59, 999);
      return { createdAt: { gte: from, lte: toEnd } };
    }
    if (fromDate) {
      const from = new Date(fromDate);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException({
          message: 'Invalid fromDate',
          code: 'INVALID_DATE',
        });
      }
      return { createdAt: { gte: from } };
    }
    if (toDate) {
      const to = new Date(toDate);
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException({
          message: 'Invalid toDate',
          code: 'INVALID_DATE',
        });
      }
      const toEnd = new Date(to);
      toEnd.setUTCHours(23, 59, 59, 999);
      return { createdAt: { lte: toEnd } };
    }
    return {};
  }

  private async runAdjustment(
    db: StockDb,
    params: AdjustStockParams,
  ): Promise<{ product: Product; movement: StockMovement; quantity: number; minStock: number }> {
    const {
      clientId,
      branchId,
      productId,
      quantityChange,
      type,
      reason,
      createdById,
      referenceType,
      referenceId,
      allowNegativeStock = false,
    } = params;

    const branch = await db.branch.findFirst({
      where: { id: branchId, clientId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException({
        message: 'Branch not found',
        code: 'BRANCH_NOT_FOUND',
      });
    }

    if (quantityChange === 0) {
      throw new BadRequestException({
        message: 'quantityChange must not be zero',
        code: 'INVALID_QUANTITY_CHANGE',
      });
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new BadRequestException({
        message: 'reason is required',
        code: 'REASON_REQUIRED',
      });
    }

    const product = await db.product.findFirst({
      where: { id: productId, clientId },
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const stockRow = await db.branchStock.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });

    if (!stockRow) {
      throw new NotFoundException({
        message: 'Stock row not found for this branch/product',
        code: 'BRANCH_STOCK_NOT_FOUND',
      });
    }

    const previousQuantity = stockRow.quantity;
    const newQuantity = previousQuantity + quantityChange;

    if (!allowNegativeStock && newQuantity < 0) {
      throw new BadRequestException({
        message: 'Insufficient stock for this adjustment',
        code: 'INSUFFICIENT_STOCK',
        details: {
          previousQuantity,
          quantityChange,
          wouldResultIn: newQuantity,
        },
      });
    }

    const updatedStock = await db.branchStock.update({
      where: { branchId_productId: { branchId, productId } },
      data: { quantity: newQuantity },
    });

    const movement = await db.stockMovement.create({
      data: {
        clientId: params.clientId,
        branchId,
        productId,
        type,
        quantityChange,
        previousQuantity,
        newQuantity,
        reason: trimmedReason,
        referenceType: referenceType?.trim() || null,
        referenceId: referenceId?.trim() || null,
        createdById,
      },
    });

    return {
      product,
      movement,
      quantity: updatedStock.quantity,
      minStock: updatedStock.minStock,
    };
  }
}
