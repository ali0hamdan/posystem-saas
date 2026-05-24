import { StockTransferStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockTransferLineDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateStockTransferDto {
  @IsUUID()
  fromBranchId!: string;

  @IsUUID()
  toBranchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDto)
  items!: StockTransferLineDto[];
}

export class UpdateStockTransferStatusDto {
  @IsEnum(StockTransferStatus)
  @IsNotEmpty()
  status!: StockTransferStatus;
}
