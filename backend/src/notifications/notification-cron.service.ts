import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { CustomerOverdueService } from './customer-overdue.service';

const HOUR_MS = 3_600_000;

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly customerOverdue: CustomerOverdueService,
  ) {}

  /** Hourly: send 48h and 24h subscription-expiry reminders (deduplicated). */
  @Cron('0 * * * *')
  async checkExpiringSubscriptions(): Promise<void> {
    try {
      await this.runExpiryCheck(48, NotificationType.SUBSCRIPTION_EXPIRING_48H);
      await this.runExpiryCheck(24, NotificationType.SUBSCRIPTION_EXPIRING_24H);
    } catch (err) {
      this.logger.error(`Subscription expiry check failed: ${(err as Error).message}`);
    }
  }

  /** Daily at 9:00 AM: notify owners/managers about overdue customer invoices (once per sale). */
  @Cron('0 9 * * *')
  async checkCustomerOverdue(): Promise<void> {
    try {
      await this.customerOverdue.runCustomerOverdueCheck();
    } catch (err) {
      this.logger.error(`Customer overdue check failed: ${(err as Error).message}`);
    }
  }

  /** Exposed for manual triggering in tests/dev. */
  async runExpiryCheck(hoursLeft: 48 | 24, type: NotificationType): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursLeft * HOUR_MS);

    const expiring = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
        expiresAt: { gt: now, lte: windowEnd },
      },
      select: {
        id: true,
        clientId: true,
        expiresAt: true,
        plan: { select: { name: true } },
      },
    });
    if (!expiring.length) return 0;

    const alreadySent = await this.prisma.subscriptionNotificationLog.findMany({
      where: {
        subscriptionId: { in: expiring.map((s) => s.id) },
        notificationType: type,
      },
      select: { subscriptionId: true },
    });
    const sentIds = new Set(alreadySent.map((l) => l.subscriptionId));

    let sent = 0;
    for (const sub of expiring) {
      if (sentIds.has(sub.id) || !sub.expiresAt) continue;

      // Log first (unique constraint guards against concurrent duplicates).
      try {
        await this.prisma.subscriptionNotificationLog.create({
          data: {
            clientId: sub.clientId,
            subscriptionId: sub.id,
            notificationType: type,
          },
        });
      } catch {
        continue; // another worker already logged it
      }

      await this.notifications.notifySubscriptionExpiring({
        clientId: sub.clientId,
        hoursLeft,
        planName: sub.plan.name,
        expiresAt: sub.expiresAt,
      });
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} ${type} reminder(s)`);
    }
    return sent;
  }
}
