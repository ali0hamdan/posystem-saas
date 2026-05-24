import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockService } from './stock.service';
import { StockMovementsController } from './stock-movements.controller';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [AuthModule],
  controllers: [StockMovementsController],
  providers: [StockService, BranchScopeService],
  exports: [StockService],
})
export class StockModule {}
