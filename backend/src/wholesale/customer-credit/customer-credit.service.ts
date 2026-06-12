import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { WholesaleScopeService } from '../wholesale-scope.service';
import { CustomerStatementQueryDto, UpsertCustomerCreditProfileDto } from './dto/customer-credit.dto';

@Injectable()
export class CustomerCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WholesaleScopeService,
  ) {}

  async upsertProfile(customerId: string, dto: UpsertCustomerCreditProfileDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.scope.assertCustomer(user.clientId, customerId);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId: user.clientId },
      select: { id: true, balance: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customerCreditProfile.upsert({
      where: { customerId },
      create: {
        clientId: user.clientId,
        customerId,
        creditLimit: new Prisma.Decimal(dto.creditLimit),
        paymentTermsDays: dto.paymentTermsDays,
        isCreditAllowed: dto.isCreditAllowed ?? true,
        notes: dto.notes?.trim() || null,
      },
      update: {
        creditLimit: new Prisma.Decimal(dto.creditLimit),
        paymentTermsDays: dto.paymentTermsDays,
        ...(dto.isCreditAllowed !== undefined ? { isCreditAllowed: dto.isCreditAllowed } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async getProfile(customerId: string, clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    await this.scope.assertCustomer(clientId, customerId);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId },
      select: {
        id: true,
        name: true,
        phone: true,
        balance: true,
        creditProfile: true,
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async statement(customerId: string, clientId: string, query: CustomerStatementQueryDto) {
    await this.scope.assertWholesaleBusiness(clientId);
    await this.scope.assertCustomer(clientId, customerId);

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        companyName: true,
        taxNumber: true,
        balance: true,
        creditProfile: true,
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const where: Prisma.CustomerLedgerWhereInput = {
      clientId,
      customerId,
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const entries = await this.prisma.customerLedger.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const openingBalance =
      entries.length > 0
        ? entries[0].balanceAfter.minus(entries[0].amount)
        : new Prisma.Decimal(0);
    const closingBalance = customer.balance;

    const unpaidSales = await this.prisma.sale.findMany({
      where: {
        clientId,
        customerId,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        createdAt: true,
        paymentStatus: true,
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        companyName: customer.companyName,
        taxNumber: customer.taxNumber,
        currentBalance: customer.balance.toString(),
        creditProfile: customer.creditProfile,
      },
      period: { from: query.from ?? null, to: query.to ?? null },
      openingBalance: openingBalance.toString(),
      closingBalance: closingBalance.toString(),
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount.toString(),
        balanceAfter: e.balanceAfter.toString(),
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        note: e.note,
        createdAt: e.createdAt,
      })),
      unpaidInvoices: unpaidSales.map((s) => {
        const amountPaid = s.payments.reduce(
          (sum, p) => sum.add(p.amount),
          new Prisma.Decimal(0),
        );
        return {
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          total: s.total.toString(),
          amountPaid: amountPaid.toString(),
          outstanding: s.total.minus(amountPaid).toString(),
          paymentStatus: s.paymentStatus,
          createdAt: s.createdAt,
        };
      }),
    };
  }

  async listProfiles(clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    return this.prisma.customer.findMany({
      where: { clientId },
      select: {
        id: true,
        name: true,
        phone: true,
        balance: true,
        creditProfile: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }
}
