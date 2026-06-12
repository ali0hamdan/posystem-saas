import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationRecipientService } from './notification-recipient.service';

interface DispatchOptions {
  /** Path appended to FRONTEND_URL for the action link. */
  linkPath?: string;
  /** Key/value pairs rendered as a details table in the email. */
  data?: Record<string, string | number | null | undefined>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly recipientsService: NotificationRecipientService,
  ) {}

  private frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  private async businessName(clientId: string): Promise<string> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { businessName: true },
    });
    return client?.businessName ?? 'Nezhin POS';
  }

  /**
   * Central dispatcher: resolves recipients from the owner-configured
   * preferences for the notification type and emails each of them.
   * Never throws — notification failure must not break the business action.
   */
  async sendNotification(
    clientId: string,
    type: NotificationType,
    subject: string,
    message: string,
    options?: DispatchOptions,
  ): Promise<void> {
    try {
      const recipients = await this.recipientsService.getRecipients(clientId, type);
      if (!recipients.length) return;

      const businessName = await this.businessName(clientId);
      const link = options?.linkPath ? `${this.frontendUrl()}${options.linkPath}` : undefined;

      await Promise.all(
        recipients.map((r) =>
          this.email.sendNotificationEmail(r.email, subject, message, {
            businessName,
            link,
            extra: options?.data,
          }),
        ),
      );

      this.logger.log(
        `Notification ${type} sent to ${recipients.length} recipient(s) (client: ${clientId})`,
      );
    } catch (err) {
      this.logger.warn(
        `Notification ${type} failed for client ${clientId}: ${(err as Error).message}`,
      );
    }
  }

  // ---------- event-specific helpers ----------

  async notifyLowStock(params: {
    clientId: string;
    productName: string;
    sku?: string | null;
    currentStock: number;
    minStock: number;
    branchName: string;
    productId?: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.LOW_STOCK,
      `Low stock alert - ${params.productName}`,
      'Product stock has fallen to or below the low-stock alert level.',
      {
        linkPath: params.productId ? `/products?highlight=${params.productId}` : '/products',
        data: {
          Product: params.productName,
          SKU: params.sku ?? undefined,
          'Current stock': params.currentStock,
          'Alert level': params.minStock,
          Branch: params.branchName,
          Time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      },
    );
  }

  async notifyPasswordReset(params: {
    clientId: string;
    userName: string;
    userEmail: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.PASSWORD_RESET,
      'Password reset completed',
      'A user in your business completed a password reset.',
      {
        data: {
          User: params.userName,
          Email: params.userEmail,
          Time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      },
    );
  }

  async notifyPurchaseCompleted(params: {
    clientId: string;
    invoiceNumber: string;
    total: string;
    customerName?: string | null;
    paymentMethod?: string | null;
    branchName?: string | null;
    createdByName?: string | null;
    linkPath?: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.PURCHASE_COMPLETED,
      `Purchase completed - ${params.invoiceNumber}`,
      'A purchase was completed.',
      {
        linkPath: params.linkPath ?? '/sales',
        data: {
          Invoice: params.invoiceNumber,
          Total: params.total,
          Customer: params.customerName ?? 'Walk-in',
          Payment: params.paymentMethod ?? undefined,
          Branch: params.branchName ?? undefined,
          'Created by': params.createdByName ?? undefined,
          Time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      },
    );
  }

  async notifyUserCreated(params: {
    clientId: string;
    newUserName: string;
    newUserEmail?: string | null;
    newUserRole: string;
    createdByName: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.USER_CREATED,
      'New user added',
      'A new user account was created in your business.',
      {
        linkPath: '/users',
        data: {
          Name: params.newUserName,
          Email: params.newUserEmail ?? '—',
          Role: params.newUserRole,
          'Created by': params.createdByName,
          Time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      },
    );
  }

  async notifyStockAdded(params: {
    clientId: string;
    productName: string;
    sku?: string | null;
    quantityAdded: number;
    oldStock: number;
    newStock: number;
    branchName: string;
    reason: string;
    createdByName?: string | null;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.STOCK_ADDED,
      `Stock added - ${params.productName}`,
      'Stock was increased.',
      {
        linkPath: '/stock-movements',
        data: {
          Product: params.productName,
          SKU: params.sku ?? undefined,
          'Quantity added': params.quantityAdded,
          'Old stock': params.oldStock,
          'New stock': params.newStock,
          Branch: params.branchName,
          Reason: params.reason,
          'Created by': params.createdByName ?? undefined,
          Time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      },
    );
  }

  async notifySubscriptionExpiring(params: {
    clientId: string;
    hoursLeft: 48 | 24;
    planName: string;
    expiresAt: Date;
  }): Promise<void> {
    const type =
      params.hoursLeft === 48
        ? NotificationType.SUBSCRIPTION_EXPIRING_48H
        : NotificationType.SUBSCRIPTION_EXPIRING_24H;
    await this.sendNotification(
      params.clientId,
      type,
      `Subscription expiring in ${params.hoursLeft} hours`,
      `Your subscription expires in ${params.hoursLeft} hours. Renew now to avoid limited access after expiry.`,
      {
        linkPath: '/billing',
        data: {
          Plan: params.planName,
          'Expires at': params.expiresAt.toISOString().replace('T', ' ').slice(0, 16),
        },
      },
    );
  }

  async sendWelcomeMessage(params: {
    clientId: string;
    businessType: string;
    planName: string;
    ownerEmail: string;
    dashboardPath: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.WELCOME_MESSAGE,
      'Welcome to Nezhin POS',
      'Your account is active. Sign in with your registration email to start setting up products, branches, and users.',
      {
        linkPath: params.dashboardPath,
        data: {
          'System type': params.businessType,
          Package: params.planName,
          'Login email': params.ownerEmail,
        },
      },
    );
  }

  async notifySubscriptionRenewed(params: {
    clientId: string;
    planName: string;
    billingCycle: string;
    amount: string;
    currency: string;
    paidAt: Date;
    expiresAt?: Date | null;
    invoiceNumber: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.SUBSCRIPTION_RENEWED_INVOICE,
      `Subscription renewed - Invoice #${params.invoiceNumber}`,
      'Your subscription was renewed successfully. Thank you for your payment.',
      {
        linkPath: '/billing',
        data: {
          Plan: params.planName,
          'Billing cycle': params.billingCycle,
          'Amount paid': `${params.amount} ${params.currency}`,
          'Payment date': params.paidAt.toISOString().slice(0, 10),
          'Next expiry': params.expiresAt
            ? params.expiresAt.toISOString().slice(0, 10)
            : 'Lifetime',
          Invoice: params.invoiceNumber,
        },
      },
    );
  }

  async notifyDeviceActivated(params: { clientId: string; planName: string }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.DEVICE_ACTIVATED,
      'New device activation code',
      'A new activation code was generated for your subscription.',
      {
        linkPath: '/activate',
        data: { Plan: params.planName },
      },
    );
  }

  async notifyQuotationAccepted(params: {
    clientId: string;
    quotationNumber: string;
    total: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.QUOTATION_ACCEPTED,
      'Quotation accepted',
      `Quotation ${params.quotationNumber} was accepted by the customer.`,
      {
        linkPath: '/quotations',
        data: { Quotation: params.quotationNumber, Total: params.total },
      },
    );
  }

  async notifyRefundCompleted(params: {
    clientId: string;
    refundNumber: string;
    sourceNumber: string;
    totalRefundAmount: string;
    refundType: string;
    reason: string;
    createdByName: string;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.REFUND_COMPLETED,
      `Refund completed - ${params.refundNumber}`,
      'A refund was processed.',
      {
        linkPath: '/refunds',
        data: {
          'Refund #': params.refundNumber,
          Source: params.sourceNumber,
          Amount: params.totalRefundAmount,
          Type: params.refundType,
          Reason: params.reason,
          'Processed by': params.createdByName,
          Time: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      },
    );
  }

  async notifyCustomerOverdue(params: {
    clientId: string;
    customerId: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    invoiceNumber: string;
    dueDate: Date;
    daysOverdue: number;
    amountDue: string;
    branchName?: string | null;
  }): Promise<void> {
    await this.sendNotification(
      params.clientId,
      NotificationType.CUSTOMER_OVERDUE,
      'Customer overdue payment alert',
      'A customer invoice is past its due date and still has an outstanding balance.',
      {
        linkPath: `/customers/${params.customerId}`,
        data: {
          Customer: params.customerName,
          Phone: params.customerPhone ?? undefined,
          Email: params.customerEmail ?? undefined,
          Invoice: params.invoiceNumber,
          'Due date': params.dueDate.toISOString().slice(0, 10),
          'Days overdue': params.daysOverdue,
          'Amount due': params.amountDue,
          Branch: params.branchName ?? undefined,
        },
      },
    );
  }
}
