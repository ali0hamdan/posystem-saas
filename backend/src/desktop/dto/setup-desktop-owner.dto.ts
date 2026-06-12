import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BusinessType, LicensePlan } from '@prisma/client';

/**
 * Activation-derived license payload — written by Electron's
 * local-activation-manager to {@code license.json} and posted from the
 * renderer once the owner picks a password.
 */
export class DesktopLicensePayload {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  clientId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  businessName!: string;

  @IsEnum(BusinessType)
  businessType!: BusinessType;

  @IsEmail()
  @MaxLength(160)
  ownerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  @IsOptional()
  @IsEnum(LicensePlan)
  planCode?: LicensePlan;

  @IsOptional()
  @IsBoolean()
  lifetimeLicense?: boolean;

  @IsOptional()
  @IsDateString()
  subscriptionExpiresAt?: string | null;
}

export class SetupDesktopOwnerDto {
  @ValidateNested()
  @Type(() => DesktopLicensePayload)
  license!: DesktopLicensePayload;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultBranchName?: string;
}
