import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CouponType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SaleStatus,
  ShiftStatus,
  StockMovementType,
  UserRole,
  CustomerLedgerType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SettingsService } from '../settings/settings.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ListSalesQueryDto } from './dto/list-sales.query.dto';
import { SafeUser } from '../auth/types/safe-user.type';
import { CustomerLedgerService } from '../customers/customer-ledger.service';

type ComputedLine = {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  costPriceAtSale: Prisma.Decimal;
};

type Totals = {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  lines: ComputedLine[];
};

const d0 = () => new Prisma.Decimal(0);

function d(n: number | string): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

function minDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lte(b) ? a : b;
}

function maxDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.gte(b) ? a : b;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly audit: AuditLogService,
    private readonly settingsService: SettingsService,
    private readonly customerLedger: CustomerLedgerService,
  ) {}

  private buildInvoiceNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = randomBytes(8).toString('hex').toUpperCase();
    return `INV-${stamp}-${rand}`;
  }

  private realMoneyPaid(
    payments: { method: PaymentMethod; amount: number }[],
  ): Prisma.Decimal {
    let s = d0();
    for (const p of payments) {
      if (p.method !== PaymentMethod.CREDIT) {
        s = s.add(d(p.amount));
      }
    }
    return s;
  }

  private paymentStatusFor(
    paid: Prisma.Decimal,
    totalDue: Prisma.Decimal,
  ): PaymentStatus {
    if (paid.lte(0)) {
      return PaymentStatus.UNPAID;
    }
    if (paid.gte(totalDue)) {
      return PaymentStatus.PAID;
    }
    return PaymentStatus.PARTIAL;
  }

  private computeTotals(
    dto: CreateSaleDto,
    products: Map<
      string,
      { sellingPrice: Prisma.Decimal; costPrice: Prisma.Decimal; name: string }
    >,
    taxPolicy: { mode: 'rate' | 'manual'; ratePercent: Prisma.Decimal },
  ): Totals {
    let gross = d0();
    const lines: ComputedLine[] = [];

    for (const line of dto.items) {
      const p = products.get(line.productId);
      if (!p) {
        throw new BadRequestException({
          message: `Unknown product in items: ${line.productId}`,
          code: 'INVALID_PRODUCT',
        });
      }
      const unitPrice = d(p.sellingPrice.toString());
      const costPriceAtSale = d(p.costPrice.toString());
      const lineGross = unitPrice.mul(line.quantity);
      const rawDisc = d(line.discount ?? 0);
      const discount = minDec(rawDisc, lineGross);
      const lineTotal = lineGross.sub(discount);
      gross = gross.add(lineGross);
      lines.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice,
        discount,
        total: lineTotal,
        costPriceAtSale,
      });
    }

    let lineDiscountSum = d0();
    let netAfterLine = d0();
    for (const ln of lines) {
      lineDiscountSum = lineDiscountSum.add(ln.discount);
      netAfterLine = netAfterLine.add(ln.total);
    }

    const rawGlobal = d(dto.globalDiscount ?? 0);
    const globalApplied = minDec(rawGlobal, maxDec(netAfterLine, d0()));
    const discountTotal = lineDiscountSum.add(globalApplied);
    const subtotal = gross;
    const afterDiscounts = maxDec(subtotal.sub(discountTotal), d0());
    let taxTotal: Prisma.Decimal;
    if (taxPolicy.mode === 'rate' && taxPolicy.ratePercent.gt(0)) {
      const raw = afterDiscounts.mul(taxPolicy.ratePercent).div(100);
      taxTotal = d(raw.toFixed(2));
    } else {
      taxTotal = d(dto.tax ?? 0);
    }
    const total = afterDiscounts.add(taxTotal);

    return {
      subtotal,
      discountTotal,
      taxTotal,
      total,
      lines,
    };
  }

  private buildSaleDateWhere(
    fromDate?: string,
    toDate?: string,
  ): Prisma.SaleWhereInput {
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
        throw new BadRequestException({ message: 'Invalid fromDate', code: 'INVALID_DATE' });
      }
      return { createdAt: { gte: from } };
    }
    const to = new Date(toDate as string);
    if (Number.isNaN(to.getTime())) {
      throw new BadRequestException({ message: 'Invalid toDate', code: 'INVALID_DATE' });
    }
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);
    return { createdAt: { lte: toEnd } };
  }

  async create(dto: CreateSaleDto, cashierId: string, branchId: string, clientId: string) {
    const payments = dto.payments ?? [];

    if (!dto.items?.length) {
      throw new BadRequestException({
        message: 'items must not be empty',
        code: 'ITEMS_REQUIRED',
      });
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, clientId },
      });
      if (!customer) {
        throw new NotFoundException({
          message: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND',
        });
      }
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, clientId },
      include: {
        branchStocks: {
          where: { branchId },
          take: 1,
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException({
        message: 'One or more products were not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const productMap = new Map(
      products.map((p) => {
        const bs = p.branchStocks[0];
        const qty = bs?.quantity ?? 0;
        return [
          p.id,
          {
            sellingPrice: p.sellingPrice,
            costPrice: p.costPrice,
            name: p.name,
            quantity: qty,
            isActive: p.isActive,
          },
        ] as const;
      }),
    );

    const needQty = new Map<string, number>();
    for (const it of dto.items) {
      needQty.set(it.productId, (needQty.get(it.productId) ?? 0) + it.quantity);
    }

    for (const [pid, qty] of needQty) {
      const p = productMap.get(pid)!;
      if (!p.isActive) {
        throw new BadRequestException({
          message: `Product inactive: ${p.name}`,
          code: 'PRODUCT_INACTIVE',
        });
      }
      if (p.quantity < qty) {
        throw new BadRequestException({
          message: `Insufficient stock for ${p.name}`,
          code: 'INSUFFICIENT_STOCK',
          details: { productId: pid, available: p.quantity, requested: qty },
        });
      }
    }

    const productsForPricing = new Map(
      [...productMap.entries()].map(([id, v]) => [
        id,
        { sellingPrice: v.sellingPrice, costPrice: v.costPrice, name: v.name },
      ]),
    );

    // Resolve coupon before computing totals so its discount replaces globalDiscount
    let resolvedCouponId: string | null = null;
    let resolvedCouponCode: string | null = null;
    let couponDiscount = d0();

    if (dto.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { clientId_code: { clientId, code: dto.couponCode.trim().toUpperCase() } },
      });

      if (!coupon || !coupon.isActive) {
        throw new BadRequestException({ message: 'Invalid or inactive coupon', code: 'COUPON_INVALID' });
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new BadRequestException({ message: 'Coupon has expired', code: 'COUPON_EXPIRED' });
      }
      if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
        throw new BadRequestException({ message: 'Coupon usage limit reached', code: 'COUPON_EXHAUSTED' });
      }

      // Compute net after line discounts to apply the coupon against
      let lineNet = d0();
      for (const item of dto.items) {
        const p = productsForPricing.get(item.productId)!;
        const lineGross = d(p.sellingPrice.toString()).mul(item.quantity);
        const linDisc = minDec(d(item.discount ?? 0), lineGross);
        lineNet = lineNet.add(lineGross.sub(linDisc));
      }

      if (coupon.minOrderAmount && lineNet.lt(coupon.minOrderAmount)) {
        throw new BadRequestException({
          message: `Minimum order amount for this coupon is ${coupon.minOrderAmount}`,
          code: 'COUPON_MIN_ORDER',
        });
      }

      if (coupon.type === CouponType.PERCENTAGE) {
        couponDiscount = lineNet.mul(coupon.value).div(100);
      } else {
        couponDiscount = coupon.value.lte(lineNet) ? coupon.value : lineNet;
      }
      couponDiscount = d(couponDiscount.toFixed(2));

      resolvedCouponId = coupon.id;
      resolvedCouponCode = coupon.code;
    }

    // Coupon discount overrides any manually provided globalDiscount
    const effectiveGlobalDiscount = resolvedCouponId
      ? parseFloat(couponDiscount.toFixed(2))
      : (dto.globalDiscount ?? 0);

    const dtoForTotals = { ...dto, globalDiscount: effectiveGlobalDiscount };

    const store = await this.settingsService.get(clientId);
    const useTaxRate = store.taxEnabled && store.taxRate.gt(0);
    const totals = this.computeTotals(dtoForTotals, productsForPricing, {
      mode: useTaxRate ? 'rate' : 'manual',
      ratePercent: store.taxRate,
    });

    let paidSum = d0();
    for (const pay of payments) {
      paidSum = paidSum.add(d(pay.amount));
    }

    const paymentStatus = this.paymentStatusFor(paidSum, totals.total);

    const hasCreditPayment = payments.some((p) => p.method === PaymentMethod.CREDIT);
    if (hasCreditPayment && !dto.customerId) {
      throw new BadRequestException({
        message: 'Customer is required when using CREDIT as a payment method',
        code: 'CUSTOMER_REQUIRED_FOR_CREDIT_PAYMENT',
      });
    }

    const realPaid = this.realMoneyPaid(payments);
    const receivableFromSale = maxDec(totals.total.sub(realPaid), d0());
    if (receivableFromSale.gt(0) && !dto.customerId) {
      throw new BadRequestException({
        message:
          'Customer is required when the sale is not fully covered by non-credit payments (cash, card, or mixed non-credit)',
        code: 'CUSTOMER_REQUIRED_FOR_OUTSTANDING',
      });
    }

    const invoiceNumber = this.buildInvoiceNumber();

    const result = await this.prisma.$transaction(async (tx) => {
      const openShift = await tx.shift.findFirst({
        where: { cashierId, branchId, status: ShiftStatus.OPEN },
        select: { id: true },
      });

      const sale = await tx.sale.create({
        data: {
          clientId,
          branchId,
          invoiceNumber,
          cashierId,
          customerId: dto.customerId ?? null,
          shiftId: openShift?.id ?? null,
          couponId: resolvedCouponId,
          couponCode: resolvedCouponCode,
          couponDiscount,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          paymentStatus,
          status: SaleStatus.COMPLETED,
        },
      });

      if (resolvedCouponId) {
        await tx.coupon.update({
          where: { id: resolvedCouponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      for (const ln of totals.lines) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: ln.productId,
            quantity: ln.quantity,
            unitPrice: ln.unitPrice,
            discount: ln.discount,
            total: ln.total,
            costPriceAtSale: ln.costPriceAtSale,
          },
        });
      }

      for (const pay of payments) {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            method: pay.method,
            amount: d(pay.amount),
          },
        });
      }

      if (dto.customerId && receivableFromSale.gt(0)) {
        await this.customerLedger.appendEntry(tx, {
          clientId,
          customerId: dto.customerId,
          type: CustomerLedgerType.SALE_CREDIT,
          amount: receivableFromSale,
          referenceType: 'sale',
          referenceId: sale.id,
          note: `Sale ${invoiceNumber} — on account`,
          createdById: cashierId,
        });
      }

      for (const line of dto.items) {
        await this.stockService.adjustStock(
          {
            clientId,
            branchId,
            productId: line.productId,
            quantityChange: -line.quantity,
            type: StockMovementType.SALE,
            reason: `Sale ${invoiceNumber}`,
            createdById: cashierId,
            referenceType: 'sale',
            referenceId: sale.id,
            allowNegativeStock: false,
          },
          tx,
        );
      }

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          branch: { select: { name: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true, barcode: true } } } },
          payments: true,
          customer: true,
          shift: { select: { id: true, status: true, openedAt: true } },
          cashier: {
            select: { id: true, username: true, name: true, role: true },
          },
        },
      });
    });

    if (!result) {
      throw new BadRequestException({ message: 'Sale not found after create', code: 'SALE_CREATE_FAILED' });
    }

    await this.audit.log({
      userId: cashierId,
      clientId,
      action: 'sale.create',
      entity: 'Sale',
      entityId: result.id,
      newValue: {
        invoiceNumber: result.invoiceNumber,
        total: result.total.toString(),
        paymentStatus: result.paymentStatus,
        shiftId: result.shiftId,
      },
    });

    return result;
  }

  private refundLineAmount(
    saleItem: { total: Prisma.Decimal; quantity: number },
    refundQty: number,
  ): Prisma.Decimal {
    if (refundQty <= 0 || saleItem.quantity <= 0) {
      return d0();
    }
    if (refundQty === saleItem.quantity) {
      return d(saleItem.total.toString());
    }
    return saleItem.total.mul(refundQty).div(saleItem.quantity);
  }

  async createRefund(saleId: string, dto: CreateRefundDto, user: SafeUser) {
    const trimmedReason = dto.reason.trim();
    if (!trimmedReason) {
      throw new BadRequestException({
        message: 'reason is required',
        code: 'REASON_REQUIRED',
      });
    }

    const useFull = dto.full === true;
    if (!useFull && (!dto.items || dto.items.length === 0)) {
      throw new BadRequestException({
        message: 'Provide items for a partial refund or set full to true',
        code: 'REFUND_ITEMS_OR_FULL',
      });
    }

    const saleHead = await this.prisma.sale.findFirst({
      where: { id: saleId, clientId: user.clientId },
      select: { branchId: true },
    });
    if (!saleHead) {
      throw new NotFoundException({ message: 'Sale not found', code: 'SALE_NOT_FOUND' });
    }
    await this.assertCanAccessBranchForMutation(user, saleHead.branchId);

    const result = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, clientId: user.clientId },
        include: { items: true },
      });

      if (!sale) {
        throw new NotFoundException({ message: 'Sale not found', code: 'SALE_NOT_FOUND' });
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException({
          message: 'Cannot refund a cancelled sale',
          code: 'SALE_CANCELLED',
        });
      }

      if (sale.status === SaleStatus.REFUNDED) {
        throw new BadRequestException({
          message: 'Sale is already fully refunded',
          code: 'ALREADY_REFUNDED',
        });
      }

      if (!sale.items.length) {
        throw new BadRequestException({
          message: 'Sale has no line items',
          code: 'SALE_EMPTY',
        });
      }

      const aggRows = await tx.refundItem.groupBy({
        by: ['saleItemId'],
        where: { refund: { saleId: sale.id } },
        _sum: { quantity: true },
      });

      const refundedQtyBySaleItem = new Map<string, number>();
      for (const row of aggRows) {
        refundedQtyBySaleItem.set(row.saleItemId, row._sum.quantity ?? 0);
      }

      const saleItemById = new Map(sale.items.map((i) => [i.id, i]));

      type ResolvedLine = { saleItem: (typeof sale.items)[number]; quantity: number };
      const resolved: ResolvedLine[] = [];

      if (useFull) {
        for (const si of sale.items) {
          const already = refundedQtyBySaleItem.get(si.id) ?? 0;
          const remaining = si.quantity - already;
          if (remaining > 0) {
            resolved.push({ saleItem: si, quantity: remaining });
          }
        }
        if (!resolved.length) {
          throw new BadRequestException({
            message: 'Nothing left to refund on this sale',
            code: 'NOTHING_TO_REFUND',
          });
        }
      } else {
        const merged = new Map<string, number>();
        for (const line of dto.items!) {
          merged.set(line.saleItemId, (merged.get(line.saleItemId) ?? 0) + line.quantity);
        }

        for (const [saleItemId, qty] of merged) {
          const si = saleItemById.get(saleItemId);
          if (!si) {
            throw new BadRequestException({
              message: 'Sale line does not belong to this sale',
              code: 'INVALID_SALE_ITEM',
              details: { saleItemId },
            });
          }
          const already = refundedQtyBySaleItem.get(si.id) ?? 0;
          const remaining = si.quantity - already;
          if (qty > remaining) {
            throw new BadRequestException({
              message: 'Refund quantity exceeds remaining quantity for this line',
              code: 'REFUND_EXCEEDS_REMAINING',
              details: { saleItemId, requested: qty, remaining },
            });
          }
          resolved.push({ saleItem: si, quantity: qty });
        }
      }

      let totalRefunded = d0();
      for (const { saleItem, quantity } of resolved) {
        totalRefunded = totalRefunded.add(this.refundLineAmount(saleItem, quantity));
      }

      const refund = await tx.refund.create({
        data: {
          clientId: sale.clientId,
          saleId: sale.id,
          userId: user.id,
          reason: trimmedReason,
          totalRefunded,
        },
      });

      for (const { saleItem, quantity } of resolved) {
        const lineAmount = this.refundLineAmount(saleItem, quantity);
        await tx.refundItem.create({
          data: {
            refundId: refund.id,
            saleItemId: saleItem.id,
            quantity,
            amount: lineAmount,
          },
        });

        await this.stockService.adjustStock(
          {
            clientId: sale.clientId,
            branchId: sale.branchId,
            productId: saleItem.productId,
            quantityChange: quantity,
            type: StockMovementType.RETURN,
            reason: `Refund ${sale.invoiceNumber}: ${trimmedReason}`,
            createdById: user.id,
            referenceType: 'refund',
            referenceId: refund.id,
            allowNegativeStock: false,
          },
          tx,
        );
      }

      const refundAdds = new Map<string, number>();
      for (const r of resolved) {
        refundAdds.set(r.saleItem.id, (refundAdds.get(r.saleItem.id) ?? 0) + r.quantity);
      }

      const allLinesFullyReturned = sale.items.every((si) => {
        const already = refundedQtyBySaleItem.get(si.id) ?? 0;
        const add = refundAdds.get(si.id) ?? 0;
        return already + add >= si.quantity;
      });

      const newStatus = allLinesFullyReturned
        ? SaleStatus.REFUNDED
        : SaleStatus.PARTIALLY_REFUNDED;

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: newStatus },
      });

      if (sale.customerId && totalRefunded.gt(0)) {
        await this.customerLedger.appendEntry(tx, {
          clientId: sale.clientId,
          customerId: sale.customerId,
          type: CustomerLedgerType.REFUND,
          amount: d(0).sub(totalRefunded),
          referenceType: 'refund',
          referenceId: refund.id,
          note: `Refund ${sale.invoiceNumber}: ${trimmedReason}`,
          createdById: user.id,
        });
      }

      return tx.refund.findUnique({
        where: { id: refund.id },
        include: {
          items: {
            include: {
              saleItem: {
                include: {
                  product: { select: { id: true, name: true, sku: true, barcode: true } },
                },
              },
            },
          },
          sale: {
            select: { id: true, invoiceNumber: true, status: true, total: true },
          },
          user: {
            select: { id: true, username: true, name: true, role: true },
          },
        },
      });
    });

    if (!result) {
      throw new BadRequestException({
        message: 'Refund not found after create',
        code: 'REFUND_CREATE_FAILED',
      });
    }

    await this.audit.log({
      userId: user.id,
      action: 'sale.refund',
      entity: 'Refund',
      entityId: result.id,
      newValue: {
        saleId: result.saleId,
        invoiceNumber: result.sale.invoiceNumber,
        totalRefunded: result.totalRefunded.toString(),
        reason: trimmedReason,
        saleStatus: result.sale.status,
      },
    });

    return result;
  }

  async findAll(user: SafeUser, query: ListSalesQueryDto, branchId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    let scopeBranch = branchId;
    if (user.role === UserRole.OWNER && query.branchId) {
      const b = await this.prisma.branch.findFirst({
        where: { id: query.branchId, isActive: true, clientId: user.clientId },
        select: { id: true },
      });
      if (!b) {
        throw new BadRequestException({
          message: 'branchId is not a valid active branch',
          code: 'INVALID_BRANCH',
        });
      }
      scopeBranch = query.branchId;
    }

    const where: Prisma.SaleWhereInput = {
      branchId: scopeBranch,
      clientId: user.clientId,
      ...this.buildSaleDateWhere(query.fromDate, query.toDate),
      ...(user.role === UserRole.CASHIER
        ? { cashierId: user.id }
        : query.cashierId
          ? { cashierId: query.cashierId }
          : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          cashier: {
            select: { id: true, username: true, name: true, role: true },
          },
          _count: { select: { items: true, payments: true } },
        },
      }),
      this.prisma.sale.count({ where }),
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

  async findOne(id: string, user: SafeUser, activeBranchId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, clientId: user.clientId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, barcode: true, unitType: true },
            },
          },
        },
        payments: true,
        refunds: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: { select: { saleItemId: true, quantity: true, amount: true } },
            user: { select: { id: true, name: true, username: true, role: true } },
          },
        },
        customer: true,
        shift: { select: { id: true, openedAt: true, status: true } },
        cashier: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
    });
    if (!sale) {
      throw new NotFoundException({ message: 'Sale not found', code: 'SALE_NOT_FOUND' });
    }
    this.assertSaleAccess(sale.cashierId, user);
    await this.assertSaleBranchAccess(user, sale.branchId, activeBranchId);
    return sale;
  }

  /** Active users for sale history cashier filter (OWNER/ADMIN). */
  async listUsersForSaleFilter(clientId: string) {
    return this.prisma.user.findMany({
      where: { isActive: true, clientId },
      select: { id: true, name: true, username: true, role: true },
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
      take: 200,
    });
  }

  async findByInvoiceNumber(invoiceNumber: string, user: SafeUser, activeBranchId: string) {
    const decoded = decodeURIComponent(invoiceNumber).trim();
    const sale = await this.prisma.sale.findFirst({
      where: { invoiceNumber: decoded, clientId: user.clientId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, barcode: true, unitType: true },
            },
          },
        },
        payments: true,
        customer: true,
        shift: { select: { id: true, openedAt: true, status: true } },
        cashier: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
    });
    if (!sale) {
      throw new NotFoundException({ message: 'Sale not found', code: 'SALE_NOT_FOUND' });
    }
    this.assertSaleAccess(sale.cashierId, user);
    await this.assertSaleBranchAccess(user, sale.branchId, activeBranchId);
    return sale;
  }

  private async assertCanAccessBranchForMutation(
    user: SafeUser,
    branchId: string,
  ): Promise<void> {
    if (user.role === UserRole.OWNER) {
      return;
    }
    const link = await this.prisma.userBranch.findFirst({
      where: { userId: user.id, branchId },
      select: { userId: true, branchId: true },
    });
    if (!link) {
      throw new ForbiddenException({
        message: 'You do not have access to this branch',
        code: 'BRANCH_ACCESS_DENIED',
      });
    }
  }

  private async assertSaleBranchAccess(
    user: SafeUser,
    saleBranchId: string,
    activeBranchId: string,
  ): Promise<void> {
    if (user.role === UserRole.OWNER) {
      return;
    }
    if (saleBranchId !== activeBranchId) {
      throw new ForbiddenException({
        message: 'This sale belongs to a different branch',
        code: 'SALE_BRANCH_MISMATCH',
      });
    }
    const link = await this.prisma.userBranch.findFirst({
      where: { userId: user.id, branchId: saleBranchId },
      select: { userId: true, branchId: true },
    });
    if (!link) {
      throw new ForbiddenException({
        message: 'You do not have access to this branch',
        code: 'BRANCH_ACCESS_DENIED',
      });
    }
  }

  private assertSaleAccess(saleCashierId: string, user: SafeUser): void {
    if (user.role === UserRole.CASHIER && saleCashierId !== user.id) {
      throw new ForbiddenException({
        message: 'You can only view your own sales',
        code: 'SALE_ACCESS_DENIED',
      });
    }
  }
}
