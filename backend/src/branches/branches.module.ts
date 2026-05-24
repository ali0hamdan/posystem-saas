import { Module } from '@nestjs/common';
import { LicenseModule } from '../license/license.module';
import { AuthModule } from '../auth/auth.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [AuthModule, LicenseModule],
  controllers: [BranchesController],
  providers: [BranchesService, BranchScopeService],
  exports: [BranchesService],
})
export class BranchesModule {}
