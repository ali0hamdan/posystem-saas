import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RefundSourceType, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { FnbOrdersService } from './orders.service';
import { RefundService } from '../../refunds/refund.service';
import { CreateUnifiedRefundDto } from '../../refunds/dto/refund.dto';
import { AddOrderItemDto, ListOrdersQueryDto, OpenOrderDto, SettleOrderDto, UpdateDeliveryDto, UpdateOrderItemDto } from './dto/order.dto';

@Controller('fnb/orders')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
@RequireFeature('fnb_module')
export class FnbOrdersController {
  constructor(
    private readonly service: FnbOrdersService,
    private readonly refunds: RefundService,
  ) {}

  @Get()
  list(@Query() query: ListOrdersQueryDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.list(user.clientId, branchId, query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.get(id, user.clientId);
  }

  @Post()
  open(@Body() dto: OpenOrderDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.open(dto, user, branchId);
  }

  @Post(':id/items')
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddOrderItemDto, @CurrentUser() user: SafeUser) {
    return this.service.addItem(id, dto, user);
  }

  @Patch(':id/items/:itemId')
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateOrderItemDto, @CurrentUser() user: SafeUser) {
    return this.service.updateItem(id, itemId, dto.quantity, user);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @CurrentUser() user: SafeUser) {
    return this.service.removeItem(id, itemId, user);
  }

  @Patch(':id/delivery')
  updateDelivery(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeliveryDto, @CurrentUser() user: SafeUser) {
    return this.service.updateDelivery(id, dto, user);
  }

  @Post(':id/send')
  send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.sendToKitchen(id, user);
  }

  @Post(':id/settle')
  settle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SettleOrderDto, @CurrentUser() user: SafeUser) {
    return this.service.settle(id, dto, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.cancel(id, user);
  }

  @Post(':id/refund')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUnifiedRefundDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.refunds.completeRefund(user.clientId, user, {
      ...dto,
      sourceType: RefundSourceType.FNB_ORDER,
      sourceId: id,
    });
  }
}
