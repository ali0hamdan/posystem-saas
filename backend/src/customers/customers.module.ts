import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerLedgerService } from './customer-ledger.service';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerLedgerService],
  exports: [CustomersService, CustomerLedgerService],
})
export class CustomersModule {}
