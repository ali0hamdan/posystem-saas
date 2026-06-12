import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { FnbMenuService } from './menu.service';
import { CreateModifierGroupDto, ListModifierGroupsQueryDto, UpdateModifierGroupDto } from './dto/modifier-group.dto';

@Controller('fnb/modifier-groups')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('fnb_module')
export class ModifierGroupsController {
  constructor(private readonly service: FnbMenuService) {}

  @Get()
  list(@Query() query: ListModifierGroupsQueryDto, @CurrentUser() user: SafeUser) {
    return this.service.listGroups(user.clientId, query);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateModifierGroupDto, @CurrentUser() user: SafeUser) {
    return this.service.createGroup(dto, user.id, user.clientId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateModifierGroupDto, @CurrentUser() user: SafeUser) {
    return this.service.updateGroup(id, dto, user.id, user.clientId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.removeGroup(id, user.id, user.clientId);
  }
}
