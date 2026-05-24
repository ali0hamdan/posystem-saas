import { Module } from '@nestjs/common';
import { LicenseModule } from '../license/license.module';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';

@Module({
  imports: [LicenseModule],
  controllers: [ActivationController],
  providers: [ActivationService],
})
export class ActivationModule {}
