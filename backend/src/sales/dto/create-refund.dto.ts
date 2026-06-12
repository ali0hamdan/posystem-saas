import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class RefundLineDto {
  @IsUUID()
  saleItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;
}

export class CreateRefundDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  approvalIdCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  nfcCardUid?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  approvalPin?: string;

  /** When true, refunds all remaining quantities on every sale line (ignores `items`). */
  @IsOptional()
  @IsBoolean()
  full?: boolean;

  @ValidateIf((o: CreateRefundDto) => o.full !== true)
  @IsArray()
  @ArrayMinSize(1, { message: 'items must not be empty unless full is true' })
  @ValidateNested({ each: true })
  @Type(() => RefundLineDto)
  items?: RefundLineDto[];
}
