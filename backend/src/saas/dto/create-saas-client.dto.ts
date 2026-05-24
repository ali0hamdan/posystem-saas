import { LicensePlan } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateSaasClientOwnerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9._-]+$/, { message: 'username must be lowercase letters, digits, dot, underscore, or hyphen' })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;
}

export class CreateSaasClientSubscriptionDto {
  @IsEnum(LicensePlan)
  planCode!: LicensePlan;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  termDays?: number = 365;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxUsers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxBranches?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxDevices?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number;
}

export class CreateSaasClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, digits, and single hyphens',
  })
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  businessName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerName!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSaasClientOwnerDto)
  owner?: CreateSaasClientOwnerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSaasClientSubscriptionDto)
  subscription?: CreateSaasClientSubscriptionDto;
}
