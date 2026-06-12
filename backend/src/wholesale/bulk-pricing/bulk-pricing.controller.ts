import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../../fnb/feature/feature.guard';
import { RequireFeature } from '../../fnb/feature/require-feature.decorator';
import { BulkPricingService } from './bulk-pricing.service';
import {
  AddProductToPriceListDto,
  AssignCustomerDto,
  CreatePriceListDto,
  ListPriceListsQueryDto,
  PreviewPriceDto,
  UpdatePriceListDto,
  UpdateTierDto,
  UpsertProductTiersDto,
} from './dto/bulk-pricing.dto';

@Controller('wholesale/bulk-pricing')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
@RequireFeature('bulk_pricing', 'wholesale_module')
export class BulkPricingController {
  constructor(private readonly service: BulkPricingService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: SafeUser) {
    return this.service.dashboard(user.clientId);
  }

  @Post('preview')
  preview(@Body() dto: PreviewPriceDto, @CurrentUser() user: SafeUser) {
    return this.service.preview(user.clientId, dto);
  }

  @Get('price-lists')
  list(@Query() query: ListPriceListsQueryDto, @CurrentUser() user: SafeUser) {
    return this.service.list(user.clientId, query);
  }

  @Get('price-lists/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.get(id, user.clientId);
  }

  @Post('price-lists')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePriceListDto, @CurrentUser() user: SafeUser) {
    return this.service.create(dto, user);
  }

  @Patch('price-lists/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceListDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch('price-lists/:id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.setStatus(id, body.isActive, user);
  }

  @Delete('price-lists/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.remove(id, user);
  }

  @Post('price-lists/:id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.duplicate(id, user);
  }

  @Get('price-lists/:id/products')
  listProducts(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.listProducts(id, user.clientId);
  }

  @Post('price-lists/:id/products')
  addProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProductToPriceListDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.addProduct(id, dto, user);
  }

  @Put('price-lists/:id/products/:productId/tiers')
  upsertProductTiers(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpsertProductTiersDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.upsertProductTiers(id, productId, dto, user);
  }

  @Delete('price-lists/:id/products/:productId')
  removeProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.removeProduct(id, productId, user);
  }

  @Patch('tiers/:tierId')
  updateTier(
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() dto: UpdateTierDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.updateTier(tierId, dto, user);
  }

  @Delete('tiers/:tierId')
  deleteTier(@Param('tierId', ParseUUIDPipe) tierId: string, @CurrentUser() user: SafeUser) {
    return this.service.deleteTier(tierId, user);
  }

  @Get('price-lists/:id/customers')
  listCustomers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.listCustomers(id, user.clientId);
  }

  @Post('price-lists/:id/customers')
  assignCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCustomerDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.assignCustomer(id, dto, user);
  }

  @Delete('price-lists/:id/customers/:customerId')
  unassignCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.unassignCustomer(id, customerId, user);
  }
}
