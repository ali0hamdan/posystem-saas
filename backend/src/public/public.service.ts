import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivationCodeStatus,
  BillingCycle,
  ClientStatus,
  PaymentRecordStatus,
  Prisma,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MAIN_BRANCH_CODE } from '../branch/branch.constants';
import type { RegisterClientDto } from './dto/register-client.dto';

const BCRYPT_ROUNDS = 12;

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function billingCycleToDays(cycle: BillingCycle): number | null {
  if (cycle === BillingCycle.MONTHLY) return 30;
  if (cycle === BillingCycle.YEARLY) return 365;
  return null; // LIFETIME — no expiry
}

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listActivePlans() {
    const rows = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        type: true,
        monthlyPrice: true,
        yearlyPrice: true,
        oneTimePrice: true,
        currency: true,
        maxUsers: true,
        maxBranches: true,
        maxDevices: true,
        features: true,
        allowsDesktopDownload: true,
      },
    });
    return rows.map((p) => ({
      ...p,
      monthlyPrice: p.monthlyPrice?.toString() ?? null,
      yearlyPrice: p.yearlyPrice?.toString() ?? null,
      oneTimePrice: p.oneTimePrice?.toString() ?? null,
    }));
  }

  async registerClient(dto: RegisterClientDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
    }

    // Validate billing cycle has a price
    let amount: Prisma.Decimal | null = null;
    if (dto.billingCycle === BillingCycle.MONTHLY) amount = plan.monthlyPrice;
    else if (dto.billingCycle === BillingCycle.YEARLY) amount = plan.yearlyPrice;
    else if (dto.billingCycle === BillingCycle.LIFETIME) amount = plan.oneTimePrice;

    if (!amount) {
      throw new BadRequestException({
        message: 'The selected billing cycle is not available for this plan',
        code: 'BILLING_CYCLE_UNAVAILABLE',
      });
    }

    // Check email uniqueness
    const existing = await this.prisma.client.findFirst({
      where: { email: dto.email.trim().toLowerCase(), deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        message: 'An account with this email already exists',
        code: 'CLIENT_EMAIL_EXISTS',
      });
    }

    const slug = await this.resolveUniqueSlug(dto.businessName);
    const startsAt = new Date();
    const days = billingCycleToDays(dto.billingCycle);
    const expiresAt = days ? new Date(startsAt.getTime() + days * 86_400_000) : null;
    const subStatus =
      dto.billingCycle === BillingCycle.LIFETIME
        ? SubscriptionStatus.LIFETIME
        : SubscriptionStatus.PENDING_PAYMENT;

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          slug,
          businessName: dto.businessName.trim(),
          ownerName: dto.ownerName.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone?.trim() || null,
          status: ClientStatus.PENDING_PAYMENT,
        },
      });

      const branch = await tx.branch.create({
        data: {
          clientId: client.id,
          name: 'Main',
          code: MAIN_BRANCH_CODE,
          isActive: true,
        },
      });

      await tx.storeSettings.create({
        data: {
          clientId: client.id,
          storeName: dto.businessName.trim(),
          currency: plan.currency,
          taxEnabled: false,
          taxRate: new Prisma.Decimal(0),
          lowStockDefault: 5,
        },
      });

      const ownerUsername = dto.email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 30) || 'owner';
      const user = await tx.user.create({
        data: {
          clientId: client.id,
          name: dto.ownerName.trim(),
          username: `${ownerUsername}-${randomBytes(2).toString('hex')}`,
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          role: UserRole.OWNER,
          isActive: false, // Activated after payment
        },
      });

      await tx.userBranch.create({
        data: { userId: user.id, branchId: branch.id },
      });

      const subscription = await tx.subscription.create({
        data: {
          clientId: client.id,
          planId: plan.id,
          billingCycle: dto.billingCycle,
          status: subStatus,
          startsAt,
          expiresAt,
          maxUsers: plan.maxUsers,
          maxBranches: plan.maxBranches,
          maxDevices: plan.maxDevices,
          graceDays: 7,
        },
      });

      const paymentRecord = await tx.paymentRecord.create({
        data: {
          clientId: client.id,
          planId: plan.id,
          subscriptionId: subscription.id,
          billingCycle: dto.billingCycle,
          status: PaymentRecordStatus.PENDING,
          amount,
          currency: plan.currency,
          paymentProvider: 'manual',
        },
      });

      return { client, subscription, paymentRecord, user };
    });

    await this.audit.log({
      userId: null,
      clientId: result.client.id,
      action: 'public.client.register',
      entity: 'Client',
      entityId: result.client.id,
      newValue: {
        planCode: dto.planCode,
        billingCycle: dto.billingCycle,
        email: dto.email.trim().toLowerCase(),
      },
    });

    return {
      clientId: result.client.id,
      paymentId: result.paymentRecord.id,
      amount: result.paymentRecord.amount.toString(),
      currency: result.paymentRecord.currency,
      planCode: dto.planCode,
      billingCycle: dto.billingCycle,
      businessName: result.client.businessName,
      username: result.user.username,
    };
  }

  async getPaymentStatus(paymentId: string) {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        billingCycle: true,
        paidAt: true,
        client: { select: { id: true, businessName: true, status: true } },
        subscription: { select: { id: true, status: true, expiresAt: true } },
        plan: { select: { code: true, name: true } },
      },
    });
    if (!record) {
      throw new NotFoundException({ message: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
    }
    return {
      paymentId: record.id,
      status: record.status,
      amount: record.amount.toString(),
      currency: record.currency,
      billingCycle: record.billingCycle,
      paidAt: record.paidAt?.toISOString() ?? null,
      planCode: record.plan.code,
      planName: record.plan.name,
      clientStatus: record.client.status,
      subscriptionStatus: record.subscription?.status ?? null,
    };
  }

  async simulatePaymentSuccess(paymentId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException({
        message: 'Payment simulation is not available in production',
        code: 'SIM_PRODUCTION_DISABLED',
      });
    }

    const record = await this.prisma.paymentRecord.findUnique({
      where: { id: paymentId },
      include: {
        subscription: { include: { plan: true } },
        client: true,
      },
    });
    if (!record) {
      throw new NotFoundException({ message: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
    }
    if (record.status === PaymentRecordStatus.PAID) {
      throw new BadRequestException({
        message: 'Payment is already completed',
        code: 'PAYMENT_ALREADY_PAID',
      });
    }
    if (record.status !== PaymentRecordStatus.PENDING) {
      throw new BadRequestException({
        message: 'Payment cannot be completed in its current state',
        code: 'PAYMENT_NOT_PENDING',
      });
    }

    const now = new Date();
    const days = billingCycleToDays(record.billingCycle);
    const expiresAt = days ? new Date(now.getTime() + days * 86_400_000) : null;
    const subStatus =
      record.billingCycle === BillingCycle.LIFETIME
        ? SubscriptionStatus.LIFETIME
        : SubscriptionStatus.ACTIVE;

    // Generate activation code
    const plain = `POS-${randomBytes(16).toString('hex').toUpperCase()}`;
    const lookupHash = sha256Hex(plain.toLowerCase());
    const codeValidUntil = new Date(now.getTime() + 90 * 86_400_000);
    const sub = record.subscription!;

    const activationCode = await this.prisma.$transaction(async (tx) => {
      await tx.paymentRecord.update({
        where: { id: paymentId },
        data: { status: PaymentRecordStatus.PAID, paidAt: now },
      });

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: subStatus,
          startsAt: now,
          expiresAt,
          currentPeriodStart: now,
          currentPeriodEnd: expiresAt,
        },
      });

      await tx.client.update({
        where: { id: record.clientId },
        data: { status: ClientStatus.ACTIVE },
      });

      // Activate the owner user
      await tx.user.updateMany({
        where: { clientId: record.clientId, role: UserRole.OWNER },
        data: { isActive: true },
      });

      return tx.activationCode.create({
        data: {
          clientId: record.clientId,
          planId: record.planId,
          lookupHash,
          maxBranches: sub.maxBranches,
          maxDevices: sub.maxDevices,
          graceDays: sub.graceDays,
          termDays: days ?? 36500,
          maxUses: sub.maxDevices,
          validUntil: codeValidUntil,
          status: ActivationCodeStatus.UNUSED,
          label: 'Auto-generated on registration',
        },
      });
    });

    await this.audit.log({
      userId: null,
      clientId: record.clientId,
      action: 'public.payment.simulate_success',
      entity: 'PaymentRecord',
      entityId: paymentId,
      newValue: { status: 'PAID', planCode: sub.plan.code },
    });

    // Fetch the username so the response is complete
    const ownerUser = await this.prisma.user.findFirst({
      where: { clientId: record.clientId, role: UserRole.OWNER },
      select: { username: true },
    });

    return {
      success: true,
      activationCode: plain,
      subscriptionExpiresAt: expiresAt?.toISOString() ?? null,
      planCode: sub.plan.code,
      username: ownerUser?.username ?? null,
      message: 'Payment confirmed. Use the activation code to activate your POS device.',
    };
  }

  private async resolveUniqueSlug(input: string): Promise<string> {
    const base = slugify(input) || 'store';
    let candidate = base;
    for (let i = 0; i < 50; i++) {
      const clash = await this.prisma.client.findFirst({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    throw new ConflictException({
      message: 'Could not allocate a unique slug',
      code: 'CLIENT_SLUG_EXHAUSTED',
    });
  }
}
