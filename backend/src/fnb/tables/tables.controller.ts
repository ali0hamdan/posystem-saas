import {
  Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { FnbTablesService } from './tables.service';
import {
  CreateTableDto, ListTablesQueryDto, UpdateTableDto, UpdateTableStatusDto,
} from './dto/table.dto';

@Controller('fnb/tables')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('table_management')
export class TablesController {
  constructor(private readonly service: FnbTablesService) {}

  @Get()
  list(
    @Query() query: ListTablesQueryDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.listTables(user.clientId, branchId, query);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(
    @Body() dto: CreateTableDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.createTable(dto, user.id, user.clientId, branchId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.updateTable(id, dto, user.id, user.clientId);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableStatusDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.setStatus(id, dto.status, user.id, user.clientId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.removeTable(id, user.id, user.clientId);
  }
}
