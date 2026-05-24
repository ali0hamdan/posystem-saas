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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers.query.dto';
import { ListLedgerQueryDto } from './dto/list-ledger.query.dto';
import { CustomerPaymentDto } from './dto/customer-payment.dto';
import { AdjustCustomerBalanceDto } from './dto/adjust-balance.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Query() query: ListCustomersQueryDto, @CurrentUser() user: SafeUser) {
    return this.customersService.findAll(query, user.clientId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: SafeUser) {
    return this.customersService.create(dto, user.clientId);
  }

  @Get(':id/ledger')
  ledger(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListLedgerQueryDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.customersService.getLedger(id, query, user.clientId);
  }

  @Post(':id/payment')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER)
  payment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerPaymentDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.customersService.recordPayment(id, dto, user.id, user.clientId);
  }

  @Post(':id/adjust-balance')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  adjustBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCustomerBalanceDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.customersService.adjustBalance(id, dto, user.id, user.clientId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.customersService.findOne(id, user.clientId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.customersService.update(id, dto, user.clientId);
  }
}
