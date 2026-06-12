import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessType,
  CustomerLedgerType,
  DocumentCounterType,
  FnbOrderStatus,
  PaymentMethod,
  Prisma,
  RefundSourceType,
  RefundStatus,
  RefundType,
  RestockAction,
  SaleStatus,
  StockMovementType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CustomerLedgerService } from '../customers/customer-ledger.service';
import { DocumentNumberingService } from '../common/services/document-numbering.service';
import { NotificationService } from '../notifications/notification.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { SalesCommissionService } from '../commissions/sales-commission.service';
import { RefundApprovalService } from '../approvals/refund-approval.service';
import { effectiveRoles } from '../auth/guards/roles.guard';
import {
  CreateUnifiedRefundDto,
  ListRefundsQueryDto,
  PreviewRefundDto,
  RefundLineInputDto,
} from './dto/refund.dto';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const d0 = () => new Prisma.Decimal(0);

const REFUND_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.MANAGER,
  UserRole.CO_MANAGER,
];

type ResolvedLine = {
  sourceItemId: string;
  quantity: number;
  restockAction: RestockAction;
  lineReason?: string;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  itemName: string;
  sku?: string | null;
  barcode?: string | null;
  productId?: string | null;
  menuItemId?: string | null;
  saleItemId?: string | null;
  fnbOrderItemId?: string | null;
};

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly audit: AuditLogService,
    private readonly customerLedger: CustomerLedgerService,
    private readonly docNumbers: DocumentNumberingService,
    private readonly notifications: NotificationService,
    private readonly commissions: SalesCommissionService,
    private readonly refundApproval: RefundApprovalService,
  ) {}

  private assertCanRefund(user: SafeUser): void {
    if (!effectiveRoles(user.role).some((r) => REFUND_ROLES.includes(r))) {
      throw new ForbiddenException({
        message: 'You do not have permission to process refunds',
        code: 'REFUND_FORBIDDEN',
      });
    }
  }

  private lineRefundAmount(lineTotal: Prisma.Decimal, soldQty: number, refundQty: number): Prisma.Decimal {
    if (refundQty <= 0 || soldQty <= 0) return d0();
    if (refundQty === soldQty) return d(lineTotal.toString());
    return lineTotal.mul(refundQty).div(soldQty);
  }

  async getRefundableTransaction(clientId: string, sourceType: RefundSourceType, sourceId: string) {
    if (sourceType === RefundSourceType.FNB_ORDER) {
      return this.getRefundableFnbOrder(clientId, sourceId);
    }
    return this.getRefundableSale(clientId, sourceId, sourceType);
  }

  private async getRefundableSale(
    clientId: string,
    saleId: string,
    expectedType: RefundSourceType,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, clientId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true, barcode: true } } } },
        payments: true,
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true, username: true } },
        refunds: {
          where: { status: RefundStatus.COMPLETED },
          include: { items: true },
        },
      },
    });
    if (!sale) {
      throw new NotFoundException({ message: 'Transaction not found', code: 'SOURCE_NOT_FOUND' });
    }

    const actualType = sale.sourceProformaId
      ? RefundSourceType.WHOLESALE_INVOICE
      : RefundSourceType.RETAIL_SALE;
    if (actualType !== expectedType) {
      throw new BadRequestException({
        message: `Source is a ${actualType.replace('_', ' ').toLowerCase()}, not ${expectedType.replace('_', ' ').toLowerCase()}`,
        code: 'SOURCE_TYPE_MISMATCH',
      });
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException({ message: 'Cannot refund a cancelled sale', code: 'SOURCE_CANCELLED' });
    }
    if (sale.status === SaleStatus.REFUNDED) {
      throw new BadRequestException({ message: 'Already fully refunded', code: 'ALREADY_REFUNDED' });
    }

    const refundedQty = this.aggregateRefundedQty(
      sale.refunds.flatMap((r) => r.items),
      'saleItemId',
    );
    const paidAmount = sale.payments.reduce((s, p) => s.add(p.amount), d0());
    const totalRefunded = sale.refunds.reduce((s, r) => s.add(r.totalRefunded), d0());

    const items = sale.items.map((si) => {
      const already = refundedQty.get(si.id) ?? 0;
      const remaining = si.quantity - already;
      return {
        sourceItemId: si.id,
        productId: si.productId,
        name: si.product.name,
        sku: si.product.sku,
        barcode: si.product.barcode,
        soldQuantity: si.quantity,
        alreadyRefunded: already,
        remainingRefundable: Math.max(0, remaining),
        unitPrice: si.unitPrice.toString(),
        lineTotal: si.total.toString(),
      };
    });

    return {
      sourceType: actualType,
      sourceId: sale.id,
      sourceNumber: sale.invoiceNumber,
      status: sale.status,
      customer: sale.customer,
      branch: sale.branch,
      createdBy: sale.cashier,
      createdAt: sale.createdAt,
      subtotal: sale.subtotal.toString(),
      taxTotal: sale.taxTotal.toString(),
      discountTotal: sale.discountTotal.toString(),
      total: sale.total.toString(),
      paidAmount: paidAmount.toString(),
      totalRefunded: totalRefunded.toString(),
      remainingRefundableAmount: d(sale.total).sub(totalRefunded).toString(),
      paymentStatus: sale.paymentStatus,
      items,
    };
  }

  private async getRefundableFnbOrder(clientId: string, orderId: string) {
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: orderId, clientId },
      include: {
        items: { include: { modifiers: true } },
        table: { select: { id: true, label: true } },
        refunds: {
          where: { status: RefundStatus.COMPLETED },
          include: { items: true },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({ message: 'Order not found', code: 'SOURCE_NOT_FOUND' });
    }
    if (order.status === FnbOrderStatus.CANCELLED) {
      throw new BadRequestException({ message: 'Cannot refund a cancelled order', code: 'SOURCE_CANCELLED' });
    }
    if (order.status === FnbOrderStatus.REFUNDED) {
      throw new BadRequestException({ message: 'Order is already fully refunded', code: 'ALREADY_REFUNDED' });
    }
    if (
      order.status !== FnbOrderStatus.COMPLETED &&
      order.status !== FnbOrderStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException({
        message: 'Only completed orders can be refunded',
        code: 'ORDER_NOT_COMPLETED',
      });
    }

    const refundedQty = this.aggregateRefundedQty(
      order.refunds.flatMap((r) => r.items),
      'fnbOrderItemId',
    );
    const totalRefunded = order.refunds.reduce((s, r) => s.add(r.totalRefunded), d0());

    const items = order.items.map((oi) => {
      const already = refundedQty.get(oi.id) ?? 0;
      const remaining = oi.quantity - already;
      return {
        sourceItemId: oi.id,
        menuItemId: oi.menuItemId,
        name: oi.name,
        soldQuantity: oi.quantity,
        alreadyRefunded: already,
        remainingRefundable: Math.max(0, remaining),
        unitPrice: oi.unitPrice.toString(),
        modifiersTotal: oi.modifiersTotal.toString(),
        lineTotal: oi.lineTotal.toString(),
        defaultRestockAction: RestockAction.NO_RESTOCK,
      };
    });

    return {
      sourceType: RefundSourceType.FNB_ORDER,
      sourceId: order.id,
      sourceNumber: order.orderNumber,
      status: order.status,
      table: order.table,
      createdAt: order.createdAt,
      closedAt: order.closedAt,
      subtotal: order.subtotal.toString(),
      taxTotal: order.taxTotal.toString(),
      discountTotal: order.discountTotal.toString(),
      total: order.total.toString(),
      paidAmount: order.total.toString(),
      totalRefunded: totalRefunded.toString(),
      remainingRefundableAmount: d(order.total).sub(totalRefunded).toString(),
      items,
    };
  }

  private aggregateRefundedQty(
    items: { saleItemId?: string | null; fnbOrderItemId?: string | null; quantity: number }[],
    key: 'saleItemId' | 'fnbOrderItemId',
  ): Map<string, number> {
    const m = new Map<string, number>();
    for (const ri of items) {
      const id = ri[key];
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + ri.quantity);
    }
    return m;
  }

  async previewRefund(clientId: string, dto: PreviewRefundDto) {
    const resolved = await this.resolveRefundLines(clientId, dto);
    const subtotal = resolved.lines.reduce((s, l) => s.add(l.lineTotal), d0());
    const sourceTotal = d(resolved.total);
    return {
      refundType: resolved.refundType,
      subtotal: subtotal.toString(),
      taxRefunded: '0',
      discountAdjusted: '0',
      totalRefundAmount: subtotal.toString(),
      remainingRefundableAmount: sourceTotal.sub(resolved.totalRefunded).sub(subtotal).toString(),
      items: resolved.lines.map((l) => ({
        sourceItemId: l.sourceItemId,
        quantity: l.quantity,
        restockAction: l.restockAction,
        lineRefundAmount: l.lineTotal.toString(),
        itemName: l.itemName,
      })),
    };
  }

  async completeRefund(clientId: string, user: SafeUser, dto: CreateUnifiedRefundDto) {
    this.assertCanRefund(user);
    const trimmedReason = dto.reason.trim();
    if (!trimmedReason) {
      throw new BadRequestException({ message: 'reason is required', code: 'REASON_REQUIRED' });
    }

    const resolved = await this.resolveRefundLines(clientId, dto);
    const subtotal = resolved.lines.reduce((s, l) => s.add(l.lineTotal), d0());
    const approval = await this.refundApproval.validateForRefund(clientId, dto);
    const approvedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const refundNumber = await this.docNumbers.nextNumber(
        clientId,
        DocumentCounterType.REFUND,
        'RF',
        tx,
      );

      const refund = await tx.refund.create({
        data: {
          clientId,
          branchId: resolved.branchId,
          businessType: resolved.businessType,
          sourceType: resolved.sourceType,
          sourceId: resolved.sourceId,
          saleId: resolved.saleId,
          fnbOrderId: resolved.fnbOrderId,
          refundNumber,
          refundType: resolved.refundType,
          status: RefundStatus.COMPLETED,
          reason: trimmedReason,
          notes: dto.notes?.trim() || null,
          subtotal,
          taxRefunded: d0(),
          discountAdjusted: d0(),
          totalRefunded: subtotal,
          paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
          refundedToCustomer: true,
          userId: user.id,
          approvedByUserId: approval.id,
          approvalMethod: approval.approvalMethod,
          approvedByApprovalIdCodeSnapshot: approval.approvedByApprovalIdCodeSnapshot,
          approvedByNfcUidHashSnapshot: approval.approvedByNfcUidHashSnapshot,
          approvedByNfcUidMaskedSnapshot: approval.approvedByNfcUidMaskedSnapshot,
          approvedAt,
          completedAt: approvedAt,
        },
      });

      for (const line of resolved.lines) {
        await tx.refundItem.create({
          data: {
            clientId,
            refundId: refund.id,
            sourceItemId: line.sourceItemId,
            saleItemId: line.saleItemId,
            fnbOrderItemId: line.fnbOrderItemId,
            productId: line.productId,
            menuItemId: line.menuItemId,
            itemNameSnapshot: line.itemName,
            skuSnapshot: line.sku,
            barcodeSnapshot: line.barcode,
            quantity: line.quantity,
            unitPriceSnapshot: line.unitPrice,
            amount: line.lineTotal,
            restockQuantity: line.restockAction === RestockAction.RESTOCK ? line.quantity : 0,
            restockAction: line.restockAction,
            reason: line.lineReason,
          },
        });

        if (resolved.sourceType !== RefundSourceType.FNB_ORDER && line.productId && line.restockAction === RestockAction.RESTOCK) {
          await this.stockService.adjustStock(
            {
              clientId,
              branchId: resolved.branchId!,
              productId: line.productId,
              quantityChange: line.quantity,
              type: StockMovementType.REFUND_RESTOCK,
              reason: `Refund ${refundNumber}: ${trimmedReason}`,
              createdById: user.id,
              referenceType: 'refund',
              referenceId: refund.id,
              allowNegativeStock: false,
            },
            tx,
          );
        } else if (resolved.sourceType !== RefundSourceType.FNB_ORDER && line.productId && line.restockAction === RestockAction.DAMAGED) {
          await this.stockService.adjustStock(
            {
              clientId,
              branchId: resolved.branchId!,
              productId: line.productId,
              quantityChange: 0,
              type: StockMovementType.REFUND_DAMAGED,
              reason: `Refund damaged ${refundNumber}: ${trimmedReason}`,
              createdById: user.id,
              referenceType: 'refund',
              referenceId: refund.id,
              allowNegativeStock: false,
            },
            tx,
          );
        }
      }

      await this.updateSourceStatus(tx, resolved);

      if (resolved.customerId && subtotal.gt(0)) {
        await this.customerLedger.appendEntry(tx, {
          clientId,
          customerId: resolved.customerId,
          type: CustomerLedgerType.REFUND,
          amount: d0().sub(subtotal),
          referenceType: 'refund',
          referenceId: refund.id,
          note: `Refund ${refundNumber}: ${trimmedReason}`,
          createdById: user.id,
        });
      }

      return tx.refund.findUnique({
        where: { id: refund.id },
        include: this.refundInclude(),
      });
    });

    if (!result) {
      throw new BadRequestException({ message: 'Refund create failed', code: 'REFUND_CREATE_FAILED' });
    }

    await this.audit.log({
      userId: user.id,
      clientId,
      action: 'refund.complete',
      entity: 'Refund',
      entityId: result.id,
      newValue: {
        refundNumber: result.refundNumber,
        sourceType: result.sourceType,
        sourceId: result.sourceId,
        totalRefunded: result.totalRefunded.toString(),
        reason: trimmedReason,
        createdByUserId: user.id,
        approvedByUserId: approval.id,
        approvalMethod: approval.approvalMethod,
        approvalIdCodeSnapshot: approval.approvedByApprovalIdCodeSnapshot,
        nfcUidMaskedSnapshot: approval.approvedByNfcUidMaskedSnapshot,
      },
    });

    void this.notifications
      .notifyRefundCompleted({
        clientId,
        refundNumber: result.refundNumber,
        sourceNumber: resolved.sourceNumber,
        totalRefundAmount: result.totalRefunded.toString(),
        refundType: result.refundType,
        reason: trimmedReason,
        createdByName: user.name,
      })
      .catch(() => undefined);

    if (
      result.sourceType === RefundSourceType.RETAIL_SALE ||
      result.sourceType === RefundSourceType.WHOLESALE_INVOICE
    ) {
      void this.commissions
        .recalculateCommissionAfterRefund(result.sourceType, result.sourceId, clientId)
        .catch(() => undefined);
    }

    return result;
  }

  /** Backward-compatible wrapper for retail/wholesale sale refunds. */
  async refundSale(saleId: string, dto: CreateUnifiedRefundDto, user: SafeUser) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, clientId: user.clientId },
      select: { sourceProformaId: true },
    });
    if (!sale) {
      throw new NotFoundException({ message: 'Sale not found', code: 'SALE_NOT_FOUND' });
    }
    return this.completeRefund(user.clientId, user, {
      ...dto,
      sourceType: sale.sourceProformaId
        ? RefundSourceType.WHOLESALE_INVOICE
        : RefundSourceType.RETAIL_SALE,
      sourceId: saleId,
    });
  }

  async findAll(clientId: string, query: ListRefundsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.RefundWhereInput = {
      clientId,
      status: RefundStatus.COMPLETED,
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: this.refundInclude(),
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async findOne(clientId: string, id: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { id, clientId },
      include: this.refundInclude(),
    });
    if (!refund) {
      throw new NotFoundException({ message: 'Refund not found', code: 'REFUND_NOT_FOUND' });
    }
    return refund;
  }

  private refundInclude(): Prisma.RefundInclude {
    return {
      items: true,
      user: { select: { id: true, name: true, username: true, role: true } },
      approvedBy: { select: { id: true, name: true, username: true, role: true } },
      sale: { select: { id: true, invoiceNumber: true, status: true, total: true, customerId: true } },
      fnbOrder: { select: { id: true, orderNumber: true, status: true, total: true } },
    };
  }

  private async resolveRefundLines(clientId: string, dto: PreviewRefundDto) {
    if (dto.sourceType === RefundSourceType.FNB_ORDER) {
      return this.resolveFnbLines(clientId, dto);
    }
    return this.resolveSaleLines(clientId, dto);
  }

  private async resolveSaleLines(clientId: string, dto: PreviewRefundDto) {
    const ctx = await this.getRefundableSale(clientId, dto.sourceId, dto.sourceType);
    const sale = await this.prisma.sale.findFirst({
      where: { id: dto.sourceId, clientId },
      include: { items: { include: { product: true } } },
    });
    if (!sale) throw new NotFoundException({ message: 'Sale not found', code: 'SALE_NOT_FOUND' });

    const refundedQty = await this.loadRefundedQty(clientId, dto.sourceId, 'saleItemId');
    const lines = this.buildLinesFromInput(
      dto,
      sale.items.map((si) => ({
        sourceItemId: si.id,
        soldQty: si.quantity,
        lineTotal: si.total,
        unitPrice: si.unitPrice,
        itemName: si.product.name,
        sku: si.product.sku,
        barcode: si.product.barcode,
        productId: si.productId,
        saleItemId: si.id,
        defaultRestock: RestockAction.RESTOCK,
      })),
      refundedQty,
    );

    const refundType =
      lines.length === sale.items.length &&
      sale.items.every((si) => {
        const line = lines.find((l) => l.sourceItemId === si.id);
        const already = refundedQty.get(si.id) ?? 0;
        return line && line.quantity + already >= si.quantity;
      })
        ? RefundType.FULL
        : RefundType.PARTIAL;

    return {
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      sourceNumber: sale.invoiceNumber,
      saleId: sale.id,
      fnbOrderId: null as string | null,
      branchId: sale.branchId,
      businessType: null as BusinessType | null,
      customerId: sale.customerId,
      total: sale.total.toString(),
      totalRefunded: d(ctx.totalRefunded),
      refundType: dto.full ? RefundType.FULL : refundType,
      lines,
      allSaleItems: sale.items,
      refundedQtyBefore: refundedQty,
    };
  }

  private async resolveFnbLines(clientId: string, dto: PreviewRefundDto) {
    const ctx = await this.getRefundableFnbOrder(clientId, dto.sourceId);
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: dto.sourceId, clientId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });

    const refundedQty = await this.loadRefundedQty(clientId, dto.sourceId, 'fnbOrderItemId', RefundSourceType.FNB_ORDER);
    const lines = this.buildLinesFromInput(
      dto,
      order.items.map((oi) => ({
        sourceItemId: oi.id,
        soldQty: oi.quantity,
        lineTotal: oi.lineTotal,
        unitPrice: oi.unitPrice,
        itemName: oi.name,
        productId: null,
        menuItemId: oi.menuItemId,
        fnbOrderItemId: oi.id,
        defaultRestock: RestockAction.NO_RESTOCK,
      })),
      refundedQty,
    );

    const refundType =
      order.items.every((oi) => {
        const line = lines.find((l) => l.sourceItemId === oi.id);
        const already = refundedQty.get(oi.id) ?? 0;
        return line && line.quantity + already >= oi.quantity;
      }) && lines.length === order.items.length
        ? RefundType.FULL
        : RefundType.PARTIAL;

    return {
      sourceType: RefundSourceType.FNB_ORDER,
      sourceId: dto.sourceId,
      sourceNumber: order.orderNumber,
      saleId: null as string | null,
      fnbOrderId: order.id,
      branchId: order.branchId,
      businessType: BusinessType.FOOD_BEVERAGE,
      customerId: order.customerId,
      total: order.total.toString(),
      totalRefunded: d(ctx.totalRefunded),
      refundType: dto.full ? RefundType.FULL : refundType,
      lines,
      allOrderItems: order.items,
      refundedQtyBefore: refundedQty,
    };
  }

  private buildLinesFromInput(
    dto: PreviewRefundDto,
    catalog: {
      sourceItemId: string;
      soldQty: number;
      lineTotal: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      itemName: string;
      sku?: string | null;
      barcode?: string | null;
      productId?: string | null;
      menuItemId?: string | null;
      saleItemId?: string | null;
      fnbOrderItemId?: string | null;
      defaultRestock: RestockAction;
    }[],
    refundedQty: Map<string, number>,
  ): ResolvedLine[] {
    const byId = new Map(catalog.map((c) => [c.sourceItemId, c]));
    const resolved: ResolvedLine[] = [];

    if (dto.full) {
      for (const c of catalog) {
        const already = refundedQty.get(c.sourceItemId) ?? 0;
        const remaining = c.soldQty - already;
        if (remaining > 0) {
          resolved.push(this.toResolvedLine(c, remaining, undefined));
        }
      }
    } else {
      const merged = new Map<string, RefundLineInputDto>();
      for (const line of dto.items ?? []) {
        const prev = merged.get(line.sourceItemId);
        merged.set(line.sourceItemId, prev
          ? { ...line, quantity: prev.quantity + line.quantity }
          : line);
      }
      for (const [sourceItemId, input] of merged) {
        const c = byId.get(sourceItemId);
        if (!c) {
          throw new BadRequestException({
            message: 'Item does not belong to this transaction',
            code: 'INVALID_SOURCE_ITEM',
            details: { sourceItemId },
          });
        }
        const already = refundedQty.get(sourceItemId) ?? 0;
        const remaining = c.soldQty - already;
        if (input.quantity > remaining) {
          throw new BadRequestException({
            message: 'Refund quantity exceeds remaining quantity',
            code: 'REFUND_EXCEEDS_REMAINING',
            details: { sourceItemId, requested: input.quantity, remaining },
          });
        }
        resolved.push(this.toResolvedLine(c, input.quantity, input));
      }
    }

    if (!resolved.length) {
      throw new BadRequestException({ message: 'Nothing to refund', code: 'NOTHING_TO_REFUND' });
    }
    return resolved;
  }

  private toResolvedLine(
    c: {
      sourceItemId: string;
      soldQty: number;
      lineTotal: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      itemName: string;
      sku?: string | null;
      barcode?: string | null;
      productId?: string | null;
      menuItemId?: string | null;
      saleItemId?: string | null;
      fnbOrderItemId?: string | null;
      defaultRestock: RestockAction;
    },
    quantity: number,
    input?: RefundLineInputDto,
  ): ResolvedLine {
    return {
      sourceItemId: c.sourceItemId,
      quantity,
      restockAction: input?.restockAction ?? c.defaultRestock,
      lineReason: input?.reason,
      unitPrice: c.unitPrice,
      lineTotal: this.lineRefundAmount(c.lineTotal, c.soldQty, quantity),
      itemName: c.itemName,
      sku: c.sku,
      barcode: c.barcode,
      productId: c.productId,
      menuItemId: c.menuItemId,
      saleItemId: c.saleItemId,
      fnbOrderItemId: c.fnbOrderItemId,
    };
  }

  private async loadRefundedQty(
    clientId: string,
    sourceId: string,
    key: 'saleItemId' | 'fnbOrderItemId',
    sourceType?: RefundSourceType,
  ): Promise<Map<string, number>> {
    const agg = await this.prisma.refundItem.groupBy({
      by: [key],
      where: {
        clientId,
        refund: {
          sourceId,
          clientId,
          status: RefundStatus.COMPLETED,
          ...(sourceType ? { sourceType } : {}),
        },
      },
      _sum: { quantity: true },
    });
    const m = new Map<string, number>();
    for (const row of agg) {
      const id = row[key];
      if (id) m.set(id, row._sum.quantity ?? 0);
    }
    return m;
  }

  private async updateSourceStatus(
    tx: Prisma.TransactionClient,
    resolved: {
      sourceType: RefundSourceType;
      sourceId: string;
      saleId: string | null;
      fnbOrderId: string | null;
      lines: ResolvedLine[];
      refundedQtyBefore: Map<string, number>;
      allSaleItems?: { id: string; quantity: number }[];
      allOrderItems?: { id: string; quantity: number }[];
    },
  ): Promise<void> {
    if (resolved.sourceType === RefundSourceType.FNB_ORDER && resolved.fnbOrderId) {
      const items = resolved.allOrderItems ?? [];
      const fully = items.every((oi) => {
        const add = resolved.lines
          .filter((l) => l.sourceItemId === oi.id)
          .reduce((s, l) => s + l.quantity, 0);
        const before = resolved.refundedQtyBefore.get(oi.id) ?? 0;
        return before + add >= oi.quantity;
      });
      await tx.fnbOrder.update({
        where: { id: resolved.fnbOrderId },
        data: {
          status: fully ? FnbOrderStatus.REFUNDED : FnbOrderStatus.PARTIALLY_REFUNDED,
        },
      });
      return;
    }

    if (resolved.saleId) {
      const items = resolved.allSaleItems ?? [];
      const fully = items.every((si) => {
        const add = resolved.lines
          .filter((l) => l.sourceItemId === si.id)
          .reduce((s, l) => s + l.quantity, 0);
        const before = resolved.refundedQtyBefore.get(si.id) ?? 0;
        return before + add >= si.quantity;
      });
      await tx.sale.update({
        where: { id: resolved.saleId },
        data: {
          status: fully ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED,
        },
      });
    }
  }
}
