import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
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
import { Type } from 'class-transformer';
import { PaymentMethod, RefundSourceType, RefundType, RestockAction } from '@prisma/client';

export class RefundLineInputDto {
  @IsUUID()
  sourceItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @IsOptional()
  @IsEnum(RestockAction)
  restockAction?: RestockAction;

  @IsOptional()
  @IsString()
  @Max(500)
  reason?: string;
}

export class RefundApprovalInputDto {
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
}

export class PreviewRefundDto {
  @IsEnum(RefundSourceType)
  sourceType!: RefundSourceType;

  @IsUUID()
  sourceId!: string;

  @IsOptional()
  @IsBoolean()
  full?: boolean;

  @ValidateIf((o: PreviewRefundDto) => o.full !== true)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefundLineInputDto)
  items?: RefundLineInputDto[];
}

export class CreateUnifiedRefundDto extends PreviewRefundDto implements RefundApprovalInputDto {
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

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(RefundType)
  refundType?: RefundType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class ListRefundsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(RefundSourceType)
  sourceType?: RefundSourceType;

  @IsOptional()
  @IsUUID()
  sourceId?: string;
}
