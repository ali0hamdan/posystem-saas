import { Transform } from 'class-transformer';
import { ReceiptPaperSize } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  storeName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(40)
  storePhone?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2000)
  storeAddress?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(4000)
  receiptFooter?: string | null;

  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockDefault?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/i, { message: 'receiptLogo must be an http(s) URL' })
  receiptLogo?: string | null;

  @IsOptional()
  @IsEnum(ReceiptPaperSize)
  receiptPaperSize?: ReceiptPaperSize;

  @IsOptional()
  @IsBoolean()
  receiptAutoPrint?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  receiptCopies?: number;

  @IsOptional()
  @IsBoolean()
  receiptShowLogo?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(200)
  receiptPrinterName?: string | null;
}
