import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';
import { SettingsModule } from '../settings/settings.module';
import { CustomersModule } from '../customers/customers.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [AuthModule, StockModule, SettingsModule, CustomersModule],
  controllers: [SalesController],
  providers: [SalesService, BranchScopeService],
})
export class SalesModule {}
