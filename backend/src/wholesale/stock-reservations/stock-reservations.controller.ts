import { Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../../fnb/feature/feature.guard';
import { RequireFeature } from '../../fnb/feature/require-feature.decorator';
import { StockReservationsService } from './stock-reservations.service';
import { ListStockReservationsQueryDto } from './dto/stock-reservation.dto';

@Controller('wholesale/stock-reservations')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
@RequireFeature('stock_reservations', 'wholesale_module')
export class StockReservationsController {
  constructor(private readonly service: StockReservationsService) {}

  @Get()
  list(
    @Query() query: ListStockReservationsQueryDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.list(user.clientId, branchId, query);
  }

  @Post(':id/release')
  release(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.release(id, user);
  }
}
