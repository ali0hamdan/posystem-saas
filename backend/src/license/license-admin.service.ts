import { createHash, randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivationCodeStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateActivationCodeDto } from './dto/create-activation-code.dto';
import { RenewLicenseDto } from './dto/renew-license.dto';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

@Injectable()
export class LicenseAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  listSubscriptions() {
    return this.prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, businessName: true, email: true } },
        plan: { select: { id: true, code: true, name: true } },
      },
    });
  }

  listDevices() {
    return this.prisma.device.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, businessName: true } },
        subscription: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });
  }

  async createActivationCode(dto: CreateActivationCodeDto, saasAdminId: string) {
    if (dto.clientId) {
      const c = await this.prisma.client.findFirst({
        where: { id: dto.clientId, deletedAt: null },
      });
      if (!c) throw new NotFoundException({ message: 'Client not found', code: 'LICENSE_CLIENT_NOT_FOUND' });
    }
    const planRow = await this.prisma.plan.findUnique({ where: { code: dto.plan } });
    if (!planRow) {
      throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
    }
    const plain = `STK-${randomBytes(8).toString('hex').toUpperCase()}`;
    const lookupHash = sha256Hex(plain.toLowerCase());
    const validUntil = new Date(Date.now() + dto.validDays * 86_400_000);
    const row = await this.prisma.activationCode.create({
      data: {
        clientId: dto.clientId ?? null,
        planId: planRow.id,
        lookupHash,
        maxBranches: dto.maxBranches,
        maxDevices: dto.maxDevices,
        graceDays: dto.graceDays,
        termDays: dto.termDays,
        maxUses: dto.maxUses,
        validUntil,
        status: ActivationCodeStatus.UNUSED,
        label: dto.label?.trim() || null,
        createdByUserId: null,
        createdBySaaSAdminId: saasAdminId,
      },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.activation_code.create',
      entity: 'ActivationCode',
      entityId: row.id,
      newValue: { plan: dto.plan, label: row.label, saasAdminId },
    });
    return { id: row.id, activationCode: plain, validUntil: row.validUntil.toISOString() };
  }

  async renewSubscription(id: string, dto: RenewLicenseDto, saasAdminId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException({ message: 'Subscription not found', code: 'SUBSCRIPTION_NOT_FOUND' });

    // Desktop Lifetime customers paid a one-time fee — there is no period to
    // renew. Refuse here so a SaaS admin cannot accidentally downgrade a
    // LIFETIME row to ACTIVE-with-expiry.
    if (sub.status === SubscriptionStatus.LIFETIME) {
      throw new BadRequestException({
        message: 'Lifetime subscriptions do not need renewal.',
        code: 'SUBSCRIPTION_LIFETIME_NOT_RENEWABLE',
      });
    }

    // Renew forward from whichever is later: the current expiry or "now".
    // For a subscription that already expired, this restarts the clock today.
    const base = Math.max(sub.expiresAt?.getTime() ?? Date.now(), Date.now());
    const nextExpires = new Date(base + dto.extendDays * 86_400_000);
    const periodStart = new Date();

    let planId = sub.planId;
    if (dto.plan !== undefined) {
      const p = await this.prisma.plan.findUnique({ where: { code: dto.plan } });
      if (!p) throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
      planId = p.id;
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        expiresAt: nextExpires,
        currentPeriodStart: periodStart,
        currentPeriodEnd: nextExpires,
        planId,
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.subscription.renew',
      entity: 'Subscription',
      entityId: id,
      oldValue: { expiresAt: sub.expiresAt?.toISOString() ?? null, planId: sub.planId, status: sub.status },
      newValue: {
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        planId: updated.planId,
        status: updated.status,
        saasAdminId,
      },
    });
    return updated;
  }

  async deactivateDevice(id: string, saasAdminId: string) {
    const dev = await this.prisma.device.findUnique({ where: { id } });
    if (!dev) throw new NotFoundException({ message: 'Device not found', code: 'LICENSE_DEVICE_NOT_FOUND' });
    const updated = await this.prisma.device.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.device.deactivate',
      entity: 'Device',
      entityId: id,
      oldValue: { isActive: dev.isActive, deviceId: dev.deviceId },
      newValue: { isActive: updated.isActive, saasAdminId },
    });
    return updated;
  }
}
