import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientStatus, LicensePlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseTokenService, type LicenseJwtClaims } from './license-token.service';

type CacheEntry = { ok: boolean; at: number };

@Injectable()
export class LicenseValidationService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: LicenseTokenService,
  ) {}

  isBypassed(): boolean {
    const bypass = this.config.get<boolean>('license.bypassLicense') ?? false;
    if (bypass && process.env.NODE_ENV === 'production') {
      throw new Error('BYPASS_LICENSE cannot be enabled in production');
    }
    return bypass;
  }

  private cacheTtl(): number {
    return this.config.get<number>('license.validationCacheTtlMs') ?? 10_000;
  }

  private cacheKey(token: string): string {
    return token.length > 64 ? token.slice(0, 64) : token;
  }

  async assertValidForRequest(licenseToken: string): Promise<LicenseJwtClaims> {
    if (this.isBypassed()) {
      return {
        sub: 'bypass',
        typ: 'pos-license',
        cid: 'bypass',
        lid: 'bypass',
        plan: LicensePlan.ENTERPRISE,
        lexp: Math.floor(Date.now() / 1000) + 86400 * 365,
      };
    }
    let claims: LicenseJwtClaims;
    try {
      claims = this.tokens.verifyToken(licenseToken);
    } catch {
      throw new UnauthorizedException({ message: 'Invalid license token', code: 'LICENSE_TOKEN_INVALID' });
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.lexp === 'number' && now > claims.lexp) {
      throw new UnauthorizedException({ message: 'License token expired', code: 'LICENSE_TOKEN_EXPIRED' });
    }

    const key = this.cacheKey(licenseToken);
    const ttl = this.cacheTtl();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ttl) {
      if (!hit.ok) {
        throw new UnauthorizedException({ message: 'License inactive', code: 'LICENSE_INACTIVE' });
      }
      return claims;
    }

    const device = await this.prisma.device.findUnique({
      where: { id: claims.sub },
      include: {
        subscription: { include: { plan: true } },
        client: true,
      },
    });
    if (!device || !device.isActive) {
      this.cache.set(key, { ok: false, at: Date.now() });
      throw new UnauthorizedException({ message: 'Device not registered', code: 'LICENSE_DEVICE_INACTIVE' });
    }
    if (device.subscriptionId !== claims.lid || device.clientId !== claims.cid) {
      this.cache.set(key, { ok: false, at: Date.now() });
      throw new UnauthorizedException({ message: 'License token mismatch', code: 'LICENSE_TOKEN_MISMATCH' });
    }
    if (device.client.status !== ClientStatus.ACTIVE) {
      this.cache.set(key, { ok: false, at: Date.now() });
      throw new UnauthorizedException({ message: 'Client suspended', code: 'LICENSE_CLIENT_SUSPENDED' });
    }
    const st = device.subscription.status;
    if (st === SubscriptionStatus.SUSPENDED || st === SubscriptionStatus.CANCELLED) {
      this.cache.set(key, { ok: false, at: Date.now() });
      throw new UnauthorizedException({ message: 'License not active', code: 'LICENSE_NOT_ACTIVE' });
    }
    const graceMs = device.subscription.graceDays * 86_400_000;
    const lockAfter = device.subscription.expiresAt != null
      ? device.subscription.expiresAt.getTime() + graceMs
      : new Date('2999-12-31T00:00:00Z').getTime();
    if (Date.now() > lockAfter) {
      this.cache.set(key, { ok: false, at: Date.now() });
      throw new UnauthorizedException({ message: 'License expired', code: 'LICENSE_EXPIRED' });
    }

    this.cache.set(key, { ok: true, at: Date.now() });
    return claims;
  }
}
