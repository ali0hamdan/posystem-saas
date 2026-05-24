import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';
import { SettingsModule } from '../settings/settings.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [AuthModule, StockModule, SettingsModule],
  controllers: [ProductsController],
  providers: [ProductsService, BranchScopeService],
})
export class ProductsModule {}
