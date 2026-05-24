import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  activationCode!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(120)
  deviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ownerName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
