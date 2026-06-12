import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FnbReservationsService } from './reservations.service';
import { FnbReservationsController } from './reservations.controller';

@Module({
  imports: [AuthModule],
  controllers: [FnbReservationsController],
  providers: [FnbReservationsService],
  exports: [FnbReservationsService],
})
export class FnbReservationsModule {}
