import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../../fnb/feature/feature.guard';
import { RequireFeature } from '../../fnb/feature/require-feature.decorator';
import { PriceListsService } from './price-lists.service';
import {
  AssignCustomerPriceListDto,
  CreatePriceListDto,
  ResolvePriceQueryDto,
  UpdatePriceListDto,
  UpsertPriceListItemsDto,
} from './dto/price-list.dto';

@Controller('wholesale/price-lists')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
@RequireFeature('bulk_pricing', 'wholesale_module')
export class PriceListsController {
  constructor(private readonly service: PriceListsService) {}

  @Get()
  list(@CurrentUser() user: SafeUser) {
    return this.service.list(user.clientId);
  }

  @Get('resolve-price')
  resolvePrice(@Query() query: ResolvePriceQueryDto, @CurrentUser() user: SafeUser) {
    return this.service.resolvePrice(user.clientId, query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.get(id, user.clientId);
  }

  @Post()
  create(@Body() dto: CreatePriceListDto, @CurrentUser() user: SafeUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceListDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Put(':id/items')
  upsertItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPriceListItemsDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.upsertItems(id, dto, user);
  }

  @Post('assign-customer')
  assignCustomer(@Body() dto: AssignCustomerPriceListDto, @CurrentUser() user: SafeUser) {
    return this.service.assignCustomer(dto, user);
  }
}
