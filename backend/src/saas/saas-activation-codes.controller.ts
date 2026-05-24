import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { SaasAdminRole } from '@prisma/client';
import { SaasAuthGuard } from './guards/saas-auth.guard';
import { SaasRoleGuard } from './guards/saas-role.guard';
import { CurrentSaaSAdmin } from './decorators/current-saas-admin.decorator';
import { SaasRoles } from './decorators/saas-roles.decorator';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';
import { SaasClientsService } from './saas-clients.service';

@Controller('saas/activation-codes')
@UseGuards(SaasAuthGuard, SaasRoleGuard)
export class SaasActivationCodesController {
  constructor(private readonly clients: SaasClientsService) {}

  @Get()
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
  listAll(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Query() query: { page?: string; limit?: string; status?: string; clientId?: string; q?: string },
  ) {
    return this.clients.listAllActivationCodes(admin, {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      status: query.status,
      clientId: query.clientId,
      q: query.q,
    });
  }

  @Patch(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  revoke(@Param('id', ParseUUIDPipe) id: string, @CurrentSaaSAdmin() admin: SaasAdminSafe) {
    return this.clients.revokeActivationCode(admin, id);
  }
}
