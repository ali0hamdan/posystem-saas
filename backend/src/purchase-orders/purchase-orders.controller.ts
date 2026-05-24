import {

  Body,

  Controller,

  Get,

  Headers,

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

import { PurchaseOrdersService } from './purchase-orders.service';

import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders.query.dto';

import { BranchScopeService } from '../branch/branch-scope.service';



@Controller('purchase-orders')

@UseGuards(JwtAuthGuard, RolesGuard)

@Roles(UserRole.OWNER, UserRole.ADMIN)

export class PurchaseOrdersController {

  constructor(

    private readonly purchaseOrdersService: PurchaseOrdersService,

    private readonly branchScope: BranchScopeService,

  ) {}



  @Get()

  async findAll(

    @Query() query: ListPurchaseOrdersQueryDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.purchaseOrdersService.findAll(query, branchId, user.clientId);

  }



  @Post()

  async create(

    @Body() dto: CreatePurchaseOrderDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.purchaseOrdersService.create(dto, user.id, branchId, user.clientId);

  }



  @Get(':id')

  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {

    return this.purchaseOrdersService.findOne(id, user.clientId);

  }



  @Patch(':id')

  update(

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: UpdatePurchaseOrderDto,

    @CurrentUser() user: SafeUser,

  ) {

    return this.purchaseOrdersService.update(id, dto, user.id, user.clientId);

  }



  @Post(':id/receive')

  receive(

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: ReceivePurchaseOrderDto,

    @CurrentUser() user: SafeUser,

  ) {

    return this.purchaseOrdersService.receive(id, dto ?? {}, user.id, user.clientId);

  }

}


