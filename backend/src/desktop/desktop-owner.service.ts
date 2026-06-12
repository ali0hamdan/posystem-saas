import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  BillingCycle,
  BusinessType,
  ClientStatus,
  LicensePlan,
  PlanType,
  Prisma,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_GRACE_DAYS = 7;

/**
 * The license payload the renderer reads from {@code license.json} (written
 * by {@code local-activation-manager.cjs}) plus the password the owner
 * picked. Mirror of the wire shape accepted by POST /auth/owner/setup.
 */
export type DesktopOwnerSetupInput = {
  clientId: string;
  businessName: string;
  businessType: BusinessType;
  ownerEmail: string;
  ownerName?: string;
  /** Plain password — hashed with bcrypt before persisting. */
  ownerPassword: string;
  /** Hosted-server plan code; used to upsert the local Plan + Subscription. */
  planCode?: LicensePlan | null;
  /** Lifetime desktop licenses don't expire — null lexp on token equals lifetime. */
  lifetimeLicense?: boolean;
  /** Optional ISO timestamp from the hosted server for non-lifetime plans. */
  subscriptionExpiresAt?: string | null;
  /** Optional override for the default branch name (defaults to "Main Branch"). */
  defaultBranchName?: string;
};

export type DesktopSetupResult =
  | {
      ok: true;
      alreadyConfigured: false;
      next: '/login';
      message: 'Local owner account created';
      client: { id: string; businessName: string; businessType: BusinessType };
      owner: { id: string; username: string; email: string | null };
      branch: { id: string; name: string; code: string };
      subscription: { id: string; status: SubscriptionStatus; planCode: LicensePlan };
    }
  | {
      ok: true;
      alreadyConfigured: true;
      next: '/login';
      message: 'Local owner already configured';
      repaired: { branch: boolean; storeSettings: boolean; subscription: boolean };
      client: { id: string; businessName: string; businessType: BusinessType };
      owner: { id: string; username: string; email: string | null };
    };

@Injectable()
export class DesktopOwnerService {
  private readonly logger = new Logger(DesktopOwnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isDesktopMode(): boolean {
    return Boolean(this.config.get<boolean>('app.desktopMode'));
  }

  private assertDesktop(): void {
    if (!this.isDesktopMode()) {
      throw new BadRequestException({
        code: 'NOT_DESKTOP_MODE',
        message: 'Local owner setup is only available when APP_MODE=desktop.',
      });
    }
  }

  /** Lightweight probe used by the renderer's activation gate. */
  async getStatus() {
    this.assertDesktop();
    const clientCount = await this.prisma.client.count();
    if (clientCount === 0) {
      return { provisioned: false, hasOwner: false };
    }
    const owner = await this.prisma.user.findFirst({
      where: { role: UserRole.OWNER, isActive: true },
      select: {
        id: true,
        username: true,
        email: true,
        clientId: true,
        client: { select: { businessName: true, businessType: true } },
      },
    });
    return {
      provisioned: true,
      hasOwner: Boolean(owner),
      owner: owner
        ? {
            username: owner.username,
            email: owner.email,
            clientId: owner.clientId,
            businessName: owner.client.businessName,
            businessType: owner.client.businessType,
          }
        : null,
    };
  }

  /**
   * Idempotent owner provisioning.
   *
   *   - First call:      upserts Plan + Client + Subscription + Branch +
   *                      StoreSettings + OWNER User (bcrypt-hashed password).
   *   - Re-run:          returns {@code alreadyConfigured: true} without
   *                      touching the existing password, repairing any of
   *                      Branch / StoreSettings / Subscription that have
   *                      gone missing.
   *   - Tenant mismatch: refuses with 409 — the local DB is single-tenant
   *                      and silently overwriting would orphan data.
   */
  async setup(dto: DesktopOwnerSetupInput): Promise<DesktopSetupResult> {
    this.assertDesktop();
    if (dto.businessType === BusinessType.HYBRID) {
      throw new BadRequestException({
        code: 'HYBRID_NOT_SUPPORTED',
        message: 'Hybrid Desktop is not supported.',
      });
    }
    if (!Object.values(BusinessType).includes(dto.businessType)) {
      throw new BadRequestException({
        code: 'INVALID_BUSINESS_TYPE',
        message: 'businessType must be RETAIL, FOOD_BEVERAGE, or WHOLESALE.',
      });
    }

    try {
      const existingClient = await this.prisma.client.findFirst({ select: { id: true } });
      if (existingClient && existingClient.id !== dto.clientId) {
        throw new ConflictException({
          code: 'TENANT_MISMATCH',
          message:
            'This local installation already belongs to a different tenant. Reset the desktop license before re-activating with a new code.',
        });
      }

      const existingOwner = existingClient
        ? await this.prisma.user.findFirst({
            where: { clientId: existingClient.id, role: UserRole.OWNER, isActive: true },
          })
        : null;

      if (existingClient && existingOwner) {
        return this.repairOnly(existingClient.id, existingOwner, dto);
      }

      // Brand-new install OR partial setup (client without owner). Validate
      // the password only on the path that actually persists it.
      this.assertPasswordPolicy(dto.ownerPassword);
      const passwordHash = await bcrypt.hash(dto.ownerPassword, BCRYPT_ROUNDS);

      return await this.prisma.$transaction(async (tx) => {
        const plan = await this.upsertPlan(tx, dto);
        const client = await this.upsertClient(tx, dto);
        const subscription = await this.upsertSubscription(tx, client.id, plan.id, dto);
        const branch = await this.upsertDefaultBranch(tx, client.id, dto);
        await this.upsertStoreSettings(tx, client.id, dto.businessName);
        const owner = await this.upsertOwner(tx, client.id, dto, passwordHash);
        await this.attachOwnerToBranch(tx, owner.id, branch.id);

        return {
          ok: true,
          alreadyConfigured: false,
          next: '/login' as const,
          message: 'Local owner account created' as const,
          client: {
            id: client.id,
            businessName: client.businessName,
            businessType: client.businessType,
          },
          owner: { id: owner.id, username: owner.username, email: owner.email },
          branch: { id: branch.id, name: branch.name, code: branch.code },
          subscription: { id: subscription.id, status: subscription.status, planCode: plan.code },
        };
      });
    } catch (e) {
      if (
        e instanceof ConflictException ||
        e instanceof BadRequestException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // The hash + plain-text password never enter logs.
        this.logger.error(`[desktop owner] prisma ${e.code}: ${e.message}`);
      } else {
        this.logger.error('[desktop owner] setup failed', e as Error);
      }
      throw new InternalServerErrorException({
        code: 'DESKTOP_SETUP_FAILED',
        message: 'Could not provision the local owner.',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private assertPasswordPolicy(password: string): void {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: `Owner password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }
  }

  private planCodeFor(dto: DesktopOwnerSetupInput): LicensePlan {
    if (dto.planCode && Object.values(LicensePlan).includes(dto.planCode)) {
      return dto.planCode;
    }
    switch (dto.businessType) {
      case BusinessType.RETAIL:
        return LicensePlan.RETAIL_DESKTOP_LIFETIME;
      case BusinessType.FOOD_BEVERAGE:
        return LicensePlan.FNB_DESKTOP_LIFETIME;
      case BusinessType.WHOLESALE:
        return LicensePlan.WHOLESALE_DESKTOP_LIFETIME;
      default:
        return LicensePlan.LIFETIME_DESKTOP;
    }
  }

  private subscriptionShape(dto: DesktopOwnerSetupInput): {
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    expiresAt: Date | null;
  } {
    const lifetime = dto.lifetimeLicense === true || dto.subscriptionExpiresAt == null;
    return {
      status: lifetime ? SubscriptionStatus.LIFETIME : SubscriptionStatus.ACTIVE,
      billingCycle: lifetime ? BillingCycle.LIFETIME : BillingCycle.YEARLY,
      expiresAt: lifetime ? null : new Date(dto.subscriptionExpiresAt!),
    };
  }

  private async upsertPlan(tx: Prisma.TransactionClient, dto: DesktopOwnerSetupInput) {
    const code = this.planCodeFor(dto);
    return tx.plan.upsert({
      where: { code },
      create: {
        code,
        name: this.planNameFor(code),
        type: PlanType.ONE_TIME,
        businessType: dto.businessType,
        allowsDesktopDownload: true,
        isActive: true,
      },
      update: { allowsDesktopDownload: true, isActive: true },
    });
  }

  private planNameFor(code: LicensePlan): string {
    switch (code) {
      case LicensePlan.RETAIL_DESKTOP_LIFETIME:
        return 'Retail Desktop Lifetime';
      case LicensePlan.FNB_DESKTOP_LIFETIME:
        return 'F&B Desktop Lifetime';
      case LicensePlan.WHOLESALE_DESKTOP_LIFETIME:
        return 'Wholesale Desktop Lifetime';
      case LicensePlan.LIFETIME_DESKTOP:
        return 'Desktop Lifetime';
      default:
        return code;
    }
  }

  private upsertClient(tx: Prisma.TransactionClient, dto: DesktopOwnerSetupInput) {
    const slug = this.slugFor(dto.businessName, dto.clientId);
    return tx.client.upsert({
      where: { id: dto.clientId },
      create: {
        id: dto.clientId,
        slug,
        businessName: dto.businessName,
        businessType: dto.businessType,
        ownerName: dto.ownerName?.trim() || dto.ownerEmail,
        email: dto.ownerEmail,
        status: ClientStatus.ACTIVE,
      },
      update: {
        businessName: dto.businessName,
        businessType: dto.businessType,
        email: dto.ownerEmail,
        ownerName: dto.ownerName?.trim() || dto.ownerEmail,
        status: ClientStatus.ACTIVE,
      },
    });
  }

  private async upsertSubscription(
    tx: Prisma.TransactionClient,
    clientId: string,
    planId: string,
    dto: DesktopOwnerSetupInput,
  ) {
    const shape = this.subscriptionShape(dto);
    const existing = await tx.subscription.findFirst({ where: { clientId } });
    if (existing) {
      return tx.subscription.update({
        where: { id: existing.id },
        data: {
          planId,
          status: shape.status,
          billingCycle: shape.billingCycle,
          expiresAt: shape.expiresAt,
        },
      });
    }
    return tx.subscription.create({
      data: {
        clientId,
        planId,
        status: shape.status,
        billingCycle: shape.billingCycle,
        startsAt: new Date(),
        expiresAt: shape.expiresAt,
        graceDays: DEFAULT_GRACE_DAYS,
      },
    });
  }

  private upsertDefaultBranch(
    tx: Prisma.TransactionClient,
    clientId: string,
    dto: DesktopOwnerSetupInput,
  ) {
    const branchName = dto.defaultBranchName?.trim() || 'Main Branch';
    return tx.branch.upsert({
      where: { clientId_code: { clientId, code: 'HQ' } },
      create: { clientId, name: branchName, code: 'HQ', isActive: true },
      update: { name: branchName, isActive: true },
    });
  }

  private upsertStoreSettings(
    tx: Prisma.TransactionClient,
    clientId: string,
    storeName: string,
  ) {
    return tx.storeSettings.upsert({
      where: { clientId },
      create: { clientId, storeName },
      update: { storeName },
    });
  }

  private async upsertOwner(
    tx: Prisma.TransactionClient,
    clientId: string,
    dto: DesktopOwnerSetupInput,
    passwordHash: string,
  ) {
    const ownerUsername = this.usernameFor(dto.ownerEmail);
    return tx.user.upsert({
      where: { clientId_username: { clientId, username: ownerUsername } },
      create: {
        clientId,
        name: dto.ownerName?.trim() || dto.ownerEmail,
        username: ownerUsername,
        email: dto.ownerEmail,
        passwordHash,
        role: UserRole.OWNER,
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      // Re-running before an OWNER has been written (e.g. mid-failed retry)
      // should overwrite the in-flight passwordHash. The `repairOnly` path
      // catches the case where the owner is already live and never sees
      // this update.
      update: {
        email: dto.ownerEmail,
        passwordHash,
        role: UserRole.OWNER,
        isActive: true,
        emailVerified: true,
      },
    });
  }

  private async attachOwnerToBranch(
    tx: Prisma.TransactionClient,
    userId: string,
    branchId: string,
  ) {
    await tx.userBranch
      .upsert({
        where: { userId_branchId: { userId, branchId } },
        create: { userId, branchId },
        update: {},
      })
      .catch(() => {
        /* duplicate join row on retry is fine */
      });
  }

  /**
   * Idempotent re-run path: owner already exists. Don't touch the password.
   * Patch any of Branch / StoreSettings / Subscription that have gone missing
   * so a half-broken install (e.g. crashed mid-transaction in an earlier
   * version) can self-heal.
   */
  private async repairOnly(
    clientId: string,
    owner: { id: string; username: string; email: string | null },
    dto: DesktopOwnerSetupInput,
  ): Promise<DesktopSetupResult> {
    const repaired = { branch: false, storeSettings: false, subscription: false };

    const result = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { clientId, code: 'HQ' },
      });
      let branchRow = branch;
      if (!branchRow) {
        branchRow = await this.upsertDefaultBranch(tx, clientId, dto);
        await this.attachOwnerToBranch(tx, owner.id, branchRow.id);
        repaired.branch = true;
      }

      const settings = await tx.storeSettings.findUnique({ where: { clientId } });
      if (!settings) {
        await this.upsertStoreSettings(tx, clientId, dto.businessName);
        repaired.storeSettings = true;
      }

      const subscription = await tx.subscription.findFirst({ where: { clientId } });
      if (!subscription) {
        const plan = await this.upsertPlan(tx, dto);
        await this.upsertSubscription(tx, clientId, plan.id, dto);
        repaired.subscription = true;
      }

      const client = await tx.client.findUniqueOrThrow({
        where: { id: clientId },
        select: { id: true, businessName: true, businessType: true },
      });
      return { client };
    });

    return {
      ok: true,
      alreadyConfigured: true,
      next: '/login',
      message: 'Local owner already configured',
      repaired,
      client: result.client,
      owner: { id: owner.id, username: owner.username, email: owner.email },
    };
  }

  private slugFor(businessName: string, fallbackId: string): string {
    const base = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    return base || `tenant-${fallbackId.slice(0, 8)}`;
  }

  private usernameFor(email: string): string {
    const local = email.split('@')[0]?.trim().toLowerCase() || 'owner';
    return local.replace(/[^a-z0-9._-]/g, '') || 'owner';
  }
}
