import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessType, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_FEATURE_KEYS } from './fnb-features.constants';

/**
 * Resolves plan-level feature flags and business type for a tenant.
 *
 * Feature flags live on the client's active subscription `Plan.features` (Json).
 * When `BYPASS_LICENSE` is enabled (local/dev), every known F&B feature is
 * treated as enabled so the module is usable without a real subscription.
 */
@Injectable()
export class FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isBypassed(): boolean {
    return this.config.get<boolean>('license.bypassLicense') ?? false;
  }

  private parseFeatures(value: unknown): Record<string, boolean> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  /** All enabled feature flags for the tenant's current plan. */
  async getEnabledFeatures(clientId: string): Promise<Record<string, boolean>> {
    if (this.isBypassed()) {
      return Object.fromEntries(PLAN_FEATURE_KEYS.map((k) => [k, true]));
    }
    const active = await this.prisma.subscription.findFirst({
      where: {
        clientId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.LIFETIME] },
      },
      orderBy: { expiresAt: 'desc' },
      select: { plan: { select: { features: true } } },
    });
    const sub =
      active ??
      (await this.prisma.subscription.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        select: { plan: { select: { features: true } } },
      }));
    return this.parseFeatures(sub?.plan?.features);
  }

  /** True when the given feature flag is enabled for the tenant. */
  async hasFeature(clientId: string, feature: string): Promise<boolean> {
    if (this.isBypassed()) return true;
    const features = await this.getEnabledFeatures(clientId);
    return features[feature] === true;
  }

  /** Throws 403 FEATURE_NOT_ENABLED unless the feature is enabled for the tenant. */
  async assertFeature(clientId: string, feature: string): Promise<void> {
    const ok = await this.hasFeature(clientId, feature);
    if (!ok) {
      throw new ForbiddenException({
        message: `This feature (${feature}) is not enabled for your current plan`,
        code: 'FEATURE_NOT_ENABLED',
      });
    }
  }

  /** Tenant business vertical (defaults to RETAIL when unset). */
  async getBusinessType(clientId: string): Promise<BusinessType> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { businessType: true },
    });
    return client?.businessType ?? BusinessType.RETAIL;
  }
}
