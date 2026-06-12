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
import { CreateDiningAreaDto, ListDiningAreasQueryDto, UpdateDiningAreaDto } from './dto/dining-area.dto';

@Controller('fnb/dining-areas')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('table_management')
export class DiningAreasController {
  constructor(private readonly service: FnbTablesService) {}

  @Get()
  list(
    @Query() query: ListDiningAreasQueryDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.listAreas(user.clientId, branchId, query);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(
    @Body() dto: CreateDiningAreaDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.createArea(dto, user.id, user.clientId, branchId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiningAreaDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.updateArea(id, dto, user.id, user.clientId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.removeArea(id, user.id, user.clientId);
  }
}
