import { ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type LimitKind = 'users' | 'branches' | 'devices';

const FALLBACK_LIMITS: Record<LimitKind, number> = {
  users: 5,
  branches: 1,
  devices: 3,
};

/**
 * Centralizes per-tenant plan-limit checks for users / branches / devices.
 * Always reads the most-recent subscription; falls back to conservative
 * defaults when no subscription exists (e.g. seeded demo client).
 */
@Injectable()
export class PlanLimitService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveLimits(clientId: string): Promise<{
    maxUsers: number | null;
    maxBranches: number | null;
    maxDevices: number | null;
    status: SubscriptionStatus | null;
  }> {
    const sub = await this.prisma.subscription.findFirst({
      where: { clientId },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        status: true,
        maxUsers: true,
        maxBranches: true,
        maxDevices: true,
        plan: { select: { maxUsers: true, maxBranches: true, maxDevices: true } },
      },
    });
    if (!sub) {
      return {
        maxUsers: FALLBACK_LIMITS.users,
        maxBranches: FALLBACK_LIMITS.branches,
        maxDevices: FALLBACK_LIMITS.devices,
        status: null,
      };
    }
    // Null means unlimited (Desktop Lifetime plans) — do NOT fall back.
    return {
      maxUsers: sub.maxUsers,
      maxBranches: sub.maxBranches,
      maxDevices: sub.maxDevices,
      status: sub.status,
    };
  }

  async assertCanCreateUser(clientId: string): Promise<void> {
    const [{ maxUsers }, current] = await Promise.all([
      this.resolveLimits(clientId),
      this.prisma.user.count({ where: { clientId } }),
    ]);
    if (maxUsers != null && current >= maxUsers) {
      throw new ForbiddenException({
        message: `Your plan allows up to ${maxUsers} user(s). Upgrade to add more.`,
        code: 'PLAN_LIMIT_USERS',
        current,
        max: maxUsers,
      });
    }
  }

  async assertCanCreateBranch(clientId: string): Promise<void> {
    const [{ maxBranches }, current] = await Promise.all([
      this.resolveLimits(clientId),
      this.prisma.branch.count({ where: { clientId } }),
    ]);
    if (maxBranches != null && current >= maxBranches) {
      throw new ForbiddenException({
        message: `Your plan allows up to ${maxBranches} branch(es). Upgrade to add more.`,
        code: 'PLAN_LIMIT_BRANCHES',
        current,
        max: maxBranches,
      });
    }
  }

  async assertCanRegisterDevice(clientId: string): Promise<void> {
    const [{ maxDevices }, current] = await Promise.all([
      this.resolveLimits(clientId),
      this.prisma.device.count({ where: { clientId, isActive: true } }),
    ]);
    if (maxDevices != null && current >= maxDevices) {
      throw new ForbiddenException({
        message: `Your plan allows up to ${maxDevices} active device(s). Deactivate one or upgrade.`,
        code: 'PLAN_LIMIT_DEVICES',
        current,
        max: maxDevices,
      });
    }
  }
}
