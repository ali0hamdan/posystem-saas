import { Module } from '@nestjs/common';
import { SalesmanIdService } from './salesman-id.service';

@Module({
  providers: [SalesmanIdService],
  exports: [SalesmanIdService],
})
export class SalesmanIdModule {}
