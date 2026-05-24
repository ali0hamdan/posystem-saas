import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ActivationCodeStatus, ClientStatus, LicensePlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LicenseTokenService } from './license-token.service';
import { LicenseValidationService } from './license-validation.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { ACTIVATION_PUBLIC_FAILURE_BODY } from './activation.constants';
import type { LicenseSurfacePayload, LicenseSurfaceStatus } from './license-surface.types';
import type { LicenseJwtClaims } from './license-token.service';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// LIFETIME subscriptions have null expiresAt — treat as never-expiring (year 2999).
const NEVER_EXPIRES_MS = new Date('2999-12-31T00:00:00Z').getTime();
function licenseLockUnixMs(expiresAt: Date | null, graceDays: number): number {
  if (!expiresAt) return NEVER_EXPIRES_MS;
  return expiresAt.getTime() + graceDays * 86_400_000;
}

const DAY_MS = 86_400_000;

function roundDays(ms: number): number {
  return Math.round((ms / DAY_MS) * 100) / 100;
}

function parseEnabledFeatures(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

@Injectable()
export class LicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly tokens: LicenseTokenService,
    private readonly validation: LicenseValidationService,
  ) {}

  getPublicKeyPem(): string {
    return this.tokens.getPublicKeyPem();
  }

  async activate(dto: ActivateLicenseDto) {
    if (this.validation.isBypassed()) {
      throw new BadRequestException({
        message: 'License activation is disabled while BYPASS_LICENSE is true',
        code: 'LICENSE_BYPASS_ACTIVE',
      });
    }
    const normalized = dto.activationCode.trim().toLowerCase();
    const lookupHash = sha256Hex(normalized);

    const result = await this.prisma.$transaction(async (tx) => {
      const code = await tx.activationCode.findUnique({
        where: { lookupHash },
        include: { plan: true },
      });
      if (!code) {
        throw new NotFoundException({ message: 'Invalid activation code', code: 'ACTIVATION_CODE_NOT_FOUND' });
      }
      if (code.clientId) {
        throw new BadRequestException({
          message:
            'This activation code is linked to an existing store. Activate from the POS device page using POST /activation/activate-device.',
          code: 'ACTIVATION_CODE_CLIENT_BOUND',
        });
      }
      if (
        code.status === ActivationCodeStatus.REVOKED ||
        code.status === ActivationCodeStatus.USED ||
        code.status === ActivationCodeStatus.EXPIRED
      ) {
        throw new BadRequestException({
          message: 'Activation code is no longer valid',
          code: 'ACTIVATION_CODE_INVALID',
        });
      }
      if (code.validUntil.getTime() < Date.now()) {
        throw new BadRequestException({ message: 'Activation code expired', code: 'ACTIVATION_CODE_EXPIRED' });
      }
      if (code.usedCount >= code.maxUses) {
        throw new BadRequestException({ message: 'Activation code already used', code: 'ACTIVATION_CODE_DEPLETED' });
      }

      let clientId = code.clientId;
      if (!clientId) {
        if (!dto.businessName?.trim() || !dto.ownerName?.trim() || !dto.email?.trim()) {
          throw new BadRequestException({
            message: 'businessName, ownerName, and email are required for this activation code',
            code: 'ACTIVATION_PROFILE_REQUIRED',
          });
        }
        const base = slugify(dto.businessName.trim()) || slugify(dto.email.trim()) || 'store';
        let slug = base;
        for (let i = 0; i < 50; i++) {
          const clash = await tx.client.findUnique({ where: { slug }, select: { id: true } });
          if (!clash) break;
          slug = `${base}-${randomBytes(2).toString('hex')}`;
        }
        const client = await tx.client.create({
          data: {
            slug,
            businessName: dto.businessName.trim(),
            ownerName: dto.ownerName.trim(),
            email: dto.email.trim().toLowerCase(),
            phone: dto.phone?.trim() || null,
            status: ClientStatus.ACTIVE,
          },
        });
        clientId = client.id;
      } else {
        const existing = await tx.client.findUnique({ where: { id: clientId } });
        if (!existing) {
          throw new BadRequestException({ message: 'Activation code client missing', code: 'ACTIVATION_CLIENT_MISSING' });
        }
      }

      const activeDevices = await tx.device.count({
        where: { clientId: clientId!, isActive: true },
      });
      if (activeDevices >= code.maxDevices) {
        throw new ForbiddenException({
          message: 'Maximum active devices reached for this client',
          code: 'LICENSE_DEVICE_LIMIT',
        });
      }

      await tx.subscription.updateMany({
        where: { clientId: clientId!, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED },
      });

      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + code.termDays * 86_400_000);
      const subscription = await tx.subscription.create({
        data: {
          clientId: clientId!,
          planId: code.planId,
          status: SubscriptionStatus.ACTIVE,
          startsAt,
          expiresAt,
          maxUsers: code.plan.maxUsers,
          maxBranches: code.maxBranches,
          maxDevices: code.maxDevices,
          graceDays: code.graceDays,
        },
      });

      const extDeviceId = dto.deviceId.trim();
      const existingDev = await tx.device.findUnique({
        where: { clientId_deviceId: { clientId: clientId!, deviceId: extDeviceId } },
      });
      if (existingDev && !existingDev.isActive) {
        throw new ForbiddenException({
          message: 'This device was deactivated for this client',
          code: 'LICENSE_DEVICE_REVOKED',
        });
      }

      const device = existingDev
        ? await tx.device.update({
            where: { id: existingDev.id },
            data: {
              subscriptionId: subscription.id,
              deviceName: dto.deviceName?.trim() || existingDev.deviceName,
              isActive: true,
              lastSeenAt: new Date(),
            },
          })
        : await tx.device.create({
            data: {
              clientId: clientId!,
              subscriptionId: subscription.id,
              deviceId: extDeviceId,
              deviceName: dto.deviceName?.trim() || null,
              lastSeenAt: new Date(),
              isActive: true,
            },
          });

      const nextUses = code.usedCount + 1;
      await tx.activationCode.update({
        where: { id: code.id },
        data: {
          usedCount: { increment: 1 },
          ...(nextUses >= code.maxUses ? { status: ActivationCodeStatus.USED } : {}),
        },
      });

      const lexpMs = licenseLockUnixMs(subscription.expiresAt, subscription.graceDays);
      const lexp = Math.floor(lexpMs / 1000);
      const licenseToken = this.tokens.signToken({
        sub: device.id,
        cid: clientId!,
        lid: subscription.id,
        plan: code.plan.code,
        lexp,
      });

      return { licenseToken, subscription, planCode: code.plan.code, device, clientId: clientId! };
    });

    await this.audit.log({
      userId: null,
      clientId: result.clientId,
      action: 'license.activate',
      entity: 'Subscription',
      entityId: result.subscription.id,
      newValue: {
        clientId: result.clientId,
        deviceId: result.device.deviceId,
        plan: result.planCode,
      },
    });

    return {
      licenseToken: result.licenseToken,
      publicKeyPem: this.getPublicKeyPem(),
      clientId: result.clientId,
      licenseId: result.subscription.id,
      deviceId: result.device.deviceId,
      plan: result.planCode,
      expiresAt: result.subscription.expiresAt?.toISOString() ?? null,
      graceDays: result.subscription.graceDays,
      maxBranches: result.subscription.maxBranches,
      maxDevices: result.subscription.maxDevices,
      lexp: Math.floor(licenseLockUnixMs(result.subscription.expiresAt, result.subscription.graceDays) / 1000),
    };
  }

  async ping(userId: string, licenseToken: string) {
    if (this.validation.isBypassed()) {
      return {
        ok: true,
        bypass: true,
        serverTime: new Date().toISOString(),
      };
    }
    const claims = await this.validation.assertValidForRequest(licenseToken);
    await this.prisma.device.update({
      where: { id: claims.sub },
      data: { lastSeenAt: new Date() },
    });
    const lic = await this.prisma.subscription.findUnique({
      where: { id: claims.lid },
      include: { plan: true },
    });
    if (!lic) {
      throw new NotFoundException({ message: 'License not found', code: 'LICENSE_NOT_FOUND' });
    }
    const lockAfterMs = licenseLockUnixMs(lic.expiresAt, lic.graceDays);
    const nowMs = Date.now();
    const inGrace = lic.expiresAt != null && nowMs > lic.expiresAt.getTime() && nowMs <= lockAfterMs;
    return {
      ok: true,
      bypass: false,
      serverTime: new Date().toISOString(),
      plan: lic.plan.code,
      status: lic.status,
      expiresAt: lic.expiresAt?.toISOString() ?? null,
      graceDays: lic.graceDays,
      lockAfter: new Date(lockAfterMs).toISOString(),
      maxUsers: lic.maxUsers,
      maxBranches: lic.maxBranches,
      maxDevices: lic.maxDevices,
      lexp: Math.floor(lockAfterMs / 1000),
      warning: inGrace,
    };
  }

  async refresh(userId: string, licenseToken: string) {
    if (this.validation.isBypassed()) {
      throw new BadRequestException({ message: 'Refresh not needed while BYPASS_LICENSE is true', code: 'LICENSE_BYPASS' });
    }
    const claims = await this.validation.assertValidForRequest(licenseToken);
    const lic = await this.prisma.subscription.findUnique({
      where: { id: claims.lid },
      include: { plan: true },
    });
    if (!lic) {
      throw new NotFoundException({ message: 'License not found', code: 'LICENSE_NOT_FOUND' });
    }
    const lexpMs = licenseLockUnixMs(lic.expiresAt, lic.graceDays);
    const lexp = Math.floor(lexpMs / 1000);
    const licenseTokenNew = this.tokens.signToken({
      sub: claims.sub,
      cid: claims.cid,
      lid: claims.lid,
      plan: lic.plan.code,
      lexp,
    });
    await this.audit.log({
      userId,
      clientId: null,
      action: 'license.refresh',
      entity: 'Subscription',
      entityId: lic.id,
      newValue: { deviceId: claims.sub },
    });
    return {
      licenseToken: licenseTokenNew,
      publicKeyPem: this.getPublicKeyPem(),
      lexp,
      expiresAt: lic.expiresAt?.toISOString() ?? null,
      graceDays: lic.graceDays,
    };
  }

  async assertBranchCapacity(licenseId: string | undefined | null): Promise<void> {
    if (this.validation.isBypassed() || !licenseId || licenseId === 'bypass') {
      return;
    }
    const lic = await this.prisma.subscription.findUnique({
      where: { id: licenseId },
      select: { clientId: true, status: true, maxBranches: true, expiresAt: true, graceDays: true },
    });
    if (!lic || lic.status === SubscriptionStatus.SUSPENDED || lic.status === SubscriptionStatus.CANCELLED) {
      throw new ForbiddenException({ message: 'No active license', code: 'LICENSE_REQUIRED' });
    }
    const lockMs = licenseLockUnixMs(lic.expiresAt, lic.graceDays);
    if (Date.now() > lockMs) {
      throw new ForbiddenException({ message: 'No active license', code: 'LICENSE_REQUIRED' });
    }
    const n = await this.prisma.branch.count({ where: { clientId: lic.clientId } });
    if (n >= lic.maxBranches) {
      throw new ForbiddenException({
        message: `Branch limit reached (${lic.maxBranches}) for your license`,
        code: 'LICENSE_BRANCH_LIMIT',
      });
    }
  }

  private buildSurfaceBase(
    status: LicenseSurfaceStatus,
    allowsPosAccess: boolean,
    warning: boolean,
    plan: LicensePlan | null,
    expiresAt: Date | null,
    sub: { maxUsers: number; maxBranches: number; maxDevices: number; graceDays: number } | null,
    planFeatures: unknown,
  ): LicenseSurfacePayload {
    const now = Date.now();
    const expMs = expiresAt?.getTime() ?? null;
    const daysRemaining =
      expMs === null ? null : roundDays(expMs - now);
    let graceRemaining = 0;
    if (expiresAt && sub) {
      const lockMs = licenseLockUnixMs(expiresAt, sub.graceDays);
      if (now > expiresAt.getTime() && now <= lockMs) {
        graceRemaining = roundDays(lockMs - now);
      }
    }
    return {
      status,
      allowsPosAccess,
      warning,
      plan,
      expiresAt: expiresAt?.toISOString() ?? null,
      daysRemaining,
      graceRemaining,
      maxUsers: sub?.maxUsers ?? 0,
      maxBranches: sub?.maxBranches ?? 0,
      maxDevices: sub?.maxDevices ?? 0,
      enabledFeatures: parseEnabledFeatures(planFeatures),
    };
  }

  private async evaluateLicenseSurface(token: string): Promise<LicenseSurfacePayload> {
    if (this.validation.isBypassed()) {
      return this.buildSurfaceBase('BYPASS', true, false, LicensePlan.ENTERPRISE, new Date(Date.now() + DAY_MS * 365), {
        maxUsers: 999,
        maxBranches: 999,
        maxDevices: 999,
        graceDays: 7,
      }, {});
    }

    let claims: LicenseJwtClaims;
    try {
      claims = this.tokens.verifyToken(token);
    } catch {
      return this.buildSurfaceBase('INVALID_TOKEN', false, false, null, null, null, null);
    }

    const device = await this.prisma.device.findUnique({
      where: { id: claims.sub },
      include: {
        subscription: { include: { plan: true } },
        client: true,
      },
    });
    if (!device || !device.isActive) {
      return this.buildSurfaceBase('NOT_REGISTERED', false, false, null, null, null, null);
    }
    if (device.subscriptionId !== claims.lid || device.clientId !== claims.cid) {
      return this.buildSurfaceBase('TOKEN_MISMATCH', false, false, null, null, null, null);
    }

    const sub = device.subscription;
    const plan = sub.plan;
    const expiresAt = sub.expiresAt;
    const lockMs = licenseLockUnixMs(expiresAt, sub.graceDays);
    const now = Date.now();

    if (device.client.status !== ClientStatus.ACTIVE) {
      return this.buildSurfaceBase(
        'CLIENT_INACTIVE',
        false,
        false,
        plan.code,
        expiresAt,
        sub,
        plan.features,
      );
    }
    if (sub.status === SubscriptionStatus.SUSPENDED) {
      return this.buildSurfaceBase('SUSPENDED', false, false, plan.code, expiresAt, sub, plan.features);
    }
    if (sub.status === SubscriptionStatus.CANCELLED) {
      return this.buildSurfaceBase('LOCKED', false, false, plan.code, expiresAt, sub, plan.features);
    }

    if (now > lockMs) {
      return this.buildSurfaceBase('LOCKED', false, false, plan.code, expiresAt, sub, plan.features);
    }

    const pastExpiry = expiresAt != null && now > expiresAt.getTime();
    const inGrace = pastExpiry && now <= lockMs;
    if (inGrace) {
      return this.buildSurfaceBase('GRACE', true, true, plan.code, expiresAt, sub, plan.features);
    }

    return this.buildSurfaceBase('ACTIVE', true, false, plan.code, expiresAt, sub, plan.features);
  }

  async getLicenseStatus(tokenRaw: string): Promise<LicenseSurfacePayload> {
    if (this.validation.isBypassed()) {
      return this.evaluateLicenseSurface('');
    }
    const token = (tokenRaw ?? '').trim();
    if (!token) {
      throw new UnauthorizedException({ message: 'Missing X-License-Token', code: 'LICENSE_TOKEN_MISSING' });
    }
    return this.evaluateLicenseSurface(token);
  }

  async checkLicense(tokenRaw: string): Promise<LicenseSurfacePayload> {
    const token = (tokenRaw ?? '').trim();
    const result = await this.evaluateLicenseSurface(token);
    if (!result.allowsPosAccess && result.status !== 'BYPASS') {
      await this.audit.log({
        userId: null,
        clientId: null,
        action: 'license.check.failed',
        entity: 'Subscription',
        entityId: null,
        newValue: { status: result.status },
      });
    }
    return result;
  }
}
