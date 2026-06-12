import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerLedgerType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerLedgerService } from './customer-ledger.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { customerPublicSelect, mapCustomerPublic } from './customer.mapper';
import { ListCustomersQueryDto } from './dto/list-customers.query.dto';
import { ListLedgerQueryDto } from './dto/list-ledger.query.dto';
import { CustomerPaymentDto } from './dto/customer-payment.dto';
import { AdjustCustomerBalanceDto } from './dto/adjust-balance.dto';

function d(n: number | string): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: CustomerLedgerService,
  ) {}

  private buildReceiptNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = randomBytes(5).toString('hex').toUpperCase();
    return `RCP-${stamp}-${rand}`;
  }

  async findAll(query: ListCustomersQueryDto, clientId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const q = query.q?.trim();

    const where: Prisma.CustomerWhereInput = {
      clientId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { companyName: { contains: q, mode: 'insensitive' } },
              { taxNumber: { contains: q, mode: 'insensitive' } },
              { address: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: customerPublicSelect,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: data.map(mapCustomerPublic),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async create(dto: CreateCustomerDto, clientId: string) {
    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          clientId,
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
          address: dto.address?.trim() || null,
          companyName: dto.companyName?.trim() || null,
          taxNumber: dto.taxNumber?.trim() || null,
          notes: dto.notes?.trim() || null,
          isActive: dto.isActive ?? true,
        },
        select: customerPublicSelect,
      });
      if (dto.creditLimit !== undefined || dto.paymentTermsDays !== undefined) {
        await tx.customerCreditProfile.upsert({
          where: { customerId: customer.id },
          create: {
            clientId,
            customerId: customer.id,
            creditLimit: d(dto.creditLimit ?? 0),
            paymentTermsDays: dto.paymentTermsDays ?? 0,
          },
          update: {
            ...(dto.creditLimit !== undefined ? { creditLimit: d(dto.creditLimit) } : {}),
            ...(dto.paymentTermsDays !== undefined ? { paymentTermsDays: dto.paymentTermsDays } : {}),
          },
        });
        const refreshed = await tx.customer.findFirst({
          where: { id: customer.id, clientId },
          select: customerPublicSelect,
        });
        return refreshed!;
      }
      return customer;
    });
    return mapCustomerPublic(created);
  }

  async findOne(id: string, clientId: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, clientId },
      select: customerPublicSelect,
    });
    if (!c) {
      throw new NotFoundException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }
    return mapCustomerPublic(c);
  }

  async update(id: string, dto: UpdateCustomerDto, clientId: string) {
    const existing = await this.prisma.customer.findFirst({ where: { id, clientId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
          ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
          ...(dto.companyName !== undefined ? { companyName: dto.companyName?.trim() || null } : {}),
          ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber?.trim() || null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      if (dto.creditLimit !== undefined || dto.paymentTermsDays !== undefined) {
        await tx.customerCreditProfile.upsert({
          where: { customerId: id },
          create: {
            clientId,
            customerId: id,
            creditLimit: d(dto.creditLimit ?? 0),
            paymentTermsDays: dto.paymentTermsDays ?? 0,
          },
          update: {
            ...(dto.creditLimit !== undefined ? { creditLimit: d(dto.creditLimit) } : {}),
            ...(dto.paymentTermsDays !== undefined ? { paymentTermsDays: dto.paymentTermsDays } : {}),
          },
        });
      }
      const row = await tx.customer.findFirst({ where: { id, clientId }, select: customerPublicSelect });
      return row!;
    });
    return mapCustomerPublic(updated);
  }

  async getLedger(customerId: string, query: ListLedgerQueryDto, clientId: string) {
    await this.assertCustomerExists(customerId, clientId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.customerLedger.findMany({
        where: { customerId, clientId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true, username: true, role: true } },
        },
      }),
      this.prisma.customerLedger.count({ where: { customerId, clientId } }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async recordPayment(
    customerId: string,
    dto: CustomerPaymentDto,
    createdById: string,
    clientId: string,
  ) {
    const payAmount = d(dto.amount);
    if (payAmount.lte(0)) {
      throw new BadRequestException({ message: 'amount must be positive', code: 'INVALID_AMOUNT' });
    }

    return this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.findFirst({
        where: { id: customerId, clientId },
        select: { balance: true },
      });
      if (!c) {
        throw new NotFoundException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
      }
      const bal = new Prisma.Decimal(c.balance.toString());
      if (bal.lte(0)) {
        throw new BadRequestException({
          message: 'Customer has no outstanding balance to pay',
          code: 'NO_OUTSTANDING_BALANCE',
        });
      }
      const applied = payAmount.gt(bal) ? bal : payAmount;
      const receiptNumber = this.buildReceiptNumber();
      const refId = randomBytes(16).toString('hex');
      await this.ledger.appendEntry(tx, {
        clientId,
        customerId,
        type: CustomerLedgerType.PAYMENT,
        amount: applied.negated(),
        referenceType: 'customer_payment',
        referenceId: refId,
        note: dto.note?.trim() || `Payment ${receiptNumber}`,
        receiptNumber,
        createdById,
      });
      const updated = await tx.customer.findFirst({
        where: { id: customerId, clientId },
        select: customerPublicSelect,
      });
      return {
        receiptNumber,
        amountApplied: applied.toString(),
        customer: mapCustomerPublic(updated!),
      };
    });
  }

  async adjustBalance(
    customerId: string,
    dto: AdjustCustomerBalanceDto,
    createdById: string,
    clientId: string,
  ) {
    const delta = d(dto.amount);
    if (delta.eq(0)) {
      throw new BadRequestException({ message: 'amount must not be zero', code: 'INVALID_AMOUNT' });
    }
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException({ message: 'reason is required', code: 'REASON_REQUIRED' });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertCustomerExistsTx(tx, customerId, clientId);
      await this.ledger.appendEntry(tx, {
        clientId,
        customerId,
        type: CustomerLedgerType.ADJUSTMENT,
        amount: delta,
        referenceType: 'adjustment',
        referenceId: null,
        note: dto.note?.trim() ? `${reason} — ${dto.note.trim()}` : reason,
        createdById,
      });
      const row = await tx.customer.findFirst({
        where: { id: customerId, clientId },
        select: customerPublicSelect,
      });
      return mapCustomerPublic(row!);
    });
  }

  private async assertCustomerExists(id: string, clientId: string): Promise<void> {
    const ok = await this.prisma.customer.findFirst({
      where: { id, clientId },
      select: { id: true },
    });
    if (!ok) {
      throw new NotFoundException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }
  }

  private async assertCustomerExistsTx(
    tx: Prisma.TransactionClient,
    id: string,
    clientId: string,
  ): Promise<void> {
    const ok = await tx.customer.findFirst({ where: { id, clientId }, select: { id: true } });
    if (!ok) {
      throw new NotFoundException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }
  }
}
