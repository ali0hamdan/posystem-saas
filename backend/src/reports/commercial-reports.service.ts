import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SaleStatus, StockMovementType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';
import {
  addUtcDays,
  dec,
  formatUtcDateKey,
  joinSql,
  parseDateOnly,
  saleFilterSql,
  utcEndOfDay,
  utcStartOfDay,
} from './reports.utils';
import {
  GrossProfitByProductQueryDto,
  InventoryMovementsQueryDto,
  ProductExpiryReportQueryDto,
  ReportsDateRangeQueryDto,
  ReportsPaginationQueryDto,
} from './dto/reports.query.dto';

@Injectable()
export class CommercialReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDateRange(
    query: ReportsDateRangeQueryDto,
    defaultDaysBack: number,
  ): { from: Date; to: Date } {
    const now = new Date();
    const to = query.toDate ? utcEndOfDay(parseDateOnly(query.toDate, 'toDate')) : utcEndOfDay(now);
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
        message: 'Cashiers may only access daily sales and low-stock reports',
        code: 'REPORTS_ACCESS_DENIED',
      });
    }
  }

  private resolveCashierFilter(user: SafeUser, requestedCashierId?: string): string | undefined {
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

  /** Net revenue and COGS using `costPriceAtSale` on sale lines (refunds netted). */
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

  /** Sales summary for a branch and date range (financials use sale-time cost). */
  async salesSummary(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    const { from, to } = this.buildDateRange(query, 30);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);
    const revCogs = await this.revenueAndCogs(user.clientId, branchId, from, to, {
      cashierId,
      shiftId: query.shiftId,
    });

    const saleWhere: Prisma.SaleWhereInput = {
      clientId: user.clientId,
      branchId,
      status: { not: SaleStatus.CANCELLED },
      createdAt: { gte: from, lte: to },
      ...(cashierId ? { cashierId } : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
    };

    const [ordersCount, saleSums, refundAgg, lineDisc] = await Promise.all([
      this.prisma.sale.count({ where: saleWhere }),
      this.prisma.sale.aggregate({
        where: saleWhere,
        _sum: {
          subtotal: true,
          discountTotal: true,
          taxTotal: true,
          total: true,
        },
      }),
      this.prisma.refund.aggregate({
        where: {
          clientId: user.clientId,
          createdAt: { gte: from, lte: to },
          sale: {
            clientId: user.clientId,
            branchId,
            ...(cashierId ? { cashierId } : {}),
            ...(query.shiftId ? { shiftId: query.shiftId } : {}),
          },
        },
        _sum: { totalRefunded: true },
      }),
      this.prisma.$queryRaw<[{ v: unknown }]>(Prisma.sql`
        SELECT COALESCE(SUM(si."discount"), 0) AS v
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s."id" = si."saleId"
        WHERE s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
          AND s."status" <> 'CANCELLED'
          ${saleFilterSql(user.clientId, branchId, cashierId, query.shiftId, 's')}
      `),
    ]);

    const grossProfit = revCogs.revenue.sub(revCogs.cogs);
    const grossSales = dec(saleSums._sum.total);
    const avgTicket =
      ordersCount > 0 ? revCogs.revenue.div(ordersCount) : new Prisma.Decimal(0);

    return {
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
        cashierId: cashierId ?? null,
        shiftId: query.shiftId ?? null,
      },
      ordersCount,
      sumSubtotal: dec(saleSums._sum.subtotal).toString(),
      sumTax: dec(saleSums._sum.taxTotal).toString(),
      sumSaleLevelDiscounts: dec(saleSums._sum.discountTotal).toString(),
      sumLineDiscounts: dec(lineDisc[0]?.v).toString(),
      sumGrossSaleTotals: grossSales.toString(),
      sumRefunds: dec(refundAgg._sum.totalRefunded).toString(),
      netRevenue: revCogs.revenue.toString(),
      costOfGoodsSold: revCogs.cogs.toString(),
      grossProfit: grossProfit.toString(),
      averageNetTicket: avgTicket.toString(),
    };
  }

  async profitAndLoss(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);
    const revCogs = await this.revenueAndCogs(user.clientId, branchId, from, to, {
      cashierId,
      shiftId: query.shiftId,
    });
    const grossProfit = revCogs.revenue.sub(revCogs.cogs);

    const expenseSum = await this.prisma.$queryRaw<[{ v: unknown }]>`
      SELECT COALESCE(SUM(e."amount"), 0) AS v
      FROM "Expense" e
      LEFT JOIN "Shift" sh ON sh."id" = e."shiftId"
      WHERE e."createdAt" >= ${from}
        AND e."createdAt" <= ${to}
        AND e."clientId" = ${user.clientId}
        AND (e."shiftId" IS NULL OR sh."branchId" = ${branchId})
    `;
    const expenses = dec(expenseSum[0]?.v);
    const netOperatingIncome = grossProfit.sub(expenses);

    return {
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
        cashierId: cashierId ?? null,
        shiftId: query.shiftId ?? null,
      },
      netRevenue: revCogs.revenue.toString(),
      costOfGoodsSold: revCogs.cogs.toString(),
      grossProfit: grossProfit.toString(),
      operatingExpenses: expenses.toString(),
      netOperatingIncome: netOperatingIncome.toString(),
    };
  }

  async grossProfitByProduct(
    user: SafeUser,
    query: GrossProfitByProductQueryDto,
    branchId: string,
  ) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const saleWhereExtra = joinSql([
      saleFilterSql(user.clientId, branchId, cashierId, query.shiftId, 's'),
      ...(query.categoryId ? [Prisma.sql`AND p."categoryId" = ${query.categoryId}`] : []),
      ...(query.productId ? [Prisma.sql`AND si."productId" = ${query.productId}`] : []),
    ]);

    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        name: string;
        sku: string | null;
        units: bigint;
        revenue: unknown;
        cogs: unknown;
      }>
    >(Prisma.sql`
      SELECT si."productId"::text AS "productId",
             p."name" AS name,
             p."sku" AS sku,
             SUM(si."quantity" - COALESCE(rsum."refQty", 0))::bigint AS units,
             COALESCE(SUM(si."total" - COALESCE(rsum."refAmt", 0)), 0) AS revenue,
             COALESCE(SUM(
               (si."quantity" - COALESCE(rsum."refQty", 0)) * si."costPriceAtSale"
             ), 0) AS cogs
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
        ${saleWhereExtra}
      GROUP BY si."productId", p."name", p."sku"
      HAVING SUM(si."quantity" - COALESCE(rsum."refQty", 0)) > 0
      ORDER BY (COALESCE(SUM(si."total" - COALESCE(rsum."refAmt", 0)), 0)
        - COALESCE(SUM((si."quantity" - COALESCE(rsum."refQty", 0)) * si."costPriceAtSale"), 0)) DESC
      LIMIT ${limit}
    `);

    return {
      data: rows.map((r) => {
        const rev = dec(r.revenue);
        const cg = dec(r.cogs);
        return {
          productId: r.productId,
          name: r.name,
          sku: r.sku,
          unitsSold: Number(r.units),
          netRevenue: rev.toString(),
          costOfGoodsSold: cg.toString(),
          grossProfit: rev.sub(cg).toString(),
        };
      }),
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        limit,
        branchId,
        categoryId: query.categoryId ?? null,
        productId: query.productId ?? null,
      },
    };
  }

  async grossProfitByCategory(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);
    const saleF = saleFilterSql(user.clientId, branchId, cashierId, query.shiftId, 's');

    const rows = await this.prisma.$queryRaw<
      Array<{
        categoryId: string;
        name: string;
        units: bigint;
        revenue: unknown;
        cogs: unknown;
      }>
    >(Prisma.sql`
      SELECT c."id"::text AS "categoryId",
             c."name" AS name,
             SUM(si."quantity" - COALESCE(rsum."refQty", 0))::bigint AS units,
             COALESCE(SUM(si."total" - COALESCE(rsum."refAmt", 0)), 0) AS revenue,
             COALESCE(SUM(
               (si."quantity" - COALESCE(rsum."refQty", 0)) * si."costPriceAtSale"
             ), 0) AS cogs
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s."id" = si."saleId"
      INNER JOIN "Product" p ON p."id" = si."productId"
      INNER JOIN "Category" c ON c."id" = p."categoryId"
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
      GROUP BY c."id", c."name"
      HAVING SUM(si."quantity" - COALESCE(rsum."refQty", 0)) > 0
      ORDER BY (COALESCE(SUM(si."total" - COALESCE(rsum."refAmt", 0)), 0)
        - COALESCE(SUM((si."quantity" - COALESCE(rsum."refQty", 0)) * si."costPriceAtSale"), 0)) DESC
    `);

    return {
      data: rows.map((r) => {
        const rev = dec(r.revenue);
        const cg = dec(r.cogs);
        return {
          categoryId: r.categoryId,
          name: r.name,
          unitsSold: Number(r.units),
          netRevenue: rev.toString(),
          costOfGoodsSold: cg.toString(),
          grossProfit: rev.sub(cg).toString(),
        };
      }),
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
      },
    };
  }

  async paymentMethods(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);
    const saleF = saleFilterSql(user.clientId, branchId, cashierId, query.shiftId, 's');

    const rows = await this.prisma.$queryRaw<Array<{ method: string; txCount: bigint; amount: unknown }>>(Prisma.sql`
      SELECT pay."method"::text AS method,
             COUNT(*)::bigint AS "txCount",
             COALESCE(SUM(pay."amount"), 0) AS amount
      FROM "Payment" pay
      INNER JOIN "Sale" s ON s."id" = pay."saleId"
      WHERE s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
        AND s."status" <> 'CANCELLED'
        ${saleF}
      GROUP BY pay."method"
      ORDER BY amount DESC
    `);

    const total = rows.reduce((a, r) => a.add(dec(r.amount)), new Prisma.Decimal(0));

    return {
      data: rows.map((r) => ({
        method: r.method,
        paymentCount: Number(r.txCount),
        amount: dec(r.amount).toString(),
        shareOfTotal: total.gt(0) ? dec(r.amount).div(total).mul(100).toString() : '0',
      })),
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
        totalPayments: total.toString(),
      },
    };
  }

  async discountsReport(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);
    const saleF = saleFilterSql(user.clientId, branchId, cashierId, query.shiftId, 's');

    const [lineRow, saleRow, lineByDay, saleByDay] = await Promise.all([
      this.prisma.$queryRaw<[{ v: unknown }]>(Prisma.sql`
        SELECT COALESCE(SUM(si."discount"), 0) AS v
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s."id" = si."saleId"
        WHERE s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
          AND s."status" <> 'CANCELLED'
          ${saleF}
      `),
      this.prisma.$queryRaw<[{ v: unknown }]>(Prisma.sql`
        SELECT COALESCE(SUM(s."discountTotal"), 0) AS v
        FROM "Sale" s
        WHERE s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
          AND s."status" <> 'CANCELLED'
          ${saleF}
      `),
      this.prisma.$queryRaw<Array<{ d: Date; v: unknown }>>(Prisma.sql`
        SELECT date_trunc('day', s."createdAt" AT TIME ZONE 'UTC') AS d,
               COALESCE(SUM(si."discount"), 0) AS v
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s."id" = si."saleId"
        WHERE s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
          AND s."status" <> 'CANCELLED'
          ${saleF}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      this.prisma.$queryRaw<Array<{ d: Date; v: unknown }>>(Prisma.sql`
        SELECT date_trunc('day', s."createdAt" AT TIME ZONE 'UTC') AS d,
               COALESCE(SUM(s."discountTotal"), 0) AS v
        FROM "Sale" s
        WHERE s."createdAt" >= ${from}
          AND s."createdAt" <= ${to}
          AND s."status" <> 'CANCELLED'
          ${saleF}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
    ]);

    const lineDisc = dec(lineRow[0]?.v);
    const saleDisc = dec(saleRow[0]?.v);

    const dayKeys = new Set<string>();
    for (const r of lineByDay) dayKeys.add(r.d.toISOString().slice(0, 10));
    for (const r of saleByDay) dayKeys.add(r.d.toISOString().slice(0, 10));
    const lineMap = new Map(lineByDay.map((r) => [r.d.toISOString().slice(0, 10), dec(r.v)]));
    const saleMap = new Map(saleByDay.map((r) => [r.d.toISOString().slice(0, 10), dec(r.v)]));
    const byDay = [...dayKeys].sort().map((date) => {
      const ld = lineMap.get(date) ?? new Prisma.Decimal(0);
      const sd = saleMap.get(date) ?? new Prisma.Decimal(0);
      return {
        date,
        lineDiscounts: ld.toString(),
        saleLevelDiscounts: sd.toString(),
        totalDiscounts: ld.add(sd).toString(),
      };
    });

    return {
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
      },
      totalLineDiscounts: lineDisc.toString(),
      totalSaleLevelDiscounts: saleDisc.toString(),
      totalDiscounts: lineDisc.add(saleDisc).toString(),
      byDay,
    };
  }

  async stockValuationDetailed(user: SafeUser, query: ReportsPaginationQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        sku: string | null;
        quantity: number;
        unitCost: unknown;
        lineValue: unknown;
      }>
    >(Prisma.sql`
      SELECT p."id", p."name", p."sku", bs."quantity",
             p."costPrice" AS "unitCost",
             (bs."quantity" * p."costPrice") AS "lineValue"
      FROM "Product" p
      INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
      WHERE p."clientId" = ${user.clientId} AND p."isActive" = true AND bs."quantity" > 0
      ORDER BY p."name" ASC
      OFFSET ${skip} LIMIT ${limit}
    `);

    const countRow = await this.prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "Product" p
      INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
      WHERE p."clientId" = ${user.clientId} AND p."isActive" = true AND bs."quantity" > 0
    `);
    const total = Number(countRow[0].c);

    const totalValueRow = await this.prisma.$queryRaw<[{ v: unknown }]>(Prisma.sql`
      SELECT COALESCE(SUM(bs."quantity" * p."costPrice"), 0) AS v
      FROM "BranchStock" bs
      INNER JOIN "Product" p ON p."id" = bs."productId"
      WHERE bs."branchId" = ${branchId} AND p."clientId" = ${user.clientId} AND p."isActive" = true
    `);

    return {
      data: rows.map((r) => ({
        productId: r.id,
        name: r.name,
        sku: r.sku,
        quantity: r.quantity,
        unitCost: dec(r.unitCost).toString(),
        lineValue: dec(r.lineValue).toString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        branchId,
        totalInventoryValue: dec(totalValueRow[0]?.v).toString(),
      },
    };
  }

  async inventoryMovements(user: SafeUser, query: InventoryMovementsQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      clientId: user.clientId,
      branchId,
      createdAt: { gte: from, lte: to },
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type as StockMovementType } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          createdBy: { select: { id: true, name: true, username: true } },
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
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
        productId: query.productId ?? null,
        type: query.type ?? null,
      },
    };
  }

  async productsExpiry(user: SafeUser, query: ProductExpiryReportQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const daysAhead = query.daysAhead ?? 30;
    const now = new Date();
    const horizon = addUtcDays(now, daysAhead);

    const where: Prisma.ProductWhereInput = {
      clientId: user.clientId,
      isActive: true,
      expiryDate: { not: null, lte: horizon },
      branchStocks: { some: { branchId, quantity: { gt: 0 } } },
    };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          sku: true,
          expiryDate: true,
          branchStocks: {
            where: { branchId },
            select: { quantity: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: rows.map((r) => {
        const qty = r.branchStocks[0]?.quantity ?? 0;
        const exp = r.expiryDate!;
        return {
          productId: r.id,
          name: r.name,
          sku: r.sku,
          quantity: qty,
          expiryDate: exp.toISOString(),
          status: exp < now ? 'EXPIRED' : 'NEAR_EXPIRY',
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        branchId,
        daysAhead,
        asOf: now.toISOString(),
      },
    };
  }

  async supplierPurchases(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 90);

    const rows = await this.prisma.$queryRaw<
      Array<{ supplierId: string; name: string; orders: bigint; total: unknown }>
    >(Prisma.sql`
      SELECT sup."id"::text AS "supplierId",
             sup."name" AS name,
             COUNT(po."id")::bigint AS orders,
             COALESCE(SUM(po."total"), 0) AS total
      FROM "PurchaseOrder" po
      INNER JOIN "Supplier" sup ON sup."id" = po."supplierId"
      WHERE po."branchId" = ${branchId}
        AND po."clientId" = ${user.clientId}
        AND po."createdAt" >= ${from}
        AND po."createdAt" <= ${to}
        AND po."status" <> 'CANCELLED'
      GROUP BY sup."id", sup."name"
      ORDER BY total DESC
    `);

    return {
      data: rows.map((r) => ({
        supplierId: r.supplierId,
        name: r.name,
        purchaseOrdersCount: Number(r.orders),
        totalValue: dec(r.total).toString(),
      })),
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
      },
    };
  }

  async shiftClosing(user: SafeUser, query: ReportsDateRangeQueryDto, branchId: string) {
    this.assertCashierDailyOnly(user);
    const { from, to } = this.buildDateRange(query, 30);
    const cashierId = this.resolveCashierFilter(user, query.cashierId);

    const shifts = await this.prisma.shift.findMany({
      where: {
        clientId: user.clientId,
        branchId,
        status: 'CLOSED',
        closedAt: { gte: from, lte: to },
        ...(cashierId ? { cashierId } : {}),
      },
      orderBy: { closedAt: 'desc' },
      take: 200,
      include: {
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    const data = await Promise.all(
      shifts.map(async (sh) => {
        const revCogs = await this.revenueAndCogs(user.clientId, branchId, sh.openedAt, sh.closedAt ?? to, {
          shiftId: sh.id,
        });
        const saleCount = await this.prisma.sale.count({
          where: {
            clientId: user.clientId,
            shiftId: sh.id,
            status: { not: SaleStatus.CANCELLED },
          },
        });
        return {
          shiftId: sh.id,
          openedAt: sh.openedAt.toISOString(),
          closedAt: sh.closedAt?.toISOString() ?? null,
          cashier: sh.cashier,
          openingCash: sh.openingCash.toString(),
          closingCash: sh.closingCash?.toString() ?? null,
          expectedCash: sh.expectedCash?.toString() ?? null,
          difference: sh.difference?.toString() ?? null,
          salesCount: saleCount,
          netRevenue: revCogs.revenue.toString(),
          costOfGoodsSold: revCogs.cogs.toString(),
          grossProfit: revCogs.revenue.sub(revCogs.cogs).toString(),
        };
      }),
    );

    return {
      data,
      meta: {
        fromDate: formatUtcDateKey(from),
        toDate: formatUtcDateKey(to),
        branchId,
      },
    };
  }

  async branchComparison(user: SafeUser, query: ReportsDateRangeQueryDto) {
    this.assertCashierDailyOnly(user);
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        message: 'Only owners can run branch comparison',
        code: 'REPORTS_BRANCH_COMPARE_DENIED',
      });
    }
    const { from, to } = this.buildDateRange(query, 30);
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true, clientId: user.clientId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    if (branches.length < 2) {
      return {
        available: false,
        message: 'Branch comparison requires at least two active branches.',
        data: [] as Array<{
          branchId: string;
          name: string;
          code: string;
          netRevenue: string;
          costOfGoodsSold: string;
          grossProfit: string;
        }>,
        meta: { fromDate: formatUtcDateKey(from), toDate: formatUtcDateKey(to) },
      };
    }

    const rows = await Promise.all(
      branches.map(async (b) => {
        const revCogs = await this.revenueAndCogs(user.clientId, b.id, from, to, {});
        const orders = await this.prisma.sale.count({
          where: {
            clientId: user.clientId,
            branchId: b.id,
            status: { not: SaleStatus.CANCELLED },
            createdAt: { gte: from, lte: to },
          },
        });
        return {
          branchId: b.id,
          name: b.name,
          code: b.code,
          ordersCount: orders,
          netRevenue: revCogs.revenue.toString(),
          costOfGoodsSold: revCogs.cogs.toString(),
          grossProfit: revCogs.revenue.sub(revCogs.cogs).toString(),
        };
      }),
    );

    return {
      available: true,
      message: null as string | null,
      data: rows,
      meta: { fromDate: formatUtcDateKey(from), toDate: formatUtcDateKey(to) },
    };
  }

  async customerDebtReport(user: SafeUser, query: ReportsPaginationQueryDto) {
    this.assertCashierDailyOnly(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const summaryRow = await this.prisma.$queryRaw<[{ totalDebt: unknown; debtorCount: bigint }]>(Prisma.sql`
      SELECT
        COALESCE(SUM(GREATEST("balance"::numeric, 0)), 0) AS "totalDebt",
        COUNT(*) FILTER (WHERE "balance" > 0)::bigint AS "debtorCount"
      FROM "Customer"
      WHERE "clientId" = ${user.clientId}
    `);
    const s = summaryRow[0];

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: { clientId: user.clientId, balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
        skip,
        take: limit,
        select: { id: true, name: true, phone: true, balance: true, updatedAt: true },
      }),
      this.prisma.customer.count({ where: { clientId: user.clientId, balance: { gt: 0 } } }),
    ]);

    return {
      summary: {
        totalDebt: dec(s?.totalDebt).toString(),
        debtorCount: Number(s?.debtorCount ?? 0),
      },
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
}
