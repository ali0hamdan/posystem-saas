import {
  IsString, IsEnum, IsNumber, IsOptional, IsBoolean,
  IsDateString, IsPositive, Min, MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CouponType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  value!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ValidateCouponDto {
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  code!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  orderAmount!: number;
}
