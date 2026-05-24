import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SaasAdminRole } from '@prisma/client';
import { LicenseAdminService } from '../license/license-admin.service';
import { SaasAuthGuard } from './guards/saas-auth.guard';
import { SaasRoleGuard } from './guards/saas-role.guard';
import { CurrentSaaSAdmin } from './decorators/current-saas-admin.decorator';
import { SaasRoles } from './decorators/saas-roles.decorator';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';
import { RenewLicenseDto } from '../license/dto/renew-license.dto';

/**
 * Cross-tenant SaaS operator API (subscriptions, devices).
 * Client-scoped activation codes live under `/saas/clients/:clientId/activation-codes`.
 */
@Controller('saas/license-admin')
@UseGuards(SaasAuthGuard, SaasRoleGuard)
@SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
export class SaasLicenseAdminController {
  constructor(private readonly admin: LicenseAdminService) {}

  @Get('subscriptions')
  listSubscriptions() {
    return this.admin.listSubscriptions();
  }

  @Patch('subscriptions/:id')
  renewSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewLicenseDto,
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
  ) {
    return this.admin.renewSubscription(id, dto, admin.id);
  }

  @Get('devices')
  listDevices() {
    return this.admin.listDevices();
  }

  @Post('devices/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivateDevice(@Param('id', ParseUUIDPipe) id: string, @CurrentSaaSAdmin() admin: SaasAdminSafe) {
    return this.admin.deactivateDevice(id, admin.id);
  }
}
