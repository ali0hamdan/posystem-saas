import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { WasteController } from './waste.controller';
import { WasteService } from './waste.service';

@Module({
  imports: [AuthModule],
  controllers: [WasteController],
  providers: [WasteService],
  exports: [WasteService],
})
export class WasteModule {}
