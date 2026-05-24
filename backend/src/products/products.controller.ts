import {

  Body,

  Controller,

  Delete,

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

import { ProductsService } from './products.service';

import {

  CreateProductDto,

  ListProductsQueryDto,

  ProductSearchQueryDto,

  GenerateSkuQueryDto,

  CheckBarcodeQueryDto,

} from './dto/product.dto';

import { UpdateProductDto } from './dto/update-product.dto';

import { BranchScopeService } from '../branch/branch-scope.service';



@Controller('products')

@UseGuards(JwtAuthGuard, RolesGuard)

export class ProductsController {

  constructor(

    private readonly productsService: ProductsService,

    private readonly branchScope: BranchScopeService,

  ) {}



  @Get('search')

  async search(

    @Query() query: ProductSearchQueryDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.search(query, user.role, branchId, user.clientId);

  }



  @Get('low-stock')

  async lowStock(

    @Query() query: ListProductsQueryDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.findLowStock(query, user.role, branchId, user.clientId);

  }



  @Get('barcode/:barcode')

  async findByBarcode(

    @Param('barcode') barcode: string,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.findByBarcode(barcode, user.role, branchId, user.clientId);

  }



  @Get()

  async findAll(

    @Query() query: ListProductsQueryDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.findAll(query, user.role, branchId, user.clientId);

  }



  @Get('generate-sku')

  @Roles(UserRole.OWNER, UserRole.ADMIN)

  async generateSku(

    @Query() query: GenerateSkuQueryDto,

    @CurrentUser() user: SafeUser,

  ) {

    const sku = await this.productsService.generateSku(

      user.clientId,

      query.categoryId,

      query.productName,

      query.excludeId,

    );

    return { sku };

  }



  @Post('generate-barcode')

  @Roles(UserRole.OWNER, UserRole.ADMIN)

  async generateBarcode(@CurrentUser() user: SafeUser) {

    const barcode = await this.productsService.generateInternalBarcode(user.clientId);

    return { barcode };

  }



  @Get('check-barcode')

  @Roles(UserRole.OWNER, UserRole.ADMIN)

  async checkBarcode(

    @Query() query: CheckBarcodeQueryDto,

    @CurrentUser() user: SafeUser,

  ) {

    return this.productsService.checkBarcodeUnique(

      user.clientId,

      query.barcode,

      query.excludeId,

    );

  }



  @Get(':id')

  async findOne(

    @Param('id', ParseUUIDPipe) id: string,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.findOne(id, user.role, branchId, user.clientId);

  }



  @Post()

  @Roles(UserRole.OWNER, UserRole.ADMIN)

  async create(

    @Body() dto: CreateProductDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.create(dto, user.id, branchId, user.clientId);

  }



  @Patch(':id')

  @Roles(UserRole.OWNER, UserRole.ADMIN)

  async update(

    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: UpdateProductDto,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.update(id, dto, user.id, branchId, user.clientId);

  }



  @Delete(':id')

  @Roles(UserRole.OWNER, UserRole.ADMIN)

  async remove(

    @Param('id', ParseUUIDPipe) id: string,

    @CurrentUser() user: SafeUser,

    @Headers('x-branch-id') branchHeader?: string,

  ) {

    const branchId = await this.branchScope.resolveBranchId(user, branchHeader);

    return this.productsService.softDelete(id, user.id, branchId, user.clientId);

  }

}


