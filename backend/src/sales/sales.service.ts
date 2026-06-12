import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CouponType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundSourceType,
  SaleStatus,
  ShiftStatus,
  StockMovementType,
  UserRole,
  CustomerLedgerType,
  RestockAction,
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
import { NotificationService } from '../notifications/notification.service';
import { RefundService } from '../refunds/refund.service';
import { SalesCommissionService } from '../commissions/sales-commission.service';

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
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly audit: AuditLogService,
    private readonly settingsService: SettingsService,
    private readonly customerLedger: CustomerLedgerService,
    private readonly notifications: NotificationService,
    private readonly refunds: RefundService,
    private readonly commissions: SalesCommissionService,
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
      const unitPrice =
        line.unitPrice != null ? d(line.unitPrice) : d(p.sellingPrice.toString());
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

  async create(dto: CreateSaleDto, actor: SafeUser, branchId: string, clientId: string) {
    const cashierId = actor.id;
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
    const salesmanId = await this.commissions.resolveSalesmanForSale(actor, clientId, {
      salesmanId: dto.salesmanId,
      salesmanIdCode: dto.salesmanIdCode,
    });

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
          createdByUserId: actor.id,
          salesmanId,
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
          note: `Sale ${invoiceNumber} â€” on account`,
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

    void this.notifications
      .notifyPurchaseCompleted({
        clientId,
        invoiceNumber: result.invoiceNumber,
        total: result.total.toString(),
        customerName: result.customer?.name ?? null,
        paymentMethod: result.payments.map((p) => p.method).join(', ') || null,
        branchName: result.branch?.name ?? null,
        createdByName: result.cashier?.name ?? null,
        linkPath: '/sales',
      })
      .catch((err) =>
        this.logger.warn(`Purchase notification failed: ${(err as Error).message}`),
      );

    if (result.paymentStatus === PaymentStatus.PAID) {
      void this.commissions
        .calculateCommissionForSale(result.id, clientId)
        .catch((err) =>
          this.logger.warn(`Commission calculation failed: ${(err as Error).message}`),
        );
    }

    return result;
  }

  async createRefund(saleId: string, dto: CreateRefundDto, user: SafeUser) {
    const saleHead = await this.prisma.sale.findFirst({
      where: { id: saleId, clientId: user.clientId },
      select: { branchId: true },
    });
    if (!saleHead) {
      throw new NotFoundException({ message: 'Sale not found', code: 'SALE_NOT_FOUND' });
    }
    await this.assertCanAccessBranchForMutation(user, saleHead.branchId);

    return this.refunds.refundSale(
      saleId,
      {
        reason: dto.reason,
        approvalIdCode: dto.approvalIdCode,
        nfcCardUid: dto.nfcCardUid,
        approvalPin: dto.approvalPin,
        full: dto.full,
        sourceType: RefundSourceType.RETAIL_SALE, // resolved inside refundSale
        sourceId: saleId,
        items: dto.items?.map((line) => ({
          sourceItemId: line.saleItemId,
          quantity: line.quantity,
          restockAction: RestockAction.RESTOCK,
        })),
      },
      user,
    );
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
          salesman: {
            select: { id: true, name: true, username: true, salesmanIdCode: true },
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
            items: {
              select: {
                saleItemId: true,
                sourceItemId: true,
                quantity: true,
                amount: true,
                restockAction: true,
                itemNameSnapshot: true,
              },
            },
            user: { select: { id: true, name: true, username: true, role: true } },
          },
        },
        customer: true,
        shift: { select: { id: true, openedAt: true, status: true } },
        cashier: {
          select: { id: true, username: true, name: true, role: true },
        },
        createdBy: {
          select: { id: true, username: true, name: true, role: true },
        },
        salesman: {
          select: { id: true, username: true, name: true, role: true, salesmanIdCode: true },
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
        createdBy: {
          select: { id: true, username: true, name: true, role: true },
        },
        salesman: {
          select: { id: true, username: true, name: true, role: true, salesmanIdCode: true },
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
