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
import { ProformaInvoicesService } from './proforma-invoices.service';
import {
  ConvertProformaToInvoiceDto,
  CreateProformaDto,
  ListProformaQueryDto,
  SetProformaStatusDto,
  UpdateProformaDto,
} from './dto/proforma.dto';

@Controller('proforma-invoices')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
@RequireFeature('proforma_invoices')
export class ProformaInvoicesController {
  constructor(private readonly service: ProformaInvoicesService) {}

  @Get()
  list(
    @Query() query: ListProformaQueryDto,
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
    @Body() dto: CreateProformaDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.create(dto, user, branchId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProformaDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetProformaStatusDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.setStatus(id, dto.status, user);
  }

  @Post(':id/approve')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/cancel')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.cancel(id, user);
  }

  @Post(':id/reserve-stock')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  reserveStock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.reserveStock(id, user);
  }

  @Post(':id/release-reservation')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  releaseReservation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.releaseReservation(id, user);
  }

  @Post(':id/convert-to-invoice')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  convertToInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertProformaToInvoiceDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.convertToInvoice(id, dto, user, branchId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.cancel(id, user);
  }
}
