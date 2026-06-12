import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { SalesCommissionService } from './sales-commission.service';
import { ListCommissionsQueryDto } from './dto/list-commissions.query.dto';

@Controller('commissions')
@UseGuards(JwtAuthGuard)
export class CommissionsController {
  constructor(private readonly commissions: SalesCommissionService) {}

  @Get()
  findAll(@Query() query: ListCommissionsQueryDto, @CurrentUser() user: SafeUser) {
    return this.commissions.findAll(user, query);
  }

  @Get('summary')
  summary(@Query() query: ListCommissionsQueryDto, @CurrentUser() user: SafeUser) {
    return this.commissions.getSummary(user, query);
  }

  @Get('salesman/:salesmanId')
  findBySalesman(
    @Param('salesmanId', ParseUUIDPipe) salesmanId: string,
    @Query() query: ListCommissionsQueryDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.commissions.findBySalesman(user, salesmanId, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.commissions.findOne(user, id);
  }

  @Patch(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.commissions.approveCommission(user, id);
  }

  @Patch(':id/mark-paid')
  markPaid(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.commissions.markCommissionPaid(user, id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.commissions.cancelCommission(user, id);
  }
}
