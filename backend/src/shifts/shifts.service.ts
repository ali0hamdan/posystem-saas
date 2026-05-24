import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  ShiftStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { OpenShiftDto, CloseShiftDto } from './dto/open-close-shift.dto';
import { ListShiftsQueryDto } from './dto/list-shifts.query.dto';

function dec(n: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(typeof n === 'object' ? n.toString() : n);
}

function sumOrZero(v: Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) {
    return new Prisma.Decimal(0);
  }
  return dec(v);
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private assertShiftViewAccess(shiftCashierId: string, user: SafeUser): void {
    if (user.role === UserRole.CASHIER && shiftCashierId !== user.id) {
      throw new ForbiddenException({
        message: 'You can only view your own shifts',
        code: 'SHIFT_ACCESS_DENIED',
      });
    }
  }

  private buildDateRangeWhere(
    fromDate?: string,
    toDate?: string,
  ): Prisma.ShiftWhereInput {
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
      return { openedAt: { gte: from, lte: toEnd } };
    }
    if (fromDate) {
      const from = new Date(fromDate);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException({ message: 'Invalid fromDate', code: 'INVALID_DATE' });
      }
      return { openedAt: { gte: from } };
    }
    const to = new Date(toDate as string);
    if (Number.isNaN(to.getTime())) {
      throw new BadRequestException({ message: 'Invalid toDate', code: 'INVALID_DATE' });
    }
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);
    return { openedAt: { lte: toEnd } };
  }

  /**
   * Cash drawer expectation: opening float + CASH payment lines on sales tied to this shift,
   * minus refunds on those sales (cash-out), minus expenses tied to this shift or legacy
   * unscoped expenses by this cashier in the shift time window (shiftId null).
   * MIXED / non-CASH payment methods are excluded from the CASH payment sum.
   */
  private async computeExpectedCash(
    tx: Prisma.TransactionClient,
    shift: {
      id: string;
      clientId: string;
      cashierId: string;
      openingCash: Prisma.Decimal;
      openedAt: Date;
    },
    closeAt: Date,
  ): Promise<Prisma.Decimal> {
    const [cashSalesAgg, cashRefundsAgg, expensesAgg] = await Promise.all([
      tx.payment.aggregate({
        where: {
          method: PaymentMethod.CASH,
          sale: { shiftId: shift.id, clientId: shift.clientId },
        },
        _sum: { amount: true },
      }),
      tx.refund.aggregate({
        where: {
          sale: { shiftId: shift.id, clientId: shift.clientId },
          createdAt: { gte: shift.openedAt, lte: closeAt },
        },
        _sum: { totalRefunded: true },
      }),
      tx.expense.aggregate({
        where: {
          clientId: shift.clientId,
          OR: [
            { shiftId: shift.id },
            {
              shiftId: null,
              createdById: shift.cashierId,
              createdAt: { gte: shift.openedAt, lte: closeAt },
            },
          ],
        },
        _sum: { amount: true },
      }),
    ]);

    const opening = dec(shift.openingCash);
    const cashIn = sumOrZero(cashSalesAgg._sum.amount);
    const refundsOut = sumOrZero(cashRefundsAgg._sum.totalRefunded);
    const expensesOut = sumOrZero(expensesAgg._sum.amount);

    return opening.add(cashIn).sub(refundsOut).sub(expensesOut);
  }

  async open(dto: OpenShiftDto, userId: string, branchId: string, clientId: string) {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.shift.findFirst({
          where: { cashierId: userId, branchId, clientId, status: ShiftStatus.OPEN },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException({
            message: 'You already have an open shift',
            code: 'SHIFT_ALREADY_OPEN',
          });
        }

        return tx.shift.create({
          data: {
            clientId,
            branchId,
            cashierId: userId,
            openingCash: dec(dto.openingCash),
            status: ShiftStatus.OPEN,
          },
          include: {
            cashier: {
              select: { id: true, username: true, name: true, role: true },
            },
          },
        });
      });

      await this.audit.log({
        userId,
        action: 'shift.open',
        entity: 'Shift',
        entityId: created.id,
        newValue: {
          openingCash: created.openingCash.toString(),
          status: created.status,
        },
      });

      return created;
    } catch (err) {
      if (err instanceof ConflictException) {
        throw err;
      }
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'You already have an open shift',
          code: 'SHIFT_ALREADY_OPEN',
        });
      }
      throw err;
    }
  }

  async close(dto: CloseShiftDto, userId: string, branchId: string, clientId: string) {
    const closedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({
        where: { cashierId: userId, branchId, clientId, status: ShiftStatus.OPEN },
      });

      if (!shift) {
        throw new NotFoundException({
          message: 'No open shift to close',
          code: 'NO_OPEN_SHIFT',
        });
      }

      const expectedCash = await this.computeExpectedCash(tx, shift, closedAt);
      const closingCash = dec(dto.closingCash);
      const difference = closingCash.sub(expectedCash);

      return tx.shift.update({
        where: { id: shift.id },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt,
          closingCash,
          expectedCash,
          difference,
        },
        include: {
          cashier: {
            select: { id: true, username: true, name: true, role: true },
          },
        },
      });
    });

    await this.audit.log({
      userId,
      action: 'shift.close',
      entity: 'Shift',
      entityId: updated.id,
      newValue: {
        closingCash: updated.closingCash?.toString(),
        expectedCash: updated.expectedCash?.toString(),
        difference: updated.difference?.toString(),
        status: updated.status,
      },
    });

    return updated;
  }

  async findCurrent(user: SafeUser, branchId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        cashierId: user.id,
        branchId,
        clientId: user.clientId,
        status: ShiftStatus.OPEN,
      },
      include: {
        cashier: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
    });
    return shift;
  }

  async findAll(user: SafeUser, query: ListShiftsQueryDto, branchId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ShiftWhereInput = {
      clientId: user.clientId,
      branchId,
      ...this.buildDateRangeWhere(query.fromDate, query.toDate),
      ...(query.status ? { status: query.status } : {}),
      ...(user.role === UserRole.CASHIER
        ? { cashierId: user.id }
        : query.cashierId
          ? { cashierId: query.cashierId }
          : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
        include: {
          cashier: {
            select: { id: true, username: true, name: true, role: true },
          },
          _count: { select: { sales: true } },
        },
      }),
      this.prisma.shift.count({ where }),
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
    const shift = await this.prisma.shift.findFirst({
      where: { id, clientId: user.clientId },
      include: {
        cashier: {
          select: { id: true, username: true, name: true, role: true },
        },
        _count: { select: { sales: true } },
      },
    });
    if (!shift) {
      throw new NotFoundException({
        message: 'Shift not found',
        code: 'SHIFT_NOT_FOUND',
      });
    }
    this.assertShiftViewAccess(shift.cashierId, user);
    if (user.role !== UserRole.OWNER && shift.branchId !== activeBranchId) {
      throw new ForbiddenException({
        message: 'This shift belongs to a different branch',
        code: 'SHIFT_BRANCH_MISMATCH',
      });
    }
    if (user.role !== UserRole.OWNER) {
      const link = await this.prisma.userBranch.findFirst({
        where: { userId: user.id, branchId: shift.branchId },
        select: { userId: true, branchId: true },
      });
      if (!link) {
        throw new ForbiddenException({
          message: 'You do not have access to this branch',
          code: 'BRANCH_ACCESS_DENIED',
        });
      }
    }
    return shift;
  }
}
