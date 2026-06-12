import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { SalesCommissionService } from '../commissions/sales-commission.service';
import { UpdateCommissionSettingsDto } from '../commissions/dto/update-commission-settings.dto';
import { SalesmanIdService } from './salesman-id.service';
import { ApprovalIdService } from './approval-id.service';
import { LookupSalesmanQueryDto, SearchSalesmenQueryDto } from './dto/lookup-salesman.query.dto';
import { NfcCardService } from './nfc-card.service';
import { RegisterNfcCardDto, SetApprovalPinDto, SetNfcEnabledDto } from './dto/nfc-card.dto';
import { LookupApprovalQueryDto } from './dto/lookup-approval.query.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly commissions: SalesCommissionService,
    private readonly salesmanId: SalesmanIdService,
    private readonly approvalId: ApprovalIdService,
    private readonly nfcCard: NfcCardService,
  ) {}

  @Get('approval-lookup')
  lookupApproval(@Query() query: LookupApprovalQueryDto, @CurrentUser() user: SafeUser) {
    return this.approvalId.lookupApprovalId(user.clientId, query.code);
  }

  @Get('salesmen/lookup')
  lookupSalesman(@Query() query: LookupSalesmanQueryDto, @CurrentUser() user: SafeUser) {
    return this.salesmanId.lookupActiveSalesman(user.clientId, query.code);
  }

  @Get('salesmen')
  searchSalesmen(@Query() query: SearchSalesmenQueryDto, @CurrentUser() user: SafeUser) {
    return this.salesmanId.searchActiveSalesmen(user.clientId, query.search);
  }

  @Get()
  findAll(@Query() query: ListUsersQueryDto, @CurrentUser() user: SafeUser) {
    return this.usersService.findAll(user, query);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: SafeUser) {
    return this.usersService.create(user, dto);
  }

  @Patch(':id/password')
  updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPasswordDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.usersService.setPassword(user, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.usersService.setStatus(user, id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.usersService.update(user, id, dto);
  }

  @Patch(':id/regenerate-approval-id')
  regenerateApprovalId(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.approvalId.regenerateApprovalId(user, id);
  }

  @Patch(':id/nfc/register')
  registerNfcCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterNfcCardDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.nfcCard.registerNfcCard(user, id, dto.nfcCardUid);
  }

  @Patch(':id/nfc/remove')
  removeNfcCard(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.nfcCard.removeNfcCard(user, id);
  }

  @Patch(':id/nfc/enabled')
  setNfcEnabled(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetNfcEnabledDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.nfcCard.setNfcEnabled(user, id, dto.nfcEnabled);
  }

  @Patch(':id/approval-pin')
  setApprovalPin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetApprovalPinDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.nfcCard.setApprovalPin(user, id, dto.pin);
  }

  @Patch(':id/regenerate-salesman-id')
  regenerateSalesmanId(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.salesmanId.regenerateSalesmanId(user, id);
  }

  @Patch(':id/commission-settings')
  updateCommissionSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionSettingsDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.commissions.updateCommissionSettings(user, id, dto);
  }
}
