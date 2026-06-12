import { SalesCommissionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCommissionSettingsDto {
  @IsOptional()
  @IsBoolean()
  commissionEnabled?: boolean;

  @IsOptional()
  @IsEnum(SalesCommissionType)
  commissionType?: SalesCommissionType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedCommissionAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commissionNotes?: string | null;
}
