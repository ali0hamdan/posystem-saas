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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { StockTransfersService } from './stock-transfers.service';
import { CreateStockTransferDto, UpdateStockTransferStatusDto } from './dto/stock-transfer.dto';
import { ListStockTransfersQueryDto } from './dto/list-stock-transfers.query.dto';

@Controller('stock-transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Post()
  create(@Body() dto: CreateStockTransferDto, @CurrentUser() user: SafeUser) {
    return this.stockTransfersService.create(dto, user);
  }

  @Get()
  list(@Query() query: ListStockTransfersQueryDto, @CurrentUser() user: SafeUser) {
    return this.stockTransfersService.list(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.stockTransfersService.findOne(id, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockTransferStatusDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.stockTransfersService.updateStatus(id, dto, user);
  }
}
