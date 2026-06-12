jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BillingCycle, BusinessType, LicensePlan, PlanType, SubscriptionStatus } from '@prisma/client';
import { PlanLimitService } from '../common/services/plan-limit.service';
import { PublicService } from '../public/public.service';

// ---------------------------------------------------------------------------
// PlanLimitService — null limits mean unlimited (Desktop Lifetime plans)
// ---------------------------------------------------------------------------

function makeLimitService(sub: unknown, counts: { users?: number; branches?: number; devices?: number } = {}) {
  const prisma = {
    subscription: { findFirst: jest.fn().mockResolvedValue(sub) },
    user: { count: jest.fn().mockResolvedValue(counts.users ?? 0) },
    branch: { count: jest.fn().mockResolvedValue(counts.branches ?? 0) },
    device: { count: jest.fn().mockResolvedValue(counts.devices ?? 0) },
  };
  return new PlanLimitService(prisma as never);
}

describe('PlanLimitService (Desktop Lifetime unlimited)', () => {
  const unlimitedSub = {
    status: SubscriptionStatus.LIFETIME,
    maxUsers: null,
    maxBranches: null,
    maxDevices: null,
    plan: { maxUsers: null, maxBranches: null, maxDevices: null },
  };

  it('does not block user creation when maxUsers is null', async () => {
    const svc = makeLimitService(unlimitedSub, { users: 5000 });
    await expect(svc.assertCanCreateUser('client-1')).resolves.toBeUndefined();
  });

  it('does not block branch creation when maxBranches is null', async () => {
    const svc = makeLimitService(unlimitedSub, { branches: 500 });
    await expect(svc.assertCanCreateBranch('client-1')).resolves.toBeUndefined();
  });

  it('does not block device registration when maxDevices is null', async () => {
    const svc = makeLimitService(unlimitedSub, { devices: 500 });
    await expect(svc.assertCanRegisterDevice('client-1')).resolves.toBeUndefined();
  });

  it('still enforces numeric limits for normal subscription plans', async () => {
    const limitedSub = {
      status: SubscriptionStatus.ACTIVE,
      maxUsers: 2,
      maxBranches: 1,
      maxDevices: 1,
      plan: { maxUsers: 2, maxBranches: 1, maxDevices: 1 },
    };
    const svc = makeLimitService(limitedSub, { users: 2, branches: 1, devices: 1 });
    await expect(svc.assertCanCreateUser('client-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.assertCanCreateBranch('client-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.assertCanRegisterDevice('client-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// PublicService.registerClient — Desktop Lifetime validation
// ---------------------------------------------------------------------------

function makePublicService(plan: unknown) {
  const prisma = {
    plan: { findUnique: jest.fn().mockResolvedValue(plan) },
    client: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const audit = { log: jest.fn() };
  const otp = { createOtp: jest.fn() };
  const notifications = {};
  return new PublicService(prisma as never, audit as never, otp as never, notifications as never);
}

const baseDto = {
  businessName: 'Test Store',
  ownerName: 'Owner',
  email: 'owner@test.com',
  password: 'password-123',
};

describe('PublicService.registerClient (Desktop Lifetime rules)', () => {
  it('rejects discontinued Hybrid Desktop Lifetime', async () => {
    const svc = makePublicService({
      code: LicensePlan.HYBRID_DESKTOP_LIFETIME,
      isActive: true,
      type: PlanType.ONE_TIME,
      businessType: BusinessType.HYBRID,
      oneTimePrice: '999.00',
    });
    await expect(
      svc.registerClient({
        ...baseDto,
        planCode: LicensePlan.HYBRID_DESKTOP_LIFETIME,
        billingCycle: BillingCycle.LIFETIME,
        businessType: BusinessType.HYBRID,
      } as never),
    ).rejects.toMatchObject({ response: { code: 'PLAN_DISCONTINUED' } });
  });

  it('rejects inactive plans (hybrid lifetime is seeded inactive)', async () => {
    const svc = makePublicService({
      code: LicensePlan.HYBRID_DESKTOP_LIFETIME,
      isActive: false,
    });
    await expect(
      svc.registerClient({
        ...baseDto,
        planCode: LicensePlan.HYBRID_DESKTOP_LIFETIME,
        billingCycle: BillingCycle.LIFETIME,
        businessType: BusinessType.HYBRID,
      } as never),
    ).rejects.toMatchObject({ response: { code: 'PLAN_NOT_FOUND' } });
  });

  it('rejects one-time plans bought with a non-LIFETIME cycle', async () => {
    const svc = makePublicService({
      code: LicensePlan.RETAIL_DESKTOP_LIFETIME,
      isActive: true,
      type: PlanType.ONE_TIME,
      businessType: BusinessType.RETAIL,
      monthlyPrice: '999.00',
      oneTimePrice: '999.00',
    });
    await expect(
      svc.registerClient({
        ...baseDto,
        planCode: LicensePlan.RETAIL_DESKTOP_LIFETIME,
        billingCycle: BillingCycle.MONTHLY,
        businessType: BusinessType.RETAIL,
      } as never),
    ).rejects.toMatchObject({ response: { code: 'PLAN_REQUIRES_LIFETIME_CYCLE' } });
  });

  it('rejects a Desktop Lifetime plan bought for the wrong business type', async () => {
    const svc = makePublicService({
      code: LicensePlan.RETAIL_DESKTOP_LIFETIME,
      isActive: true,
      type: PlanType.ONE_TIME,
      businessType: BusinessType.RETAIL,
      oneTimePrice: '999.00',
    });
    await expect(
      svc.registerClient({
        ...baseDto,
        planCode: LicensePlan.RETAIL_DESKTOP_LIFETIME,
        billingCycle: BillingCycle.LIFETIME,
        businessType: BusinessType.FOOD_BEVERAGE,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
