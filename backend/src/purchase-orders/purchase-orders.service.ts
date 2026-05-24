import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseStatus,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders.query.dto';

function dec(n: number | string): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

function lineTotal(costPrice: number, qty: number): Prisma.Decimal {
  return dec(costPrice).mul(qty);
}

function sumOrderItems(
  items: { costPrice: number; quantity: number }[],
): Prisma.Decimal {
  let t = new Prisma.Decimal(0);
  for (const it of items) {
    t = t.add(lineTotal(it.costPrice, it.quantity));
  }
  return t;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly audit: AuditLogService,
  ) {}

  private assertDistinctProductIds(productIds: string[]): void {
    const set = new Set(productIds);
    if (set.size !== productIds.length) {
      throw new BadRequestException({
        message: 'Each product may only appear once in the order',
        code: 'DUPLICATE_PRODUCT_IN_ORDER',
      });
    }
  }

  private async assertSupplierUsable(
    supplierId: string,
    clientId: string,
    db: Pick<PrismaService, 'supplier'>,
  ): Promise<void> {
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, clientId },
    });
    if (!supplier) {
      throw new NotFoundException({
        message: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    if (!supplier.isActive) {
      throw new BadRequestException({
        message: 'Supplier is inactive',
        code: 'SUPPLIER_INACTIVE',
      });
    }
  }

  private async assertProductsForSupplier(
    supplierId: string,
    items: { productId: string }[],
    clientId: string,
    db: Pick<PrismaService, 'product'>,
  ): Promise<void> {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await db.product.findMany({
      where: { id: { in: ids }, clientId },
    });
    if (products.length !== ids.length) {
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
      if (p.supplierId != null && p.supplierId !== supplierId) {
        throw new BadRequestException({
          message: `Product "${p.name}" is assigned to a different supplier`,
          code: 'PRODUCT_SUPPLIER_MISMATCH',
          details: { productId: p.id },
        });
      }
    }
  }

  private validateStatusTransition(from: PurchaseStatus, to: PurchaseStatus): void {
    if (from === to) {
      return;
    }
    if (to === PurchaseStatus.RECEIVED) {
      throw new BadRequestException({
        message: 'Use POST /purchase-orders/:id/receive to mark an order as received',
        code: 'USE_RECEIVE_ENDPOINT',
      });
    }
    if (from === PurchaseStatus.ORDERED && to === PurchaseStatus.DRAFT) {
      throw new BadRequestException({
        message: 'Cannot change status from ORDERED back to DRAFT',
        code: 'INVALID_STATUS_TRANSITION',
      });
    }
    if (from === PurchaseStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Cannot change status of a cancelled purchase order',
        code: 'INVALID_STATUS_TRANSITION',
      });
    }
  }

  async findAll(query: ListPurchaseOrdersQueryDto, branchId: string, clientId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      clientId,
      branchId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true, isActive: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
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

  async findOne(id: string, clientId: string) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id, clientId },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                unitType: true,
                sellingPrice: true,
              },
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Purchase order not found',
        code: 'PURCHASE_ORDER_NOT_FOUND',
      });
    }
    return row;
  }

  async create(dto: CreatePurchaseOrderDto, userId: string, branchId: string, clientId: string) {
    this.assertDistinctProductIds(dto.items.map((i) => i.productId));
    await this.assertSupplierUsable(dto.supplierId, clientId, this.prisma);
    await this.assertProductsForSupplier(dto.supplierId, dto.items, clientId, this.prisma);

    const total = sumOrderItems(dto.items);
    const paid = dec(dto.paidAmount ?? 0);
    if (paid.gt(total)) {
      throw new BadRequestException({
        message: 'paidAmount cannot exceed order total',
        code: 'PAID_EXCEEDS_TOTAL',
      });
    }

    const status = dto.status ?? PurchaseStatus.DRAFT;

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.purchaseOrder.create({
        data: {
          clientId,
          branchId,
          supplierId: dto.supplierId,
          status,
          total,
          paidAmount: paid,
          items: {
            create: dto.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              costPrice: dec(it.costPrice),
              total: lineTotal(it.costPrice, it.quantity),
            })),
          },
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });
    });

    await this.audit.log({
      userId,
      action: 'purchase_order.create',
      entity: 'PurchaseOrder',
      entityId: created.id,
      newValue: {
        supplierId: created.supplierId,
        status: created.status,
        total: created.total.toString(),
        itemCount: created.items.length,
      },
    });

    return created;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto, userId: string, clientId: string) {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, clientId },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Purchase order not found',
        code: 'PURCHASE_ORDER_NOT_FOUND',
      });
    }

    if (
      existing.status === PurchaseStatus.RECEIVED ||
      existing.status === PurchaseStatus.CANCELLED
    ) {
      throw new BadRequestException({
        message: 'This purchase order cannot be edited',
        code: 'PO_NOT_EDITABLE',
      });
    }

    const keys = Object.keys(dto).filter((k) => dto[k as keyof UpdatePurchaseOrderDto] !== undefined);
    if (keys.length === 0) {
      throw new BadRequestException({
        message: 'No updatable fields provided',
        code: 'EMPTY_UPDATE',
      });
    }

    if (dto.items && existing.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException({
        message: 'Line items can only be replaced while the order is in DRAFT status',
        code: 'ITEMS_UPDATE_DRAFT_ONLY',
      });
    }

    if (
      dto.supplierId &&
      dto.supplierId !== existing.supplierId &&
      existing.status !== PurchaseStatus.DRAFT
    ) {
      throw new BadRequestException({
        message: 'Supplier can only be changed while the order is in DRAFT status',
        code: 'SUPPLIER_CHANGE_DRAFT_ONLY',
      });
    }

    const nextSupplierId = dto.supplierId ?? existing.supplierId;

    if (dto.status !== undefined) {
      this.validateStatusTransition(existing.status, dto.status);
    }

    if (dto.items) {
      this.assertDistinctProductIds(dto.items.map((i) => i.productId));
      await this.assertSupplierUsable(nextSupplierId, clientId, this.prisma);
      await this.assertProductsForSupplier(nextSupplierId, dto.items, clientId, this.prisma);
    } else if (dto.supplierId && dto.supplierId !== existing.supplierId) {
      await this.assertSupplierUsable(nextSupplierId, clientId, this.prisma);
      await this.assertProductsForSupplier(
        nextSupplierId,
        existing.items.map((i) => ({ productId: i.productId })),
        clientId,
        this.prisma,
      );
    }

    let newTotal = existing.total;
    if (dto.items) {
      newTotal = sumOrderItems(dto.items);
    }

    const nextPaid =
      dto.paidAmount !== undefined ? dec(dto.paidAmount) : existing.paidAmount;
    if (nextPaid.gt(newTotal)) {
      throw new BadRequestException({
        message: 'paidAmount cannot exceed order total',
        code: 'PAID_EXCEEDS_TOTAL',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });
        for (const it of dto.items) {
          await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: id,
              productId: it.productId,
              quantity: it.quantity,
              costPrice: dec(it.costPrice),
              total: lineTotal(it.costPrice, it.quantity),
            },
          });
        }
      }

      const data: Prisma.PurchaseOrderUpdateInput = {
        ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.paidAmount !== undefined ? { paidAmount: dec(dto.paidAmount) } : {}),
        ...(dto.items ? { total: newTotal } : {}),
      };

      await tx.purchaseOrder.update({
        where: { id },
        data,
      });

      return tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });
    });

    if (!updated) {
      throw new BadRequestException({
        message: 'Purchase order not found after update',
        code: 'PURCHASE_ORDER_UPDATE_FAILED',
      });
    }

    await this.audit.log({
      userId,
      action: 'purchase_order.update',
      entity: 'PurchaseOrder',
      entityId: id,
      oldValue: {
        status: existing.status,
        total: existing.total.toString(),
        supplierId: existing.supplierId,
      },
      newValue: {
        status: updated.status,
        total: updated.total.toString(),
        supplierId: updated.supplierId,
      },
    });

    return updated;
  }

  async receive(id: string, dto: ReceivePurchaseOrderDto, userId: string, clientId: string) {
    const updateProductCostPrices = dto.updateProductCostPrices !== false;

    const result = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, clientId },
        include: { items: true, supplier: { select: { id: true, name: true } } },
      });

      if (!po) {
        throw new NotFoundException({
          message: 'Purchase order not found',
          code: 'PURCHASE_ORDER_NOT_FOUND',
        });
      }

      if (po.status === PurchaseStatus.RECEIVED) {
        throw new BadRequestException({
          message: 'Purchase order has already been received',
          code: 'PO_ALREADY_RECEIVED',
        });
      }

      if (po.status === PurchaseStatus.CANCELLED) {
        throw new BadRequestException({
          message: 'Cannot receive a cancelled purchase order',
          code: 'PO_CANCELLED',
        });
      }

      if (!po.items.length) {
        throw new BadRequestException({
          message: 'Purchase order has no line items',
          code: 'PO_EMPTY',
        });
      }

      for (const it of po.items) {
        await this.stockService.adjustStock(
          {
            clientId: po.clientId,
            branchId: po.branchId,
            productId: it.productId,
            quantityChange: it.quantity,
            type: StockMovementType.PURCHASE,
            reason: `Receive purchase order (${po.supplier.name})`,
            createdById: userId,
            referenceType: 'purchase_order',
            referenceId: po.id,
            allowNegativeStock: false,
          },
          tx,
        );

        if (updateProductCostPrices) {
          await tx.product.update({
            where: { id: it.productId },
            data: { costPrice: it.costPrice },
          });
        }
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: PurchaseStatus.RECEIVED },
      });

      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  costPrice: true,
                  sellingPrice: true,
                },
              },
            },
          },
        },
      });
    });

    if (!result) {
      throw new BadRequestException({
        message: 'Purchase order not found after receive',
        code: 'PURCHASE_ORDER_RECEIVE_FAILED',
      });
    }

    await this.audit.log({
      userId,
      action: 'purchase_order.receive',
      entity: 'PurchaseOrder',
      entityId: id,
      newValue: {
        status: PurchaseStatus.RECEIVED,
        updateProductCostPrices,
        lineCount: result.items.length,
      },
    });

    return result;
  }
}
