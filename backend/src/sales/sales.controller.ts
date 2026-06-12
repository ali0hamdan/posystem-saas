import {
  Body,
  Controller,
  Get,
  Headers,
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
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ListSalesQueryDto } from './dto/list-sales.query.dto';
import { BranchScopeService } from '../branch/branch-scope.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly branchScope: BranchScopeService,
  ) {}

  @Post()
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
    UserRole.SALESMAN,
    UserRole.GENERAL_MANAGER,
    UserRole.CO_MANAGER,
  )
  async create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    return this.salesService.create(dto, user, branchId, user.clientId);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findAll(
    @Query() query: ListSalesQueryDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    return this.salesService.findAll(user, query, branchId);
  }

  @Get('invoice/:invoiceNumber')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findByInvoice(
    @Param('invoiceNumber') invoiceNumber: string,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    return this.salesService.findByInvoiceNumber(invoiceNumber, user, branchId);
  }

  @Get('filters/users')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  listUsersForSaleFilter(@CurrentUser() user: SafeUser) {
    return this.salesService.listUsersForSaleFilter(user.clientId);
  }

  @Post(':id/refund')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.salesService.createRefund(id, dto, user);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);
    return this.salesService.findOne(id, user, branchId);
  }
}
