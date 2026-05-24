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
  Query,
  UseGuards,
} from '@nestjs/common';
import { SaasAdminRole } from '@prisma/client';
import { SaasAuthGuard } from './guards/saas-auth.guard';
import { SaasRoleGuard } from './guards/saas-role.guard';
import { CurrentSaaSAdmin } from './decorators/current-saas-admin.decorator';
import { SaasRoles } from './decorators/saas-roles.decorator';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';
import { SaasClientsService } from './saas-clients.service';
import { ListSaasClientsQueryDto } from './dto/list-saas-clients.query.dto';
import { CreateSaasClientDto } from './dto/create-saas-client.dto';
import { PatchSaasClientDto } from './dto/patch-saas-client.dto';
import { PatchSaasClientStatusDto } from './dto/patch-saas-client-status.dto';
import { ListClientActivationCodesQueryDto } from './dto/list-client-activation-codes.query.dto';
import { CreateClientActivationCodeDto } from './dto/create-client-activation-code.dto';
import { RenewClientSubscriptionDto } from './dto/renew-client-subscription.dto';
import { ChangeClientPlanDto } from './dto/change-client-plan.dto';
import { ListClientUsersQueryDto } from './dto/list-client-users.query.dto';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import { PatchClientUserDto } from './dto/patch-client-user.dto';
import { PatchClientUserPasswordDto } from './dto/patch-client-user-password.dto';
import { PatchClientUserStatusDto } from './dto/patch-client-user-status.dto';

@Controller('saas/clients')
@UseGuards(SaasAuthGuard, SaasRoleGuard)
export class SaasClientsController {
  constructor(private readonly clients: SaasClientsService) {}

  @Get()
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
  list(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Query() query: ListSaasClientsQueryDto) {
    return this.clients.list(admin, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  create(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Body() dto: CreateSaasClientDto) {
    return this.clients.create(admin, dto);
  }

  @Get(':clientId/activation-codes')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
  listActivationCodes(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: ListClientActivationCodesQueryDto,
  ) {
    return this.clients.listActivationCodes(admin, clientId, query);
  }

  @Post(':clientId/activation-codes')
  @HttpCode(HttpStatus.CREATED)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.BILLING)
  createActivationCode(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateClientActivationCodeDto,
  ) {
    return this.clients.createActivationCodeForClient(admin, clientId, dto);
  }

  @Get(':clientId/users')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT)
  listUsers(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: ListClientUsersQueryDto,
  ) {
    return this.clients.listClientUsers(admin, clientId, query);
  }

  @Post(':clientId/users')
  @HttpCode(HttpStatus.CREATED)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  createUser(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateClientUserDto,
  ) {
    return this.clients.createClientUser(admin, clientId, dto);
  }

  @Patch(':clientId/users/:userId')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  patchUser(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: PatchClientUserDto,
  ) {
    return this.clients.patchClientUser(admin, clientId, userId, dto);
  }

  @Patch(':clientId/users/:userId/password')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT)
  patchUserPassword(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: PatchClientUserPasswordDto,
  ) {
    return this.clients.patchClientUserPassword(admin, clientId, userId, dto);
  }

  @Patch(':clientId/users/:userId/status')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  patchUserStatus(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: PatchClientUserStatusDto,
  ) {
    return this.clients.patchClientUserStatus(admin, clientId, userId, dto);
  }

  @Delete(':clientId/users/:userId')
  @HttpCode(HttpStatus.OK)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  deleteUser(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.clients.deleteClientUser(admin, clientId, userId);
  }

  @Get(':clientId/payment-records')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.BILLING)
  listPaymentRecords(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.clients.listClientPaymentRecords(admin, clientId);
  }

  @Get(':clientId/subscription')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
  getSubscription(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.clients.getClientSubscription(admin, clientId);
  }

  @Post(':clientId/renew')
  @HttpCode(HttpStatus.OK)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.BILLING)
  renewSubscription(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: RenewClientSubscriptionDto,
  ) {
    return this.clients.renewClientSubscription(admin, clientId, dto);
  }

  @Post(':clientId/change-plan')
  @HttpCode(HttpStatus.OK)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.BILLING)
  changePlan(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: ChangeClientPlanDto,
  ) {
    return this.clients.changeClientPlan(admin, clientId, dto);
  }

  @Post(':clientId/suspend')
  @HttpCode(HttpStatus.OK)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.BILLING)
  suspendSubscription(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.clients.suspendClientSubscription(admin, clientId);
  }

  @Post(':clientId/reactivate')
  @HttpCode(HttpStatus.OK)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.BILLING)
  reactivateSubscription(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.clients.reactivateClientSubscription(admin, clientId);
  }

  @Get(':id')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
  findOne(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.findOne(admin, id);
  }

  @Patch(':id/status')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.BILLING)
  patchStatus(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchSaasClientStatusDto,
  ) {
    return this.clients.updateStatus(admin, id, dto);
  }

  @Patch(':id')
  @SaasRoles(SaasAdminRole.SUPER_ADMIN, SaasAdminRole.SUPPORT, SaasAdminRole.BILLING)
  patch(
    @CurrentSaaSAdmin() admin: SaasAdminSafe,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchSaasClientDto,
  ) {
    return this.clients.update(admin, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @SaasRoles(SaasAdminRole.SUPER_ADMIN)
  remove(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.softDelete(admin, id);
  }
}
