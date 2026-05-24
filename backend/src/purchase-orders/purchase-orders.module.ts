import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [AuthModule, StockModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, BranchScopeService],
})
export class PurchaseOrdersModule {}
