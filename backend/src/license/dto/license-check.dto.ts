import { IsOptional, IsString, MinLength } from 'class-validator';

export class LicenseCheckDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  licenseToken?: string;
}
