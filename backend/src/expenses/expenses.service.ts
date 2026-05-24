import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShiftStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses.query.dto';

function dec(n: number | string): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private buildExpenseDateWhere(
    fromDate?: string,
    toDate?: string,
  ): Prisma.ExpenseWhereInput {
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

  private assertCashierListFilters(user: SafeUser, query: ListExpensesQueryDto): void {
    if (user.role !== UserRole.CASHIER) {
      return;
    }
    if (query.createdById && query.createdById !== user.id) {
      throw new ForbiddenException({
        message: 'You can only filter your own expenses',
        code: 'EXPENSE_FILTER_DENIED',
      });
    }
  }

  private async assertCashierShiftFilter(
    user: SafeUser,
    shiftId: string | undefined,
  ): Promise<void> {
    if (user.role !== UserRole.CASHIER || !shiftId) {
      return;
    }
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, cashierId: user.id, clientId: user.clientId },
      select: { id: true },
    });
    if (!shift) {
      throw new ForbiddenException({
        message: 'You can only filter expenses for your own shifts',
        code: 'EXPENSE_SHIFT_FILTER_DENIED',
      });
    }
  }

  private assertExpenseRead(expense: { createdById: string }, user: SafeUser): void {
    if (user.role === UserRole.CASHIER && expense.createdById !== user.id) {
      throw new ForbiddenException({
        message: 'You can only view your own expenses',
        code: 'EXPENSE_ACCESS_DENIED',
      });
    }
  }

  private assertExpenseMutate(expense: { createdById: string }, user: SafeUser): void {
    if (user.role === UserRole.CASHIER && expense.createdById !== user.id) {
      throw new ForbiddenException({
        message: 'You can only modify your own expenses',
        code: 'EXPENSE_ACCESS_DENIED',
      });
    }
  }

  async findAll(user: SafeUser, query: ListExpensesQueryDto) {
    this.assertCashierListFilters(user, query);
    await this.assertCashierShiftFilter(user, query.shiftId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      clientId: user.clientId,
      ...this.buildExpenseDateWhere(query.fromDate, query.toDate),
      ...(user.role === UserRole.CASHIER
        ? { createdById: user.id }
        : query.createdById
          ? { createdById: query.createdById }
          : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, username: true, name: true, role: true },
          },
          shift: {
            select: { id: true, status: true, openedAt: true, closedAt: true, cashierId: true },
          },
        },
      }),
      this.prisma.expense.count({ where }),
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

  async findOne(id: string, user: SafeUser) {
    const row = await this.prisma.expense.findFirst({
      where: { id, clientId: user.clientId },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, role: true },
        },
        shift: {
          select: { id: true, status: true, openedAt: true, closedAt: true, cashierId: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Expense not found',
        code: 'EXPENSE_NOT_FOUND',
      });
    }
    this.assertExpenseRead(row, user);
    return row;
  }

  async create(dto: CreateExpenseDto, user: SafeUser) {
    let createdById: string;
    let shiftId: string | null;

    if (user.role === UserRole.CASHIER) {
      if (!dto.shiftId) {
        throw new BadRequestException({
          message: 'Cashiers must record drawer expenses against an open shift (shiftId is required)',
          code: 'SHIFT_ID_REQUIRED',
        });
      }
      const openShift = await this.prisma.shift.findFirst({
        where: {
          id: dto.shiftId,
          cashierId: user.id,
          clientId: user.clientId,
          status: ShiftStatus.OPEN,
        },
      });
      if (!openShift) {
        throw new BadRequestException({
          message: 'You must have an open shift matching this shiftId to create an expense',
          code: 'INVALID_SHIFT_FOR_CASHIER',
        });
      }
      createdById = user.id;
      shiftId = openShift.id;
    } else {
      if (dto.shiftId) {
        const shift = await this.prisma.shift.findFirst({
          where: { id: dto.shiftId, clientId: user.clientId },
        });
        if (!shift) {
          throw new NotFoundException({
            message: 'Shift not found',
            code: 'SHIFT_NOT_FOUND',
          });
        }
        createdById = shift.cashierId;
        shiftId = shift.id;
      } else {
        createdById = dto.createdById ?? user.id;
        const u = await this.prisma.user.findFirst({
          where: { id: createdById, clientId: user.clientId },
          select: { id: true },
        });
        if (!u) {
          throw new NotFoundException({
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }
        shiftId = null;
      }
    }

    const created = await this.prisma.expense.create({
      data: {
        clientId: user.clientId,
        title: dto.title.trim(),
        amount: dec(dto.amount),
        note: dto.note?.trim() || null,
        createdById,
        shiftId,
      },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, role: true },
        },
        shift: {
          select: { id: true, status: true, openedAt: true, closedAt: true, cashierId: true },
        },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'expense.create',
      entity: 'Expense',
      entityId: created.id,
      newValue: {
        title: created.title,
        amount: created.amount.toString(),
        createdById: created.createdById,
        shiftId: created.shiftId,
      },
    });

    return created;
  }

  async update(id: string, dto: UpdateExpenseDto, user: SafeUser) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Expense not found',
        code: 'EXPENSE_NOT_FOUND',
      });
    }
    this.assertExpenseMutate(existing, user);

    if (user.role === UserRole.CASHIER && dto.shiftId !== undefined) {
      throw new ForbiddenException({
        message: 'Cashiers cannot change shift linkage on an expense',
        code: 'EXPENSE_SHIFT_UPDATE_DENIED',
      });
    }

    const data: Prisma.ExpenseUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.amount !== undefined ? { amount: dec(dto.amount) } : {}),
      ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
    };

    if (user.role !== UserRole.CASHIER && dto.shiftId !== undefined) {
      if (dto.shiftId === null) {
        data.shift = { disconnect: true };
      } else {
        const shift = await this.prisma.shift.findFirst({
          where: { id: dto.shiftId, clientId: user.clientId },
        });
        if (!shift) {
          throw new NotFoundException({
            message: 'Shift not found',
            code: 'SHIFT_NOT_FOUND',
          });
        }
        data.shift = { connect: { id: shift.id } };
        data.createdBy = { connect: { id: shift.cashierId } };
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        message: 'No updatable fields provided',
        code: 'EMPTY_UPDATE',
      });
    }

    const updated = await this.prisma.expense.updateMany({
      where: { id, clientId: user.clientId },
      data,
    });
    if (!updated.count) {
      throw new NotFoundException({ message: 'Expense not found', code: 'EXPENSE_NOT_FOUND' });
    }
    const result = await this.prisma.expense.findUniqueOrThrow({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, role: true },
        },
        shift: {
          select: { id: true, status: true, openedAt: true, closedAt: true, cashierId: true },
        },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'expense.update',
      entity: 'Expense',
      entityId: id,
      oldValue: {
        title: existing.title,
        amount: existing.amount.toString(),
        shiftId: existing.shiftId,
      },
      newValue: {
        title: result.title,
        amount: result.amount.toString(),
        shiftId: result.shiftId,
      },
    });

    return result;
  }

  async remove(id: string, user: SafeUser) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Expense not found',
        code: 'EXPENSE_NOT_FOUND',
      });
    }
    this.assertExpenseMutate(existing, user);

    const { count } = await this.prisma.expense.deleteMany({
      where: { id, clientId: user.clientId },
    });
    if (!count) {
      throw new NotFoundException({ message: 'Expense not found', code: 'EXPENSE_NOT_FOUND' });
    }

    await this.audit.log({
      userId: user.id,
      action: 'expense.delete',
      entity: 'Expense',
      entityId: id,
      oldValue: {
        title: existing.title,
        amount: existing.amount.toString(),
        createdById: existing.createdById,
        shiftId: existing.shiftId,
      },
    });

    return { id, deleted: true };
  }
}
