import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../../fnb/feature/feature.guard';
import { RequireFeature } from '../../fnb/feature/require-feature.decorator';
import { WholesaleReportsService } from './wholesale-reports.service';
import { BranchScopeService } from '../../branch/branch-scope.service';

@Controller('wholesale/reports')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
@RequireFeature('wholesale_module')
export class WholesaleReportsController {
  constructor(
    private readonly service: WholesaleReportsService,
    private readonly branchScope: BranchScopeService,
  ) {}

  @Get('dashboard')
  async dashboard(@CurrentUser() user: SafeUser, @Headers('x-branch-id') branchHeader?: string) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, undefined);
    return this.service.dashboard(user, branchId);
  }
}
