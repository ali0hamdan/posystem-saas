import {

  Body,

  Controller,

  Get,

  Headers,

  Param,

  ParseUUIDPipe,

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

import { ShiftsService } from './shifts.service';

import { OpenShiftDto, CloseShiftDto } from './dto/open-close-shift.dto';

import { ListShiftsQueryDto } from './dto/list-shifts.query.dto';

import { BranchScopeService } from '../branch/branch-scope.service';



@Controller('shifts')

@UseGuards(JwtAuthGuard, RolesGuard)

@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)

export class ShiftsController {

  constructor(

    private readonly shiftsService: ShiftsService,

    private readonly branchScope: BranchScopeService,

  ) {}



  @Post('open')

  async open(

    @Body() dto: OpenShiftDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.shiftsService.open(dto, user.id, branchId, user.clientId);

  }



  @Post('close')

  async close(

    @Body() dto: CloseShiftDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.shiftsService.close(dto, user.id, branchId, user.clientId);

  }



  @Get()

  async findAll(

    @Query() query: ListShiftsQueryDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.shiftsService.findAll(user, query, branchId);

  }



  @Get('current')

  async findCurrent(

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.shiftsService.findCurrent(user, branchId);

  }



  @Get(':id')

  async findOne(

    @Param('id', ParseUUIDPipe) id: string,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.shiftsService.findOne(id, user, branchId);

  }

}


