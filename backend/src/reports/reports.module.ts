import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { CommercialReportsService } from './commercial-reports.service';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, CommercialReportsService, BranchScopeService],
})
export class ReportsModule {}
