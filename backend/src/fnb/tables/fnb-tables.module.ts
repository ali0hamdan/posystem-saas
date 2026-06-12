import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FnbTablesService } from './tables.service';
import { DiningAreasController } from './dining-areas.controller';
import { TablesController } from './tables.controller';

@Module({
  imports: [AuthModule],
  controllers: [DiningAreasController, TablesController],
  providers: [FnbTablesService],
  exports: [FnbTablesService],
})
export class FnbTablesModule {}
