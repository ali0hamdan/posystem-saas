import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ActivationService } from './activation.service';
import { ActivateDeviceDto } from './dto/activate-device.dto';

@Controller('activation')
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post('activate-device')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  activateDevice(@Body() dto: ActivateDeviceDto) {
    return this.activation.activateDevice(dto);
  }
}
