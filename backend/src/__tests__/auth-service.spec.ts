/**
 * AuthService unit tests.
 *
 * The native `bcrypt` module is mocked so its compiled binding never loads and
 * password comparison is deterministic. Covers login failure paths, the
 * account-lockout threshold, and the successful-login token issuance.
 */

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcrypt';
import { AuthService } from '../auth/auth.service';

const compareMock = compare as unknown as jest.Mock;

function fullUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'owner',
    name: 'Owner',
    email: 'owner@store.test',
    role: 'OWNER',
    clientId: 'client-1',
    branchId: null,
    isActive: true,
    emailVerified: true,
    passwordHash: 'stored-hash',
    loginAttempts: 0,
    lockedUntil: null,
    refreshTokenHash: null,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(userResult: unknown) {
  const prisma = {
    client: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'client-1',
        businessName: 'Test Store',
        businessType: 'RETAIL',
        status: 'ACTIVE',
      }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(userResult),
      findMany: jest.fn().mockResolvedValue(userResult ? [userResult] : []),
      findUnique: jest.fn().mockResolvedValue(userResult),
      update: jest.fn().mockResolvedValue(userResult),
    },
    subscription: {
      findFirst: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        expiresAt: null,
        plan: { code: 'STARTER', name: 'Starter' },
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
  const config = { get: jest.fn(), getOrThrow: jest.fn() };
  const branchScope = { listBranchesForUser: jest.fn().mockResolvedValue([]) };
  const otp = { createOtp: jest.fn(), verifyOtp: jest.fn(), invalidateAllForEmail: jest.fn() };
  const email = { sendPasswordChangedConfirmation: jest.fn() };
  const notifications = { notifyPasswordReset: jest.fn().mockResolvedValue(undefined) };
  const permissions = {
    getPermissionsForRole: jest.fn().mockReturnValue(['dashboard:view']),
  };
  const salesmanId = { ensureSalesmanHasCode: jest.fn().mockResolvedValue(null) };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    branchScope as never,
    otp as never,
    email as never,
    notifications as never,
    permissions as never,
    salesmanId as never,
  );
  return { service, prisma, jwt, branchScope };
}

const req = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as never;

beforeEach(() => compareMock.mockReset());

describe('AuthService.login', () => {
  it('rejects an unknown user with UnauthorizedException', async () => {
    const { service } = makeService(null);
    await expect(
      service.login({ email: 'ghost@test.com', password: 'x' } as never, req),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a locked account with ForbiddenException', async () => {
    const locked = fullUser({ lockedUntil: new Date(Date.now() + 10 * 60_000) });
    const { service } = makeService(locked);
    await expect(
      service.login({ email: 'owner@store.test', password: 'x' } as never, req),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a wrong password (below lockout threshold) with UnauthorizedException', async () => {
    const user = fullUser({ loginAttempts: 0 });
    const { service } = makeService(user);
    compareMock.mockResolvedValue(false);
    await expect(
      service.login({ email: 'owner@store.test', password: 'wrong' } as never, req),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('locks the account on the 5th failed attempt', async () => {
    const user = fullUser({ loginAttempts: 4 });
    const { service, prisma } = makeService(user);
    compareMock.mockResolvedValue(false);
    await expect(
      service.login({ email: 'owner@store.test', password: 'wrong' } as never, req),
    ).rejects.toThrow(ForbiddenException);
    // the update that records the lock should set a lockedUntil
    const lockUpdate = prisma.user.update.mock.calls.find(
      ([arg]: [{ data?: Record<string, unknown> }]) => arg?.data && 'lockedUntil' in arg.data,
    );
    expect(lockUpdate).toBeDefined();
  });

  it('issues tokens on a successful login', async () => {
    const user = fullUser();
    const { service, jwt } = makeService(user);
    compareMock.mockResolvedValue(true);
    const result = await service.login({ email: 'owner@store.test', password: 'right' } as never, req);
    expect(result.accessToken).toBe('jwt-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({ id: 'user-1', username: 'owner' });
    expect(jwt.signAsync).toHaveBeenCalled();
  });

  it('disambiguates by clientSlug — unknown store is rejected', async () => {
    const { service, prisma } = makeService(fullUser());
    prisma.client.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.login({ email: 'owner@store.test', password: 'x', clientSlug: 'nope' } as never, req),
    ).rejects.toThrow(UnauthorizedException);
  });
});
