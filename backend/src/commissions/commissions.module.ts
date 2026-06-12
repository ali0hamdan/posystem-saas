import { Module } from '@nestjs/common';
import { CommissionsController } from './commissions.controller';
import { SalesCommissionService } from './sales-commission.service';
import { SalesmanIdModule } from '../users/salesman-id.module';

@Module({
  imports: [SalesmanIdModule],
  controllers: [CommissionsController],
  providers: [SalesCommissionService],
  exports: [SalesCommissionService],
})
export class CommissionsModule {}