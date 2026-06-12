import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly pub: PublicService) {}

  @Get('plans')
  listPlans() {
    return this.pub.listActivePlans();
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() dto: RegisterClientDto) {
    return this.pub.registerClient(dto);
  }

  @Post('verify-email-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.pub.verifyEmailOtp(dto);
  }

  @Post('resend-email-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resendEmailOtp(@Body() dto: ResendEmailOtpDto) {
    return this.pub.resendEmailOtp(dto);
  }

  @Get('payments/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getPaymentStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.pub.getPaymentStatus(id);
  }

  @Post('payments/:id/simulate-success')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  simulateSuccess(@Param('id', ParseUUIDPipe) id: string) {
    return this.pub.simulatePaymentSuccess(id);
  }
}
