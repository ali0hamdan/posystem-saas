import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LicensePlan } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { LicenseSigningNotConfiguredException } from './license-signing.exception';

export type LicenseJwtClaims = {
  sub: string;
  typ: 'pos-license';
  cid: string;
  lid: string;
  plan: LicensePlan;
  lexp: number;
};

@Injectable()
export class LicenseTokenService implements OnModuleInit {
  private readonly logger = new Logger(LicenseTokenService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const bypass = this.config.get<boolean>('license.bypassLicense') ?? false;
    if (bypass) {
      this.logger.warn('BYPASS_LICENSE is enabled — API license enforcement is disabled.');
      return;
    }
    if (this.hasSigningKeys()) {
      return;
    }
    const nodeEnv = this.config.get<string>('app.nodeEnv') ?? process.env.NODE_ENV ?? 'development';
    if (nodeEnv === 'production') {
      this.logger.error(
        'License RSA keys are required in production (LICENSE_RSA_PRIVATE_KEY_B64 / LICENSE_RSA_PUBLIC_KEY_B64).',
      );
    } else {
      this.logger.warn(
        'License RSA keys are missing — activation and license signing will fail until configured. Run: npm run license:keys',
      );
    }
  }

  private hasSigningKeys(): boolean {
    return Boolean(this.getPrivateKey() && this.getPublicKeyPem());
  }

  private getPrivateKey(): string {
    return this.config.get<string>('license.rsaPrivateKeyPem') ?? '';
  }

  getPublicKeyPem(): string {
    return this.config.get<string>('license.rsaPublicKeyPem') ?? '';
  }

  private assertSigningConfigured(): void {
    const priv = this.getPrivateKey();
    const pub = this.getPublicKeyPem();
    if (!priv && !pub) {
      throw new LicenseSigningNotConfiguredException('pair');
    }
    if (!priv) {
      throw new LicenseSigningNotConfiguredException('private');
    }
    if (!pub) {
      throw new LicenseSigningNotConfiguredException('public');
    }
  }

  signToken(claims: Omit<LicenseJwtClaims, 'typ'> & { lexp: number }): string {
    this.assertSigningConfigured();
    const priv = this.getPrivateKey();
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = Math.max(120, claims.lexp - nowSec);
    const payload = {
      sub: claims.sub,
      typ: 'pos-license' as const,
      cid: claims.cid,
      lid: claims.lid,
      plan: claims.plan,
      lexp: claims.lexp,
    };
    return jwt.sign(payload, priv, { algorithm: 'RS256', expiresIn: ttl });
  }

  verifyToken(token: string): LicenseJwtClaims {
    this.assertSigningConfigured();
    const pub = this.getPublicKeyPem();
    const decoded = jwt.verify(token, pub, { algorithms: ['RS256'] });
    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      throw new Error('Invalid license token payload');
    }
    const o = decoded as Record<string, unknown>;
    if (o.typ !== 'pos-license') {
      throw new Error('Invalid license token type');
    }
    return o as unknown as LicenseJwtClaims;
  }
}
