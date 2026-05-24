import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LicensePlan, PlanType } from '@prisma/client';

export class CreateSaasPlanDto {
  @IsEnum(LicensePlan)
  code!: LicensePlan;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  yearlyPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  oneTimePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxUsers!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  maxBranches!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxDevices!: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  allowsDesktopDownload?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
