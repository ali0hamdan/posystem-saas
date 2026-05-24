import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [AuthModule],
  controllers: [ShiftsController],
  providers: [ShiftsService, BranchScopeService],
})
export class ShiftsModule {}
