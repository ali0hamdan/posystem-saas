/**
 * DesktopOwnerService unit tests.
 *
 * The service runs only when APP_MODE=desktop. These tests exercise:
 *   - the desktop-mode gate
 *   - the HYBRID business-type rejection
 *   - the password policy
 *   - first-run provisioning (Plan + Client + Subscription + Branch +
 *     StoreSettings + Owner + UserBranch)
 *   - idempotent re-run that doesn't touch the password
 *   - repair mode that restores a missing Branch / StoreSettings /
 *     Subscription without touching the existing owner
 *   - tenant-mismatch refusal
 *
 * Prisma is fully mocked — no DB required.
 */

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-pw'),
}));

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BusinessType, SubscriptionStatus, UserRole } from '@prisma/client';
import { DesktopOwnerService } from '../desktop/desktop-owner.service';

type MockTx = {
  plan: { upsert: jest.Mock };
  client: { upsert: jest.Mock; findFirst: jest.Mock; findUniqueOrThrow: jest.Mock };
  subscription: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  branch: { upsert: jest.Mock; findFirst: jest.Mock };
  storeSettings: { upsert: jest.Mock; findUnique: jest.Mock };
  user: { upsert: jest.Mock; findFirst: jest.Mock };
  userBranch: { upsert: jest.Mock };
};

function makeTx(): MockTx {
  return {
    plan: {
      upsert: jest.fn().mockResolvedValue({ id: 'plan-1', code: 'RETAIL_DESKTOP_LIFETIME' }),
    },
    client: {
      upsert: jest.fn().mockImplementation(({ create, update, where }) => ({
        id: where.id,
        businessName: (create?.businessName ?? update?.businessName) as string,
        businessType: (create?.businessType ?? update?.businessType) as BusinessType,
      })),
      findFirst: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'client-1',
        businessName: 'Test Store',
        businessType: BusinessType.RETAIL,
      }),
    },
    subscription: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.LIFETIME,
        planId: 'plan-1',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.LIFETIME,
        planId: 'plan-1',
      }),
    },
    branch: {
      upsert: jest.fn().mockResolvedValue({ id: 'branch-1', name: 'Main Branch', code: 'HQ' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    storeSettings: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      upsert: jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'owner',
        email: 'owner@store.test',
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userBranch: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeService(opts: { desktop: boolean; tx?: MockTx } = { desktop: true }) {
  const tx = opts.tx ?? makeTx();

  const prisma = {
    client: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockImplementation(() => tx.client.findFirst()),
    },
    user: {
      findFirst: jest.fn().mockImplementation((args: unknown) => tx.user.findFirst(args)),
    },
    $transaction: jest.fn().mockImplementation(async (cb: (t: MockTx) => Promise<unknown>) => cb(tx)),
  };

  const config = {
    get: jest.fn((key: string) => (key === 'app.desktopMode' ? opts.desktop : undefined)),
  };

  const svc = new DesktopOwnerService(
    prisma as never,
    config as never,
  );
  return { svc, prisma, tx, config };
}

function payload(overrides: Partial<{
  clientId: string;
  businessName: string;
  businessType: BusinessType;
  ownerEmail: string;
  ownerPassword: string;
  lifetimeLicense: boolean;
}> = {}) {
  return {
    clientId: 'client-1',
    businessName: 'Test Store',
    businessType: BusinessType.RETAIL,
    ownerEmail: 'owner@store.test',
    ownerPassword: 'correcthorse',
    lifetimeLicense: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('DesktopOwnerService.setup — gating', () => {
  it('rejects when APP_MODE is not desktop', async () => {
    const { svc } = makeService({ desktop: false });
    await expect(svc.setup(payload())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects HYBRID business type', async () => {
    const { svc } = makeService();
    await expect(
      svc.setup(payload({ businessType: BusinessType.HYBRID })),
    ).rejects.toThrow(/Hybrid Desktop is not supported/);
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const { svc } = makeService();
    await expect(svc.setup(payload({ ownerPassword: 'short' }))).rejects.toThrow(
      /Owner password must be at least 8 characters/,
    );
  });
});

describe('DesktopOwnerService.setup — first run', () => {
  it('creates Plan + Client + Subscription + Branch + StoreSettings + Owner + UserBranch', async () => {
    const { svc, tx } = makeService();
    const result = await svc.setup(payload());

    expect(result.alreadyConfigured).toBe(false);
    expect(result.next).toBe('/login');
    expect(tx.plan.upsert).toHaveBeenCalledTimes(1);
    expect(tx.client.upsert).toHaveBeenCalledTimes(1);
    expect(tx.subscription.create).toHaveBeenCalledTimes(1);
    expect(tx.branch.upsert).toHaveBeenCalledTimes(1);
    expect(tx.storeSettings.upsert).toHaveBeenCalledTimes(1);
    expect(tx.user.upsert).toHaveBeenCalledTimes(1);
    expect(tx.userBranch.upsert).toHaveBeenCalledTimes(1);
  });

  it('hashes the password with bcrypt before persisting', async () => {
    const bcrypt = require('bcrypt');
    bcrypt.hash.mockClear();
    const { svc, tx } = makeService();
    await svc.setup(payload({ ownerPassword: 'correcthorse' }));
    expect(bcrypt.hash).toHaveBeenCalledWith('correcthorse', 12);
    const userArgs = tx.user.upsert.mock.calls[0][0];
    expect(userArgs.create.passwordHash).toBe('hashed-pw');
    // Plain password never reaches Prisma.
    expect(JSON.stringify(userArgs)).not.toContain('correcthorse');
  });

  it('creates a LIFETIME subscription when lifetimeLicense is true', async () => {
    const { svc, tx } = makeService();
    await svc.setup(payload({ lifetimeLicense: true }));
    const data = tx.subscription.create.mock.calls[0][0].data;
    expect(data.status).toBe(SubscriptionStatus.LIFETIME);
    expect(data.billingCycle).toBe('LIFETIME');
    expect(data.expiresAt).toBeNull();
  });

  it('creates the owner as OWNER role + email verified', async () => {
    const { svc, tx } = makeService();
    await svc.setup(payload());
    const data = tx.user.upsert.mock.calls[0][0].create;
    expect(data.role).toBe(UserRole.OWNER);
    expect(data.emailVerified).toBe(true);
    expect(data.isActive).toBe(true);
  });
});

describe('DesktopOwnerService.setup — idempotency', () => {
  it('returns alreadyConfigured=true when owner exists and does NOT re-hash the password', async () => {
    const bcrypt = require('bcrypt');
    bcrypt.hash.mockClear();
    const tx = makeTx();
    const { svc, prisma } = makeService({ desktop: true, tx });
    prisma.client.findFirst = jest.fn().mockResolvedValue({ id: 'client-1' });
    prisma.user.findFirst = jest.fn().mockResolvedValue({
      id: 'user-1',
      username: 'owner',
      email: 'owner@store.test',
    });
    // Repair pass: every required row already exists.
    tx.branch.findFirst = jest.fn().mockResolvedValue({ id: 'branch-1', name: 'Main Branch', code: 'HQ' });
    tx.storeSettings.findUnique = jest.fn().mockResolvedValue({ clientId: 'client-1' });
    tx.subscription.findFirst = jest.fn().mockResolvedValue({ id: 'sub-1' });

    const result = await svc.setup(payload());
    expect(result.alreadyConfigured).toBe(true);
    expect(result.next).toBe('/login');
    expect(tx.user.upsert).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('repairs a missing Branch and StoreSettings when owner already exists', async () => {
    const tx = makeTx();
    const { svc, prisma } = makeService({ desktop: true, tx });
    prisma.client.findFirst = jest.fn().mockResolvedValue({ id: 'client-1' });
    prisma.user.findFirst = jest.fn().mockResolvedValue({
      id: 'user-1',
      username: 'owner',
      email: 'owner@store.test',
    });
    tx.branch.findFirst = jest.fn().mockResolvedValue(null);
    tx.storeSettings.findUnique = jest.fn().mockResolvedValue(null);
    tx.subscription.findFirst = jest.fn().mockResolvedValue({ id: 'sub-1' });

    const result = await svc.setup(payload());
    expect(result.alreadyConfigured).toBe(true);
    if (result.alreadyConfigured) {
      expect(result.repaired.branch).toBe(true);
      expect(result.repaired.storeSettings).toBe(true);
      expect(result.repaired.subscription).toBe(false);
    }
    expect(tx.branch.upsert).toHaveBeenCalledTimes(1);
    expect(tx.storeSettings.upsert).toHaveBeenCalledTimes(1);
    expect(tx.subscription.create).not.toHaveBeenCalled();
    expect(tx.user.upsert).not.toHaveBeenCalled();
  });

  it('refuses with 409 ConflictException when an existing tenant has a different id', async () => {
    const tx = makeTx();
    const { svc, prisma } = makeService({ desktop: true, tx });
    prisma.client.findFirst = jest.fn().mockResolvedValue({ id: 'OTHER-tenant' });

    await expect(svc.setup(payload({ clientId: 'client-1' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.upsert).not.toHaveBeenCalled();
  });
});

describe('DesktopOwnerService.getStatus', () => {
  it('returns provisioned=false when there is no client', async () => {
    const { svc } = makeService();
    await expect(svc.getStatus()).resolves.toEqual({ provisioned: false, hasOwner: false });
  });

  it('returns provisioned=true with the owner when one exists', async () => {
    const { svc, prisma } = makeService();
    prisma.client.count = jest.fn().mockResolvedValue(1);
    prisma.user.findFirst = jest.fn().mockResolvedValue({
      id: 'user-1',
      username: 'owner',
      email: 'owner@store.test',
      clientId: 'client-1',
      client: { businessName: 'Test Store', businessType: BusinessType.RETAIL },
    });

    const status = await svc.getStatus();
    expect(status).toEqual({
      provisioned: true,
      hasOwner: true,
      owner: {
        username: 'owner',
        email: 'owner@store.test',
        clientId: 'client-1',
        businessName: 'Test Store',
        businessType: BusinessType.RETAIL,
      },
    });
  });
});

// Avoid an unused-import lint warning when ForbiddenException is referenced
// only by the controller spec; this file consumes it indirectly.
void ForbiddenException;
