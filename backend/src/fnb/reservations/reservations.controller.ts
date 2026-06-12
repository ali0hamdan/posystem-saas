import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { FnbReservationsService } from './reservations.service';
import { CreateReservationDto, ListReservationsQueryDto, SetReservationStatusDto, UpdateReservationDto } from './dto/reservation.dto';

@Controller('fnb/reservations')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('reservations')
export class FnbReservationsController {
  constructor(private readonly service: FnbReservationsService) {}

  @Get()
  list(@Query() query: ListReservationsQueryDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.list(user.clientId, branchId, query);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.create(dto, user, branchId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReservationDto, @CurrentUser() user: SafeUser) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetReservationStatusDto, @CurrentUser() user: SafeUser) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.remove(id, user);
  }
}
