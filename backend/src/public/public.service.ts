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
  BusinessType,
  ClientStatus,
  LicensePlan,
  OtpPurpose,
  PaymentRecordStatus,
  PlanType,
  Prisma,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MAIN_BRANCH_CODE } from '../branch/branch.constants';
import type { RegisterClientDto } from './dto/register-client.dto';
import { resolveDashboardPath } from '../common/dashboard-path.util';
import { OtpService } from '../otp/otp.service';
import { NotificationService } from '../notifications/notification.service';
import type { ResendEmailOtpDto } from './dto/resend-email-otp.dto';
import type { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';

const BCRYPT_ROUNDS = 12;

/**
 * Payment simulation must be turned on by an explicit env flag, never
 * inferred from NODE_ENV. Staging is not 'production' but staging must
 * still NOT accept unauthenticated simulate-success calls — so the
 * prior `NODE_ENV !== 'production'` gate was unsafe.
 *
 * Accepts the usual truthy variants so devs can write `=1` / `=yes`.
 */
function isPaymentSimulationEnabled(): boolean {
  const raw = (process.env.ENABLE_PAYMENT_SIMULATION ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

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
    private readonly otp: OtpService,
    private readonly notifications: NotificationService,
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
        businessType: true,
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
      isLifetime: p.type === 'ONE_TIME',
    }));
  }

  async registerClient(dto: RegisterClientDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
    }

    // Hybrid Desktop Lifetime is discontinued — never sellable, even if the
    // plan row is reactivated by mistake.
    if (plan.code === LicensePlan.HYBRID_DESKTOP_LIFETIME) {
      throw new BadRequestException({
        message: 'Hybrid Desktop Lifetime is not available.',
        code: 'PLAN_DISCONTINUED',
      });
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

    // One-time (lifetime) plans must be purchased with the LIFETIME cycle.
    if (plan.type === PlanType.ONE_TIME && dto.billingCycle !== BillingCycle.LIFETIME) {
      throw new BadRequestException({
        message: 'This plan is a one-time purchase and must use the LIFETIME billing cycle',
        code: 'PLAN_REQUIRES_LIFETIME_CYCLE',
      });
    }

    // Business-type-specific plans (e.g. Desktop Lifetime) can only be bought
    // for the matching business type.
    const effectiveBusinessType = dto.businessType ?? plan.businessType ?? BusinessType.RETAIL;
    if (plan.businessType && plan.businessType !== effectiveBusinessType) {
      throw new BadRequestException({
        message: `This plan is only available for ${plan.businessType} businesses`,
        code: 'PLAN_BUSINESS_TYPE_MISMATCH',
      });
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check email uniqueness (client + owner user)
    const existing = await this.prisma.client.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        message: 'An account with this email already exists',
        code: 'CLIENT_EMAIL_EXISTS',
      });
    }

    const existingOwner = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, role: UserRole.OWNER },
      select: { id: true },
    });
    if (existingOwner) {
      throw new ConflictException({
        message: 'An owner account with this email already exists',
        code: 'OWNER_EMAIL_EXISTS',
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
          status: ClientStatus.PENDING_EMAIL_VERIFICATION,
          businessType: effectiveBusinessType,
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

      const user = await tx.user.create({
        data: {
          clientId: client.id,
          name: dto.ownerName.trim(),
          username: normalizedEmail,
          email: normalizedEmail,
          passwordHash,
          role: UserRole.OWNER,
          isActive: false,
          emailVerified: false,
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
        businessType: effectiveBusinessType,
        email: dto.email.trim().toLowerCase(),
      },
    });

    await this.otp.createOtp({
      email: normalizedEmail,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      userId: result.user.id,
      clientId: result.client.id,
    });

    return {
      message: 'Verification code sent to email',
      email: normalizedEmail,
      nextStep: 'VERIFY_EMAIL' as const,
    };
  }

  async verifyEmailOtp(dto: VerifyEmailOtpDto) {
    const email = dto.email.trim().toLowerCase();

    const owner = await this.prisma.user.findFirst({
      where: { email, role: UserRole.OWNER },
      include: {
        client: {
          select: {
            id: true,
            status: true,
            businessType: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!owner?.client || owner.client.deletedAt) {
      throw new NotFoundException({
        message: 'Registration not found for this email',
        code: 'REGISTRATION_NOT_FOUND',
      });
    }

    if (owner.emailVerified) {
      const payment = await this.prisma.paymentRecord.findFirst({
        where: { clientId: owner.clientId, status: PaymentRecordStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      const sub = await this.prisma.subscription.findFirst({
        where: { clientId: owner.clientId },
        orderBy: { updatedAt: 'desc' },
        include: { plan: { select: { code: true } } },
      });
      return {
        success: true,
        message: 'Email already verified',
        nextStep: 'PAYMENT' as const,
        paymentId: payment?.id ?? null,
        businessType: owner.client.businessType,
        planCode: sub?.plan.code ?? null,
      };
    }

    if (owner.client.status !== ClientStatus.PENDING_EMAIL_VERIFICATION) {
      throw new BadRequestException({
        message: 'Email verification is not required for this account',
        code: 'EMAIL_ALREADY_VERIFIED_OR_ACTIVE',
      });
    }

    await this.otp.verifyOtp({
      email,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      code: dto.otp,
    });

    const now = new Date();
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { clientId: owner.clientId, status: PaymentRecordStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const sub = await this.prisma.subscription.findFirst({
      where: { clientId: owner.clientId },
      orderBy: { updatedAt: 'desc' },
      include: { plan: { select: { code: true } } },
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: owner.id },
        data: { emailVerified: true, emailVerifiedAt: now },
      }),
      this.prisma.client.update({
        where: { id: owner.clientId },
        data: { status: ClientStatus.PENDING_PAYMENT },
      }),
    ]);

    await this.audit.log({
      userId: owner.id,
      clientId: owner.clientId,
      action: 'public.email.verified',
      entity: 'User',
      entityId: owner.id,
      newValue: { email },
    });

    return {
      success: true,
      message: 'Email verified',
      nextStep: 'PAYMENT' as const,
      paymentId: payment?.id ?? null,
      businessType: owner.client.businessType,
      planCode: sub?.plan.code ?? null,
    };
  }

  async resendEmailOtp(dto: ResendEmailOtpDto) {
    const email = dto.email.trim().toLowerCase();

    const owner = await this.prisma.user.findFirst({
      where: { email, role: UserRole.OWNER },
      include: {
        client: { select: { id: true, status: true, deletedAt: true } },
      },
    });

    if (!owner?.client || owner.client.deletedAt) {
      return { message: 'If this email is registered, a verification code has been sent.' };
    }

    if (owner.emailVerified) {
      return { message: 'Email is already verified. You can proceed to payment or sign in.' };
    }

    if (owner.client.status !== ClientStatus.PENDING_EMAIL_VERIFICATION) {
      return { message: 'Email verification is not required for this account.' };
    }

    await this.otp.createOtp({
      email,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      userId: owner.id,
      clientId: owner.clientId,
    });

    return { message: 'Verification code sent to email' };
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
        client: { select: { id: true, businessName: true, status: true, businessType: true } },
        subscription: { select: { id: true, status: true, expiresAt: true, maxDevices: true } },
        plan: { select: { code: true, name: true, type: true, allowsDesktopDownload: true } },
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
      isLifetime: record.billingCycle === BillingCycle.LIFETIME,
      desktopDownloadEnabled: record.plan.allowsDesktopDownload,
      unlimited: record.subscription ? record.subscription.maxDevices === null : false,
      maxDevices: record.subscription?.maxDevices ?? null,
      businessType: record.client.businessType,
      clientStatus: record.client.status,
      subscriptionStatus: record.subscription?.status ?? null,
    };
  }

  async simulatePaymentSuccess(paymentId: string) {
    if (!isPaymentSimulationEnabled()) {
      throw new BadRequestException({
        message:
          'Payment simulation is disabled on this deployment. Set ENABLE_PAYMENT_SIMULATION=true to enable in development.',
        code: 'PAYMENT_SIMULATION_DISABLED',
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
    if (record.client.status === ClientStatus.PENDING_EMAIL_VERIFICATION) {
      throw new BadRequestException({
        message: 'Please verify your email before completing payment',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (record.client.status !== ClientStatus.PENDING_PAYMENT && record.client.status !== ClientStatus.ACTIVE) {
      throw new BadRequestException({
        message: 'Client is not eligible for payment completion',
        code: 'CLIENT_NOT_PENDING_PAYMENT',
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
        data: { isActive: true, emailVerified: true, emailVerifiedAt: now },
      });

      return tx.activationCode.create({
        data: {
          clientId: record.clientId,
          planId: record.planId,
          lookupHash,
          // Null = unlimited (Desktop Lifetime); maxUses is non-nullable, so
          // unlimited codes use a high internal value.
          maxBranches: sub.maxBranches,
          maxDevices: sub.maxDevices,
          graceDays: sub.graceDays,
          termDays: days ?? 36500,
          maxUses: sub.maxDevices ?? 1_000_000,
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

    const ownerUser = await this.prisma.user.findFirst({
      where: { clientId: record.clientId, role: UserRole.OWNER },
      select: { email: true },
    });

    const businessType = record.client.businessType ?? BusinessType.RETAIL;

    // First successful payment → welcome email; later payments → renewal invoice.
    const previousPaidCount = await this.prisma.paymentRecord.count({
      where: {
        clientId: record.clientId,
        status: PaymentRecordStatus.PAID,
        id: { not: record.id },
      },
    });

    if (previousPaidCount === 0) {
      void this.notifications
        .sendWelcomeMessage({
          clientId: record.clientId,
          businessType,
          planName: sub.plan.name,
          ownerEmail: ownerUser?.email ?? record.client.email,
          dashboardPath: resolveDashboardPath(businessType),
        })
        .catch(() => undefined);
    } else {
      void this.notifications
        .notifySubscriptionRenewed({
          clientId: record.clientId,
          planName: sub.plan.name,
          billingCycle: record.billingCycle,
          amount: record.amount.toString(),
          currency: record.currency,
          paidAt: now,
          expiresAt,
          invoiceNumber: record.id.slice(0, 8).toUpperCase(),
        })
        .catch(() => undefined);
    }

    void this.notifications
      .notifyDeviceActivated({ clientId: record.clientId, planName: sub.plan.name })
      .catch(() => undefined);

    const isLifetime = record.billingCycle === BillingCycle.LIFETIME;
    const desktopDownloadEnabled = sub.plan.allowsDesktopDownload;
    const unlimited = sub.maxDevices === null && sub.maxUsers === null && sub.maxBranches === null;

    return {
      success: true,
      clientId: record.clientId,
      activationCode: plain,
      subscriptionExpiresAt: expiresAt?.toISOString() ?? null,
      subscriptionStatus: subStatus,
      planCode: sub.plan.code,
      planName: sub.plan.name,
      amount: record.amount.toString(),
      currency: record.currency,
      isLifetime,
      desktopDownloadEnabled,
      unlimited,
      maxDevices: sub.maxDevices,
      businessType,
      ownerEmail: ownerUser?.email ?? record.client.email,
      nextDashboardUrl: resolveDashboardPath(businessType),
      message: isLifetime
        ? 'Payment confirmed. Your desktop license is ready — sign in with your registration email and password.'
        : 'Payment confirmed. Sign in with your registration email and password.',
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
