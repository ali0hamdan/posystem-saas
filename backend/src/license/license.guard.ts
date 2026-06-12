import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { LicenseValidationService } from './license-validation.service';
import type { LicenseRequestContext } from './license-context.decorator';

const PUBLIC_PREFIXES = [
  '/health',
  '/auth',
  '/saas',
  '/public',
  '/license/activate',
  '/license/public-key',
  '/license/status',
  '/license/check',
  '/activation',
  '/desktop',
];

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private readonly validation: LicenseValidationService) {}

  private isPublicPath(path: string): boolean {
    const p = path.split('?')[0];
    return PUBLIC_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { licenseContext?: LicenseRequestContext }>();
    const path = (req.path || req.url?.split('?')[0] || '').split('?')[0];
    if (this.isPublicPath(path)) {
      return true;
    }
    if (this.validation.isBypassed()) {
      return true;
    }

    const raw = req.headers['x-license-token'];
    const headerVal = Array.isArray(raw) ? raw[0] : raw;
    const token = (headerVal ?? '').trim();
    if (!token) {
      throw new UnauthorizedException({ message: 'Missing X-License-Token', code: 'LICENSE_TOKEN_MISSING' });
    }

    const claims = await this.validation.assertValidForRequest(token);
    req.licenseContext = {
      licenseId: claims.lid,
      clientId: claims.cid,
      deviceRowId: claims.sub,
    };
    return true;
  }
}
