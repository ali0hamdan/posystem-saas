import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, ParseBoolPipe,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';

@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateCouponDto) {
    return this.coupons.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: SafeUser,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive = false,
  ) {
    return this.coupons.findAll(user, includeInactive);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@CurrentUser() user: SafeUser, @Body() dto: ValidateCouponDto) {
    return this.coupons.validate(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.coupons.findOne(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: SafeUser, @Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.coupons.remove(user, id);
  }
}
