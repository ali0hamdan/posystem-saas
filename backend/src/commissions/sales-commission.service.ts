import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessType,
  CommissionSourceType,
  CommissionStatus,
  PaymentStatus,
  Prisma,
  SaleStatus,
  SalesCommissionType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { PERMISSIONS } from '../permissions/permission.types';
import { PermissionsService } from '../permissions/permissions.service';
import { ListCommissionsQueryDto } from './dto/list-commissions.query.dto';
import { UpdateCommissionSettingsDto } from './dto/update-commission-settings.dto';
import { SalesmanIdService } from '../users/salesman-id.service';

const d0 = () => new Prisma.Decimal(0);

function d(v: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function maxDec(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.gte(b) ? a : b;
}

const ASSIGN_SALESMAN_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.MANAGER,
  UserRole.CO_MANAGER,
];

@Injectable()
export class SalesCommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly salesmanId: SalesmanIdService,
  ) {}

  canAssignSalesman(role: UserRole): boolean {
    return ASSIGN_SALESMAN_ROLES.includes(role);
  }

  async resolveSalesmanForSale(
    actor: SafeUser,
    clientId: string,
    input: { salesmanId?: string | null; salesmanIdCode?: string | null },
  ): Promise<string | null> {
    if (actor.role === UserRole.SALESMAN) {
      return actor.id;
    }

    const code = input.salesmanIdCode?.trim().toUpperCase() || null;
    const requestedId = input.salesmanId?.trim() || null;

    if (actor.role === UserRole.CASHIER) {
      if (!code && !requestedId) {
        throw new BadRequestException({
          message: 'Salesman ID is required.',
          code: 'SALESMAN_ID_REQUIRED',
        });
      }
      if (code) {
        const salesman = await this.salesmanId.lookupActiveSalesman(clientId, code);
        return salesman.id;
      }
      const salesman = await this.prisma.user.findFirst({
        where: {
          id: requestedId!,
          clientId,
          role: UserRole.SALESMAN,
          isActive: true,
        },
        select: { id: true },
      });
      if (!salesman) {
        throw new BadRequestException({
          message: 'Invalid Salesman ID.',
          code: 'INVALID_SALESMAN_ID',
        });
      }
      return salesman.id;
    }

    if (this.canAssignSalesman(actor.role)) {
      if (code) {
        const salesman = await this.salesmanId.lookupActiveSalesman(clientId, code);
        return salesman.id;
      }
      if (requestedId) {
        const salesman = await this.prisma.user.findFirst({
          where: {
            id: requestedId,
            clientId,
            role: UserRole.SALESMAN,
            isActive: true,
          },
          select: { id: true },
        });
        if (!salesman) {
          throw new BadRequestException({
            message: 'Salesman not found or inactive',
            code: 'SALESMAN_NOT_FOUND',
          });
        }
        return salesman.id;
      }
      return null;
    }

    if (code || requestedId) {
      throw new ForbiddenException({
        message: 'You cannot assign a salesman on this transaction',
        code: 'SALESMAN_ASSIGN_FORBIDDEN',
      });
    }
    return null;
  }

  /** @deprecated Use resolveSalesmanForSale */
  async resolveSalesmanId(
    requestedSalesmanId: string | undefined | null,
    actor: SafeUser,
    clientId: string,
  ): Promise<string | null> {
    return this.resolveSalesmanForSale(actor, clientId, { salesmanId: requestedSalesmanId });
  }

  computeBaseAmount(sale: {
    subtotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    total: Prisma.Decimal;
  }): Prisma.Decimal {
    const net = sale.total.sub(sale.taxTotal);
    return maxDec(net, d0());
  }

  resolveSourceType(
    sale: { sourceQuotationId: string | null; sourceProformaId: string | null },
    businessType: BusinessType,
  ): CommissionSourceType {
    if (sale.sourceQuotationId || sale.sourceProformaId) {
      return CommissionSourceType.WHOLESALE_INVOICE;
    }
    if (businessType === BusinessType.WHOLESALE) {
      return CommissionSourceType.WHOLESALE_INVOICE;
    }
    return CommissionSourceType.RETAIL_SALE;
  }

  computeCommissionAmount(
    type: SalesCommissionType,
    baseAmount: Prisma.Decimal,
    rate: Prisma.Decimal | null,
    fixed: Prisma.Decimal | null,
  ): Prisma.Decimal {
    if (type === SalesCommissionType.PERCENTAGE && rate != null) {
      return baseAmount.mul(rate).div(100).toDecimalPlaces(2);
    }
    if (type === SalesCommissionType.FIXED_PER_SALE && fixed != null) {
      return fixed.toDecimalPlaces(2);
    }
    return d0();
  }

  computeRefundAdjustment(
    type: SalesCommissionType,
    baseAmount: Prisma.Decimal,
    commissionAmount: Prisma.Decimal,
    refundedBaseAmount: Prisma.Decimal,
  ): { adjusted: Prisma.Decimal; final: Prisma.Decimal } {
    if (baseAmount.lte(0)) {
      return { adjusted: d0(), final: d0() };
    }
    if (type === SalesCommissionType.FIXED_PER_SALE) {
      if (refundedBaseAmount.gte(baseAmount)) {
        return { adjusted: commissionAmount, final: d0() };
      }
      return { adjusted: d0(), final: commissionAmount };
    }
    const adjusted = commissionAmount.mul(refundedBaseAmount).div(baseAmount).toDecimalPlaces(2);
    const final = maxDec(commissionAmount.sub(adjusted), d0());
    return { adjusted, final };
  }

  async calculateCommissionForRetailSale(saleId: string, clientId: string): Promise<void> {
    await this.calculateCommissionForSale(saleId, clientId);
  }

  async calculateCommissionForWholesaleInvoice(invoiceId: string, clientId: string): Promise<void> {
    await this.calculateCommissionForSale(invoiceId, clientId);
  }

  async calculateCommissionForSale(saleId: string, clientId: string): Promise<void> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, clientId },
      include: {
        client: { select: { businessType: true } },
        refunds: { where: { status: 'COMPLETED' }, select: { totalRefunded: true } },
      },
    });
    if (!sale) return;

    if (sale.status === SaleStatus.CANCELLED) {
      await this.cancelCommissionForSource(clientId, saleId);
      return;
    }

    if (sale.paymentStatus !== PaymentStatus.PAID) {
      return;
    }

    if (!sale.salesmanId) {
      return;
    }

    const salesman = await this.prisma.user.findFirst({
      where: { id: sale.salesmanId, clientId, role: UserRole.SALESMAN, isActive: true },
    });
    if (
      !salesman?.commissionEnabled ||
      !salesman.commissionType ||
      salesman.commissionType === SalesCommissionType.NONE
    ) {
      return;
    }

    const sourceType = this.resolveSourceType(sale, sale.client.businessType);
    const baseAmount = this.computeBaseAmount(sale);
    const commissionAmount = this.computeCommissionAmount(
      salesman.commissionType,
      baseAmount,
      salesman.commissionRate,
      salesman.fixedCommissionAmount,
    );

    const refundedBaseAmount = sale.refunds.reduce((s, r) => s.add(r.totalRefunded), d0());
    const { adjusted, final } = this.computeRefundAdjustment(
      salesman.commissionType,
      baseAmount,
      commissionAmount,
      refundedBaseAmount,
    );

    const status =
      sale.status === SaleStatus.REFUNDED && final.lte(0)
        ? CommissionStatus.CANCELLED
        : adjusted.gt(0)
          ? CommissionStatus.ADJUSTED
          : CommissionStatus.PENDING;

    await this.prisma.salesCommission.upsert({
      where: {
        clientId_sourceType_sourceId_salesmanId: {
          clientId,
          sourceType,
          sourceId: sale.id,
          salesmanId: sale.salesmanId,
        },
      },
      create: {
        clientId,
        branchId: sale.branchId,
        salesmanId: sale.salesmanId,
        sourceType,
        sourceId: sale.id,
        sourceNumber: sale.invoiceNumber,
        commissionType: salesman.commissionType,
        commissionRate: salesman.commissionRate,
        fixedCommissionAmount: salesman.fixedCommissionAmount,
        baseAmount,
        commissionAmount,
        refundedBaseAmount,
        adjustedCommissionAmount: adjusted,
        finalCommissionAmount: final,
        status,
        calculatedAt: new Date(),
      },
      update: {
        branchId: sale.branchId,
        sourceNumber: sale.invoiceNumber,
        commissionType: salesman.commissionType,
        commissionRate: salesman.commissionRate,
        fixedCommissionAmount: salesman.fixedCommissionAmount,
        baseAmount,
        commissionAmount,
        refundedBaseAmount,
        adjustedCommissionAmount: adjusted,
        finalCommissionAmount: final,
        status,
        calculatedAt: new Date(),
      },
    });
  }

  async recalculateCommissionAfterRefund(
    sourceType: CommissionSourceType,
    sourceId: string,
    clientId: string,
  ): Promise<void> {
    if (
      sourceType === CommissionSourceType.RETAIL_SALE ||
      sourceType === CommissionSourceType.WHOLESALE_INVOICE
    ) {
      await this.calculateCommissionForSale(sourceId, clientId);
    }
  }

  private async cancelCommissionForSource(clientId: string, sourceId: string): Promise<void> {
    await this.prisma.salesCommission.updateMany({
      where: { clientId, sourceId, status: { not: CommissionStatus.PAID } },
      data: {
        status: CommissionStatus.CANCELLED,
        finalCommissionAmount: d0(),
        updatedAt: new Date(),
      },
    });
  }

  private assertCommissionAccess(user: SafeUser, salesmanId?: string): void {
    const canViewAll = this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_VIEW);
    const canViewOwn = this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_VIEW_OWN);
    if (canViewAll) return;
    if (canViewOwn && salesmanId && salesmanId === user.id) return;
    if (canViewOwn && !salesmanId) return;
    throw new ForbiddenException({
      message: 'You do not have permission to view commissions',
      code: 'COMMISSIONS_VIEW_FORBIDDEN',
    });
  }

  async findAll(user: SafeUser, query: ListCommissionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const canViewAll = this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_VIEW);
    const where: Prisma.SalesCommissionWhereInput = { clientId: user.clientId };

    if (!canViewAll) {
      where.salesmanId = user.id;
    } else if (query.salesmanId) {
      where.salesmanId = query.salesmanId;
    }

    if (query.status) where.status = query.status;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.branchId) where.branchId = query.branchId;
    if (query.fromDate || query.toDate) {
      where.calculatedAt = {};
      if (query.fromDate) where.calculatedAt.gte = new Date(query.fromDate);
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setUTCHours(23, 59, 59, 999);
        where.calculatedAt.lte = to;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.salesCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { calculatedAt: 'desc' },
        include: {
          salesman: { select: { id: true, name: true, username: true, role: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.salesCommission.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async findOne(user: SafeUser, id: string) {
    const row = await this.prisma.salesCommission.findFirst({
      where: { id, clientId: user.clientId },
      include: {
        salesman: { select: { id: true, name: true, username: true, role: true } },
        branch: { select: { id: true, name: true, code: true } },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            paymentStatus: true,
            status: true,
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Commission not found', code: 'COMMISSION_NOT_FOUND' });
    }
    this.assertCommissionAccess(user, row.salesmanId);
    return row;
  }

  async findBySalesman(user: SafeUser, salesmanId: string, query: ListCommissionsQueryDto) {
    const canViewAll = this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_VIEW);
    if (!canViewAll && salesmanId !== user.id) {
      throw new ForbiddenException({
        message: 'You can only view your own commissions',
        code: 'COMMISSIONS_VIEW_FORBIDDEN',
      });
    }
    return this.findAll(user, { ...query, salesmanId });
  }

  async getSummary(user: SafeUser, query: ListCommissionsQueryDto) {
    const canViewAll = this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_VIEW);
    const where: Prisma.SalesCommissionWhereInput = { clientId: user.clientId };
    if (!canViewAll) where.salesmanId = user.id;
    else if (query.salesmanId) where.salesmanId = query.salesmanId;

    if (query.fromDate || query.toDate) {
      where.calculatedAt = {};
      if (query.fromDate) where.calculatedAt.gte = new Date(query.fromDate);
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setUTCHours(23, 59, 59, 999);
        where.calculatedAt.lte = to;
      }
    }

    const rows = await this.prisma.salesCommission.findMany({
      where,
      select: {
        status: true,
        finalCommissionAmount: true,
        baseAmount: true,
        adjustedCommissionAmount: true,
      },
    });

    const sum = (status?: CommissionStatus) =>
      rows
        .filter((r) => (status ? r.status === status : true))
        .reduce((s, r) => s.add(r.finalCommissionAmount), d0());

    return {
      pending: sum(CommissionStatus.PENDING).add(sum(CommissionStatus.ADJUSTED)).toString(),
      approved: sum(CommissionStatus.APPROVED).toString(),
      paid: sum(CommissionStatus.PAID).toString(),
      totalSalesBase: rows.reduce((s, r) => s.add(r.baseAmount), d0()).toString(),
      totalAdjustments: rows.reduce((s, r) => s.add(r.adjustedCommissionAmount), d0()).toString(),
      count: rows.length,
    };
  }

  async approveCommission(user: SafeUser, id: string) {
    if (!this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_APPROVE)) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'COMMISSIONS_APPROVE_FORBIDDEN' });
    }
    const row = await this.findOne(user, id);
    if (row.status === CommissionStatus.PAID || row.status === CommissionStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Commission cannot be approved',
        code: 'COMMISSION_INVALID_STATUS',
      });
    }
    return this.prisma.salesCommission.update({
      where: { id: row.id },
      data: { status: CommissionStatus.APPROVED, approvedAt: new Date() },
    });
  }

  async markCommissionPaid(user: SafeUser, id: string) {
    if (!this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_MARK_PAID)) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'COMMISSIONS_MARK_PAID_FORBIDDEN' });
    }
    const row = await this.findOne(user, id);
    if (row.status === CommissionStatus.CANCELLED) {
      throw new BadRequestException({ message: 'Commission is cancelled', code: 'COMMISSION_CANCELLED' });
    }
    return this.prisma.salesCommission.update({
      where: { id: row.id },
      data: {
        status: CommissionStatus.PAID,
        paidAt: new Date(),
        approvedAt: row.approvedAt ?? new Date(),
      },
    });
  }

  async cancelCommission(user: SafeUser, id: string) {
    if (!this.permissions.hasPermission(user.role, PERMISSIONS.COMMISSIONS_APPROVE)) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'COMMISSIONS_CANCEL_FORBIDDEN' });
    }
    const row = await this.findOne(user, id);
    if (row.status === CommissionStatus.PAID) {
      throw new BadRequestException({
        message: 'Paid commission cannot be cancelled',
        code: 'COMMISSION_ALREADY_PAID',
      });
    }
    return this.prisma.salesCommission.update({
      where: { id: row.id },
      data: { status: CommissionStatus.CANCELLED, finalCommissionAmount: d0() },
    });
  }

  async updateCommissionSettings(actor: SafeUser, userId: string, dto: UpdateCommissionSettingsDto) {
    if (!this.permissions.hasPermission(actor.role, PERMISSIONS.COMMISSIONS_MANAGE_SETTINGS)) {
      throw new ForbiddenException({ message: 'Forbidden', code: 'COMMISSION_SETTINGS_FORBIDDEN' });
    }
    const target = await this.prisma.user.findFirst({ where: { id: userId, clientId: actor.clientId } });
    if (!target) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
    if (target.role !== UserRole.SALESMAN) {
      throw new BadRequestException({
        message: 'Commission settings apply to salesman users only',
        code: 'NOT_SALESMAN',
      });
    }

    const enabled = dto.commissionEnabled ?? target.commissionEnabled;
    const type = dto.commissionType ?? target.commissionType ?? SalesCommissionType.NONE;

    if (enabled && (!type || type === SalesCommissionType.NONE)) {
      throw new BadRequestException({
        message: 'Commission type is required when commission is enabled',
        code: 'COMMISSION_TYPE_REQUIRED',
      });
    }
    if (dto.commissionRate != null && (dto.commissionRate < 0 || dto.commissionRate > 100)) {
      throw new BadRequestException({
        message: 'Commission rate must be between 0 and 100',
        code: 'INVALID_COMMISSION_RATE',
      });
    }
    if (dto.fixedCommissionAmount != null && dto.fixedCommissionAmount < 0) {
      throw new BadRequestException({
        message: 'Fixed commission must be >= 0',
        code: 'INVALID_FIXED_COMMISSION',
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        commissionEnabled: enabled,
        commissionType: enabled ? type : SalesCommissionType.NONE,
        commissionRate: dto.commissionRate != null ? d(dto.commissionRate) : undefined,
        fixedCommissionAmount:
          dto.fixedCommissionAmount != null ? d(dto.fixedCommissionAmount) : undefined,
        commissionNotes: dto.commissionNotes !== undefined ? dto.commissionNotes : undefined,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        commissionEnabled: true,
        commissionType: true,
        commissionRate: true,
        fixedCommissionAmount: true,
        commissionNotes: true,
      },
    });
  }
}
