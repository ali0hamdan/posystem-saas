/**
 * Renewal-path safety tests for the SaaS admin console.
 *
 * Covers all four bugs from the post-audit punch list:
 *   - LIFETIME renewals are refused with SUBSCRIPTION_LIFETIME_NOT_RENEWABLE
 *     in both renewal paths (SaasClientsService + LicenseAdminService).
 *   - LIFETIME rows are left untouched (status + expiresAt unchanged).
 *   - ACTIVE / EXPIRED renewals succeed and the expiry math is right.
 *   - currentPeriodStart / currentPeriodEnd are written alongside expiresAt.
 *   - extendDays is bounded by the DTO (verified by class-validator).
 *   - Device deactivation writes an audit log entry.
 */

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-pw'),
}));

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  SaasAdminRole,
  SubscriptionStatus,
} from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RenewClientSubscriptionDto } from '../saas/dto/renew-client-subscription.dto';
import { RenewLicenseDto } from '../license/dto/renew-license.dto';
import { SaasClientsService } from '../saas/saas-clients.service';
import { LicenseAdminService } from '../license/license-admin.service';

const SUPER: { id: string; email: string; name: string; role: SaasAdminRole } = {
  id: 'admin-1',
  email: 'super@example.com',
  name: 'Super',
  role: SaasAdminRole.SUPER_ADMIN,
};

const BILLING: typeof SUPER = { ...SUPER, id: 'admin-billing', role: SaasAdminRole.BILLING };

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(({ where, data }) => ({
        id: where.id,
        ...data,
        status: data.status ?? SubscriptionStatus.ACTIVE,
      })),
    },
    device: {
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(({ where, data }) => ({
        id: where.id,
        deviceId: 'dev-ext',
        isActive: data.isActive,
        clientId: 'client-1',
        subscriptionId: 'sub-1',
      })),
    },
    plan: { findUnique: jest.fn() },
    ...overrides,
  };
}

function makeAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

// ===========================================================================
// SaasClientsService.renewClientSubscription
// ===========================================================================

describe('SaasClientsService.renewClientSubscription — LIFETIME guard', () => {
  it('refuses to renew a LIFETIME subscription with SUBSCRIPTION_LIFETIME_NOT_RENEWABLE', async () => {
    const prisma = makePrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      clientId: 'client-1',
      status: SubscriptionStatus.LIFETIME,
      expiresAt: null,
      planId: 'plan-1',
      plan: { id: 'plan-1', code: 'RETAIL_DESKTOP_LIFETIME' },
    });
    const audit = makeAudit();
    const svc = new SaasClientsService(prisma as never, audit as never);

    await expect(
      svc.renewClientSubscription(BILLING, 'client-1', { extendDays: 365 } as RenewClientSubscriptionDto),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SUBSCRIPTION_LIFETIME_NOT_RENEWABLE' }),
    });

    // LIFETIME row must not be touched.
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    // No success audit emitted for a refused renewal.
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects renewal when the subscription is SUSPENDED', async () => {
    const prisma = makePrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-2',
      clientId: 'client-1',
      status: SubscriptionStatus.SUSPENDED,
      expiresAt: new Date('2027-01-01'),
      planId: 'plan-1',
      plan: { id: 'plan-1', code: 'PRO' },
    });
    const svc = new SaasClientsService(prisma as never, makeAudit() as never);
    await expect(
      svc.renewClientSubscription(BILLING, 'client-1', { extendDays: 30 } as RenewClientSubscriptionDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renews an ACTIVE subscription forward from its expiry and writes period fields', async () => {
    const prisma = makePrisma();
    const futureExpiry = new Date('2027-06-01T00:00:00.000Z');
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-3',
      clientId: 'client-1',
      status: SubscriptionStatus.ACTIVE,
      expiresAt: futureExpiry,
      planId: 'plan-pro',
      plan: { id: 'plan-pro', code: 'PRO' },
    });
    const audit = makeAudit();
    const svc = new SaasClientsService(prisma as never, audit as never);

    await svc.renewClientSubscription(BILLING, 'client-1', {
      extendDays: 30,
    } as RenewClientSubscriptionDto);

    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
    const data = prisma.subscription.update.mock.calls[0][0].data;
    const expected = new Date(futureExpiry.getTime() + 30 * 86_400_000);
    expect(data.status).toBe(SubscriptionStatus.ACTIVE);
    expect((data.expiresAt as Date).toISOString()).toBe(expected.toISOString());
    expect((data.currentPeriodEnd as Date).toISOString()).toBe(expected.toISOString());
    expect(data.currentPeriodStart).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'saas.subscription.renew',
      entity: 'Subscription',
    });
  });

  it('renews an EXPIRED subscription forward from "now" (not from the stale expiry)', async () => {
    const prisma = makePrisma();
    const pastExpiry = new Date(Date.now() - 30 * 86_400_000);
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-4',
      clientId: 'client-1',
      status: SubscriptionStatus.EXPIRED,
      expiresAt: pastExpiry,
      planId: 'plan-pro',
      plan: { id: 'plan-pro', code: 'PRO' },
    });
    const svc = new SaasClientsService(prisma as never, makeAudit() as never);

    const before = Date.now();
    await svc.renewClientSubscription(BILLING, 'client-1', {
      extendDays: 7,
    } as RenewClientSubscriptionDto);

    const data = prisma.subscription.update.mock.calls[0][0].data;
    const newExpiry = (data.expiresAt as Date).getTime();
    // 7 days after a time >= before
    expect(newExpiry - before).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(data.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('rejects renewal when caller is SUPPORT (assertBillingOrSuper)', async () => {
    const prisma = makePrisma();
    const svc = new SaasClientsService(prisma as never, makeAudit() as never);
    await expect(
      svc.renewClientSubscription(
        { ...SUPER, role: SaasAdminRole.SUPPORT },
        'client-1',
        { extendDays: 30 } as RenewClientSubscriptionDto,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ===========================================================================
// LicenseAdminService.renewSubscription (cross-tenant)
// ===========================================================================

describe('LicenseAdminService.renewSubscription — LIFETIME guard', () => {
  it('refuses to renew a LIFETIME subscription', async () => {
    const prisma = makePrisma();
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-life',
      planId: 'plan-life',
      status: SubscriptionStatus.LIFETIME,
      expiresAt: null,
    });
    const audit = makeAudit();
    const svc = new LicenseAdminService(prisma as never, audit as never);

    await expect(
      svc.renewSubscription('sub-life', { extendDays: 365 } as RenewLicenseDto, 'admin-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SUBSCRIPTION_LIFETIME_NOT_RENEWABLE' }),
    });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown subscription id', async () => {
    const prisma = makePrisma();
    prisma.subscription.findUnique.mockResolvedValue(null);
    const svc = new LicenseAdminService(prisma as never, makeAudit() as never);
    await expect(
      svc.renewSubscription('missing', { extendDays: 30 } as RenewLicenseDto, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes currentPeriodStart + currentPeriodEnd alongside expiresAt for ACTIVE renewals', async () => {
    const prisma = makePrisma();
    const futureExpiry = new Date('2027-04-01T00:00:00.000Z');
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-7',
      planId: 'plan-pro',
      status: SubscriptionStatus.ACTIVE,
      expiresAt: futureExpiry,
    });
    const audit = makeAudit();
    const svc = new LicenseAdminService(prisma as never, audit as never);

    await svc.renewSubscription('sub-7', { extendDays: 30 } as RenewLicenseDto, 'admin-1');

    const data = prisma.subscription.update.mock.calls[0][0].data;
    const expected = new Date(futureExpiry.getTime() + 30 * 86_400_000);
    expect((data.expiresAt as Date).toISOString()).toBe(expected.toISOString());
    expect((data.currentPeriodEnd as Date).toISOString()).toBe(expected.toISOString());
    expect(data.currentPeriodStart).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'saas.subscription.renew',
      entity: 'Subscription',
    });
  });
});

// ===========================================================================
// LicenseAdminService.deactivateDevice — Bug 3
// ===========================================================================

describe('LicenseAdminService.deactivateDevice', () => {
  it('writes a saas.device.deactivate audit entry with old + new value', async () => {
    const prisma = makePrisma();
    prisma.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      deviceId: 'fingerprint-abcd',
      isActive: true,
      clientId: 'client-9',
      subscriptionId: 'sub-9',
    });
    const audit = makeAudit();
    const svc = new LicenseAdminService(prisma as never, audit as never);

    await svc.deactivateDevice('dev-1', 'admin-7');

    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'dev-1' },
      data: { isActive: false },
    });
    expect(audit.log).toHaveBeenCalledTimes(1);
    const payload = audit.log.mock.calls[0][0];
    expect(payload).toMatchObject({
      action: 'saas.device.deactivate',
      entity: 'Device',
      entityId: 'dev-1',
    });
    expect(payload.oldValue).toMatchObject({ isActive: true, deviceId: 'fingerprint-abcd' });
    expect(payload.newValue).toMatchObject({ isActive: false, saasAdminId: 'admin-7' });
  });
});

// ===========================================================================
// RenewClientSubscriptionDto / RenewLicenseDto — extendDays validation
// ===========================================================================

describe('extendDays validation', () => {
  async function validateExtend(klass: new () => { extendDays: number }, value: unknown) {
    const dto = plainToInstance(klass, { extendDays: value });
    return validate(dto);
  }

  it('RenewClientSubscriptionDto rejects extendDays = 0', async () => {
    const errs = await validateExtend(RenewClientSubscriptionDto, 0);
    expect(errs.some((e) => Object.keys(e.constraints ?? {}).includes('min'))).toBe(true);
  });

  it('RenewClientSubscriptionDto rejects negative extendDays', async () => {
    const errs = await validateExtend(RenewClientSubscriptionDto, -5);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('RenewClientSubscriptionDto accepts extendDays = 30', async () => {
    const errs = await validateExtend(RenewClientSubscriptionDto, 30);
    expect(errs).toHaveLength(0);
  });

  it('RenewLicenseDto rejects extendDays = 0', async () => {
    const errs = await validateExtend(RenewLicenseDto, 0);
    expect(errs.some((e) => Object.keys(e.constraints ?? {}).includes('min'))).toBe(true);
  });
});
