import { Transform } from 'class-transformer';
import { ReceiptPaperSize, RefundApprovalMethod } from '@prisma/client';
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

  // B2B document workflow settings.
  @IsOptional()
  @IsBoolean()
  enableQuotations?: boolean;

  @IsOptional()
  @IsBoolean()
  enableProformaInvoices?: boolean;

  @IsOptional()
  @IsBoolean()
  enableStockReservation?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  quotationValidityDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  proformaValidityDays?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2000)
  quotationTerms?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2000)
  proformaTerms?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,8}$/, { message: 'quotationPrefix must be 1-8 alphanumeric chars (or "-")' })
  quotationPrefix?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,8}$/, { message: 'proformaPrefix must be 1-8 alphanumeric chars (or "-")' })
  proformaPrefix?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,8}$/, { message: 'invoicePrefix must be 1-8 alphanumeric chars (or "-")' })
  invoicePrefix?: string;

  @IsOptional()
  @IsBoolean()
  showTaxOnQuotation?: boolean;

  @IsOptional()
  @IsBoolean()
  showSignatureArea?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,8}$/, { message: 'deliveryNotePrefix must be 1-8 alphanumeric chars (or "-")' })
  deliveryNotePrefix?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  defaultPaymentTermsDays?: number;

  @IsOptional()
  @IsBoolean()
  enableCustomerCredit?: boolean;

  @IsOptional()
  @IsBoolean()
  enableDeliveryNotes?: boolean;

  @IsOptional()
  @IsBoolean()
  enableApprovalWorkflow?: boolean;

  @IsOptional()
  @IsBoolean()
  allowOverCreditOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  allowOverStockOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyLowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyInvoicePayment?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyCustomerOverdue?: boolean;

  @IsOptional()
  @IsBoolean()
  notifySubscription?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyDeviceActivation?: boolean;

  @IsOptional()
  @IsEnum(RefundApprovalMethod)
  refundApprovalMethod?: RefundApprovalMethod;
}
