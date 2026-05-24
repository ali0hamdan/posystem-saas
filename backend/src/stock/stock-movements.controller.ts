import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { AuditLogService } from '../audit/audit-log.service';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements.query.dto';
import { ListByProductQueryDto } from './dto/list-by-product.query.dto';
import { BranchScopeService } from '../branch/branch-scope.service';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class StockMovementsController {
  constructor(
    private readonly stockService: StockService,
    private readonly audit: AuditLogService,
    private readonly branchScope: BranchScopeService,
  ) {}

  @Get('product/:productId')
  async findByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ListByProductQueryDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    return this.stockService.findByProduct(user.clientId, branchId, productId, query);
  }

  @Get()
  async findAll(
    @Query() query: ListStockMovementsQueryDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    return this.stockService.findAll(user.clientId, { ...query, branchId });
  }

  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  async adjust(
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    const { product, movement } = await this.stockService.adjustStock({
      clientId: user.clientId,
      branchId,
      productId: dto.productId,
      quantityChange: dto.quantityChange,
      type: dto.type,
      reason: dto.reason,
      createdById: user.id,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      allowNegativeStock: dto.allowNegativeStock ?? false,
    });

    await this.audit.log({
      userId: user.id,
      action: 'stock.adjust',
      entity: 'StockMovement',
      entityId: movement.id,
      newValue: {
        productId: dto.productId,
        quantityChange: dto.quantityChange,
        type: dto.type,
        previousQuantity: movement.previousQuantity,
        newQuantity: movement.newQuantity,
      },
    });

    return { product, movement };
  }
}
