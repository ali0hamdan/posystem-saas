import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit/audit-log.module';
import { OtpModule } from '../otp/otp.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [AuditLogModule, OtpModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
