import { StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
} from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @NotEquals(0)
  quantityChange!: number;

  @IsIn([
    StockMovementType.ADJUSTMENT,
    StockMovementType.DAMAGE,
    StockMovementType.EXPIRED,
  ])
  type!: StockMovementType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allowNegativeStock?: boolean;
}
