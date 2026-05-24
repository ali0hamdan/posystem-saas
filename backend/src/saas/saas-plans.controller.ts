import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { SaasAdminRole } from '@prisma/client';
import { SaasAuthGuard } from './guards/saas-auth.guard';
import { SaasRoleGuard } from './guards/saas-role.guard';
import { CurrentSaaSAdmin } from './decorators/current-saas-admin.decorator';
import { SaasRoles } from './decorators/saas-roles.decorator';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';
import { SaasPlansService } from './saas-plans.service';
import { CreateSaasPlanDto } from './dto/create-saas-plan.dto';
import { PatchSaasPlanDto } from './dto/patch-saas-plan.dto';

@Controller('saas/plans')
@UseGuards(SaasAuthGuard, SaasRoleGuard)
export class SaasPlansController {
  constructor(private readonly plans: SaasPlansService) {}

  @Get()
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
  list() {
    return this.plans.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  create(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Body() dto: CreateSaasPlanDto) {
    return this.plans.create(admin, dto);
  }

  @Patch(':id')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  patch(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchSaasPlanDto,
  ) {
    return this.plans.patch(admin, id, dto);
  }
}
