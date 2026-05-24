import { IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateDeviceDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  activationCode!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(120)
  deviceId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  deviceName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  platform!: string;
}
