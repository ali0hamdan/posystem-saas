import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { FeatureGuard } from '../fnb/feature/feature.guard';
import { RequireFeature } from '../fnb/feature/require-feature.decorator';
import { QuotationsService } from './quotations.service';
import {
  ConvertQuotationToInvoiceDto,
  CreateQuotationDto,
  ListQuotationsQueryDto,
  SetQuotationStatusDto,
  UpdateQuotationDto,
} from './dto/quotation.dto';

@Controller('quotations')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
@RequireFeature('quotations')
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Get()
  list(
    @Query() query: ListQuotationsQueryDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.list(user.clientId, branchId, query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.get(id, user.clientId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.create(dto, user, branchId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetQuotationStatusDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Post(':id/accept')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.accept(id, user);
  }

  @Post(':id/reject')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.reject(id, user);
  }

  @Post(':id/convert-to-proforma')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  convertToProforma(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.convertToProforma(id, user);
  }

  @Post(':id/convert-to-invoice')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  convertToInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertQuotationToInvoiceDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.convertToInvoice(id, dto, user, branchId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.cancel(id, user);
  }
}
