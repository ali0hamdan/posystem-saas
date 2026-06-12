import { Injectable, Logger } from '@nestjs/common';
import {
  ClientStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

const MS_PER_DAY = 86_400_000;
const OVERDUE_SOURCE_TYPE = 'SALE';

export type OverdueSaleCandidate = {
  saleId: string;
  clientId: string;
  customerId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  branchName: string | null;
  dueDate: Date;
  daysOverdue: number;
  amountDue: Prisma.Decimal;
};

@Injectable()
export class CustomerOverdueService {
  private readonly logger = new Logger(CustomerOverdueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Daily at 9:00 AM — find overdue unpaid/partial sales and notify once per invoice. */
  async runCustomerOverdueCheck(): Promise<number> {
    const now = new Date();
    const clients = await this.prisma.client.findMany({
      where: { status: ClientStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        storeSettings: {
          select: {
            emailNotificationsEnabled: true,
            notifyCustomerOverdue: true,
            defaultPaymentTermsDays: true,
          },
        },
      },
    });

    let sent = 0;
    for (const client of clients) {
      const settings = client.storeSettings;
      if (!settings?.emailNotificationsEnabled || !settings.notifyCustomerOverdue) {
        continue;
      }

      const overdue = await this.findOverdueSales(
        client.id,
        settings.defaultPaymentTermsDays,
        now,
      );

      for (const row of overdue) {
        try {
          await this.prisma.customerOverdueNotificationLog.create({
            data: {
              clientId: row.clientId,
              customerId: row.customerId,
              sourceType: OVERDUE_SOURCE_TYPE,
              sourceId: row.saleId,
              notificationType: NotificationType.CUSTOMER_OVERDUE,
            },
          });
        } catch {
          continue;
        }

        await this.notifications.notifyCustomerOverdue({
          clientId: row.clientId,
          customerId: row.customerId,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          customerEmail: row.customerEmail,
          invoiceNumber: row.invoiceNumber,
          dueDate: row.dueDate,
          daysOverdue: row.daysOverdue,
          amountDue: row.amountDue.toFixed(2),
          branchName: row.branchName,
        });
        sent += 1;
      }
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} CUSTOMER_OVERDUE notification(s)`);
    }
    return sent;
  }

  /** Find overdue official/retail credit sales for one tenant. */
  async findOverdueSales(
    clientId: string,
    defaultPaymentTermsDays: number,
    now: Date = new Date(),
  ): Promise<OverdueSaleCandidate[]> {
    const sales = await this.prisma.sale.findMany({
      where: {
        clientId,
        customerId: { not: null },
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] },
      },
      include: {
        payments: true,
        customer: { include: { creditProfile: true } },
        branch: { select: { name: true } },
      },
    });

    if (!sales.length) return [];

    const alreadySent = await this.prisma.customerOverdueNotificationLog.findMany({
      where: {
        clientId,
        sourceType: OVERDUE_SOURCE_TYPE,
        sourceId: { in: sales.map((s) => s.id) },
        notificationType: NotificationType.CUSTOMER_OVERDUE,
      },
      select: { sourceId: true },
    });
    const sentIds = new Set(alreadySent.map((l) => l.sourceId));

    const results: OverdueSaleCandidate[] = [];

    for (const sale of sales) {
      if (!sale.customerId || !sale.customer || sentIds.has(sale.id)) continue;

      const terms =
        sale.customer.creditProfile?.paymentTermsDays ?? defaultPaymentTermsDays;
      if (terms <= 0) continue;

      const dueDate = new Date(sale.createdAt.getTime() + terms * MS_PER_DAY);
      if (dueDate >= now) continue;

      const paid = sale.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0),
      );
      const amountDue = sale.total.minus(paid);
      if (amountDue.lte(0)) continue;

      const daysOverdue = Math.max(
        1,
        Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY),
      );

      results.push({
        saleId: sale.id,
        clientId: sale.clientId,
        customerId: sale.customerId,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customer.name,
        customerPhone: sale.customer.phone,
        customerEmail: sale.customer.email,
        branchName: sale.branch?.name ?? null,
        dueDate,
        daysOverdue,
        amountDue,
      });
    }

    return results;
  }
}
