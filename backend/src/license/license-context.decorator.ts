import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type LicenseRequestContext = {
  licenseId: string;
  clientId: string;
  deviceRowId: string;
};

export const LicenseContext = createParamDecorator((_: unknown, ctx: ExecutionContext): LicenseRequestContext | null => {
  const req = ctx.switchToHttp().getRequest<Request & { licenseContext?: LicenseRequestContext }>();
  return req.licenseContext ?? null;
});
