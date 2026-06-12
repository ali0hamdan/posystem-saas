import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { FnbRecipesService } from './recipes.service';
import { UpsertRecipeDto } from './dto/recipe.dto';

@Controller('fnb/recipes')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('recipe_inventory')
export class FnbRecipesController {
  constructor(private readonly service: FnbRecipesService) {}

  @Get()
  list(@CurrentUser() user: SafeUser) {
    return this.service.list(user.clientId);
  }

  @Get(':menuItemId')
  get(@Param('menuItemId', ParseUUIDPipe) menuItemId: string, @CurrentUser() user: SafeUser) {
    return this.service.getForMenuItem(menuItemId, user.clientId);
  }

  @Put(':menuItemId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  upsert(@Param('menuItemId', ParseUUIDPipe) menuItemId: string, @Body() dto: UpsertRecipeDto, @CurrentUser() user: SafeUser) {
    return this.service.upsert(menuItemId, dto, user);
  }

  @Delete(':menuItemId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('menuItemId', ParseUUIDPipe) menuItemId: string, @CurrentUser() user: SafeUser) {
    return this.service.remove(menuItemId, user);
  }
}
