import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { FnbReportsService } from './reports.service';

@Controller('fnb/reports')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('fnb_module')
export class FnbReportsController {
  constructor(private readonly service: FnbReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.dashboard(user.clientId, branchId);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  report(
    @CurrentUser() user: SafeUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.report(user.clientId, branchId, from, to);
  }
}
