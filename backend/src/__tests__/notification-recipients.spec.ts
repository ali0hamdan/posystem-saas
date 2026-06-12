/**
 * NotificationRecipientService unit tests: owner-configured recipient
 * resolution, role filtering, tenant isolation, and master switch.
 */
import { NotificationType, UserRole } from '@prisma/client';
import { NotificationRecipientService } from '../notifications/notification-recipient.service';

interface PrismaMock {
  storeSettings: { findUnique: jest.Mock };
  notificationPreference: { findUnique: jest.Mock };
  user: { findMany: jest.Mock };
}

function makePrisma(over: Partial<PrismaMock> = {}): PrismaMock {
  return {
    storeSettings: { findUnique: jest.fn().mockResolvedValue({ emailNotificationsEnabled: true }) },
    notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  };
}

function makeService(prisma: PrismaMock) {
  return new NotificationRecipientService(prisma as never);
}

const owner = { id: 'u1', email: 'owner@x.com', name: 'Owner', role: UserRole.OWNER };
const gm = { id: 'u2', email: 'gm@x.com', name: 'GM', role: UserRole.GENERAL_MANAGER };

describe('NotificationRecipientService.getRecipients', () => {
  it('returns empty list when master email switch is off', async () => {
    const prisma = makePrisma({
      storeSettings: { findUnique: jest.fn().mockResolvedValue({ emailNotificationsEnabled: false }) },
    });
    const service = makeService(prisma);
    const result = await service.getRecipients('c1', NotificationType.LOW_STOCK);
    expect(result).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('returns empty list when notification type is disabled', async () => {
    const prisma = makePrisma({
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue({
          enabled: false,
          sendToOwner: true,
          sendToGeneralManager: true,
          sendToCoManager: true,
          selectedUserIds: null,
        }),
      },
    });
    const service = makeService(prisma);
    const result = await service.getRecipients('c1', NotificationType.LOW_STOCK);
    expect(result).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('uses built-in defaults when no preference row exists (LOW_STOCK → owner+GM+co-manager)', async () => {
    const prisma = makePrisma({ user: { findMany: jest.fn().mockResolvedValue([owner, gm]) } });
    const service = makeService(prisma);
    const result = await service.getRecipients('c1', NotificationType.LOW_STOCK);

    expect(result).toHaveLength(2);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.clientId).toBe('c1');
    expect(where.isActive).toBe(true);
    expect(where.emailVerified).toBe(true);
    const roles = where.OR[0].role.in as UserRole[];
    expect(roles).toEqual(
      expect.arrayContaining([
        UserRole.OWNER,
        UserRole.GENERAL_MANAGER,
        UserRole.ADMIN,
        UserRole.CO_MANAGER,
        UserRole.MANAGER,
      ]),
    );
  });

  it('respects owner overrides (owner only)', async () => {
    const prisma = makePrisma({
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue({
          enabled: true,
          sendToOwner: true,
          sendToGeneralManager: false,
          sendToCoManager: false,
          selectedUserIds: null,
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([owner]) },
    });
    const service = makeService(prisma);
    await service.getRecipients('c1', NotificationType.LOW_STOCK);

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR[0].role.in).toEqual([UserRole.OWNER]);
  });

  it('returns empty list when no roles and no specific users are selected', async () => {
    const prisma = makePrisma({
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue({
          enabled: true,
          sendToOwner: false,
          sendToGeneralManager: false,
          sendToCoManager: false,
          selectedUserIds: [],
        }),
      },
    });
    const service = makeService(prisma);
    const result = await service.getRecipients('c1', NotificationType.LOW_STOCK);
    expect(result).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('includes explicitly selected user ids alongside role recipients', async () => {
    const prisma = makePrisma({
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue({
          enabled: true,
          sendToOwner: true,
          sendToGeneralManager: false,
          sendToCoManager: false,
          selectedUserIds: ['u9'],
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([owner]) },
    });
    const service = makeService(prisma);
    await service.getRecipients('c1', NotificationType.LOW_STOCK);

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { role: { in: [UserRole.OWNER] } },
      { id: { in: ['u9'] } },
    ]);
  });

  it('de-duplicates recipients sharing the same email', async () => {
    const prisma = makePrisma({
      user: {
        findMany: jest.fn().mockResolvedValue([owner, { ...gm, email: 'owner@x.com' }]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getRecipients('c1', NotificationType.LOW_STOCK);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('owner@x.com');
  });
});
