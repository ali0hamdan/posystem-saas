import {
  Body,
  Controller,
  Get,
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
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PERMISSIONS } from '../permissions/permission.types';
import { RefundService } from './refund.service';
import { RefundPrintService } from './refund-print.service';
import {
  CreateUnifiedRefundDto,
  ListRefundsQueryDto,
  PreviewRefundDto,
} from './dto/refund.dto';
import { RefundSourceType } from '@prisma/client';

@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundController {
  constructor(
    private readonly refunds: RefundService,
    private readonly refundPrint: RefundPrintService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  list(@Query() query: ListRefundsQueryDto, @CurrentUser() user: SafeUser) {
    return this.refunds.findAll(user.clientId, query);
  }

  @Get('refundable/:sourceType/:sourceId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  getRefundable(
    @Param('sourceType') sourceType: RefundSourceType,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.refunds.getRefundableTransaction(user.clientId, sourceType, sourceId);
  }

  @Get(':id/print-data')
  @RequirePermission(PERMISSIONS.REFUNDS_PRINT)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  printData(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.refundPrint.getPrintData(user.clientId, id);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.refunds.findOne(user.clientId, id);
  }

  @Post('preview')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  preview(@Body() dto: PreviewRefundDto, @CurrentUser() user: SafeUser) {
    return this.refunds.previewRefund(user.clientId, dto);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER)
  create(@Body() dto: CreateUnifiedRefundDto, @CurrentUser() user: SafeUser) {
    return this.refunds.completeRefund(user.clientId, user, dto);
  }
}
