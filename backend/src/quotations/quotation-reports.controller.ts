import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { Prisma, ProformaInvoiceStatus, QuotationStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { FeatureGuard } from '../fnb/feature/feature.guard';
import { RequireFeature } from '../fnb/feature/require-feature.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lightweight reports for B2B documents. These numbers are NOT revenue and
 * must not be added to sales-revenue reports — quotations and proforma
 * invoices are offers, not sales.
 */
@Controller('reports/b2b-documents')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
@RequireFeature('quotations')
export class QuotationReportsController {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(from?: string, to?: string): Prisma.QuotationWhereInput {
    if (!from && !to) return {};
    return {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    };
  }

  @Get('quotations')
  async quotations(
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: Prisma.QuotationWhereInput = {
      clientId: user.clientId,
      ...(branchId ? { branchId } : {}),
      ...this.dateRange(from, to),
    };

    const [grouped, totals] = await Promise.all([
      this.prisma.quotation.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.quotation.aggregate({
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    const byStatus = Object.fromEntries(
      grouped.map((g) => [
        g.status,
        { count: g._count._all, value: g._sum.total?.toString() ?? '0' },
      ]),
    ) as Record<QuotationStatus, { count: number; value: string }>;

    const accepted =
      (byStatus[QuotationStatus.ACCEPTED]?.count ?? 0) +
      (byStatus[QuotationStatus.CONVERTED_TO_PROFORMA]?.count ?? 0) +
      (byStatus[QuotationStatus.CONVERTED_TO_INVOICE]?.count ?? 0);
    const total = totals._count._all;
    const conversionRate = total > 0 ? +(accepted / total).toFixed(4) : 0;

    return {
      note: 'Quotation values are NOT revenue. See /reports/* for sales.',
      total,
      totalQuotedValue: totals._sum.total?.toString() ?? '0',
      accepted,
      rejected: byStatus[QuotationStatus.REJECTED]?.count ?? 0,
      expired: byStatus[QuotationStatus.EXPIRED]?.count ?? 0,
      cancelled: byStatus[QuotationStatus.CANCELLED]?.count ?? 0,
      convertedToInvoice: byStatus[QuotationStatus.CONVERTED_TO_INVOICE]?.count ?? 0,
      conversionRate,
      byStatus,
    };
  }

  @Get('proforma-invoices')
  async proformaInvoices(
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: Prisma.ProformaInvoiceWhereInput = {
      clientId: user.clientId,
      ...(branchId ? { branchId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [grouped, totals] = await Promise.all([
      this.prisma.proformaInvoice.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.proformaInvoice.aggregate({
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    const byStatus = Object.fromEntries(
      grouped.map((g) => [
        g.status,
        { count: g._count._all, value: g._sum.total?.toString() ?? '0' },
      ]),
    ) as Record<ProformaInvoiceStatus, { count: number; value: string }>;

    const outstandingValue = (
      [ProformaInvoiceStatus.DRAFT, ProformaInvoiceStatus.SENT, ProformaInvoiceStatus.APPROVED] as const
    ).reduce((sum, s) => sum + Number(byStatus[s]?.value ?? '0'), 0);

    return {
      note: 'Proforma totals are NOT revenue. See /reports/* for sales.',
      total: totals._count._all,
      totalProformaValue: totals._sum.total?.toString() ?? '0',
      approved: byStatus[ProformaInvoiceStatus.APPROVED]?.count ?? 0,
      converted: byStatus[ProformaInvoiceStatus.CONVERTED_TO_INVOICE]?.count ?? 0,
      cancelled: byStatus[ProformaInvoiceStatus.CANCELLED]?.count ?? 0,
      outstandingValue: outstandingValue.toFixed(2),
      byStatus,
    };
  }
}
