import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../../fnb/feature/feature.guard';
import { RequireFeature } from '../../fnb/feature/require-feature.decorator';
import { CustomerCreditService } from './customer-credit.service';
import { CustomerStatementQueryDto, UpsertCustomerCreditProfileDto } from './dto/customer-credit.dto';

@Controller('wholesale/customers')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
@RequireFeature('customer_credit', 'wholesale_module')
export class CustomerCreditController {
  constructor(private readonly service: CustomerCreditService) {}

  @Get('credit-profiles')
  listProfiles(@CurrentUser() user: SafeUser) {
    return this.service.listProfiles(user.clientId);
  }

  @Get(':customerId/credit-profile')
  getProfile(@Param('customerId', ParseUUIDPipe) customerId: string, @CurrentUser() user: SafeUser) {
    return this.service.getProfile(customerId, user.clientId);
  }

  @Put(':customerId/credit-profile')
  upsertProfile(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpsertCustomerCreditProfileDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.upsertProfile(customerId, dto, user);
  }

  @Get(':customerId/statement')
  statement(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: CustomerStatementQueryDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.statement(customerId, user.clientId, query);
  }
}
