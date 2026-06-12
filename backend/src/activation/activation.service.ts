import { createHash } from 'crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ActivationCodeStatus,
  ClientStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LicenseTokenService } from '../license/license-token.service';
import { LicenseValidationService } from '../license/license-validation.service';
import { ACTIVATION_PUBLIC_FAILURE_BODY } from '../license/activation.constants';
import type { ActivateDeviceDto } from './dto/activate-device.dto';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

const NEVER_EXPIRES_MS = new Date('2999-12-31T00:00:00Z').getTime();
function licenseLockUnixMs(expiresAt: Date | null, graceDays: number): number {
  if (!expiresAt) return NEVER_EXPIRES_MS;
  return expiresAt.getTime() + graceDays * 86_400_000;
}

class ActivationRejected extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

@Injectable()
export class ActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly tokens: LicenseTokenService,
    private readonly validation: LicenseValidationService,
  ) {}

  getPublicKeyPem(): string {
    return this.tokens.getPublicKeyPem();
  }

  private async expireStaleActivationCodes(): Promise<void> {
    const now = new Date();
    await this.prisma.activationCode.updateMany({
      where: {
        status: ActivationCodeStatus.UNUSED,
        validUntil: { lt: now },
      },
      data: { status: ActivationCodeStatus.EXPIRED },
    });
  }

  private reject(reason: string): never {
    throw new ActivationRejected(reason);
  }

  async activateDevice(dto: ActivateDeviceDto) {
    if (this.validation.isBypassed()) {
      throw new BadRequestException({
        message: 'License activation is disabled while BYPASS_LICENSE is true',
        code: 'LICENSE_BYPASS_ACTIVE',
      });
    }

    await this.expireStaleActivationCodes();

    const normalized = dto.activationCode.trim().toLowerCase();
    const lookupHash = sha256Hex(normalized);
    let rejectReason: string | null = null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const code = await tx.activationCode.findUnique({
          where: { lookupHash },
          include: { plan: true, client: true },
        });
        if (!code) this.reject('code_not_found');
        if (!code.clientId) this.reject('code_not_client_bound');
        if (code.status === ActivationCodeStatus.REVOKED) this.reject('code_revoked');
        if (code.status === ActivationCodeStatus.USED) this.reject('code_used');
        if (code.status === ActivationCodeStatus.EXPIRED) this.reject('code_expired');
        if (code.status !== ActivationCodeStatus.UNUSED) this.reject('code_bad_status');
        if (code.validUntil.getTime() < Date.now()) this.reject('code_expired_time');
        if (code.usedCount >= code.maxUses) this.reject('code_depleted');
        if (!code.client) this.reject('client_missing');

        const client = code.client;
        if (client.deletedAt) this.reject('client_deleted');
        if (client.status !== ClientStatus.ACTIVE) this.reject('client_inactive');

        // Lifetime desktop purchases use SubscriptionStatus.LIFETIME — they are
        // just as activatable as ACTIVE subscriptions (device limit still applies).
        const subscription = await tx.subscription.findFirst({
          where: {
            clientId: code.clientId,
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.LIFETIME] },
          },
          orderBy: { expiresAt: 'desc' },
        });
        if (!subscription) this.reject('no_active_subscription');
        const lockMs = licenseLockUnixMs(subscription.expiresAt, subscription.graceDays);
        if (lockMs <= Date.now()) this.reject('subscription_expired');

        const extDeviceId = dto.deviceId.trim();
        const existingDev = await tx.device.findUnique({
          where: { clientId_deviceId: { clientId: code.clientId, deviceId: extDeviceId } },
        });
        if (existingDev?.isActive === false) this.reject('device_revoked');

        // maxDevices null = unlimited (Desktop Lifetime). Devices are still
        // created (audit/tracking) and remain bound to this client only.
        if (subscription.maxDevices != null) {
          const activeOthers = await tx.device.count({
            where: {
              clientId: code.clientId,
              isActive: true,
              ...(existingDev?.isActive ? { NOT: { id: existingDev.id } } : {}),
            },
          });
          if (!existingDev?.isActive && activeOthers >= subscription.maxDevices) {
            this.reject('device_limit');
          }
        }

        const device = existingDev
          ? await tx.device.update({
              where: { id: existingDev.id },
              data: {
                subscriptionId: subscription.id,
                deviceName: dto.deviceName.trim(),
                platform: dto.platform.trim(),
                isActive: true,
                lastSeenAt: new Date(),
              },
            })
          : await tx.device.create({
              data: {
                clientId: code.clientId,
                subscriptionId: subscription.id,
                deviceId: extDeviceId,
                deviceName: dto.deviceName.trim(),
                platform: dto.platform.trim(),
                lastSeenAt: new Date(),
                isActive: true,
              },
            });

        const nextUses = code.usedCount + 1;
        await tx.activationCode.update({
          where: { id: code.id },
          data: {
            usedCount: { increment: 1 },
            status: nextUses >= code.maxUses ? ActivationCodeStatus.USED : ActivationCodeStatus.UNUSED,
          },
        });

        const lexpMs = licenseLockUnixMs(subscription.expiresAt, subscription.graceDays);
        const lexp = Math.floor(lexpMs / 1000);
        const licenseToken = this.tokens.signToken({
          sub: device.id,
          cid: code.clientId,
          lid: subscription.id,
          plan: code.plan.code,
          lexp,
        });

        return {
          licenseToken,
          subscription,
          planCode: code.plan.code,
          device,
          client: {
            id: client.id,
            slug: client.slug,
            businessName: client.businessName,
            email: client.email,
          },
          lexp,
        };
      });

      await this.audit.log({
        userId: null,
        clientId: result.client.id,
        action: 'activation.device.success',
        entity: 'Device',
        entityId: result.device.id,
        newValue: {
          deviceId: result.device.deviceId,
          platform: dto.platform.trim(),
          subscriptionId: result.subscription.id,
        },
      });

      return {
        licenseToken: result.licenseToken,
        publicKeyPem: this.getPublicKeyPem(),
        client: result.client,
        subscriptionExpiresAt: result.subscription.expiresAt?.toISOString() ?? null,
        graceDays: result.subscription.graceDays,
        maxDevices: result.subscription.maxDevices,
        maxBranches: result.subscription.maxBranches,
        plan: result.planCode,
        lexp: result.lexp,
      };
    } catch (e) {
      if (e instanceof ActivationRejected) {
        rejectReason = e.reason;
      } else {
        throw e;
      }
    }

    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'activation.device.failed',
      entity: 'ActivationCode',
      entityId: null,
      newValue: { reason: rejectReason ?? 'unknown' },
    });

    throw new UnauthorizedException(ACTIVATION_PUBLIC_FAILURE_BODY);
  }
}
