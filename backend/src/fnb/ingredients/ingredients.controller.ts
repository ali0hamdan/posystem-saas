import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientMovementDto, ListIngredientMovementsQueryDto } from './dto/ingredient.dto';

@Controller('fnb/ingredients')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN)
@RequireFeature('recipe_inventory')
export class IngredientsController {
  constructor(private readonly service: IngredientsService) {}

  @Get('movements')
  list(@Query() query: ListIngredientMovementsQueryDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.listMovements(user.clientId, branchId, query);
  }

  @Post('movements')
  create(@Body() dto: CreateIngredientMovementDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.createMovement(dto, user, branchId);
  }

  @Get('stock-levels')
  stock(@CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.stockLevels(user.clientId, branchId);
  }
}
