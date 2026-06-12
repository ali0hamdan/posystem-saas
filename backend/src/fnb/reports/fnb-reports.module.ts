import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FnbReportsService } from './reports.service';
import { FnbReportsController } from './reports.controller';

@Module({
  imports: [AuthModule],
  controllers: [FnbReportsController],
  providers: [FnbReportsService],
  exports: [FnbReportsService],
})
export class FnbReportsModule {}
