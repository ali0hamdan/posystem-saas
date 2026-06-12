import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto, ListDeliveryQueryDto, UpdateDeliveryDto } from './dto/delivery.dto';

@Controller('fnb/delivery')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.DELIVERY_DRIVER)
@RequireFeature('delivery_management')
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get()
  list(@Query() query: ListDeliveryQueryDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.list(user.clientId, branchId, query, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.get(id, user);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  create(@Body() dto: CreateDeliveryDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.create(dto, user, branchId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeliveryDto, @CurrentUser() user: SafeUser) {
    return this.service.update(id, dto, user);
  }
}
