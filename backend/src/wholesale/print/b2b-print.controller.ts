import { Controller, Get, Headers, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../../fnb/feature/feature.guard';
import { RequireFeature } from '../../fnb/feature/require-feature.decorator';
import { BranchScopeService } from '../../branch/branch-scope.service';
import { B2bPrintService } from './b2b-print.service';

@Controller('wholesale')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
export class B2bPrintController {
  constructor(
    private readonly printService: B2bPrintService,
    private readonly branchScope: BranchScopeService,
  ) {}

  @Get('quotations/:id/print-data')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @RequireFeature('quotations', 'wholesale_module')
  quotationPrintData(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.printService.quotationPrintData(id, user.clientId);
  }

  @Get('proforma-invoices/:id/print-data')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @RequireFeature('proforma_invoices', 'wholesale_module')
  proformaPrintData(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.printService.proformaPrintData(id, user.clientId);
  }

  @Get('invoices/:id/print-data')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @RequireFeature('wholesale_module')
  async invoicePrintData(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    return this.printService.invoicePrintData(id, user, branchId);
  }
}
