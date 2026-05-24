import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SaasAdminRole } from '@prisma/client';
import { SaasAuthGuard } from './guards/saas-auth.guard';
import { SaasRoleGuard } from './guards/saas-role.guard';
import { CurrentSaaSAdmin } from './decorators/current-saas-admin.decorator';
import { SaasRoles } from './decorators/saas-roles.decorator';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';
import { SaasClientsService } from './saas-clients.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

@Controller('saas/audit-logs')
@UseGuards(SaasAuthGuard, SaasRoleGuard)
export class SaasAuditLogsController {
  constructor(private readonly clients: SaasClientsService) {}

  @Get()
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT)
  list(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Query() query: ListAuditLogsQueryDto) {
    return this.clients.listAuditLogs(admin, query);
  }
}
