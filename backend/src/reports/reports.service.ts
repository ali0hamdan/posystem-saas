import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  CustomerLedgerType,
  PaymentStatus,
  Prisma,
  SaleStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';
import {
  BestSellingQueryDto,
  CashierPerformanceQueryDto,
  DailySalesQueryDto,
  RefundsReportQueryDto,
  CustomerPaymentHistoryQueryDto,
  ReportsDateRangeQueryDto,
  ReportsPaginationQueryDto,
} from './dto/reports.query.dto';
import { branchSaleFilterSql, saleFilterSql } from './reports.utils';

function dec(v: unknown): Prisma.Decimal {
  if (v == null) {
    return new Prisma.Decimal(0);
  }
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    return new Prisma.Decimal((v as { toString: () => string }).toString());
  }
  return new Prisma.Decimal(String(v));
}

function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function utcEndOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function parseDateOnly(s: string, label: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ message: `Invalid ${label}`, code: 'INVALID_DATE' });
  }
  return d;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function formatUtcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDateRange(
    query: ReportsDateRangeQueryDto,
    defaultDaysBack: number,
  ): { from: Date; to: Date } {
    const now = new Date();
    const to = query.toDate
      ? utcEndOfDay(parseDateOnly(query.toDate, 'toDate'))
      : utcEndOfDay(now);
    const from = query.fromDate
      ? utcStartOfDay(parseDateOnly(query.fromDate, 'fromDate'))
      : utcStartOfDay(addUtcDays(now, -defaultDaysBack));
    if (from > to) {
      throw new BadRequestException({
        message: 'fromDate must be before or equal to toDate',
        code: 'INVALID_DATE_RANGE',
      });
    }
    return { from, to };
  }

  private assertCashierDailyOnly(user: SafeUser): void {
    if (user.role === UserRole.CASHIER) {
      throw new ForbiddenException({
        message: 'Cashiers may only access daily sales reports',
        code: 'REPORTS_ACCESS_DENIED',
      });
    }
  }

  private resolveCashierFilter(
    user: SafeUser,
    requestedCashierId?: string,
  ): string | undefined {
    if (user.role === UserRole.CASHIER) {
      if (requestedCashierId && requestedCashierId !== user.id) {
        throw new ForbiddenException({
          message: 'You may only view your own sales',
          code: 'REPORTS_CASHIER_FILTER_DENIED',
        });
      }
      return user.id;
    }
    return requestedCashierId;
  }

  private async revenueAndCogs(
    clientId: string,
    branchId: string,
    from: Date,
    to: Date,
    opts?: { cashierId?: string; shiftId?: string },
  ): Promise<{ revenue: Prisma.Decimal; cogs: Prisma.Decimal }> {
    const filter = saleFilterSql(clientId, branchId, opts?.cashierId, opts?.shiftId, 's');
    const filterS2 = saleFilterSql(clientId, branchId, opts?.cashierId, opts?.shiftId, 's2');
    const rows = await this.prisma.$queryRaw<[{ revenue: unknown; cogs: unknown }]>`
      SELECT
        COALESCE(SUM(si."total"), 0)
        - COALESCE((
          SELECT SUM(ri."amount")
          FROM "RefundItem" ri
          INNER JOIN "Refund" rf ON rf."id" = ri."refundId"
          INNER JOIN "Sale" s2 ON s2."id" = rf."saleId"
          WHERE s2."createdAt" >= ${from}
            AND s2."createdAt" <= ${to}
            AND s2."status" <> 'CANCELLED'
            ${filterS2}
        ), 0) AS revenue,
        COALESCE(SUM(si."quantity" * si."costPriceAtSale"), 0)
        - COALESCE((
          SELECT SUM(ri."quantity" * si2."costPriceAtSale")
          FROM "RefundItem" ri
          INNER JOIN "SaleItem" si2 ON si2."id" = ri."saleItemId"
          INNER JOIN "Refund" rf ON rf."id" = ri."refundId"
          INNER JOIN "Sale" s2 ON s2."id" = rf."saleId"
          WHERE s2."createdAt" >= ${from}
            AND s2."createdAt" <= ${to}
            AND s2."status" <> 'CANCELLED'
            ${filterS2}
        ), 0) AS cogs
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s."id" = si."saleId"
      WHERE s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
        AND s."status" <> 'CANCELLED'
        ${filter}
    `;
    return { revenue: dec(rows[0]?.revenue), cogs: dec(rows[0]?.cogs) };
  }

  private async unpaidSalesTotal(where?: Prisma.SaleWhereInput): Promise<Prisma.Decimal> {
    const sales = await this.prisma.sale.findMany({
      where: {
        paymentStatus: { in: [PaymentStatus.PARTIAL, PaymentStatus.UNPAID] },
        status: { not: SaleStatus.CANCELLED },
        ...where,
      },
      select: {
        total: true,
        payments: { select: { amount: true } },
      },
    });
    let sum = new Prisma.Decimal(0);
    for (const s of sales) {
      let paid = new Prisma.Decimal(0);
      for (const p of s.payments) {
        paid = paid.add(p.amount);
      }
      const due = dec(s.total).sub(paid);
      if (due.gt(0)) {
        sum = sum.add(due);
      }
    }
    return sum;
  }

  async dashboard(user: SafeUser, branchId: string) {
    const now = new Date();
    const dayStart = utcStartOfDay(now);
    const dayEnd = utcEndOfDay(now);
    const todayScope: Prisma.SaleWhereInput = {
      clientId: user.clientId,
      branchId,
      ...(user.role === UserRole.CASHIER ? { cashierId: user.id } : {}),
    };
    const saleWhereBranchCashier = branchSaleFilterSql(
      user.clientId,
      branchId,
      user.role === UserRole.CASHIER ? user.id : undefined,
    );

    const revOpts =
      user.role === UserRole.CASHIER ? { cashierId: user.id } : {};

    const [
      todayRevCogs,
      todayOrdersCount,
      lowStockCount,
      outOfStockCount,
      totalProducts,
      totalCustomers,
      unpaidTotal,
      recentSales,
      bestRows,
    ] = await Promise.all([
      this.revenueAndCogs(user.clientId, branchId, dayStart, dayEnd, revOpts),
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
        WHERE p."clientId" = ${user.clientId} AND p."isActive" = true AND bs."quantity" > 0 AND bs."quantity" <= bs."minStock"
      `.then((r) => Number(r[0].c)),
      this.prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*)::bigint AS c
        FROM "Product" p
        INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
        WHERE p."clientId" = ${user.clientId} AND p."isActive" = true AND bs."quantity" = 0
      `.then((r) => Number(r[0].c)),
      this.prisma.product.count({ where: { isActive: true, clientId: user.clientId } }),
      this.prisma.customer.count({ where: { clientId: user.clientId } }),
      this.unpaidSalesTotal(todayScope),
      this.prisma.sale.findMany({
        where: { status: { not: SaleStatus.CANCELLED }, ...todayScope },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
          cashier: { select: { id: true, name: true, username: true } },
          customer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.$queryRaw<
        Array<{ productId: string; name: string; units: bigint; revenue: unknown }>
      >(Prisma.sql`
        SELECT si."productId"::text AS "productId",
               p."name" AS name,
               SUM(si."quantity" - COALESCE(rsum."refQty", 0))::bigint AS units,
               COALESCE(SUM(si."total" - COALESCE(rsum."refAmt", 0)), 0) AS revenue
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s."id" = si."saleId"
        INNER JOIN "Product" p ON p."id" = si."productId"
        LEFT JOIN (
          SELECT ri."saleItemId",
                 SUM(ri."quantity")::int AS "refQty",
                 SUM(ri."amount") AS "refAmt"
          FROM "RefundItem" ri
          GROUP BY ri."saleItemId"
        ) rsum ON rsum."saleItemId" = si."id"
        WHERE s."createdAt" >= ${addUtcDays(now, -30)}
          AND s."createdAt" <= ${utcEndOfDay(now)}
          AND s."status" <> 'CANCELLED'
          ${saleWhereBranchCashier}
        GROUP BY si."productId", p."name"
        ORDER BY units DESC
        LIMIT 5
      `),
    ]);

    const todayProfit = todayRevCogs.revenue.sub(todayRevCogs.cogs);

    return {
      todaySales: todayRevCogs.revenue.toString(),
      todayProfit: todayProfit.toString(),
      todayOrdersCount,
      lowStockCount,
      outOfStockCount,
      totalProducts,
      totalCustomers,
      unpaidSalesTotal: unpaidTotal.toString(),
      recentSales,
      bestSellingProducts: bestRows.map((r) => ({
        productId: r.productId,
        name: r.name,
        unitsSold: Number(r.units),
        revenue: dec(r.revenue).toString(),
      })),
    };
  }

  async dailySales(user: SafeUser, query: DailySalesQueryDto, branchId: string) {
    const { from, to } = this.buildDateRange(query, 6);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);

    if (user.role === UserRole.CASHIER && query.shiftId) {
      const ok = await this.prisma.shift.findFirst({
        where: { id: query.shiftId, cashierId: user.id, branchId, clientId: user.clientId },
        select: { id: true },
      });
      if (!ok) {
        throw new ForbiddenException({
          message: 'You can only filter by your own shifts',
          code: 'REPORTS_SHIFT_FILTER_DENIED',
        });
      }
    }

    const shiftId = query.shiftId;

    const days: Array<{
      date: string;
      ordersCount: number;
      revenue: string;
      profit: string;
    }> = [];

    for (let cur = new Date(from.getTime()); cur <= to; cur = addUtcDays(cur, 1)) {
      const ds = utcStartOfDay(cur);
      const de = utcEndOfDay(cur);
      const [revCogs, ordersCount] = await Promise.all([
        this.revenueAndCogs(user.clientId, branchId, ds, de, { cashierId, shiftId }),
        this.prisma.sale.count({
          where: {
            clientId: user.clientId,
            branchId,
            createdAt: { gte: ds, lte: de },
            status: { not: SaleStatus.CANCELLED },
            ...(cashierId ? { cashierId } : {}),
            ...(shiftId ? { shiftId } : {}),
          },
        }),
      ]);
      const profit = revCogs.revenue.sub(revCogs.cogs);
      days.push({
        date: formatUtcDateKey(ds),
        ordersCount,
        revenue: revCogs.revenue.toString(),
        profit: profit.toString(),
      });
    }

    return {
      data: days,
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        cashierId: cashierId ?? null,
        shiftId: shiftId ?? null,
      },
    };
  }

  async monthlySales(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 365);
    const saleF = saleFilterSql(user.clientId, branchId, query.cashierId, query.shiftId, 's');

    const rows = await this.prisma.$queryRaw<
      Array<{ month: Date; orders: bigint; revenue: unknown; cogs: unknown }>
    >(Prisma.sql`
      WITH per_sale AS (
        SELECT s."id",
               date_trunc('month', s."createdAt") AS month,
               (SELECT COALESCE(SUM(si2."total"), 0) FROM "SaleItem" si2 WHERE si2."saleId" = s."id")
               - COALESCE((
                 SELECT SUM(ri."amount")
                 FROM "RefundItem" ri
                 INNER JOIN "Refund" rf ON rf."id" = ri."refundId"
                 WHERE rf."saleId" = s."id"
               ), 0) AS net_rev,
               (SELECT COALESCE(SUM(si2."quantity" * si2."costPriceAtSale"), 0) FROM "SaleItem" si2 WHERE si2."saleId" = s."id")
               - COALESCE((
                 SELECT SUM(ri."quantity" * si3."costPriceAtSale")
                 FROM "RefundItem" ri
                 INNER JOIN "SaleItem" si3 ON si3."id" = ri."saleItemId"
                 INNER JOIN "Refund" rf ON rf."id" = ri."refundId"
                 WHERE rf."saleId" = s."id"
               ), 0) AS net_cogs
        FROM "Sale" s
        WHERE s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
          AND s."status" <> 'CANCELLED'
          ${saleF}
      )
      SELECT ps."month" AS month,
             COUNT(*)::bigint AS orders,
             COALESCE(SUM(ps."net_rev"), 0) AS revenue,
             COALESCE(SUM(ps."net_cogs"), 0) AS cogs
      FROM per_sale ps
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      data: rows.map((r) => ({
        month: r.month.toISOString().slice(0, 7),
        ordersCount: Number(r.orders),
        revenue: dec(r.revenue).toString(),
        profit: dec(r.revenue).sub(dec(r.cogs)).toString(),
      })),
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        cashierId: query.cashierId ?? null,
        shiftId: query.shiftId ?? null,
      },
    };
  }

  async profit(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const revCogs = await this.revenueAndCogs(user.clientId, branchId, from, to, {
      cashierId: query.cashierId,
      shiftId: query.shiftId,
    });
    const profit = revCogs.revenue.sub(revCogs.cogs);
    return {
      fromDate: formatUtcDateKey(from),
      toDate: formatUtcDateKey(to),
      cashierId: query.cashierId ?? null,
      shiftId: query.shiftId ?? null,
      revenue: revCogs.revenue.toString(),
      costOfGoodsSold: revCogs.cogs.toString(),
      profit: profit.toString(),
    };
  }

  async bestSellingProducts(user: SafeUser, query: BestSellingQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const limit = query.limit ?? 10;
    const saleF = saleFilterSql(user.clientId, branchId, query.cashierId, query.shiftId, 's');

    const rows = await this.prisma.$queryRaw<
      Array<{ productId: string; name: string; units: bigint; revenue: unknown }>
    >(Prisma.sql`
      SELECT si."productId"::text AS "productId",
             p."name" AS name,
             SUM(si."quantity" - COALESCE(rsum."refQty", 0))::bigint AS units,
             COALESCE(SUM(si."total" - COALESCE(rsum."refAmt", 0)), 0) AS revenue
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s."id" = si."saleId"
      INNER JOIN "Product" p ON p."id" = si."productId"
      LEFT JOIN (
        SELECT ri."saleItemId",
               SUM(ri."quantity")::int AS "refQty",
               SUM(ri."amount") AS "refAmt"
        FROM "RefundItem" ri
        GROUP BY ri."saleItemId"
      ) rsum ON rsum."saleItemId" = si."id"
      WHERE s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
        AND s."status" <> 'CANCELLED'
        ${saleF}
      GROUP BY si."productId", p."name"
      ORDER BY units DESC
      LIMIT ${limit}
    `);

    return {
      data: rows.map((r) => ({
        productId: r.productId,
        name: r.name,
        unitsSold: Number(r.units),
        revenue: dec(r.revenue).toString(),
      })),
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        limit,
        cashierId: query.cashierId ?? null,
        shiftId: query.shiftId ?? null,
      },
    };
  }

  async lowStock(user: SafeUser, query: ReportsPaginationQueryDto, branchId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        sku: string | null;
        quantity: number;
        minStock: number;
        costPrice: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
      }>
    >(Prisma.sql`
      SELECT p."id", p."name", p."sku", bs."quantity", bs."minStock", p."costPrice", p."sellingPrice"
      FROM "Product" p
      INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
      WHERE p."clientId" = ${user.clientId} AND p."isActive" = true AND bs."quantity" <= bs."minStock"
      ORDER BY bs."quantity" ASC
      OFFSET ${skip}
      LIMIT ${limit}
    `);

    const countRow = await this.prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "Product" p
      INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
      WHERE p."clientId" = ${user.clientId} AND p."isActive" = true AND bs."quantity" <= bs."minStock"
    `);
    const total = Number(countRow[0].c);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async stockValue(user: SafeUser, branchId: string) {
    this.assertCashierDailyOnly(user);
    const row = await this.prisma.$queryRaw<[{ v: unknown }]>`
      SELECT COALESCE(SUM(bs."quantity" * p."costPrice"), 0) AS v
      FROM "BranchStock" bs
      INNER JOIN "Product" p ON p."id" = bs."productId"
      WHERE bs."branchId" = ${branchId} AND p."clientId" = ${user.clientId} AND p."isActive" = true
    `;
    return { totalStockValue: dec(row[0]?.v).toString() };
  }

  async cashierPerformance(user: SafeUser, query: CashierPerformanceQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const saleF = saleFilterSql(user.clientId, branchId, query.cashierId, query.shiftId, 's');

    const rows = await this.prisma.$queryRaw<
      Array<{
        cashierId: string;
        name: string;
        username: string;
        orders: bigint;
        revenue: unknown;
        cogs: unknown;
      }>
    >(Prisma.sql`
      WITH per_sale AS (
        SELECT s."id",
               s."cashierId",
               (SELECT COALESCE(SUM(si2."total"), 0) FROM "SaleItem" si2 WHERE si2."saleId" = s."id")
               - COALESCE((
                 SELECT SUM(ri."amount")
                 FROM "RefundItem" ri
                 INNER JOIN "Refund" rf ON rf."id" = ri."refundId"
                 WHERE rf."saleId" = s."id"
               ), 0) AS net_rev,
               (SELECT COALESCE(SUM(si2."quantity" * si2."costPriceAtSale"), 0) FROM "SaleItem" si2 WHERE si2."saleId" = s."id")
               - COALESCE((
                 SELECT SUM(ri."quantity" * si3."costPriceAtSale")
                 FROM "RefundItem" ri
                 INNER JOIN "SaleItem" si3 ON si3."id" = ri."saleItemId"
                 INNER JOIN "Refund" rf ON rf."id" = ri."refundId"
                 WHERE rf."saleId" = s."id"
               ), 0) AS net_cogs
        FROM "Sale" s
        WHERE s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
          AND s."status" <> 'CANCELLED'
          ${saleF}
      )
      SELECT ps."cashierId"::text AS "cashierId",
             u."name" AS name,
             u."username" AS username,
             COUNT(*)::bigint AS orders,
             COALESCE(SUM(ps."net_rev"), 0) AS revenue,
             COALESCE(SUM(ps."net_cogs"), 0) AS cogs
      FROM per_sale ps
      INNER JOIN "User" u ON u."id" = ps."cashierId"
      GROUP BY ps."cashierId", u."name", u."username"
      ORDER BY revenue DESC
    `);

    return {
      data: rows.map((r) => ({
        cashierId: r.cashierId,
        name: r.name,
        username: r.username,
        ordersCount: Number(r.orders),
        revenue: dec(r.revenue).toString(),
        profit: dec(r.revenue).sub(dec(r.cogs)).toString(),
      })),
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        cashierId: query.cashierId ?? null,
        shiftId: query.shiftId ?? null,
      },
    };
  }

  async refunds(user: SafeUser, query: RefundsReportQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RefundWhereInput = {
      clientId: user.clientId,
      createdAt: { gte: from, lte: to },
      ...(query.userId ? { userId: query.userId } : {}),
      sale: {
        clientId: user.clientId,
        branchId,
        ...(query.cashierId ? { cashierId: query.cashierId } : {}),
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
              cashierId: true,
            },
          },
        },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        userId: query.userId ?? null,
        cashierId: query.cashierId ?? null,
        shiftId: query.shiftId ?? null,
      },
    };
  }

  async customerDebts(user: SafeUser, query: ReportsPaginationQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: { clientId: user.clientId, balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          balance: true,
        },
      }),
      this.prisma.customer.count({ where: { clientId: user.clientId, balance: { gt: 0 } } }),
    ]);

    return {
      data: data.map((c) => ({
        ...c,
        balance: c.balance.toString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /**
   * Sum of positive customer balances (accounts receivable) and how many customers owe money.
   * Customers are global (not branch-scoped); branchId is accepted for API consistency only.
   */
  async customerCreditSummary(user: SafeUser, _branchId: string) {
    this.assertCashierDailyOnly(user);
    const rows = await this.prisma.$queryRaw<[{ totalDebt: unknown; debtorCount: bigint }]>(Prisma.sql`
      SELECT
        COALESCE(SUM(GREATEST("balance"::numeric, 0)), 0) AS "totalDebt",
        COUNT(*) FILTER (WHERE "balance" > 0)::bigint AS "debtorCount"
      FROM "Customer"
      WHERE "clientId" = ${user.clientId}
    `);
    const r = rows[0];
    return {
      totalDebt: dec(r?.totalDebt).toString(),
      debtorCount: Number(r?.debtorCount ?? 0),
    };
  }

  async customerPaymentHistory(
    user: SafeUser,
    query: CustomerPaymentHistoryQueryDto,
    _branchId: string,
  ) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(
      { fromDate: query.fromDate, toDate: query.toDate },
      30,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerLedgerWhereInput = {
      clientId: user.clientId,
      type: CustomerLedgerType.PAYMENT,
      createdAt: { gte: from, lte: to },
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.customerLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { id: true, name: true, username: true } },
        },
      }),
      this.prisma.customerLedger.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        type: r.type,
        amount: r.amount.toString(),
        balanceAfter: r.balanceAfter.toString(),
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        note: r.note,
        receiptNumber: r.receiptNumber,
        createdAt: r.createdAt,
        customer: r.customer,
        createdBy: r.createdBy,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        customerId: query.customerId ?? null,
      },
    };
  }
}
