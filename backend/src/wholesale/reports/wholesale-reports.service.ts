import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  BusinessType,
  DeliveryNoteStatus,
  PaymentStatus,
  ProformaInvoiceStatus,
  PurchaseStatus,
  QuotationStatus,
  SaleStatus,
  StockReservationStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureService } from '../../fnb/feature/feature.service';
import { SafeUser } from '../../auth/types/safe-user.type';

function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function utcEndOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

@Injectable()
export class WholesaleReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureService,
  ) {}

  private async assertWholesaleAccess(clientId: string): Promise<void> {
    const businessType = await this.features.getBusinessType(clientId);
    if (businessType !== BusinessType.WHOLESALE && businessType !== BusinessType.HYBRID) {
      throw new ForbiddenException({
        message: 'Wholesale module is not enabled for this business type',
        code: 'WHOLESALE_NOT_ENABLED',
      });
    }
    await this.features.assertFeature(clientId, 'wholesale_module');
  }

  async dashboard(user: SafeUser, branchId: string) {
    const clientId = user.clientId;
    await this.assertWholesaleAccess(clientId);

    const quotationWhere = {
      clientId,
      ...(branchId ? { branchId } : {}),
    };

    const proformaWhere = {
      clientId,
      ...(branchId ? { branchId } : {}),
    };

    const saleWhere = {
      clientId,
      branchId,
      paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] as PaymentStatus[] },
    };

    const todayScope = {
      clientId,
      branchId,
      ...(user.role === UserRole.CASHIER ? { cashierId: user.id } : {}),
    };

    const reservationWhere = {
      clientId,
      status: StockReservationStatus.ACTIVE,
      ...(branchId ? { branchId } : {}),
    };

    const now = new Date();
    const dayStart = utcStartOfDay(now);
    const dayEnd = utcEndOfDay(now);
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const overdueCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      quotedAgg,
      pendingQuotations,
      acceptedQuotations,
      pendingProformas,
      unpaidInvoicesAgg,
      reservedAgg,
      recentQuotations,
      recentProformas,
      expiringQuotations,
      topCustomers,
      customerDebtAgg,
      deliveriesPending,
      todaySalesAgg,
      todayOrdersCount,
      lowStockCount,
      totalProducts,
      totalCustomers,
      purchaseOrdersPending,
      stockMovementsToday,
      overdueInvoices,
      recentInvoices,
      lowStockProducts,
      topCustomersByBalance,
      recentStockMovements,
      todayCogsRow,
    ] = await Promise.all([
      this.prisma.quotation.aggregate({
        where: {
          ...quotationWhere,
          status: {
            notIn: [
              QuotationStatus.CANCELLED,
              QuotationStatus.REJECTED,
              QuotationStatus.EXPIRED,
            ],
          },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.quotation.count({
        where: {
          ...quotationWhere,
          status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT] },
        },
      }),
      this.prisma.quotation.count({
        where: {
          ...quotationWhere,
          status: {
            in: [
              QuotationStatus.ACCEPTED,
              QuotationStatus.CONVERTED_TO_PROFORMA,
              QuotationStatus.CONVERTED_TO_INVOICE,
            ],
          },
        },
      }),
      this.prisma.proformaInvoice.count({
        where: {
          ...proformaWhere,
          status: {
            in: [
              ProformaInvoiceStatus.DRAFT,
              ProformaInvoiceStatus.SENT,
              ProformaInvoiceStatus.APPROVED,
            ],
          },
        },
      }),
      this.prisma.sale.aggregate({
        where: saleWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.stockReservation.aggregate({
        where: reservationWhere,
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      this.prisma.quotation.findMany({
        where: quotationWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          total: true,
          validUntil: true,
          createdAt: true,
          customerId: true,
        },
      }),
      this.prisma.proformaInvoice.findMany({
        where: proformaWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          proformaNumber: true,
          status: true,
          total: true,
          validUntil: true,
          createdAt: true,
          customerId: true,
        },
      }),
      this.prisma.quotation.count({
        where: {
          ...quotationWhere,
          validUntil: { gte: now, lte: inSevenDays },
          status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT, QuotationStatus.ACCEPTED] },
        },
      }),
      this.prisma.sale.groupBy({
        by: ['customerId'],
        where: {
          clientId,
          ...(branchId ? { branchId } : {}),
          customerId: { not: null },
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      this.prisma.customer.aggregate({
        where: { clientId, balance: { gt: 0 } },
        _sum: { balance: true },
        _count: { _all: true },
      }),
      this.prisma.deliveryNote.count({
        where: {
          clientId,
          ...(branchId ? { branchId } : {}),
          status: { in: [DeliveryNoteStatus.DRAFT, DeliveryNoteStatus.SENT] },
        },
      }),
      this.prisma.sale.aggregate({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          status: { not: SaleStatus.CANCELLED },
          ...todayScope,
        },
        _sum: { total: true },
      }),
      this.prisma.sale.count({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          status: { not: SaleStatus.CANCELLED },
          ...todayScope,
        },
      }),
      this.prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*)::bigint AS c
        FROM "Product" p
        INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
        WHERE p."clientId" = ${clientId} AND p."isActive" = true AND bs."quantity" > 0 AND bs."quantity" <= bs."minStock"
      `.then((r) => Number(r[0].c)),
      this.prisma.product.count({ where: { isActive: true, clientId } }),
      this.prisma.customer.count({ where: { clientId } }),
      this.prisma.purchaseOrder.count({
        where: {
          clientId,
          status: { in: [PurchaseStatus.DRAFT, PurchaseStatus.ORDERED] },
        },
      }),
      this.prisma.stockMovement.count({
        where: {
          clientId,
          branchId,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      this.prisma.sale.count({
        where: {
          ...saleWhere,
          createdAt: { lt: overdueCutoff },
        },
      }),
      this.prisma.sale.findMany({
        where: { status: { not: SaleStatus.CANCELLED }, ...todayScope },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paymentStatus: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.$queryRaw<
        Array<{ productId: string; name: string; quantity: number; minStock: number }>
      >`
        SELECT p."id"::text AS "productId", p."name" AS name, bs."quantity"::int AS quantity, bs."minStock"::int AS "minStock"
        FROM "Product" p
        INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
        WHERE p."clientId" = ${clientId} AND p."isActive" = true AND bs."quantity" <= bs."minStock"
        ORDER BY bs."quantity" ASC
        LIMIT 6
      `,
      this.prisma.customer.findMany({
        where: { clientId, balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
        take: 5,
        select: { id: true, name: true, balance: true, companyName: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { clientId, branchId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          type: true,
          quantityChange: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      }),
      this.prisma.$queryRaw<[{ cogs: unknown }]>`
        SELECT COALESCE(SUM(si."costPriceAtSale" * si."quantity"), 0) AS cogs
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s."id" = si."saleId"
        WHERE s."clientId" = ${clientId}
          AND s."branchId" = ${branchId}
          AND s."createdAt" >= ${dayStart}
          AND s."createdAt" <= ${dayEnd}
          AND s."status" <> 'CANCELLED'
          ${user.role === UserRole.CASHIER ? Prisma.sql`AND s."cashierId" = ${user.id}` : Prisma.empty}
      `,
    ]);

    const todaySales = todaySalesAgg._sum.total ?? new Prisma.Decimal(0);
    const todayCogs = new Prisma.Decimal(String(todayCogsRow[0]?.cogs ?? 0));
    const todayProfit = todaySales.sub(todayCogs);

    const customerIds = [
      ...new Set([
        ...recentQuotations.map((q) => q.customerId).filter(Boolean),
        ...recentProformas.map((p) => p.customerId).filter(Boolean),
        ...topCustomers.map((t) => t.customerId).filter(Boolean),
      ]),
    ] as string[];

    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { clientId, id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : [];
    const customerNameById = Object.fromEntries(customers.map((c) => [c.id, c.name]));

    return {
      note: 'Quotation and proforma values are NOT revenue. Only official invoices/sales count as revenue.',
      operational: {
        todaySales: todaySales.toString(),
        todayProfit: todayProfit.toString(),
        todayOrdersCount,
        lowStockCount,
        totalProducts,
        totalCustomers,
        purchaseOrdersPending,
        stockMovementsToday,
      },
      cards: {
        totalQuotedValue: quotedAgg._sum.total?.toString() ?? '0',
        pendingQuotations,
        acceptedQuotations,
        proformaInvoicesPending: pendingProformas,
        officialInvoicesUnpaid: unpaidInvoicesAgg._count._all,
        officialInvoicesUnpaidValue: unpaidInvoicesAgg._sum.total?.toString() ?? '0',
        customerOutstandingDebt: customerDebtAgg._sum.balance?.toString() ?? '0',
        customersWithDebt: customerDebtAgg._count._all,
        stockReservedUnits: reservedAgg._sum.quantity ?? 0,
        stockReservedLines: reservedAgg._count._all,
        expiringQuotations,
        deliveriesPending,
        overdueInvoices,
      },
      recentQuotations: recentQuotations.map((q) => ({
        ...q,
        total: q.total.toString(),
        customerName: q.customerId ? customerNameById[q.customerId] ?? null : null,
      })),
      recentProformas: recentProformas.map((p) => ({
        ...p,
        total: p.total.toString(),
        customerName: p.customerId ? customerNameById[p.customerId] ?? null : null,
      })),
      topCustomers: topCustomers
        .filter((t) => t.customerId)
        .map((t) => ({
          customerId: t.customerId!,
          customerName: customerNameById[t.customerId!] ?? 'Unknown',
          orderCount: t._count._all,
          totalValue: t._sum.total?.toString() ?? '0',
        })),
      recentInvoices: recentInvoices.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        total: s.total.toString(),
        paymentStatus: s.paymentStatus,
        createdAt: s.createdAt,
        customerName: s.customer?.name ?? null,
      })),
      lowStockProducts: lowStockProducts.map((p) => ({
        productId: p.productId,
        name: p.name,
        quantity: Number(p.quantity),
        minStock: Number(p.minStock),
      })),
      topCustomersByBalance: topCustomersByBalance.map((c) => ({
        customerId: c.id,
        customerName: c.companyName && c.companyName !== c.name ? `${c.name} · ${c.companyName}` : c.name,
        balance: c.balance.toString(),
      })),
      recentStockMovements: recentStockMovements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantityChange,
        createdAt: m.createdAt,
        productName: m.product.name,
      })),
    };
  }
}
