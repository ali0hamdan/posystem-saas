import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../../fnb/feature/feature.guard';
import { RequireFeature } from '../../fnb/feature/require-feature.decorator';
import { DeliveryNotesService } from './delivery-notes.service';
import {
  CreateDeliveryNoteDto,
  ListDeliveryNotesQueryDto,
  MarkDeliveredDto,
  UpdateDeliveryNoteDto,
} from './dto/delivery-note.dto';

@Controller('wholesale/delivery-notes')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
@RequireFeature('delivery_notes', 'wholesale_module')
export class DeliveryNotesController {
  constructor(private readonly service: DeliveryNotesService) {}

  @Get()
  list(
    @Query() query: ListDeliveryNotesQueryDto,
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
    @Body() dto: CreateDeliveryNoteDto,
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.create(dto, user, branchId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryNoteDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/mark-delivered')
  markDelivered(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkDeliveredDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.markDelivered(id, dto, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.cancel(id, user);
  }
}
