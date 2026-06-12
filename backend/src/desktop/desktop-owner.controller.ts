import { Body, Controller, ForbiddenException, Get, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DesktopOwnerService, DesktopSetupResult } from './desktop-owner.service';
import { SetupDesktopOwnerDto } from './dto/setup-desktop-owner.dto';

/**
 * Exposes two routes for the desktop installer.
 *   - GET  /desktop/status      — cheap probe used by the renderer's gate
 *   - POST /auth/owner/setup    — provisions the local tenant + OWNER user
 *
 * Both routes refuse with 403 unless DESKTOP_MODE=true, so the hosted SaaS
 * deployment can never accidentally bootstrap a tenant through them.
 */
@Controller()
@SkipThrottle()
export class DesktopOwnerController {
  constructor(private readonly service: DesktopOwnerService) {}

  @Get('desktop/status')
  async status() {
    if (!this.service.isDesktopMode()) {
      throw new ForbiddenException({ code: 'NOT_DESKTOP_MODE' });
    }
    return this.service.getStatus();
  }

  @Post('auth/owner/setup')
  @HttpCode(200)
  async setupOwner(@Body() dto: SetupDesktopOwnerDto): Promise<{
    success: true;
    message: string;
    next: '/login';
    alreadyConfigured: boolean;
    result: DesktopSetupResult;
  }> {
    if (!this.service.isDesktopMode()) {
      throw new ForbiddenException({ code: 'NOT_DESKTOP_MODE' });
    }
    const result = await this.service.setup({
      clientId: dto.license.clientId,
      businessName: dto.license.businessName,
      businessType: dto.license.businessType,
      ownerEmail: dto.license.ownerEmail,
      ownerName: dto.license.ownerName,
      ownerPassword: dto.password,
      planCode: dto.license.planCode,
      lifetimeLicense: dto.license.lifetimeLicense,
      subscriptionExpiresAt: dto.license.subscriptionExpiresAt,
      defaultBranchName: dto.defaultBranchName,
    });
    return {
      success: true,
      message: result.message,
      next: '/login',
      alreadyConfigured: result.alreadyConfigured,
      result,
    };
  }
}
