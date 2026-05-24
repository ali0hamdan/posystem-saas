import { PaymentStatus, SaleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListSalesQueryDto {
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
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  /** OWNER/ADMIN only: filter by cashier. Ignored for CASHIER. */
  @IsOptional()
  @IsUUID()
  cashierId?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  /** Optional override (OWNER): filter by branch when listing all accessible branches is not used. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
